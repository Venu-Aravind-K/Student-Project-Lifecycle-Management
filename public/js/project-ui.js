/* Project building blocks shared by the project page, dashboards and queues. */
(function () {
    const { api, esc, icon, date, shortDate, due, empty } = App;

    const REVIEW_CRITERIA = [
        { key: 'technical', label: 'Technical quality', hint: 'Is the work technically correct and well built?', max: 10 },
        { key: 'progress', label: 'Progress', hint: 'Did they deliver what this milestone asked for?', max: 10 },
        { key: 'documentation', label: 'Documentation', hint: 'Is the write-up clear and complete?', max: 10 },
        { key: 'presentation', label: 'Presentation', hint: 'How well did they explain or demo it?', max: 10 },
    ];
    const EVAL_CRITERIA = [
        { key: 'technical', label: 'Technical depth', hint: 'Difficulty and correctness of the technical work', max: 20 },
        { key: 'implementation', label: 'Implementation', hint: 'Quality and completeness of what was built', max: 20 },
        { key: 'innovation', label: 'Innovation', hint: 'Originality of the idea or approach', max: 15 },
        { key: 'documentation', label: 'Report & documentation', hint: 'Clarity and completeness of the final report', max: 15 },
        { key: 'presentation', label: 'Presentation', hint: 'Final presentation and demo', max: 15 },
        { key: 'viva', label: 'Viva', hint: 'Answers to questions about the project', max: 15 },
    ];
    const gradeFor = (t) => (t >= 90 ? 'O' : t >= 80 ? 'A+' : t >= 70 ? 'A' : t >= 60 ? 'B+' : t >= 50 ? 'B' : t >= 40 ? 'C' : 'F');
    const link = (id, tab) => `project-details.html?id=${id}${tab ? `#${tab}` : ''}`;
    const isStudent = (u) => u.role === 'STUDENT';

    // ---- Journey -------------------------------------------------------------------
    const STEPS = ['Proposal', 'Approval', 'Guide assigned', 'Milestones', 'Final submission', 'Graded'];
    const CURRENT = { PROPOSAL_SUBMITTED: 1, CHANGES_REQUESTED: 1, REJECTED: 1, APPROVED: 2, IN_PROGRESS: 3, FINAL_SUBMISSION: 5, COMPLETED: 6 };

    function captionFor(detail, user) {
        const p = detail.project;
        const me = isStudent(user);
        const done = detail.milestones.filter(m => m.status === 'APPROVED').length;
        const total = detail.milestones.length;
        const step = Math.min(CURRENT[p.status] + 1, 6);
        const head = p.status === 'COMPLETED' ? '<b>All six steps are complete.</b>' : `<b>Step ${step} of 6 · ${STEPS[step - 1]}.</b>`;
        const text = {
            PROPOSAL_SUBMITTED: me ? 'Your proposal has been sent. You’ll get a notification when it is approved or if changes are needed.'
                : 'The proposal is waiting for a decision: approve it, ask for changes, or reject it.',
            CHANGES_REQUESTED: me ? 'The reviewer asked for some changes. Edit your proposal and send it again.'
                : 'The student is revising the proposal based on the feedback.',
            REJECTED: me ? 'This idea was not approved. Read the feedback and submit a new proposal.' : 'The proposal was rejected. The student can submit a new one.',
            APPROVED: me ? 'Your proposal is approved! The coordinator is now assigning your faculty guide.' : 'Approved. A faculty guide needs to be assigned before work can start.',
            IN_PROGRESS: total
                ? (me ? `Upload your work for each milestone before its deadline. Your guide reviews each one. ${done} of ${total} done so far.`
                    : `The student uploads work for each milestone and the guide reviews it. ${done} of ${total} done.`)
                : (me ? 'Your guide will add milestones (checkpoints with deadlines) here soon.' : 'The guide needs to add milestones so the student knows what to deliver and when.'),
            FINAL_SUBMISSION: me ? 'You have submitted your project. Your guide will now give the final grade.' : 'The student has submitted the final project. It is ready to be graded.',
            COMPLETED: detail.evaluation ? `Final score <b>${detail.evaluation.total_score}/100</b>, grade <b>${esc(detail.evaluation.grade)}</b>.` : '',
        }[p.status];
        return `${head} ${text}`;
    }

    function journey(detail, user) {
        const p = detail.project;
        const cur = CURRENT[p.status];
        const done = detail.milestones.filter(m => m.status === 'APPROVED').length;
        const problem = p.status === 'CHANGES_REQUESTED' ? 'warn' : p.status === 'REJECTED' ? 'bad' : '';
        const steps = STEPS.map((label, i) => {
            let cls = i < cur ? 'done' : i === cur ? 'current' : '';
            let sub = '';
            if (i === cur && problem) { cls = `problem ${problem}`; sub = p.status === 'REJECTED' ? 'Not approved' : 'Needs changes'; }
            if (i === 3 && detail.milestones.length && i <= cur) sub = `${done} of ${detail.milestones.length} done`;
            if (i === 5 && detail.evaluation) sub = `Grade ${esc(detail.evaluation.grade)}`;
            const mark = cls === 'done' ? icon('check') : cls.startsWith('problem') ? icon(problem === 'bad' ? 'x' : 'pen') : i + 1;
            return `<li class="j-step ${cls}" ${i === cur ? 'aria-current="step"' : ''}>
                <span class="j-dot">${mark}</span><span class="j-label">${label}</span>
                ${sub ? `<span class="j-sub">${sub}</span>` : ''}${i === cur ? `<span class="j-here">${isStudent(user) ? 'You are here' : 'Now'}</span>` : ''}
            </li>`;
        }).join('');
        return `<div class="card card-pad"><ol class="journey" aria-label="Project steps">${steps}</ol>
            <div class="journey-caption">${icon('info')}<div>${captionFor(detail, user)}</div></div></div>`;
    }

    // ---- Next step -------------------------------------------------------------------
    function nextCard(tone, ic, label, title, text, actions = '') {
        return `<section class="next ${tone}" aria-label="Your next step">
            <div class="next-icon">${icon(ic)}</div>
            <div class="grow"><div class="next-label">${label}</div><h2>${title}</h2>${text ? `<div class="ink-2" style="margin-top:4px">${text}</div>` : ''}</div>
            ${actions ? `<div class="next-actions">${actions}</div>` : ''}
        </section>`;
    }

    /** The single most important thing for this person to do (or know) about this project. */
    function nextStep(detail, user) {
        const { project: p, permissions: perm, milestones, evaluation } = detail;
        const latest = detail.proposals[0];
        const L = isStudent(user) ? 'Your next step' : 'Next step';
        const go = (tab, label, cls = 'btn-primary') => `<a class="btn btn-lg ${cls}" href="${link(p.id, tab)}" data-goto="${tab}">${label}${icon('arrowRight')}</a>`;

        if (isStudent(user)) {
            switch (p.status) {
                case 'PROPOSAL_SUBMITTED':
                    return nextCard('neutral', 'hourglass', 'Nothing to do right now', 'Your proposal is being reviewed',
                        `${esc(p.guide_name || p.preferred_guide_name || 'The coordinator')} will read it. You can still make edits until then.`,
                        '<a class="btn btn-lg" href="proposal.html">Edit proposal</a>');
                case 'CHANGES_REQUESTED':
                    return nextCard('warn', 'pen', L, 'Update your proposal and send it again',
                        `<div class="quote">${esc(latest?.feedback)}</div><div class="small muted" style="margin-top:6px">— ${esc(latest?.reviewer_name || 'Reviewer')}</div>`,
                        '<a class="btn btn-lg btn-primary" href="proposal.html">Edit proposal</a>');
                case 'REJECTED':
                    return nextCard('bad', 'x2', L, 'Submit a new project idea',
                        `<div class="quote">${esc(latest?.feedback)}</div>`, '<a class="btn btn-lg btn-primary" href="proposal.html">Write new proposal</a>');
                case 'APPROVED':
                    return nextCard('violet', 'link', 'Nothing to do right now', 'Your proposal is approved 🎉', 'The coordinator is assigning your faculty guide. You’ll be notified.');
                case 'IN_PROGRESS': {
                    const overdue = milestones.find(m => m.overdue);
                    const revise = milestones.find(m => m.status === 'REVISION_REQUESTED');
                    const target = overdue || revise || milestones.find(m => m.status === 'PENDING');
                    if (perm.canFinalSubmit) return nextCard('good', 'send', L, 'Submit your project for final grading',
                        'All milestones are done and your final report is uploaded.', '<button class="btn btn-lg btn-good" data-action="final-submit">Submit project</button>');
                    if (!milestones.length) return nextCard('neutral', 'calendar', 'Nothing to do right now', 'Waiting for your milestone plan',
                        `${esc(p.guide_name)} will add milestones (checkpoints with deadlines) soon.`);
                    if (overdue) return nextCard('bad', 'alert', L, `Upload your work for “${esc(overdue.title)}”`,
                        `This was due ${date(overdue.deadline)} and is now <b>${due(overdue.deadline)}</b>.`,
                        `<button class="btn btn-lg btn-primary" data-action="submit" data-id="${overdue.id}">${icon('upload')}Upload work</button>`);
                    if (revise) return nextCard('warn', 'refresh', L, `Fix and re-upload “${esc(revise.title)}”`,
                        `<div class="quote">${esc(revise.reviews[0]?.feedback)}</div>`,
                        `<button class="btn btn-lg btn-primary" data-action="submit" data-id="${revise.id}">${icon('upload')}Upload new version</button>`);
                    if (target) return nextCard('', 'upload', L, `Upload your work for “${esc(target.title)}”`,
                        `${due(target.deadline)} · ${date(target.deadline)}${target.description ? ` — ${esc(target.description)}` : ''}`,
                        `<button class="btn btn-lg btn-primary" data-action="submit" data-id="${target.id}">${icon('upload')}Upload work</button>`);
                    if (milestones.every(m => m.status === 'APPROVED')) return nextCard('', 'file', L, 'Upload your final project report',
                        'Every milestone is done. Add your final report under Files, then submit your project for grading.', go('files', 'Go to files'));
                    return nextCard('neutral', 'hourglass', 'Nothing to do right now', 'Your work is being reviewed',
                        `${esc(p.guide_name)} is reviewing what you uploaded. You’ll be notified when it’s done.`);
                }
                case 'FINAL_SUBMISSION':
                    return nextCard('violet', 'award', 'Nothing to do right now', 'Waiting for your final grade', `${esc(p.guide_name)} is grading your project.`);
                case 'COMPLETED':
                    return nextCard('good', 'award', 'Project complete', `You scored ${evaluation.total_score}/100 — grade ${esc(evaluation.grade)}`,
                        'Congratulations! See the full breakdown under Grade.', go('grade', 'See grade', ''));
            }
            return '';
        }

        // Faculty / admin
        if (perm.canReviewProposal) return nextCard('', 'file', L, 'Read this proposal and decide', `Sent ${App.ago(latest.submitted_at)}. Approve it, ask for changes, or reject it.`, go('proposal', 'Read & decide'));
        if (perm.canAllocate && p.status === 'APPROVED') return nextCard('violet', 'link', L, 'Assign a faculty guide',
            p.preferred_guide_name ? `The student would like ${esc(p.preferred_guide_name)}.` : 'The student has no preference.', '<button class="btn btn-lg btn-primary" data-action="allocate">Assign guide</button>');
        const waiting = milestones.filter(m => m.status === 'SUBMITTED');
        if (perm.canReviewMilestones && waiting.length) return nextCard('', 'clipboard', L, `Review “${esc(waiting[0].title)}”`,
            `${esc(p.student_name)} uploaded work ${App.ago(waiting[0].submissions[0]?.submitted_at)}.${waiting.length > 1 ? ` ${waiting.length - 1} more waiting.` : ''}`,
            `<button class="btn btn-lg btn-primary" data-action="review" data-id="${waiting[0].id}">Review work</button>`);
        if (perm.canEvaluate) return nextCard('violet', 'award', L, 'Give the final grade', `${esc(p.student_name)} submitted the project ${App.ago(p.final_submitted_at)}.`, go('grade', 'Grade project'));
        if (perm.canManageMilestones && !milestones.length) return nextCard('', 'calendar', L, 'Set up milestones',
            'The student can’t upload anything until there are milestones. Use the standard 5-step plan or add your own.',
            '<button class="btn btn-lg btn-primary" data-action="template">Use standard plan</button><button class="btn btn-lg" data-action="add-milestone">Add one</button>');
        const late = milestones.filter(m => m.overdue);
        if (late.length) return nextCard('bad', 'alert', 'Heads up', 'This project is behind schedule',
            late.map(m => `“${esc(m.title)}” is ${due(m.deadline)}`).join('<br>'));
        if (p.status === 'IN_PROGRESS') return nextCard('neutral', 'checkCircle', 'Nothing to do right now', 'Waiting for the student',
            `${esc(p.student_name)} is working on the next milestone.`);
        return '';
    }

    // ---- Milestones ------------------------------------------------------------------
    function fileItem(f) {
        return `<a class="file" href="${esc(f.download_url)}" style="text-decoration:none">
            <span class="file-icon">${icon('file')}</span>
            <div class="grow"><div class="file-name truncate">${esc(f.file_name)}</div>
                <div class="file-meta">${App.size(f.file_size)} · uploaded ${App.ago(f.submitted_at)}${f.uploaded_by_role === 'STUDENT' ? '' : ` by ${esc(f.uploaded_by_name)}`}${f.comments ? ` · “${esc(f.comments)}”` : ''}</div></div>
            <span class="btn btn-sm btn-ghost">${icon('download')}Download</span></a>`;
    }

    function feedbackItem(r) {
        const ok = r.decision === 'APPROVED';
        return `<div class="feedback">
            <div class="spread"><div class="row">${App.pill(ok ? ['good', 'check', 'Approved'] : ['warn', 'refresh', 'Changes requested'])}<span class="big-score">${r.total_score} / 40</span></div>
                <span class="small muted">${esc(r.reviewer_name)} · ${shortDate(r.reviewed_at)}</span></div>
            <div class="score-line">${REVIEW_CRITERIA.map(c => `<span>${c.label} <b>${r[`${c.key}_score`]}</b>/10</span>`).join('')}</div>
            ${r.feedback ? `<div class="quote">${esc(r.feedback)}</div>` : ''}
        </div>`;
    }

    function markFor(m, i) {
        if (m.status === 'APPROVED') return `<span class="ms-mark done">${icon('check')}</span>`;
        if (m.overdue) return `<span class="ms-mark late">${icon('alert')}</span>`;
        if (m.status === 'SUBMITTED') return `<span class="ms-mark review">${icon('hourglass')}</span>`;
        if (m.status === 'REVISION_REQUESTED') return `<span class="ms-mark fix">${icon('refresh')}</span>`;
        return `<span class="ms-mark">${i + 1}</span>`;
    }

    function milestoneList(detail, user) {
        const { milestones, permissions: perm } = detail;
        if (!milestones.length) {
            return empty('calendar', 'No milestones yet', perm.canManageMilestones
                ? 'Milestones are checkpoints with deadlines. Start with the standard 5-step plan and adjust the dates, or add your own.'
                : 'Your guide will add milestones (checkpoints with deadlines) here.',
                perm.canManageMilestones ? '<button class="btn btn-primary" data-action="template">Use standard plan</button><button class="btn" data-action="add-milestone">Add milestone</button>' : '');
        }
        // Only the milestone the student should work on next gets a primary button
        const nextId = (milestones.find(m => m.overdue) || milestones.find(m => m.status === 'REVISION_REQUESTED') || milestones.find(m => m.status === 'PENDING'))?.id;
        return milestones.map((m, i) => {
            let action = '';
            if (perm.canSubmitWork && m.status !== 'APPROVED') {
                action = m.status === 'SUBMITTED'
                    ? `<button class="btn btn-sm" data-action="submit" data-id="${m.id}">Replace file</button>`
                    : `<button class="btn btn-sm ${m.id === nextId ? 'btn-primary' : ''}" data-action="submit" data-id="${m.id}">${icon('upload')}${m.status === 'REVISION_REQUESTED' ? 'Upload new version' : 'Upload work'}</button>`;
            }
            if (perm.canReviewMilestones && m.status === 'SUBMITTED') action = `<button class="btn btn-sm btn-primary" data-action="review" data-id="${m.id}">Review work</button>`;
            const [latest, ...older] = m.reviews;
            const open = (isStudent(user) && m.status === 'REVISION_REQUESTED') ? 'open' : '';
            const dueText = m.status === 'APPROVED' ? `Done · was due ${shortDate(m.deadline)}` : `${due(m.deadline)} · ${date(m.deadline)}`;
            return `<div class="ms ${open}" id="milestone-${m.id}">
                <div class="ms-head" data-toggle role="button" tabindex="0" aria-expanded="${!!open}">
                    ${markFor(m, i)}
                    <div class="grow"><div class="ms-title">${esc(m.title)}</div><div class="ms-due ${m.overdue ? 'late' : ''}">${dueText}</div></div>
                    <div class="ms-side">${App.milestonePill(m)}${action}<span class="ms-chevron">${icon('chevronDown')}</span></div>
                </div>
                <div class="ms-body">
                    ${m.description ? `<p class="ink-2">${esc(m.description)}</p>` : ''}
                    <div><div class="detail-label">Uploaded work</div>${m.submissions.length ? m.submissions.map(fileItem).join('') : '<p class="muted small">Nothing uploaded yet.</p>'}</div>
                    ${latest ? `<div><div class="detail-label">Guide’s feedback</div>${feedbackItem(latest)}
                        ${older.length ? `<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Earlier feedback (${older.length})</summary><div style="margin-top:10px">${older.map(feedbackItem).join('')}</div></details>` : ''}</div>` : ''}
                    ${perm.canManageMilestones && m.status !== 'APPROVED' ? `<div class="row"><button class="btn btn-sm" data-action="edit" data-id="${m.id}">${icon('pen')}Edit</button>
                        ${!m.submissions.length ? `<button class="btn btn-sm btn-ghost" data-action="delete" data-id="${m.id}">${icon('trash')}Remove</button>` : ''}</div>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    /**
     * One click handler for every project action inside `root`:
     * submit, review, edit, delete, add-milestone, template, final-submit, allocate, toggle.
     */
    function bindActions(root, detail, reload, { onGoto } = {}) {
        root.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-toggle]')) { e.preventDefault(); e.target.click(); }
        });
        root.addEventListener('click', async (e) => {
            const goto = e.target.closest('[data-goto]');
            if (goto && onGoto) { e.preventDefault(); onGoto(goto.dataset.goto); return; }
            const b = e.target.closest('[data-action]');
            if (!b) {
                const t = e.target.closest('[data-toggle]');
                if (t) { const ms = t.closest('.ms'); ms.classList.toggle('open'); t.setAttribute('aria-expanded', ms.classList.contains('open')); }
                return;
            }
            e.stopPropagation();
            const m = detail.milestones.find(x => x.id === Number(b.dataset.id));
            const done = (ok) => ok && reload();
            switch (b.dataset.action) {
                case 'submit': return done(await submitWorkModal(detail, m));
                case 'review': return done(await reviewModal(detail, m));
                case 'edit': return done(await milestoneModal(detail, m));
                case 'add-milestone': return done(await milestoneModal(detail));
                case 'allocate': return done(await allocateModal(detail.project));
                case 'final-submit': return done(await finalSubmit(detail));
                case 'delete':
                    if (!await App.confirmAction('Remove milestone?', `“${esc(m.title)}” will be removed. This can’t be undone.`, 'Remove', 'btn-danger')) return;
                    try { await api(`/milestones/${m.id}`, { method: 'DELETE' }); App.toast('Milestone removed'); reload(); } catch (err) { App.toast(err.message, 'error'); }
                    return;
                case 'template':
                    if (!await App.confirmAction('Use the standard plan?',
                        'Adds five milestones spread over the next 15 weeks: Literature survey → Requirements & design → Implementation → Testing → Final report. You can change any of them afterwards.', 'Add 5 milestones')) return;
                    try { await api(`/projects/${detail.project.id}/milestones/template`, { method: 'POST' }); App.toast('Milestones added — the student has been notified'); reload(); } catch (err) { App.toast(err.message, 'error'); }
            }
        });
    }

    // ---- Dialogs -----------------------------------------------------------------------
    function milestoneModal(detail, m) {
        return App.modal({
            title: m ? 'Edit milestone' : 'Add a milestone',
            subtitle: 'A milestone is a checkpoint: something the student must deliver by a date.',
            submitLabel: m ? 'Save changes' : 'Add milestone',
            body: `<div class="field"><label for="ms-title">What is it called?</label><input class="input" id="ms-title" name="title" required maxlength="150" placeholder="e.g. Working prototype" value="${esc(m?.title)}"></div>
                <div class="field"><label for="ms-desc">What should the student deliver? <span class="optional">(optional)</span></label><textarea class="textarea" id="ms-desc" name="description" maxlength="2000" placeholder="e.g. A demo video and a 2-page report">${esc(m?.description)}</textarea></div>
                <div class="field"><label for="ms-deadline">Deadline</label><input class="input" type="date" id="ms-deadline" name="deadline" required value="${esc(m?.deadline)}" ${m ? '' : `min="${App.todayStr()}"`}></div>`,
            onSubmit: async (v) => {
                if (m) await api(`/milestones/${m.id}`, { method: 'PUT', body: v });
                else await api(`/projects/${detail.project.id}/milestones`, { method: 'POST', body: v });
                App.toast(m ? 'Milestone updated' : 'Milestone added — the student has been notified');
            },
        });
    }

    function submitWorkModal(detail, m) {
        const fb = m.status === 'REVISION_REQUESTED' ? m.reviews[0]?.feedback : '';
        return App.modal({
            title: `Upload work`,
            subtitle: `For milestone <b>${esc(m.title)}</b> · ${due(m.deadline)}`,
            submitLabel: 'Upload',
            body: `${fb ? `<div class="feedback"><div class="detail-label">What your guide asked you to change</div><div class="quote">${esc(fb)}</div></div>` : ''}
                <div class="field"><label for="sw-file">Choose a file</label><input class="input" type="file" id="sw-file" name="file" required
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.zip,.rar,.7z,.png,.jpg,.jpeg,.mp4">
                    <span class="help">PDF, Word, PowerPoint, ZIP, images or video — up to 25 MB.</span></div>
                <div class="field"><label for="sw-note">Message to your guide <span class="optional">(optional)</span></label>
                    <textarea class="textarea" id="sw-note" name="comments" maxlength="2000" placeholder="What did you do? Any links to a demo or code repository?"></textarea></div>`,
            onSubmit: async (v, form) => {
                const fd = new FormData();
                fd.append('projectId', detail.project.id);
                fd.append('milestoneId', m.id);
                fd.append('comments', v.comments || '');
                fd.append('file', form.querySelector('[name=file]').files[0]);
                await api('/submissions', { method: 'POST', body: fd });
                App.toast('Uploaded — your guide has been notified');
            },
        });
    }

    function reviewModal(detail, m) {
        let check;
        return App.modal({
            title: `Review: ${m.title}`,
            subtitle: `${esc(detail.project.student_name)} · ${esc(detail.project.title)}`,
            submitLabel: 'Send review',
            wide: true,
            body: `<div><div class="detail-label">1 · Look at the uploaded work</div>${m.submissions.slice(0, 3).map(fileItem).join('') || '<p class="muted">No files.</p>'}</div>
                <div class="grid cols-2" style="align-items:start">
                    <div><div class="detail-label">2 · Score it (drag each slider)</div>${App.scoreSliders(REVIEW_CRITERIA, 'rv')}</div>
                    <div class="stack-md">
                        <div class="detail-label">3 · Decide</div>
                        <label class="option good"><input type="radio" name="decision" value="APPROVED"><div><strong>Approve</strong><span>This milestone is done.</span></div></label>
                        <label class="option warn"><input type="radio" name="decision" value="REVISION_REQUESTED"><div><strong>Ask for changes</strong><span>The student fixes it and uploads again.</span></div></label>
                        <div class="field"><label for="rv-fb">Feedback for the student</label>
                            <textarea class="textarea" id="rv-fb" name="feedback" rows="5" maxlength="3000" placeholder="What was good? What should they improve?"></textarea>
                            <span class="help">Required if you ask for changes.</span></div>
                    </div>
                </div>`,
            onOpen: (form) => { check = App.bindScores(form); },
            onSubmit: async (v) => {
                check();
                if (!v.decision) throw new Error('Choose Approve or Ask for changes');
                if (v.decision === 'REVISION_REQUESTED' && !v.feedback) throw new Error('Tell the student what to change');
                const r = await api(`/milestones/${m.id}/review`, { method: 'POST', body: v });
                App.toast(`${r.message} · ${r.total}/40`);
                App.refreshCounts();
            },
        });
    }

    async function allocateModal(project) {
        const faculty = await api('/users/faculty');
        const options = faculty.map(f => {
            const free = f.max_projects - f.active_projects;
            const pref = f.id === project.preferred_guide_id;
            const checked = f.id === (project.guide_id ? null : project.preferred_guide_id) ? 'checked' : '';
            return `<label class="option" ${f.id === project.guide_id ? 'style="opacity:.5"' : ''}>
                <input type="radio" name="faculty_id" value="${f.id}" ${checked} ${f.id === project.guide_id ? 'disabled' : ''} required>
                <div><strong>${esc(f.name)}${pref ? ' <span class="pill sm primary">Student’s choice</span>' : ''}${f.id === project.guide_id ? ' <span class="pill sm">Current guide</span>' : ''}</strong>
                <span>${esc(f.expertise || f.department || '')}</span>
                <span>${free > 0 ? `${App.plural(free, 'free slot')} (${f.active_projects}/${f.max_projects} used)` : `<b style="color:var(--warn-ink)">Full</b> (${f.active_projects}/${f.max_projects})`}</span></div></label>`;
        }).join('');
        return App.modal({
            title: project.guide_id ? 'Change guide' : 'Assign a guide',
            subtitle: `${esc(project.title)} · ${esc(project.student_name)}`,
            submitLabel: project.guide_id ? 'Change guide' : 'Assign guide',
            body: `<div class="options" style="grid-template-columns:1fr 1fr">${options}</div><p class="help small muted">The guide and the student will both be notified.</p>`,
            onSubmit: async (v) => {
                if (!v.faculty_id) throw new Error('Choose a guide');
                const r = await api(`/projects/${project.id}/allocate`, { method: 'POST', body: v });
                App.toast(r.message);
                App.refreshCounts();
            },
        });
    }

    async function finalSubmit(detail) {
        const ok = await App.confirmAction('Submit your project for grading?',
            'Your guide will give the final grade. After this you can’t upload milestone work any more.', 'Submit project', 'btn-good');
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
        REVIEW_CRITERIA, EVAL_CRITERIA, gradeFor, link, journey, nextStep, milestoneList, bindActions,
        fileItem, feedbackItem, milestoneModal, submitWorkModal, reviewModal, allocateModal, finalSubmit,
    };
})();
