const { api, esc, icon } = App;

App.page({ roles: ['ADMIN'], nav: 'dashboard', title: 'Dashboard' }, async (user, content) => {
    const d = await api('/dashboard/admin');
    const s = d.stats;
    const link = ProjectUI.link;

    const tile = (href, label, value, note) =>
        `<a class="card tile" href="${href}"><span class="tile-label">${label}</span><span class="tile-value">${value}</span><span class="tile-note">${note}</span></a>`;

    // Projects by lifecycle stage – single-series horizontal bars, value at the tip
    const stageMax = Math.max(1, ...d.byStatus.map(b => b.count));
    const stageChart = d.byStatus.map(b => `
        <div class="hbar" data-tip="<b>${esc(App.statusLabel(b.status))}</b>${b.count} project${b.count === 1 ? '' : 's'}">
            <span class="hbar-label">${esc(App.statusLabel(b.status))}</span>
            <div class="hbar-plot"><div class="hbar-fill ${b.count ? '' : 'zero'}" style="width:${(b.count / stageMax) * 85}%"></div><span class="hbar-value">${b.count}</span></div>
        </div>`).join('');

    // Health of in-progress projects – one stacked bar, status colours + icon + label legend
    const health = [['ON_TRACK', 'On track', s.onTrack, 'var(--good)', 'check'], ['AT_RISK', 'At risk', s.atRisk, 'var(--warning)', 'clock'], ['DELAYED', 'Delayed', s.delayed, 'var(--critical)', 'alert']];
    const healthTotal = health.reduce((a, h) => a + h[2], 0);

    // Guide workload – fill = active projects, track = capacity
    const loadMax = Math.max(1, ...d.faculty.map(f => Math.max(f.max_projects, f.active_projects)));
    const loadChart = d.faculty.map(f => {
        const cls = f.active_projects > f.max_projects ? 'critical' : f.active_projects === f.max_projects ? 'warning' : '';
        const state = cls === 'critical' ? 'Over capacity' : cls === 'warning' ? 'At capacity' : `${f.max_projects - f.active_projects} open`;
        return `<div class="hbar" data-tip="<b>${esc(f.name)}</b>${f.active_projects} active of ${f.max_projects} capacity · ${state}">
            <span class="hbar-label">${esc(f.name)}</span>
            <div class="hbar-plot"><div class="hbar-track" style="width:${(f.max_projects / loadMax) * 80}%"></div>
                <div class="hbar-fill abs ${cls} ${f.active_projects ? '' : 'zero'}" style="width:${(f.active_projects / loadMax) * 80}%"></div>
                <span class="hbar-value abs" style="left:calc(${(Math.max(f.max_projects, f.active_projects) / loadMax) * 80}% + 8px)">${f.active_projects}/${f.max_projects}${cls ? ` · ${state}` : ""}</span></div>
        </div>`;
    }).join('');

    const reason = (p) => p.status === 'APPROVED' ? `<span class="badge violet">${icon('link')}Needs guide</span>` : App.healthBadge(p.health);
    const action = (p) => p.status === 'APPROVED' ? `<button class="btn btn-sm btn-primary" data-allocate="${p.id}">Allocate</button>` : `<a class="btn btn-sm" href="${link(p.id, 'milestones')}">Open</a>`;

    content.innerHTML = `
        <div class="page-head"><div><h1>Department overview</h1><p>Every project across the lifecycle${s.studentsWithoutProject ? ` · ${s.studentsWithoutProject} student${s.studentsWithoutProject === 1 ? '' : 's'} yet to propose` : ''}.</p></div>
            <a class="btn" href="projects.html">${icon('folder')}All projects</a></div>
        <div class="tiles">
            ${tile('projects.html', 'Total projects', s.total, `${s.inProgress} in progress`)}
            ${tile('proposal-review.html', 'Pending proposals', s.pendingProposals, 'Awaiting a decision')}
            ${tile('faculty-allocation.html', 'Awaiting guide', s.awaitingGuide, 'Approved, not allocated')}
            ${tile('evaluation.html', 'Awaiting evaluation', s.awaitingEvaluation, 'Final submissions')}
            ${tile('evaluation.html', 'Completed', s.completed, s.averageScore != null ? `Average score ${s.averageScore}` : 'No evaluations yet')}
        </div>
        <div class="grid grid-2" style="margin-bottom:16px">
            <div class="card"><div class="card-head"><div><h2>Projects by stage</h2><p>Current lifecycle status</p></div></div>
                <div class="card-body"><div class="hbar-chart" id="stage-chart" role="img" aria-label="Projects by lifecycle stage">${stageChart}</div></div></div>
            <div class="card"><div class="card-head"><div><h2>Health of in-progress projects</h2><p>Based on milestone deadlines</p></div></div>
                <div class="card-body">
                    ${healthTotal ? `<div class="health-stack" id="health-chart" role="img" aria-label="${health.map(h => `${h[1]} ${h[2]}`).join(', ')}">
                        ${health.filter(h => h[2]).map(h => `<div style="flex:${h[2]};background:${h[3]}" data-tip="<b>${h[1]}</b>${h[2]} project${h[2] === 1 ? '' : 's'}"></div>`).join('')}</div>
                        <div class="legend">${health.map(h => `<span><i style="background:${h[3]}"></i>${icon(h[4])}${h[1]} <b>${h[2]}</b></span>`).join('')}</div>`
                        : '<p class="muted">No projects in progress.</p>'}
                    <div style="margin-top:16px">${d.attention.length ? `<ul class="list card" style="box-shadow:none">${d.attention.map(p => `<li class="row" style="flex-wrap:nowrap">
                        <div class="grow"><a href="${link(p.id)}"><b>${esc(p.title)}</b></a><div class="small muted">${esc(p.student_name)} · ${esc(p.guide_name || 'no guide')}${p.milestones_overdue ? ` · ${p.milestones_overdue} overdue` : ''}</div></div>
                        ${reason(p)}${action(p)}</li>`).join('')}</ul>` : App.empty('check', 'Nothing needs attention')}</div>
                </div></div>
        </div>
        <div class="grid grid-2">
            <div class="card"><div class="card-head"><div><h2>Guide workload</h2><p>Active projects against each guide's capacity (light track)</p></div><a class="btn btn-sm" href="faculty-allocation.html">Allocate</a></div>
                <div class="card-body"><div class="hbar-chart" id="load-chart" role="img" aria-label="Guide workload">${loadChart}</div></div></div>
            <div class="card"><div class="card-head"><h2>Recent activity</h2></div><div class="card-body">
                ${d.activity.length ? `<ol class="timeline">${d.activity.slice(0, 8).map(a => `<li><div>${esc(a.message)} <span class="muted">·</span> <a href="${link(a.project_id, 'activity')}">${esc(a.project_title)}</a></div><div class="when">${esc(a.actor_name || 'System')} · ${App.ago(a.created_at)}</div></li>`).join('')}</ol>` : App.empty('clock', 'No activity yet')}
            </div></div>
        </div>`;

    ['#stage-chart', '#health-chart', '#load-chart'].forEach(sel => { const el = content.querySelector(sel); if (el) App.bindTips(el); });
    content.querySelectorAll('[data-allocate]').forEach(b => b.onclick = async () => {
        const project = d.attention.find(p => p.id === Number(b.dataset.allocate));
        if (await ProjectUI.allocateModal(project)) location.reload();
    });
});
