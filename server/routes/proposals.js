const express = require('express');
const { run, get, all } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const wf = require('../lib/workflow');
const { HttpError } = wf;
const router = express.Router();

router.use(authenticate, requireRole('FACULTY', 'ADMIN'));

// Proposals awaiting a decision from the current reviewer (latest version only)
router.get('/', async (req, res) => {
    const params = [];
    let scope = '';
    if (req.user.role === 'FACULTY') {
        scope = 'AND (p.guide_id = ? OR (p.guide_id IS NULL AND p.preferred_guide_id = ?))';
        params.push(req.user.id, req.user.id);
    }
    const status = ['SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'].includes(req.query.status) ? req.query.status : 'SUBMITTED';
    const proposals = await all(`
        SELECT pr.*, p.status AS project_status, p.student_id, p.guide_id, p.preferred_guide_id,
               s.name AS student_name, s.roll_number AS student_roll, pg.name AS preferred_guide_name, g.name AS guide_name,
               r.name AS reviewer_name
        FROM proposals pr
        JOIN projects p ON p.id = pr.project_id
        JOIN users s ON s.id = p.student_id
        LEFT JOIN users pg ON pg.id = p.preferred_guide_id
        LEFT JOIN users g ON g.id = p.guide_id
        LEFT JOIN users r ON r.id = pr.reviewed_by
        WHERE pr.status = ? AND pr.version = (SELECT MAX(version) FROM proposals WHERE project_id = pr.project_id) ${scope}
        ORDER BY pr.submitted_at ASC`, [status, ...params]);
    res.json(proposals);
});

router.post('/:id/review', async (req, res) => {
    const proposal = await get(`SELECT * FROM proposals WHERE id = ?`, [req.params.id]);
    if (!proposal) throw new HttpError(404, 'Proposal not found');
    const project = await wf.getProject(proposal.project_id);
    if (!wf.canReviewProposal(req.user, project)) throw new HttpError(403, 'You are not a reviewer for this proposal');

    const latest = await get(`SELECT MAX(version) AS v FROM proposals WHERE project_id = ?`, [project.id]);
    if (proposal.status !== 'SUBMITTED' || proposal.version !== latest.v) throw new HttpError(400, 'This proposal has already been reviewed');

    const decision = req.body.decision;
    if (!['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].includes(decision)) throw new HttpError(400, 'Choose a decision');
    const feedback = decision === 'APPROVED'
        ? wf.optionalText(req.body, 'feedback', 3000)
        : wf.requireText(req.body, 'feedback', 'Feedback explaining the decision', 3000);

    await run(`UPDATE proposals SET status = ?, feedback = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [decision, feedback, req.user.id, proposal.id]);

    const link = `/project-details.html?id=${project.id}`;
    let message;
    if (decision === 'APPROVED') {
        // A faculty member approving a proposal that names them becomes its guide
        const guideId = project.guide_id || (req.user.role === 'FACULTY' ? req.user.id : null);
        if (guideId) {
            await wf.touchProject(project.id, { status: 'IN_PROGRESS', guide_id: guideId, allocated_at: project.allocated_at || wf.nowStamp() });
            message = 'Proposal approved – project is now in progress';
            if (!project.guide_id) await wf.logActivity(project.id, req.user.id, `${req.user.name} took the project as guide`);
        } else {
            await wf.touchProject(project.id, { status: 'APPROVED' });
            message = 'Proposal approved – allocate a guide to start the project';
        }
        await wf.notify(project.student_id, `Your proposal "${proposal.title}" was approved`, link);
    } else if (decision === 'CHANGES_REQUESTED') {
        await wf.touchProject(project.id, { status: 'CHANGES_REQUESTED' });
        message = 'Changes requested from the student';
        await wf.notify(project.student_id, `Changes requested on your proposal "${proposal.title}"`, '/proposal.html');
    } else {
        await wf.touchProject(project.id, { status: 'REJECTED', guide_id: null });
        message = 'Proposal rejected';
        await wf.notify(project.student_id, `Your proposal "${proposal.title}" was not approved – you can submit a new one`, '/proposal.html');
    }
    const verb = { APPROVED: 'Approved', CHANGES_REQUESTED: 'Requested changes on', REJECTED: 'Rejected' }[decision];
    await wf.logActivity(project.id, req.user.id, `${verb} proposal v${proposal.version}`);
    res.json({ message, projectStatus: (await wf.getProject(project.id)).status });
});

module.exports = router;
