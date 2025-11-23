import axios from 'axios';
import FormData from 'form-data';
import { urls } from '../config/config.js';
import { getAccessExtension } from '../helper/helper.js';
import dotenv from 'dotenv';
dotenv.config();

const USERNAME = process.env.TV_USERNAME;
const PASSWORD = process.env.TV_PASSWORD;

export class TradingView {
  constructor() {
    this.sessionid = null;
  }

  async ensureSession() {
    if (this.sessionid) {
      // quick validation
      try {
        await axios.get(urls.tvcoins, { headers: { cookie: `sessionid=${this.sessionid}` }, timeout: 8000 });
        return;
      } catch (_) { /* ignore */ }
    }

    console.log("Logging in to TradingView...");
    const loginPayload = new FormData();
    loginPayload.append('username', USERNAME);
    loginPayload.append('password', PASSWORD);
    loginPayload.append('remember', 'on');

    const loginResponse = await axios.post(urls.signin, loginPayload, {
      headers: {
        ...loginPayload.getHeaders(),
        origin: 'https://www.tradingview.com',
        referer: 'https://www.tradingview.com',
        'user-agent': 'Mozilla/5.0 (compatible; TradingViewBot/1.0)'
      },
      maxRedirects: 5
    });

    const cookies = loginResponse.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.includes('sessionid='));
    if (!sessionCookie) throw new Error("Login failed – no sessionid cookie");

    this.sessionid = sessionCookie.split(';')[0].split('=')[1];
    console.log("New sessionid obtained");
  }

  getCookieHeader() {
    return { cookie: `sessionid=${this.sessionid}` };
  }

  async validateUsername(username) {
    await this.ensureSession();
    const { data } = await axios.get(`${urls.username_hint}?s=${encodeURIComponent(username)}`);
    const lower = username.toLowerCase();
    const found = data.find(u => u.username.toLowerCase() === lower);
    return {
      validuser: !!found,
      verifiedUserName: found ? found.username : ''
    };
  }

  async getAccessDetails(username, pine_id) {
    await this.ensureSession();

    const payload = new URLSearchParams({
      pine_id,
      username
    });

    const { data } = await axios.post(
      `${urls.list_users}?limit=10&order_by=-created`,
      payload.toString(),
      {
        headers: {
          ...this.getCookieHeader(),
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://www.tradingview.com'
        }
      }
    );

    const userEntry = data.results.find(u => u.username.toLowerCase() === username.toLowerCase());

    const details = {
      pine_id,
      username,
      hasAccess: !!userEntry,
      noExpiration: userEntry ? !userEntry.expiration : false,
      currentExpiration: userEntry?.expiration || new Date().toISOString()
    };

    return details;
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
      headers: {
        ...payload.getHeaders(),
        ...this.getCookieHeader(),
        origin: 'https://www.tradingview.com'
      }
    });

    accessDetails.status = (response.status === 200 || response.status === 201) ? 'Success' : 'Failure';
    return accessDetails;
  }

  async removeAccess(accessDetails) {
    await this.ensureSession();

    const payload = new FormData();
    payload.append('pine_id', accessDetails.pine_id);
    payload.append('username_recip', accessDetails.username);

    const response = await axios.post(urls.remove_access, payload, {
      headers: {
        ...payload.getHeaders(),
        ...this.getCookieHeader(),
        origin: 'https://www.tradingview.com'
      }
    });

    accessDetails.status = response.status === 200 ? 'Success' : 'Failure';
    return accessDetails;
  }
}