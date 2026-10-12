import { config } from '../config';
import type { PlantIdentificationResult } from '../../src/types';

export interface PlantNetResponse {
  available: boolean;
  results?: PlantIdentificationResult[];
  error?: string;
}

export async function identifyPlantWithPlantNet(
  imageBuffer: Buffer,
  mimetype: string
): Promise<PlantNetResponse> {
  const apiKey = config.plantnetApiKey || process.env.PLANTNET_API_KEY || '';
  if (!apiKey) {
    return {
      available: false,
      error: 'Pl@ntNet API key (PLANTNET_API_KEY) is not configured on the server. Automated species identification is optional.',
    };
  }

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimetype });
    formData.append('images', blob, 'plant_photo.jpg');
    formData.append('organs', 'auto');

    const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { available: false, error: 'Invalid or unauthorized Pl@ntNet API key.' };
      }
      if (response.status === 429) {
        return { available: false, error: 'Pl@ntNet rate limit or daily quota reached.' };
      }
      return { available: false, error: `Pl@ntNet service error (${response.status})` };
    }

    const data = (await response.json()) as {
      results?: Array<{
        score: number;
        species: {
          scientificNameWithoutAuthor: string;
          commonNames?: string[];
          family?: { scientificNameWithoutAuthor?: string };
        };
      }>;
    };

    if (!data.results || data.results.length === 0) {
      return { available: true, results: [] };
    }

    const results: PlantIdentificationResult[] = data.results.slice(0, 3).map((r) => ({
      species: r.species.scientificNameWithoutAuthor,
      commonNames: r.species.commonNames || [],
      family: r.species.family?.scientificNameWithoutAuthor,
      score: Math.round(r.score * 100) / 100,
    }));

    return {
      available: true,
      results,
    };
  } catch (err) {
    return {
      available: false,
      error: `Failed to contact Pl@ntNet service: ${(err as Error).message}`,
    };
  }
}
