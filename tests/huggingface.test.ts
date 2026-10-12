import { describe, it, expect } from 'vitest';
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
});
