import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nameMap } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '..', '..', 'access-logs.json');

// Ensure file exists
ensureLogFile();

function ensureLogFile() {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify({}, null, 2));
    console.log('Created access-logs.json');
  }
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

export function logAccess(username, pineIds, action) {
  try {
    const prettyIds = pineIds.map(id => nameMap[id] || id);
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
