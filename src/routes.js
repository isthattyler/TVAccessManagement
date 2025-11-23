import express from 'express';
import { TradingView } from './tv/tradingview.js';
import { logAccess } from './helper/logger.js';

const router = express.Router();
const tv = new TradingView();

// GET /validate/:username
router.get('/validate/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const result = await tv.validateUsername(username);
    
    // Log validation attempts
    logAccess(username.toLowerCase(), [], 'validate');
    
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errorMessage: 'Unknown Exception Occurred' });
  }
});

// Unified handler
async function handleAccess(req, res) {
  try {
    const { username } = req.params;
    const { pine_ids, duration } = req.body;
    const lowerUser = username.toLowerCase();

    if (!Array.isArray(pine_ids) || pine_ids.length === 0) {
      return res.status(400).json({ error: "pine_ids array required" });
    }

    const accessList = [];
    for (const pine_id of pine_ids) {
      const details = await tv.getAccessDetails(username, pine_id);
      accessList.push(details);
    }

    let action = 'check';
    if (req.method === 'POST') {
      action = 'grant';
      if (!duration || !/^\d+[YMDWL]$/i.test(duration)) {
        return res.status(400).json({ error: "Invalid duration format" });
      }
      const dNumber = parseInt(duration.slice(0, -1));
      const dType = duration.slice(-1).toUpperCase();

      for (const access of accessList) {
        await tv.addAccess(access, dType, dNumber);
      }
    }

    if (req.method === 'DELETE') {
      action = 'revoke';
      for (const access of accessList) {
        await tv.removeAccess(access);
      }
    }

    // LOG THE ACTION
    logAccess(lowerUser, pine_ids, action);

    res.json(accessList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errorMessage: 'Unknown Exception Occurred' });
  }
}

router.route('/access/:username')
  .get(handleAccess)
  .post(handleAccess)
  .delete(handleAccess);

router.get('/', (req, res) => res.send('Your bot is alive!'));

export default router;