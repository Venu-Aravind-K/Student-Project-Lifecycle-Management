const { run, get, all } = require('../database');

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const STATUS_LABELS = {
    PROPOSAL_SUBMITTED: 'Proposal submitted',
    CHANGES_REQUESTED: 'Changes requested',
    REJECTED: 'Rejected',
    APPROVED: 'Approved – awaiting guide',
    IN_PROGRESS: 'In progress',
    FINAL_SUBMISSION: 'Final submission',
    COMPLETED: 'Completed',
};

// Milestone review rubric (each criterion scored out of 10)
const REVIEW_CRITERIA = ['technical', 'progress', 'documentation', 'presentation'];
const REVIEW_MAX = 10;

// Final evaluation rubric (total 100)
const EVALUATION_CRITERIA = {
    technical: 20,
    implementation: 20,
    innovation: 15,
    documentation: 15,
    presentation: 15,
    viva: 15,
};

function gradeFor(total) {
    if (total >= 90) return 'O';
    if (total >= 80) return 'A+';
    if (total >= 70) return 'A';
    if (total >= 60) return 'B+';
    if (total >= 50) return 'B';
    if (total >= 40) return 'C';
    return 'F';
}

// Local date as YYYY-MM-DD (deadlines are stored as plain dates)
function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// UTC timestamp in the same format as SQLite's CURRENT_TIMESTAMP
function nowStamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function isOverdue(milestone, now = today()) {
    return ['PENDING', 'REVISION_REQUESTED'].includes(milestone.status) && milestone.deadline < now;
}

/**
 * Health of an in-progress project, derived from its milestones:
 * DELAYED if any open milestone is past its deadline, AT_RISK if one is due within 7 days.
 */
function projectHealth(project, milestones) {
    if (project.status !== 'IN_PROGRESS') return null;
    const now = today();
    const soon = addDays(now, 7);
    const open = milestones.filter(m => ['PENDING', 'REVISION_REQUESTED'].includes(m.status));
    if (open.some(m => m.deadline < now)) return 'DELAYED';
    if (open.some(m => m.deadline <= soon)) return 'AT_RISK';
    return 'ON_TRACK';
}

function progressOf(milestones) {
    if (!milestones.length) return 0;
    const done = milestones.filter(m => m.status === 'APPROVED').length;
    return Math.round((done / milestones.length) * 100);
}

const PROJECT_SELECT = `
    SELECT p.*,
           s.name AS student_name, s.email AS student_email, s.roll_number AS student_roll, s.department AS student_department,
           g.name AS guide_name, g.email AS guide_email,
           pg.name AS preferred_guide_name,
           e.total_score AS final_score, e.grade AS final_grade
    FROM projects p
    JOIN users s ON s.id = p.student_id
    LEFT JOIN users g ON g.id = p.guide_id
    LEFT JOIN users pg ON pg.id = p.preferred_guide_id
    LEFT JOIN evaluations e ON e.project_id = p.id`;

async function getProject(id) {
    const project = await get(`${PROJECT_SELECT} WHERE p.id = ?`, [id]);
    if (!project) throw new HttpError(404, 'Project not found');
    return project;
}

/** Who may see a project: its student, its faculty reviewer, or admin. */
function canView(user, project) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'STUDENT') return project.student_id === user.id;
    return isFacultyReviewer(user, project);
}

// The allocated guide, or — until one is allocated — the student's preferred guide
function isFacultyReviewer(user, project) {
    if (user.role !== 'FACULTY') return false;
    return project.guide_id ? project.guide_id === user.id : project.preferred_guide_id === user.id;
}

/** Who may act as supervisor (milestones, reviews, evaluation): the allocated guide or admin. */
function canSupervise(user, project) {
    return user.role === 'ADMIN' || (user.role === 'FACULTY' && project.guide_id === user.id);
}

/** Who may decide on a proposal: admin or the faculty reviewer. */
function canReviewProposal(user, project) {
    return user.role === 'ADMIN' || isFacultyReviewer(user, project);
}

async function loadProjectFor(user, id) {
    const project = await getProject(id);
    if (!canView(user, project)) throw new HttpError(403, 'You do not have access to this project');
    return project;
}

async function notify(userId, message, link = null) {
    if (!userId) return;
    await run(`INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)`, [userId, message, link]);
}

async function notifyAdmins(message, link = null) {
    const admins = await all(`SELECT id FROM users WHERE role = 'ADMIN'`);
    for (const a of admins) await notify(a.id, message, link);
}

async function logActivity(projectId, actorId, message) {
    await run(`INSERT INTO activity_log (project_id, actor_id, message) VALUES (?, ?, ?)`, [projectId, actorId, message]);
}

async function touchProject(projectId, fields = {}) {
    const keys = Object.keys(fields);
    const sets = keys.map(k => `${k} = ?`).concat('updated_at = CURRENT_TIMESTAMP');
    await run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, [...keys.map(k => fields[k]), projectId]);
}

// Input helpers
function requireText(body, field, label, max = 5000) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (!value) throw new HttpError(400, `${label} is required`);
    if (value.length > max) throw new HttpError(400, `${label} must be at most ${max} characters`);
    return value;
}

function optionalText(body, field, max = 5000) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (value.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
    return value || null;
}

function requireScore(body, field, max) {
    const value = Number(body[field]);
    if (!Number.isInteger(value) || value < 0 || value > max) {
        throw new HttpError(400, `${field} score must be a whole number between 0 and ${max}`);
    }
    return value;
}

function requireDate(body, field, label) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
        throw new HttpError(400, `${label} must be a valid date (YYYY-MM-DD)`);
    }
    return value;
}

module.exports = {
    HttpError, STATUS_LABELS, REVIEW_CRITERIA, REVIEW_MAX, EVALUATION_CRITERIA,
    gradeFor, today, addDays, nowStamp, isOverdue, projectHealth, progressOf,
    PROJECT_SELECT, getProject, loadProjectFor, canView, canSupervise, canReviewProposal,
    notify, notifyAdmins, logActivity, touchProject,
    requireText, optionalText, requireScore, requireDate,
};
