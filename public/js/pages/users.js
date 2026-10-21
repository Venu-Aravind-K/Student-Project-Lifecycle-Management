const { api, esc, icon, date } = App;

const ROLES = [['ALL', 'Everyone'], ['STUDENT', 'Students'], ['FACULTY', 'Faculty'], ['ADMIN', 'Admins']];
const ROLE_BADGE = { STUDENT: '<span class="badge">Student</span>', FACULTY: '<span class="badge blue">Faculty</span>', ADMIN: '<span class="badge violet">Admin</span>' };

App.page({ roles: ['ADMIN'], nav: 'users', title: 'Users' }, async (user, content) => {
    let role = 'ALL';
    let query = '';
    let users = [];

    content.innerHTML = `
        <div class="page-head"><div><h1>Users</h1><p>Students can register themselves; add faculty guides and coordinators here.</p></div>
            <button class="btn btn-primary" id="add-user">${icon('plus')}Add user</button></div>
        <div class="card">
            <div class="card-head">
                <div class="segmented" id="roles">${ROLES.map(([k, l]) => `<button class="${k === role ? 'active' : ''}" data-role="${k}">${l}</button>`).join('')}</div>
                <input class="input" type="search" id="search" placeholder="Search name or email…" aria-label="Search users" style="max-width:260px">
            </div>
            <div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Details</th><th>Joined</th></tr></thead><tbody id="rows"></tbody></table></div>
        </div>`;

    function renderRows() {
        const q = query.toLowerCase();
        const rows = users.filter(u => (role === 'ALL' || u.role === role) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
        content.querySelector('#rows').innerHTML = rows.length ? rows.map(u => `<tr>
            <td><div class="row" style="flex-wrap:nowrap"><span class="avatar">${esc(App.initials(u.name))}</span><div><div class="title">${esc(u.name)}</div><div class="sub">${esc(u.email)}</div></div></div></td>
            <td>${ROLE_BADGE[u.role]}</td>
            <td>${esc(u.department || '—')}</td>
            <td class="small">${u.role === 'STUDENT' ? `${esc(u.roll_number || '')}${u.project_title ? `<div class="sub">${esc(u.project_title)}</div>` : '<div class="sub">No project yet</div>'}`
                : u.role === 'FACULTY' ? `${u.guiding}/${u.max_projects} active${u.expertise ? `<div class="sub">${esc(u.expertise)}</div>` : ''}` : '—'}</td>
            <td class="nowrap">${date(u.created_at)}</td></tr>`).join('')
            : `<tr><td colspan="5">${App.empty('users', 'No users match')}</td></tr>`;
    }

    async function load() {
        users = await api('/users');
        renderRows();
    }

    content.querySelector('#roles').onclick = (e) => {
        const b = e.target.closest('[data-role]');
        if (!b) return;
        role = b.dataset.role;
        content.querySelectorAll('[data-role]').forEach(x => x.classList.toggle('active', x === b));
        renderRows();
    };
    content.querySelector('#search').oninput = (e) => { query = e.target.value.trim(); renderRows(); };
    content.querySelector('#add-user').onclick = async () => {
        const ok = await App.modal({
            title: 'Add user',
            submitLabel: 'Add user',
            body: `<div class="field"><span class="label">Role</span><div class="choice-group">
                    <label class="choice"><input type="radio" name="role" value="FACULTY" checked><div><strong>Faculty guide</strong><span>Reviews and guides projects</span></div></label>
                    <label class="choice"><input type="radio" name="role" value="STUDENT"><div><strong>Student</strong><span>Proposes a project</span></div></label>
                    <label class="choice"><input type="radio" name="role" value="ADMIN"><div><strong>Coordinator</strong><span>Full admin access</span></div></label></div></div>
                <div class="form-grid">
                    <div class="field"><label for="u-name">Full name</label><input class="input" id="u-name" name="name" required maxlength="100"></div>
                    <div class="field"><label for="u-email">Email</label><input class="input" id="u-email" name="email" type="email" required></div>
                    <div class="field"><label for="u-dept">Department</label><input class="input" id="u-dept" name="department"></div>
                    <div class="field"><label for="u-pass">Temporary password</label><input class="input" id="u-pass" name="password" minlength="6" required></div>
                    <div class="field" data-for="FACULTY"><label for="u-exp">Expertise</label><input class="input" id="u-exp" name="expertise" placeholder="e.g. Machine Learning, IoT"></div>
                    <div class="field" data-for="FACULTY"><label for="u-max">Project capacity</label><input class="input" type="number" id="u-max" name="max_projects" min="1" max="20" value="5"></div>
                    <div class="field hidden" data-for="STUDENT"><label for="u-roll">Roll number</label><input class="input" id="u-roll" name="roll_number"></div>
                </div>`,
            onOpen: (form) => {
                const sync = () => {
                    const r = form.querySelector('[name=role]:checked').value;
                    form.querySelectorAll('[data-for]').forEach(el => el.classList.toggle('hidden', el.dataset.for !== r));
                };
                form.addEventListener('change', sync);
                sync();
            },
            onSubmit: async (v) => { const r = await api('/users', { method: 'POST', body: v }); App.toast(r.message); },
        });
        if (ok) load();
    };
    await load();
});
