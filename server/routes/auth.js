const express = require('express');
const bcrypt = require('bcrypt');
const { run, get } = require('../database');
const { authenticate, signToken, COOKIE_OPTIONS } = require('../middleware/auth');
const { HttpError, requireText, optionalText } = require('../lib/workflow');
const router = express.Router();

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, department: u.department });

router.post('/login', async (req, res) => {
    const email = requireText(req.body, 'email', 'Email', 200).toLowerCase();
    const password = requireText(req.body, 'password', 'Password', 200);

    const user = await get(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new HttpError(401, 'Incorrect email or password');
    }
    res.cookie('token', signToken(user), COOKIE_OPTIONS);
    res.json({ user: publicUser(user) });
});

// Student self-registration (faculty and admins are created by an admin)
router.post('/register', async (req, res) => {
    const name = requireText(req.body, 'name', 'Name', 100);
    const email = requireText(req.body, 'email', 'Email', 200).toLowerCase();
    const password = requireText(req.body, 'password', 'Password', 200);
    const rollNumber = optionalText(req.body, 'roll_number', 50);
    const department = optionalText(req.body, 'department', 100);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (await get(`SELECT id FROM users WHERE email = ?`, [email])) {
        throw new HttpError(409, 'An account with this email already exists');
    }

    const hash = await bcrypt.hash(password, 10);
    const { lastID } = await run(
        `INSERT INTO users (name, email, password, role, roll_number, department) VALUES (?, ?, ?, 'STUDENT', ?, ?)`,
        [name, email, hash, rollNumber, department]
    );
    const user = await get(`SELECT * FROM users WHERE id = ?`, [lastID]);
    res.cookie('token', signToken(user), COOKIE_OPTIONS);
    res.status(201).json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
    res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: undefined });
    res.json({ message: 'Signed out' });
});

router.get('/me', authenticate, async (req, res) => {
    const user = await get(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
    if (!user) throw new HttpError(401, 'Account no longer exists');
    res.json({ user: publicUser(user) });
});

module.exports = router;
