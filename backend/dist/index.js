"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const files_routes_1 = __importDefault(require("./routes/files.routes"));
const requests_routes_1 = __importDefault(require("./routes/requests.routes"));
const movements_routes_1 = __importDefault(require("./routes/movements.routes"));
const stats_routes_1 = __importDefault(require("./routes/stats.routes"));
const notes_routes_1 = __importDefault(require("./routes/notes.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '1mb' }));
// General API rate limit (separate, stricter limit is applied to /auth/login).
app.use('/api', (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
}));
app.get('/health', async (_req, res) => {
    try {
        await (0, db_1.pingDb)();
        res.json({ status: 'ok', db: 'connected' });
    }
    catch (err) {
        // Log the real MySQL/connection error server-side (visible in Render's
        // Logs tab) without exposing DB details to whoever hits this endpoint.
        console.error('Health check DB connection failed:', err);
        res.status(503).json({ status: 'error', db: 'unreachable' });
    }
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/files', files_routes_1.default);
app.use('/api/requests', requests_routes_1.default);
app.use('/api/movements', movements_routes_1.default);
app.use('/api/stats', stats_routes_1.default);
app.use('/api/notes', notes_routes_1.default);
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
    console.log(`Nyandarua Registry API listening on port ${PORT}`);
});
