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

  const executeRequest = async (includeFormat = true): Promise<Response> => {
    const payload: Record<string, any> = {
      model: params.model,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 1500,
      temperature: params.temperature ?? 0.3,
    };
    if (includeFormat) {
      payload.response_format = { type: 'json_object' };
    }

    return fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${config.hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

    // Handle provider rejection of response_format: { type: 'json_object' }
    if (response.status === 400 && /response_format|response format/i.test(errorDetail)) {
      try {
        const fallbackRes = await executeRequest(false);
        if (fallbackRes.ok) {
          response = fallbackRes;
        }
      } catch {
        // Fallback network error; continue with original error handling
      }
    }

    if (response.ok) {
      // Fallback request succeeded, proceed to response extraction
    } else if (response.status === 401 || response.status === 403) {
      throw new AiServiceError(
        response.status,
        `Hugging Face authentication failed: Invalid or expired HF_TOKEN (${errorDetail}).`
      );
    } else if (response.status === 402) {
      throw new AiServiceError(
        402,
        `Hugging Face billing/quota limit: You have no remaining inference credits on this account. Purchase pre-paid credits at https://huggingface.co/settings/billing or subscribe to PRO.`
      );
    } else if (response.status === 429) {
      throw new AiServiceError(
        429,
        `Hugging Face rate limit or quota exceeded: ${errorDetail}.`
      );
    } else if (response.status === 400) {
      throw new AiServiceError(
        400,
        `Hugging Face provider error: ${errorDetail}`
      );
    } else if (response.status === 404) {
      throw new AiServiceError(
        502,
        `Model "${params.model}" not found or not supported by inference provider: ${errorDetail}.`
      );
    } else {
      throw new AiServiceError(
        response.status >= 500 ? 502 : response.status,
        `Hugging Face Inference Providers error (${response.status}): ${errorDetail}`
      );
    }
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

// ========== Truthful AI Status & Diagnostic Services ==========

export type AIConnectionState = 'unconfigured' | 'configured' | 'connected' | 'quota_exceeded' | 'error';

export interface AIStatusDetail {
  available: boolean;
  state: AIConnectionState;
  model: string;
  visionModel: string;
  accountUsername?: string;
  message: string;
  lastChecked: string;
}

interface WhoamiCacheEntry {
  valid: boolean;
  username?: string;
  error?: string;
  checkedAt: number;
}

let whoamiCache: WhoamiCacheEntry | null = null;
const WHOAMI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache for live inference test result
let lastInferenceState: {
  state: AIConnectionState;
  available: boolean;
  message: string;
  checkedAt: number;
} | null = null;
const TEST_COOLDOWN_MS = 15 * 1000; // 15-second cooldown to prevent accidental credit consumption

export async function verifyHuggingFaceToken(
  forceRefresh = false
): Promise<{ valid: boolean; username?: string; error?: string }> {
  const token = (config.hfToken || '').trim();
  if (!token) {
    return { valid: false, error: 'HF_TOKEN is not configured' };
  }

  if (!forceRefresh && whoamiCache && Date.now() - whoamiCache.checkedAt < WHOAMI_CACHE_TTL_MS) {
    return whoamiCache;
  }

  try {
    const res = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = (await res.json()) as { name?: string };
      whoamiCache = {
        valid: true,
        username: data.name || 'user',
        checkedAt: Date.now(),
      };
      return whoamiCache;
    }

    if (res.status === 401 || res.status === 403) {
      whoamiCache = {
        valid: false,
        error: 'Invalid or expired Hugging Face token',
        checkedAt: Date.now(),
      };
      return whoamiCache;
    }

    return {
      valid: false,
      error: `Hugging Face verification returned status ${res.status}`,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to contact Hugging Face authentication service: ${(err as Error).message}`,
    };
  }
}

export async function testInferenceConnection(force = false): Promise<AIStatusDetail> {
  const now = new Date().toISOString();

  // Return recent test result if within 15-second cooldown to avoid repeated credit usage
  if (!force && lastInferenceState && Date.now() - lastInferenceState.checkedAt < TEST_COOLDOWN_MS) {
    const tokenCheck = await verifyHuggingFaceToken();
    return {
      available: lastInferenceState.available,
      state: lastInferenceState.state,
      model: config.hfTextModel,
      visionModel: config.hfVisionModel,
      accountUsername: tokenCheck.username,
      message: lastInferenceState.message,
      lastChecked: new Date(lastInferenceState.checkedAt).toISOString(),
    };
  }

  const tokenCheck = await verifyHuggingFaceToken(true);

  if (!tokenCheck.valid) {
    const state: AIConnectionState = !config.hfToken ? 'unconfigured' : 'error';
    const message = tokenCheck.error || 'Token verification failed.';
    lastInferenceState = { state, available: false, message, checkedAt: Date.now() };
    return {
      available: false,
      state,
      model: config.hfTextModel,
      visionModel: config.hfVisionModel,
      message,
      lastChecked: now,
    };
  }

  // Attempt a minimal probe to test provider routing
  try {
    await callHuggingFaceChat({
      model: config.hfTextModel,
      messages: [{ role: 'user', content: 'Ping' }],
      maxTokens: 5,
    });

    lastInferenceState = {
      state: 'connected',
      available: true,
      message: `Verified and connected to ${config.hfTextModel}.`,
      checkedAt: Date.now(),
    };
  } catch (err: any) {
    const status = err.status || 500;
    if (status === 402) {
      lastInferenceState = {
        state: 'quota_exceeded',
        available: false,
        message: 'Account has 0 remaining inference credits on Hugging Face. Purchase pre-paid credits to use live inference.',
        checkedAt: Date.now(),
      };
    } else if (status === 401 || status === 403) {
      lastInferenceState = {
        state: 'error',
        available: false,
        message: 'Hugging Face authentication rejected.',
        checkedAt: Date.now(),
      };
    } else {
      lastInferenceState = {
        state: 'error',
        available: false,
        message: err.message || 'Provider connection test failed.',
        checkedAt: Date.now(),
      };
    }
  }

  return {
    available: lastInferenceState.available,
    state: lastInferenceState.state,
    model: config.hfTextModel,
    visionModel: config.hfVisionModel,
    accountUsername: tokenCheck.username,
    message: lastInferenceState.message,
    lastChecked: now,
  };
}

export async function getAiStatus(): Promise<AIStatusDetail> {
  const now = new Date().toISOString();
  if (!config.hfToken) {
    return {
      available: false,
      state: 'unconfigured',
      model: config.hfTextModel,
      visionModel: config.hfVisionModel,
      message: 'Hugging Face API token is not configured on the server.',
      lastChecked: now,
    };
  }

  const tokenCheck = await verifyHuggingFaceToken();
  if (!tokenCheck.valid) {
    return {
      available: false,
      state: 'error',
      model: config.hfTextModel,
      visionModel: config.hfVisionModel,
      message: tokenCheck.error || 'Invalid or expired HF_TOKEN.',
      lastChecked: now,
    };
  }

  // Token is valid! Check if we have recent inference test
  if (lastInferenceState && Date.now() - lastInferenceState.checkedAt < 10 * 60 * 1000) {
    return {
      available: lastInferenceState.available,
      state: lastInferenceState.state,
      model: config.hfTextModel,
      visionModel: config.hfVisionModel,
      accountUsername: tokenCheck.username,
      message: lastInferenceState.message,
      lastChecked: new Date(lastInferenceState.checkedAt).toISOString(),
    };
  }

  // Token is authenticated, but live model inference hasn't run yet
  return {
    available: false, // NOT marked available merely because token exists!
    state: 'configured',
    model: config.hfTextModel,
    visionModel: config.hfVisionModel,
    accountUsername: tokenCheck.username,
    message: `Token authenticated (@${tokenCheck.username}). Test connection to verify live model inference.`,
    lastChecked: now,
  };
}

export function clearAiStatusCache(): void {
  whoamiCache = null;
  lastInferenceState = null;
}
