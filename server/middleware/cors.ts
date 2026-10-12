import cors from 'cors';
import { config } from '../config';

const clientUrlClean = config.clientUrl ? config.clientUrl.trim().replace(/\/+$/, '') : '';

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  clientUrlClean,
].filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, or same-origin in production)
    const isVercelOrigin = origin ? /^https:\/\/sproutly[a-z0-9-]*\.vercel\.app$/.test(origin) : false;
    if (!origin || allowedOrigins.includes(origin) || isVercelOrigin) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
