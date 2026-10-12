import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server/app';
import { config } from '../server/config';

describe('Sproutly Express API & Security Middleware', () => {
  const originalToken = config.hfToken;

  afterEach(() => {
    config.hfToken = originalToken;
  });

  it('GET /api/health returns 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('Sproutly AI Backend');
  });

  it('GET /api/ai/status returns truthful connection states without false positives', async () => {
    config.hfToken = '';
    const resNoToken = await request(app).get('/api/ai/status');
    expect(resNoToken.status).toBe(200);
    expect(resNoToken.body.available).toBe(false);
    expect(resNoToken.body.state).toBe('unconfigured');

    // Token present but unverified: should report configured, NOT connected!
    config.hfToken = 'hf_mock_token_for_test';
    // Mock whoami response
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      if (url.includes('whoami')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ name: 'test_gardener' }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    }) as any;

    try {
      const resConfigured = await request(app).get('/api/ai/status');
      expect(resConfigured.status).toBe(200);
      expect(resConfigured.body.state).toBe('configured');
      expect(resConfigured.body.available).toBe(false); // Truthful: not claimed as connected yet!
      expect(resConfigured.body.accountUsername).toBe('test_gardener');
      expect(resConfigured.body.model).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/ai/status/test runs on-demand probe and reports state', async () => {
    config.hfToken = 'hf_mock_token_for_test';
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string) => {
      if (url.includes('whoami')) {
        return { ok: true, status: 200, json: async () => ({ name: 'test_gardener' }) } as Response;
      }
      if (url.includes('chat/completions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '{"status":"ok"}' } }] }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    }) as any;

    try {
      const res = await request(app).post('/api/ai/status/test');
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('connected');
      expect(res.body.available).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/ai/diagnose rejects missing symptoms with 400', async () => {
    const res = await request(app)
      .post('/api/ai/diagnose')
      .field('plantName', 'Rose')
      .field('language', 'en');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('POST /api/ai/diagnose rejects invalid file types (e.g. .txt)', async () => {
    const res = await request(app)
      .post('/api/ai/diagnose')
      .field('symptoms', 'Yellow leaves with black spots')
      .attach('image', Buffer.from('hello plain text'), 'notes.txt');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid file type');
  });

  it('POST /api/ai/diagnose returns 503 with clear explanation when HF_TOKEN is missing', async () => {
    config.hfToken = '';
    const res = await request(app)
      .post('/api/ai/diagnose')
      .field('plantName', 'Rose')
      .field('symptoms', 'Yellow leaves with black spots')
      .field('language', 'en');

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('Hugging Face API token (HF_TOKEN) is not configured');
  });

  it('POST /api/ai/coach rejects empty message with 400', async () => {
    const res = await request(app)
      .post('/api/ai/coach')
      .send({
        message: '',
        language: 'en',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('POST /api/ai/coach returns 503 with clear error when HF_TOKEN is missing', async () => {
    config.hfToken = '';
    const res = await request(app)
      .post('/api/ai/coach')
      .send({
        message: 'How often should I water my Mogra in summer?',
        conversationHistory: [],
        language: 'hinglish',
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('Hugging Face API token (HF_TOKEN) is not configured');
  });

  it('POST /api/ai/missions returns 503 with clear error when HF_TOKEN is missing', async () => {
    config.hfToken = '';
    const res = await request(app)
      .post('/api/ai/missions')
      .send({
        plants: [{ id: '1', name: 'Tulsi', category: 'herb' }],
        language: 'hi',
        region: 'North India',
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('Hugging Face API token (HF_TOKEN) is not configured');
  });

  it('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Endpoint not found');
  });
});
