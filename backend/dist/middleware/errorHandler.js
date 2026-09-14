"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.handleValidation = handleValidation;
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
const express_validator_1 = require("express-validator");
/** Run after express-validator checks; returns 400 with details if any failed. */
function handleValidation(req, res, next) {
    const result = (0, express_validator_1.validationResult)(req);
    if (!result.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: result.array() });
    }
    next();
}
function notFoundHandler(_req, res) {
    res.status(404).json({ error: 'Not found' });
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorHandler(err, _req, res, _next) {
    console.error(err);
    const status = err.status || 500;
    const message = status === 500 ? 'Internal server error' : err.message;
    res.status(status).json({ error: message });
}
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.HttpError = HttpError;
