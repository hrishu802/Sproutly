import { describe, it, expect, vi } from 'vitest';
import { extractJson, AiServiceError } from '../server/services/huggingface';
import {
  getLanguageInstruction,
  buildDoctorSystemPrompt,
  buildCoachSystemPrompt,
  buildMissionsSystemPrompt,
} from '../server/services/prompts';

describe('AI Service Helpers & Multilingual Prompts', () => {
  describe('extractJson', () => {
    it('parses direct JSON string', () => {
      const input = '{"answer": "Water gently at the base"}';
      const parsed = extractJson<{ answer: string }>(input);
      expect(parsed.answer).toBe('Water gently at the base');
    });

    it('parses JSON wrapped in markdown code fences', () => {
      const input = '```json\n{"summary": "Powdery mildew detected", "confidence": "high"}\n```';
      const parsed = extractJson<{ summary: string; confidence: string }>(input);
      expect(parsed.summary).toBe('Powdery mildew detected');
      expect(parsed.confidence).toBe('high');
    });

    it('extracts embedded JSON surrounded by preamble or postscript', () => {
      const input = `Here is the requested diagnosis:
{
  "summary": "Nutrient deficiency",
  "visibleObservations": ["Yellow leaf margins"]
}
Hope this helps!`;
      const parsed = extractJson<{ summary: string; visibleObservations: string[] }>(input);
      expect(parsed.summary).toBe('Nutrient deficiency');
      expect(parsed.visibleObservations[0]).toBe('Yellow leaf margins');
    });

    it('throws AiServiceError with status 502 when given invalid non-JSON output', () => {
      const input = 'I am sorry, but I cannot process this plant photo.';
      expect(() => extractJson(input)).toThrow(AiServiceError);
      try {
        extractJson(input);
      } catch (err: any) {
        expect(err.status).toBe(502);
      }
    });
  });

  describe('Multilingual Prompts', () => {
    it('generates English instructions', () => {
      const inst = getLanguageInstruction('en');
      expect(inst).toContain('English');
    });

    it('generates Devanagari Hindi instructions', () => {
      const inst = getLanguageInstruction('hi');
      expect(inst).toContain('Devanagari');
      expect(inst).toContain('हिंदी लिपि');
    });

    it('generates Hinglish instructions with conversational example', () => {
      const inst = getLanguageInstruction('hinglish');
      expect(inst).toContain('Hinglish');
      expect(inst).toContain('paudhe');
    });

    it('builds Doctor prompt with JSON schema and disclaimer', () => {
      const prompt = buildDoctorSystemPrompt('en');
      expect(prompt).toContain('Plant Doctor');
      expect(prompt).toContain('visibleObservations');
      expect(prompt).toContain('possibleCauses');
      expect(prompt).toContain('disclaimer');
    });

    it('builds Coach prompt with gardener context', () => {
      const prompt = buildCoachSystemPrompt('hinglish', {
        region: 'Delhi NCR',
        environment: 'Balcony',
        plants: [{ name: 'Tulsi', category: 'herb' }],
      });
      expect(prompt).toContain('Garden Coach');
      expect(prompt).toContain('Delhi NCR');
      expect(prompt).toContain('Tulsi');
      expect(prompt).toContain('Hinglish');
    });

    it('builds Touch Grass Missions prompt with safety rules', () => {
      const prompt = buildMissionsSystemPrompt('hi', 'North India', 'Summer');
      expect(prompt).toContain('Touch Grass Mission');
      expect(prompt).toContain('SAFETY RULES');
      expect(prompt).toContain('हिंदी लिपि');
    });
  });

  describe('Provider Error Classification & Truthful Status', () => {
    it('classifies HTTP 402 as billing/quota exhaustion error', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({ error: 'You have no remaining credits.' }),
      }) as any;

      const { callHuggingFaceChat } = await import('../server/services/huggingface');
      const { config } = await import('../server/config');
      config.hfToken = 'test_token';

      try {
        await expect(
          callHuggingFaceChat({
            model: 'google/gemma-3-4b-it',
            messages: [{ role: 'user', content: 'Hi' }],
          })
        ).rejects.toThrow(/billing\/quota limit/i);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('classifies HTTP 400 as provider model support error', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: "The requested model 'unknown/model' is not supported by any provider" },
        }),
      }) as any;

      const { callHuggingFaceChat } = await import('../server/services/huggingface');
      const { config } = await import('../server/config');
      config.hfToken = 'test_token';

      try {
        await expect(
          callHuggingFaceChat({
            model: 'unknown/model',
            messages: [{ role: 'user', content: 'Hi' }],
          })
        ).rejects.toThrow(/provider error/i);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('verifies independent text and vision model separation in config', async () => {
      const { config } = await import('../server/config');
      expect(config.hfTextModel).toBeDefined();
      expect(config.hfVisionModel).toBeDefined();
      expect(config.hfVisionModel).toContain('Vision');
    });

    it('falls back automatically if provider rejects response_format with 400', async () => {
      const originalFetch = globalThis.fetch;
      let requestCount = 0;
      let secondRequestBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, options: any) => {
        requestCount++;
        if (requestCount === 1) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'response_format is not supported by provider' } }),
          } as Response;
        }
        secondRequestBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '{"answer":"Fallback success"}' } }] }),
        } as Response;
      }) as any;

      const { callHuggingFaceChat } = await import('../server/services/huggingface');
      const { config } = await import('../server/config');
      config.hfToken = 'test_token';

      try {
        const result = await callHuggingFaceChat({
          model: 'google/gemma-3-4b-it',
          messages: [{ role: 'user', content: 'Hi' }],
        });
        expect(result).toBe('{"answer":"Fallback success"}');
        expect(requestCount).toBe(2);
        expect(secondRequestBody.response_format).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('respects 15-second cooldown on testInferenceConnection to prevent rapid credit waste', async () => {
      const originalFetch = globalThis.fetch;
      let chatCallCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('whoami')) {
          return { ok: true, status: 200, json: async () => ({ name: 'gardener' }) } as Response;
        }
        if (url.includes('chat/completions')) {
          chatCallCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: '{"status":"ok"}' } }] }),
          } as Response;
        }
        return { ok: false, status: 500 } as Response;
      }) as any;

      const { testInferenceConnection, clearAiStatusCache } = await import('../server/services/huggingface');
      const { config } = await import('../server/config');
      config.hfToken = 'test_token';
      clearAiStatusCache();

      try {
        const first = await testInferenceConnection();
        expect(first.state).toBe('connected');
        expect(chatCallCount).toBe(1);

        // Immediate second call should use cooldown cache without firing another chat call
        const second = await testInferenceConnection();
        expect(second.state).toBe('connected');
        expect(chatCallCount).toBe(1); // Still 1, credits saved!
      } finally {
        globalThis.fetch = originalFetch;
        clearAiStatusCache();
      }
    });
  });
});
