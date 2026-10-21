const { api, esc, icon, date } = App;

const VIEWS = [
    ['SUBMITTED', 'Waiting for a decision'],
    ['CHANGES_REQUESTED', 'Sent back for changes'],
    ['APPROVED', 'Approved'],
    ['REJECTED', 'Not approved'],
];

App.page({ roles: ['FACULTY', 'ADMIN'], nav: 'proposals', title: (u) => (u.role === 'ADMIN' ? 'Proposals' : 'Proposals to decide') }, async (user, content) => {
    let view = 'SUBMITTED';
    const isFaculty = user.role === 'FACULTY';
    content.innerHTML = `
        <div class="page-header"><div><h1>${isFaculty ? 'Proposals to decide' : 'Proposals'}</h1>
            <p>${isFaculty ? 'Students who chose you as their guide. Read each proposal and decide. If you approve, you become that student’s guide.'
                : 'Every proposal in the department. If you approve one, you’ll then assign a guide on the Assign guides page.'}</p></div></div>
        <div class="chips" id="views" style="margin-bottom:20px">${VIEWS.map(([k, l]) => `<button class="chip ${k === view ? 'active' : ''}" data-view="${k}">${l}</button>`).join('')}</div>
        <div id="list"></div>`;

    content.querySelector('#views').onclick = (e) => {
        const b = e.target.closest('[data-view]');
        if (!b) return;
        view = b.dataset.view;
        content.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b));
        load();
    };

    function decisionForm(pr) {
        const approveText = isFaculty && !pr.guide_id ? 'You become the guide' : pr.guide_id ? 'Work can start' : 'Then assign a guide';
        return `<form class="stack-md" novalidate>
            <div class="detail-label">Your decision</div>
            <label class="option good"><input type="radio" name="decision" value="APPROVED"><div><strong>Approve</strong><span>${approveText}</span></div></label>
            <label class="option warn"><input type="radio" name="decision" value="CHANGES_REQUESTED"><div><strong>Ask for changes</strong><span>Student edits and resends</span></div></label>
            <label class="option bad"><input type="radio" name="decision" value="REJECTED"><div><strong>Reject</strong><span>Student needs a new idea</span></div></label>
            <textarea class="textarea" name="feedback" rows="4" maxlength="3000" placeholder="Feedback for the student (required unless approving)" aria-label="Feedback"></textarea>
            <div class="form-error hidden" role="alert"></div>
            <button class="btn btn-primary" type="submit">Send decision</button>
        </form>`;
    }

    async function load() {
        const list = content.querySelector('#list');
        list.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
        const proposals = await api(`/proposals?status=${view}`);
        if (!proposals.length) {
            list.innerHTML = `<div class="card">${view === 'SUBMITTED'
                ? App.empty('checkCircle', 'No proposals waiting', 'When a student sends a proposal, it will appear here.', '', 'good')
                : App.empty('file', 'Nothing here')}</div>`;
            return;
        }
        if (view !== 'SUBMITTED') {
            list.innerHTML = `<div class="card"><div class="table-wrap"><table><thead><tr><th>Proposal</th><th>Decided by</th><th>When</th><th>Project now</th></tr></thead><tbody>
                ${proposals.map(pr => `<tr class="click" data-href="${ProjectUI.link(pr.project_id, 'proposal')}">
                    <td><div class="t">${esc(pr.title)}</div><div class="s">${esc(pr.student_name)}${pr.version > 1 ? ` · version ${pr.version}` : ''}</div></td>
                    <td>${esc(pr.reviewer_name || '—')}</td><td class="nowrap">${date(pr.reviewed_at)}</td><td>${App.statusPill(pr.project_status, 'sm')}</td></tr>`).join('')}
            </tbody></table></div></div>`;
            list.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.href = tr.dataset.href; });
            return;
        }

        list.innerHTML = `<div class="stack">${proposals.map(pr => `
            <article class="card" data-id="${pr.id}">
                <div class="card-header">
                    <div class="grow"><div class="eyebrow">${pr.version > 1 ? App.pill(['warn', 'refresh', `Updated version ${pr.version}`], 'sm') : App.pill(['primary', 'file', 'New proposal'], 'sm')}<span>Sent ${App.ago(pr.submitted_at)}</span></div>
                        <h2>${esc(pr.title)}</h2>
                        <p>${esc(pr.student_name)}${pr.student_roll ? ` (${esc(pr.student_roll)})` : ''}${pr.preferred_guide_name ? ` · wants ${esc(pr.preferred_guide_name)} as guide` : ' · no guide preference'}</p></div>
                    <a class="btn btn-sm btn-ghost" href="${ProjectUI.link(pr.project_id, 'proposal')}">Open project${icon('arrowRight')}</a>
                </div>
                <div class="card-body grid cols-main">
                    <dl class="kv">
                        ${pr.domain ? `<dt>Area</dt><dd>${esc(pr.domain)}</dd>` : ''}
                        <dt>The problem</dt><dd>${esc(pr.problem_statement)}</dd>
                        <dt>Goals</dt><dd>${esc(pr.objectives)}</dd>
                        <dt>How it will be built</dt><dd>${esc(pr.methodology)}</dd>
                        <dt>Technologies</dt><dd>${esc(pr.technologies)}</dd>
                        <dt>Expected result</dt><dd>${esc(pr.expected_outcome) || '—'}</dd>
                    </dl>
                    ${decisionForm(pr)}
                </div>
            </article>`).join('')}</div>`;

        list.querySelectorAll('article form').forEach(form => form.onsubmit = async (e) => {
            e.preventDefault();
            const err = form.querySelector('.form-error');
            const v = App.values(form);
            const fail = (m) => { err.innerHTML = `${icon('alertCircle')}<span>${esc(m)}</span>`; err.classList.remove('hidden'); };
            err.classList.add('hidden');
            if (!v.decision) return fail('Choose Approve, Ask for changes, or Reject');
            if (v.decision !== 'APPROVED' && !v.feedback) return fail('Write a short note so the student knows what to do');
            const btn = form.querySelector('[type=submit]');
            btn.disabled = true;
            try {
                const r = await api(`/proposals/${form.closest('article').dataset.id}/review`, { method: 'POST', body: v });
                App.toast(r.message);
                App.refreshCounts();
                load();
            } catch (ex) { fail(ex.message); btn.disabled = false; }
        });
    }
    await load();
});
