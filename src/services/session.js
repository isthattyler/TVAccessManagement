import axios from 'axios';
import fs from 'fs';
import { URLS, DEFAULTS } from '../config/constants.js';

const SESSION_FILE = DEFAULTS.SESSION_FILE;
const SESSION_TTL = DEFAULTS.SESSION_TTL;

const BASE_HEADERS = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'origin': 'https://www.tradingview.com',
  'x-language': 'en',
  'x-requested-with': 'XMLHttpRequest',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};

export function loadSession() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    if (Date.now() - data.savedAt > SESSION_TTL) {
      console.log('Cached session expired, will re-login.');
      return null;
    }
    console.log('Loaded session from disk.');
    return data;
  } catch {
    return null;
  }
}

export function saveSession(cookies, sessionid) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, sessionid, savedAt: Date.now() }, null, 2));
  console.log('Session saved to disk.');
}

export function validateSession(cookies) {
  return axios
    .get(URLS.tvcoins, { headers: { cookie: cookies }, timeout: DEFAULTS.HEADER_TIMEOUT })
    .then(() => true)
    .catch(() => false);
}
