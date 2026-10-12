import { z } from 'zod';

// ========== Enums ==========

export const PlantCategory = z.enum([
  'flower',
  'vegetable',
  'herb',
  'indoor',
  'fruit',
  'succulent',
  'tree',
  'other',
]);
export type PlantCategory = z.infer<typeof PlantCategory>;

export const SunlightLevel = z.enum(['full-sun', 'partial-sun', 'partial-shade', 'full-shade']);
export type SunlightLevel = z.infer<typeof SunlightLevel>;

export const WateringFrequency = z.enum(['daily', 'every-2-days', 'twice-weekly', 'weekly', 'biweekly', 'monthly', 'as-needed']);
export type WateringFrequency = z.infer<typeof WateringFrequency>;

export const TaskStatus = z.enum(['pending', 'in-progress', 'completed', 'skipped']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const MissionStatus = z.enum(['available', 'in-progress', 'completed']);
export type MissionStatus = z.infer<typeof MissionStatus>;

export const GrowingEnvironment = z.enum(['outdoor-garden', 'balcony', 'terrace', 'indoor', 'greenhouse', 'mixed']);
export type GrowingEnvironment = z.infer<typeof GrowingEnvironment>;

export const Language = z.enum(['en', 'hi', 'hinglish']);
export type Language = z.infer<typeof Language>;

// ========== Core Models ==========

export const GardenProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  region: z.string().max(200).optional(),
  growingEnvironment: GrowingEnvironment.optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'experienced']).optional(),
  preferences: z.object({
    language: Language.default('en'),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GardenProfile = z.infer<typeof GardenProfileSchema>;

export const PlantSchema = z.object({
  id: z.string(),
  commonName: z.string().min(1).max(150),
  scientificName: z.string().max(200).optional(),
  category: PlantCategory,
  location: z.string().max(200).optional(),
  sunlight: SunlightLevel.optional(),
  wateringPreference: WateringFrequency.optional(),
  soilNotes: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  photoUrl: z.string().optional(),
  isDemo: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Plant = z.infer<typeof PlantSchema>;

export const ObservationSchema = z.object({
  id: z.string(),
  plantId: z.string(),
  date: z.string().datetime(),
  symptoms: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional(),
  photoUrl: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const CareTaskSchema = z.object({
  id: z.string(),
  plantId: z.string().optional(),
  title: z.string().min(1).max(200),
  reason: z.string().max(500).optional(),
  dueDate: z.string().optional(),
  status: TaskStatus.default('pending'),
  estimatedMinutes: z.number().min(1).max(480).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CareTask = z.infer<typeof CareTaskSchema>;

export const MissionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  objective: z.string().max(500),
  instructions: z.array(z.string()),
  estimatedMinutes: z.number().min(1).max(120),
  materials: z.array(z.string()).default([]),
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  safetyNotes: z.string().max(500).optional(),
  status: MissionStatus.default('available'),
  observation: z.string().max(2000).optional(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Mission = z.infer<typeof MissionSchema>;

export const JournalEntrySchema = z.object({
  id: z.string(),
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  date: z.string().datetime(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().min(1).max(5000),
  photoUrls: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

// ========== AI Types ==========

export const DiagnosisResultSchema = z.object({
  summary: z.string(),
  visibleObservations: z.array(z.string()),
  possibleCauses: z.array(z.object({
    cause: z.string(),
    confidence: z.enum(['low', 'moderate', 'high']),
    reasoning: z.string(),
  })),
  followUpQuestions: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  actionsToAvoid: z.array(z.string()),
  outdoorMission: z.object({
    title: z.string(),
    instructions: z.string(),
    estimatedMinutes: z.number(),
  }).optional(),
  references: z.array(z.string()).optional(),
  disclaimer: z.string(),
});
export type DiagnosisResult = z.infer<typeof DiagnosisResultSchema>;

export const CoachActionItemSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});
export type CoachActionItem = z.infer<typeof CoachActionItemSchema>;

export const CoachPossibleCauseSchema = z.object({
  cause: z.string(),
  confidence: z.enum(['low', 'moderate', 'high']),
});
export type CoachPossibleCause = z.infer<typeof CoachPossibleCauseSchema>;

export const CoachOutdoorMissionSchema = z.object({
  title: z.string(),
  durationMinutes: z.number(),
  steps: z.array(z.string()),
});
export type CoachOutdoorMission = z.infer<typeof CoachOutdoorMissionSchema>;

export const CoachResponseSchema = z.object({
  answer: z.string(),
  observations: z.array(z.string()).optional(),
  possibleCauses: z.array(CoachPossibleCauseSchema).optional(),
  actions: z.array(CoachActionItemSchema).optional(),
  actionItems: z.array(z.string()).optional(), // for backwards compatibility
  followUpQuestion: z.string().nullable().optional(),
  followUpSuggestions: z.array(z.string()).optional(),
  outdoorMission: CoachOutdoorMissionSchema.optional(),
  weatherNote: z.string().optional(),
  references: z.array(z.string()).optional(),
});
export type CoachResponse = z.infer<typeof CoachResponseSchema>;

export const PlantIdentificationResultSchema = z.object({
  species: z.string(),
  commonNames: z.array(z.string()),
  family: z.string().optional(),
  score: z.number(), // confidence between 0 and 1
});
export type PlantIdentificationResult = z.infer<typeof PlantIdentificationResultSchema>;

export const GeneratedMissionSchema = z.object({
  title: z.string(),
  objective: z.string(),
  instructions: z.array(z.string()),
  estimatedMinutes: z.number(),
  materials: z.array(z.string()),
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  safetyNotes: z.string().optional(),
});
export type GeneratedMission = z.infer<typeof GeneratedMissionSchema>;

export type AIConnectionState = 'unconfigured' | 'configured' | 'connected' | 'quota_exceeded' | 'error';

export interface AIStatusInfo {
  available: boolean;
  state: AIConnectionState;
  model: string;
  visionModel: string;
  accountUsername?: string;
  message: string;
  lastChecked?: string;
}

// ========== API Request/Response Types ==========

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DiagnosisRequest {
  plantId?: string;
  plantName?: string;
  plantCategory?: PlantCategory;
  symptoms: string;
  additionalContext?: string;
  language: Language;
  image?: File;
}

export interface GardenContextPayload {
  region?: string;
  environment?: string;
  experienceLevel?: string;
  plants?: Array<{
    id?: string;
    name: string;
    category: string;
    location?: string;
    scientificName?: string;
    sunlight?: string;
    wateringPreference?: string;
    notes?: string;
  }>;
  recentObservations?: Array<{
    plantName?: string;
    date: string;
    symptoms: string[];
    notes?: string;
  }>;
  recentJournal?: Array<{
    plantName?: string;
    date: string;
    notes: string;
  }>;
  activeMissions?: Array<{
    title: string;
    objective: string;
    status: string;
  }>;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface CoachRequest {
  message: string;
  conversationHistory: ChatMessage[];
  language: Language;
  gardenContext?: GardenContextPayload;
}

export interface MissionGenerateRequest {
  plants: Array<{ id: string; name: string; category: string; location?: string }>;
  language: Language;
  region?: string;
  season?: string;
}
