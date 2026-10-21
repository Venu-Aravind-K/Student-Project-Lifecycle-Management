// End-to-end API test of the full project lifecycle against a throwaway database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'projectflow-test-'));
process.env.DB_PATH = path.join(tmp, 'test.sqlite');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.JWT_SECRET = 'test-secret';

const { start } = require('../server/server');
let server, base;

before(async () => {
    server = await start(0);
    base = `http://localhost:${server.address().port}/api`;
});
after(() => {
    server.close();
    require('../server/database').db.close();
});

const sessions = {};
async function login(email, password = 'demo123') {
    const res = await fetch(`${base}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    assert.equal(res.status, 200, `login ${email}`);
    sessions[email] = res.headers.get('set-cookie').split(';')[0];
}

async function api(email, method, url, body) {
    const opts = { method, headers: { Cookie: sessions[email] } };
    if (body instanceof FormData) opts.body = body;
    else if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    const res = await fetch(base + url, opts);
    const type = res.headers.get('content-type') || '';
    return { status: res.status, data: type.includes('json') ? await res.json() : await res.text() };
}

function upload(email, fields, name = 'work.pdf') {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    form.append('file', new Blob(['%PDF-1.4 test']), name);
    return api(email, 'POST', '/submissions', form);
}

const IVY = 'ivy@example.com', JOHN = 'student@example.com', KUMAR = 'faculty@example.com', PRIYA = 'priya@example.com', ADMIN = 'admin@example.com';
const proposal = {
    title: 'Library Seat Booking', problem_statement: 'Seats are hard to find during exams.', objectives: 'Real-time seat availability',
    methodology: 'Sensors + web app', technologies: 'Node.js', expected_outcome: 'Pilot',
};

test('rejects a wrong password', async () => {
    const res = await fetch(`${base}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: IVY, password: 'nope' }),
    });
    assert.equal(res.status, 401);
});

