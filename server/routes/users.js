const express = require('express');
const bcrypt = require('bcrypt');
const { run, get, all } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { HttpError, requireText, optionalText } = require('../lib/workflow');
const router = express.Router();

router.use(authenticate);

// Faculty list with current guide workload (used by proposal form + allocation screen)
router.get('/faculty', async (req, res) => {
    const faculty = await all(`
        SELECT u.id, u.name, u.email, u.department, u.expertise, u.max_projects,
               (SELECT COUNT(*) FROM projects p WHERE p.guide_id = u.id AND p.status IN ('IN_PROGRESS', 'FINAL_SUBMISSION')) AS active_projects,
               (SELECT COUNT(*) FROM projects p WHERE p.guide_id = u.id AND p.status = 'COMPLETED') AS completed_projects
        FROM users u WHERE u.role = 'FACULTY' ORDER BY u.name`);
    res.json(faculty);
});

router.get('/', requireRole('ADMIN'), async (req, res) => {
    const users = await all(`
        SELECT u.id, u.name, u.email, u.role, u.department, u.roll_number, u.expertise, u.max_projects, u.created_at,
               (SELECT title FROM projects p WHERE p.student_id = u.id ORDER BY p.id DESC LIMIT 1) AS project_title,
               (SELECT COUNT(*) FROM projects p WHERE p.guide_id = u.id AND p.status IN ('IN_PROGRESS', 'FINAL_SUBMISSION')) AS guiding
        FROM users u ORDER BY CASE u.role WHEN 'ADMIN' THEN 0 WHEN 'FACULTY' THEN 1 ELSE 2 END, u.name`);
    res.json(users);
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
    const name = requireText(req.body, 'name', 'Name', 100);
    const email = requireText(req.body, 'email', 'Email', 200).toLowerCase();
    const password = requireText(req.body, 'password', 'Password', 200);
    const role = req.body.role;
    if (!['STUDENT', 'FACULTY', 'ADMIN'].includes(role)) throw new HttpError(400, 'Choose a valid role');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (await get(`SELECT id FROM users WHERE email = ?`, [email])) throw new HttpError(409, 'An account with this email already exists');

    const maxProjects = role === 'FACULTY' ? Math.max(1, Math.min(20, Number(req.body.max_projects) || 5)) : null;
    const hash = await bcrypt.hash(password, 10);
    const { lastID } = await run(
        `INSERT INTO users (name, email, password, role, department, roll_number, expertise, max_projects) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, hash, role, optionalText(req.body, 'department', 100), optionalText(req.body, 'roll_number', 50),
            optionalText(req.body, 'expertise', 300), maxProjects]
    );
    res.status(201).json({ id: lastID, message: `${name} added` });
});

// Update guide capacity
router.put('/:id/capacity', requireRole('ADMIN'), async (req, res) => {
    const max = Number(req.body.max_projects);
    if (!Number.isInteger(max) || max < 1 || max > 20) throw new HttpError(400, 'Capacity must be between 1 and 20');
    const { changes } = await run(`UPDATE users SET max_projects = ? WHERE id = ? AND role = 'FACULTY'`, [max, req.params.id]);
    if (!changes) throw new HttpError(404, 'Faculty member not found');
    res.json({ message: 'Capacity updated' });
});

module.exports = router;
