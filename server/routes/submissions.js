const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { run, get } = require('../database');
const { authenticate } = require('../middleware/auth');
const wf = require('../lib/workflow');
const { HttpError } = wf;
const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.zip', '.rar', '.7z', '.png', '.jpg', '.jpeg', '.mp4'];
const DOC_TYPES = ['DELIVERABLE', 'FINAL_REPORT', 'PRESENTATION', 'SOURCE_CODE', 'OTHER'];
const MAX_MB = 25;

const upload = multer({
    storage: multer.diskStorage({
        destination: UPLOAD_DIR,
        // Stored under a random name; the original name is kept in the DB
        filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: MAX_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXT.includes(ext)) cb(null, true);
        else cb(new HttpError(400, `File type ${ext || '(none)'} is not allowed. Allowed: ${ALLOWED_EXT.join(' ')}`));
    },
});

function uploadSingle(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return next(new HttpError(400, err.code === 'LIMIT_FILE_SIZE' ? `File is larger than ${MAX_MB} MB` : err.message));
        }
        next(err);
    });
}

router.post('/', authenticate, uploadSingle, async (req, res) => {
    const file = req.file;
    try {
        if (!file) throw new HttpError(400, 'Choose a file to upload');
        const project = await wf.loadProjectFor(req.user, req.body.projectId);
        const isOwner = req.user.role === 'STUDENT' && project.student_id === req.user.id;
        const comments = wf.optionalText(req.body, 'comments', 2000);
        const link = `/project-details.html?id=${project.id}`;

        if (req.body.milestoneId) {
            // Milestone deliverable
            const milestone = await get(`SELECT * FROM milestones WHERE id = ? AND project_id = ?`, [req.body.milestoneId, project.id]);
            if (!milestone) throw new HttpError(404, 'Milestone not found');
            if (!isOwner) throw new HttpError(403, 'Only the student can submit milestone work');
            if (project.status !== 'IN_PROGRESS') throw new HttpError(400, 'Submissions are closed for this project');
            if (milestone.status === 'APPROVED') throw new HttpError(400, 'This milestone is already approved');

            await run(`INSERT INTO submissions (project_id, milestone_id, uploaded_by, doc_type, file_name, stored_name, file_size, comments)
                       VALUES (?, ?, ?, 'DELIVERABLE', ?, ?, ?, ?)`,
                [project.id, milestone.id, req.user.id, file.originalname, file.filename, file.size, comments]);
            await run(`UPDATE milestones SET status = 'SUBMITTED' WHERE id = ?`, [milestone.id]);
            const late = milestone.deadline < wf.today() ? ' (late)' : '';
            await wf.logActivity(project.id, req.user.id, `Submitted "${file.originalname}" for "${milestone.title}"${late}`);
            await wf.notify(project.guide_id, `${project.student_name} submitted work for "${milestone.title}"${late}`, `${link}#milestones`);
        } else {
            // General project documentation
            if (!isOwner && !wf.canSupervise(req.user, project)) throw new HttpError(403, 'You cannot upload to this project');
            if (!['IN_PROGRESS', 'FINAL_SUBMISSION'].includes(project.status)) throw new HttpError(400, 'Documents can only be uploaded while the project is active');
            const docType = DOC_TYPES.includes(req.body.docType) ? req.body.docType : 'OTHER';
            await run(`INSERT INTO submissions (project_id, milestone_id, uploaded_by, doc_type, file_name, stored_name, file_size, comments)
                       VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
                [project.id, req.user.id, docType, file.originalname, file.filename, file.size, comments]);
            await wf.logActivity(project.id, req.user.id, `Uploaded document "${file.originalname}"`);
            await wf.notify(isOwner ? project.guide_id : project.student_id, `${req.user.name} uploaded "${file.originalname}"`, `${link}#files`);
        }
        await wf.touchProject(project.id);
        res.status(201).json({ message: 'Uploaded successfully' });
    } catch (err) {
        if (file) fs.unlink(file.path, () => {});
        throw err;
    }
});

// Files are only served to users who can view the project
router.get('/:id/download', authenticate, async (req, res) => {
    const sub = await get(`SELECT * FROM submissions WHERE id = ?`, [req.params.id]);
    if (!sub) throw new HttpError(404, 'File not found');
    await wf.loadProjectFor(req.user, sub.project_id);
    const filePath = path.join(UPLOAD_DIR, path.basename(sub.stored_name));
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'File is missing from storage');
    res.download(filePath, sub.file_name);
});

module.exports = router;