test('full lifecycle: proposal → review → guide → milestones → reviews → final evaluation', async () => {
    for (const u of [IVY, JOHN, KUMAR, PRIYA, ADMIN]) await login(u);
    const faculty = (await api(IVY, 'GET', '/users/faculty')).data;
    const kumar = faculty.find(f => f.email === KUMAR);

    // Proposal
    let r = await api(IVY, 'POST', '/projects/proposal', { ...proposal, preferred_guide_id: kumar.id });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    const projectId = r.data.projectId;

    // Access control
    assert.equal((await api(JOHN, 'GET', `/projects/${projectId}`)).status, 403);
    assert.equal((await api(PRIYA, 'GET', `/projects/${projectId}`)).status, 403);

    // Kumar sees it as the preferred guide and requests changes
    let pending = (await api(KUMAR, 'GET', '/proposals')).data;
    let mine = pending.find(p => p.project_id === projectId);
    assert.ok(mine, 'preferred guide sees the proposal');
    r = await api(KUMAR, 'POST', `/proposals/${mine.id}/review`, { decision: 'CHANGES_REQUESTED' });
    assert.equal(r.status, 400, 'feedback required when requesting changes');
    r = await api(KUMAR, 'POST', `/proposals/${mine.id}/review`, { decision: 'CHANGES_REQUESTED', feedback: 'Add metrics' });
    assert.equal(r.status, 200);

    // Student resubmits v2, Kumar approves and becomes guide
    r = await api(IVY, 'POST', '/projects/proposal', { ...proposal, objectives: 'Availability within 5 s', preferred_guide_id: kumar.id });
    assert.equal(r.status, 201);
    assert.match(r.data.message, /v2/);
    mine = (await api(KUMAR, 'GET', '/proposals')).data.find(p => p.project_id === projectId);
    assert.equal(mine.version, 2);
    r = await api(KUMAR, 'POST', `/proposals/${mine.id}/review`, { decision: 'APPROVED' });
    assert.equal(r.data.projectStatus, 'IN_PROGRESS');
    assert.equal((await api(IVY, 'POST', '/projects/proposal', proposal)).status, 400, 'cannot resubmit once approved');

    // Milestones
    assert.equal((await api(IVY, 'POST', `/projects/${projectId}/milestones/template`)).status, 403);
    assert.equal((await api(KUMAR, 'POST', `/projects/${projectId}/milestones/template`)).status, 201);
    assert.equal((await api(KUMAR, 'POST', `/projects/${projectId}/milestones/template`)).status, 400);
    let detail = (await api(IVY, 'GET', `/projects/${projectId}`)).data;
    assert.equal(detail.milestones.length, 5);
    assert.equal(detail.permissions.canFinalSubmit, false);

    // Upload validation + revision loop on milestone 1
    const m1 = detail.milestones[0];
    assert.equal((await upload(IVY, { projectId, milestoneId: m1.id }, 'virus.exe')).status, 400);
    assert.equal((await upload(JOHN, { projectId, milestoneId: m1.id })).status, 403);
    assert.equal((await upload(IVY, { projectId, milestoneId: m1.id })).status, 201);
    const queue = (await api(KUMAR, 'GET', '/milestones/review-queue')).data;
    assert.ok(queue.some(q => q.id === m1.id));
    const scores = { technical: 6, progress: 6, documentation: 6, presentation: 6 };
    assert.equal((await api(KUMAR, 'POST', `/milestones/${m1.id}/review`, { ...scores, technical: 11, decision: 'APPROVED' })).status, 400);
    r = await api(KUMAR, 'POST', `/milestones/${m1.id}/review`, { ...scores, decision: 'REVISION_REQUESTED', feedback: 'More detail' });
    assert.equal(r.status, 200);

    // Approve every milestone
    for (const m of detail.milestones) {
        assert.equal((await upload(IVY, { projectId, milestoneId: m.id })).status, 201);
        r = await api(KUMAR, 'POST', `/milestones/${m.id}/review`, { technical: 8, progress: 8, documentation: 9, presentation: 7, decision: 'APPROVED' });
        assert.equal(r.status, 200, JSON.stringify(r.data));
    }

    // Final submission requires the final report
    r = await api(IVY, 'POST', `/projects/${projectId}/final-submit`);
    assert.equal(r.status, 400);
    assert.match(r.data.error, /final project report/);
    assert.equal((await upload(IVY, { projectId, docType: 'FINAL_REPORT' }, 'final.pdf')).status, 201);
    assert.equal((await api(IVY, 'POST', `/projects/${projectId}/final-submit`)).status, 200);

    // Evaluation
    const evalScores = { technical: 18, implementation: 17, innovation: 12, documentation: 13, presentation: 12, viva: 13 };
    assert.equal((await api(IVY, 'POST', `/projects/${projectId}/evaluation`, evalScores)).status, 403);
    r = await api(KUMAR, 'POST', `/projects/${projectId}/evaluation`, evalScores);
    assert.equal(r.status, 200);
    assert.equal(r.data.total, 85);
    assert.equal(r.data.grade, 'A+');

    detail = (await api(IVY, 'GET', `/projects/${projectId}`)).data;
    assert.equal(detail.project.status, 'COMPLETED');
    assert.equal(detail.progress, 100);
    assert.equal(detail.evaluation.total_score, 85);

    // Downloads are access-controlled
    const fileUrl = detail.documents[0].download_url.replace('/api', '');
    assert.equal((await api(IVY, 'GET', fileUrl)).status, 200);
    assert.equal((await api(JOHN, 'GET', fileUrl)).status, 403);

    const notes = (await api(IVY, 'GET', '/notifications')).data;
    assert.ok(notes.unread > 0);
});

test('admin allocates a guide to an approved project', async () => {
    await login(ADMIN);
    const approved = (await api(ADMIN, 'GET', '/projects?status=APPROVED')).data;
    assert.equal(approved.length, 1);
    const faculty = (await api(ADMIN, 'GET', '/users/faculty')).data;
    const priya = faculty.find(f => f.email === PRIYA);
    assert.equal((await api(JOHN, 'POST', `/projects/${approved[0].id}/allocate`, { faculty_id: priya.id })).status, 403);
    const r = await api(ADMIN, 'POST', `/projects/${approved[0].id}/allocate`, { faculty_id: priya.id });
    assert.equal(r.status, 200);
    const detail = (await api(ADMIN, 'GET', `/projects/${approved[0].id}`)).data;
    assert.equal(detail.project.status, 'IN_PROGRESS');
    assert.equal(detail.project.guide_name, 'Dr. Priya');
});

test('dashboards load for every role', async () => {
    const admin = await api(ADMIN, 'GET', '/dashboard/admin');
    assert.equal(admin.status, 200);
    assert.ok(admin.data.stats.delayed >= 1);
    assert.ok(admin.data.stats.atRisk >= 1);
    const fac = await api(KUMAR, 'GET', '/dashboard/faculty');
    assert.equal(fac.status, 200);
    assert.ok(fac.data.stats.awaitingEvaluation >= 1);
    const stu = await api(JOHN, 'GET', '/dashboard/student');
    assert.equal(stu.data.detail.project.guide_name, 'Dr. Kumar');
    assert.equal((await api(JOHN, 'GET', '/dashboard/admin')).status, 403);
});
