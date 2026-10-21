const { api, esc, icon, date } = App;

const FILTERS = [
    ['all', 'All', () => true],
    ['proposal', 'Proposals', p => ['PROPOSAL_SUBMITTED', 'CHANGES_REQUESTED'].includes(p.status)],
    ['approved', 'Awaiting guide', p => p.status === 'APPROVED'],
    ['active', 'In progress', p => p.status === 'IN_PROGRESS'],
    ['delayed', 'Delayed', p => p.health === 'DELAYED'],
    ['final', 'Final submission', p => p.status === 'FINAL_SUBMISSION'],
    ['completed', 'Completed', p => p.status === 'COMPLETED'],
    ['rejected', 'Rejected', p => p.status === 'REJECTED'],
];

App.page({
    roles: ['FACULTY', 'ADMIN'],
    nav: 'projects',
    title: (u) => (u.role === 'ADMIN' ? 'All Projects' : 'My Projects'),
}, async (user, content) => {
    const isAdmin = user.role === 'ADMIN';
    const projects = await api('/projects');
    const filters = FILTERS.filter(([key]) => isAdmin || !['proposal', 'approved', 'rejected'].includes(key));
    let filter = new URLSearchParams(location.search).get('filter') || 'all';
    let query = '';

    content.innerHTML = `
        <div class="page-head">
            <div><h1>${isAdmin ? 'All projects' : 'My projects'}</h1><p>${isAdmin ? 'Every project in the department, at every stage.' : 'Projects you guide.'}</p></div>
            ${isAdmin ? `<button class="btn" id="export">${icon('download')}Export CSV</button>` : ''}
        </div>
        <div class="card">
            <div class="card-head">
                <nav class="tabs" style="margin:0;border:0" id="filters">${filters.map(([key, label, fn]) =>
                    `<button class="tab ${key === filter ? 'active' : ''}" data-filter="${key}">${label}<span class="count">${projects.filter(fn).length}</span></button>`).join('')}</nav>
                <div class="row" style="min-width:220px;flex:0 1 280px"><input class="input" type="search" id="search" placeholder="Search title, student${isAdmin ? ', guide' : ''}…" aria-label="Search projects"></div>
            </div>
            <div class="table-wrap"><table>
                <thead><tr><th>Project</th>${isAdmin ? '<th>Guide</th>' : ''}<th>Status</th><th>Progress</th><th>Next deadline</th><th class="num">Score</th></tr></thead>
                <tbody id="rows"></tbody>
            </table></div>
        </div>`;

    const visible = () => {
        const fn = (filters.find(f => f[0] === filter) || filters[0])[2];
        const q = query.toLowerCase();
        return projects.filter(fn).filter(p => !q || [p.title, p.student_name, p.student_roll, p.guide_name, p.domain].some(v => v && v.toLowerCase().includes(q)));
    };

    function renderRows() {
        const rows = visible();
        const tbody = content.querySelector('#rows');
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}">${App.empty('search', 'No projects match')}</td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map(p => `<tr class="clickable" data-href="${ProjectUI.link(p.id)}">
            <td><div class="title">${esc(p.title)}</div><div class="sub">${esc(p.student_name)}${p.student_roll ? ` · ${esc(p.student_roll)}` : ''}${p.domain ? ` · ${esc(p.domain)}` : ''}</div></td>
            ${isAdmin ? `<td>${p.guide_name ? esc(p.guide_name) : `<span class="muted">—</span>${p.preferred_guide_name ? `<div class="sub">prefers ${esc(p.preferred_guide_name)}</div>` : ''}`}</td>` : ''}
            <td><div class="stack-sm" style="gap:4px;align-items:flex-start">${App.statusBadge(p.status)}${App.healthBadge(p.health)}</div></td>
            <td>${p.milestones_total ? App.meter(p.progress) : '<span class="muted small">No milestones</span>'}</td>
            <td class="nowrap">${p.next_deadline && p.status === 'IN_PROGRESS' ? `${date(p.next_deadline)}<div class="sub">${App.due(p.next_deadline)}</div>` : '<span class="muted">—</span>'}</td>
            <td class="num">${p.final_score != null ? `<b>${p.final_score}</b> <span class="muted">${esc(p.final_grade)}</span>` : '<span class="muted">—</span>'}</td>
        </tr>`).join('');
        tbody.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.href = tr.dataset.href; });
    }

    content.querySelector('#filters').onclick = (e) => {
        const b = e.target.closest('[data-filter]');
        if (!b) return;
        filter = b.dataset.filter;
        content.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('active', x === b));
        history.replaceState(null, '', `?filter=${filter}`);
        renderRows();
    };
    content.querySelector('#search').oninput = (e) => { query = e.target.value.trim(); renderRows(); };
    content.querySelector('#export')?.addEventListener('click', () => {
        const cols = [['Title', 'title'], ['Student', 'student_name'], ['Roll number', 'student_roll'], ['Domain', 'domain'], ['Guide', 'guide_name'],
            ['Status', 'status_label'], ['Health', 'health'], ['Progress %', 'progress'], ['Milestones approved', 'milestones_approved'],
            ['Milestones total', 'milestones_total'], ['Next deadline', 'next_deadline'], ['Final score', 'final_score'], ['Grade', 'final_grade']];
        const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [cols.map(c => cell(c[0])).join(','), ...visible().map(p => cols.map(c => cell(p[c[1]])).join(','))].join('\r\n');
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
            download: `projects-${App.todayStr()}.csv`,
        });
        a.click();
        URL.revokeObjectURL(a.href);
    });
    renderRows();
});
