const { api, esc, icon } = App;

App.page({ roles: ['ADMIN'], nav: 'allocation', title: 'Assign guides' }, async (user, content) => {
    async function load() {
        const [projects, faculty] = await Promise.all([api('/projects'), api('/users/faculty')]);
        const waiting = projects.filter(p => p.status === 'APPROVED' || (p.status === 'PROPOSAL_SUBMITTED' && !p.guide_id && !p.preferred_guide_id));
        const assigned = projects.filter(p => p.guide_id && ['IN_PROGRESS', 'FINAL_SUBMISSION', 'PROPOSAL_SUBMITTED', 'CHANGES_REQUESTED'].includes(p.status));
        const byId = Object.fromEntries(faculty.map(f => [f.id, f]));

        const card = (p) => {
            const pref = byId[p.preferred_guide_id];
            const prefFree = pref && pref.active_projects < pref.max_projects;
            return `<li><div class="row-item" style="align-items:flex-start">
                <span class="row-icon violet">${icon('link')}</span>
                <div class="grow">
                    <div class="row-title">${esc(p.title)}</div>
                    <div class="row-meta">${esc(p.student_name)}${p.domain ? ` · ${esc(p.domain)}` : ''} · ${p.status === 'APPROVED' ? 'approved' : 'proposal not reviewed yet'}</div>
                    <div class="row-meta" style="margin-top:4px">${pref ? `Student would like <b>${esc(pref.name)}</b> — ${prefFree ? `${App.plural(pref.max_projects - pref.active_projects, 'free slot')}` : '<b style="color:var(--warn-ink)">full</b>'}` : 'No guide preference'}</div>
                </div>
                <div class="row">
                    ${pref && prefFree ? `<button class="btn btn-primary" data-quick="${p.id}" data-fac="${pref.id}">Assign ${esc(pref.name)}</button><button class="btn" data-choose="${p.id}">Someone else</button>`
                        : `<button class="btn btn-primary" data-choose="${p.id}">Choose a guide</button>`}
                </div>
            </div></li>`;
        };

        content.innerHTML = `
            <div class="page-header"><div><h1>Assign guides</h1><p>Every approved project needs a faculty guide before the student can start work. Where possible, give students the guide they asked for.</p></div></div>
            <div class="grid cols-main">
                <div class="stack">
                    <div class="card">
                        <div class="card-header"><div><h2>Waiting for a guide</h2><p>${waiting.length ? App.plural(waiting.length, 'project') : ''}</p></div></div>
                        ${waiting.length ? `<ul class="rows" style="margin-top:8px">${waiting.map(card).join('')}</ul>`
                            : `<div class="card-body">${App.empty('checkCircle', 'Every approved project has a guide', '', '', 'good')}</div>`}
                    </div>
                    <div class="card">
                        <div class="card-header"><div><h2>Current guides</h2><p>Who is guiding which student</p></div></div>
                        ${assigned.length ? `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Project & student</th><th>Guide</th><th></th></tr></thead><tbody>
                            ${assigned.map(p => `<tr><td><a class="t" href="${ProjectUI.link(p.id)}">${esc(p.title)}</a><div class="s">${esc(p.student_name)}</div></td>
                                <td>${esc(p.guide_name)}</td><td class="right"><button class="btn btn-sm" data-choose="${p.id}">Change</button></td></tr>`).join('')}
                        </tbody></table></div>` : `<div class="card-body">${App.empty('link', 'No guides assigned yet')}</div>`}
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><div><h2>Guides</h2><p>Students supervised out of each guide’s limit</p></div></div>
                    <ul class="rows" style="margin-top:8px">${faculty.map(f => {
                        const full = f.active_projects >= f.max_projects;
                        return `<li><div class="row-item" style="flex-direction:column;align-items:stretch;gap:8px">
                            <div class="spread"><div><div class="row-title">${esc(f.name)}</div><div class="row-meta">${esc(f.expertise || f.department || '')}</div></div>
                                <button class="btn btn-sm btn-ghost" data-capacity="${f.id}" title="Change limit">Limit ${f.max_projects}</button></div>
                            <div class="progress ${full ? '' : 'good'}"><div style="width:${Math.min(100, (f.active_projects / f.max_projects) * 100)}%;${full ? 'background:var(--warn)' : ''}"></div></div>
                            <div class="small ${full ? 'bold' : 'muted'}" style="${full ? 'color:var(--warn-ink)' : ''}">${full ? 'Full' : `${App.plural(f.max_projects - f.active_projects, 'free slot')}`} · ${f.active_projects} active, ${f.completed_projects} completed</div>
                        </div></li>`;
                    }).join('')}</ul>
                </div>
            </div>`;

        content.querySelectorAll('[data-quick]').forEach(b => b.onclick = async () => {
            b.disabled = true;
            try {
                const r = await api(`/projects/${b.dataset.quick}/allocate`, { method: 'POST', body: { faculty_id: Number(b.dataset.fac) } });
                App.toast(r.message);
                App.refreshCounts();
                load();
            } catch (e) { App.toast(e.message, 'error'); b.disabled = false; }
        });
        content.querySelectorAll('[data-choose]').forEach(b => b.onclick = async () => {
            if (await ProjectUI.allocateModal(projects.find(p => p.id === Number(b.dataset.choose)))) load();
        });
        content.querySelectorAll('[data-capacity]').forEach(b => b.onclick = async () => {
            const f = byId[b.dataset.capacity];
            const ok = await App.modal({
                title: `Limit for ${f.name}`,
                subtitle: 'The most students this guide should supervise at once.',
                submitLabel: 'Save',
                body: `<div class="field"><label for="cap">Maximum students</label><input class="input" type="number" id="cap" name="max_projects" min="1" max="20" required value="${f.max_projects}"></div>`,
                onSubmit: async (v) => { await api(`/users/${f.id}/capacity`, { method: 'PUT', body: { max_projects: Number(v.max_projects) } }); App.toast('Limit updated'); },
            });
            if (ok) load();
        });
    }
    await load();
});
