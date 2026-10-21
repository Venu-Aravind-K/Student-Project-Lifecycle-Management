/* ProjectFlow shared front-end runtime: API client, app shell, formatting and UI helpers. */
(function () {
    // Theme is applied before first paint to avoid a flash
    try {
        const t = localStorage.getItem('theme');
        if (t) document.documentElement.dataset.theme = t;
    } catch { /* storage unavailable */ }

    const ICONS = {
        logo: '<path d="M4 4h6v6H4zM14 14h6v6h-6z"/><path d="M10 7h4a3 3 0 0 1 3 3v4"/>',
        home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
        folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
        file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
        inbox: '<path d="M3 13h5l1 3h6l1-3h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
        check: '<path d="m5 12 5 5 9-10"/>',
        checkSquare: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
        award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
        users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
        bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
        logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
        download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.5"/>',
        alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
        x: '<path d="M6 6l12 12M18 6 6 18"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
        trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
        send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
        arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
        circle: '<circle cx="12" cy="12" r="8"/>',
        rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
        sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    };
    const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

    const NAV = {
        STUDENT: [
            { key: 'dashboard', href: 'student-dashboard.html', label: 'Dashboard', icon: 'home' },
            { key: 'project', href: 'project-details.html', label: 'My Project', icon: 'folder' },
            { key: 'proposal', href: 'proposal.html', label: 'Proposal', icon: 'file' },
        ],
        FACULTY: [
            { key: 'dashboard', href: 'faculty-dashboard.html', label: 'Dashboard', icon: 'home' },
            { key: 'projects', href: 'faculty-projects.html', label: 'My Projects', icon: 'folder' },
            { key: 'proposals', href: 'proposal-review.html', label: 'Proposals', icon: 'file' },
            { key: 'reviews', href: 'reviews.html', label: 'Review Queue', icon: 'checkSquare' },
            { key: 'evaluations', href: 'evaluation.html', label: 'Final Evaluations', icon: 'award' },
        ],
        ADMIN: [
            { key: 'dashboard', href: 'admin-dashboard.html', label: 'Dashboard', icon: 'home' },
            { key: 'projects', href: 'projects.html', label: 'All Projects', icon: 'folder' },
            { key: 'proposals', href: 'proposal-review.html', label: 'Proposals', icon: 'file' },
            { key: 'allocation', href: 'faculty-allocation.html', label: 'Guide Allocation', icon: 'link' },
            { key: 'evaluations', href: 'evaluation.html', label: 'Evaluations', icon: 'award' },
            { key: 'users', href: 'users.html', label: 'Users', icon: 'users' },
        ],
    };
    const HOME = { STUDENT: 'student-dashboard.html', FACULTY: 'faculty-dashboard.html', ADMIN: 'admin-dashboard.html' };
    const ROLE_LABEL = { STUDENT: 'Student', FACULTY: 'Faculty guide', ADMIN: 'Project coordinator' };

    // ---- API -----------------------------------------------------------------
    async function api(path, { method = 'GET', body } = {}) {
        const opts = { method, headers: {}, credentials: 'same-origin' };
        if (body instanceof FormData) opts.body = body;
        else if (body !== undefined) {
            opts.body = JSON.stringify(body);
            opts.headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(`/api${path}`, opts);
        let data = null;
        try { data = await res.json(); } catch { /* empty body */ }
        if (res.status === 401 && !location.pathname.endsWith('/index.html') && location.pathname !== '/') {
            location.href = `/index.html?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
            throw new Error('Session expired');
        }
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        return data;
    }

    // ---- Formatting ------------------------------------------------------------
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // SQLite timestamps are UTC "YYYY-MM-DD HH:MM:SS"; plain dates are local "YYYY-MM-DD"
    function parse(v) {
        if (!v) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`);
        return new Date(v.includes('T') ? v : v.replace(' ', 'T') + 'Z');
    }
    const date = (v) => {
        const d = parse(v);
        return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    };
    const dateTime = (v) => {
        const d = parse(v);
        return d ? d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
    };
    function ago(v) {
        const d = parse(v);
        if (!d) return '';
        const s = (Date.now() - d.getTime()) / 1000;
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s / 60)} min ago`;
        if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
        if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
        return date(v);
    }
    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    /** "in 3 days" / "2 days overdue" / "today" for a YYYY-MM-DD deadline */
    function due(deadline) {
        if (!deadline) return '';
        const days = Math.round((parse(deadline) - parse(todayStr())) / 86400000);
        if (days === 0) return 'due today';
        if (days === 1) return 'due tomorrow';
        if (days > 0) return `in ${days} days`;
        return `${-days} day${days === -1 ? '' : 's'} overdue`;
    }
    const size = (b) => (b == null ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
    const initials = (name) => String(name || '?').replace(/^Dr\.?\s*/, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

    // ---- Badges ----------------------------------------------------------------
    const STATUS = {
        PROPOSAL_SUBMITTED: ['blue', 'clock', 'Proposal submitted'],
        CHANGES_REQUESTED: ['warning', 'edit', 'Changes requested'],
        REJECTED: ['critical', 'x', 'Rejected'],
        APPROVED: ['violet', 'link', 'Awaiting guide'],
        IN_PROGRESS: ['blue', 'rotate', 'In progress'],
        FINAL_SUBMISSION: ['violet', 'send', 'Final submission'],
        COMPLETED: ['good', 'check', 'Completed'],
    };
    const HEALTH = {
        ON_TRACK: ['good', 'check', 'On track'],
        AT_RISK: ['warning', 'clock', 'At risk'],
        DELAYED: ['critical', 'alert', 'Delayed'],
    };
    const MILESTONE = {
        PENDING: ['', 'circle', 'Pending'],
        SUBMITTED: ['blue', 'upload', 'Awaiting review'],
        REVISION_REQUESTED: ['warning', 'rotate', 'Revision requested'],
        APPROVED: ['good', 'check', 'Approved'],
    };
    const PROPOSAL = {
        SUBMITTED: ['blue', 'clock', 'Under review'],
        CHANGES_REQUESTED: ['warning', 'edit', 'Changes requested'],
        APPROVED: ['good', 'check', 'Approved'],
        REJECTED: ['critical', 'x', 'Rejected'],
    };
    const badgeFrom = (map) => (key) => {
        const [cls, ic, label] = map[key] || ['', 'circle', key || '—'];
        return `<span class="badge ${cls}">${icon(ic)}${esc(label)}</span>`;
    };
    const statusBadge = badgeFrom(STATUS);
    const statusLabel = (s) => (STATUS[s] ? STATUS[s][2] : s);
    const healthBadge = (h) => (h ? badgeFrom(HEALTH)(h) : '');
    const proposalBadge = badgeFrom(PROPOSAL);
    const milestoneBadge = (m) => (m.overdue ? `<span class="badge critical">${icon('alert')}Overdue</span>` : badgeFrom(MILESTONE)(m.status));
    const meter = (pct, cls = '') => `<div class="meter ${cls}" role="img" aria-label="${pct}% complete"><div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div><span class="meter-label">${pct}%</span></div>`;
    const DOC_TYPES = { DELIVERABLE: 'Milestone deliverable', FINAL_REPORT: 'Final report', PRESENTATION: 'Presentation', SOURCE_CODE: 'Source code', OTHER: 'Other' };

    /** Lifecycle stepper: Proposal → Approval → Guide → Milestones → Final evaluation → Completed */
    function stepper(project, progress = 0) {
        const s = project.status;
        const order = ['PROPOSAL_SUBMITTED', 'APPROVED', 'IN_PROGRESS', 'FINAL_SUBMISSION', 'COMPLETED'];
        let reached = order.indexOf(s);
        if (s === 'CHANGES_REQUESTED' || s === 'REJECTED') reached = 0;
        const steps = [
            { label: 'Proposal', done: true },
            { label: 'Approval', done: reached >= 1 },
            { label: 'Guide allocated', done: reached >= 2 },
            { label: `Milestones${s === 'IN_PROGRESS' ? ` · ${progress}%` : ''}`, done: reached >= 3 },
            { label: 'Final evaluation', done: reached >= 4 },
        ];
        const current = steps.findIndex(st => !st.done);
        return `<ol class="stepper" aria-label="Project lifecycle">${steps.map((st, i) => {
            const blocked = i === 1 && (s === 'CHANGES_REQUESTED' || s === 'REJECTED');
            const cls = blocked ? 'blocked' : st.done ? 'done' : i === current ? 'current' : '';
            const mark = st.done ? icon('check') : blocked ? icon(s === 'REJECTED' ? 'x' : 'edit') : '';
            const label = blocked ? (s === 'REJECTED' ? 'Rejected' : 'Changes requested') : st.label;
            return `<li class="step ${cls}" ${i === current ? 'aria-current="step"' : ''}><div class="step-bar"></div><div class="step-label">${mark}${esc(label)}</div></li>`;
        }).join('')}</ol>`;
    }

    const empty = (ic, title, text = '', action = '') =>
        `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;

    // ---- Toasts & modals ---------------------------------------------------------
    function toast(message, type = 'info') {
        let host = document.querySelector('.toasts');
        if (!host) {
            host = document.createElement('div');
            host.className = 'toasts';
            host.setAttribute('role', 'status');
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `${icon(type === 'error' ? 'alertCircle' : 'check')}<span>${esc(message)}</span>`;
        host.appendChild(el);
        setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
    }

    /**
     * Opens a form dialog. onSubmit(values, form) may return a promise; throwing shows the error inline.
     * Resolves true if submitted successfully.
     */
    function modal({ title, body, submitLabel = 'Save', submitClass = 'btn-primary', onSubmit, onOpen, wide }) {
        return new Promise(resolve => {
            const dlg = document.createElement('dialog');
            dlg.className = 'modal';
            if (wide) dlg.style.width = 'min(820px, calc(100vw - 32px))';
            dlg.innerHTML = `<form novalidate>
                <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Close">${icon('x')}</button></div>
                <div class="modal-body">${body}<div class="form-error hidden" role="alert"></div></div>
                <div class="modal-foot"><button type="button" class="btn" data-close>Cancel</button>${onSubmit ? `<button type="submit" class="btn ${submitClass}">${esc(submitLabel)}</button>` : ''}</div>
            </form>`;
            document.body.appendChild(dlg);
            const form = dlg.querySelector('form');
            const err = dlg.querySelector('.form-error');
            let ok = false;
            const close = () => dlg.close();
            dlg.addEventListener('close', () => { dlg.remove(); resolve(ok); });
            dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!form.reportValidity()) return;
                const btn = form.querySelector('[type=submit]');
                btn.disabled = true;
                err.classList.add('hidden');
                try {
                    await onSubmit(values(form), form);
                    ok = true;
                    close();
                } catch (ex) {
                    err.textContent = ex.message;
                    err.classList.remove('hidden');
                    btn.disabled = false;
                }
            });
            dlg.showModal();
            onOpen?.(form);
        });
    }

    function confirmAction(title, text, label = 'Confirm', cls = 'btn-primary') {
        return modal({ title, body: `<p>${text}</p>`, submitLabel: label, submitClass: cls, onSubmit: async () => {} });
    }

    /** Form → plain object (multi-value keys become arrays) */
    function values(form) {
        const out = {};
        for (const [k, v] of new FormData(form).entries()) {
            if (v instanceof File) continue;
            out[k] = typeof v === 'string' ? v.trim() : v;
        }
        return out;
    }

    /** Rubric inputs with a live total. criteria: [{key,label,max}] */
    function rubric(criteria, prefix = '') {
        const total = criteria.reduce((a, c) => a + c.max, 0);
        return `<div class="rubric" data-rubric data-max="${total}">
            ${criteria.map(c => `<div class="rubric-row">
                <label for="${prefix}${c.key}">${esc(c.label)}</label>
                <input class="input" type="number" inputmode="numeric" id="${prefix}${c.key}" name="${c.key}" min="0" max="${c.max}" step="1" required>
                <span class="max">/ ${c.max}</span></div>`).join('')}
            <div class="rubric-total"><span>Total</span><span><span class="value" data-total>0</span> <span class="muted">/ ${total}</span></span></div>
        </div>`;
    }
    function bindRubric(root, onChange) {
        const r = root.querySelector('[data-rubric]');
        if (!r) return;
        const update = () => {
            const sum = [...r.querySelectorAll('input')].reduce((a, i) => a + (Number(i.value) || 0), 0);
            r.querySelector('[data-total]').textContent = sum;
            onChange?.(sum);
        };
        r.addEventListener('input', update);
        update();
    }

    // Lightweight chart tooltip for hover on marks with data-tip
    function bindTips(root) {
        let tip;
        root.addEventListener('pointerover', (e) => {
            const t = e.target.closest('[data-tip]');
            if (!t) return;
            tip ??= Object.assign(document.createElement('div'), { className: 'chart-tip' });
            tip.innerHTML = t.dataset.tip;
            document.body.appendChild(tip);
        });
        root.addEventListener('pointermove', (e) => {
            if (!tip?.isConnected) return;
            const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
            tip.style.left = `${x}px`;
            tip.style.top = `${e.clientY + 14}px`;
        });
        root.addEventListener('pointerout', (e) => {
            if (e.target.closest('[data-tip]') && !e.relatedTarget?.closest?.('[data-tip]')) tip?.remove();
        });
    }

    // ---- Shell -------------------------------------------------------------------
    let currentUser = null;

    function renderShell(user, active, title) {
        const nav = NAV[user.role].map(n => `<li><a href="${n.href}" class="${n.key === active ? 'active' : ''}">${icon(n.icon)}${esc(n.label)}</a></li>`).join('');
        const sidebar = document.getElementById('sidebar');
        sidebar.innerHTML = `
            <a class="brand" href="${HOME[user.role]}"><span class="brand-mark">${icon('logo')}</span>ProjectFlow</a>
            <ul class="nav"><li class="nav-section">${esc(ROLE_LABEL[user.role])}</li>${nav}</ul>
            <div class="sidebar-foot">
                <div class="user-chip"><span class="avatar">${esc(initials(user.name))}</span>
                    <div class="grow"><div class="name">${esc(user.name)}</div><div class="role">${esc(user.email)}</div></div>
                    <button class="btn btn-ghost btn-icon" id="logout-btn" title="Sign out" aria-label="Sign out">${icon('logout')}</button>
                </div>
            </div>`;
        const dark = document.documentElement.dataset.theme === 'dark' ||
            (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
        document.getElementById('topbar').innerHTML = `
            <button class="btn btn-ghost btn-icon menu-btn" id="menu-btn" aria-label="Open menu">${icon('menu')}</button>
            <div class="crumb">${esc(title)}</div>
            <button class="btn btn-ghost btn-icon" id="theme-btn" aria-label="Toggle dark mode" title="Toggle dark mode">${icon(dark ? 'sun' : 'moon')}</button>
            <button class="btn btn-ghost btn-icon" id="notif-btn" aria-label="Notifications" aria-haspopup="true">${icon('bell')}<span class="dot-count hidden" id="notif-count"></span></button>`;
        document.title = `${title} · ProjectFlow`;

        document.getElementById('logout-btn').onclick = async () => {
            await api('/auth/logout', { method: 'POST' }).catch(() => {});
            location.href = '/index.html';
        };
        document.getElementById('theme-btn').onclick = () => {
            const isDark = document.documentElement.dataset.theme === 'dark' ||
                (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
            const next = isDark ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem('theme', next); } catch { /* ignore */ }
            document.getElementById('theme-btn').innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
        };
        document.getElementById('menu-btn').onclick = () => {
            sidebar.classList.add('open');
            const scrim = Object.assign(document.createElement('div'), { className: 'scrim' });
            scrim.onclick = () => { sidebar.classList.remove('open'); scrim.remove(); };
            document.body.appendChild(scrim);
        };
        setupNotifications();
    }

    async function setupNotifications() {
        const btn = document.getElementById('notif-btn');
        const count = document.getElementById('notif-count');
        let data = { items: [], unread: 0 };
        const refresh = async () => {
            try { data = await api('/notifications'); } catch { return; }
            count.textContent = data.unread > 9 ? '9+' : data.unread;
            count.classList.toggle('hidden', !data.unread);
        };
        await refresh();
        let pop = null;
        const closePop = () => { pop?.remove(); pop = null; document.removeEventListener('click', outside); };
        const outside = (e) => { if (pop && !pop.contains(e.target) && !btn.contains(e.target)) closePop(); };
        btn.onclick = async () => {
            if (pop) return closePop();
            pop = document.createElement('div');
            pop.className = 'popover';
            pop.innerHTML = `<div class="card-head"><h3>Notifications</h3>${data.unread ? '<button class="btn btn-sm btn-ghost" id="mark-read">Mark all read</button>' : ''}</div>
                ${data.items.length ? data.items.map(n => `<a class="notif ${n.is_read ? '' : 'unread'}" href="${esc(n.link || '#')}">${esc(n.message)}<div class="when">${ago(n.created_at)}</div></a>`).join('')
                    : empty('bell', 'You are all caught up')}`;
            document.querySelector('.topbar').appendChild(pop);
            pop.querySelector('#mark-read')?.addEventListener('click', async () => {
                await api('/notifications/read', { method: 'POST' });
                await refresh();
                closePop();
            });
            setTimeout(() => document.addEventListener('click', outside));
        };
        setInterval(refresh, 60000);
    }

    /**
     * Boots a protected page: checks the session and role, renders the shell, then calls render(user, content).
     * nav and title may be functions of the user.
     */
    async function page({ roles, nav, title }, render) {
        const content = document.getElementById('content');
        content.innerHTML = `<div class="loading"><span class="spinner"></span></div>`;
        let user;
        try {
            user = (await api('/auth/me')).user;
        } catch {
            return;
        }
        if (roles && !roles.includes(user.role)) {
            location.href = HOME[user.role];
            return;
        }
        currentUser = user;
        const pick = (v) => (typeof v === 'function' ? v(user) : v);
        renderShell(user, pick(nav), pick(title));
        try {
            await render(user, content);
        } catch (err) {
            console.error(err);
            content.innerHTML = `<div class="callout critical">${icon('alertCircle')}<div><h3>Could not load this page</h3><p>${esc(err.message)}</p></div></div>`;
        }
    }

    window.App = {
        api, esc, icon, date, dateTime, ago, due, size, initials, todayStr, parse,
        statusBadge, statusLabel, healthBadge, proposalBadge, milestoneBadge, meter, stepper, empty, DOC_TYPES,
        toast, modal, confirmAction, values, rubric, bindRubric, bindTips, page, HOME,
        get user() { return currentUser; },
    };
})();
