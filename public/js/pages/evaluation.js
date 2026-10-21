const { api, esc, icon, date } = App;

App.page({ roles: ['FACULTY', 'ADMIN'], nav: 'evaluations', title: 'Final grading' }, async (user, content) => {
    const [pending, completed] = await Promise.all([api('/projects?status=FINAL_SUBMISSION'), api('/projects?status=COMPLETED')]);
    const isAdmin = user.role === 'ADMIN';
    const GRADES = ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'];
    const counts = GRADES.map(g => completed.filter(p => p.final_grade === g).length);
    const top = Math.max(1, ...counts);
    const avg = completed.length ? (completed.reduce((a, p) => a + (p.final_score || 0), 0) / completed.length).toFixed(1) : null;

    content.innerHTML = `
        <div class="page-header"><div><h1>Final grading</h1>
            <p>When a student finishes every milestone and submits the project, it appears here to be graded out of 100.</p></div></div>
        <div class="grid cols-main">
            <div class="stack">
                <div class="card">
                    <div class="card-header"><div><h2>Ready to grade</h2><p>${pending.length ? 'These students are waiting for their final grade.' : ''}</p></div></div>
                    ${pending.length ? `<ul class="rows" style="margin-top:8px">${pending.map(p => `<li><div class="row-item">
                        <span class="row-icon violet">${icon('award')}</span>
                        <div class="grow"><div class="row-title">${esc(p.title)}</div><div class="row-meta">${esc(p.student_name)}${isAdmin ? ` · guide ${esc(p.guide_name)}` : ''} · submitted ${App.ago(p.final_submitted_at)}</div></div>
                        <a class="btn btn-primary" href="${ProjectUI.link(p.id, 'grade')}">Give grade</a></div></li>`).join('')}</ul>`
                        : `<div class="card-body">${App.empty('checkCircle', 'Nothing to grade right now', '', '', 'good')}</div>`}
                </div>
                <div class="card">
                    <div class="card-header"><div><h2>Already graded</h2><p>${App.plural(completed.length, 'project')}</p></div></div>
                    ${completed.length ? `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Project & student</th>${isAdmin ? '<th>Guide</th>' : ''}<th>Graded</th><th class="right">Score</th><th class="right">Grade</th></tr></thead><tbody>
                        ${completed.map(p => `<tr class="click" data-href="${ProjectUI.link(p.id, 'grade')}">
                            <td><div class="t">${esc(p.title)}</div><div class="s">${esc(p.student_name)}</div></td>
                            ${isAdmin ? `<td>${esc(p.guide_name || '—')}</td>` : ''}
                            <td class="nowrap">${date(p.updated_at)}</td><td class="right num">${p.final_score ?? '—'}/100</td><td class="right"><b>${esc(p.final_grade || '—')}</b></td></tr>`).join('')}
                    </tbody></table></div>` : `<div class="card-body">${App.empty('award', 'No graded projects yet')}</div>`}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><div><h2>Grades given</h2><p>Number of projects per grade</p></div></div>
                <div class="card-body stack">
                    <div><div class="summary-value">${avg ?? '—'}</div><div class="summary-label">Average score out of 100</div></div>
                    <div class="bars">${GRADES.map((g, i) => `<div class="bar-row" style="grid-template-columns:36px minmax(0,1fr) 30px"><span class="name bold">${g}</span>
                        <div class="bar-track"><div style="width:${(counts[i] / top) * 100}%"></div></div><span class="val">${counts[i]}</span></div>`).join('')}</div>
                    <p class="small muted">O ≥ 90 · A+ ≥ 80 · A ≥ 70 · B+ ≥ 60 · B ≥ 50 · C ≥ 40 · F below 40</p>
                </div>
            </div>
        </div>`;
    content.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.href = tr.dataset.href; });
});
