# ProjectFlow – Student Project Lifecycle Management

Managing student projects by hand makes it hard to track proposals, guide allocation, reviews, milestones, documentation and final evaluation. ProjectFlow keeps the whole lifecycle in one place, with separate dashboards for students, faculty guides and the project coordinator.

## Lifecycle

```
Proposal ──► Review ──► Guide allocation ──► Milestones ──► Submissions ──► Milestone reviews ──► Final submission ──► Final evaluation
   ▲            │                                              ▲                │
   └─ changes ──┘                                              └─ revision ─────┘
      requested / rejected                                        requested
```

| Stage | Who | What happens |
|---|---|---|
| Proposal | Student | Problem, objectives, methodology, technologies, expected outcome, preferred guide. Can edit until reviewed. Every resubmission is kept as a new version. |
| Proposal review | Preferred/allocated guide or coordinator | Approve, request changes (with feedback) or reject. A guide who approves becomes the project's guide. |
| Guide allocation | Coordinator | Allocates or reassigns guides, with each guide's workload shown against their capacity. |
| Milestones | Guide | Adds milestones with deadlines, or applies a standard 5-stage plan in one click. |
| Submissions & documentation | Student (guide for documents) | Uploads deliverables per milestone (multiple versions) and project documents such as the final report, slides and source code. |
| Milestone review | Guide | Scores 4 criteria (each /10) and approves or requests a revision. |
| Final submission | Student | Allowed once every milestone is approved and a final report is uploaded. |
| Final evaluation | Guide or coordinator | Six-criterion rubric out of 100 → grade (O, A+, A, B+, B, C, F). Marks the project completed. |

Project **health** is computed from milestone deadlines: *On track*, *At risk* (an open milestone is due within 7 days) or *Delayed* (an open milestone is overdue). Every action is written to the project's activity log and notifies the people involved.

## Dashboards

- **Student:** next-step guidance, status, progress, guide, next deadline, milestone timeline with upload buttons, latest feedback, activity.
- **Faculty:** to-do queue (proposals, submissions to review, final evaluations), active projects with health and progress, upcoming deadlines.
- **Coordinator:** department stats, projects by stage, health of in-progress projects, guide workload, projects needing attention, recent activity, CSV export, user management.

## Running it

```bash
npm install
npm start          # http://localhost:3000 – loads demo data automatically on first run
```

Other scripts:

```bash
npm run dev        # auto-restart on server changes (nodemon)
npm run seed       # reset the database to fresh demo data
npm test           # end-to-end API test of the full lifecycle (uses a throwaway database)
```

For production, copy `.env.example` to `.env` and set a long random `JWT_SECRET`.

## Demo accounts

All demo accounts use the password **`demo123`**. The sign-in page also has one-click buttons for them.

| Account | Role | Demo state |
|---|---|---|
| student@example.com | Student (John Doe) | In progress; one submission awaiting review |
| ivy@example.com | Student (Ivy Chen) | No proposal yet, so you can try the flow from scratch |
| grace@example.com | Student (Grace Lee) | Changes requested on her proposal |
| charlie@example.com | Student | Delayed: revision overdue |
| eve@example.com | Student | Completed, graded A+ |
| faculty@example.com | Faculty (Dr. Kumar) | Pending proposal, a submission to review, a final evaluation due |
| priya@ / arun@ / sharma@example.com | Faculty | Other guides |
| admin@example.com | Project coordinator | Whole department |

## Tech stack

- **Backend:** Node.js, Express 5, SQLite (`sqlite3`), JWT in an httpOnly cookie, bcrypt, Multer
- **Frontend:** HTML, CSS and vanilla JavaScript (no build step), light and dark themes, responsive

## Project structure

```
server/
  server.js            Express app; auto-seeds an empty database
  database.js          Schema + promise helpers
  seed.js              Demo data (dates relative to today)
  lib/workflow.js      Access rules, health, grading, notifications, validation
  middleware/auth.js   JWT auth + role guard
  routes/              auth, users, projects, proposals, milestones, submissions, notifications, dashboard
public/
  css/app.css          Design system
  js/app.js            API client, app shell, badges, modals, toasts
  js/project-ui.js     Shared project components (milestones, review/upload/allocate dialogs)
  js/pages/*.js        One script per page
  *.html               Page shells
tests/lifecycle.test.js
uploads/               Uploaded files (served only to users who can see the project)
```

## Security notes

- Passwords are hashed with bcrypt. Sessions are JWTs in httpOnly, SameSite=Lax cookies.
- Every project route checks access: students see only their own project, faculty see only projects they guide (or proposals naming them as preferred guide), admins see everything.
- Uploads are limited to 25 MB and an allowlist of document, archive, image and video types, stored under random names and downloaded through an authorised endpoint.
- All user content is HTML-escaped before rendering.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/register`, `/api/auth/logout` · GET `/api/auth/me` | Session |
| GET | `/api/dashboard/student` \| `faculty` \| `admin` | Role dashboards |
| GET | `/api/projects`, `/api/projects/:id` | Role-scoped list, full project detail |
| POST | `/api/projects/proposal` | Submit / edit / resubmit a proposal |
| GET/POST | `/api/proposals`, `/api/proposals/:id/review` | Review queue, decision |
| POST | `/api/projects/:id/allocate` | Allocate or reassign a guide |
| POST | `/api/projects/:id/milestones`, `/milestones/template` | Add milestone, apply standard plan |
| PUT/DELETE | `/api/milestones/:id` | Edit / remove milestone |
| POST | `/api/milestones/:id/review` · GET `/api/milestones/review-queue` | Milestone reviews |
| POST | `/api/submissions` · GET `/api/submissions/:id/download` | Upload / download files |
| POST | `/api/projects/:id/final-submit`, `/api/projects/:id/evaluation` | Final submission and evaluation |
| GET/POST | `/api/notifications`, `/api/notifications/read` | Notifications |
| GET/POST/PUT | `/api/users`, `/api/users/faculty`, `/api/users/:id/capacity` | User management, guide workload |
