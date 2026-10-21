const { api, esc, icon } = App;
const UI = ProjectUI;

App.page({ roles: ['ADMIN'], nav: 'dashboard', title: 'Home' }, async (user, content) => {
    async function load() {
        const d = await api('/dashboard/admin');
        const s = d.stats;
        const link = UI.link;
        const needGuide = d.attention.filter(p => p.status === 'APPROVED');
        const overdue = d.attention.filter(p => p.health === 'DELAYED');
        const count = (st) => d.byStatus.filter(b => st.includes(b.status)).reduce((a, b) => a + b.count, 0);

        // ---- Needs action
        const actions = [];
        if (s.pendingProposals) actions.push(`<li><a class="row-item" href="proposal-review.html"><span class="row-icon">${icon('file')}</span>
            <div class="grow"><div class="row-title">${App.plural(s.pendingProposals, 'proposal')} waiting for a decision</div><div class="row-meta">A guide or you can approve them</div></div>${icon('chevronRight')}</a></li>`);
        needGuide.forEach(p => actions.push(`<li><div class="row-item"><span class="row-icon violet">${icon('link')}</span>
            <div class="grow"><div class="row-title">${esc(p.title)} needs a guide</div><div class="row-meta">${esc(p.student_name)}${p.preferred_guide_name ? ` · would like ${esc(p.preferred_guide_name)}` : ''}</div></div>
            <button class="btn btn-sm btn-primary" data-allocate="${p.id}">Assign guide</button></div></li>`));
        overdue.forEach(p => actions.push(`<li><a class="row-item" href="${link(p.id, 'milestones')}"><span class="row-icon bad">${icon('alert')}</span>
            <div class="grow"><div class="row-title">${esc(p.title)} is behind schedule</div><div class="row-meta">${esc(p.student_name)} · guide ${esc(p.guide_name)} · ${App.plural(p.milestones_overdue, 'milestone')} overdue</div></div>${icon('chevronRight')}</a></li>`));
        if (s.awaitingEvaluation) actions.push(`<li><a class="row-item" href="evaluation.html"><span class="row-icon violet">${icon('award')}</span>
            <div class="grow"><div class="row-title">${App.plural(s.awaitingEvaluation, 'project')} waiting for a final grade</div><div class="row-meta">Usually graded by the guide</div></div>${icon('chevronRight')}</a></li>`);

        // ---- Pipeline: how many projects are at each stage
        const stages = [
            ['proposal', 'Proposals', 'Waiting for approval or being revised', count(['PROPOSAL_SUBMITTED', 'CHANGES_REQUESTED'])],
            ['approved', 'Need a guide', 'Approved, guide not assigned yet', count(['APPROVED'])],
            ['active', 'In progress', 'Working on milestones', count(['IN_PROGRESS'])],
            ['final', 'Waiting for grade', 'Submitted for final grading', count(['FINAL_SUBMISSION'])],
            ['completed', 'Completed', s.averageScore != null ? `Average score ${s.averageScore}/100` : 'Graded and finished', count(['COMPLETED'])],
        ];

        // ---- Health of in-progress projects
        const health = [['ON_TRACK', s.onTrack], ['AT_RISK', s.atRisk], ['DELAYED', s.delayed]];

        content.innerHTML = `
            <div class="page-header"><div><h1>Department overview</h1>
                <p>${s.total} projects in total · ${s.inProgress} in progress${s.studentsWithoutProject ? ` · ${App.plural(s.studentsWithoutProject, 'student has', 'students have')} not proposed yet` : ''}.</p></div>
                <a class="btn" href="projects.html">${icon('layers')}See all projects</a></div>
            <div class="stack">
                <div class="card">
                    <div class="card-header"><div><h2>Needs your attention</h2><p>${actions.length ? 'Start here.' : ''}</p></div></div>
                    ${actions.length ? `<ul class="rows" style="margin-top:8px">${actions.join('')}</ul>` : `<div class="card-body">${App.empty('checkCircle', 'Nothing needs you right now', 'Proposals, projects without a guide and overdue work will show up here.', '', 'good')}</div>`}
                </div>

                <div>
                    <div class="section-title"><h2>Where projects are</h2><p>Click a stage to see its projects</p></div>
                    <div class="pipeline">${stages.map(([key, name, desc, n], i) => `
                        <a class="stage ${key === 'approved' && n ? 'attention' : ''}" href="projects.html?filter=${key}">
                            <span class="stage-step">Stage ${i + 1}</span><span class="stage-n">${n}</span><span class="stage-name">${name}</span><span class="stage-desc">${desc}</span>
                        </a>`).join('')}</div>
                </div>

                <div class="grid cols-2">
                    <div class="card">
                        <div class="card-header"><div><h2>How in-progress projects are doing</h2><p>Based on milestone deadlines</p></div></div>
                        <div class="card-body stack-md">${health.map(([k, n]) => {
                            const [tone, ic, label, explain] = App.healthInfo(k);
                            return `<a class="row" href="projects.html?filter=${k === 'DELAYED' ? 'delayed' : 'active'}" style="color:inherit;text-decoration:none;flex-wrap:nowrap">
                                <span class="summary-icon ${tone}">${icon(ic)}</span>
                                <div class="grow"><div class="row-title">${label}</div><div class="row-meta">${explain}</div></div>
                                <span class="summary-value">${n}</span></a>`;
                        }).join('')}</div>
                    </div>
                    <div class="card">
                        <div class="card-header"><div><h2>Guide workload</h2><p>Students each guide is supervising, out of their limit</p></div><a class="btn btn-sm" href="faculty-allocation.html">Manage</a></div>
                        <div class="card-body"><div class="bars">${d.faculty.map(f => {
                            const full = f.active_projects >= f.max_projects;
                            return `<div class="bar-row"><span class="name truncate">${esc(f.name)}</span>
                                <div class="bar-track"><div class="${f.active_projects > f.max_projects ? 'bad' : full ? 'warn' : ''}" style="width:${(f.active_projects / Math.max(f.max_projects, 1)) * 100}%"></div></div>
                                <span class="val">${f.active_projects} of ${f.max_projects}${full ? ' · full' : ''}</span></div>`;
                        }).join('')}</div></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><div><h2>Latest activity</h2><p>What happened recently across all projects</p></div></div>
                    <div class="card-body">${d.activity.length ? `<ol class="timeline">${d.activity.slice(0, 6).map(a => `<li><div>${esc(a.message)} — <a href="${link(a.project_id, 'history')}">${esc(a.project_title)}</a></div><div class="when">${esc(a.actor_name || 'System')} · ${App.ago(a.created_at)}</div></li>`).join('')}</ol>` : App.empty('clock', 'No activity yet')}</div>
                </div>
            </div>`;

        content.querySelectorAll('[data-allocate]').forEach(b => b.onclick = async () => {
            if (await UI.allocateModal(needGuide.find(p => p.id === Number(b.dataset.allocate)))) load();
        });
    }
    await load();
});
