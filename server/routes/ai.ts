import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { upload } from '../middleware/upload';
import { aiRateLimiter } from '../middleware/rateLimit';
import {
  callHuggingFaceChat,
  extractJson,
} from '../services/huggingface';
import {
  buildDoctorSystemPrompt,
  buildCoachSystemPrompt,
  buildMissionsSystemPrompt,
  type SupportedLanguage,
} from '../services/prompts';
import { buildGardenContext } from '../services/gardenContext';
import { fetchWeatherForLocation } from '../services/weather';
import { identifyPlantWithPlantNet } from '../services/plantnet';
import {
  DiagnosisResultSchema,
  CoachResponseSchema,
  GeneratedMissionSchema,
} from '../../src/types';

export const aiRouter = Router();

// Apply AI rate limiter to all AI endpoints
aiRouter.use(aiRateLimiter);

// ========== GET /api/ai/status ==========
aiRouter.get('/status', (_req: Request, res: Response) => {
  const isAvailable = Boolean(config.hfToken && config.hfToken.trim().length > 0);
  res.json({
    available: isAvailable,
    model: config.hfVisionModel,
  });
});

// ========== POST /api/ai/diagnose ==========
const DiagnoseBodySchema = z.object({
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  plantCategory: z.string().optional(),
  symptoms: z.string().min(1, 'Symptoms description is required').max(2000),
  additionalContext: z.string().max(2000).optional(),
  language: z.enum(['en', 'hi', 'hinglish']).default('en'),
});

