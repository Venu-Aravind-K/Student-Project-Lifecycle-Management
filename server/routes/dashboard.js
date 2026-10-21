const express = require('express');
const { get, all } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const wf = require('../lib/workflow');
const { buildDetail, withProgress } = require('./projects');
const router = express.Router();

router.use(authenticate);

// Small counts for sidebar badges ("things waiting for you")
router.get('/counts', async (req, res) => {
    const { id, role } = req.user;
    if (role === 'STUDENT') return res.json({});
    const latestPending = `pr.status = 'SUBMITTED' AND pr.version = (SELECT MAX(version) FROM proposals WHERE project_id = pr.project_id)`;
    if (role === 'FACULTY') {
        const [proposals, reviews, evaluations] = await Promise.all([
            get(`SELECT COUNT(*) AS n FROM proposals pr JOIN projects p ON p.id = pr.project_id
                 WHERE ${latestPending} AND (p.guide_id = ? OR (p.guide_id IS NULL AND p.preferred_guide_id = ?))`, [id, id]),
            get(`SELECT COUNT(*) AS n FROM milestones m JOIN projects p ON p.id = m.project_id
                 WHERE m.status = 'SUBMITTED' AND p.status = 'IN_PROGRESS' AND p.guide_id = ?`, [id]),
            get(`SELECT COUNT(*) AS n FROM projects WHERE status = 'FINAL_SUBMISSION' AND guide_id = ?`, [id]),
        ]);
        return res.json({ proposals: proposals.n, reviews: reviews.n, evaluations: evaluations.n });
    }
    const [proposals, allocation, evaluations] = await Promise.all([
        get(`SELECT COUNT(*) AS n FROM proposals pr WHERE ${latestPending}`),
        get(`SELECT COUNT(*) AS n FROM projects WHERE status = 'APPROVED'`),
        get(`SELECT COUNT(*) AS n FROM projects WHERE status = 'FINAL_SUBMISSION'`),
    ]);
    res.json({ proposals: proposals.n, allocation: allocation.n, evaluations: evaluations.n });
});

router.get('/student', requireRole('STUDENT'), async (req, res) => {
    const project = await get(`${wf.PROJECT_SELECT} WHERE p.student_id = ? ORDER BY p.id DESC LIMIT 1`, [req.user.id]);
    res.json({ detail: project ? await buildDetail(req.user, project) : null });
});

router.get('/faculty', requireRole('FACULTY'), async (req, res) => {
    const id = req.user.id;
    const projects = await withProgress(await all(`${wf.PROJECT_SELECT} WHERE p.guide_id = ? ORDER BY p.updated_at DESC`, [id]));

    const [proposals, queue, upcoming] = await Promise.all([
        all(`SELECT pr.id, pr.title, pr.version, pr.submitted_at, p.id AS project_id, s.name AS student_name
             FROM proposals pr JOIN projects p ON p.id = pr.project_id JOIN users s ON s.id = p.student_id
             WHERE pr.status = 'SUBMITTED' AND pr.version = (SELECT MAX(version) FROM proposals WHERE project_id = p.id)
               AND (p.guide_id = ? OR (p.guide_id IS NULL AND p.preferred_guide_id = ?))
             ORDER BY pr.submitted_at`, [id, id]),
        all(`SELECT m.id, m.title, m.deadline, p.id AS project_id, p.title AS project_title, s.name AS student_name,
                    (SELECT MAX(submitted_at) FROM submissions WHERE milestone_id = m.id) AS last_submitted_at
             FROM milestones m JOIN projects p ON p.id = m.project_id JOIN users s ON s.id = p.student_id
             WHERE m.status = 'SUBMITTED' AND p.status = 'IN_PROGRESS' AND p.guide_id = ? ORDER BY last_submitted_at`, [id]),
        all(`SELECT m.id, m.title, m.deadline, m.status, p.id AS project_id, p.title AS project_title, s.name AS student_name
             FROM milestones m JOIN projects p ON p.id = m.project_id JOIN users s ON s.id = p.student_id
             WHERE p.guide_id = ? AND p.status = 'IN_PROGRESS' AND m.status IN ('PENDING', 'REVISION_REQUESTED')
             ORDER BY m.deadline LIMIT 8`, [id]),
    ]);

    const active = projects.filter(p => p.status === 'IN_PROGRESS');
    res.json({
        stats: {
            guiding: active.length + projects.filter(p => p.status === 'FINAL_SUBMISSION').length,
            pendingProposals: proposals.length,
            reviewQueue: queue.length,
            awaitingEvaluation: projects.filter(p => p.status === 'FINAL_SUBMISSION').length,
            delayed: active.filter(p => p.health === 'DELAYED').length,
            completed: projects.filter(p => p.status === 'COMPLETED').length,
        },
        projects,
        proposals,
        queue,
        upcoming: upcoming.map(m => ({ ...m, overdue: wf.isOverdue(m) })),
    });
});

router.get('/admin', requireRole('ADMIN'), async (req, res) => {
    const projects = await withProgress(await all(`${wf.PROJECT_SELECT} ORDER BY p.updated_at DESC`));
    const [faculty, pendingProposals, activity, studentsWithoutProject, evalStats] = await Promise.all([
        all(`SELECT u.id, u.name, u.max_projects,
                    (SELECT COUNT(*) FROM projects p WHERE p.guide_id = u.id AND p.status IN ('IN_PROGRESS', 'FINAL_SUBMISSION')) AS active_projects
             FROM users u WHERE u.role = 'FACULTY' ORDER BY active_projects DESC, u.name`),
        get(`SELECT COUNT(*) AS n FROM proposals pr WHERE pr.status = 'SUBMITTED'
             AND pr.version = (SELECT MAX(version) FROM proposals WHERE project_id = pr.project_id)`),
        all(`SELECT a.message, a.created_at, u.name AS actor_name, p.id AS project_id, p.title AS project_title
             FROM activity_log a JOIN projects p ON p.id = a.project_id LEFT JOIN users u ON u.id = a.actor_id
             ORDER BY a.created_at DESC, a.id DESC LIMIT 12`),
        get(`SELECT COUNT(*) AS n FROM users u WHERE u.role = 'STUDENT' AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.student_id = u.id)`),
        get(`SELECT COUNT(*) AS n, ROUND(AVG(total_score), 1) AS avg FROM evaluations`),
    ]);

    const byStatus = Object.keys(wf.STATUS_LABELS).map(status => ({
        status, label: wf.STATUS_LABELS[status], count: projects.filter(p => p.status === status).length,
    }));
    const active = projects.filter(p => p.status === 'IN_PROGRESS');
    res.json({
        stats: {
            total: projects.length,
            inProgress: active.length,
            pendingProposals: pendingProposals.n,
            awaitingGuide: projects.filter(p => p.status === 'APPROVED').length,
            awaitingEvaluation: projects.filter(p => p.status === 'FINAL_SUBMISSION').length,
            completed: projects.filter(p => p.status === 'COMPLETED').length,
            delayed: active.filter(p => p.health === 'DELAYED').length,
            atRisk: active.filter(p => p.health === 'AT_RISK').length,
            onTrack: active.filter(p => p.health === 'ON_TRACK').length,
            studentsWithoutProject: studentsWithoutProject.n,
            averageScore: evalStats.avg,
        },
        byStatus,
        faculty,
        attention: projects.filter(p => p.health === 'DELAYED' || p.health === 'AT_RISK' || p.status === 'APPROVED'),
        activity,
    });
});

module.exports = router;
