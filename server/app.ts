import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { corsMiddleware } from './middleware/cors';
import { globalLimiter } from './middleware/rateLimit';
import { aiRouter } from './routes/ai';
import { AiServiceError } from './services/huggingface';

export const app = express();

// Basic security: disable x-powered-by
app.disable('x-powered-by');

// CORS middleware
app.use(corsMiddleware);

// Global rate limiting
app.use(globalLimiter);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Healthcheck
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Sproutly AI Backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// AI Routes
app.use('/api/ai', aiRouter);

// 404 Handler for undefined API routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized Error Handling Middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image file too large. Maximum size is 5 MB.' });
    }
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }

  if (err instanceof AiServiceError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof Error) {
    // Check if error is a CORS error
    if (err.message.includes('CORS policy')) {
      return res.status(403).json({ error: err.message });
    }
    // Check if validation or client error message
    if (err.message.startsWith('Invalid file type')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[Server Error]', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }

  console.error('[Unhandled Error]', err);
  return res.status(500).json({ error: 'An unexpected internal error occurred.' });
});
