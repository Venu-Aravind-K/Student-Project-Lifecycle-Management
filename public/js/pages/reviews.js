const { api, esc, icon, date, dateTime } = App;

App.page({ roles: ['FACULTY', 'ADMIN'], nav: 'reviews', title: 'Review Queue' }, async (user, content) => {
    async function load() {
        const queue = await api('/milestones/review-queue');
        content.innerHTML = `
            <div class="page-head"><div><h1>Review queue</h1><p>Milestone submissions waiting for a score and decision, oldest first.</p></div></div>
            <div class="card">${queue.length ? `<div class="table-wrap"><table>
                <thead><tr><th>Milestone</th><th>Project</th>${user.role === 'ADMIN' ? '<th>Guide</th>' : ''}<th>Submitted</th><th>Deadline</th><th></th></tr></thead>
                <tbody>${queue.map(q => {
                    const late = q.last_submitted_at && q.last_submitted_at.slice(0, 10) > q.deadline;
                    return `<tr>
                        <td><div class="title">${esc(q.title)}</div><div class="sub">${q.submission_count} file${q.submission_count === 1 ? '' : 's'}</div></td>
                        <td><a href="${ProjectUI.link(q.project_id, 'milestones')}">${esc(q.project_title)}</a><div class="sub">${esc(q.student_name)}</div></td>
                        ${user.role === 'ADMIN' ? `<td>${esc(q.guide_name || '—')}</td>` : ''}
                        <td class="nowrap">${dateTime(q.last_submitted_at)}<div class="sub">${App.ago(q.last_submitted_at)}</div></td>
                        <td class="nowrap">${date(q.deadline)}${late ? `<div><span class="badge serious">${icon('clock')}Late</span></div>` : ''}</td>
                        <td><button class="btn btn-sm btn-primary" data-review="${q.id}" data-project="${q.project_id}">${icon('checkSquare')}Review</button></td>
                    </tr>`;
                }).join('')}</tbody></table></div>`
                : App.empty('check', 'All caught up', 'New milestone submissions will appear here.')}</div>`;

        content.querySelectorAll('[data-review]').forEach(b => b.onclick = async () => {
            b.disabled = true;
            try {
                const detail = await api(`/projects/${b.dataset.project}`);
                const m = detail.milestones.find(x => x.id === Number(b.dataset.review));
                if (await ProjectUI.reviewModal(detail, m)) await load();
            } catch (e) {
                App.toast(e.message, 'error');
            }
            b.disabled = false;
        });
    }
    await load();
});
