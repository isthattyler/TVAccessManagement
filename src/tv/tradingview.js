import axios from 'axios';
import FormData from 'form-data';
import * as OTPAuth from 'otpauth';
import { urls } from '../config/config.js';
import { getAccessExtension } from '../helper/helper.js';
import dotenv from 'dotenv';
dotenv.config();

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

function parseCookies(response) {
  return (response.headers['set-cookie'] || [])
    .map(c => c.split(';')[0])
    .join('; ');
}

function generateTOTP() {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(TOTP_SECRET),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  return totp.generate();
}

export class TradingView {
  constructor() {
    this.sessionid = null;
    this.cookies = null;
  }

  async ensureSession() {
    if (this.sessionid) {
      try {
        await axios.get(urls.tvcoins, { headers: { cookie: this.cookies }, timeout: 8000 });
        return;
      } catch (_) { /* session expired, re-login below */ }
    }

    // Step 1: username + password
    console.log('Logging in to TradingView...');
    const loginPayload = new FormData();
    loginPayload.append('username', USERNAME);
    loginPayload.append('password', PASSWORD);
    loginPayload.append('remember', 'true');

    const loginResponse = await axios.post(urls.signin, loginPayload, {
      headers: {
        ...loginPayload.getHeaders(),
        ...BASE_HEADERS,
        referer: urls.signin,
      },
      maxRedirects: 5,
    });

    const loginCookies = parseCookies(loginResponse);
    const requires2FA = loginResponse.data?.code === '2FA_required';

    // Step 2: TOTP (if 2FA enabled)
    if (requires2FA) {
      if (!TOTP_SECRET) throw new Error('2FA required but TV_TOTP_SECRET is not set in .env');

      console.log('2FA required, submitting TOTP...');
      const totpPayload = new FormData();
      totpPayload.append('code', generateTOTP());

      const totpResponse = await axios.post(urls.signin_totp, totpPayload, {
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
    console.log('Login successful.');
  }

  getAuthHeaders() {
    return {
      ...BASE_HEADERS,
      cookie: this.cookies,
      referer: 'https://www.tradingview.com/',
    };
  }

  async validateUsername(username) {
    await this.ensureSession();
    const { data } = await axios.get(`${urls.username_hint}?s=${encodeURIComponent(username)}`);
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
      `${urls.list_users}?limit=10&order_by=-created`,
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

    const endpoint = accessDetails.hasAccess ? urls.modify_access : urls.add_access;

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

    const response = await axios.post(urls.remove_access, payload, {
      headers: { ...payload.getHeaders(), ...this.getAuthHeaders() },
    });

    accessDetails.status = response.status === 200 ? 'Success' : 'Failure';
    return accessDetails;
  }
}