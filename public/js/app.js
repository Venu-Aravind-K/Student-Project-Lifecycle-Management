/* ProjectFlow shared front-end runtime: API client, app shell, plain-language labels and UI helpers. */
(function () {
    // Apply the saved theme before first paint
    try {
        const t = localStorage.getItem('theme');
        if (t) document.documentElement.dataset.theme = t;
    } catch { /* storage unavailable */ }

    const ICONS = {
        logo: '<path d="M4 6h7v5H4zM13 13h7v5h-7z"/><path d="M11 8.5h3a3 3 0 0 1 3 3V13"/>',
        home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
        folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
        file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
        pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
        check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
        checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
        clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
        award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
        users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        userPlus: '<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 14.5-4.6M19 14v6M16 17h6"/>',
        bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
        logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
        download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
        alert: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
        help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
        x: '<path d="M6 6l12 12M18 6 6 18"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
        send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
        arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        chevronDown: '<path d="m6 9 6 6 6-6"/>',
        chevronRight: '<path d="m9 6 6 6-6 6"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
        refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5"/>',
        sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
        hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
        layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
        graduation: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
        teacher: '<circle cx="9" cy="7" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M14 4h7v8h-5"/>',
        shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
        x2: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    };
    const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

    const NAV = {
        STUDENT: [
            { key: 'dashboard', href: 'student-dashboard.html', label: 'Home', icon: 'home' },
            { key: 'project', href: 'project-details.html', label: 'My project', icon: 'folder' },
            { key: 'proposal', href: 'proposal.html', label: 'My proposal', icon: 'pen' },
        ],
        FACULTY: [
            { key: 'dashboard', href: 'faculty-dashboard.html', label: 'Home', icon: 'home' },
            { key: 'proposals', href: 'proposal-review.html', label: 'Proposals to decide', icon: 'file', count: 'proposals' },
            { key: 'reviews', href: 'reviews.html', label: 'Work to review', icon: 'clipboard', count: 'reviews' },
            { key: 'evaluations', href: 'evaluation.html', label: 'Final grading', icon: 'award', count: 'evaluations' },
            { key: 'projects', href: 'faculty-projects.html', label: 'My students', icon: 'users' },
        ],
        ADMIN: [
            { key: 'dashboard', href: 'admin-dashboard.html', label: 'Home', icon: 'home' },
            { key: 'projects', href: 'projects.html', label: 'All projects', icon: 'layers' },
            { key: 'proposals', href: 'proposal-review.html', label: 'Proposals', icon: 'file', count: 'proposals' },
            { key: 'allocation', href: 'faculty-allocation.html', label: 'Assign guides', icon: 'link', count: 'allocation' },
            { key: 'evaluations', href: 'evaluation.html', label: 'Final grading', icon: 'award', count: 'evaluations' },
            { key: 'users', href: 'users.html', label: 'People', icon: 'users' },
        ],
    };
    const HOME = { STUDENT: 'student-dashboard.html', FACULTY: 'faculty-dashboard.html', ADMIN: 'admin-dashboard.html' };
    const ROLE = {
        STUDENT: ['Student', 'Working on a project', 'graduation'],
        FACULTY: ['Faculty guide', 'Supervising students', 'teacher'],
        ADMIN: ['Project coordinator', 'Managing the department', 'shield'],
    };

    // ---- API -------------------------------------------------------------------
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
        if (res.status === 401 && !/\/(index\.html)?$/.test(location.pathname)) {
            location.href = `/index.html?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
            throw new Error('Session expired');
        }
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        return data;
    }

    // ---- Formatting --------------------------------------------------------------
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // SQLite timestamps are UTC "YYYY-MM-DD HH:MM:SS"; deadlines are local "YYYY-MM-DD"
    function parse(v) {
        if (!v) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`);
        return new Date(v.includes('T') ? v : v.replace(' ', 'T') + 'Z');
    }
    const date = (v) => { const d = parse(v); return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
    const shortDate = (v) => { const d = parse(v); return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'; };
    const dateTime = (v) => { const d = parse(v); return d ? d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'; };
    function ago(v) {
        const d = parse(v);
        if (!d) return '';
        const s = (Date.now() - d.getTime()) / 1000;
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s / 60)} min ago`;
        if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
        const days = Math.floor(s / 86400);
        if (days === 1) return 'yesterday';
        if (days < 7) return `${days} days ago`;
        return date(v);
    }
    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const daysUntil = (deadline) => Math.round((parse(deadline) - parse(todayStr())) / 86400000);
    /** "Due in 3 days" / "2 days overdue" / "Due today" */
    function due(deadline) {
        if (!deadline) return '';
        const n = daysUntil(deadline);
        if (n === 0) return 'Due today';
        if (n === 1) return 'Due tomorrow';
        if (n > 1) return `Due in ${n} days`;
        return `${-n} day${n === -1 ? '' : 's'} overdue`;
    }
    const size = (b) => (b == null ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
    const initials = (name) => String(name || '?').replace(/^Dr\.?\s*/, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const firstName = (name) => (String(name || '').startsWith('Dr') ? name : String(name || '').split(' ')[0]);
    const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

    // ---- Plain-language labels -----------------------------------------------------
    // [tone, icon, label, explanation]
    const STATUS = {
        PROPOSAL_SUBMITTED: ['primary', 'hourglass', 'Waiting for approval', 'The proposal is being read by a faculty guide or the coordinator.'],
        CHANGES_REQUESTED: ['warn', 'pen', 'Needs changes', 'The reviewer asked for changes before they can approve it.'],
        REJECTED: ['bad', 'x2', 'Not approved', 'This idea was not approved. A new proposal can be submitted.'],
        APPROVED: ['violet', 'link', 'Waiting for a guide', 'Approved! The coordinator is assigning a faculty guide.'],
        IN_PROGRESS: ['primary', 'flag', 'In progress', 'Working through the milestones set by the guide.'],
        FINAL_SUBMISSION: ['violet', 'award', 'Waiting for grade', 'Submitted for final evaluation. The guide will grade it.'],
        COMPLETED: ['good', 'checkCircle', 'Completed', 'Graded and finished.'],
    };
    const HEALTH = {
        ON_TRACK: ['good', 'checkCircle', 'On track', 'No deadlines missed and nothing due in the next 7 days.'],
        AT_RISK: ['warn', 'clock', 'Deadline soon', 'A milestone is due within 7 days and has not been submitted yet.'],
        DELAYED: ['bad', 'alert', 'Overdue', 'A milestone deadline has passed without a submission.'],
    };
    const MILESTONE = {
        PENDING: ['', 'circle', 'To do'],
        SUBMITTED: ['primary', 'hourglass', 'Waiting for review'],
        REVISION_REQUESTED: ['warn', 'refresh', 'Needs changes'],
        APPROVED: ['good', 'check', 'Done'],
    };
    const PROPOSAL = {
        SUBMITTED: ['primary', 'hourglass', 'Under review'],
        CHANGES_REQUESTED: ['warn', 'pen', 'Changes requested'],
        APPROVED: ['good', 'check', 'Approved'],
        REJECTED: ['bad', 'x2', 'Not approved'],
    };
    const DOC_TYPES = { DELIVERABLE: 'Milestone work', FINAL_REPORT: 'Final report', PRESENTATION: 'Presentation', SOURCE_CODE: 'Source code', OTHER: 'Other' };

    const pill = ([tone, ic, label, tip], cls = '') => `<span class="pill ${tone} ${cls}" ${tip ? `title="${esc(tip)}"` : ''}>${ic === 'circle' ? '' : icon(ic)}${esc(label)}</span>`;
    const statusPill = (s, cls) => pill(STATUS[s] || ['', 'info', s], cls);
    const statusLabel = (s) => (STATUS[s] || [])[2] || s;
    const statusInfo = (s) => STATUS[s] || ['', 'info', s, ''];
    const healthPill = (h, cls) => (h ? pill(HEALTH[h], cls) : '');
    const healthInfo = (h) => HEALTH[h];
    const proposalPill = (s, cls) => pill(PROPOSAL[s] || ['', 'info', s], cls);
    const milestonePill = (m, cls) => (m.overdue ? pill(['bad', 'alert', 'Overdue'], cls) : pill(MILESTONE[m.status], cls));
    const progress = (pct, cls = '') => `<div class="progress-row" role="img" aria-label="${pct}% complete"><div class="progress ${cls}"><div style="width:${pct}%"></div></div><span>${pct}%</span></div>`;

    function empty(ic, title, text = '', action = '', tone = '') {
        return `<div class="empty"><div class="empty-icon ${tone}">${icon(ic)}</div><h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action ? `<div class="actions">${action}</div>` : ''}</div>`;
    }

    // ---- Toasts & modals ----------------------------------------------------------
    function toast(message, type = 'info') {
        let host = document.querySelector('.toasts');
        if (!host) {
            host = Object.assign(document.createElement('div'), { className: 'toasts' });
            host.setAttribute('role', 'status');
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `${icon(type === 'error' ? 'alertCircle' : 'checkCircle')}<span>${esc(message)}</span>`;
        host.appendChild(el);
        setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
    }

    /** Form dialog. onSubmit(values, form) may throw to show an inline error. Resolves true when submitted. */
    function modal({ title, subtitle, body, submitLabel = 'Save', submitClass = 'btn-primary', onSubmit, onOpen, wide, cancelLabel = 'Cancel' }) {
        return new Promise(resolve => {
            const dlg = document.createElement('dialog');
            dlg.className = `modal ${wide ? 'wide' : ''}`;
            dlg.innerHTML = `<form novalidate>
                <div class="modal-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close">${icon('x')}</button></div>
                <div class="modal-body">${body}<div class="form-error hidden" role="alert"></div></div>
                <div class="modal-foot"><button type="button" class="btn" data-close>${esc(cancelLabel)}</button>${onSubmit ? `<button type="submit" class="btn ${submitClass}">${esc(submitLabel)}</button>` : ''}</div>
            </form>`;
            document.body.appendChild(dlg);
            const form = dlg.querySelector('form');
            const err = dlg.querySelector('.form-error');
            let ok = false;
            dlg.addEventListener('close', () => { dlg.remove(); resolve(ok); });
            dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
            form.addEventListener('input', () => err.classList.add('hidden')); // stale errors disappear once the user edits
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!form.reportValidity()) return;
                const btn = form.querySelector('[type=submit]');
                btn.disabled = true;
                err.classList.add('hidden');
                try {
                    await onSubmit(values(form), form);
                    ok = true;
                    dlg.close();
                } catch (ex) {
                    err.innerHTML = `${icon('alertCircle')}<span>${esc(ex.message)}</span>`;
                    err.classList.remove('hidden');
                    btn.disabled = false;
                }
            });
            dlg.showModal();
            onOpen?.(form);
        });
    }
    const confirmAction = (title, text, label = 'Confirm', cls = 'btn-primary') =>
        modal({ title, body: `<p class="ink-2">${text}</p>`, submitLabel: label, submitClass: cls, onSubmit: async () => {} });

    function values(form) {
        const out = {};
        for (const [k, v] of new FormData(form).entries()) {
            if (v instanceof File) continue;
            out[k] = typeof v === 'string' ? v.trim() : v;
        }
        return out;
    }

    /** Score sliders. criteria: [{key, label, hint, max}]. Each must be moved before submitting. */
    function scoreSliders(criteria, prefix = 'sc') {
        const total = criteria.reduce((a, c) => a + c.max, 0);
        return `<div class="scores" data-scores data-max="${total}">
            ${criteria.map(c => `<div class="score unset">
                <label class="score-name" for="${prefix}-${c.key}">${esc(c.label)}</label>
                <input type="range" id="${prefix}-${c.key}" name="${c.key}" min="0" max="${c.max}" step="1" value="${Math.round(c.max / 2)}" aria-describedby="${prefix}-${c.key}-hint">
                <span class="score-hint" id="${prefix}-${c.key}-hint">${esc(c.hint || '')}</span>
                <div class="score-val"><span data-v>—</span><small>of ${c.max}</small></div>
            </div>`).join('')}
            <div class="score-total"><span>Total score</span><span><span class="v" data-total>—</span> / ${total}</span></div>
        </div>`;
    }
    /** Wires sliders; returns a function that throws if any criterion wasn't scored. */
    function bindScores(root, onChange) {
        const box = root.querySelector('[data-scores]');
        const rows = [...box.querySelectorAll('.score')];
        const update = () => {
            let sum = 0, all = true;
            rows.forEach(r => {
                const input = r.querySelector('input');
                if (r.classList.contains('unset')) { all = false; return; }
                r.querySelector('[data-v]').textContent = input.value;
                sum += Number(input.value);
            });
            box.querySelector('[data-total]').textContent = rows.some(r => !r.classList.contains('unset')) ? sum : '—';
            onChange?.(sum, all);
        };
        rows.forEach(r => {
            const set = () => { r.classList.remove('unset'); update(); };
            r.querySelector('input').addEventListener('input', set);
            r.querySelector('input').addEventListener('change', set);
            r.querySelector('.score-val').addEventListener('click', set); // accept the shown value as-is
        });
        update();
        return () => {
            const missing = rows.filter(r => r.classList.contains('unset')).map(r => r.querySelector('.score-name').textContent);
            if (missing.length) throw new Error(`Give a score for: ${missing.join(', ')}`);
        };
    }

    function bindTips(root) {
        let tip;
        root.addEventListener('pointerover', (e) => {
            const t = e.target.closest('[data-tip]');
            if (!t) return;
            tip ??= Object.assign(document.createElement('div'), { className: 'tip' });
            tip.innerHTML = t.dataset.tip;
            document.body.appendChild(tip);
        });
        root.addEventListener('pointermove', (e) => {
            if (!tip?.isConnected) return;
            tip.style.left = `${Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8)}px`;
            tip.style.top = `${e.clientY + 16}px`;
        });
        root.addEventListener('pointerout', (e) => { if (!e.relatedTarget?.closest?.('[data-tip]')) tip?.remove(); });
    }

    // ---- "How it works" guide -------------------------------------------------------
    const GUIDE = [
        ['Write a proposal', 'The student describes the project idea and picks a preferred guide.', 'STUDENT'],
        ['Proposal is reviewed', 'The chosen guide (or the coordinator) approves it, asks for changes, or rejects it.', 'FACULTY'],
        ['A guide is assigned', 'If the chosen guide approves, they become the guide. Otherwise the coordinator assigns one.', 'ADMIN'],
        ['Milestones', 'The guide sets checkpoints with deadlines. The student uploads work for each one.', 'STUDENT'],
        ['Work is reviewed', 'The guide scores each piece of work and approves it or asks for changes.', 'FACULTY'],
        ['Final submission & grade', 'When every milestone is done and the final report is uploaded, the student submits. The guide gives the final grade.', 'FACULTY'],
    ];
    const ROLE_TIPS = {
        STUDENT: 'Your home page always shows <b>your next step</b> at the top. Follow it and you can’t get lost.',
        FACULTY: 'Your home page lists <b>everything waiting for you</b>. The numbers in the menu show how many items are waiting.',
        ADMIN: 'Your home page shows <b>what needs action</b> first, then how all projects are doing.',
    };
    function showGuide(role) {
        modal({
            title: 'How ProjectFlow works',
            subtitle: 'Every project follows the same six steps.',
            cancelLabel: 'Got it',
            body: `<ol class="help-steps">${GUIDE.map(([t, d, who], i) => `<li><span class="n">${i + 1}</span><div><b>${t}${who === role ? '<span class="you">you</span>' : ''}</b><span>${d}</span></div></li>`).join('')}</ol>
                <div class="journey-caption">${icon('info')}<div>${ROLE_TIPS[role]}</div></div>`,
        });
        try { localStorage.setItem('guide-seen', '1'); } catch { /* ignore */ }
    }

    // ---- Shell ----------------------------------------------------------------------
    let currentUser = null;

    function renderShell(user, active, crumbs) {
        const [roleName, roleDesc, roleIcon] = ROLE[user.role];
        const sidebar = document.getElementById('sidebar');
        sidebar.innerHTML = `
            <a class="brand" href="${HOME[user.role]}"><span class="brand-mark">${icon('logo')}</span>ProjectFlow</a>
            <div class="role-chip"><div class="row-tight">${icon(roleIcon, 'icon-sm')}<b>${roleName}</b></div>${roleDesc}</div>
            <ul class="nav">${NAV[user.role].map(n => `<li><a href="${n.href}" class="${n.key === active ? 'active' : ''}" ${n.key === active ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${esc(n.label)}</span>${n.count ? `<span class="count hidden" data-count="${n.count}"></span>` : ''}</a></li>`).join('')}</ul>
            <div class="sidebar-foot">
                <button class="link-btn" id="help-btn">${icon('help')}How it works</button>
                <div class="me"><span class="avatar">${esc(initials(user.name))}</span><div class="grow"><div class="name truncate">${esc(user.name)}</div><div class="email truncate">${esc(user.email)}</div></div></div>
                <button class="link-btn" id="logout-btn">${icon('logout')}Sign out</button>
            </div>`;

        const isDark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
        const topbar = document.getElementById('topbar');
        topbar.innerHTML = `
            <button class="btn btn-ghost btn-icon menu-btn" id="menu-btn" aria-label="Open menu">${icon('menu')}</button>
            <div class="crumbs truncate">${crumbs}</div>
            <button class="btn btn-ghost btn-icon" id="theme-btn" aria-label="Switch light/dark mode" title="Switch light/dark mode">${icon(isDark() ? 'sun' : 'moon')}</button>
            <button class="btn btn-ghost btn-icon" id="notif-btn" aria-label="Notifications" title="Notifications">${icon('bell')}<span class="dot-count hidden" id="notif-count"></span></button>`;
        addEventListener('scroll', () => topbar.classList.toggle('scrolled', scrollY > 4), { passive: true });

        document.getElementById('logout-btn').onclick = async () => {
            await api('/auth/logout', { method: 'POST' }).catch(() => {});
            location.href = '/index.html';
        };
        document.getElementById('help-btn').onclick = () => showGuide(user.role);
        document.getElementById('theme-btn').onclick = () => {
            const next = isDark() ? 'light' : 'dark';
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
        refreshCounts();
        setupNotifications();
        try { if (!localStorage.getItem('guide-seen')) setTimeout(() => showGuide(user.role), 400); } catch { /* ignore */ }
    }

    async function refreshCounts() {
        try {
            const counts = await api('/dashboard/counts');
            document.querySelectorAll('[data-count]').forEach(el => {
                const n = counts[el.dataset.count] || 0;
                el.textContent = n;
                el.classList.toggle('hidden', !n);
            });
        } catch { /* non-critical */ }
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
        const outside = (e) => { if (pop && !pop.contains(e.target) && !btn.contains(e.target)) closePop(); };
        const closePop = () => { pop?.remove(); pop = null; document.removeEventListener('click', outside); };
        btn.onclick = () => {
            if (pop) return closePop();
            pop = Object.assign(document.createElement('div'), { className: 'popover' });
            pop.innerHTML = `<div class="popover-head"><h3>Notifications</h3>${data.unread ? '<button class="btn btn-sm btn-ghost" id="mark-read">Mark all as read</button>' : ''}</div>
                ${data.items.length ? data.items.map(n => `<a class="notif ${n.is_read ? '' : 'unread'}" href="${esc(n.link || '#')}"><span class="dot"></span><div>${esc(n.message)}<div class="when">${ago(n.created_at)}</div></div></a>`).join('')
                    : empty('bell', 'No notifications yet', 'You’ll be told here when something needs you.')}`;
            document.getElementById('topbar').appendChild(pop);
            pop.querySelector('#mark-read')?.addEventListener('click', async () => {
                await api('/notifications/read', { method: 'POST' });
                await refresh();
                closePop();
            });
            setTimeout(() => document.addEventListener('click', outside));
        };
        setInterval(refresh, 60000);
    }

    /** Boots a protected page: checks the session and role, draws the shell, then calls render(user, content).
     *  nav and crumbs may be functions of the user. */
    async function page({ roles, nav, crumbs, title }, render) {
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
        let user;
        try { user = (await api('/auth/me')).user; } catch { return; }
        if (roles && !roles.includes(user.role)) { location.href = HOME[user.role]; return; }
        currentUser = user;
        const pick = (v) => (typeof v === 'function' ? v(user) : v);
        const t = pick(title);
        renderShell(user, pick(nav), pick(crumbs) || `<b>${esc(t)}</b>`);
        document.title = `${t} · ProjectFlow`;
        try {
            await render(user, content);
        } catch (err) {
            console.error(err);
            content.innerHTML = `<div class="card">${empty('alertCircle', 'This page could not be loaded', esc(err.message), '<button class="btn" onclick="location.reload()">Try again</button>')}</div>`;
        }
    }

    window.App = {
        api, esc, icon, date, shortDate, dateTime, ago, due, daysUntil, size, initials, firstName, plural, todayStr, parse,
        statusPill, statusLabel, statusInfo, healthPill, healthInfo, proposalPill, milestonePill, pill, progress, empty, DOC_TYPES, HEALTH,
        toast, modal, confirmAction, values, scoreSliders, bindScores, bindTips, page, refreshCounts, showGuide, HOME,
        get user() { return currentUser; },
    };
})();
