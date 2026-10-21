const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET) {
    console.warn('[auth] JWT_SECRET not set – using an insecure development secret. Set it in .env for production.');
}

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
};

function signToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
}

function authenticate(req, res, next) {
    const header = req.headers.authorization;
    const token = req.cookies?.token || (header?.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) return res.status(401).json({ error: 'Please sign in to continue' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
}

const requireRole = (...roles) => (req, res, next) => {
    if (!roles.flat().includes(req.user?.role)) {
        return res.status(403).json({ error: 'You do not have permission to do that' });
    }
    next();
};

module.exports = { authenticate, requireRole, signToken, COOKIE_OPTIONS };
