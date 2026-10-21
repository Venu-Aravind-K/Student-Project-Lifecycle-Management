const { api, esc, icon, date } = App;

const ROLES = [['ALL', 'Everyone'], ['STUDENT', 'Students'], ['FACULTY', 'Faculty'], ['ADMIN', 'Coordinators']];
const ROLE_PILL = {
    STUDENT: ['', 'graduation', 'Student'],
    FACULTY: ['primary', 'teacher', 'Faculty'],
    ADMIN: ['violet', 'shield', 'Coordinator'],
};

App.page({ roles: ['ADMIN'], nav: 'users', title: 'People' }, async (user, content) => {
    let role = 'ALL';
    let query = '';
    let users = [];

    content.innerHTML = `
        <div class="page-header"><div><h1>People</h1><p>Students can sign up themselves. Add faculty guides and other coordinators here.</p></div>
            <button class="btn btn-primary" id="add-user">${icon('userPlus')}Add person</button></div>
        <div class="spread" style="margin-bottom:16px">
            <div class="chips" id="roles">${ROLES.map(([k, l]) => `<button class="chip ${k === role ? 'active' : ''}" data-role="${k}">${l}</button>`).join('')}</div>
            <input class="input" type="search" id="search" placeholder="Search by name or email…" aria-label="Search people" style="max-width:280px">
        </div>
        <div class="card"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Details</th><th>Joined</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;

    function renderRows() {
        const q = query.toLowerCase();
        const rows = users.filter(u => (role === 'ALL' || u.role === role) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
        content.querySelector('#rows').innerHTML = rows.length ? rows.map(u => `<tr>
            <td><div class="row" style="flex-wrap:nowrap"><span class="avatar">${esc(App.initials(u.name))}</span><div><div class="t">${esc(u.name)}</div><div class="s">${esc(u.email)}</div></div></div></td>
            <td>${App.pill(ROLE_PILL[u.role], 'sm')}</td>
            <td>${esc(u.department || '—')}</td>
            <td class="small">${u.role === 'STUDENT' ? `${esc(u.roll_number || '')}<div class="s">${u.project_title ? esc(u.project_title) : 'No project yet'}</div>`
                : u.role === 'FACULTY' ? `Guiding ${u.guiding} of ${u.max_projects}${u.expertise ? `<div class="s">${esc(u.expertise)}</div>` : ''}` : '—'}</td>
            <td class="nowrap">${date(u.created_at)}</td></tr>`).join('')
            : `<tr><td colspan="5">${App.empty('users', 'No one matches')}</td></tr>`;
    }
    async function load() { users = await api('/users'); renderRows(); }

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
            title: 'Add a person',
            subtitle: 'They can sign in straight away with the email and password you set.',
            submitLabel: 'Add person',
            body: `<div class="field"><span class="label">What is their role?</span><div class="options">
                    <label class="option"><input type="radio" name="role" value="FACULTY" checked><div><strong>Faculty guide</strong><span>Guides and grades students</span></div></label>
                    <label class="option"><input type="radio" name="role" value="STUDENT"><div><strong>Student</strong><span>Does a project</span></div></label>
                    <label class="option"><input type="radio" name="role" value="ADMIN"><div><strong>Coordinator</strong><span>Manages everything</span></div></label></div></div>
                <div class="form-grid">
                    <div class="field"><label for="u-name">Full name</label><input class="input" id="u-name" name="name" required maxlength="100"></div>
                    <div class="field"><label for="u-email">Email</label><input class="input" id="u-email" name="email" type="email" required></div>
                    <div class="field"><label for="u-dept">Department <span class="optional">(optional)</span></label><input class="input" id="u-dept" name="department"></div>
                    <div class="field"><label for="u-pass">Starting password</label><input class="input" id="u-pass" name="password" minlength="6" required><span class="help">At least 6 characters</span></div>
                    <div class="field" data-for="FACULTY"><label for="u-exp">Areas of expertise</label><input class="input" id="u-exp" name="expertise" placeholder="e.g. Machine Learning, IoT"></div>
                    <div class="field" data-for="FACULTY"><label for="u-max">Max students at once</label><input class="input" type="number" id="u-max" name="max_projects" min="1" max="20" value="5"></div>
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
