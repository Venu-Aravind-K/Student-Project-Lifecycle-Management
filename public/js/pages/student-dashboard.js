const { api, esc, icon, date } = App;
const UI = ProjectUI;

App.page({ roles: ['STUDENT'], nav: 'dashboard', title: 'Home' }, async (user, content) => {
    const first = esc(App.firstName(user.name));

    async function load() {
        const { detail } = await api('/dashboard/student');
        if (detail) render(detail);
        else renderWelcome();
    }

    function renderWelcome() {
        const steps = [
            ['pen', 'Write your proposal', 'Describe your idea and pick the teacher you’d like as your guide. Takes about 10 minutes.'],
            ['checkCircle', 'Get it approved', 'Your chosen guide reads it and approves it, or asks for small changes.'],
            ['upload', 'Do the work, step by step', 'Your guide sets milestones with deadlines. You upload your work for each one.'],
            ['award', 'Submit and get graded', 'Upload your final report, submit the project and receive your grade.'],
        ];
        content.innerHTML = `
            <div class="page-header"><div><h1>Hi, ${first} 👋</h1><p>Welcome to ProjectFlow. This is where you’ll manage your final-year project from idea to grade.</p></div></div>
            <div class="stack">
                <section class="next"><div class="next-icon">${icon('pen')}</div><div class="grow"><div class="next-label">Your next step</div>
                    <h2>Write your project proposal</h2><p>You haven’t started a project yet. Everything begins with a short proposal.</p></div>
                    <div class="next-actions"><a class="btn btn-lg btn-primary" href="proposal.html">Start proposal${icon('arrowRight')}</a></div></section>
                <div class="card card-pad">
                    <h2>How it works</h2>
                    <p class="muted" style="margin-top:4px">Four simple stages. ProjectFlow always tells you what to do next.</p>
                    <div class="grid cols-4" style="margin-top:20px">${steps.map(([ic, t, d], i) => `
                        <div class="stack-sm"><div class="row-icon">${icon(ic)}</div><div class="tiny bold muted" style="margin-top:6px">STEP ${i + 1}</div><h3>${t}</h3><p class="small muted">${d}</p></div>`).join('')}
                    </div>
                </div>
            </div>`;
    }

    function render(detail) {
        const { project: p, milestones } = detail;
        const done = milestones.filter(m => m.status === 'APPROVED').length;
        const latestReview = milestones.flatMap(m => m.reviews.map(r => ({ ...r, milestone: m.title })))
            .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0];
        const showMilestones = ['IN_PROGRESS', 'FINAL_SUBMISSION', 'COMPLETED'].includes(p.status);

        const root = document.createElement('div');
        root.innerHTML = `
            <div class="page-header"><div><h1>Hi, ${first} 👋</h1><p>Here’s where your project stands and what to do next.</p></div></div>
            <div class="stack">
                ${UI.nextStep(detail, user)}
                ${UI.journey(detail, user)}
                <div class="grid cols-main">
                    <div class="card">
                        ${showMilestones ? `
                        <div class="card-header"><div><h2>Your milestones</h2><p>Checkpoints set by your guide. Click one to see files and feedback.</p></div>
                            <span class="small bold">${done} of ${milestones.length} done</span></div>
                        ${milestones.length ? `<div class="card-body" style="padding-bottom:8px">${App.progress(detail.progress, 'good')}</div>` : ''}
                        <div id="ms-list">${UI.milestoneList(detail, user)}</div>`
                        : `<div class="card-header"><div><h2>Your proposal</h2><p>${App.proposalPill(detail.proposals[0]?.status)}</p></div><a class="btn btn-sm" href="proposal.html">${detail.permissions.canEditProposal ? 'Edit' : 'View'}</a></div>
                        <div class="card-body"><dl class="kv">
                            <dt>Title</dt><dd><b>${esc(p.title)}</b></dd>
                            <dt>Problem</dt><dd>${esc(p.description)}</dd>
                            <dt>Preferred guide</dt><dd>${esc(p.preferred_guide_name || 'No preference')}</dd>
                            <dt>Sent</dt><dd>${App.ago(detail.proposals[0]?.submitted_at)}</dd>
                        </dl></div>
                        <div class="card-footer explain">${icon('info')}<span>Milestones will appear here once your proposal is approved and a guide is assigned.</span></div>`}
                    </div>
                    <div class="stack">
                        <div class="card card-pad">
                            <div class="detail-label">Your guide</div>
                            ${p.guide_name ? `<div class="row"><span class="avatar lg">${esc(App.initials(p.guide_name))}</span><div class="grow"><b>${esc(p.guide_name)}</b><div class="small muted truncate">${esc(p.guide_email)}</div></div></div>
                                <a class="btn btn-block" style="margin-top:14px" href="mailto:${esc(p.guide_email)}">Email ${esc(p.guide_name)}</a>`
                                : `<p class="ink-2">Not assigned yet.</p><p class="small muted" style="margin-top:4px">${p.preferred_guide_name ? `You asked for ${esc(p.preferred_guide_name)}.` : 'The coordinator will assign one after approval.'}</p>`}
                        </div>
                        <div class="card card-pad">
                            <div class="detail-label">Your project</div>
                            <h3>${esc(p.title)}</h3>
                            <div class="row" style="margin:10px 0 14px">${App.statusPill(p.status)}${App.healthPill(detail.health)}</div>
                            <a class="btn btn-block" href="project-details.html">Open project${icon('arrowRight')}</a>
                        </div>
                        ${latestReview ? `<div class="card card-pad"><div class="detail-label">Latest feedback · ${esc(latestReview.milestone)}</div>${UI.feedbackItem(latestReview)}</div>` : ''}
                    </div>
                </div>
            </div>`;
        content.replaceChildren(root);
        UI.bindActions(root, detail, load, { onGoto: (tab) => { location.href = `project-details.html#${tab}`; } });
    }

    await load();
});
