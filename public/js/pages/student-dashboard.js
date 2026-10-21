const { api, esc, icon, date } = App;
const UI = ProjectUI;

App.page({ roles: ['STUDENT'], nav: 'dashboard', title: 'Dashboard' }, async (user, content) => {
    const first = esc(user.name.split(' ')[0]);

    async function load() {
        const { detail } = await api('/dashboard/student');
        if (!detail) return renderEmpty();
        render(detail);
    }

    function renderEmpty() {
        const steps = [
            ['file', 'Submit a proposal', 'Describe the problem, objectives, methodology and technologies. Pick a preferred guide.'],
            ['checkSquare', 'Proposal review', 'Your preferred guide or the coordinator approves it or asks for changes.'],
            ['link', 'Guide allocation', 'A faculty guide is allocated to supervise your project.'],
            ['flag', 'Milestones', 'Your guide sets milestones with deadlines; you upload deliverables for each.'],
            ['rotate', 'Reviews', 'Each submission is scored and approved or sent back for revision.'],
            ['award', 'Final evaluation', 'Upload your final report, make the final submission and receive your grade.'],
        ];
        content.innerHTML = `
            <div class="page-head"><div><h1>Welcome, ${first}</h1><p>You have not started a project yet.</p></div></div>
            <div class="card"><div class="card-body stack" style="padding:28px">
                <div><h2>How your project moves through ProjectFlow</h2><p class="muted" style="margin-top:4px">Everything — feedback, deadlines, files and grades — stays in one place.</p></div>
                <div class="grid grid-3">${steps.map(([ic, t, d], i) => `<div class="card card-body stack-sm" style="box-shadow:none">
                    <div class="row"><span class="ms-index ${i === 0 ? 'submitted' : ''}">${i + 1}</span><b>${t}</b></div><p class="ink-2 small">${d}</p></div>`).join('')}</div>
                <div><a class="btn btn-primary" href="proposal.html">${icon('file')}Write your proposal</a></div>
            </div></div>`;
    }

    function render(detail) {
        const { project: p, milestones } = detail;
        const next = milestones.find(m => ['PENDING', 'REVISION_REQUESTED'].includes(m.status));
        const latestReview = milestones.flatMap(m => m.reviews.map(r => ({ ...r, milestone: m.title })))
            .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0];
        const latestProposal = detail.proposals[0];

        const tiles = [
            `<div class="card tile"><span class="tile-label">Status</span><div style="margin:6px 0 2px">${App.statusBadge(p.status)}</div><span class="tile-note">${detail.health ? App.healthBadge(detail.health) : `Updated ${App.ago(p.updated_at)}`}</span></div>`,
            `<div class="card tile"><span class="tile-label">Milestone progress</span><span class="tile-value">${detail.progress}%</span>${App.meter(detail.progress).replace(/<span class="meter-label">.*?<\/span>/, '')}<span class="tile-note">${milestones.filter(m => m.status === 'APPROVED').length} of ${milestones.length} approved</span></div>`,
            `<div class="card tile"><span class="tile-label">Guide</span><span class="tile-value sm">${p.guide_name ? esc(p.guide_name) : 'Not allocated'}</span><span class="tile-note">${p.guide_email ? esc(p.guide_email) : p.preferred_guide_name ? `Preferred: ${esc(p.preferred_guide_name)}` : ''}</span></div>`,
            detail.evaluation
                ? `<div class="card tile"><span class="tile-label">Final score</span><span class="tile-value">${detail.evaluation.total_score}<span class="muted" style="font-size:15px"> / 100</span></span><span class="tile-note">Grade ${esc(detail.evaluation.grade)}</span></div>`
                : `<div class="card tile"><span class="tile-label">Next deadline</span><span class="tile-value sm">${next ? esc(next.title) : '—'}</span><span class="tile-note">${next ? `${date(next.deadline)} · ${App.due(next.deadline)}` : 'Nothing due'}</span></div>`,
        ];

        content.innerHTML = `
            <div class="page-head">
                <div><h1>Welcome back, ${first}</h1><p>${esc(p.title)}</p></div>
                <a class="btn" href="project-details.html">${icon('folder')}Open project workspace</a>
            </div>
            <div class="stack">
                ${UI.nextStep(detail, user)}
                <div class="tiles" style="margin:0">${tiles.join('')}</div>
                <div class="card card-body">${App.stepper(p, detail.progress)}</div>
                <div class="grid grid-main">
                    <div class="card" id="ms-card">
                        <div class="card-head"><div><h2>Milestones</h2><p>Upload your work directly from here</p></div><a class="btn btn-sm" href="project-details.html#milestones">Details</a></div>
                        <div id="ms-list">${['IN_PROGRESS', 'FINAL_SUBMISSION', 'COMPLETED'].includes(p.status) ? UI.milestoneList(detail) : App.empty('flag', 'Milestones appear once your project is underway')}</div>
                    </div>
                    <div class="stack">
                        <div class="card"><div class="card-head"><h2>Latest feedback</h2></div><div class="card-body">
                            ${latestReview ? `<div class="small muted" style="margin-bottom:6px">${esc(latestReview.milestone)}</div>${UI.reviewBlock(latestReview)}`
                                : latestProposal?.feedback ? `<div class="small muted" style="margin-bottom:6px">Proposal v${latestProposal.version}</div>${App.proposalBadge(latestProposal.status)}<div class="quote">${esc(latestProposal.feedback)}</div>`
                                : '<p class="muted">No feedback yet.</p>'}
                        </div></div>
                        <div class="card"><div class="card-head"><h2>Recent activity</h2><a class="btn btn-sm btn-ghost" href="project-details.html#activity">All</a></div><div class="card-body">
                            ${detail.activity.length ? `<ol class="timeline">${detail.activity.slice(0, 6).map(a => `<li><div>${esc(a.message)}</div><div class="when">${esc(a.actor_name || '')} · ${App.ago(a.created_at)}</div></li>`).join('')}</ol>` : '<p class="muted">Nothing yet.</p>'}
                        </div></div>
                    </div>
                </div>
            </div>`;
        UI.bindMilestones(content.querySelector('#ms-list'), detail, load);
        content.querySelector('[data-final-submit]')?.addEventListener('click', async () => { if (await UI.finalSubmit(detail)) load(); });
    }

    await load();
});
