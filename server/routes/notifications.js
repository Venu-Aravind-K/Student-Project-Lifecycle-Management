const express = require('express');
const { run, get, all } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
    const [items, unread] = await Promise.all([
        all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30`, [req.user.id]),
        get(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0`, [req.user.id]),
    ]);
    res.json({ items, unread: unread.n });
});

router.post('/read', async (req, res) => {
    await run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user.id]);
    res.json({ message: 'All caught up' });
});

module.exports = router;
