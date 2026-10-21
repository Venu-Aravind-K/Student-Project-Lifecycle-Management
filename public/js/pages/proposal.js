const { api, esc, icon } = App;

App.page({ roles: ['STUDENT'], nav: 'proposal', title: 'Project Proposal' }, async (user, content) => {
    const [{ detail }, faculty] = await Promise.all([api('/dashboard/student'), api('/users/faculty')]);
    const p = detail?.project;
    const latest = detail?.proposals[0];

    if (p && !detail.permissions.canEditProposal) {
        content.innerHTML = `
            <div class="page-head"><div><h1>Project proposal</h1><p>${esc(p.title)}</p></div></div>
            <div class="card"><div class="card-body stack">
                <div class="callout good">${icon('check')}<div><h3>Your proposal was approved</h3><p class="ink-2">The project is now ${esc(p.status_label.toLowerCase())}. Approved proposals can no longer be edited.</p></div></div>
                <div class="row"><a class="btn btn-primary" href="project-details.html#proposal">View approved proposal</a><a class="btn" href="student-dashboard.html">Back to dashboard</a></div>
            </div></div>`;
        return;
    }

    const mode = !p ? 'new' : p.status === 'PROPOSAL_SUBMITTED' ? 'edit' : p.status === 'REJECTED' ? 'fresh' : 'revise';
    const heading = { new: 'Submit a project proposal', edit: 'Edit your pending proposal', revise: `Revise proposal (v${(latest?.version || 0) + 1})`, fresh: 'Submit a new proposal' }[mode];
    const intro = {
        new: 'Your proposal is reviewed by your preferred guide or the project coordinator.',
        edit: 'Not reviewed yet – changes replace the version currently under review.',
        revise: 'Address the reviewer’s feedback below. The previous version stays in your history.',
        fresh: 'Your previous proposal was not approved. Submit a new idea – the old one stays in your history.',
    }[mode];

    // Prefill: latest proposal when revising/editing, otherwise a locally saved draft
    const DRAFT_KEY = `proposal-draft-${user.id}`;
    let prefill = mode === 'edit' || mode === 'revise' ? latest : {};
    if (mode === 'new' || mode === 'fresh') {
        try { prefill = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch { prefill = {}; }
    }
    const preferred = Number(prefill.preferred_guide_id ?? p?.preferred_guide_id) || null;
    const val = (k) => esc(prefill?.[k] ?? '');

    const guideChoices = [
        `<label class="choice"><input type="radio" name="preferred_guide_id" value="" ${!preferred ? 'checked' : ''}><div><strong>No preference</strong><span>Coordinator decides</span></div></label>`,
        ...faculty.map(f => {
            const full = f.active_projects >= f.max_projects;
            return `<label class="choice"><input type="radio" name="preferred_guide_id" value="${f.id}" ${preferred === f.id ? 'checked' : ''}><div><strong>${esc(f.name)}</strong>
                <span>${esc(f.expertise || f.department || '')}</span><span style="display:block">${full ? 'At capacity' : `${f.max_projects - f.active_projects} slot${f.max_projects - f.active_projects === 1 ? '' : 's'} open`}</span></div></label>`;
        }),
    ].join('');

    content.innerHTML = `
        <div class="page-head"><div><h1>${heading}</h1><p>${intro}</p></div></div>
        <div class="grid grid-main">
            <form class="card" id="proposal-form" novalidate><div class="card-body stack">
                ${latest && (mode === 'revise' || mode === 'fresh') ? `<div class="callout ${mode === 'fresh' ? 'critical' : 'warning'}">${icon(mode === 'fresh' ? 'x' : 'edit')}<div><h3>Feedback from ${esc(latest.reviewer_name || 'reviewer')}</h3><div class="quote">${esc(latest.feedback)}</div></div></div>` : ''}
                <div class="form-grid">
                    <div class="field full"><label for="title">Project title</label><input class="input" id="title" name="title" required maxlength="200" value="${val('title')}"></div>
                    <div class="field"><label for="domain">Domain</label><input class="input" id="domain" name="domain" maxlength="100" placeholder="e.g. Machine Learning" value="${val('domain')}" list="domains">
                        <datalist id="domains">${['Machine Learning', 'Computer Vision', 'Internet of Things', 'Web Development', 'Mobile Computing', 'Blockchain', 'Cloud Computing', 'Cyber Security', 'Data Science'].map(d => `<option value="${d}">`).join('')}</datalist></div>
                    <div class="field"><label for="technologies">Technologies</label><input class="input" id="technologies" name="technologies" required maxlength="500" placeholder="e.g. Python, React, PostgreSQL" value="${val('technologies')}"><span class="hint">Comma separated</span></div>
                    <div class="field full"><label for="problem_statement">Problem statement</label><textarea class="textarea" id="problem_statement" name="problem_statement" required rows="4" placeholder="What problem are you solving, and for whom?">${val('problem_statement')}</textarea></div>
                    <div class="field full"><label for="objectives">Objectives</label><textarea class="textarea" id="objectives" name="objectives" required rows="4" placeholder="Specific, measurable goals – one per line">${val('objectives')}</textarea></div>
                    <div class="field full"><label for="methodology">Methodology</label><textarea class="textarea" id="methodology" name="methodology" required rows="4" placeholder="How you will build and evaluate it">${val('methodology')}</textarea></div>
                    <div class="field full"><label for="expected_outcome">Expected outcome <span class="muted">(optional)</span></label><textarea class="textarea" id="expected_outcome" name="expected_outcome" rows="3">${val('expected_outcome')}</textarea></div>
                    <div class="field full"><span class="label">Preferred guide</span><div class="choice-group">${guideChoices}</div>
                        <span class="hint">Your preferred guide can review and accept your proposal directly.</span></div>
                </div>
                <div class="form-error hidden" role="alert"></div>
                <div class="row-between"><span class="small muted" id="draft-note"></span>
                    <div class="row"><a class="btn" href="student-dashboard.html">Cancel</a><button class="btn btn-primary" type="submit">${icon('send')}${mode === 'edit' ? 'Save changes' : 'Submit proposal'}</button></div></div>
            </div></form>
            <div class="stack">
                <div class="card"><div class="card-head"><h2>What reviewers look for</h2></div><ul class="list small ink-2">
                    <li>A clear, real problem with an identified user</li>
                    <li>Objectives you can measure at the end (accuracy, time saved, users served)</li>
                    <li>A methodology specific enough to plan milestones from</li>
                    <li>Scope that fits one academic year</li>
                </ul></div>
                ${detail?.proposals.length ? `<div class="card"><div class="card-head"><h2>History</h2></div><ul class="list">${detail.proposals.map(pr =>
                    `<li class="row-between"><span><b>v${pr.version}</b> <span class="small muted">${App.date(pr.submitted_at)}</span></span>${App.proposalBadge(pr.status)}</li>`).join('')}</ul></div>` : ''}
            </div>
        </div>`;

    const form = content.querySelector('#proposal-form');
    const err = form.querySelector('.form-error');

    if (mode === 'new' || mode === 'fresh') {
        let t;
        form.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                try {
                    localStorage.setItem(DRAFT_KEY, JSON.stringify(App.values(form)));
                    content.querySelector('#draft-note').textContent = 'Draft saved on this device';
                } catch { /* storage unavailable */ }
            }, 500);
        });
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        err.classList.add('hidden');
        if (!form.reportValidity()) return;
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        try {
            const r = await api('/projects/proposal', { method: 'POST', body: App.values(form) });
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
            App.toast(r.message);
            setTimeout(() => { location.href = 'student-dashboard.html'; }, 600);
        } catch (ex) {
            err.textContent = ex.message;
            err.classList.remove('hidden');
            btn.disabled = false;
        }
    };
});
