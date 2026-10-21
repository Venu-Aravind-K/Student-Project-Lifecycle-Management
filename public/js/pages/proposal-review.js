const { api, esc, icon, date } = App;

const VIEWS = [
    ['SUBMITTED', 'Awaiting decision'],
    ['CHANGES_REQUESTED', 'Changes requested'],
    ['APPROVED', 'Approved'],
    ['REJECTED', 'Rejected'],
];

App.page({ roles: ['FACULTY', 'ADMIN'], nav: 'proposals', title: 'Proposals' }, async (user, content) => {
    let view = 'SUBMITTED';
    content.innerHTML = `
        <div class="page-head"><div><h1>Proposals</h1><p>${user.role === 'ADMIN'
            ? 'All proposals in the department. Approving without a guide sends the project to guide allocation.'
            : 'Proposals from students who chose you as their guide. Approving one makes you its guide.'}</p></div></div>
        <nav class="tabs" id="views">${VIEWS.map(([k, l]) => `<button class="tab ${k === view ? 'active' : ''}" data-view="${k}">${l}</button>`).join('')}</nav>
        <div id="list"></div>`;

    content.querySelector('#views').onclick = (e) => {
        const b = e.target.closest('[data-view]');
        if (!b) return;
        view = b.dataset.view;
        content.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b));
        load();
    };

    async function load() {
        const list = content.querySelector('#list');
        list.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
        const proposals = await api(`/proposals?status=${view}`);
        if (!proposals.length) {
            list.innerHTML = `<div class="card">${App.empty(view === 'SUBMITTED' ? 'check' : 'file', view === 'SUBMITTED' ? 'No proposals waiting' : 'Nothing here yet')}</div>`;
            return;
        }
        if (view !== 'SUBMITTED') {
            list.innerHTML = `<div class="card"><div class="table-wrap"><table><thead><tr><th>Proposal</th><th>Version</th><th>Reviewed by</th><th>Reviewed</th><th>Project status</th></tr></thead><tbody>
                ${proposals.map(pr => `<tr class="clickable" data-href="${ProjectUI.link(pr.project_id, 'proposal')}">
                    <td><div class="title">${esc(pr.title)}</div><div class="sub">${esc(pr.student_name)}${pr.student_roll ? ` · ${esc(pr.student_roll)}` : ''}</div></td>
                    <td>v${pr.version}</td><td>${esc(pr.reviewer_name || '—')}</td><td class="nowrap">${date(pr.reviewed_at)}</td><td>${App.statusBadge(pr.project_status)}</td></tr>`).join('')}
            </tbody></table></div></div>`;
            list.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.href = tr.dataset.href; });
            return;
        }

        list.innerHTML = `<div class="stack">${proposals.map(pr => `
            <article class="card" data-id="${pr.id}">
                <div class="card-head">
                    <div class="grow"><div class="row"><h2>${esc(pr.title)}</h2>${pr.version > 1 ? `<span class="badge warning">${icon('rotate')}Resubmission v${pr.version}</span>` : ''}</div>
                        <p>${esc(pr.student_name)}${pr.student_roll ? ` · ${esc(pr.student_roll)}` : ''} · submitted ${App.ago(pr.submitted_at)}${pr.preferred_guide_name ? ` · prefers ${esc(pr.preferred_guide_name)}` : ''}${pr.guide_name ? ` · guide ${esc(pr.guide_name)}` : ''}</p></div>
                    <a class="btn btn-sm" href="${ProjectUI.link(pr.project_id, 'proposal')}">Open project</a>
                </div>
                <div class="grid grid-main card-body">
                    <dl class="dl">
                        ${pr.domain ? `<dt>Domain</dt><dd>${esc(pr.domain)}</dd>` : ''}
                        <dt>Problem</dt><dd>${esc(pr.problem_statement)}</dd>
                        <dt>Objectives</dt><dd>${esc(pr.objectives)}</dd>
                        <dt>Methodology</dt><dd>${esc(pr.methodology)}</dd>
                        <dt>Technologies</dt><dd>${esc(pr.technologies)}</dd>
                        <dt>Expected outcome</dt><dd>${esc(pr.expected_outcome) || '—'}</dd>
                    </dl>
                    <form class="stack" novalidate>
                        <div class="stack-sm">
                            <label class="choice"><input type="radio" name="decision" value="APPROVED"><div><strong>Approve</strong><span>${user.role === 'FACULTY' && !pr.guide_id ? 'You become the guide' : pr.guide_id ? 'Project starts' : 'Goes to guide allocation'}</span></div></label>
                            <label class="choice"><input type="radio" name="decision" value="CHANGES_REQUESTED"><div><strong>Request changes</strong><span>Student revises</span></div></label>
                            <label class="choice"><input type="radio" name="decision" value="REJECTED"><div><strong>Reject</strong><span>New idea needed</span></div></label>
                        </div>
                        <textarea class="textarea" name="feedback" rows="4" maxlength="3000" placeholder="Feedback (required unless approving)" aria-label="Feedback"></textarea>
                        <div class="form-error hidden" role="alert"></div>
                        <button class="btn btn-primary" type="submit">Submit decision</button>
                    </form>
                </div>
            </article>`).join('')}</div>`;

        list.querySelectorAll('article form').forEach(form => form.onsubmit = async (e) => {
            e.preventDefault();
            const id = form.closest('article').dataset.id;
            const err = form.querySelector('.form-error');
            const v = App.values(form);
            err.classList.add('hidden');
            const fail = (m) => { err.textContent = m; err.classList.remove('hidden'); };
            if (!v.decision) return fail('Choose a decision');
            if (v.decision !== 'APPROVED' && !v.feedback) return fail('Add feedback so the student knows what to change');
            form.querySelector('[type=submit]').disabled = true;
            try {
                const r = await api(`/proposals/${id}/review`, { method: 'POST', body: v });
                App.toast(r.message);
                load();
            } catch (ex) {
                fail(ex.message);
                form.querySelector('[type=submit]').disabled = false;
            }
        });
    }

    await load();
});
