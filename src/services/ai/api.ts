import type {
  DiagnosisResult,
  CoachResponse,
  CoachRequest,
  DiagnosisRequest,
  MissionGenerateRequest,
  GeneratedMission,
} from '../../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.error) message = body.error;
    } catch {
      // Use default message
    }
    throw new ApiError(response.status, message);
  }
  return response.json();
}

// ========== AI Service ==========

export async function checkAIStatus(): Promise<{ available: boolean; model?: string }> {
  try {
    const res = await fetch(`${API_BASE}/ai/status`);
    return handleResponse(res);
  } catch {
    return { available: false };
  }
}

export async function diagnosePlant(request: DiagnosisRequest): Promise<DiagnosisResult> {
  const formData = new FormData();
  if (request.plantId) formData.append('plantId', request.plantId);
  if (request.plantName) formData.append('plantName', request.plantName);
  if (request.plantCategory) formData.append('plantCategory', request.plantCategory);
  formData.append('symptoms', request.symptoms);
  if (request.additionalContext) formData.append('additionalContext', request.additionalContext);
  formData.append('language', request.language);
  if (request.image) formData.append('image', request.image);

  const response = await fetch(`${API_BASE}/ai/diagnose`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<DiagnosisResult>(response);
}

export async function chatWithCoach(request: CoachRequest): Promise<CoachResponse> {
  const response = await fetch(`${API_BASE}/ai/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<CoachResponse>(response);
}

export async function generateMissions(request: MissionGenerateRequest): Promise<GeneratedMission[]> {
  const response = await fetch(`${API_BASE}/ai/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await handleResponse<{ missions: GeneratedMission[] }>(response);
  return data.missions;
}

export async function identifyPlant(image: File): Promise<any[]> {
  const formData = new FormData();
  formData.append('image', image);
  const response = await fetch(`${API_BASE}/ai/identify-plant`, {
    method: 'POST',
    body: formData,
  });
  const data = await handleResponse<{ available: boolean; results?: any[] }>(response);
  return data.results || [];
}

export { ApiError };
