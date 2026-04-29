import express from 'express';
import { TradingView } from './services/tradingview.js';
import { logAccess } from './logger.js';
import { parseDuration } from './helper.js';

const router = express.Router();
const tv = new TradingView();

router.get('/validate/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const result = await tv.validateUsername(username);
    logAccess(username.toLowerCase(), [], 'validate');
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errorMessage: 'Unknown Exception Occurred' });
  }
});

router.route('/access/:username').all(async (req, res) => {
  const { username } = req.params;
  const { pine_ids, duration } = req.body;
  const lowerUser = username.toLowerCase();

  try {
    if ((req.method === 'POST' || req.method === 'DELETE') && (!Array.isArray(pine_ids) || pine_ids.length === 0)) {
      return res.status(400).json({ error: "pine_ids array required" });
    }

    const accessList = [];
    const pineIds = pine_ids || [];

    for (const pine_id of pineIds) {
      const details = await tv.getAccessDetails(username, pine_id);
      accessList.push(details);
    }

    let action = 'check';

    if (req.method === 'POST') {
      action = 'grant';
      const durationValue = parseDuration(duration);

      if (!durationValue) {
        return res.status(400).json({ error: "Invalid duration format" });
      }

      for (const access of accessList) {
        await tv.addAccess(access, durationValue.type, durationValue.value);
      }
    }

    if (req.method === 'DELETE') {
      action = 'revoke';
      for (const access of accessList) {
        await tv.removeAccess(access);
      }
    }

    logAccess(lowerUser, pineIds, action);
    res.json(accessList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errorMessage: 'Unknown Exception Occurred' });
  }
});

router.get('/', (req, res) => res.send('Your bot is alive!'));

export default router;
