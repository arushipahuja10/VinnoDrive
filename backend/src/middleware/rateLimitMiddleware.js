// backend/src/middleware/rateLimitMiddleware.js
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 1000, // 1 second
    max: 10, // Limit each User/IP to 2 requests per second
    message: { error: "Rate limit exceeded. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user ? req.user.id : req.ip
});

module.exports = apiLimiter;