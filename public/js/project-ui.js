/* Project components shared by the project workspace, student dashboard and review queue. */
(function () {
    const { api, esc, icon, date, dateTime, due, size } = App;

    const REVIEW_LABELS = { technical: 'Technical quality', progress: 'Progress against plan', documentation: 'Documentation', presentation: 'Presentation / demo' };
    const EVAL_LABELS = {
        technical: 'Technical depth', implementation: 'Implementation quality', innovation: 'Innovation',
        documentation: 'Documentation & report', presentation: 'Presentation', viva: 'Viva voce',
    };
    const link = (id, tab) => `project-details.html?id=${id}${tab ? `#${tab}` : ''}`;

    function fileRow(f) {
        return `<div class="file-row">${icon('file')}<a href="${esc(f.download_url)}">${esc(f.file_name)}</a>
            <span class="muted small">${size(f.file_size)} · ${dateTime(f.submitted_at)}${f.uploaded_by_role === 'STUDENT' ? '' : ` · ${esc(f.uploaded_by_name)}`}</span></div>
            ${f.comments ? `<div class="small ink-2" style="margin:0 0 4px 24px">${esc(f.comments)}</div>` : ''}`;
    }

    function reviewBlock(r) {
        const max = 40;
        const badge = r.decision === 'APPROVED' ? `<span class="badge good">${icon('check')}Approved</span>` : `<span class="badge warning">${icon('rotate')}Revision requested</span>`;
        return `<div class="stack-sm">
            <div class="row-between"><div class="row">${badge}<b class="num">${r.total_score}/${max}</b></div><span class="small muted">${esc(r.reviewer_name)} · ${date(r.reviewed_at)}</span></div>
            <div class="review-scores">${Object.entries(REVIEW_LABELS).map(([k, l]) => `<span>${l} <b>${r[`${k}_score`]}</b>/10</span>`).join('')}</div>
            ${r.feedback ? `<div class="quote">${esc(r.feedback)}</div>` : ''}
        </div>`;
    }

    function milestoneIndex(m, i) {
        if (m.status === 'APPROVED') return `<div class="ms-index done">${icon('check')}</div>`;
        const cls = m.overdue ? 'overdue' : m.status === 'SUBMITTED' ? 'submitted' : '';
        return `<div class="ms-index ${cls}">${i + 1}</div>`;
    }

    /** Milestone list with per-milestone actions, bound by bindMilestones(). */
    function milestoneList(detail) {
        const { milestones, permissions: perm } = detail;
        if (!milestones.length) {
            const msg = perm.canManageMilestones
                ? 'Add milestones one by one, or apply the standard five-stage plan and adjust the dates.'
                : 'Your guide will publish the milestone plan here.';
            return App.empty('flag', 'No milestones yet', msg);
        }
        return milestones.map((m, i) => {
            const actions = [];
            if (perm.canSubmitWork && m.status !== 'APPROVED') {
                const label = { PENDING: 'Submit work', REVISION_REQUESTED: 'Resubmit', SUBMITTED: 'Upload new version' }[m.status];
                actions.push(`<button class="btn btn-sm ${m.status === 'SUBMITTED' ? '' : 'btn-primary'}" data-act="submit" data-id="${m.id}">${icon('upload')}${label}</button>`);
            }
            if (perm.canReviewMilestones && m.status === 'SUBMITTED') {
                actions.push(`<button class="btn btn-sm btn-primary" data-act="review" data-id="${m.id}">${icon('checkSquare')}Review</button>`);
            }
            if (perm.canManageMilestones && m.status !== 'APPROVED') {
                actions.push(`<button class="btn btn-sm btn-ghost btn-icon" data-act="edit" data-id="${m.id}" title="Edit milestone" aria-label="Edit milestone">${icon('edit')}</button>`);
                if (!m.submissions.length) actions.push(`<button class="btn btn-sm btn-ghost btn-icon btn-danger" data-act="delete" data-id="${m.id}" title="Remove milestone" aria-label="Remove milestone">${icon('trash')}</button>`);
            }
            const [latest, ...older] = m.reviews;
            return `<div class="milestone" id="milestone-${m.id}">
                ${milestoneIndex(m, i)}
                <div class="grow">
                    <div class="row-between" style="align-items:flex-start">
                        <div class="grow">
                            <h3>${esc(m.title)}</h3>
                            <div class="ms-meta"><span>${icon('clock')} Due ${date(m.deadline)}</span>${m.status !== 'APPROVED' ? `<span>${due(m.deadline)}</span>` : ''}</div>
                        </div>
                        <div class="row">${App.milestoneBadge(m)}${actions.join('')}</div>
                    </div>
                    ${m.description ? `<p class="ink-2" style="margin-top:8px">${esc(m.description)}</p>` : ''}
                    ${m.submissions.length ? `<div class="ms-section"><h4>Submissions (${m.submissions.length})</h4>${m.submissions.map(fileRow).join('')}</div>` : ''}
                    ${latest ? `<div class="ms-section"><h4>Guide review</h4>${reviewBlock(latest)}
                        ${older.length ? `<details style="margin-top:8px"><summary class="small muted">Earlier reviews (${older.length})</summary><div class="stack" style="margin-top:8px">${older.map(reviewBlock).join('')}</div></details>` : ''}</div>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    function bindMilestones(root, detail, reload) {
        root.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-act]');
            if (!b) return;
            const m = detail.milestones.find(x => x.id === Number(b.dataset.id));
            const act = b.dataset.act;
            if (act === 'submit') submitWorkModal(detail, m).then(ok => ok && reload());
            if (act === 'review') reviewModal(detail, m).then(ok => ok && reload());
            if (act === 'edit') milestoneModal(detail, m).then(ok => ok && reload());
            if (act === 'delete' && await App.confirmAction('Remove milestone', `Remove “${esc(m.title)}”? This cannot be undone.`, 'Remove', 'btn-danger')) {
                try {
                    await api(`/milestones/${m.id}`, { method: 'DELETE' });
                    App.toast('Milestone removed');
                    reload();
                } catch (err) { App.toast(err.message, 'error'); }
            }
            if (act === 'add-milestone') milestoneModal(detail).then(ok => ok && reload());
            if (act === 'template' && await App.confirmAction('Apply standard plan',
                'Adds five milestones (literature survey → final report) spread over the next 15 weeks. You can edit any of them afterwards.', 'Apply plan')) {
                try {
                    await api(`/projects/${detail.project.id}/milestones/template`, { method: 'POST' });
                    App.toast('Milestone plan published to the student');
                    reload();
                } catch (err) { App.toast(err.message, 'error'); }
            }
        });
    }

    function milestoneModal(detail, m) {
        return App.modal({
            title: m ? 'Edit milestone' : 'Add milestone',
            submitLabel: m ? 'Save changes' : 'Add milestone',
            body: `<div class="field"><label for="ms-title">Title</label><input class="input" id="ms-title" name="title" required maxlength="150" value="${esc(m?.title)}"></div>
                <div class="field"><label for="ms-desc">What should be delivered</label><textarea class="textarea" id="ms-desc" name="description" maxlength="2000">${esc(m?.description)}</textarea></div>
                <div class="field"><label for="ms-deadline">Deadline</label><input class="input" type="date" id="ms-deadline" name="deadline" required value="${esc(m?.deadline)}" ${m ? '' : `min="${App.todayStr()}"`}></div>`,
            onSubmit: async (v) => {
                if (m) await api(`/milestones/${m.id}`, { method: 'PUT', body: v });
                else await api(`/projects/${detail.project.id}/milestones`, { method: 'POST', body: v });
                App.toast(m ? 'Milestone updated' : 'Milestone added – the student has been notified');
            },
        });
    }

    function submitWorkModal(detail, m) {
        return App.modal({
            title: `Submit work · ${m.title}`,
            submitLabel: 'Upload',
            body: `${m.status === 'REVISION_REQUESTED' && m.reviews[0]?.feedback ? `<div class="callout warning">${icon('rotate')}<div><h3>Revision requested</h3><div class="quote">${esc(m.reviews[0].feedback)}</div></div></div>` : ''}
                <div class="field"><label for="sw-file">File</label><input class="input" type="file" id="sw-file" name="file" required
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.zip,.rar,.7z,.png,.jpg,.jpeg,.mp4">
                    <span class="hint">PDF, Office, ZIP, images or video · up to 25 MB</span></div>
                <div class="field"><label for="sw-comments">Note to your guide <span class="muted">(optional)</span></label><textarea class="textarea" id="sw-comments" name="comments" maxlength="2000" placeholder="What changed, links to a demo or repository…"></textarea></div>`,
            onSubmit: async (v, form) => {
                const fd = new FormData();
                fd.append('projectId', detail.project.id);
                fd.append('milestoneId', m.id);
                fd.append('comments', v.comments || '');
                fd.append('file', form.querySelector('[name=file]').files[0]);
                await api('/submissions', { method: 'POST', body: fd });
                App.toast('Submitted – your guide has been notified');
            },
        });
    }

    function reviewModal(detail, m) {
        const criteria = Object.entries(REVIEW_LABELS).map(([key, label]) => ({ key, label, max: 10 }));
        const latestFiles = m.submissions.slice(0, 3);
        return App.modal({
            title: `Review · ${m.title}`,
            submitLabel: 'Submit review',
            wide: true,
            body: `<div class="ms-section" style="margin:0"><h4>${esc(detail.project.student_name)}'s submission</h4>${latestFiles.map(fileRow).join('') || '<p class="muted">No files</p>'}</div>
                <div class="grid grid-2">
                    <div class="stack-sm"><span class="label">Scores</span>${App.rubric(criteria, 'rv-')}</div>
                    <div class="stack">
                        <div class="field"><span class="label">Decision</span>
                            <div class="choice-group">
                                <label class="choice"><input type="radio" name="decision" value="APPROVED" required><div><strong>Approve</strong><span>Milestone complete</span></div></label>
                                <label class="choice"><input type="radio" name="decision" value="REVISION_REQUESTED"><div><strong>Request revision</strong><span>Student resubmits</span></div></label>
                            </div>
                        </div>
                        <div class="field"><label for="rv-feedback">Feedback</label><textarea class="textarea" id="rv-feedback" name="feedback" rows="5" maxlength="3000" placeholder="Strengths, gaps and what to do next"></textarea>
                            <span class="hint">Required when requesting a revision</span></div>
                    </div>
                </div>`,
            onOpen: (form) => App.bindRubric(form),
            onSubmit: async (v) => {
                if (v.decision === 'REVISION_REQUESTED' && !v.feedback) throw new Error('Add feedback so the student knows what to revise');
                const r = await api(`/milestones/${m.id}/review`, { method: 'POST', body: v });
                App.toast(`${r.message} · ${r.total}/40`);
            },
        });
    }

    async function allocateModal(project) {
        const faculty = await api('/users/faculty');
        const options = faculty.map(f => {
            const load = `${f.active_projects}/${f.max_projects}`;
            const full = f.active_projects >= f.max_projects;
            const pref = f.id === project.preferred_guide_id ? ' ★ preferred' : '';
            const selected = f.id === (project.guide_id || project.preferred_guide_id) ? 'selected' : '';
            return `<option value="${f.id}" ${selected} ${f.id === project.guide_id ? 'disabled' : ''}>${esc(f.name)} — ${load} active${full ? ' (at capacity)' : ''}${pref}${f.expertise ? ` · ${esc(f.expertise)}` : ''}</option>`;
        }).join('');
        return App.modal({
            title: project.guide_id ? 'Reassign guide' : 'Allocate guide',
            submitLabel: project.guide_id ? 'Reassign' : 'Allocate',
            body: `<div><div class="label">${esc(project.title)}</div><div class="muted small">${esc(project.student_name)}${project.preferred_guide_name ? ` · prefers ${esc(project.preferred_guide_name)}` : ''}</div></div>
                <div class="field"><label for="al-fac">Faculty guide</label><select class="select" id="al-fac" name="faculty_id" required><option value="">Select…</option>${options}</select>
                <span class="hint">Load shows active projects / capacity. The guide and student are both notified.</span></div>`,
            onSubmit: async (v) => {
                const r = await api(`/projects/${project.id}/allocate`, { method: 'POST', body: v });
                App.toast(r.message);
            },
        });
    }

    /** The single most useful next step for this viewer, as a callout (or ''). */
    function nextStep(detail, user) {
        const { project: p, permissions: perm, milestones, evaluation } = detail;
        const latest = detail.proposals[0];
        const c = (cls, ic, title, text, action = '') => `<div class="callout ${cls}">${icon(ic)}<div class="grow"><h3>${title}</h3>${text ? `<div class="ink-2">${text}</div>` : ''}${action ? `<div class="actions row">${action}</div>` : ''}</div></div>`;

        if (user.role === 'STUDENT') {
            switch (p.status) {
                case 'PROPOSAL_SUBMITTED':
                    return c('blue', 'clock', 'Proposal under review', `${esc(p.guide_name || p.preferred_guide_name || 'The project coordinator')} will review it. You can still edit it until then.`,
                        '<a class="btn btn-sm" href="proposal.html">Edit proposal</a>');
                case 'CHANGES_REQUESTED':
                    return c('warning', 'edit', 'Changes requested on your proposal', `<div class="quote">${esc(latest?.feedback)}</div>`,
                        '<a class="btn btn-sm btn-primary" href="proposal.html">Revise and resubmit</a>');
                case 'REJECTED':
                    return c('critical', 'x', 'Proposal not approved', `<div class="quote">${esc(latest?.feedback)}</div>`,
                        '<a class="btn btn-sm btn-primary" href="proposal.html">Submit a new proposal</a>');
                case 'APPROVED':
                    return c('blue', 'link', 'Proposal approved – awaiting guide allocation', 'The project coordinator will allocate your guide shortly.');
                case 'IN_PROGRESS': {
                    const revise = milestones.find(m => m.status === 'REVISION_REQUESTED');
                    const overdue = milestones.find(m => m.overdue);
                    if (overdue) return c('critical', 'alert', `“${esc(overdue.title)}” is ${due(overdue.deadline)}`, 'Submit your work as soon as possible – your guide can see that it is late.',
                        `<a class="btn btn-sm btn-primary" href="${link(p.id, 'milestones')}">Go to milestone</a>`);
                    if (revise) return c('warning', 'rotate', `Revision requested on “${esc(revise.title)}”`, `<div class="quote">${esc(revise.reviews[0]?.feedback)}</div>`,
                        `<a class="btn btn-sm btn-primary" href="${link(p.id, 'milestones')}">Resubmit</a>`);
                    if (perm.canFinalSubmit) return c('good', 'send', 'Ready for final submission', 'All milestones are approved and your final report is uploaded.',
                        '<button class="btn btn-sm btn-good" data-final-submit>Make final submission</button>');
                    if (!milestones.length) return c('blue', 'info', 'Waiting for your milestone plan', `${esc(p.guide_name)} will set milestones and deadlines.`);
                    const allApproved = milestones.every(m => m.status === 'APPROVED');
                    if (allApproved) return c('blue', 'file', 'Upload your final report', 'Every milestone is approved. Upload the final report under Documents, then make your final submission.',
                        `<a class="btn btn-sm btn-primary" href="${link(p.id, 'documents')}">Go to documents</a>`);
                    const next = milestones.find(m => m.status === 'PENDING');
                    if (next) return c('blue', 'flag', `Next up: ${esc(next.title)}`, `Due ${date(next.deadline)} (${due(next.deadline)}).`);
                    return '';
                }
                case 'FINAL_SUBMISSION':
                    return c('blue', 'award', 'Final submission received', `${esc(p.guide_name)} will complete your final evaluation.`);
                case 'COMPLETED':
                    return c('good', 'award', `Project completed – ${evaluation.total_score}/100, grade ${esc(evaluation.grade)}`, 'Congratulations! See the Evaluation tab for the full breakdown.');
            }
            return '';
        }

        if (perm.canReviewProposal) return c('blue', 'file', `Proposal v${latest.version} is waiting for your decision`, `Submitted ${App.ago(latest.submitted_at)}.`,
            `<a class="btn btn-sm btn-primary" href="${link(p.id, 'proposal')}">Review proposal</a>`);
        if (perm.canAllocate && p.status === 'APPROVED') return c('blue', 'link', 'Approved – needs a guide', p.preferred_guide_name ? `The student prefers ${esc(p.preferred_guide_name)}.` : '',
            '<button class="btn btn-sm btn-primary" data-allocate>Allocate guide</button>');
        const waiting = milestones.filter(m => m.status === 'SUBMITTED');
        if (perm.canReviewMilestones && waiting.length) return c('blue', 'checkSquare', `${waiting.length} submission${waiting.length > 1 ? 's' : ''} awaiting your review`, waiting.map(m => esc(m.title)).join(', '),
            `<a class="btn btn-sm btn-primary" href="${link(p.id, 'milestones')}">Review now</a>`);
        if (perm.canEvaluate) return c('blue', 'award', 'Ready for final evaluation', `Final submission made ${App.ago(p.final_submitted_at)}.`,
            `<a class="btn btn-sm btn-primary" href="${link(p.id, 'evaluation')}">Evaluate</a>`);
        if (perm.canManageMilestones && !milestones.length) return c('blue', 'flag', 'Set the milestone plan', 'The student cannot submit work until milestones are defined.',
            `<a class="btn btn-sm btn-primary" href="${link(p.id, 'milestones')}">Add milestones</a>`);
        if (detail.health === 'DELAYED') {
            const late = milestones.filter(m => m.overdue);
            return c('critical', 'alert', 'Project is behind schedule', late.map(m => `“${esc(m.title)}” ${due(m.deadline)}`).join('<br>'));
        }
        return '';
    }

    async function finalSubmit(detail) {
        const ok = await App.confirmAction('Make final submission',
            'This sends your project for final evaluation. You will not be able to submit milestone work after this.', 'Submit for evaluation', 'btn-good');
        if (!ok) return false;
        try {
            const r = await api(`/projects/${detail.project.id}/final-submit`, { method: 'POST' });
            App.toast(r.message);
            return true;
        } catch (e) {
            App.toast(e.message, 'error');
            return false;
        }
    }

    window.ProjectUI = {
        REVIEW_LABELS, EVAL_LABELS, link, fileRow, reviewBlock, milestoneList, bindMilestones,
        milestoneModal, submitWorkModal, reviewModal, allocateModal, nextStep, finalSubmit,
    };
})();
