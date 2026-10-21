const { api, esc, icon } = App;

App.page({ roles: ['FACULTY', 'ADMIN'], nav: 'reviews', title: 'Work to review' }, async (user, content) => {
    async function load() {
        const queue = await api('/milestones/review-queue');
        content.innerHTML = `
            <div class="page-header"><div><h1>Work to review</h1>
                <p>Students uploaded this work for a milestone. Open each one, give a score, and either approve it or ask for changes.</p></div></div>
            <div class="card">${queue.length ? `<ul class="rows">${queue.map(q => {
                const late = q.last_submitted_at && q.last_submitted_at.slice(0, 10) > q.deadline;
                return `<li><div class="row-item">
                    <span class="row-icon">${icon('clipboard')}</span>
                    <div class="grow"><div class="row-title">${esc(q.title)}</div>
                        <div class="row-meta">${esc(q.student_name)} · <a href="${ProjectUI.link(q.project_id, 'milestones')}">${esc(q.project_title)}</a>${user.role === 'ADMIN' && q.guide_name ? ` · guide ${esc(q.guide_name)}` : ''}</div>
                        <div class="row-meta">Uploaded ${App.ago(q.last_submitted_at)} · ${App.plural(q.submission_count, 'file')}</div></div>
                    ${late ? App.pill(['warn', 'clock', 'Uploaded late'], 'sm') : ''}
                    <button class="btn btn-primary" data-review="${q.id}" data-project="${q.project_id}">Review work</button>
                </div></li>`;
            }).join('')}</ul>` : App.empty('checkCircle', 'You’re all caught up', 'When a student uploads work for a milestone, it will appear here.', '', 'good')}</div>`;

        content.querySelectorAll('[data-review]').forEach(b => b.onclick = async () => {
            b.disabled = true;
            try {
                const detail = await api(`/projects/${b.dataset.project}`);
                const m = detail.milestones.find(x => x.id === Number(b.dataset.review));
                if (await ProjectUI.reviewModal(detail, m)) await load();
            } catch (e) { App.toast(e.message, 'error'); }
            b.disabled = false;
        });
    }
    await load();
});
