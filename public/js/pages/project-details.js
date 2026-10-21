const { api, esc, icon, date, dateTime } = App;
const UI = ProjectUI;
const TABS = ['overview', 'proposal', 'milestones', 'documents', 'evaluation', 'activity'];

App.page({
    nav: (u) => (u.role === 'STUDENT' ? 'project' : 'projects'),
    title: (u) => (u.role === 'STUDENT' ? 'My Project' : 'Project'),
}, async (user, content) => {
    const id = new URLSearchParams(location.search).get('id');
    let detail;
    let tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';

    async function load() {
        if (id) {
            detail = await api(`/projects/${id}`);
        } else if (user.role === 'STUDENT') {
            detail = (await api('/dashboard/student')).detail;
            if (!detail) {
                content.innerHTML = `<div class="card">${App.empty('folder', 'No project yet', 'Start by submitting a project proposal.',
                    '<a class="btn btn-primary" href="proposal.html">Write a proposal</a>')}</div>`;
                return;
            }
        } else {
            location.href = user.role === 'ADMIN' ? 'projects.html' : 'faculty-projects.html';
            return;
        }
        render();
    }

    function render() {
        const { project: p, permissions: perm } = detail;
        document.querySelector('.topbar .crumb').textContent = p.title;
        document.title = `${p.title} · ProjectFlow`;

        const actions = [];
        if (perm.canEditProposal) actions.push(`<a class="btn" href="proposal.html">${icon('edit')}${p.status === 'PROPOSAL_SUBMITTED' ? 'Edit proposal' : 'Revise proposal'}</a>`);
        if (perm.canAllocate && p.status !== 'REJECTED') actions.push(`<button class="btn" data-allocate>${icon('link')}${p.guide_id ? 'Reassign guide' : 'Allocate guide'}</button>`);
        if (perm.canFinalSubmit) actions.push(`<button class="btn btn-good" data-final-submit>${icon('send')}Final submission</button>`);

        const counts = {
            milestones: detail.milestones.length,
            documents: detail.documents.length,
            proposal: detail.proposals.length > 1 ? `v${detail.proposals[0].version}` : '',
        };

        content.innerHTML = `
            <div class="page-head">
                <div class="grow">
                    <div class="row" style="margin-bottom:8px">${App.statusBadge(p.status)}${App.healthBadge(detail.health)}${p.domain ? `<span class="pill">${esc(p.domain)}</span>` : ''}</div>
                    <h1>${esc(p.title)}</h1>
                    <p>${esc(p.student_name)}${p.student_roll ? ` · ${esc(p.student_roll)}` : ''} · Guide: ${p.guide_name ? esc(p.guide_name) : '<span class="muted">not allocated</span>'}</p>
                </div>
                <div class="row">${actions.join('')}</div>
            </div>
            <div class="card card-body" style="margin-bottom:16px">${App.stepper(p, detail.progress)}</div>
            <div id="next-step" style="margin-bottom:16px">${UI.nextStep(detail, user)}</div>
            <nav class="tabs" role="tablist">${TABS.map(t => `<button class="tab ${t === tab ? 'active' : ''}" role="tab" data-tab="${t}" aria-selected="${t === tab}">${t[0].toUpperCase() + t.slice(1)}${counts[t] ? `<span class="count">${counts[t]}</span>` : ''}</button>`).join('')}</nav>
            <div id="tab-body"></div>`;
        if (!content.querySelector('#next-step').innerHTML.trim()) content.querySelector('#next-step').remove();

        content.querySelector('.tabs').onclick = (e) => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            tab = b.dataset.tab;
            history.replaceState(null, '', `#${tab}`);
            content.querySelectorAll('.tab').forEach(t => { t.classList.toggle('active', t === b); t.setAttribute('aria-selected', t === b); });
            renderTab();
        };
        content.querySelectorAll('[data-allocate]').forEach(b => b.onclick = async () => { if (await UI.allocateModal(p)) load(); });
        content.querySelectorAll('[data-final-submit]').forEach(b => b.onclick = async () => { if (await UI.finalSubmit(detail)) load(); });
        renderTab();
    }

    function renderTab() {
        const body = document.createElement('div');
        content.querySelector('#tab-body').replaceChildren(body);
        ({ overview, proposal, milestones, documents, evaluation, activity })[tab](body);
        // Deep link to a milestone from notifications
        if (tab === 'milestones') body.querySelector('.milestone .badge.blue, .milestone .badge.warning, .milestone .badge.critical')?.closest('.milestone')?.scrollIntoView({ block: 'center' });
    }

    // ---- Tabs --------------------------------------------------------------------
    function overview(body) {
        const { project: p } = detail;
        const ms = detail.milestones;
        const next = ms.find(m => m.status !== 'APPROVED');
        body.innerHTML = `<div class="grid grid-main">
            <div class="stack">
                <div class="card"><div class="card-head"><h2>About the project</h2></div><div class="card-body">
                    <dl class="dl">
                        <dt>Problem</dt><dd>${esc(p.description)}</dd>
                        <dt>Technologies</dt><dd>${(p.technologies || '').split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="pill">${esc(t)}</span>`).join('') || '—'}</dd>
                        ${p.domain ? `<dt>Domain</dt><dd>${esc(p.domain)}</dd>` : ''}
                    </dl>
                </div></div>
                <div class="card"><div class="card-head"><div><h2>Milestone progress</h2><p>${ms.filter(m => m.status === 'APPROVED').length} of ${ms.length} approved</p></div>
                    <a class="btn btn-sm" href="#milestones" data-goto="milestones">View all</a></div>
                    <div class="card-body stack">
                        ${App.meter(detail.progress, 'lg')}
                        ${next ? `<div class="row-between"><div><div class="small muted">Next milestone</div><b>${esc(next.title)}</b></div><div style="text-align:right">${App.milestoneBadge(next)}<div class="small muted" style="margin-top:4px">Due ${date(next.deadline)} · ${App.due(next.deadline)}</div></div></div>` : ms.length ? '<p class="muted">All milestones approved.</p>' : '<p class="muted">No milestones set yet.</p>'}
                    </div>
                </div>
            </div>
            <div class="stack">
                <div class="card"><div class="card-head"><h2>People</h2></div><ul class="list">
                    <li class="row"><span class="avatar">${esc(App.initials(p.student_name))}</span><div class="grow"><b>${esc(p.student_name)}</b><div class="small muted">Student${p.student_roll ? ` · ${esc(p.student_roll)}` : ''} · ${esc(p.student_email)}</div></div></li>
                    <li class="row"><span class="avatar">${p.guide_name ? esc(App.initials(p.guide_name)) : '—'}</span><div class="grow"><b>${p.guide_name ? esc(p.guide_name) : 'Not allocated'}</b><div class="small muted">Guide${p.guide_email ? ` · ${esc(p.guide_email)}` : ''}</div></div></li>
                    ${p.preferred_guide_name && p.preferred_guide_id !== p.guide_id ? `<li class="small muted">Preferred guide: ${esc(p.preferred_guide_name)}</li>` : ''}
                </ul></div>
                <div class="card"><div class="card-head"><h2>Key dates</h2></div><div class="card-body"><dl class="dl">
                    <dt>Proposed</dt><dd>${date(p.created_at)}</dd>
                    <dt>Guide allocated</dt><dd>${date(p.allocated_at)}</dd>
                    <dt>Final submission</dt><dd>${date(p.final_submitted_at)}</dd>
                    <dt>Last activity</dt><dd>${App.ago(p.updated_at)}</dd>
                </dl></div></div>
            </div>
        </div>`;
        body.querySelector('[data-goto]').onclick = (e) => { e.preventDefault(); content.querySelector('[data-tab=milestones]').click(); };
    }

    function proposalView(pr) {
        return `<dl class="dl">
            <dt>Title</dt><dd><b>${esc(pr.title)}</b></dd>
            ${pr.domain ? `<dt>Domain</dt><dd>${esc(pr.domain)}</dd>` : ''}
            <dt>Problem statement</dt><dd>${esc(pr.problem_statement)}</dd>
            <dt>Objectives</dt><dd>${esc(pr.objectives)}</dd>
            <dt>Methodology</dt><dd>${esc(pr.methodology)}</dd>
            <dt>Technologies</dt><dd>${esc(pr.technologies)}</dd>
            <dt>Expected outcome</dt><dd>${esc(pr.expected_outcome) || '—'}</dd>
        </dl>
        ${pr.feedback ? `<div class="ms-section"><h4>Feedback from ${esc(pr.reviewer_name || 'reviewer')} · ${date(pr.reviewed_at)}</h4><div class="pre">${esc(pr.feedback)}</div></div>` : ''}`;
    }

    function proposal(body) {
        const [latest, ...older] = detail.proposals;
        if (!latest) { body.innerHTML = `<div class="card">${App.empty('file', 'No proposal on record')}</div>`; return; }
        body.innerHTML = `<div class="grid ${detail.permissions.canReviewProposal ? 'grid-main' : ''}">
            <div class="stack">
                <div class="card"><div class="card-head"><div><h2>Proposal v${latest.version}</h2><p>Submitted ${dateTime(latest.submitted_at)}</p></div>${App.proposalBadge(latest.status)}</div>
                    <div class="card-body">${proposalView(latest)}</div></div>
                ${older.length ? `<div class="card"><div class="card-head"><h2>Earlier versions</h2></div><div class="card-body stack">
                    ${older.map(pr => `<details><summary class="row" style="cursor:pointer"><b>v${pr.version}</b> ${App.proposalBadge(pr.status)} <span class="muted small">${date(pr.submitted_at)}</span></summary><div style="margin-top:12px">${proposalView(pr)}</div></details>`).join('')}
                </div></div>` : ''}
            </div>
            ${detail.permissions.canReviewProposal ? `<div class="card" style="position:sticky;top:72px"><div class="card-head"><h2>Your decision</h2></div>
                <form class="card-body stack" id="decision-form" novalidate>
                    <div class="stack-sm">
                        <label class="choice"><input type="radio" name="decision" value="APPROVED" required><div><strong>Approve</strong><span>${user.role === 'FACULTY' && !detail.project.guide_id ? 'You will become the guide' : detail.project.guide_id ? 'Project starts with the allocated guide' : 'Then allocate a guide'}</span></div></label>
                        <label class="choice"><input type="radio" name="decision" value="CHANGES_REQUESTED"><div><strong>Request changes</strong><span>Student revises and resubmits</span></div></label>
                        <label class="choice"><input type="radio" name="decision" value="REJECTED"><div><strong>Reject</strong><span>Student must propose a new idea</span></div></label>
                    </div>
                    <div class="field"><label for="pf">Feedback</label><textarea class="textarea" id="pf" name="feedback" rows="5" maxlength="3000" placeholder="Required for changes or rejection"></textarea></div>
                    <div class="form-error hidden" role="alert"></div>
                    <button class="btn btn-primary" type="submit">Submit decision</button>
                </form></div>` : ''}
        </div>`;
        const form = body.querySelector('#decision-form');
        if (form) form.onsubmit = async (e) => {
            e.preventDefault();
            const err = form.querySelector('.form-error');
            const v = App.values(form);
            err.classList.add('hidden');
            if (!v.decision) { err.textContent = 'Choose a decision'; err.classList.remove('hidden'); return; }
            if (v.decision !== 'APPROVED' && !v.feedback) { err.textContent = 'Add feedback explaining what needs to change'; err.classList.remove('hidden'); return; }
            try {
                const r = await api(`/proposals/${latest.id}/review`, { method: 'POST', body: v });
                App.toast(r.message);
                load();
            } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
        };
    }

    function milestones(body) {
        const perm = detail.permissions;
        const ms = detail.milestones;
        body.innerHTML = `<div class="card">
            <div class="card-head"><div><h2>Milestones</h2><p>${ms.filter(m => m.status === 'APPROVED').length} of ${ms.length} approved</p></div>
                <div class="row">${perm.canManageMilestones ? `${!ms.length ? `<button class="btn" data-act="template">${icon('sparkle')}Apply standard plan</button>` : ''}<button class="btn btn-primary" data-act="add-milestone">${icon('plus')}Add milestone</button>` : ''}</div></div>
            ${ms.length ? `<div class="card-body" style="padding-bottom:0">${App.meter(detail.progress, 'lg')}</div>` : ''}
            <div>${UI.milestoneList(detail)}</div>
        </div>`;
        UI.bindMilestones(body, detail, load);
    }

    function documents(body) {
        const perm = detail.permissions;
        const deliverables = detail.milestones.flatMap(m => m.submissions.map(s => ({ ...s, milestone: m.title })));
        const row = (d, label) => `<tr>
            <td><a href="${esc(d.download_url)}" class="row" style="flex-wrap:nowrap">${icon('file')}<span>${esc(d.file_name)}</span></a>${d.comments ? `<div class="sub">${esc(d.comments)}</div>` : ''}</td>
            <td>${esc(label)}</td><td>${esc(d.uploaded_by_name)}</td><td class="nowrap">${dateTime(d.submitted_at)}</td><td class="num">${App.size(d.file_size)}</td>
            <td><a class="btn btn-sm btn-ghost btn-icon" href="${esc(d.download_url)}" aria-label="Download">${icon('download')}</a></td></tr>`;
        const head = '<thead><tr><th>File</th><th>Type</th><th>Uploaded by</th><th>Date</th><th class="num">Size</th><th></th></tr></thead>';
        body.innerHTML = `<div class="stack">
            <div class="card">
                <div class="card-head"><div><h2>Project documentation</h2><p>Final report, presentation, source code and other project documents</p></div>
                    ${perm.canUploadDocs ? `<button class="btn btn-primary" id="upload-doc">${icon('upload')}Upload document</button>` : ''}</div>
                ${detail.documents.length ? `<div class="table-wrap"><table>${head}<tbody>${detail.documents.map(d => row(d, App.DOC_TYPES[d.doc_type] || d.doc_type)).join('')}</tbody></table></div>`
                    : App.empty('file', 'No documents yet', perm.isOwner && detail.project.status === 'IN_PROGRESS' ? 'Your final report must be uploaded here before final submission.' : '')}
            </div>
            <div class="card">
                <div class="card-head"><div><h2>Milestone deliverables</h2><p>Every file submitted against a milestone</p></div></div>
                ${deliverables.length ? `<div class="table-wrap"><table>${head}<tbody>${deliverables.map(d => row(d, d.milestone)).join('')}</tbody></table></div>` : App.empty('upload', 'Nothing submitted yet')}
            </div>
        </div>`;
        body.querySelector('#upload-doc')?.addEventListener('click', async () => {
            const ok = await App.modal({
                title: 'Upload document',
                submitLabel: 'Upload',
                body: `<div class="field"><label for="dt">Document type</label><select class="select" id="dt" name="docType">
                        ${Object.entries(App.DOC_TYPES).filter(([k]) => k !== 'DELIVERABLE').map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
                    <div class="field"><label for="df">File</label><input class="input" type="file" id="df" name="file" required><span class="hint">Up to 25 MB</span></div>
                    <div class="field"><label for="dc">Description <span class="muted">(optional)</span></label><input class="input" id="dc" name="comments" maxlength="2000"></div>`,
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

    function evaluation(body) {
        const { evaluation: ev, permissions: perm, project: p, rubric } = detail;
        if (ev) {
            body.innerHTML = `<div class="grid grid-main">
                <div class="card"><div class="card-head"><div><h2>Final evaluation</h2><p>${esc(ev.evaluator_name)} · ${date(ev.evaluated_at)}</p></div></div>
                    <div class="card-body stack">
                        <div class="score-bars">${Object.entries(rubric.evaluation).map(([k, max]) => {
                            const v = ev[`${k}_score`];
                            return `<div class="score-bar"><span>${UI.EVAL_LABELS[k]}</span><div class="meter-track"><div class="meter-fill" style="width:${(v / max) * 100}%"></div></div><span class="val">${v} / ${max}</span></div>`;
                        }).join('')}</div>
                        ${ev.comments ? `<div><div class="label">Comments</div><div class="quote">${esc(ev.comments)}</div></div>` : ''}
                    </div></div>
                <div class="card"><div class="card-body" style="text-align:center;padding:32px 20px">
                    <div class="tile-label">Final score</div>
                    <div style="font-size:52px;font-weight:600;line-height:1.1">${ev.total_score}<span class="muted" style="font-size:20px"> / 100</span></div>
                    <div style="margin-top:12px"><span class="badge good" style="font-size:14px;height:28px;padding:0 14px">${icon('award')}Grade ${esc(ev.grade)}</span></div>
                </div></div>
            </div>`;
            return;
        }
        if (perm.canEvaluate) {
            const criteria = Object.entries(rubric.evaluation).map(([key, max]) => ({ key, label: UI.EVAL_LABELS[key], max }));
            const reviews = detail.milestones.flatMap(m => m.reviews.filter(r => r.decision === 'APPROVED').slice(0, 1));
            const avg = reviews.length ? Math.round(reviews.reduce((a, r) => a + r.total_score, 0) / reviews.length / 40 * 100) : null;
            body.innerHTML = `<div class="grid grid-main">
                <form class="card" id="eval-form" novalidate><div class="card-head"><div><h2>Final evaluation</h2><p>Scores are final – the project is marked completed on submit</p></div></div>
                    <div class="card-body stack">
                        ${App.rubric(criteria, 'ev-')}
                        <div class="field"><label for="ev-comments">Comments for the student</label><textarea class="textarea" id="ev-comments" name="comments" rows="4" maxlength="3000"></textarea></div>
                        <div class="form-error hidden" role="alert"></div>
                        <div class="row-between"><span class="muted" id="grade-preview"></span><button class="btn btn-primary" type="submit">${icon('award')}Submit evaluation</button></div>
                    </div></form>
                <div class="card"><div class="card-head"><h2>Reference</h2></div><div class="card-body stack">
                    <div><div class="tile-label">Average milestone score</div><div class="tile-value">${avg == null ? '—' : `${avg}%`}</div><div class="tile-note">${reviews.length} approved milestone reviews</div></div>
                    <div><div class="label" style="margin-bottom:6px">Final documents</div>${detail.documents.map(UI.fileRow).join('') || '<p class="muted">None uploaded</p>'}</div>
                    <div class="small muted">Grades: O ≥ 90 · A+ ≥ 80 · A ≥ 70 · B+ ≥ 60 · B ≥ 50 · C ≥ 40 · F &lt; 40</div>
                </div></div>
            </div>`;
            const form = body.querySelector('#eval-form');
            const grade = (t) => (t >= 90 ? 'O' : t >= 80 ? 'A+' : t >= 70 ? 'A' : t >= 60 ? 'B+' : t >= 50 ? 'B' : t >= 40 ? 'C' : 'F');
            App.bindRubric(form, (sum) => { body.querySelector("#grade-preview").textContent = sum ? `Grade preview: ${grade(sum)}` : ""; });
            form.onsubmit = async (e) => {
                e.preventDefault();
                const err = form.querySelector('.form-error');
                err.classList.add('hidden');
                if (!form.reportValidity()) return;
                const ok = await App.confirmAction('Submit final evaluation', 'This completes the project and notifies the student. Scores cannot be changed afterwards.', 'Submit evaluation');
                if (!ok) return;
                try {
                    const r = await api(`/projects/${p.id}/evaluation`, { method: 'POST', body: App.values(form) });
                    App.toast(r.message);
                    load();
                } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
            };
            return;
        }
        // Not yet evaluable – explain what is needed
        const blockers = perm.finalSubmitBlockers;
        body.innerHTML = `<div class="card"><div class="card-head"><h2>Final evaluation</h2></div><div class="card-body stack">
            ${p.status === 'FINAL_SUBMISSION' ? `<div class="callout blue">${icon('clock')}<div><h3>Awaiting evaluation</h3><p class="ink-2">Final submission made ${App.ago(p.final_submitted_at)}. ${esc(p.guide_name)} will evaluate it.</p></div></div>` : ''}
            ${perm.isOwner && p.status === 'IN_PROGRESS' ? `<p class="ink-2">Your guide evaluates the project after you make the final submission. Before that:</p>
                <ul class="list card">${[['Milestone plan set', detail.milestones.length > 0], ['All milestones approved', detail.milestones.length > 0 && detail.milestones.every(m => m.status === 'APPROVED')],
                    ['Final report uploaded', detail.documents.some(d => d.doc_type === 'FINAL_REPORT')]].map(([l, done]) =>
                    `<li class="row">${done ? `<span class="badge good">${icon('check')}Done</span>` : '<span class="badge">To do</span>'}${l}</li>`).join('')}</ul>
                ${perm.canFinalSubmit ? `<div><button class="btn btn-good" data-final-submit>${icon('send')}Make final submission</button></div>` : `<p class="small muted">${blockers.map(esc).join(' · ')}</p>`}` : ''}
            ${!perm.isOwner && p.status !== 'FINAL_SUBMISSION' ? '<p class="muted">The evaluation form becomes available once the student makes the final submission.</p>' : ''}
        </div></div>`;
        body.querySelector('[data-final-submit]')?.addEventListener('click', async () => { if (await UI.finalSubmit(detail)) load(); });
    }

    function activity(body) {
        body.innerHTML = `<div class="card"><div class="card-head"><h2>Activity</h2></div><div class="card-body">
            ${detail.activity.length ? `<ol class="timeline">${detail.activity.map(a => `<li><div>${esc(a.message)}</div><div class="when">${esc(a.actor_name || 'System')} · ${dateTime(a.created_at)}</div></li>`).join('')}</ol>` : App.empty('clock', 'No activity yet')}
        </div></div>`;
    }

    // Notification links can change the hash while this page is open
    window.addEventListener('hashchange', () => {
        const t = location.hash.slice(1);
        if (TABS.includes(t) && t !== tab) content.querySelector(`[data-tab="${t}"]`)?.click();
    });

    await load();
});
