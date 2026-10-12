import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  hfToken: process.env.HF_TOKEN || '',
  hfApiBase: process.env.HF_API_BASE || 'https://router.huggingface.co/v1',
  hfVisionModel: process.env.HF_VISION_MODEL || 'meta-llama/Llama-3.2-11B-Vision-Instruct',
  hfTextModel: process.env.HF_TEXT_MODEL || 'meta-llama/Llama-3.3-70B-Instruct',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  plantnetApiKey: process.env.PLANTNET_API_KEY || '',
  aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '25000', 10),
  isProduction: process.env.NODE_ENV === 'production',
};
