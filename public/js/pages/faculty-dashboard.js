const { api, esc, icon, date } = App;

App.page({ roles: ['FACULTY'], nav: 'dashboard', title: 'Dashboard' }, async (user, content) => {
    const d = await api('/dashboard/faculty');
    const s = d.stats;
    const link = ProjectUI.link;

    const tile = (href, label, value, note, alert) =>
        `<a class="card tile" href="${href}"><span class="tile-label">${label}</span><span class="tile-value">${value}</span><span class="tile-note">${alert && value ? `<span class="badge critical">${icon('alert')}${note}</span>` : note}</span></a>`;

    const finals = d.projects.filter(p => p.status === 'FINAL_SUBMISSION');
    const todo = [
        ...d.proposals.map(pr => ({ when: pr.submitted_at, html: `<span class="badge blue">${icon('file')}Proposal</span><div class="grow"><b>${esc(pr.title)}</b><div class="small muted">${esc(pr.student_name)} · v${pr.version} · ${App.ago(pr.submitted_at)}</div></div>`, href: link(pr.project_id, 'proposal'), cta: 'Review' })),
        ...d.queue.map(q => ({ when: q.last_submitted_at, html: `<span class="badge blue">${icon('upload')}Submission</span><div class="grow"><b>${esc(q.title)}</b><div class="small muted">${esc(q.student_name)} · ${esc(q.project_title)} · ${App.ago(q.last_submitted_at)}</div></div>`, href: link(q.project_id, 'milestones'), cta: 'Review' })),
        ...finals.map(p => ({ when: p.final_submitted_at, html: `<span class="badge violet">${icon('award')}Final</span><div class="grow"><b>${esc(p.title)}</b><div class="small muted">${esc(p.student_name)} · submitted ${App.ago(p.final_submitted_at)}</div></div>`, href: link(p.id, 'evaluation'), cta: 'Evaluate' })),
    ].sort((a, b) => String(a.when).localeCompare(String(b.when)));

    const active = d.projects.filter(p => ['IN_PROGRESS', 'FINAL_SUBMISSION'].includes(p.status));
    content.innerHTML = `
        <div class="page-head"><div><h1>Welcome, ${esc(user.name)}</h1><p>${todo.length ? `${todo.length} item${todo.length > 1 ? 's' : ''} need${todo.length > 1 ? '' : 's'} your attention.` : 'You are all caught up.'}</p></div></div>
        <div class="tiles">
            ${tile('faculty-projects.html', 'Projects guiding', s.guiding, `${s.completed} completed`)}
            ${tile('proposal-review.html', 'Proposals to review', s.pendingProposals, 'Awaiting your decision')}
            ${tile('reviews.html', 'Submissions to review', s.reviewQueue, 'Milestone deliverables')}
            ${tile('evaluation.html', 'Final evaluations', s.awaitingEvaluation, 'Ready to grade')}
            ${tile('faculty-projects.html', 'Delayed projects', s.delayed, 'Behind schedule', true)}
        </div>
        <div class="grid grid-main">
            <div class="stack">
                <div class="card"><div class="card-head"><div><h2>Needs your attention</h2><p>Oldest first</p></div></div>
                    ${todo.length ? `<ul class="list">${todo.map(t => `<li><div class="row" style="flex-wrap:nowrap">${t.html}<a class="btn btn-sm btn-primary" href="${t.href}">${t.cta}</a></div></li>`).join('')}</ul>`
                        : App.empty('check', 'Nothing waiting on you', 'New proposals, submissions and final submissions will appear here.')}
                </div>
                <div class="card"><div class="card-head"><div><h2>Active projects</h2><p>${active.length} under your guidance</p></div><a class="btn btn-sm" href="faculty-projects.html">All projects</a></div>
                    ${active.length ? `<div class="table-wrap"><table><thead><tr><th>Project</th><th>Health</th><th>Progress</th><th>Next deadline</th></tr></thead><tbody>
                        ${active.map(p => `<tr class="clickable" data-href="${link(p.id)}">
                            <td><div class="title">${esc(p.title)}</div><div class="sub">${esc(p.student_name)}${p.awaiting_review ? ` · <b>${p.awaiting_review} to review</b>` : ''}</div></td>
                            <td>${p.health ? App.healthBadge(p.health) : App.statusBadge(p.status)}</td>
                            <td>${App.meter(p.progress)}</td>
                            <td class="nowrap">${p.next_deadline ? `${date(p.next_deadline)}<div class="sub">${App.due(p.next_deadline)}</div>` : '—'}</td></tr>`).join('')}
                    </tbody></table></div>` : App.empty('folder', 'No active projects', 'Approve a proposal or wait for the coordinator to allocate one.')}
                </div>
            </div>
            <div class="card"><div class="card-head"><div><h2>Upcoming deadlines</h2><p>Open milestones across your projects</p></div></div>
                ${d.upcoming.length ? `<ul class="list">${d.upcoming.map(m => `<li><a class="item" href="${link(m.project_id, 'milestones')}">
                    <div class="row-between"><b>${esc(m.title)}</b>${m.overdue ? `<span class="badge critical">${icon('alert')}Overdue</span>` : `<span class="small muted">${App.due(m.deadline)}</span>`}</div>
                    <div class="small muted">${esc(m.student_name)} · ${date(m.deadline)}</div></a></li>`).join('')}</ul>` : App.empty('clock', 'No open deadlines')}
            </div>
        </div>`;

    content.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.href = tr.dataset.href; });
});
