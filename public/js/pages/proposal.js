const { api, esc, icon } = App;

App.page({ roles: ['STUDENT'], nav: 'proposal', title: 'My proposal' }, async (user, content) => {
    const [{ detail }, faculty] = await Promise.all([api('/dashboard/student'), api('/users/faculty')]);
    const p = detail?.project;
    const latest = detail?.proposals[0];

    // Approved proposals are read-only
    if (p && !detail.permissions.canEditProposal) {
        content.innerHTML = `
            <div class="page-header"><div><h1>My proposal</h1><p>${esc(p.title)}</p></div></div>
            <section class="next good"><div class="next-icon">${icon('checkCircle')}</div>
                <div class="grow"><div class="next-label">Approved</div><h2>Your proposal was approved</h2><p>Your project is now <b>${esc(App.statusLabel(p.status).toLowerCase())}</b>. Approved proposals can’t be edited.</p></div>
                <div class="next-actions"><a class="btn btn-lg" href="project-details.html#proposal">Read it</a><a class="btn btn-lg btn-primary" href="student-dashboard.html">Go home</a></div></section>`;
        return;
    }

    const mode = !p ? 'new' : p.status === 'PROPOSAL_SUBMITTED' ? 'edit' : p.status === 'REJECTED' ? 'fresh' : 'revise';
    const heading = { new: 'Write your project proposal', edit: 'Edit your proposal', revise: 'Update your proposal', fresh: 'Write a new proposal' }[mode];
    const intro = {
        new: 'Four short steps. Your answers are saved on this device as you type, so you can come back later.',
        edit: 'It hasn’t been reviewed yet, so your changes replace the version that was sent.',
        revise: 'Make the changes your reviewer asked for, then send it again. Your earlier version is kept.',
        fresh: 'Your last idea wasn’t approved. Use the feedback to write a new proposal.',
    }[mode];

    const DRAFT_KEY = `proposal-draft-${user.id}`;
    let data = mode === 'edit' || mode === 'revise' ? { ...latest } : {};
    if (mode === 'new' || mode === 'fresh') { try { data = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch { data = {}; } }
    const preferred = Number(data.preferred_guide_id ?? p?.preferred_guide_id) || null;
    const val = (k) => esc(data?.[k] ?? '');

    const STEPS = ['Your idea', 'Your plan', 'Your guide', 'Check & send'];
    let step = 0;

    const guideOptions = [
        `<label class="option"><input type="radio" name="preferred_guide_id" value="" ${!preferred ? 'checked' : ''}><div><strong>No preference</strong><span>The coordinator will choose for you.</span></div></label>`,
        ...faculty.map(f => {
            const free = f.max_projects - f.active_projects;
            return `<label class="option"><input type="radio" name="preferred_guide_id" value="${f.id}" ${preferred === f.id ? 'checked' : ''}><div>
                <strong>${esc(f.name)}</strong><span>${esc(f.expertise || f.department || '')}</span>
                <span>${free > 0 ? `${App.plural(free, 'place')} left` : '<b style="color:var(--warn-ink)">No places left</b>'}</span></div></label>`;
        }),
    ].join('');

    content.innerHTML = `
        <div class="page-header"><div><h1>${heading}</h1><p>${intro}</p></div></div>
        ${latest?.feedback && (mode === 'revise' || mode === 'fresh') ? `<section class="next ${mode === 'fresh' ? 'bad' : 'warn'}" style="margin-bottom:24px"><div class="next-icon">${icon('pen')}</div>
            <div class="grow"><div class="next-label">What ${esc(latest.reviewer_name || 'the reviewer')} said</div><div class="quote">${esc(latest.feedback)}</div></div></section>` : ''}
        <div class="wizard-steps" id="wsteps"></div>
        <form class="card card-pad" id="proposal-form" novalidate>
            <section data-step="0" class="stack">
                <div><h2>What is your project about?</h2><p class="muted" style="margin-top:4px">Give it a clear name and describe the problem you want to solve.</p></div>
                <div class="field"><label for="title">Project title</label><input class="input" id="title" name="title" required maxlength="200" placeholder="e.g. Smart attendance using face recognition" value="${val('title')}"></div>
                <div class="field"><label for="domain">Area <span class="optional">(optional)</span></label><input class="input" id="domain" name="domain" maxlength="100" placeholder="e.g. Machine Learning" list="domains" value="${val('domain')}">
                    <datalist id="domains">${['Machine Learning', 'Computer Vision', 'Internet of Things', 'Web Development', 'Mobile Computing', 'Blockchain', 'Cloud Computing', 'Cyber Security', 'Data Science'].map(d => `<option value="${d}">`).join('')}</datalist></div>
                <div class="field"><label for="problem_statement">What problem does it solve?</label><textarea class="textarea" id="problem_statement" name="problem_statement" required rows="5" placeholder="Who has this problem, and why does it matter?">${val('problem_statement')}</textarea>
                    <span class="help">Tip: 2–4 sentences is enough. Mention who will use it.</span></div>
            </section>
            <section data-step="1" class="stack hidden">
                <div><h2>How will you do it?</h2><p class="muted" style="margin-top:4px">Your guide will use this to plan your milestones.</p></div>
                <div class="field"><label for="objectives">Goals</label><textarea class="textarea" id="objectives" name="objectives" required rows="4" placeholder="1. Recognise students from a classroom camera&#10;2. Mark attendance automatically">${val('objectives')}</textarea>
                    <span class="help">Tip: write goals you can measure, like “95% accuracy” or “works offline”.</span></div>
                <div class="field"><label for="methodology">How you will build it</label><textarea class="textarea" id="methodology" name="methodology" required rows="4" placeholder="The steps, methods or algorithms you plan to use">${val('methodology')}</textarea></div>
                <div class="field"><label for="technologies">Technologies</label><input class="input" id="technologies" name="technologies" required maxlength="500" placeholder="e.g. Python, OpenCV, Django" value="${val('technologies')}"><span class="help">Separate them with commas.</span></div>
                <div class="field"><label for="expected_outcome">What will you have at the end? <span class="optional">(optional)</span></label><textarea class="textarea" id="expected_outcome" name="expected_outcome" rows="3" placeholder="e.g. A working app tested in two classrooms">${val('expected_outcome')}</textarea></div>
            </section>
            <section data-step="2" class="stack hidden">
                <div><h2>Who would you like as your guide?</h2><p class="muted" style="margin-top:4px">The guide you choose will read your proposal first. If they approve it, they become your guide.</p></div>
                <div class="options">${guideOptions}</div>
            </section>
            <section data-step="3" class="stack hidden">
                <div><h2>Check everything, then send</h2><p class="muted" style="margin-top:4px">You can still go back and change anything.</p></div>
                <div id="summary"></div>
            </section>
            <div class="form-error hidden" role="alert" style="margin-top:16px"></div>
            <div class="wizard-nav">
                <button type="button" class="btn btn-lg" id="back">Back</button>
                <div class="row"><span class="small muted" id="draft-note"></span>
                    <button type="button" class="btn btn-lg btn-primary" id="next">Next${icon('arrowRight')}</button>
                    <button type="submit" class="btn btn-lg btn-primary hidden" id="send">${icon('send')}${mode === 'edit' ? 'Save changes' : 'Send proposal'}</button></div>
            </div>
        </form>`;

    const form = content.querySelector('#proposal-form');
    const err = form.querySelector('.form-error');
    const sections = [...form.querySelectorAll('[data-step]')];

    function showStep(n) {
        step = n;
        sections.forEach((s, i) => s.classList.toggle('hidden', i !== n));
        content.querySelector('#wsteps').innerHTML = STEPS.map((label, i) =>
            `<div class="wizard-step ${i === n ? 'active' : i < n ? 'done' : ''}"><span class="n">${i < n ? icon('check', 'icon-sm') : i + 1}</span>${label}</div>`).join('');
        content.querySelector('#back').style.visibility = n === 0 ? 'hidden' : 'visible';
        content.querySelector('#next').classList.toggle('hidden', n === STEPS.length - 1);
        content.querySelector('#send').classList.toggle('hidden', n !== STEPS.length - 1);
        err.classList.add('hidden');
        if (n === 3) renderSummary();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function stepValid(n) {
        for (const el of sections[n].querySelectorAll('[required]')) {
            if (!el.checkValidity()) { el.reportValidity(); return false; }
        }
        return true;
    }

    function renderSummary() {
        const v = App.values(form);
        const guide = faculty.find(f => f.id === Number(v.preferred_guide_id));
        const rows = [
            [0, 'Title', v.title], [0, 'Area', v.domain || '—'], [0, 'Problem', v.problem_statement],
            [1, 'Goals', v.objectives], [1, 'How you’ll build it', v.methodology], [1, 'Technologies', v.technologies], [1, 'End result', v.expected_outcome || '—'],
            [2, 'Preferred guide', guide ? guide.name : 'No preference'],
        ];
        content.querySelector('#summary').innerHTML = `<dl class="review-list">${rows.map(([s, k, value]) =>
            `<dt>${k}<div><a href="#" data-jump="${s}" class="small">Change</a></div></dt><dd>${esc(value)}</dd>`).join('')}</dl>`;
    }

    content.querySelector('#next').onclick = () => { if (stepValid(step)) showStep(step + 1); };
    content.querySelector('#back').onclick = () => showStep(step - 1);
    content.querySelector('#summary').addEventListener('click', (e) => { const a = e.target.closest('[data-jump]'); if (a) { e.preventDefault(); showStep(Number(a.dataset.jump)); } });

    if (mode === 'new' || mode === 'fresh') {
        let t;
        form.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                try { localStorage.setItem(DRAFT_KEY, JSON.stringify(App.values(form))); content.querySelector('#draft-note').textContent = 'Draft saved'; } catch { /* ignore */ }
            }, 500);
        });
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        // Enter key on an earlier step means "Next", not "Send"
        if (step < STEPS.length - 1) { if (stepValid(step)) showStep(step + 1); return; }
        const bad = sections.findIndex(s => [...s.querySelectorAll('[required]')].some(el => !el.checkValidity()));
        if (bad !== -1) { showStep(bad); stepValid(bad); return; }
        const btn = content.querySelector('#send');
        btn.disabled = true;
        try {
            const r = await api('/projects/proposal', { method: 'POST', body: App.values(form) });
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
            App.toast(r.message);
            setTimeout(() => { location.href = 'student-dashboard.html'; }, 700);
        } catch (ex) {
            err.innerHTML = `${icon('alertCircle')}<span>${esc(ex.message)}</span>`;
            err.classList.remove('hidden');
            btn.disabled = false;
        }
    };

    showStep(0);
});
