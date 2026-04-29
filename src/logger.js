import fs from 'fs';
import { PINE_NAMES } from './config.js';

const LOG_FILE = './access-logs.json';

if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify({}, null, 2));
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

export function logAccess(username, pineIds, action) {
  try {
    const prettyIds = pineIds.map(id => PINE_NAMES[id] || id);
    const today = getTodayKey();
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    const logs = raw ? JSON.parse(raw) : {};

    if (!logs[today]) logs[today] = {};
    if (!logs[today][username]) logs[today][username] = [];

    const entry = {
      action,
      pine_ids: pineIds,
      timestamp: new Date().toISOString()
    };

    const existing = logs[today][username].find(e =>
      e.action === action && JSON.stringify(e.pine_ids) === JSON.stringify(pineIds)
    );

    if (!existing) {
      logs[today][username].push(entry);
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
      console.log(`[LOG] ${today} | ${username} | ${action} | ${prettyIds.join(', ')}`);
    }
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}
