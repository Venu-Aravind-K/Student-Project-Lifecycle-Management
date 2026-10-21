const { api, esc, icon } = App;

const FILTERS = [
    ['all', 'All', () => true],
    ['proposal', 'Proposals', p => ['PROPOSAL_SUBMITTED', 'CHANGES_REQUESTED'].includes(p.status)],
    ['approved', 'Need a guide', p => p.status === 'APPROVED'],
    ['active', 'In progress', p => p.status === 'IN_PROGRESS'],
    ['delayed', 'Overdue', p => p.health === 'DELAYED'],
    ['final', 'Waiting for grade', p => p.status === 'FINAL_SUBMISSION'],
    ['completed', 'Completed', p => p.status === 'COMPLETED'],
    ['rejected', 'Not approved', p => p.status === 'REJECTED'],
];

App.page({
    roles: ['FACULTY', 'ADMIN'],
    nav: 'projects',
    title: (u) => (u.role === 'ADMIN' ? 'All projects' : 'My students'),
}, async (user, content) => {
    const isAdmin = user.role === 'ADMIN';
    const projects = await api('/projects');
    const filters = FILTERS.filter(([key]) => isAdmin || !['proposal', 'approved', 'rejected'].includes(key));
    let filter = new URLSearchParams(location.search).get('filter') || 'all';
    if (!filters.some(f => f[0] === filter)) filter = 'all';
    let query = '';

    content.innerHTML = `
        <div class="page-header">
            <div><h1>${isAdmin ? 'All projects' : 'My students'}</h1><p>${isAdmin ? 'Every project in the department. Use the filters to find the ones you need.' : 'Students whose projects you guide. Click a row to open the project.'}</p></div>
            ${isAdmin ? `<button class="btn" id="export">${icon('download')}Download as spreadsheet</button>` : ''}
        </div>
        <div class="spread" style="margin-bottom:16px">
            <div class="chips" id="filters">${filters.map(([key, label, fn]) => `<button class="chip ${key === filter ? 'active' : ''}" data-filter="${key}">${label}<span class="n">${projects.filter(fn).length}</span></button>`).join('')}</div>
            <div style="position:relative;flex:0 1 300px;min-width:220px"><input class="input" type="search" id="search" placeholder="Search by project or student…" aria-label="Search projects" style="padding-left:38px">
                <span style="position:absolute;left:12px;top:13px;color:var(--faint)">${icon('search')}</span></div>
        </div>
        <div class="card"><div class="table-wrap"><table>
            <thead><tr><th>Project & student</th>${isAdmin ? '<th>Guide</th>' : ''}<th>Where it is</th><th>Milestones</th><th>Next deadline</th><th class="right">Grade</th></tr></thead>
            <tbody id="rows"></tbody>
        </table></div></div>`;

    const visible = () => {
        const fn = filters.find(f => f[0] === filter)[2];
        const q = query.toLowerCase();
        return projects.filter(fn).filter(p => !q || [p.title, p.student_name, p.student_roll, p.guide_name, p.domain].some(v => v && v.toLowerCase().includes(q)));
    };

    function renderRows() {
        const rows = visible();
        const tbody = content.querySelector('#rows');
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}">${App.empty('search', 'No projects here', query ? 'Try a different search.' : 'No projects are at this stage right now.')}</td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map(p => `<tr class="click" data-href="${ProjectUI.link(p.id)}">
            <td><div class="t">${esc(p.title)}</div><div class="s">${esc(p.student_name)}${p.student_roll ? ` · ${esc(p.student_roll)}` : ''}</div></td>
            ${isAdmin ? `<td>${p.guide_name ? esc(p.guide_name) : `<span class="s">Not assigned${p.preferred_guide_name ? ` (wants ${esc(p.preferred_guide_name)})` : ''}</span>`}</td>` : ''}
            <td><div class="row-tight" style="flex-wrap:wrap">${App.statusPill(p.status, 'sm')}${p.status === 'IN_PROGRESS' ? App.healthPill(p.health, 'sm') : ''}</div></td>
            <td style="min-width:150px">${p.milestones_total ? App.progress(p.progress, 'good') : '<span class="s">—</span>'}</td>
            <td class="nowrap">${p.next_deadline && p.status === 'IN_PROGRESS' ? `${App.shortDate(p.next_deadline)}<div class="s">${App.due(p.next_deadline)}</div>` : '<span class="s">—</span>'}</td>
            <td class="right">${p.final_score != null ? `<b>${esc(p.final_grade)}</b><div class="s">${p.final_score}/100</div>` : '<span class="s">—</span>'}</td>
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
        const cols = [['Title', 'title'], ['Student', 'student_name'], ['Roll number', 'student_roll'], ['Area', 'domain'], ['Guide', 'guide_name'],
            ['Stage', 'status_label'], ['Health', 'health'], ['Progress %', 'progress'], ['Milestones done', 'milestones_approved'],
            ['Milestones total', 'milestones_total'], ['Next deadline', 'next_deadline'], ['Final score', 'final_score'], ['Grade', 'final_grade']];
        const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [cols.map(c => cell(c[0])).join(','), ...visible().map(p => cols.map(c => cell(p[c[1]])).join(','))].join('\r\n');
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `projects-${App.todayStr()}.csv` });
        a.click();
        URL.revokeObjectURL(a.href);
    });
    renderRows();
});
