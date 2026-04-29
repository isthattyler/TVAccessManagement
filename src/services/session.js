import axios from 'axios';
import fs from 'fs';
import { API_URLS, DEFAULTS } from '../config.js';

const SESSION_FILE = DEFAULTS.SESSION_FILE;
const SESSION_TTL = DEFAULTS.SESSION_TTL;

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

export async function validateSession(cookies) {
  try {
    await axios.get(API_URLS.tvcoins, { headers: { cookie: cookies }, timeout: DEFAULTS.HEADER_TIMEOUT });
    return true;
  } catch {
    return false;
  }
}
