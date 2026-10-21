require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { initDatabase, get } = require('./database');
const { seed } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/proposals', require('./routes/proposals'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards rejected async handlers here
app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server' : err.message });
});

async function start(port = PORT) {
    await initDatabase();
    const users = await get(`SELECT COUNT(*) AS n FROM users`);
    if (!users.n) {
        console.log('Empty database – loading demo data...');
        await seed();
    }
    return new Promise(resolve => {
        const server = app.listen(port, () => {
            console.log(`ProjectFlow running at http://localhost:${server.address().port}`);
            resolve(server);
        });
    });
}

module.exports = { app, start };

if (require.main === module) {
    start().catch(err => {
        console.error('Failed to start server', err);
        process.exit(1);
    });
}
