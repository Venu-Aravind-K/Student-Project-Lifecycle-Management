const { api, esc, icon, date, dateTime } = App;
const UI = ProjectUI;
const TABS = [
    ['overview', 'Overview'],
    ['milestones', 'Milestones'],
    ['files', 'Files'],
    ['proposal', 'Proposal'],
    ['grade', 'Grade'],
    ['history', 'History'],
];
const TAB_KEYS = TABS.map(t => t[0]);

App.page({
    nav: (u) => (u.role === 'STUDENT' ? 'project' : 'projects'),
    title: (u) => (u.role === 'STUDENT' ? 'My project' : 'Project'),
    crumbs: (u) => (u.role === 'STUDENT' ? '<b>My project</b>' : `<a href="${u.role === 'ADMIN' ? 'projects.html' : 'faculty-projects.html'}">${u.role === 'ADMIN' ? 'All projects' : 'My students'}</a> / <b id="crumb-title">Project</b>`),
}, async (user, content) => {
    const id = new URLSearchParams(location.search).get('id');
    let detail;
    let tab = TAB_KEYS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
    if (location.hash === '#documents') tab = 'files'; // old link names
    if (location.hash === '#evaluation') tab = 'grade';
    if (location.hash === '#activity') tab = 'history';

    async function load() {
        if (id) detail = await api(`/projects/${id}`);
        else if (user.role === 'STUDENT') {
            detail = (await api('/dashboard/student')).detail;
            if (!detail) {
                content.innerHTML = `<div class="card">${App.empty('folder', 'You don’t have a project yet', 'Start by writing a short proposal describing your idea.', '<a class="btn btn-primary" href="proposal.html">Write proposal</a>')}</div>`;
                return;
            }
        } else {
            location.href = user.role === 'ADMIN' ? 'projects.html' : 'faculty-projects.html';
            return;
        }
        render();
    }

    function setTab(t) {
        tab = t;
        history.replaceState(null, '', `#${t}`);
        document.querySelectorAll('.tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
        renderTab();
        document.querySelector('.tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function render() {
        const { project: p, permissions: perm } = detail;
        const crumb = document.getElementById('crumb-title');
        if (crumb) crumb.textContent = p.title;
        document.title = `${p.title} · ProjectFlow`;

        const actions = [];
        if (perm.canEditProposal) actions.push(`<a class="btn" href="proposal.html">${icon('pen')}Edit proposal</a>`);
        if (perm.canAllocate && p.guide_id) actions.push(`<button class="btn" data-action="allocate">${icon('link')}Change guide</button>`);

        const attention = {
            milestones: detail.milestones.some(m => (perm.canSubmitWork && (m.overdue || m.status === 'REVISION_REQUESTED')) || (perm.canReviewMilestones && m.status === 'SUBMITTED')),
            proposal: perm.canReviewProposal,
            grade: perm.canEvaluate,
        };
        const counts = { milestones: detail.milestones.length, files: detail.documents.length + detail.milestones.reduce((a, m) => a + m.submissions.length, 0) };

        const root = document.createElement('div');
        root.innerHTML = `
            <div class="page-header">
                <div class="grow">
                    <div class="eyebrow">${App.statusPill(p.status)}${App.healthPill(detail.health)}</div>
                    <h1>${esc(p.title)}</h1>
                    <p>${user.role === 'STUDENT' ? '' : `${esc(p.student_name)}${p.student_roll ? ` (${esc(p.student_roll)})` : ''} · `}Guide: ${p.guide_name ? esc(p.guide_name) : 'not assigned yet'}</p>
                </div>
                <div class="row">${actions.join('')}</div>
            </div>
            <div class="stack">
                ${UI.nextStep(detail, user)}
                ${UI.journey(detail, user)}
            </div>
            <nav class="tabs" role="tablist" aria-label="Project sections">${TABS.map(([k, label]) => `<button class="tab ${k === tab ? 'active' : ''}" role="tab" aria-selected="${k === tab}" data-tab="${k}">${label}${counts[k] ? `<span class="n">${counts[k]}</span>` : ''}${attention[k] ? '<span class="dot" title="Needs attention"></span>' : ''}</button>`).join('')}</nav>
            <div id="tab-body"></div>`;
        content.replaceChildren(root);
        root.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
        UI.bindActions(root, detail, load, { onGoto: setTab });
        renderTab();
    }

    function renderTab() {
        const body = document.getElementById('tab-body');
        body.innerHTML = ({ overview, milestones, files, proposal, grade, history })[tab]();
        ({ proposal: bindProposal, grade: bindGrade, files: bindFiles })[tab]?.(body);
    }

    // ---- Tabs --------------------------------------------------------------------------
    function overview() {
        const p = detail.project;
        const person = (name, role, email) => `<div class="row" style="padding:10px 0"><span class="avatar">${name ? esc(App.initials(name)) : '?'}</span>
            <div class="grow"><b>${name ? esc(name) : 'Not assigned yet'}</b><div class="small muted">${role}${email ? ` · ${esc(email)}` : ''}</div></div></div>`;
        return `<div class="grid cols-main">
            <div class="card"><div class="card-header"><h2>About this project</h2></div><div class="card-body">
                <dl class="kv">
                    <dt>The problem</dt><dd>${esc(p.description)}</dd>
                    ${p.domain ? `<dt>Area</dt><dd>${esc(p.domain)}</dd>` : ''}
                    <dt>Technologies</dt><dd>${(p.technologies || '').split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('') || '—'}</dd>
                </dl>
                <p class="small muted" style="margin-top:16px">The full proposal is under the <a href="#proposal" data-goto="proposal">Proposal</a> tab.</p>
            </div></div>
            <div class="stack">
                <div class="card card-pad"><div class="detail-label">People</div>
                    ${person(p.student_name, `Student${p.student_roll ? ` · ${esc(p.student_roll)}` : ''}`, p.student_email)}
                    ${person(p.guide_name, 'Faculty guide', p.guide_email)}
                    ${p.preferred_guide_name && p.preferred_guide_id !== p.guide_id ? `<p class="small muted">Student asked for ${esc(p.preferred_guide_name)}.</p>` : ''}
                </div>
                <div class="card card-pad"><div class="detail-label">Key dates</div><dl class="kv" style="grid-template-columns:120px 1fr;gap:10px">
                    <dt>Proposed</dt><dd>${date(p.created_at)}</dd>
                    <dt>Guide assigned</dt><dd>${date(p.allocated_at)}</dd>
                    <dt>Submitted</dt><dd>${date(p.final_submitted_at)}</dd>
                    <dt>Last update</dt><dd>${App.ago(p.updated_at)}</dd>
                </dl></div>
            </div>
        </div>`;
    }

    function milestones() {
        const perm = detail.permissions;
        const ms = detail.milestones;
        const done = ms.filter(m => m.status === 'APPROVED').length;
        return `<div class="card">
            <div class="card-header"><div><h2>Milestones</h2><p>${ms.length ? `${done} of ${ms.length} done. Click a milestone to see the uploaded files and feedback.` : 'Checkpoints with deadlines.'}</p></div>
                ${perm.canManageMilestones && ms.length ? `<button class="btn" data-action="add-milestone">${icon('plus')}Add milestone</button>` : ''}</div>
            ${ms.length ? `<div class="card-body" style="padding-bottom:8px">${App.progress(detail.progress, 'good')}</div>` : ''}
            <div>${UI.milestoneList(detail, user)}</div>
        </div>
        <div class="legend" style="margin-top:14px">
            <span>${App.pill(['', 'circle', 'To do'], 'sm')} not uploaded yet</span>
            <span>${App.pill(['primary', 'hourglass', 'Waiting for review'], 'sm')} uploaded, guide is checking</span>
            <span>${App.pill(['warn', 'refresh', 'Needs changes'], 'sm')} fix and upload again</span>
            <span>${App.pill(['good', 'check', 'Done'], 'sm')} approved</span>
        </div>`;
    }

    function files() {
        const perm = detail.permissions;
        const groups = detail.milestones.filter(m => m.submissions.length);
        const typeTag = (d) => `<span class="tag" style="margin:0">${esc(App.DOC_TYPES[d.doc_type] || d.doc_type)}</span>`;
        const hasReport = detail.documents.some(d => d.doc_type === 'FINAL_REPORT');
        return `<div class="stack">
            <div class="card">
                <div class="card-header"><div><h2>Project documents</h2><p>Final report, presentation, source code and other files for the whole project.</p></div>
                    ${perm.canUploadDocs ? `<button class="btn btn-primary" id="upload-doc">${icon('upload')}Upload document</button>` : ''}</div>
                <div class="card-body">
                    ${perm.isOwner && detail.project.status === 'IN_PROGRESS' && !hasReport ? `<div class="explain" style="margin-bottom:14px">${icon('info')}<span>You need to upload your <b>final report</b> here before you can submit the project for grading.</span></div>` : ''}
                    ${detail.documents.length ? detail.documents.map(d => `<div class="row" style="margin-bottom:8px;flex-wrap:nowrap"><div class="grow">${UI.fileItem(d)}</div>${typeTag(d)}</div>`).join('')
                        : '<p class="muted">No documents uploaded yet.</p>'}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><div><h2>Milestone work</h2><p>Everything uploaded for each milestone.</p></div></div>
                <div class="card-body">${groups.length ? groups.map(m => `<div style="margin-bottom:18px"><div class="detail-label">${esc(m.title)}</div>${m.submissions.map(UI.fileItem).join('')}</div>`).join('')
                    : '<p class="muted">Nothing uploaded for milestones yet.</p>'}</div>
            </div>
        </div>`;
    }

    function bindFiles(body) {
        body.querySelector('#upload-doc')?.addEventListener('click', async () => {
            const types = Object.entries(App.DOC_TYPES).filter(([k]) => k !== 'DELIVERABLE');
            const ok = await App.modal({
                title: 'Upload a document',
                subtitle: 'For files about the whole project, like your final report.',
                submitLabel: 'Upload',
                body: `<div class="field"><span class="label">What kind of document is it?</span><div class="options" style="grid-template-columns:1fr 1fr">
                        ${types.map(([k, l], i) => `<label class="option"><input type="radio" name="docType" value="${k}" ${i === 0 ? 'checked' : ''}><div><strong>${l}</strong></div></label>`).join('')}</div></div>
                    <div class="field"><label for="df">Choose a file</label><input class="input" type="file" id="df" name="file" required><span class="help">Up to 25 MB.</span></div>
                    <div class="field"><label for="dc">Short description <span class="optional">(optional)</span></label><input class="input" id="dc" name="comments" maxlength="2000"></div>`,
                onSubmit: async (v, form) => {
                    const fd = new FormData();
                    fd.append('projectId', detail.project.id);
                    fd.append('docType', v.docType);
                    fd.append('comments', v.comments || '');
                    fd.append('file', form.querySelector('[name=file]').files[0]);
                    await api('/submissions', { method: 'POST', body: fd });
                    App.toast('Document uploaded');
                },
            });
            if (ok) load();
        });
    }

    function proposalBlock(pr) {
        return `<dl class="kv">
            <dt>Title</dt><dd><b>${esc(pr.title)}</b></dd>
            ${pr.domain ? `<dt>Area</dt><dd>${esc(pr.domain)}</dd>` : ''}
            <dt>The problem</dt><dd>${esc(pr.problem_statement)}</dd>
            <dt>Goals</dt><dd>${esc(pr.objectives)}</dd>
            <dt>How it will be built</dt><dd>${esc(pr.methodology)}</dd>
            <dt>Technologies</dt><dd>${esc(pr.technologies)}</dd>
            <dt>Expected result</dt><dd>${esc(pr.expected_outcome) || '—'}</dd>
        </dl>
        ${pr.feedback ? `<div class="feedback" style="margin-top:20px"><div class="detail-label">Feedback from ${esc(pr.reviewer_name || 'reviewer')} · ${date(pr.reviewed_at)}</div><div class="pre">${esc(pr.feedback)}</div></div>` : ''}`;
    }

    function proposal() {
        const [latest, ...older] = detail.proposals;
        if (!latest) return `<div class="card">${App.empty('file', 'No proposal on record')}</div>`;
        const decide = detail.permissions.canReviewProposal;
        const becomesGuide = user.role === 'FACULTY' && !detail.project.guide_id;
        return `<div class="grid ${decide ? 'cols-main' : ''}">
            <div class="stack">
                <div class="card"><div class="card-header"><div><h2>Proposal${latest.version > 1 ? ` · version ${latest.version}` : ''}</h2><p>Sent ${dateTime(latest.submitted_at)}</p></div>${App.proposalPill(latest.status)}</div>
                    <div class="card-body">${proposalBlock(latest)}</div></div>
                ${older.length ? `<div class="card"><div class="card-header"><div><h2>Earlier versions</h2><p>Kept so you can see what changed.</p></div></div><div class="card-body stack-md">
                    ${older.map(pr => `<details><summary class="row" style="cursor:pointer"><b>Version ${pr.version}</b>${App.proposalPill(pr.status, 'sm')}<span class="small muted">${date(pr.submitted_at)}</span></summary><div style="margin-top:14px">${proposalBlock(pr)}</div></details>`).join('')}
                </div></div>` : ''}
            </div>
            ${decide ? `<form class="card card-pad stack-md" id="decision-form" style="position:sticky;top:76px" novalidate>
                <div><h2>Your decision</h2><p class="small muted" style="margin-top:4px">The student is notified straight away.</p></div>
                <label class="option good"><input type="radio" name="decision" value="APPROVED"><div><strong>Approve</strong><span>${becomesGuide ? 'You will become this student’s guide.' : detail.project.guide_id ? 'Work can start straight away.' : 'Next, a guide will be assigned.'}</span></div></label>
                <label class="option warn"><input type="radio" name="decision" value="CHANGES_REQUESTED"><div><strong>Ask for changes</strong><span>The student edits it and sends it again.</span></div></label>
                <label class="option bad"><input type="radio" name="decision" value="REJECTED"><div><strong>Reject</strong><span>The student must come up with a new idea.</span></div></label>
                <div class="field"><label for="pf">Feedback for the student</label><textarea class="textarea" id="pf" name="feedback" rows="5" maxlength="3000" placeholder="Required if you ask for changes or reject"></textarea></div>
                <div class="form-error hidden" role="alert"></div>
                <button class="btn btn-primary btn-lg" type="submit">Send decision</button>
            </form>` : ''}
        </div>`;
    }

    function bindProposal(body) {
        const form = body.querySelector('#decision-form');
        if (!form) return;
        form.onsubmit = async (e) => {
            e.preventDefault();
            const err = form.querySelector('.form-error');
            const v = App.values(form);
            const fail = (m) => { err.innerHTML = `${icon('alertCircle')}<span>${esc(m)}</span>`; err.classList.remove('hidden'); };
            err.classList.add('hidden');
            if (!v.decision) return fail('Choose Approve, Ask for changes, or Reject');
            if (v.decision !== 'APPROVED' && !v.feedback) return fail('Write a short note explaining what needs to change');
            try {
                const r = await api(`/proposals/${detail.proposals[0].id}/review`, { method: 'POST', body: v });
                App.toast(r.message);
                App.refreshCounts();
                load();
            } catch (ex) { fail(ex.message); }
        };
    }

    function grade() {
        const { evaluation: ev, permissions: perm, project: p } = detail;
        if (ev) {
            return `<div class="grid cols-main">
                <div class="card"><div class="card-header"><div><h2>Score breakdown</h2><p>Graded by ${esc(ev.evaluator_name)} on ${date(ev.evaluated_at)}</p></div></div>
                    <div class="card-body stack">
                        <div class="bars">${UI.EVAL_CRITERIA.map(c => {
                            const v = ev[`${c.key}_score`];
                            return `<div class="bar-row"><span class="name">${c.label}</span><div class="bar-track"><div style="width:${(v / c.max) * 100}%"></div></div><span class="val">${v} / ${c.max}</span></div>`;
                        }).join('')}</div>
                        ${ev.comments ? `<div><div class="detail-label">Comments</div><div class="quote">${esc(ev.comments)}</div></div>` : ''}
                    </div></div>
                <div class="card card-pad" style="text-align:center">
                    <div class="detail-label">Final score</div>
                    <div style="font-size:56px;font-weight:800;letter-spacing:-0.03em;line-height:1.05">${ev.total_score}<span class="muted" style="font-size:22px;font-weight:600"> / 100</span></div>
                    <div style="margin-top:14px">${App.pill(['good', 'award', `Grade ${ev.grade}`])}</div>
                    <p class="small muted" style="margin-top:16px">O ≥ 90 · A+ ≥ 80 · A ≥ 70 · B+ ≥ 60 · B ≥ 50 · C ≥ 40</p>
                </div>
            </div>`;
        }
        if (perm.canEvaluate) {
            const approved = detail.milestones.flatMap(m => m.reviews.filter(r => r.decision === 'APPROVED').slice(0, 1));
            const avg = approved.length ? Math.round(approved.reduce((a, r) => a + r.total_score, 0) / approved.length / 40 * 100) : null;
            return `<div class="grid cols-main">
                <form class="card" id="eval-form" novalidate>
                    <div class="card-header"><div><h2>Final grade</h2><p>Drag each slider to give a score. The grade is worked out for you.</p></div></div>
                    <div class="card-body stack">
                        ${App.scoreSliders(UI.EVAL_CRITERIA, 'ev')}
                        <div class="field"><label for="ev-comments">Comments for the student <span class="optional">(optional)</span></label><textarea class="textarea" id="ev-comments" name="comments" rows="4" maxlength="3000"></textarea></div>
                        <div class="form-error hidden" role="alert"></div>
                        <div class="spread"><span class="bold" id="grade-preview"></span><button class="btn btn-primary btn-lg" type="submit">${icon('award')}Save final grade</button></div>
                    </div>
                </form>
                <div class="stack">
                    <div class="card card-pad"><div class="detail-label">To help you decide</div>
                        <div class="summary-value">${avg == null ? '—' : `${avg}%`}</div><div class="summary-label">Average milestone score (${App.plural(approved.length, 'review')})</div></div>
                    <div class="card card-pad"><div class="detail-label">Final documents</div>${detail.documents.map(UI.fileItem).join('') || '<p class="muted">None uploaded.</p>'}</div>
                </div>
            </div>`;
        }
        const checks = [
            ['Your guide has set milestones', detail.milestones.length > 0],
            ['Every milestone is approved', detail.milestones.length > 0 && detail.milestones.every(m => m.status === 'APPROVED')],
            ['Your final report is uploaded (under Files)', detail.documents.some(d => d.doc_type === 'FINAL_REPORT')],
        ];
        return `<div class="card">
            <div class="card-header"><div><h2>Final grade</h2><p>${p.status === 'FINAL_SUBMISSION' ? `Submitted ${App.ago(p.final_submitted_at)} — ${esc(p.guide_name)} will grade it.` : 'The project is graded after the final submission.'}</p></div></div>
            <div class="card-body">
                ${perm.isOwner && p.status === 'IN_PROGRESS' ? `<p class="ink-2" style="margin-bottom:12px">Before you can submit your project for grading:</p>
                    <ul class="rows card" style="box-shadow:none">${checks.map(([label, ok]) => `<li class="row-item">${ok ? `<span class="ms-mark done">${icon('check')}</span>` : '<span class="ms-mark"></span>'}<span class="${ok ? '' : 'bold'}">${label}</span></li>`).join('')}</ul>
                    ${perm.canFinalSubmit ? `<div style="margin-top:16px"><button class="btn btn-good btn-lg" data-action="final-submit">${icon('send')}Submit project for grading</button></div>` : ''}`
                    : `<p class="muted">${p.status === 'FINAL_SUBMISSION' ? 'Nothing to do until the grade is in.' : 'Grading opens once the student submits the finished project.'}</p>`}
            </div>
        </div>`;
    }

    function bindGrade(body) {
        const form = body.querySelector('#eval-form');
        if (!form) return;
        const check = App.bindScores(form, (sum, all) => {
            body.querySelector('#grade-preview').textContent = all ? `Grade: ${UI.gradeFor(sum)} (${sum}/100)` : '';
        });
        form.onsubmit = async (e) => {
            e.preventDefault();
            const err = form.querySelector('.form-error');
            const fail = (m) => { err.innerHTML = `${icon('alertCircle')}<span>${esc(m)}</span>`; err.classList.remove('hidden'); };
            err.classList.add('hidden');
            try { check(); } catch (ex) { return fail(ex.message); }
            const v = App.values(form);
            const total = UI.EVAL_CRITERIA.reduce((a, c) => a + Number(v[c.key]), 0);
            if (!await App.confirmAction('Save this final grade?', `${total}/100 — grade <b>${UI.gradeFor(total)}</b>. The project will be marked as completed and the student notified. This can’t be changed later.`, 'Save grade')) return;
            try {
                const r = await api(`/projects/${detail.project.id}/evaluation`, { method: 'POST', body: v });
                App.toast(r.message);
                App.refreshCounts();
                load();
            } catch (ex) { fail(ex.message); }
        };
    }

    function history() {
        return `<div class="card"><div class="card-header"><div><h2>History</h2><p>Everything that has happened on this project, newest first.</p></div></div><div class="card-body">
            ${detail.activity.length ? `<ol class="timeline">${detail.activity.map(a => `<li><div>${esc(a.message)}</div><div class="when">${esc(a.actor_name || 'System')} · ${dateTime(a.created_at)}</div></li>`).join('')}</ol>` : App.empty('clock', 'Nothing has happened yet')}
        </div></div>`;
    }

    window.addEventListener('hashchange', () => {
        const t = location.hash.slice(1);
        if (TAB_KEYS.includes(t) && t !== tab) setTab(t);
    });

    await load();
});
