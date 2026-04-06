import axios from 'axios';
import FormData from 'form-data';
import * as OTPAuth from 'otpauth';
import { config } from '../config/config.js';
import { loadSession, saveSession } from './session.js';
import { getAccessExtension } from '../helper/helper.js';

const USERNAME = process.env.TV_USERNAME;
const PASSWORD = process.env.TV_PASSWORD;
const TOTP_SECRET = process.env.TV_TOTP_SECRET;

export class TradingView {
  constructor() {
    this.sessionid = null;
    this.cookies = null;
  }

  async ensureSession() {
    if (!this.sessionid) {
      const saved = loadSession();
      if (saved) {
        this.cookies = saved.cookies;
        this.sessionid = saved.sessionid;
      }
    }

    if (this.sessionid) {
      try {
        await validateSession(this.cookies);
        return;
      } catch {
        this.sessionid = null;
        this.cookies = null;
      }
    }

    const loginPayload = new FormData();
    loginPayload.append('username', USERNAME);
    loginPayload.append('password', PASSWORD);
    loginPayload.append('remember', 'true');

    const loginResponse = await this.login(loginPayload, config.urls.signin, 'signin', this.sessionid);

    if (loginResponse.data?.error) {
      throw new Error(`Login failed: ${loginResponse.data.error} (${loginResponse.data.code})`);
    }

    this.cookies = loginResponse.headers['set-cookie']?.join('; ');;

    if (!this.cookies) throw new Error('Login failed – no cookies received');

    const requires2FA = loginResponse.data?.code === '2FA_required';

    if (requires2FA) {
      if (!TOTP_SECRET) throw new Error('2FA required but TV_TOTP_SECRET is not set in .env');

      const totpPayload = new FormData();
      totpPayload.append('code', this.generateTOTP());

      const totpResponse = await this.login(totpPayload, config.urls.signin_totp, 'signin_totp', this.cookies);

      this.cookies = totpResponse.headers['set-cookie']?.join('; ');;

      if (!this.cookies) throw new Error('2FA failed – no cookies received');
    }

    const sessionMatch = this.cookies.match(/sessionid=([^;]+)/);
    if (!sessionMatch) throw new Error('Login failed – no sessionid in cookies');

    this.sessionid = sessionMatch[1];
    saveSession(this.cookies, this.sessionid);
  }

  async login(payload, url, label, currentCookie) {
    return axios.post(url, payload, {
      headers: {
        ...payload.getHeaders(),
        ...this.getAuthHeaders(currentCookie),
        referer: this.getReferrerForUrl(url),
      },
      maxRedirects: 5,
    });
  }

  generateTOTP() {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(TOTP_SECRET),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });
    return totp.generate();
  }

  getAuthHeaders(currentCookie = '') {
    return {
      ...this.getBaseHeaders(),
      cookie: currentCookie,
      referer: 'https://www.tradingview.com/',
    };
  }

  getBaseHeaders() {
    return {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'origin': 'https://www.tradingview.com',
      'x-language': 'en',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    };
  }

  getReferrerForUrl(url) {
    if (url.includes('signin')) return 'https://www.tradingview.com/accounts/signin/';
    if (url.includes('totp')) return 'https://www.tradingview.com/';
    return 'https://www.tradingview.com/';
  }

  async validateUsername(username) {
    const { data } = await axios.get(`${config.urls.username_hint}?s=${encodeURIComponent(username)}`);
    const lower = username.toLowerCase();
    const found = data.find(u => u.username.toLowerCase() === lower);
    return {
      validuser: !!found,
      verifiedUserName: found ? found.username : '',
    };
  }

  async getAccessDetails(username, pine_id) {
    const params = new URLSearchParams().set('limit', '10').set('order_by', '-created');
    const { data } = await axios.post(
      `${config.urls.list_users}?limit=10&order_by=-created`,
      new URLSearchParams({ pine_id, username }).toString(),
      { headers: { ...this.getAuthHeaders(), 'content-type': 'application/x-www-form-urlencoded' } }
    );

    const userEntry = data.results?.find(u => u.username.toLowerCase() === username.toLowerCase());
    return {
      pine_id,
      username,
      hasAccess: !!userEntry,
      noExpiration: userEntry ? !userEntry.expiration : false,
      currentExpiration: userEntry?.expiration || new Date().toISOString(),
    };
  }

  async addAccess(details, extensionType, extensionLength) {
    await this.ensureSession();

    const payload = new FormData();
    payload.append('pine_id', details.pine_id);
    payload.append('username_recip', details.username);

    if (extensionType !== 'L') {
      const newExp = getAccessExtension(details.currentExpiration, extensionType, extensionLength);
      payload.append('expiration', newExp);
      details.expiration = newExp;
    } else {
      details.noExpiration = true;
    }

    const response = await axios.post(config.urls.add_access, payload, {
      headers: { ...payload.getHeaders(), ...this.getAuthHeaders() },
    });

    details.status = [200, 201].includes(response.status) ? 'Success' : 'Failure';
    return details;
  }

  async removeAccess(details) {
    await this.ensureSession();

    const payload = new FormData();
    payload.append('pine_id', details.pine_id);
    payload.append('username_recip', details.username);

    const response = await axios.post(config.urls.remove_access, payload, {
      headers: { ...payload.getHeaders(), ...this.getAuthHeaders() },
    });

    details.status = response.status === 200 ? 'Success' : 'Failure';
    return details;
  }
}
