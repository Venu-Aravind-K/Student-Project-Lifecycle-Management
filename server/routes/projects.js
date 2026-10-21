const express = require('express');
const { run, get, all } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const wf = require('../lib/workflow');
const { HttpError } = wf;
const router = express.Router();

router.use(authenticate);

const STANDARD_MILESTONES = [
    { title: 'Literature Survey', description: 'Review existing work and summarise gaps your project addresses.', days: 14 },
    { title: 'Requirements & System Design', description: 'Requirement specification, architecture diagram and data model.', days: 35 },
    { title: 'Implementation – Phase 1', description: 'Core modules working end to end; demo to guide.', days: 63 },
    { title: 'Testing & Integration', description: 'Test plan, test results and integrated build.', days: 84 },
    { title: 'Final Report & Presentation', description: 'Complete project report, slides and demo video.', days: 105 },
];

/** Full project view used by the project workspace and the student dashboard. */
async function buildDetail(user, project) {
    const [proposals, milestones, submissions, reviews, evaluation, activity] = await Promise.all([
        all(`SELECT pr.*, u.name AS reviewer_name FROM proposals pr LEFT JOIN users u ON u.id = pr.reviewed_by
             WHERE pr.project_id = ? ORDER BY pr.version DESC`, [project.id]),
        all(`SELECT * FROM milestones WHERE project_id = ? ORDER BY deadline, id`, [project.id]),
        all(`SELECT s.id, s.milestone_id, s.doc_type, s.file_name, s.file_size, s.comments, s.submitted_at,
                    u.name AS uploaded_by_name, u.role AS uploaded_by_role
             FROM submissions s JOIN users u ON u.id = s.uploaded_by
             WHERE s.project_id = ? ORDER BY s.submitted_at DESC, s.id DESC`, [project.id]),
        all(`SELECT r.*, u.name AS reviewer_name FROM reviews r JOIN users u ON u.id = r.reviewer_id
             WHERE r.project_id = ? ORDER BY r.reviewed_at DESC, r.id DESC`, [project.id]),
        get(`SELECT e.*, u.name AS evaluator_name FROM evaluations e JOIN users u ON u.id = e.evaluator_id WHERE e.project_id = ?`, [project.id]),
        all(`SELECT a.message, a.created_at, u.name AS actor_name FROM activity_log a LEFT JOIN users u ON u.id = a.actor_id
             WHERE a.project_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 50`, [project.id]),
    ]);

    const now = wf.today();
    const withUrl = s => ({ ...s, download_url: `/api/submissions/${s.id}/download` });
    const enrichedMilestones = milestones.map(m => ({
        ...m,
        overdue: wf.isOverdue(m, now),
        submissions: submissions.filter(s => s.milestone_id === m.id).map(withUrl),
        reviews: reviews.filter(r => r.milestone_id === m.id),
    }));
    const documents = submissions.filter(s => !s.milestone_id).map(withUrl);

    const isOwner = user.role === 'STUDENT' && project.student_id === user.id;
    const supervises = wf.canSupervise(user, project);
    const latestProposal = proposals[0];

    const blockers = [];
    if (!milestones.length) blockers.push('Your guide has not set any milestones yet');
    const unapproved = milestones.filter(m => m.status !== 'APPROVED').length;
    if (unapproved) blockers.push(`${unapproved} milestone${unapproved > 1 ? 's' : ''} not yet approved`);
    if (!documents.some(d => d.doc_type === 'FINAL_REPORT')) blockers.push('Upload your final project report under Documents');

    return {
        project: { ...project, status_label: wf.STATUS_LABELS[project.status] },
        health: wf.projectHealth(project, milestones),
        progress: wf.progressOf(milestones),
        proposals,
        milestones: enrichedMilestones,
        documents,
        evaluation: evaluation || null,
        activity,
        rubric: { review: { criteria: wf.REVIEW_CRITERIA, max: wf.REVIEW_MAX }, evaluation: wf.EVALUATION_CRITERIA },
        permissions: {
            isOwner,
            canEditProposal: isOwner && ['PROPOSAL_SUBMITTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(project.status),
            canReviewProposal: !!latestProposal && latestProposal.status === 'SUBMITTED' && wf.canReviewProposal(user, project),
            canAllocate: user.role === 'ADMIN' && !['COMPLETED', 'REJECTED'].includes(project.status),
            canManageMilestones: supervises && project.status === 'IN_PROGRESS',
            canSubmitWork: isOwner && project.status === 'IN_PROGRESS',
            canUploadDocs: (isOwner || supervises) && ['IN_PROGRESS', 'FINAL_SUBMISSION'].includes(project.status),
            canReviewMilestones: supervises && project.status === 'IN_PROGRESS',
            canFinalSubmit: isOwner && project.status === 'IN_PROGRESS' && blockers.length === 0,
            finalSubmitBlockers: isOwner && project.status === 'IN_PROGRESS' ? blockers : [],
            canEvaluate: supervises && project.status === 'FINAL_SUBMISSION',
        },
    };
}

/** Adds progress, health and milestone counts to a list of projects with one extra query. */
async function withProgress(projects) {
    if (!projects.length) return projects;
    const ids = projects.map(p => p.id);
    const milestones = await all(`SELECT project_id, status, deadline FROM milestones WHERE project_id IN (${ids.map(() => '?').join(',')})`, ids);
    const now = wf.today();
    return projects.map(p => {
        const ms = milestones.filter(m => m.project_id === p.id);
        const next = ms.filter(m => m.status !== 'APPROVED').sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
        return {
            ...p,
            status_label: wf.STATUS_LABELS[p.status],
            progress: wf.progressOf(ms),
            health: wf.projectHealth(p, ms),
            milestones_total: ms.length,
            milestones_approved: ms.filter(m => m.status === 'APPROVED').length,
            milestones_overdue: ms.filter(m => wf.isOverdue(m, now)).length,
            awaiting_review: ms.filter(m => m.status === 'SUBMITTED').length,
            next_deadline: next?.deadline || null,
        };
    });
}

// List projects visible to the current user
router.get('/', async (req, res) => {
    const where = [];
    const params = [];
    if (req.user.role === 'STUDENT') { where.push('p.student_id = ?'); params.push(req.user.id); }
    if (req.user.role === 'FACULTY') { where.push('p.guide_id = ?'); params.push(req.user.id); }
    if (req.query.status) { where.push('p.status = ?'); params.push(String(req.query.status)); }
    const rows = await all(`${wf.PROJECT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.updated_at DESC, p.id DESC`, params);
    res.json(await withProgress(rows));
});

router.get('/:id', async (req, res) => {
    const project = await wf.loadProjectFor(req.user, req.params.id);
    res.json(await buildDetail(req.user, project));
});

// Student submits a new proposal, edits a pending one, or resubmits after feedback
router.post('/proposal', requireRole('STUDENT'), async (req, res) => {
    const b = req.body;
    const data = {
        title: wf.requireText(b, 'title', 'Project title', 200),
        domain: wf.optionalText(b, 'domain', 100),
        problem_statement: wf.requireText(b, 'problem_statement', 'Problem statement'),
        objectives: wf.requireText(b, 'objectives', 'Objectives'),
        methodology: wf.requireText(b, 'methodology', 'Methodology'),
        technologies: wf.requireText(b, 'technologies', 'Technologies', 500),
        expected_outcome: wf.optionalText(b, 'expected_outcome'),
    };
    let preferredGuide = null;
    if (b.preferred_guide_id) {
        const guide = await get(`SELECT id FROM users WHERE id = ? AND role = 'FACULTY'`, [b.preferred_guide_id]);
        if (!guide) throw new HttpError(400, 'Selected guide was not found');
        preferredGuide = guide.id;
    }

    const existing = await get(`SELECT * FROM projects WHERE student_id = ? ORDER BY id DESC LIMIT 1`, [req.user.id]);
    if (existing && !['PROPOSAL_SUBMITTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(existing.status)) {
        throw new HttpError(400, 'Your proposal has already been approved – the project is underway');
    }

    const projectFields = {
        title: data.title, domain: data.domain, description: data.problem_statement,
        technologies: data.technologies, preferred_guide_id: preferredGuide,
    };
    const proposalCols = Object.keys(data);
    let projectId, version, message;

    if (!existing) {
        const created = await run(
            `INSERT INTO projects (student_id, title, domain, description, technologies, preferred_guide_id, status) VALUES (?, ?, ?, ?, ?, ?, 'PROPOSAL_SUBMITTED')`,
            [req.user.id, data.title, data.domain, data.problem_statement, data.technologies, preferredGuide]
        );
        projectId = created.lastID;
        version = 1;
        message = 'Proposal submitted';
    } else {
        projectId = existing.id;
        const latest = await get(`SELECT * FROM proposals WHERE project_id = ? ORDER BY version DESC LIMIT 1`, [projectId]);
        if (existing.status === 'PROPOSAL_SUBMITTED' && latest?.status === 'SUBMITTED') {
            // Not reviewed yet – edit the pending version in place
            await run(`UPDATE proposals SET ${proposalCols.map(c => `${c} = ?`).join(', ')}, submitted_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [...proposalCols.map(c => data[c]), latest.id]);
            await wf.touchProject(projectId, projectFields);
            await wf.logActivity(projectId, req.user.id, `Edited proposal v${latest.version}`);
            return res.json({ projectId, message: 'Proposal updated' });
        }
        version = (latest?.version || 0) + 1;
        await wf.touchProject(projectId, {
            ...projectFields, status: 'PROPOSAL_SUBMITTED',
            guide_id: existing.status === 'REJECTED' ? null : existing.guide_id,
        });
        message = `Proposal v${version} resubmitted`;
    }

    await run(`INSERT INTO proposals (project_id, version, ${proposalCols.join(', ')}) VALUES (?, ?, ${proposalCols.map(() => '?').join(', ')})`,
        [projectId, version, ...proposalCols.map(c => data[c])]);
    await wf.logActivity(projectId, req.user.id, version === 1 ? 'Submitted proposal' : `Resubmitted proposal (v${version})`);

    const link = `/project-details.html?id=${projectId}`;
    const project = await wf.getProject(projectId);
    const reviewer = project.guide_id || project.preferred_guide_id;
    await wf.notify(reviewer, `${req.user.name} submitted a proposal for review: "${data.title}"`, link);
    await wf.notifyAdmins(`New proposal from ${req.user.name}: "${data.title}"`, link);
    res.status(201).json({ projectId, message });
});

// Admin allocates (or reassigns) a faculty guide
router.post('/:id/allocate', requireRole('ADMIN'), async (req, res) => {
    const project = await wf.getProject(req.params.id);
    if (['COMPLETED', 'REJECTED'].includes(project.status)) throw new HttpError(400, 'A guide cannot be allocated to this project');
    const guide = await get(`SELECT id, name FROM users WHERE id = ? AND role = 'FACULTY'`, [req.body.faculty_id]);
    if (!guide) throw new HttpError(400, 'Select a faculty member');
    if (guide.id === project.guide_id) throw new HttpError(400, `${guide.name} is already the guide`);

    const fields = { guide_id: guide.id, allocated_at: wf.nowStamp() };
    if (project.status === 'APPROVED') fields.status = 'IN_PROGRESS';
    await wf.touchProject(project.id, fields);

    const link = `/project-details.html?id=${project.id}`;
    const action = project.guide_id ? `Guide changed from ${project.guide_name} to ${guide.name}` : `${guide.name} allocated as guide`;
    await wf.logActivity(project.id, req.user.id, action);
    await wf.notify(guide.id, `You have been allocated as guide for "${project.title}" (${project.student_name})`, link);
    await wf.notify(project.student_id, `${guide.name} is now your project guide`, link);
    if (project.guide_id) await wf.notify(project.guide_id, `You are no longer the guide for "${project.title}"`, null);
    res.json({ message: action });
});

router.post('/:id/milestones', async (req, res) => {
    const project = await wf.loadProjectFor(req.user, req.params.id);
    if (!wf.canSupervise(req.user, project)) throw new HttpError(403, 'Only the project guide can set milestones');
    if (project.status !== 'IN_PROGRESS') throw new HttpError(400, 'Milestones can only be added while the project is in progress');
    const title = wf.requireText(req.body, 'title', 'Title', 150);
    const description = wf.optionalText(req.body, 'description', 2000);
    const deadline = wf.requireDate(req.body, 'deadline', 'Deadline');
    if (deadline < wf.today()) throw new HttpError(400, 'Deadline cannot be in the past');

    const { lastID } = await run(`INSERT INTO milestones (project_id, title, description, deadline, created_by) VALUES (?, ?, ?, ?, ?)`,
        [project.id, title, description, deadline, req.user.id]);
    await wf.touchProject(project.id);
    await wf.logActivity(project.id, req.user.id, `Added milestone "${title}" due ${deadline}`);
    await wf.notify(project.student_id, `New milestone "${title}" due ${deadline}`, `/project-details.html?id=${project.id}#milestones`);
    res.status(201).json({ id: lastID, message: 'Milestone added' });
});

// One-click standard milestone plan
router.post('/:id/milestones/template', async (req, res) => {
    const project = await wf.loadProjectFor(req.user, req.params.id);
    if (!wf.canSupervise(req.user, project)) throw new HttpError(403, 'Only the project guide can set milestones');
    if (project.status !== 'IN_PROGRESS') throw new HttpError(400, 'Milestones can only be added while the project is in progress');
    const count = await get(`SELECT COUNT(*) AS n FROM milestones WHERE project_id = ?`, [project.id]);
    if (count.n) throw new HttpError(400, 'The standard plan can only be applied to a project with no milestones');

    const start = wf.today();
    for (const m of STANDARD_MILESTONES) {
        await run(`INSERT INTO milestones (project_id, title, description, deadline, created_by) VALUES (?, ?, ?, ?, ?)`,
            [project.id, m.title, m.description, wf.addDays(start, m.days), req.user.id]);
    }
    await wf.touchProject(project.id);
    await wf.logActivity(project.id, req.user.id, 'Applied the standard 5-milestone plan');
    await wf.notify(project.student_id, 'Your guide published your milestone plan', `/project-details.html?id=${project.id}#milestones`);
    res.status(201).json({ message: 'Standard milestone plan applied' });
});

router.post('/:id/final-submit', requireRole('STUDENT'), async (req, res) => {
    const project = await wf.loadProjectFor(req.user, req.params.id);
    const detail = await buildDetail(req.user, project);
    if (!detail.permissions.canFinalSubmit) {
        const reasons = detail.permissions.finalSubmitBlockers;
        throw new HttpError(400, reasons.length ? `Not ready for final submission: ${reasons.join('; ')}` : 'Final submission is not available');
    }
    await wf.touchProject(project.id, { status: 'FINAL_SUBMISSION', final_submitted_at: wf.nowStamp() });
    await wf.logActivity(project.id, req.user.id, 'Made final submission for evaluation');
    await wf.notify(project.guide_id, `${project.student_name} made the final submission for "${project.title}" – ready for evaluation`,
        `/project-details.html?id=${project.id}#grade`);
    res.json({ message: 'Final submission complete – your guide has been notified' });
});

router.post('/:id/evaluation', async (req, res) => {
    const project = await wf.loadProjectFor(req.user, req.params.id);
    if (!wf.canSupervise(req.user, project)) throw new HttpError(403, 'Only the project guide or an admin can evaluate');
    if (project.status !== 'FINAL_SUBMISSION') throw new HttpError(400, 'The project has not been submitted for final evaluation');

    const scores = {};
    for (const [key, max] of Object.entries(wf.EVALUATION_CRITERIA)) scores[key] = wf.requireScore(req.body, key, max);
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const grade = wf.gradeFor(total);
    const comments = wf.optionalText(req.body, 'comments', 3000);

    await run(`INSERT INTO evaluations (project_id, evaluator_id, technical_score, implementation_score, innovation_score,
               documentation_score, presentation_score, viva_score, total_score, grade, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [project.id, req.user.id, scores.technical, scores.implementation, scores.innovation, scores.documentation,
            scores.presentation, scores.viva, total, grade, comments]);
    await wf.touchProject(project.id, { status: 'COMPLETED' });
    await wf.logActivity(project.id, req.user.id, `Final evaluation: ${total}/100 (grade ${grade}) – project completed`);
    await wf.notify(project.student_id, `Your project has been evaluated: ${total}/100, grade ${grade}`, `/project-details.html?id=${project.id}#grade`);
    res.json({ message: `Evaluation saved – ${total}/100, grade ${grade}`, total, grade });
});

module.exports = router;
module.exports.buildDetail = buildDetail;
module.exports.withProgress = withProgress;