aiRouter.post(
  '/diagnose',
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedBody = DiagnoseBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      const { plantName, plantCategory, symptoms, additionalContext, language } = parsedBody.data;
      const file = req.file;

      const userTextLines = [
        plantName ? `Plant Name: ${plantName}` : undefined,
        plantCategory ? `Plant Category: ${plantCategory}` : undefined,
        `Reported Symptoms: ${symptoms}`,
        additionalContext ? `Additional Gardener Notes: ${additionalContext}` : undefined,
      ].filter(Boolean);
      const userTextPrompt = userTextLines.join('\n');

      const systemPrompt = buildDoctorSystemPrompt(language as SupportedLanguage);

      let rawResponse: string;

      if (file) {
        // Multi-modal message with image
        const base64Image = file.buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64Image}`;

        rawResponse = await callHuggingFaceChat({
          model: config.hfVisionModel,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userTextPrompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        });
      } else {
        // Text-only diagnosis
        rawResponse = await callHuggingFaceChat({
          model: config.hfTextModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userTextPrompt },
          ],
        });
      }

      const parsedJson = extractJson<unknown>(rawResponse);
      const validated = DiagnosisResultSchema.safeParse(parsedJson);

      if (!validated.success) {
        // Provide graceful fallback structure while honoring AI's parsed content
        const partial = parsedJson as Record<string, unknown> | null;
        const normalized = {
          summary: typeof partial?.summary === 'string' ? partial.summary : 'Diagnosis assessment completed.',
          visibleObservations: Array.isArray(partial?.visibleObservations)
            ? partial.visibleObservations.map(String)
            : [symptoms],
          possibleCauses: Array.isArray(partial?.possibleCauses)
            ? partial.possibleCauses.map((c: any) => ({
                cause: String(c?.cause || 'Plant Stress'),
                confidence: (['low', 'moderate', 'high'].includes(c?.confidence) ? c.confidence : 'moderate') as
                  | 'low'
                  | 'moderate'
                  | 'high',
                reasoning: String(c?.reasoning || 'Symptoms observed match environmental or fungal stressors.'),
              }))
            : [
                {
                  cause: 'Environmental Stress',
                  confidence: 'moderate' as const,
                  reasoning: 'Symptoms suggest watering, lighting, or temperature adjustment needed.',
                },
              ],
          followUpQuestions: Array.isArray(partial?.followUpQuestions)
            ? partial.followUpQuestions.map(String)
            : ['Has the watering frequency or sunlight changed recently?'],
          recommendedActions: Array.isArray(partial?.recommendedActions)
            ? partial.recommendedActions.map(String)
            : ['Check soil drainage and inspect plant base for moisture buildup.'],
          actionsToAvoid: Array.isArray(partial?.actionsToAvoid)
            ? partial.actionsToAvoid.map(String)
            : ['Do not apply heavy fertilizer while the plant is in distress.'],
          outdoorMission: partial?.outdoorMission
            ? {
                title: String((partial.outdoorMission as any)?.title || 'Touch the Soil & Inspect Root Flare'),
                instructions: String((partial.outdoorMission as any)?.instructions || 'Check soil 2 inches down.'),
                estimatedMinutes: Number((partial.outdoorMission as any)?.estimatedMinutes || 10),
              }
            : undefined,
          references: Array.isArray(partial?.references) ? partial.references.map(String) : [],
          disclaimer:
            typeof partial?.disclaimer === 'string'
              ? partial.disclaimer
              : 'This diagnosis is for guidance. Always test treatments on a small leaf area first.',
        };
        return res.json(normalized);
      }

      return res.json(validated.data);
    } catch (err) {
      next(err);
    }
  }
);

// ========== POST /api/ai/coach ==========
const CoachBodySchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .default([]),
  language: z.enum(['en', 'hi', 'hinglish']).default('en'),
  gardenContext: z
    .object({
      region: z.string().optional(),
      environment: z.string().optional(),
      experienceLevel: z.string().optional(),
      plants: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            category: z.string(),
            location: z.string().optional(),
            scientificName: z.string().optional(),
            sunlight: z.string().optional(),
            wateringPreference: z.string().optional(),
            notes: z.string().optional(),
          })
        )
        .optional(),
      recentObservations: z
        .array(
          z.object({
            plantName: z.string().optional(),
            date: z.string(),
            symptoms: z.array(z.string()),
            notes: z.string().optional(),
          })
        )
        .optional(),
      recentJournal: z
        .array(
          z.object({
            plantName: z.string().optional(),
            date: z.string(),
            notes: z.string(),
          })
        )
        .optional(),
      activeMissions: z
        .array(
          z.object({
            title: z.string(),
            objective: z.string(),
            status: z.string(),
          })
        )
        .optional(),
      coordinates: z
        .object({
          latitude: z.number(),
          longitude: z.number(),
        })
        .optional(),
    })
    .optional(),
});

aiRouter.post('/coach', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CoachBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { message, conversationHistory, language, gardenContext } = parsed.data;

    // Build personalized garden context with weather and prioritized plants
    const { formattedContext, weather } = await buildGardenContext(message, gardenContext);
    const systemPrompt = buildCoachSystemPrompt(language as SupportedLanguage, formattedContext);

    // Limit conversation history to last 6 messages for token efficiency
    const recentHistory = conversationHistory.slice(-6);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    const rawResponse = await callHuggingFaceChat({
      model: config.hfTextModel,
      messages,
      maxTokens: 1400,
    });

    const parsedJson = extractJson<Record<string, any>>(rawResponse);
    const validated = CoachResponseSchema.safeParse(parsedJson);

    if (validated.success) {
      const data = validated.data;
      // Add weather note if model didn't add it but weather is available
      if (!data.weatherNote && weather) {
        data.weatherNote = `Forecast for ${weather.locationName}: ${weather.temperatureC}°C, ${weather.weatherDescription}`;
      }
      // Populate actionItems for backward compatibility
      if (data.actions && data.actions.length > 0 && (!data.actionItems || data.actionItems.length === 0)) {
        data.actionItems = data.actions.map((a) => `${a.title}: ${a.instructions}`);
      }
      if ((!data.actions || data.actions.length === 0) && data.actionItems && data.actionItems.length > 0) {
        data.actions = data.actionItems.map((item) => ({
          title: 'Recommended Step',
          instructions: item,
          priority: 'medium',
        }));
      }
      return res.json(data);
    }

    // Graceful normalization for slightly malformed JSON
    const normalized = {
      answer: typeof parsedJson?.answer === 'string' ? parsedJson.answer : rawResponse,
      observations: Array.isArray(parsedJson?.observations) ? parsedJson.observations.map(String) : [],
      possibleCauses: Array.isArray(parsedJson?.possibleCauses)
        ? parsedJson.possibleCauses.map((c: any) => ({
            cause: String(c?.cause || 'Plant issue'),
            confidence: (['low', 'moderate', 'high'].includes(c?.confidence) ? c.confidence : 'moderate') as
              | 'low'
              | 'moderate'
              | 'high',
          }))
        : [],
      actions: Array.isArray(parsedJson?.actions)
        ? parsedJson.actions.map((a: any) => ({
            title: String(a?.title || 'Care Step'),
            instructions: String(a?.instructions || 'Inspect plant closely.'),
            priority: (['low', 'medium', 'high'].includes(a?.priority) ? a.priority : 'medium') as
              | 'low'
              | 'medium'
              | 'high',
          }))
        : Array.isArray(parsedJson?.actionItems)
        ? parsedJson.actionItems.map((item: any) => ({
            title: 'Recommended Step',
            instructions: String(item),
            priority: 'medium' as const,
          }))
        : [],
      actionItems: Array.isArray(parsedJson?.actionItems) ? parsedJson.actionItems.map(String) : [],
      followUpQuestion: typeof parsedJson?.followUpQuestion === 'string' ? parsedJson.followUpQuestion : null,
      followUpSuggestions: Array.isArray(parsedJson?.followUpSuggestions)
        ? parsedJson.followUpSuggestions.map(String)
        : [],
      outdoorMission: parsedJson?.outdoorMission
        ? {
            title: String((parsedJson.outdoorMission as any)?.title || 'Check your plant'),
            durationMinutes: Number((parsedJson.outdoorMission as any)?.durationMinutes || 5),
            steps: Array.isArray((parsedJson.outdoorMission as any)?.steps)
              ? (parsedJson.outdoorMission as any).steps.map(String)
              : ['Step outside to check your garden.'],
          }
        : undefined,
      weatherNote:
        typeof parsedJson?.weatherNote === 'string'
          ? parsedJson.weatherNote
          : weather
          ? `Forecast for ${weather.locationName}: ${weather.temperatureC}°C, ${weather.weatherDescription}`
          : undefined,
      references: Array.isArray(parsedJson?.references) ? parsedJson.references.map(String) : [],
    };

    return res.json(normalized);
  } catch (err) {
    next(err);
  }
});

// ========== POST /api/ai/missions ==========
const MissionsBodySchema = z.object({
  plants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        location: z.string().optional(),
      })
    )
    .default([]),
  language: z.enum(['en', 'hi', 'hinglish']).default('en'),
  region: z.string().optional(),
  season: z.string().optional(),
});

aiRouter.post('/missions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = MissionsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { plants, language, region, season } = parsed.data;
    const systemPrompt = buildMissionsSystemPrompt(language as SupportedLanguage, region, season);

    const plantList = plants.length > 0
      ? plants.map((p) => `- ${p.name} (${p.category}${p.location ? `, located in ${p.location}` : ''})`).join('\n')
      : 'General home garden setup';

    const userPrompt = `Please generate 2 to 3 outdoor gardening Touch Grass missions for these plants:\n${plantList}`;

    const rawResponse = await callHuggingFaceChat({
      model: config.hfTextModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1200,
    });

    const parsedJson = extractJson<{ missions?: unknown[] }>(rawResponse);
    const rawMissions = Array.isArray(parsedJson.missions) ? parsedJson.missions : [];

    const validatedMissions = rawMissions
      .map((m) => {
        const item = m as Record<string, unknown>;
        const match = plants.find((p) =>
          String(item.title || item.objective).toLowerCase().includes(p.name.toLowerCase())
        );
        return {
          title: String(item.title || 'Outdoor Garden Activity'),
          objective: String(item.objective || 'Inspect and care for your plants outdoors.'),
          instructions: Array.isArray(item.instructions)
            ? item.instructions.map(String)
            : ['Step into the garden and inspect soil moisture.'],
          estimatedMinutes: Number(item.estimatedMinutes || 10),
          materials: Array.isArray(item.materials) ? item.materials.map(String) : [],
          safetyNotes: item.safetyNotes ? String(item.safetyNotes) : 'Wash hands thoroughly after handling soil.',
          plantId: match?.id,
          plantName: match?.name,
        };
      })
      .filter((m) => GeneratedMissionSchema.safeParse(m).success);

    return res.json({ missions: validatedMissions });
  } catch (err) {
    next(err);
  }
});

// ========== POST /api/ai/identify-plant (Optional Pl@ntNet Integration) ==========
aiRouter.post(
  '/identify-plant',
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload an image file to identify the plant species.' });
      }
      const result = await identifyPlantWithPlantNet(req.file.buffer, req.file.mimetype);
      if (!result.available) {
        return res.status(503).json({ error: result.error, available: false });
      }
      return res.json({ available: true, results: result.results });
    } catch (err) {
      next(err);
    }
  }
);

// ========== GET /api/ai/weather (Optional Open-Meteo Integration) ==========
aiRouter.get('/weather', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = typeof req.query.region === 'string' ? req.query.region : undefined;
    const lat = typeof req.query.lat === 'string' ? parseFloat(req.query.lat) : undefined;
    const lon = typeof req.query.lon === 'string' ? parseFloat(req.query.lon) : undefined;

    const coords =
      lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)
        ? { latitude: lat, longitude: lon }
        : undefined;

    if (!region && !coords) {
      return res.status(400).json({ error: 'Please provide a region query parameter or lat/lon coordinates.' });
    }

    const weather = await fetchWeatherForLocation(region, coords);
    if (!weather) {
      return res.status(404).json({ error: `Weather forecast not available for ${region || 'provided coordinates'}.` });
    }
    return res.json({ available: true, weather });
  } catch (err) {
    next(err);
  }
});

