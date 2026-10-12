import rateLimit from 'express-rate-limit';

// Global rate limiter: 120 requests per 15 minutes
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

// Strict rate limiter for AI inference routes: 30 requests per 15 minutes
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI request limit reached for this session. Please wait before submitting more queries.',
  },
});
