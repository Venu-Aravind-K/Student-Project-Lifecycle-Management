const { api, esc, icon, date } = App;
const UI = ProjectUI;

App.page({ roles: ['FACULTY'], nav: 'dashboard', title: 'Home' }, async (user, content) => {
    const d = await api('/dashboard/faculty');
    const link = UI.link;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const finals = d.projects.filter(p => p.status === 'FINAL_SUBMISSION');
    const total = d.proposals.length + d.queue.length + finals.length;

    const row = (tone, ic, title, meta, href, cta) => `<li><div class="row-item">
        <span class="row-icon ${tone}">${icon(ic)}</span>
        <div class="grow"><div class="row-title">${title}</div><div class="row-meta">${meta}</div></div>
        <a class="btn btn-primary btn-sm" href="${href}">${cta}</a></div></li>`;
    const group = (label, items) => (items.length ? `<div class="group-label">${label}<span class="n">${items.length}</span></div><ul class="rows">${items.join('')}</ul>` : '');

    const todo = total ? [
        group('Proposals to decide', d.proposals.map(pr => row('', 'file', esc(pr.title),
            `${esc(pr.student_name)} · sent ${App.ago(pr.submitted_at)}${pr.version > 1 ? ' · updated version' : ''}`, link(pr.project_id, 'proposal'), 'Read & decide'))),
        group('Work to review', d.queue.map(q => row('', 'clipboard', esc(q.title),
            `${esc(q.student_name)} · uploaded ${App.ago(q.last_submitted_at)}`, link(q.project_id, 'milestones'), 'Review work'))),
        group('Projects to grade', finals.map(p => row('violet', 'award', esc(p.title),
            `${esc(p.student_name)} · submitted ${App.ago(p.final_submitted_at)}`, link(p.id, 'grade'), 'Give grade'))),
    ].join('') : App.empty('checkCircle', 'You’re all caught up', 'New proposals, uploaded work and projects to grade will show up here.', '', 'good');

    const active = d.projects.filter(p => ['IN_PROGRESS', 'FINAL_SUBMISSION'].includes(p.status));
    const behind = active.filter(p => p.health === 'DELAYED').length;

    content.innerHTML = `
        <div class="page-header"><div><h1>${greeting}, ${esc(user.name)}</h1>
            <p>${total ? `You have <b>${App.plural(total, 'thing')}</b> waiting for you.` : 'Nothing is waiting for you right now.'} You’re guiding ${App.plural(active.length, 'student')}${behind ? `, and <b style="color:var(--bad-ink)">${behind} ${behind === 1 ? 'is' : 'are'} behind schedule</b>` : ''}.</p></div></div>
        <div class="grid cols-main">
            <div class="stack">
                <div class="card">
                    <div class="card-header"><div><h2>Waiting for you</h2><p>Oldest first. Click a button to open the right page.</p></div></div>
                    <div style="padding-bottom:8px">${todo}</div>
                </div>
            </div>
            <div class="stack">
                <div class="card">
                    <div class="card-header"><div><h2>Coming up</h2><p>Deadlines your students are working towards</p></div></div>
                    ${d.upcoming.length ? `<ul class="rows" style="margin-top:8px">${d.upcoming.map(m => `<li><a class="row-item" href="${link(m.project_id, 'milestones')}">
                        <div class="grow"><div class="row-title truncate">${esc(m.title)}</div><div class="row-meta">${esc(m.student_name)}</div></div>
                        ${m.overdue ? App.pill(['bad', 'alert', 'Overdue'], 'sm') : `<span class="small muted nowrap">${App.shortDate(m.deadline)}</span>`}</a></li>`).join('')}</ul>`
                        : `<div class="card-body">${App.empty('calendar', 'No open deadlines')}</div>`}
                </div>
                <div class="card card-pad">
                    <div class="detail-label">What the labels mean</div>
                    <div class="stack-md">${Object.values(App.HEALTH).map(h => `<div>${App.pill(h, 'sm')}<p class="small muted" style="margin-top:4px">${h[3]}</p></div>`).join('')}</div>
                </div>
            </div>
        </div>
        <div style="margin-top:20px">
                <div class="card">
                    <div class="card-header"><div><h2>My students</h2><p>Click a row to open the project.</p></div><a class="btn btn-sm" href="faculty-projects.html">See all</a></div>
                    ${active.length ? `<div class="table-wrap" style="margin-top:12px"><table>
                        <thead><tr><th>Student & project</th><th>How it’s going</th><th>Milestones</th><th>Next deadline</th></tr></thead>
                        <tbody>${active.map(p => `<tr class="click" data-href="${link(p.id)}">
                            <td><div class="t">${esc(p.student_name)}</div><div class="s truncate" style="max-width:280px">${esc(p.title)}</div></td>
                            <td>${p.status === 'IN_PROGRESS' ? App.healthPill(p.health) : App.statusPill(p.status)}</td>
                            <td style="min-width:150px">${p.milestones_total ? App.progress(p.progress, 'good') : '<span class="s">None yet</span>'}</td>
                            <td class="nowrap">${p.next_deadline && p.status === 'IN_PROGRESS' ? `${App.shortDate(p.next_deadline)}<div class="s">${App.due(p.next_deadline)}</div>` : '—'}</td></tr>`).join('')}
                        </tbody></table></div>` : App.empty('users', 'No students yet', 'When you approve a proposal or the coordinator assigns you a student, they’ll appear here.')}
                </div>
        </div>`;
    content.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.href = tr.dataset.href; });
});
