import axios from 'axios';
import FormData from 'form-data';
import * as OTPAuth from 'otpauth';
import { config } from '../config/config.js';
import { getAccessExtension } from '../helper/helper.js';
import { loadSession, saveSession, validateSession } from '../services/session.js';
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

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 30000;

/**
 * Parse cookies from response headers
 */
function parseCookies(response) {
  return (response.headers['set-cookie'] || [])
    .map(c => c.split(';')[0])
    .join('; ');
}

/**
 * Generate TOTP code for 2FA
 */
function generateTOTP() {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(TOTP_SECRET),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  return totp.generate();
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry(fn, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = Math.pow(2, i) * 1000;
      console.log(`Request failed (${err.code || err.message}), retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export class TradingView {
  constructor() {
    this.sessionid = null;
    this.cookies = null;
  }

  /**
   * Ensure valid session exists, login if needed
   */
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
      console.log('Session invalid, re-logging in...');
      this.sessionid = null;
      this.cookies = null;
    }

    await this.login();
  }

  /**
   * Perform login to TradingView
   */
  async login() {
    console.log('Logging in to TradingView...');

    const loginPayload = new FormData();
    loginPayload.append('username', USERNAME);
    loginPayload.append('password', PASSWORD);
    loginPayload.append('remember', 'true');

    const loginResponse = await withRetry(() =>
      axios.post(config.urls.signin, loginPayload, {
        headers: {
          ...loginPayload.getHeaders(),
          ...BASE_HEADERS,
          referer: config.urls.signin,
        },
        maxRedirects: 5,
        timeout: REQUEST_TIMEOUT,
      })
    );

    if (loginResponse.data?.error && loginResponse.data?.code !== '2FA_required') {
      throw new Error(`Login failed: ${loginResponse.data.error} (${loginResponse.data.code})`);
    }

    const loginCookies = parseCookies(loginResponse);
    const requires2FA = loginResponse.data?.code === '2FA_required';

    if (requires2FA) {
      if (!TOTP_SECRET) {
        throw new Error('2FA required but TV_TOTP_SECRET is not set in .env');
      }

      console.log('2FA required, submitting TOTP...');
      const totpPayload = new FormData();
      totpPayload.append('code', generateTOTP());

      const totpResponse = await withRetry(() =>
        axios.post(config.urls.signin_totp, totpPayload, {
          headers: {
            ...totpPayload.getHeaders(),
            ...BASE_HEADERS,
            referer: 'https://www.tradingview.com/',
            cookie: loginCookies,
          },
          maxRedirects: 5,
          timeout: REQUEST_TIMEOUT,
        })
      );

      this.cookies = parseCookies(totpResponse);
    } else {
      this.cookies = loginCookies;
    }

    const sessionMatch = this.cookies.match(/sessionid=([^;]+)/);
    if (!sessionMatch) {
      throw new Error('Login failed – no sessionid in cookies');
    }

    this.sessionid = sessionMatch[1];
    saveSession(this.cookies, this.sessionid);
    console.log('Login successful.');
  }

  /**
   * Get authenticated headers with session cookies
   */
  getAuthHeaders() {
    return {
      ...BASE_HEADERS,
      cookie: this.cookies,
      referer: 'https://www.tradingview.com/',
    };
  }

  /**
   * Validate if a username exists on TradingView
   */
  async validateUsername(username) {
    await this.ensureSession();

    const { data } = await withRetry(() =>
      axios.get(`${config.urls.username_hint}?s=${encodeURIComponent(username)}`, {
        headers: this.getAuthHeaders(),
        timeout: REQUEST_TIMEOUT,
      })
    );

    const lower = username.toLowerCase();
    const found = data.find(u => u.username.toLowerCase() === lower);
    return {
      validuser: !!found,
      verifiedUserName: found ? found.username : '',
    };
  }

  /**
   * Get access details for a user and pine script
   */
  async getAccessDetails(username, pine_id) {
    await this.ensureSession();

    const { data } = await withRetry(() =>
      axios.post(
        `${config.urls.list_users}?limit=10&order_by=-created`,
        new URLSearchParams({ pine_id, username }).toString(),
        {
          headers: {
            ...this.getAuthHeaders(),
            'content-type': 'application/x-www-form-urlencoded',
          },
          timeout: REQUEST_TIMEOUT,
        }
      )
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

  /**
   * Grant or extend access for a user
   */
  async addAccess(accessDetails, extensionType, extensionLength) {
    await this.ensureSession();

    const payload = new FormData();
    payload.append('pine_id', accessDetails.pine_id);
    payload.append('username_recip', accessDetails.username);

    const endpoint = accessDetails.hasAccess ? config.urls.modify_access : config.urls.add_access;

    if (extensionType !== 'L') {
      const newExp = getAccessExtension(accessDetails.currentExpiration, extensionType, extensionLength);
      payload.append('expiration', newExp);
      accessDetails.expiration = newExp;
    } else {
      accessDetails.noExpiration = true;
    }

    const response = await withRetry(() =>
      axios.post(endpoint, payload, {
        headers: { ...payload.getHeaders(), ...this.getAuthHeaders() },
        timeout: REQUEST_TIMEOUT,
      })
    );

    accessDetails.status = [200, 201].includes(response.status) ? 'Success' : 'Failure';
    return accessDetails;
  }

  /**
   * Direct grant access without fetching existing details
   * (bypasses the list_users endpoint which can be unreliable)
   */
  async directGrant(username, pine_id, extensionType, extensionLength) {
    await this.ensureSession();

    const payload = new FormData();
    payload.append('pine_id', pine_id);
    payload.append('username_recip', username);

    if (extensionType !== 'L') {
      const newExp = getAccessExtension(new Date().toISOString(), extensionType, extensionLength);
      payload.append('expiration', newExp);
    }

    const response = await withRetry(() =>
      axios.post(config.urls.add_access, payload, {
        headers: { ...payload.getHeaders(), ...this.getAuthHeaders() },
        timeout: REQUEST_TIMEOUT,
      })
    );

    return {
      pine_id,
      username,
      hasAccess: true,
      status: [200, 201].includes(response.status) ? 'Success' : 'Failure',
    };
  }

  /**
   * Revoke access for a user
   */
  async removeAccess(accessDetails) {
    await this.ensureSession();

    const payload = new FormData();
    payload.append('pine_id', accessDetails.pine_id);
    payload.append('username_recip', accessDetails.username);

    const response = await withRetry(() =>
      axios.post(config.urls.remove_access, payload, {
        headers: { ...payload.getHeaders(), ...this.getAuthHeaders() },
        timeout: REQUEST_TIMEOUT,
      })
    );

    accessDetails.status = response.status === 200 ? 'Success' : 'Failure';
    return accessDetails;
  }
}
