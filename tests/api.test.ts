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

  it('GET /api/ai/status returns AI availability correctly', async () => {
    config.hfToken = '';
    const resNoToken = await request(app).get('/api/ai/status');
    expect(resNoToken.status).toBe(200);
    expect(resNoToken.body.available).toBe(false);

    config.hfToken = 'hf_mock_token_for_test';
    const resWithToken = await request(app).get('/api/ai/status');
    expect(resWithToken.status).toBe(200);
    expect(resWithToken.body.available).toBe(true);
    expect(resWithToken.body.model).toBeDefined();
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
