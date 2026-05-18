import express from 'express';
import { TradingView } from './tv/tradingview.js';
import { logAccess } from './services/logger.js';
import { parseDuration } from './helper/helper.js';

const router = express.Router();
const tv = new TradingView();

// Validate username format (alphanumeric + underscore only)
function isValidUsername(username) {
  return /^[a-zA-Z0-9_]+$/.test(username);
}

// GET /validate/:username
router.get('/validate/:username', async (req, res) => {
  const { username } = req.params;

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Invalid username format' });
  }

  try {
    const result = await tv.validateUsername(username);
    logAccess(username.toLowerCase(), [], 'validate');
    res.json(result);
  } catch (err) {
    console.error('Validate error:', err.message);
    res.status(500).json({ errorMessage: 'Service temporarily unavailable' });
  }
});

// Unified handler for /access/:username (GET, POST, DELETE)
router.route('/access/:username').all(async (req, res) => {
  const { username } = req.params;
  const { pine_ids, duration } = req.body;

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Invalid username format' });
  }

  const lowerUser = username.toLowerCase();

  try {
    if ((req.method === 'POST' || req.method === 'DELETE') && (!Array.isArray(pine_ids) || pine_ids.length === 0)) {
      return res.status(400).json({ error: 'pine_ids array required' });
    }

    const pineIds = pine_ids || [];

    // Fetch access details in parallel for better performance
    const accessList = await Promise.all(
      pineIds.map(pine_id => tv.getAccessDetails(username, pine_id))
    );

    let action = 'check';

    if (req.method === 'POST') {
      action = 'grant';
      const durationValue = parseDuration(duration);

      if (!durationValue) {
        return res.status(400).json({ error: 'Invalid duration format' });
      }

      await Promise.all(
        accessList.map(access => tv.addAccess(access, durationValue.type, durationValue.value))
      );
    }

    if (req.method === 'DELETE') {
      action = 'revoke';
      await Promise.all(
        accessList.map(access => tv.removeAccess(access))
      );
    }

    logAccess(lowerUser, pineIds, action);
    res.json(accessList);
  } catch (err) {
    console.error('Access error:', err.message);
    res.status(500).json({ errorMessage: 'Service temporarily unavailable' });
  }
});

router.get('/', (req, res) => res.send('TradingView Access Manager API is running'));

export default router;
