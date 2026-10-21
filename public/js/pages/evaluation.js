const { api, esc, icon, date } = App;

App.page({ roles: ['FACULTY', 'ADMIN'], nav: 'evaluations', title: 'Final Evaluations' }, async (user, content) => {
    const [pending, completed] = await Promise.all([api('/projects?status=FINAL_SUBMISSION'), api('/projects?status=COMPLETED')]);
    const isAdmin = user.role === 'ADMIN';

    // Grade distribution of completed projects (single series → no legend)
    const GRADES = ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'];
    const counts = GRADES.map(g => completed.filter(p => p.final_grade === g).length);
    const maxCount = Math.max(1, ...counts);
    const avg = completed.length ? (completed.reduce((a, p) => a + (p.final_score || 0), 0) / completed.length).toFixed(1) : null;

    content.innerHTML = `
        <div class="page-head"><div><h1>Final evaluations</h1><p>Projects whose students made the final submission, and results of completed projects.</p></div></div>
        <div class="grid grid-main">
            <div class="stack">
                <div class="card"><div class="card-head"><div><h2>Ready to evaluate</h2><p>${pending.length} waiting</p></div></div>
                    ${pending.length ? `<ul class="list">${pending.map(p => `<li class="row" style="flex-wrap:nowrap">
                        <div class="grow"><b>${esc(p.title)}</b><div class="small muted">${esc(p.student_name)}${isAdmin ? ` · guide ${esc(p.guide_name)}` : ''} · submitted ${App.ago(p.final_submitted_at)} · ${p.milestones_approved}/${p.milestones_total} milestones approved</div></div>
                        <a class="btn btn-sm btn-primary" href="${ProjectUI.link(p.id, 'evaluation')}">${icon('award')}Evaluate</a></li>`).join('')}</ul>`
                        : App.empty('check', 'No final submissions waiting')}
                </div>
                <div class="card"><div class="card-head"><div><h2>Completed</h2><p>${completed.length} project${completed.length === 1 ? '' : 's'}</p></div></div>
                    ${completed.length ? `<div class="table-wrap"><table><thead><tr><th>Project</th>${isAdmin ? '<th>Guide</th>' : ''}<th>Completed</th><th class="num">Score</th><th>Grade</th></tr></thead><tbody>
                        ${completed.map(p => `<tr class="clickable" data-href="${ProjectUI.link(p.id, 'evaluation')}">
                            <td><div class="title">${esc(p.title)}</div><div class="sub">${esc(p.student_name)}</div></td>
                            ${isAdmin ? `<td>${esc(p.guide_name || '—')}</td>` : ''}
                            <td class="nowrap">${date(p.updated_at)}</td><td class="num"><b>${p.final_score ?? '—'}</b></td><td>${p.final_grade ? `<span class="badge good">${esc(p.final_grade)}</span>` : '—'}</td></tr>`).join('')}
                    </tbody></table></div>` : App.empty('award', 'No completed projects yet')}
                </div>
            </div>
            <div class="card"><div class="card-head"><div><h2>Grade distribution</h2><p>Completed projects by final grade</p></div></div>
                <div class="card-body stack">
                    <div><div class="tile-label">Average score</div><div class="tile-value">${avg ?? '—'}${avg ? '<span class="muted" style="font-size:15px"> / 100</span>' : ''}</div></div>
                    <div class="hbar-chart" id="grade-chart" role="img" aria-label="Grade distribution">${GRADES.map((g, i) => `
                        <div class="hbar" data-tip="<b>Grade ${g}</b>${counts[i]} project${counts[i] === 1 ? '' : 's'}">
                            <span class="hbar-label">${g}</span>
                            <div class="hbar-plot"><div class="hbar-fill ${counts[i] ? '' : 'zero'}" style="width:${(counts[i] / maxCount) * 85}%"></div><span class="hbar-value">${counts[i]}</span></div>
                        </div>`).join('')}</div>
                </div>
            </div>
        </div>`;
    App.bindTips(content.querySelector('#grade-chart'));
    content.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.href = tr.dataset.href; });
});
