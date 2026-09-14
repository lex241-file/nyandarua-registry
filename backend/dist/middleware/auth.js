"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '8h'),
    });
}
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    // Plain <a href="..."> download navigations (used for note attachments)
    // can't set a custom Authorization header, so this one accepts the
    // token as a ?token= query param as a fallback. Only relied on for
    // that read-only download route — every state-changing request still
    // goes through the header. Tokens in URLs can end up in server logs,
    // which is an acceptable tradeoff here for a simple internal document
    // download feature, but worth knowing if this pattern gets reused
    // elsewhere later.
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : queryToken;
    if (!token) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthenticated' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'You do not have permission to perform this action' });
        }
        next();
    };
}
