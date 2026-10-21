const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Promise wrappers so routes can use async/await
const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const exec = (sql) => new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
});

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('STUDENT', 'FACULTY', 'ADMIN')),
    department TEXT,
    roll_number TEXT,          -- students
    expertise TEXT,            -- faculty
    max_projects INTEGER DEFAULT 5, -- faculty guide capacity
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    guide_id INTEGER REFERENCES users(id),
    preferred_guide_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    domain TEXT,
    description TEXT,
    technologies TEXT,
    status TEXT NOT NULL DEFAULT 'PROPOSAL_SUBMITTED' CHECK(status IN (
        'PROPOSAL_SUBMITTED', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED',
        'IN_PROGRESS', 'FINAL_SUBMISSION', 'COMPLETED')),
    allocated_at DATETIME,
    final_submitted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Every submission/resubmission of a proposal is kept as a new version
CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    domain TEXT,
    problem_statement TEXT NOT NULL,
    objectives TEXT NOT NULL,
    methodology TEXT NOT NULL,
    technologies TEXT NOT NULL,
    expected_outcome TEXT,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED')),
    feedback TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
);

CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    deadline DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED')),
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Uploaded documents; milestone_id is NULL for general project documentation
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id INTEGER REFERENCES milestones(id) ON DELETE CASCADE,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    doc_type TEXT DEFAULT 'DELIVERABLE',
    file_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_size INTEGER,
    comments TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    technical_score INTEGER NOT NULL,
    progress_score INTEGER NOT NULL,
    documentation_score INTEGER NOT NULL,
    presentation_score INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('APPROVED', 'REVISION_REQUESTED')),
    feedback TEXT,
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    evaluator_id INTEGER NOT NULL REFERENCES users(id),
    technical_score INTEGER NOT NULL,
    implementation_score INTEGER NOT NULL,
    innovation_score INTEGER NOT NULL,
    documentation_score INTEGER NOT NULL,
    presentation_score INTEGER NOT NULL,
    viva_score INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    grade TEXT NOT NULL,
    comments TEXT,
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_student ON projects(student_id);
CREATE INDEX IF NOT EXISTS idx_projects_guide ON projects(guide_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
`;

const TABLES = ['activity_log', 'notifications', 'evaluations', 'reviews', 'submissions',
    'milestones', 'proposals', 'faculty_allocations', 'project_members', 'projects', 'users'];

async function initDatabase() {
    await exec(SCHEMA);
}

async function resetDatabase() {
    await exec('PRAGMA foreign_keys = OFF;');
    for (const t of TABLES) await exec(`DROP TABLE IF EXISTS ${t};`);
    await initDatabase();
}

module.exports = { db, run, get, all, exec, initDatabase, resetDatabase };
