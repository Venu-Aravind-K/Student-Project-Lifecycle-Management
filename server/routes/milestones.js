const express = require('express');
const { run, get, all } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const wf = require('../lib/workflow');
const { HttpError } = wf;
const router = express.Router();

router.use(authenticate);

async function loadMilestone(user, id) {
    const milestone = await get(`SELECT * FROM milestones WHERE id = ?`, [id]);
    if (!milestone) throw new HttpError(404, 'Milestone not found');
    const project = await wf.loadProjectFor(user, milestone.project_id);
    return { milestone, project };
}

// Milestone submissions waiting for the current reviewer
router.get('/review-queue', requireRole('FACULTY', 'ADMIN'), async (req, res) => {
    const scope = req.user.role === 'FACULTY' ? 'AND p.guide_id = ?' : '';
    const rows = await all(`
        SELECT m.*, p.title AS project_title, s.name AS student_name, g.name AS guide_name,
               (SELECT MAX(submitted_at) FROM submissions WHERE milestone_id = m.id) AS last_submitted_at,
               (SELECT COUNT(*) FROM submissions WHERE milestone_id = m.id) AS submission_count
        FROM milestones m
        JOIN projects p ON p.id = m.project_id
        JOIN users s ON s.id = p.student_id
        LEFT JOIN users g ON g.id = p.guide_id
        WHERE m.status = 'SUBMITTED' AND p.status = 'IN_PROGRESS' ${scope}
        ORDER BY last_submitted_at ASC`, req.user.role === 'FACULTY' ? [req.user.id] : []);
    res.json(rows);
});

router.put('/:id', async (req, res) => {
    const { milestone, project } = await loadMilestone(req.user, req.params.id);
    if (!wf.canSupervise(req.user, project)) throw new HttpError(403, 'Only the project guide can edit milestones');
    if (milestone.status === 'APPROVED') throw new HttpError(400, 'Approved milestones cannot be edited');
    const title = wf.requireText(req.body, 'title', 'Title', 150);
    const description = wf.optionalText(req.body, 'description', 2000);
    const deadline = wf.requireDate(req.body, 'deadline', 'Deadline');
    await run(`UPDATE milestones SET title = ?, description = ?, deadline = ? WHERE id = ?`, [title, description, deadline, milestone.id]);
    if (deadline !== milestone.deadline) {
        await wf.logActivity(project.id, req.user.id, `Moved "${title}" deadline from ${milestone.deadline} to ${deadline}`);
        await wf.notify(project.student_id, `Deadline for "${title}" changed to ${deadline}`, `/project-details.html?id=${project.id}#milestones`);
    }
    res.json({ message: 'Milestone updated' });
});

router.delete('/:id', async (req, res) => {
    const { milestone, project } = await loadMilestone(req.user, req.params.id);
    if (!wf.canSupervise(req.user, project)) throw new HttpError(403, 'Only the project guide can remove milestones');
    const subs = await get(`SELECT COUNT(*) AS n FROM submissions WHERE milestone_id = ?`, [milestone.id]);
    if (subs.n) throw new HttpError(400, 'This milestone already has submissions and cannot be removed');
    await run(`DELETE FROM milestones WHERE id = ?`, [milestone.id]);
    await wf.logActivity(project.id, req.user.id, `Removed milestone "${milestone.title}"`);
    res.json({ message: 'Milestone removed' });
});

// Guide scores a submitted milestone and approves it or asks for a revision
router.post('/:id/review', async (req, res) => {
    const { milestone, project } = await loadMilestone(req.user, req.params.id);
    if (!wf.canSupervise(req.user, project)) throw new HttpError(403, 'Only the project guide can review milestones');
    if (milestone.status !== 'SUBMITTED') throw new HttpError(400, 'This milestone has no submission awaiting review');

    const decision = req.body.decision;
    if (!['APPROVED', 'REVISION_REQUESTED'].includes(decision)) throw new HttpError(400, 'Choose approve or request revision');
    const scores = wf.REVIEW_CRITERIA.map(c => wf.requireScore(req.body, c, wf.REVIEW_MAX));
    const total = scores.reduce((a, b) => a + b, 0);
    const feedback = decision === 'REVISION_REQUESTED'
        ? wf.requireText(req.body, 'feedback', 'Feedback on what to revise', 3000)
        : wf.optionalText(req.body, 'feedback', 3000);

    await run(`INSERT INTO reviews (milestone_id, project_id, reviewer_id, technical_score, progress_score, documentation_score,
               presentation_score, total_score, decision, feedback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [milestone.id, project.id, req.user.id, ...scores, total, decision, feedback]);
    await run(`UPDATE milestones SET status = ? WHERE id = ?`, [decision, milestone.id]);
    await wf.touchProject(project.id);

    const max = wf.REVIEW_CRITERIA.length * wf.REVIEW_MAX;
    const verb = decision === 'APPROVED' ? 'Approved' : 'Requested revision on';
    await wf.logActivity(project.id, req.user.id, `${verb} "${milestone.title}" (${total}/${max})`);
    await wf.notify(project.student_id,
        decision === 'APPROVED' ? `"${milestone.title}" approved – ${total}/${max}` : `Revision requested on "${milestone.title}"`,
        `/project-details.html?id=${project.id}#milestones`);
    res.json({ message: decision === 'APPROVED' ? 'Milestone approved' : 'Revision requested', total });
});

module.exports = router;
