import express from 'express';
import { TradingView } from './tv/tradingview.js';
import { logAccess } from './services/logger.js';
import { parseDuration } from './helper/helper.js';
import { PINE_NAMES } from './config/constants.js';

const router = express.Router();
const tv = new TradingView();

// Validate username format (alphanumeric + underscore only)
function isValidUsername(username) {
  return /^[a-zA-Z0-9_-]+$/.test(username);
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

    let accessList;
    let action = 'check';

    if (req.method === 'POST') {
      action = 'grant';
      const durationValue = parseDuration(duration);

      if (!durationValue) {
        return res.status(400).json({ error: 'Invalid duration format' });
      }

      accessList = await Promise.all(
        pineIds.map(pine_id => tv.directGrant(username, pine_id, durationValue.type, durationValue.value))
      );
    } else {
      // Fetch access details in parallel for better performance
      accessList = await Promise.all(
        pineIds.map(pine_id => tv.getAccessDetails(username, pine_id))
      );

      if (req.method === 'DELETE') {
        action = 'revoke';
        await Promise.all(
          accessList.map(access => tv.removeAccess(access))
        );
      }
    }

    logAccess(lowerUser, pineIds, action);
    res.json(accessList);
  } catch (err) {
    console.error('Access error:', err.message);
    res.status(500).json({ errorMessage: 'Service temporarily unavailable' });
  }
});

// GET /list-access/:pineId — list all users with access to a script
router.get('/list-access/:pineId', async (req, res) => {
  const { pineId } = req.params;

  try {
    const users = await tv.listAllUsers(pineId);
    const lifetime = users.filter(u => u.isLifetime);
    const expiring = users.filter(u => !u.isLifetime);

    res.json({
      pine_id: pineId,
      name: PINE_NAMES[pineId] || null,
      total: users.length,
      lifetime_count: lifetime.length,
      expiring_count: expiring.length,
      lifetime_users: lifetime.map(u => u.username),
      expiring_users: expiring.map(u => ({ username: u.username, expiration: u.expiration })),
    });
  } catch (err) {
    console.error('List access error:', err.message);
    res.status(500).json({ errorMessage: 'Service temporarily unavailable' });
  }
});

router.get('/', (req, res) => res.send('TradingView Access Manager API is running'));

export default router;
