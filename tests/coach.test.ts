import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server/app';
import { config } from '../server/config';
import * as hfModule from '../server/services/huggingface';
import * as weatherModule from '../server/services/weather';

describe('Garden Coach API & Inference Pipeline', () => {
  const originalToken = config.hfToken;

  beforeEach(() => {
    config.hfToken = 'hf_mock_token_for_tests';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    config.hfToken = originalToken;
    vi.restoreAllMocks();
  });

  describe('Validation & Credentials', () => {
    it('rejects empty message with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/ai/coach')
        .send({ message: '', language: 'en' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('returns 503 when Hugging Face token is missing', async () => {
      config.hfToken = '';
      const res = await request(app)
        .post('/api/ai/coach')
        .send({ message: 'How do I prune my Mogra?', language: 'en' });

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('Hugging Face API token (HF_TOKEN) is not configured');
    });

    it('handles upstream Hugging Face rate limit or failure with clear message', async () => {
      vi.spyOn(hfModule, 'callHuggingFaceChat').mockRejectedValueOnce(
        new hfModule.AiServiceError(429, 'Hugging Face rate limit exceeded (429)')
      );

      const res = await request(app)
        .post('/api/ai/coach')
        .send({ message: 'Why are leaves dropping?', language: 'en' });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('rate limit');
    });
  });

  describe('Personalization & Structured Responses', () => {
    it('returns fully structured coach response with causes, actions, and outdoor mission', async () => {
      const mockAiOutput = JSON.stringify({
        answer: 'Mogra requires warm sunlight and good drainage. Yellowing lower leaves usually indicate overwatering or compacted soil.',
        observations: ['Plant is Mogra located on East balcony', 'Soil feels continuously moist'],
        possibleCauses: [
          { cause: 'Overwatering / poor drainage', confidence: 'high' },
          { cause: 'Nitrogen deficiency', confidence: 'low' },
        ],
        actions: [
          {
            title: 'Check soil moisture 2 inches down',
            instructions: 'Poke a finger or wooden stick into the soil before adding any water.',
            priority: 'high',
          },
          {
            title: 'Clear drainage holes',
            instructions: 'Ensure pot saucer is emptied after drainage.',
            priority: 'medium',
          },
        ],
        followUpQuestion: 'Does the pot have drainage holes at the base?',
        followUpSuggestions: ['How do I fix root rot?', 'Should I repot my Mogra?'],
        outdoorMission: {
          title: 'Morning Soil Inspection',
          durationMinutes: 5,
          steps: ['Check moisture 2 inches down', 'Empty excess saucer water'],
        },
        weatherNote: 'Forecast for Delhi: 30°C, Clear sky',
      });

      vi.spyOn(hfModule, 'callHuggingFaceChat').mockResolvedValueOnce(mockAiOutput);

      const res = await request(app)
        .post('/api/ai/coach')
        .send({
          message: 'My Mogra leaves are turning pale yellow, what should I check?',
          language: 'en',
          gardenContext: {
            region: 'Delhi',
            environment: 'Balcony',
            experienceLevel: 'intermediate',
            plants: [{ name: 'Mogra', category: 'flower', location: 'East balcony' }],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.answer).toContain('Mogra requires warm sunlight');
      expect(res.body.possibleCauses.length).toBe(2);
      expect(res.body.possibleCauses[0].confidence).toBe('high');
      expect(res.body.actions.length).toBe(2);
      expect(res.body.actions[0].priority).toBe('high');
      expect(res.body.outdoorMission).toBeDefined();
      expect(res.body.outdoorMission.title).toBe('Morning Soil Inspection');
      expect(res.body.followUpQuestion).toContain('drainage holes');
      expect(res.body.followUpSuggestions.length).toBe(2);
      // Backwards compatible actionItems list
      expect(res.body.actionItems.length).toBe(2);
    });

    it('gracefully normalizes partial or imperfect JSON model output', async () => {
      // AI gave answer and actionItems but missed actions array
      const partialOutput = JSON.stringify({
        answer: 'Paani tabhi dein jab upar ki mitti sukh jaye.',
        actionItems: ['Check soil moisture', 'Add neem cake compost'],
        followUpSuggestions: ['Kitni dhoop chahiye?'],
      });

      vi.spyOn(hfModule, 'callHuggingFaceChat').mockResolvedValueOnce(partialOutput);

      const res = await request(app)
        .post('/api/ai/coach')
        .send({
          message: 'Tulsi ko kitna paani dein?',
          language: 'hinglish',
        });

      expect(res.status).toBe(200);
      expect(res.body.answer).toBe('Paani tabhi dein jab upar ki mitti sukh jaye.');
      expect(res.body.actions.length).toBe(2);
      expect(res.body.actions[0].instructions).toBe('Check soil moisture');
      expect(res.body.followUpSuggestions).toContain('Kitni dhoop chahiye?');
    });

    it('passes multi-turn conversation history into chat messages', async () => {
      let capturedMessages: any[] = [];
      vi.spyOn(hfModule, 'callHuggingFaceChat').mockImplementation(async (params) => {
        capturedMessages = params.messages;
        return JSON.stringify({
          answer: 'Got it, let us check the roots next.',
          actions: [],
        });
      });

      const conversationHistory = [
        { role: 'user' as const, content: 'My Hibiscus has white spots.' },
        { role: 'assistant' as const, content: 'Those might be mealybugs or powdery mildew.' },
      ];

      await request(app)
        .post('/api/ai/coach')
        .send({
          message: 'I wiped them off, but the leaves look limp now.',
          conversationHistory,
          language: 'en',
        });

      expect(capturedMessages.length).toBe(4); // system, user(1), assistant(1), user(2)
      expect(capturedMessages[1].content).toBe('My Hibiscus has white spots.');
      expect(capturedMessages[2].content).toContain('mealybugs');
      expect(capturedMessages[3].content).toBe('I wiped them off, but the leaves look limp now.');
    });

    it('incorporates live weather note when Open-Meteo weather is fetched', async () => {
      vi.spyOn(weatherModule, 'fetchWeatherForLocation').mockResolvedValueOnce({
        locationName: 'Jaipur, Rajasthan',
        temperatureC: 34.2,
        weatherDescription: 'Sunny',
        dailyForecast: [],
        fetchedAt: new Date().toISOString(),
        isForecastData: true,
      });

      vi.spyOn(hfModule, 'callHuggingFaceChat').mockResolvedValueOnce(
        JSON.stringify({
          answer: 'Jaipur garmi mein Tulsi ko afternoon shade dein.',
          actions: [{ title: 'Shade plant', instructions: 'Move to afternoon shade', priority: 'high' }],
        })
      );

      const res = await request(app)
        .post('/api/ai/coach')
        .send({
          message: 'Dhoop bahut tez hai Jaipur mein, Tulsi bachane ke liye kya karein?',
          language: 'hinglish',
          gardenContext: {
            region: 'Jaipur',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.weatherNote).toContain('Forecast for Jaipur, Rajasthan: 34.2°C, Sunny');
    });
  });

  describe('Multilingual Prompt Handling', () => {
    it('properly configures Hindi prompt with Devanagari script instructions', async () => {
      let systemPrompt = '';
      vi.spyOn(hfModule, 'callHuggingFaceChat').mockImplementation(async (params) => {
        systemPrompt = params.messages[0].content as string;
        return JSON.stringify({ answer: 'पौधे की उचित देखभाल करें।' });
      });

      await request(app)
        .post('/api/ai/coach')
        .send({
          message: 'गुड़हल में फूल नहीं आ रहे हैं।',
          language: 'hi',
        });

      expect(systemPrompt).toContain('Devanagari');
      expect(systemPrompt).toContain('हिंदी लिपि');
    });

    it('properly configures Hinglish prompt with Romanized Hindi instructions', async () => {
      let systemPrompt = '';
      vi.spyOn(hfModule, 'callHuggingFaceChat').mockImplementation(async (params) => {
        systemPrompt = params.messages[0].content as string;
        return JSON.stringify({ answer: 'Paani tabhi dalein jab mitti dry ho.' });
      });

      await request(app)
        .post('/api/ai/coach')
        .send({
          message: 'Rose mein flower kyun nahi aa rahe?',
          language: 'hinglish',
        });

      expect(systemPrompt).toContain('Hinglish');
      expect(systemPrompt).toContain('conversational Hindi');
    });
  });
});
