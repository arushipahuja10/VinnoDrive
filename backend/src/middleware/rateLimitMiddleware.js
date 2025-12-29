const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 1000, 
    max: 10, 
    message: { error: "Rate limit exceeded. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user ? req.user.id : req.ip
});

module.exports = apiLimiter;