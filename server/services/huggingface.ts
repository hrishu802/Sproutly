import { config } from '../config';

export class AiServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AiServiceError';
  }
}

interface ChatMessagePart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessagePart[];
}

export function extractJson<T>(rawText: string): T {
  let cleaned = rawText.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  // Attempt direct JSON parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt to locate first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(extracted) as T;
      } catch (innerErr) {
        throw new AiServiceError(
          502,
          `Failed to parse structured JSON from AI provider response: ${(innerErr as Error).message}`
        );
      }
    }
    throw new AiServiceError(502, 'AI provider did not return valid JSON output.');
  }
}

export async function callHuggingFaceChat(params: {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  if (!config.hfToken) {
    throw new AiServiceError(
      503,
      'Hugging Face API token (HF_TOKEN) is not configured on the server. Please set HF_TOKEN in your environment or .env file.'
    );
  }

  const endpoint = `${config.hfApiBase}/chat/completions`;
  const timeoutMs = config.aiTimeoutMs || 25000;

  const executeRequest = async (): Promise<Response> => {
    return fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${config.hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens ?? 1500,
        temperature: params.temperature ?? 0.3,
        response_format: { type: 'json_object' },
      }),
    });
  };

  let response: Response;
  try {
    response = await executeRequest();
  } catch (netErr: any) {
    // Attempt 1 retry on timeout or transient network failure
    try {
      await new Promise((r) => setTimeout(r, 1000));
      response = await executeRequest();
    } catch {
      const isTimeout = netErr.name === 'TimeoutError' || (netErr.message && netErr.message.includes('timeout'));
      throw new AiServiceError(
        504,
        isTimeout
          ? `Request timed out after ${timeoutMs / 1000}s while waiting for Hugging Face Inference Providers.`
          : `Network connectivity error when contacting Hugging Face Inference Providers: ${(netErr as Error).message}`
      );
    }
  }

  // Handle transient 503/504 retry from provider
  if ((response.status === 503 || response.status === 504) && !response.ok) {
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const retryRes = await executeRequest();
      if (retryRes.ok) {
        response = retryRes;
      }
    } catch {
      // Continue with original response
    }
  }

  if (!response.ok) {
    let errorDetail = `Status ${response.status}`;
    try {
      const errorJson = (await response.json()) as Record<string, any>;
      errorDetail = errorJson?.error?.message || errorJson?.error || errorJson?.message || JSON.stringify(errorJson);
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        // use default
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new AiServiceError(
        response.status,
        `Hugging Face authentication failed: Invalid or expired HF_TOKEN (${errorDetail}).`
      );
    }
    if (response.status === 429) {
      throw new AiServiceError(
        429,
        `Hugging Face rate limit or quota exceeded: ${errorDetail}.`
      );
    }
    if (response.status === 404) {
      throw new AiServiceError(
        502,
        `Model "${params.model}" not found or not supported by inference provider: ${errorDetail}.`
      );
    }

    throw new AiServiceError(
      response.status >= 500 ? 502 : response.status,
      `Hugging Face Inference Providers error (${response.status}): ${errorDetail}`
    );
  }

  try {
    const data = (await response.json()) as Record<string, any>;
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new AiServiceError(502, 'AI provider returned an empty or malformed completion.');
    }
    return content;
  } catch (parseErr) {
    if (parseErr instanceof AiServiceError) throw parseErr;
    throw new AiServiceError(502, `Failed to parse response from AI provider: ${(parseErr as Error).message}`);
  }
}
