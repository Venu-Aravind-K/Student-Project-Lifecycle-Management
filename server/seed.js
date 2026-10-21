/**
 * Demo data covering every lifecycle stage. Dates are relative to today so health
 * indicators (on track / at risk / delayed) stay meaningful whenever it is run.
 *
 *   npm run seed   – wipes the database and reloads this data
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { run, initDatabase, resetDatabase } = require('./database');
const { today, addDays, gradeFor } = require('./lib/workflow');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

const day = (n) => addDays(today(), n);
const stamp = (n, hour = 10) => `${day(n)} ${String(hour).padStart(2, '0')}:00:00`;

// Builds a small valid one-page PDF so seeded documents open in a viewer
function makePdf(title, lines) {
    const esc = s => s.replace(/[\\()]/g, m => '\\' + m);
    const text = [`BT /F1 20 Tf 72 740 Td (${esc(title)}) Tj ET`,
        ...lines.map((l, i) => `BT /F1 11 Tf 72 ${705 - i * 18} Td (${esc(l)}) Tj ET`)].join('\n');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let out = '%PDF-1.4\n';
    const offsets = objects.map((obj, i) => {
        const offset = Buffer.byteLength(out);
        out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
        return offset;
    });
    const xref = Buffer.byteLength(out);
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return out;
}

function writeSeedFile(fileName, title, lines) {
    const stored = `seed-${fileName}`;
    const content = makePdf(title, lines);
    fs.writeFileSync(path.join(UPLOAD_DIR, stored), content);
    return { stored, size: Buffer.byteLength(content) };
}

async function seed() {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const hash = await bcrypt.hash('demo123', 10);

    // ---- Users -------------------------------------------------------------
    const U = {};
    const addUser = async (key, name, email, role, extra = {}) => {
        const { lastID } = await run(
            `INSERT INTO users (name, email, password, role, department, roll_number, expertise, max_projects) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, hash, role, extra.department || null, extra.roll || null, extra.expertise || null, role === 'FACULTY' ? (extra.max || 5) : null]);
        U[key] = { id: lastID, name };
    };
    await addUser('admin', 'Project Coordinator', 'admin@example.com', 'ADMIN', { department: 'Computer Science' });
    await addUser('kumar', 'Dr. Kumar', 'faculty@example.com', 'FACULTY', { department: 'Computer Science', expertise: 'Machine Learning, Computer Vision', max: 5 });
    await addUser('priya', 'Dr. Priya', 'priya@example.com', 'FACULTY', { department: 'Computer Science', expertise: 'IoT, Embedded Systems', max: 4 });
    await addUser('arun', 'Dr. Arun', 'arun@example.com', 'FACULTY', { department: 'Information Technology', expertise: 'Mobile & Cloud Computing', max: 4 });
    await addUser('sharma', 'Dr. Sharma', 'sharma@example.com', 'FACULTY', { department: 'Information Technology', expertise: 'Databases, Software Engineering', max: 3 });
    const students = [
        ['john', 'John Doe', 'student@example.com', 'CS21001'], ['alice', 'Alice Smith', 'alice@example.com', 'CS21002'],
        ['bob', 'Bob Jones', 'bob@example.com', 'CS21003'], ['charlie', 'Charlie Brown', 'charlie@example.com', 'CS21004'],
        ['diana', 'Diana Prince', 'diana@example.com', 'IT21005'], ['eve', 'Eve Adams', 'eve@example.com', 'IT21006'],
        ['frank', 'Frank White', 'frank@example.com', 'CS21007'], ['grace', 'Grace Lee', 'grace@example.com', 'IT21008'],
        ['hank', 'Hank Green', 'hank@example.com', 'CS21009'], ['ivy', 'Ivy Chen', 'ivy@example.com', 'CS21010'],
    ];
    for (const [key, name, email, roll] of students) {
        await addUser(key, name, email, 'STUDENT', { roll, department: roll.startsWith('CS') ? 'Computer Science' : 'Information Technology' });
    }

    // ---- Helpers -----------------------------------------------------------
    const log = (projectId, actor, message, daysAgo, hour) =>
        run(`INSERT INTO activity_log (project_id, actor_id, message, created_at) VALUES (?, ?, ?, ?)`, [projectId, actor && U[actor].id, message, stamp(daysAgo, hour)]);

    async function addProject(p) {
        const { lastID } = await run(
            `INSERT INTO projects (student_id, guide_id, preferred_guide_id, title, domain, description, technologies, status, allocated_at, final_submitted_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [U[p.student].id, p.guide ? U[p.guide].id : null, p.preferred ? U[p.preferred].id : null, p.title, p.domain, p.problem,
                p.tech, p.status, p.allocatedDay != null ? stamp(p.allocatedDay) : null, p.finalDay != null ? stamp(p.finalDay) : null,
                stamp(p.createdDay), stamp(p.updatedDay ?? p.createdDay)]);
        for (const [i, v] of (p.proposals || [{ status: 'SUBMITTED' }]).entries()) {
            await run(`INSERT INTO proposals (project_id, version, title, domain, problem_statement, objectives, methodology, technologies, expected_outcome,
                       status, feedback, reviewed_by, submitted_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [lastID, i + 1, p.title, p.domain, v.problem || p.problem, p.objectives, p.methodology, p.tech, p.outcome,
                    v.status, v.feedback || null, v.reviewer ? U[v.reviewer].id : null, stamp(v.submittedDay ?? p.createdDay, 9),
                    v.reviewedDay != null ? stamp(v.reviewedDay, 15) : null]);
        }
        await log(lastID, p.student, 'Submitted proposal', p.createdDay, 9);
        return lastID;
    }

    async function addMilestone(projectId, guide, m) {
        const { lastID } = await run(`INSERT INTO milestones (project_id, title, description, deadline, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [projectId, m.title, m.description, day(m.due), m.status, U[guide].id, stamp(m.createdDay ?? -60)]);
        return lastID;
    }

    async function addSubmission(projectId, milestoneId, student, s) {
        const file = writeSeedFile(s.file, s.docTitle, s.lines);
        await run(`INSERT INTO submissions (project_id, milestone_id, uploaded_by, doc_type, file_name, stored_name, file_size, comments, submitted_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectId, milestoneId, U[student].id, s.docType || 'DELIVERABLE', s.file, file.stored, file.size, s.comments || null, stamp(s.day, 18)]);
    }

    async function addReview(projectId, milestoneId, guide, r) {
        const total = r.scores.reduce((a, b) => a + b, 0);
        await run(`INSERT INTO reviews (milestone_id, project_id, reviewer_id, technical_score, progress_score, documentation_score, presentation_score,
                   total_score, decision, feedback, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [milestoneId, projectId, U[guide].id, ...r.scores, total, r.decision, r.feedback, stamp(r.day, 16)]);
        return total;
    }

    /** Milestone with optional submission and review, plus matching activity entries. */
    async function milestone(projectId, guide, student, m) {
        const id = await addMilestone(projectId, guide, m);
        if (m.submission) {
            await addSubmission(projectId, id, student, m.submission);
            await log(projectId, student, `Submitted "${m.submission.file}" for "${m.title}"`, m.submission.day, 18);
        }
        if (m.review) {
            const total = await addReview(projectId, id, guide, m.review);
            const verb = m.review.decision === 'APPROVED' ? 'Approved' : 'Requested revision on';
            await log(projectId, guide, `${verb} "${m.title}" (${total}/40)`, m.review.day, 16);
        }
        return id;
    }

    const notify = (user, message, link, daysAgo, read = 0) =>
        run(`INSERT INTO notifications (user_id, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?)`, [U[user].id, message, link, read, stamp(daysAgo, 12)]);

    // ---- 1. John Doe – in progress with Dr. Kumar, one submission awaiting review
    const p1 = await addProject({
        student: 'john', guide: 'kumar', preferred: 'kumar', status: 'IN_PROGRESS', createdDay: -75, allocatedDay: -70, updatedDay: -3,
        title: 'AI-Based Predictive Maintenance for Industrial Motors', domain: 'Machine Learning',
        problem: 'Unplanned motor failures cause costly downtime in small manufacturing units that cannot afford commercial condition-monitoring systems.',
        objectives: '1. Collect vibration and temperature data from motors\n2. Train a model to predict failures 48 hours ahead\n3. Build a dashboard that alerts maintenance staff',
        methodology: 'Sensor data collection with ESP32, feature extraction (FFT, RMS), LSTM and gradient-boosting models compared on recall, Flask dashboard.',
        tech: 'Python, TensorFlow, ESP32, Flask', outcome: 'A working prototype that predicts motor faults with at least 85% recall.',
        proposals: [{ status: 'APPROVED', reviewer: 'kumar', reviewedDay: -70, feedback: 'Well-scoped. Make sure you get access to real motor data early.' }],
    });
    await log(p1, 'kumar', 'Approved proposal v1', -70, 15);
    await log(p1, 'kumar', 'Applied the standard milestone plan', -69, 11);
    await milestone(p1, 'kumar', 'john', {
        title: 'Literature Survey', description: 'Review existing predictive maintenance approaches and datasets.', due: -50, status: 'APPROVED',
        submission: { file: 'literature-survey.pdf', docTitle: 'Literature Survey', lines: ['Predictive maintenance approaches: survey of 18 papers.', 'Datasets: NASA bearing, CWRU.'], day: -52, comments: 'Survey of 18 papers with a comparison table.' },
        review: { scores: [8, 8, 7, 8], decision: 'APPROVED', day: -48, feedback: 'Good coverage. Add the CWRU dataset results to the comparison table.' },
    });
    await milestone(p1, 'kumar', 'john', {
        title: 'Requirements & System Design', description: 'Requirement specification, architecture diagram and data model.', due: -25, status: 'APPROVED',
        submission: { file: 'system-design-v2.pdf', docTitle: 'System Design', lines: ['Architecture: ESP32 sensors -> MQTT -> Flask API -> Model service.', 'Data model and sequence diagrams.'], day: -26 },
        review: { scores: [9, 8, 8, 8], decision: 'APPROVED', day: -23, feedback: 'Clear architecture. Approved.' },
    });
    await milestone(p1, 'kumar', 'john', {
        title: 'Implementation – Phase 1', description: 'Data pipeline and first trained model working end to end.', due: 2, status: 'SUBMITTED',
        submission: { file: 'phase1-report.pdf', docTitle: 'Implementation Phase 1', lines: ['Data pipeline complete; LSTM baseline recall 81%.', 'Next: tune gradient boosting model.'], day: -3, comments: 'Pipeline and baseline model done. Demo video link inside.' },
    });
    await milestone(p1, 'kumar', 'john', { title: 'Testing & Integration', description: 'Test plan, results, and integrated build.', due: 24, status: 'PENDING' });
    await milestone(p1, 'kumar', 'john', { title: 'Final Report & Presentation', description: 'Complete report, slides and demo video.', due: 45, status: 'PENDING' });
    await notify('john', '"Requirements & System Design" approved – 33/40', `/project-details.html?id=${p1}#milestones`, -23, 1);
    await notify('kumar', 'John Doe submitted work for "Implementation – Phase 1"', `/project-details.html?id=${p1}#milestones`, -3);

    // ---- 2. Alice Smith – in progress with Dr. Priya, on track
    const p2 = await addProject({
        student: 'alice', guide: 'priya', preferred: 'priya', status: 'IN_PROGRESS', createdDay: -60, allocatedDay: -55, updatedDay: -12,
        title: 'Smart Campus Energy Management', domain: 'Internet of Things',
        problem: 'Classrooms and labs waste electricity because lights and air conditioning stay on when rooms are empty.',
        objectives: '1. Detect room occupancy with low-cost sensors\n2. Automate lights and AC\n3. Report energy savings per building',
        methodology: 'PIR + CO2 sensors on Raspberry Pi, rules engine in Node.js, MQTT messaging, Grafana reports.',
        tech: 'Node.js, MQTT, Raspberry Pi, InfluxDB', outcome: 'Pilot in two labs showing at least 20% energy savings.',
        proposals: [{ status: 'APPROVED', reviewer: 'admin', reviewedDay: -56, feedback: 'Approved. Coordinate with the estates office for lab access.' }],
    });
    await log(p2, 'admin', 'Approved proposal v1', -56, 15);
    await log(p2, 'admin', 'Dr. Priya allocated as guide', -55, 10);
    await milestone(p2, 'priya', 'alice', {
        title: 'Literature Survey', description: 'Occupancy detection and building automation approaches.', due: -30, status: 'APPROVED',
        submission: { file: 'smart-campus-survey.pdf', docTitle: 'Literature Survey', lines: ['Occupancy detection: PIR, CO2, Wi-Fi probe methods compared.'], day: -31 },
        review: { scores: [7, 8, 8, 7], decision: 'APPROVED', day: -28, feedback: 'Good. Consider privacy implications of Wi-Fi based sensing.' },
    });
    await milestone(p2, 'priya', 'alice', { title: 'Hardware Prototype', description: 'Sensor node working in one room with live data.', due: 12, status: 'PENDING' });
    await milestone(p2, 'priya', 'alice', { title: 'Automation Rules & Dashboard', description: 'Rules engine and energy dashboard.', due: 40, status: 'PENDING' });

    // ---- 3. Bob Jones – proposal awaiting Dr. Kumar's decision
    const p3 = await addProject({
        student: 'bob', preferred: 'kumar', status: 'PROPOSAL_SUBMITTED', createdDay: -2,
        title: 'Blockchain-Based Student Election System', domain: 'Blockchain',
        problem: 'Paper-based student council elections are slow to count and hard to audit, which leads to disputes.',
        objectives: '1. Tamper-evident vote recording\n2. Anonymous yet verifiable ballots\n3. Instant, auditable results',
        methodology: 'Ethereum smart contracts on a private testnet, commit-reveal voting, React front end with wallet login.',
        tech: 'Solidity, Hardhat, React, ethers.js', outcome: 'A deployed election DApp used in a mock election with 100 voters.',
    });
    await notify('kumar', 'Bob Jones submitted a proposal for review: "Blockchain-Based Student Election System"', `/project-details.html?id=${p3}`, -2);

    // ---- 4. Charlie Brown – delayed (revision overdue) with Dr. Kumar
    const p4 = await addProject({
        student: 'charlie', guide: 'kumar', preferred: 'kumar', status: 'IN_PROGRESS', createdDay: -70, allocatedDay: -66, updatedDay: -14,
        title: 'E-commerce Product Recommendation Engine', domain: 'Machine Learning',
        problem: 'Small online stores show the same products to every visitor, which lowers conversion.',
        objectives: '1. Build collaborative and content-based recommenders\n2. Compare them offline\n3. Serve recommendations via an API',
        methodology: 'Matrix factorisation and TF-IDF item similarity on a public retail dataset; evaluation with precision@k; FastAPI service.',
        tech: 'Python, scikit-learn, FastAPI, PostgreSQL', outcome: 'A recommendation API with measurable lift over a popularity baseline.',
        proposals: [{ status: 'APPROVED', reviewer: 'kumar', reviewedDay: -66 }],
    });
    await log(p4, 'kumar', 'Approved proposal v1', -66, 15);
    await milestone(p4, 'kumar', 'charlie', {
        title: 'Literature Survey', description: 'Recommender system techniques and evaluation metrics.', due: -45, status: 'APPROVED',
        submission: { file: 'recsys-survey.pdf', docTitle: 'Literature Survey', lines: ['Collaborative filtering, content-based and hybrid recommenders.'], day: -46 },
        review: { scores: [7, 6, 7, 7], decision: 'APPROVED', day: -43, feedback: 'Acceptable.' },
    });
    await milestone(p4, 'kumar', 'charlie', {
        title: 'Dataset Preparation & Baseline', description: 'Cleaned dataset and popularity baseline with metrics.', due: -6, status: 'REVISION_REQUESTED',
        submission: { file: 'baseline-results.pdf', docTitle: 'Baseline Results', lines: ['Popularity baseline precision@10 = 0.04.'], day: -18 },
        review: { scores: [5, 4, 6, 5], decision: 'REVISION_REQUESTED', day: -14, feedback: 'Train/test split leaks future purchases. Redo with a time-based split and resubmit.' },
    });
    await milestone(p4, 'kumar', 'charlie', { title: 'Model Implementation', description: 'Matrix factorisation and content-based models.', due: 20, status: 'PENDING' });
    await notify('charlie', 'Revision requested on "Dataset Preparation & Baseline"', `/project-details.html?id=${p4}#milestones`, -14);

    // ---- 5. Diana Prince – at risk (deadline in 3 days) with Dr. Arun
    const p5 = await addProject({
        student: 'diana', guide: 'arun', preferred: 'arun', status: 'IN_PROGRESS', createdDay: -40, allocatedDay: -35, updatedDay: -30,
        title: 'Personal Health Monitoring App', domain: 'Mobile Computing',
        problem: 'Patients with chronic conditions forget to log vitals, so doctors lack data between visits.',
        objectives: '1. Sync readings from wearables\n2. Remind and nudge patients\n3. Share summaries with doctors securely',
        methodology: 'Flutter app with Health Connect integration, Firebase backend, role-based sharing.',
        tech: 'Flutter, Firebase, Health Connect API', outcome: 'App tested with 10 volunteers over two weeks.',
        proposals: [{ status: 'APPROVED', reviewer: 'arun', reviewedDay: -35 }],
    });
    await log(p5, 'arun', 'Approved proposal v1', -35, 15);
    await milestone(p5, 'arun', 'diana', { title: 'Requirements & UI Wireframes', description: 'User stories and Figma wireframes.', due: 3, status: 'PENDING', createdDay: -34 });
    await milestone(p5, 'arun', 'diana', { title: 'Core App Build', description: 'Vitals sync and reminders working.', due: 30, status: 'PENDING', createdDay: -34 });

    // ---- 6. Eve Adams – completed and evaluated by Dr. Sharma
    const p6 = await addProject({
        student: 'eve', guide: 'sharma', preferred: 'sharma', status: 'COMPLETED', createdDay: -160, allocatedDay: -155, finalDay: -12, updatedDay: -5,
        title: 'Digital Library Management System', domain: 'Web Development',
        problem: 'The department library tracks loans in registers, so availability and overdue books are hard to manage.',
        objectives: '1. Catalogue with search\n2. Issue/return with barcode scanning\n3. Automatic overdue reminders',
        methodology: 'Spring Boot REST API, MySQL, React front end, scheduled email reminders.',
        tech: 'Java, Spring Boot, MySQL, React', outcome: 'System deployed in the department library.',
        proposals: [{ status: 'APPROVED', reviewer: 'sharma', reviewedDay: -155 }],
    });
    for (const [title, due, file, scores] of [
        ['Requirements & Design', -120, 'library-design.pdf', [8, 9, 8, 8]],
        ['Implementation', -60, 'library-implementation.pdf', [9, 9, 8, 9]],
        ['Testing & Deployment', -20, 'library-testing.pdf', [9, 8, 9, 8]],
    ]) {
        await milestone(p6, 'sharma', 'eve', {
            title, description: `${title} deliverable.`, due, status: 'APPROVED', createdDay: -150,
            submission: { file, docTitle: title, lines: [`${title} for the Digital Library Management System.`], day: due - 1 },
            review: { scores, decision: 'APPROVED', day: due + 2, feedback: 'Approved.' },
        });
    }
    await addSubmission(p6, null, 'eve', { file: 'final-report-library.pdf', docTitle: 'Final Project Report', lines: ['Digital Library Management System – final report.'], day: -13, docType: 'FINAL_REPORT' });
    await addSubmission(p6, null, 'eve', { file: 'library-presentation.pdf', docTitle: 'Final Presentation', lines: ['Slides for the final viva.'], day: -13, docType: 'PRESENTATION' });
    await log(p6, 'eve', 'Made final submission for evaluation', -12, 18);
    const evalScores = [17, 18, 12, 13, 12, 12];
    const evalTotal = evalScores.reduce((a, b) => a + b, 0);
    await run(`INSERT INTO evaluations (project_id, evaluator_id, technical_score, implementation_score, innovation_score, documentation_score,
               presentation_score, viva_score, total_score, grade, comments, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p6, U.sharma.id, ...evalScores, evalTotal, gradeFor(evalTotal), 'Solid, well-tested system already in use. Innovation is modest but execution is excellent.', stamp(-5, 14)]);
    await log(p6, 'sharma', `Final evaluation: ${evalTotal}/100 (grade ${gradeFor(evalTotal)}) – project completed`, -5, 14);

    // ---- 7. Frank White – approved by coordinator, awaiting guide allocation
    const p7 = await addProject({
        student: 'frank', preferred: 'priya', status: 'APPROVED', createdDay: -6, updatedDay: -4,
        title: 'Campus Placement Preparation Portal', domain: 'Web Development',
        problem: 'Students prepare for placements with scattered resources and no way to track readiness.',
        objectives: '1. Company-wise question bank\n2. Timed mock tests\n3. Readiness analytics for the placement cell',
        methodology: 'Next.js front end, Node.js API, PostgreSQL, analytics with charts.',
        tech: 'Next.js, Node.js, PostgreSQL', outcome: 'Portal piloted with the final-year batch.',
        proposals: [{ status: 'APPROVED', reviewer: 'admin', reviewedDay: -4, feedback: 'Approved – allocating a guide.' }],
    });
    await log(p7, 'admin', 'Approved proposal v1', -4, 15);

    // ---- 8. Grace Lee – changes requested by Dr. Arun
    const p8 = await addProject({
        student: 'grace', preferred: 'arun', status: 'CHANGES_REQUESTED', createdDay: -9, updatedDay: -7,
        title: 'Crop Disease Detection from Leaf Images', domain: 'Computer Vision',
        problem: 'Farmers identify crop diseases late, after significant yield loss.',
        objectives: '1. Classify leaf diseases from photos\n2. Work offline on a phone',
        methodology: 'CNN trained on PlantVillage.',
        tech: 'Python, PyTorch, TensorFlow Lite, Android', outcome: 'Offline Android app.',
        proposals: [{ status: 'CHANGES_REQUESTED', reviewer: 'arun', reviewedDay: -7,
            feedback: 'Promising idea. Please (1) expand the methodology – which architecture, how you will handle field photos vs. lab images, and (2) add measurable objectives such as target accuracy and model size.' }],
    });
    await log(p8, 'arun', 'Requested changes on proposal v1', -7, 15);
    await notify('grace', 'Changes requested on your proposal "Crop Disease Detection from Leaf Images"', '/proposal.html', -7);

    // ---- 9. Hank Green – final submission awaiting Dr. Kumar's evaluation
    const p9 = await addProject({
        student: 'hank', guide: 'kumar', preferred: 'kumar', status: 'FINAL_SUBMISSION', createdDay: -150, allocatedDay: -145, finalDay: -1, updatedDay: -1,
        title: 'Smart Attendance using Face Recognition', domain: 'Computer Vision',
        problem: 'Manual roll calls waste lecture time and proxy attendance is common.',
        objectives: '1. Recognise students from a classroom camera\n2. Mark attendance automatically\n3. Export reports to the ERP',
        methodology: 'MTCNN face detection + FaceNet embeddings, SVM classifier, Django web app.',
        tech: 'Python, OpenCV, FaceNet, Django', outcome: 'Deployed in two classrooms with 95%+ accuracy.',
        proposals: [{ status: 'APPROVED', reviewer: 'kumar', reviewedDay: -145 }],
    });
    for (const [title, due, file, scores] of [
        ['Literature Survey', -120, 'face-recognition-survey.pdf', [8, 7, 8, 7]],
        ['Model Training & Evaluation', -70, 'model-evaluation.pdf', [9, 8, 8, 8]],
        ['Web App & Deployment', -15, 'deployment-report.pdf', [9, 9, 8, 9]],
    ]) {
        await milestone(p9, 'kumar', 'hank', {
            title, description: `${title} deliverable.`, due, status: 'APPROVED', createdDay: -140,
            submission: { file, docTitle: title, lines: [`${title} – Smart Attendance using Face Recognition.`], day: due - 2 },
            review: { scores, decision: 'APPROVED', day: due + 1, feedback: 'Approved.' },
        });
    }
    await addSubmission(p9, null, 'hank', { file: 'final-report-smart-attendance.pdf', docTitle: 'Final Project Report', lines: ['Smart Attendance using Face Recognition – final report.', 'Accuracy 96.2% across two classrooms.'], day: -1, docType: 'FINAL_REPORT' });
    await log(p9, 'hank', 'Uploaded document "final-report-smart-attendance.pdf"', -1, 17);
    await log(p9, 'hank', 'Made final submission for evaluation', -1, 18);
    await notify('kumar', 'Hank Green made the final submission for "Smart Attendance using Face Recognition" – ready for evaluation', `/project-details.html?id=${p9}#evaluation`, -1);

    // Ivy Chen has no project yet – use her account to try the proposal flow from scratch.
    await notify('admin', 'New proposal from Bob Jones: "Blockchain-Based Student Election System"', `/project-details.html?id=${p3}`, -2);
    await notify('admin', 'Frank White\'s approved project is waiting for a guide', '/faculty-allocation.html', -4);
}

module.exports = { seed };

if (require.main === module) {
    (async () => {
        await resetDatabase();
        if (fs.existsSync(UPLOAD_DIR)) {
            for (const f of fs.readdirSync(UPLOAD_DIR)) if (f.startsWith('seed-')) fs.unlinkSync(path.join(UPLOAD_DIR, f));
        }
        await initDatabase();
        await seed();
        console.log('Demo data loaded. All demo accounts use the password: demo123');
    })().catch(err => {
        console.error('Seeding failed:', err);
        process.exit(1);
    });
}
