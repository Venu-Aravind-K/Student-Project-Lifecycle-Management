const { api, esc, icon } = App;

App.page({ roles: ['ADMIN'], nav: 'allocation', title: 'Guide Allocation' }, async (user, content) => {
    async function load() {
        const [projects, faculty] = await Promise.all([api('/projects'), api('/users/faculty')]);
        const unassigned = projects.filter(p => p.status === 'APPROVED' || (p.status === 'PROPOSAL_SUBMITTED' && !p.guide_id));
        const assigned = projects.filter(p => p.guide_id && ['IN_PROGRESS', 'FINAL_SUBMISSION', 'PROPOSAL_SUBMITTED', 'CHANGES_REQUESTED'].includes(p.status));

        const options = (p) => faculty.map(f => {
            const full = f.active_projects >= f.max_projects;
            return `<option value="${f.id}" ${f.id === p.preferred_guide_id ? 'selected' : ''}>${esc(f.name)} (${f.active_projects}/${f.max_projects}${full ? ', full' : ''})${f.id === p.preferred_guide_id ? ' ★' : ''}</option>`;
        }).join('');

        content.innerHTML = `
            <div class="page-head"><div><h1>Guide allocation</h1><p>Match approved projects to faculty guides. ★ marks the student's preferred guide; numbers show active projects / capacity.</p></div></div>
            <div class="grid grid-main">
                <div class="stack">
                    <div class="card"><div class="card-head"><div><h2>Needs a guide</h2><p>Approved projects, and proposals with no reviewer yet</p></div></div>
                        ${unassigned.length ? `<ul class="list">${unassigned.map(p => `<li>
                            <div class="row" style="align-items:flex-start">
                                <div class="grow" style="min-width:220px"><div class="row"><a href="${ProjectUI.link(p.id)}"><b>${esc(p.title)}</b></a>${App.statusBadge(p.status)}</div>
                                    <div class="small muted">${esc(p.student_name)}${p.domain ? ` · ${esc(p.domain)}` : ''}${p.preferred_guide_name ? ` · prefers ${esc(p.preferred_guide_name)}` : ' · no preference'}</div>
                                    ${p.status === 'PROPOSAL_SUBMITTED' ? '<div class="small muted">Allocating now lets that guide review the proposal.</div>' : ''}</div>
                                <form class="row" data-project="${p.id}" style="flex-wrap:nowrap">
                                    <select class="select" name="faculty_id" required aria-label="Guide for ${esc(p.title)}" style="width:auto;max-width:240px"><option value="">Choose guide…</option>${options(p)}</select>
                                    <button class="btn btn-primary" type="submit">Allocate</button>
                                </form>
                            </div></li>`).join('')}</ul>` : App.empty('check', 'Every approved project has a guide')}
                    </div>
                    <div class="card"><div class="card-head"><div><h2>Current allocations</h2><p>${assigned.length} active</p></div></div>
                        ${assigned.length ? `<div class="table-wrap"><table><thead><tr><th>Project</th><th>Guide</th><th>Status</th><th></th></tr></thead><tbody>
                            ${assigned.map(p => `<tr><td><a href="${ProjectUI.link(p.id)}" class="title">${esc(p.title)}</a><div class="sub">${esc(p.student_name)}</div></td>
                                <td>${esc(p.guide_name)}</td><td>${App.statusBadge(p.status)}</td>
                                <td><button class="btn btn-sm" data-reassign="${p.id}">Reassign</button></td></tr>`).join('')}
                        </tbody></table></div>` : App.empty('link', 'No allocations yet')}
                    </div>
                </div>
                <div class="card"><div class="card-head"><div><h2>Faculty workload</h2><p>Active projects / capacity</p></div></div>
                    <ul class="list">${faculty.map(f => {
                        const pct = Math.min(100, Math.round((f.active_projects / f.max_projects) * 100));
                        const state = f.active_projects > f.max_projects ? `<span class="badge critical">${icon('alert')}Over capacity</span>`
                            : f.active_projects === f.max_projects ? `<span class="badge warning">${icon('clock')}Full</span>` : '';
                        return `<li class="stack-sm">
                            <div class="row-between"><div><b>${esc(f.name)}</b><div class="small muted">${esc(f.expertise || f.department || '')}</div></div>
                                <div class="row">${state}<button class="btn btn-sm btn-ghost" data-capacity="${f.id}" title="Change capacity">${f.active_projects}/${f.max_projects}</button></div></div>
                            ${App.meter(pct)}
                            <div class="small muted">${f.completed_projects} completed</div></li>`;
                    }).join('')}</ul>
                </div>
            </div>`;

        content.querySelectorAll('form[data-project]').forEach(form => form.onsubmit = async (e) => {
            e.preventDefault();
            if (!form.reportValidity()) return;
            form.querySelector('button').disabled = true;
            try {
                const r = await api(`/projects/${form.dataset.project}/allocate`, { method: 'POST', body: App.values(form) });
                App.toast(r.message);
                load();
            } catch (ex) {
                App.toast(ex.message, 'error');
                form.querySelector('button').disabled = false;
            }
        });
        content.querySelectorAll('[data-reassign]').forEach(b => b.onclick = async () => {
            if (await ProjectUI.allocateModal(projects.find(p => p.id === Number(b.dataset.reassign)))) load();
        });
        content.querySelectorAll('[data-capacity]').forEach(b => b.onclick = async () => {
            const f = faculty.find(x => x.id === Number(b.dataset.capacity));
            const ok = await App.modal({
                title: `Capacity · ${f.name}`,
                submitLabel: 'Save',
                body: `<div class="field"><label for="cap">Maximum active projects</label><input class="input" type="number" id="cap" name="max_projects" min="1" max="20" required value="${f.max_projects}"></div>`,
                onSubmit: async (v) => { await api(`/users/${f.id}/capacity`, { method: 'PUT', body: { max_projects: Number(v.max_projects) } }); App.toast('Capacity updated'); },
            });
            if (ok) load();
        });
    }
    await load();
});
