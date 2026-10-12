import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server/app';

describe('Pl@ntNet Species Identification API', () => {
  const originalEnvKey = process.env.PLANTNET_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.PLANTNET_API_KEY = originalEnvKey;
    globalThis.fetch = originalFetch;
  });

  it('rejects request without image file with 400', async () => {
    const res = await request(app).post('/api/ai/identify-plant');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Please upload an image file');
  });

  it('returns 503 with helpful message when PLANTNET_API_KEY is not configured', async () => {
    delete process.env.PLANTNET_API_KEY;

    const dummyImageBuffer = Buffer.from('fake-jpeg-data');
    const res = await request(app)
      .post('/api/ai/identify-plant')
      .attach('image', dummyImageBuffer, 'plant.jpg');

    expect(res.status).toBe(503);
    expect(res.body.available).toBe(false);
    expect(res.body.error).toContain('Pl@ntNet API key (PLANTNET_API_KEY) is not configured');
  });

  it('successfully identifies plant species when API returns match', async () => {
    process.env.PLANTNET_API_KEY = 'mock_plantnet_key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            score: 0.88,
            species: {
              scientificNameWithoutAuthor: 'Ocimum tenuiflorum',
              commonNames: ['Holy Basil', 'Tulsi'],
              family: { scientificNameWithoutAuthor: 'Lamiaceae' },
            },
          },
          {
            score: 0.12,
            species: {
              scientificNameWithoutAuthor: 'Ocimum basilicum',
              commonNames: ['Sweet Basil', 'Genovese Basil'],
              family: { scientificNameWithoutAuthor: 'Lamiaceae' },
            },
          },
        ],
      }),
    });
    globalThis.fetch = mockFetch as any;

    const dummyImageBuffer = Buffer.from('fake-jpeg-data');
    const res = await request(app)
      .post('/api/ai/identify-plant')
      .attach('image', dummyImageBuffer, 'tulsi.jpg');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.results.length).toBe(2);
    expect(res.body.results[0].species).toBe('Ocimum tenuiflorum');
    expect(res.body.results[0].commonNames).toContain('Holy Basil');
    expect(res.body.results[0].score).toBe(0.88);
  });

  it('handles Pl@ntNet rate limit or quota exceeded with 503', async () => {
    process.env.PLANTNET_API_KEY = 'mock_plantnet_key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });
    globalThis.fetch = mockFetch as any;

    const dummyImageBuffer = Buffer.from('fake-jpeg-data');
    const res = await request(app)
      .post('/api/ai/identify-plant')
      .attach('image', dummyImageBuffer, 'plant.jpg');

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('rate limit or daily quota');
  });
});
