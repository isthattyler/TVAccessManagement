// src/logger.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '..', '..', 'access-logs.json');
const PINE_NAMES = {
    "PUB;fad4694201c0492caa1ea2815c92fa40": "Fractal Model Lite",
    "PUB;6e687c53f1df41d4897f1a944a074ffd": "SD Range Lite",
    "PUB;af8ad7682e624bcdb15d758d3e2d06f7": "PD RTH"
}

// Ensure file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify({}, null, 2));
  console.log('Created access-logs.json');
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export function logAccess(username, pineIds, action = 'check') {
  try {
    const prettyIds = pineIds.map(id => PINE_NAMES[id] || id);
    const today = getTodayKey();
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    const logs = raw ? JSON.parse(raw) : {};

    if (!logs[today]) logs[today] = {};
    if (!logs[today][username]) logs[today][username] = [];

    const entry = {
      action,                    // 'check', 'grant', 'revoke'
      pine_ids: pineIds,
      timestamp: new Date().toISOString()
    };

    // Avoid duplicates in the same day (optional)
    const existing = logs[today][username].find(e => 
      e.action === action && JSON.stringify(e.pine_ids) === JSON.stringify(pineIds)
    );
    if (!existing) {
      logs[today][username].push(entry);
    }

    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    console.log(`[LOG] ${today} | ${username} | ${action} | ${prettyIds.join(', ')}`);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}