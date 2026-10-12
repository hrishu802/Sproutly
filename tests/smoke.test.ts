import { describe, it, expect } from 'vitest';
import { callHuggingFaceChat } from '../server/services/huggingface';
import { config } from '../server/config';

describe('Opt-in Real AI Inference Smoke Test', () => {
  const shouldRun = process.env.RUN_SMOKE_TESTS === 'true' && Boolean(config.hfToken);

  it.runIf(shouldRun)('verifies actual text generation against configured model', async () => {
    const response = await callHuggingFaceChat({
      model: config.hfTextModel,
      messages: [
        { role: 'system', content: 'You are a gardening assistant. Return JSON: {"status": "ok"}' },
        { role: 'user', content: 'Ping' },
      ],
      maxTokens: 50,
    });

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(0);
  });
});
