import axios from 'axios';
import FormData from 'form-data';
import * as OTPAuth from 'otpauth';
import { API_URLS } from '../config.js';
import { loadSession, saveSession, validateSession } from './session.js';
import { getAccessExtension } from '../helper.js';

const USERNAME = process.env.TV_USERNAME;
const PASSWORD = process.env.TV_PASSWORD;
const TOTP_SECRET = process.env.TV_TOTP_SECRET;

const BASE_HEADERS = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'origin': 'https://www.tradingview.com',
  'x-language': 'en',
  'x-requested-with': 'XMLHttpRequest',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};

function generateTOTP() {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(TOTP_SECRET),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  return totp.generate();
}

function parseCookies(response) {
  return (response.headers['set-cookie'] || [])
    .map(c => c.split(';')[0])
    .join('; ');
}

export class TradingView {
  constructor() {
    this.sessionid = null;
    this.cookies = null;
  }

  getAuthHeaders() {
    return {
      ...BASE_HEADERS,
      cookie: this.cookies,
      referer: 'https://www.tradingview.com/',
    };
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
      const valid = await validateSession(this.cookies);
      if (valid) return;
      this.sessionid = null;
      this.cookies = null;
    }

    const loginPayload = new FormData();
    loginPayload.append('username', USERNAME);
    loginPayload.append('password', PASSWORD);
    loginPayload.append('remember', 'true');

    const loginResponse = await axios.post(API_URLS.signin, loginPayload, {
      headers: {
        ...loginPayload.getHeaders(),
        ...BASE_HEADERS,
        referer: API_URLS.signin,
      },
      maxRedirects: 5,
    });

    if (loginResponse.data?.error) {
      throw new Error(`Login failed: ${loginResponse.data.error} (${loginResponse.data.code})`);
    }

    const loginCookies = parseCookies(loginResponse);
    const requires2FA = loginResponse.data?.code === '2FA_required';

    if (requires2FA) {
      if (!TOTP_SECRET) throw new Error('2FA required but TV_TOTP_SECRET is not set in .env');

      const totpPayload = new FormData();
      totpPayload.append('code', generateTOTP());

      const totpResponse = await axios.post(API_URLS.signin_totp, totpPayload, {
        headers: {
          ...totpPayload.getHeaders(),
          ...BASE_HEADERS,
          referer: 'https://www.tradingview.com/',
          cookie: loginCookies,
        },
        maxRedirects: 5,
      });

      this.cookies = parseCookies(totpResponse);
    } else {
      this.cookies = loginCookies;
    }

    const sessionMatch = this.cookies.match(/sessionid=([^;]+)/);
    if (!sessionMatch) throw new Error('Login failed – no sessionid in cookies');

    this.sessionid = sessionMatch[1];
    saveSession(this.cookies, this.sessionid);
  }

  async validateUsername(username) {
    await this.ensureSession();
    const { data } = await axios.get(`${API_URLS.username_hint}?s=${encodeURIComponent(username)}`);
    const lower = username.toLowerCase();
    const found = data.find(u => u.username.toLowerCase() === lower);
    return {
      validuser: !!found,
      verifiedUserName: found ? found.username : '',
    };
  }

  async getAccessDetails(username, pine_id) {
    await this.ensureSession();

    const { data } = await axios.post(
      `${API_URLS.list_users}?limit=10&order_by=-created`,
      new URLSearchParams({ pine_id, username }).toString(),
      {
        headers: {
          ...this.getAuthHeaders(),
          'content-type': 'application/x-www-form-urlencoded',
        },
      }
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

  async addAccess(accessDetails, extensionType, extensionLength) {
    await this.ensureSession();

    const payload = new FormData();
    payload.append('pine_id', accessDetails.pine_id);
    payload.append('username_recip', accessDetails.username);

    const endpoint = accessDetails.hasAccess ? API_URLS.modify_access : API_URLS.add_access;

    if (extensionType !== 'L') {
      const newExp = getAccessExtension(accessDetails.currentExpiration, extensionType, extensionLength);
      payload.append('expiration', newExp);
      accessDetails.expiration = newExp;
    } else {
      accessDetails.noExpiration = true;
    }

    const response = await axios.post(endpoint, payload, {
      headers: { ...payload.getHeaders(), ...this.getAuthHeaders() },
    });

    accessDetails.status = [200, 201].includes(response.status) ? 'Success' : 'Failure';
    return accessDetails;
  }

  async removeAccess(accessDetails) {
    await this.ensureSession();

    const payload = new FormData();
    payload.append('pine_id', accessDetails.pine_id);
    payload.append('username_recip', accessDetails.username);

    const response = await axios.post(API_URLS.remove_access, payload, {
      headers: { ...payload.getHeaders(), ...this.getAuthHeaders() },
    });

    accessDetails.status = response.status === 200 ? 'Success' : 'Failure';
    return accessDetails;
  }
}
