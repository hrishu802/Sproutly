# Sproutly 🌱 — Your Production-Ready AI Gardening Companion

> **Hacktoberfest Week 1 Dev Challenge — "Touch Grass"**  
> *Grow better. Naturally.*

Sproutly is a full-stack, offline-first AI gardening companion designed to help home gardeners understand their plants, diagnose pest and nutrient issues, care for seasonal varieties, and build outdoor observation habits through hands-on gardening missions.

---

## 🌿 Product Features

### 1. Production-Ready AI Garden Coach (Personalized & Multilingual)
- **Multilingual Horticultural Mentor**:
  - **English**: Plain-English gardening advice with accessible biological explanations.
  - **Hindi (हिंदी)**: Native Devanagari script responses adhering to Hindi gardening terminology.
  - **Hinglish**: Conversational Roman-script Hindi mixed with familiar gardening terms (e.g. *"Aapke Mogra mein overwatering ho rahi hai. Top 2 inches mitti dry hone par hi paani dein"*).
- **Deep Personalization Context Builder**:
  - Transparently pulls confirmed region, growing environment (balcony, terrace, garden bed), and experience level.
  - Matches and prioritizes plants mentioned in your query against your saved garden records.
  - Incorporates relevant recent journal observations and active outdoor missions.
  - Sanitizes user input against prompt-boundary breakouts using strict `<garden_data>` isolation.
- **Structured, Actionable Guidance**:
  - Distinguishes observed facts from possible causes (ranked by confidence: `low`, `moderate`, `high`).
  - Delivers prioritized action items (`high`, `medium`, `low`) rather than overwhelming walls of text.
  - Supplies engaging follow-up suggestion chips and concise follow-up diagnostic questions.
  - Generates tailored "Touch Grass" outdoor missions that can be added to your active missions with a single click.
- **Conversational UI & Session State**:
  - Real conversational message bubbles with timestamps and clear bot/user states.
  - Retains multi-turn conversation context across recent messages.
  - Session persistence (`sessionStorage`) with one-click "New Conversation" reset.
  - Instant retry controls on network interruptions or provider timeouts.
  - Direct links to Plant Doctor for deep symptom inspection.

### 2. Live Weather Integration (Open-Meteo)
- Integrated weather service powered by [Open-Meteo](https://open-meteo.com) (no API key required).
- Pulls local temperature, weather conditions, relative humidity, and precipitation probability.
- Includes a 30-minute in-memory cache to minimize redundant external calls.
- Degrades gracefully: if weather lookup is unavailable or location is omitted, the coach continues without interruption and never invents fake weather readings.

### 3. Plant Doctor & Optional Species Identification (Pl@ntNet)
- **Visual Diagnosis**: Upload clear plant photos (up to 5 MB) or enter observed symptoms for multimodal analysis powered by `meta-llama/Llama-3.2-11B-Vision-Instruct`.
- **Optional Pl@ntNet Integration**: Server-side endpoint (`POST /api/ai/identify-plant`) for automated botanical identification with confidence scores via the [Pl@ntNet API](https://my.plantnet.org).
- Distinguishes species identification from disease diagnosis; Plant Doctor and Garden Coach remain 100% functional without a Pl@ntNet API key.

### 4. Touch Grass Missions (Outdoor Actionable Tasks)
- Real outdoor gardening activities designed to get you away from screens and into the dirt.
- Practical activities: 2-inch soil moisture touch tests, root flare inspection, morning pest checks, compost topdressing.
- Track mission status (`available`, `in-progress`, `completed`), and record physical observations upon completion.

### 5. My Garden & Journal (Offline-First Storage)
- Create, inspect, edit, and organize plants by category (flowers, herbs, vegetables, indoor plants, succulents, trees).
- Track growing conditions: sunlight requirements, watering cadence, soil characteristics, and custom notes.
- Initialized with starter plants curated for home gardens (Tulsi / Holy Basil, Mogra / Arabian Jasmine, Desi Tomato, Pudina / Spearmint).
- Fast, persistent client-side storage powered by IndexedDB (`idb`).
- Full data sovereignty: One-click JSON backup export, import, and data reset in Settings.

---

## 🛡️ Gardening Safety & Reliability Guardrails

1. **Organic & Low-Risk First**: Prioritizes cultural practices, soil care, physical inspection, companion planting, and organic treatments (e.g., neem oil spray, compost tea).
2. **No Hazardous Pesticides**: Never recommends hazardous chemical pesticides or synthetic fungicides with arbitrary dosage instructions.
3. **Moisture Intelligence**: Never prescribes rigid calendar-based watering without emphasizing the "finger test" (checking the top 1–2 inches of soil).
4. **Uncertainty & Truthfulness**: Clearly separates visual hypotheses from confirmed conditions; never claims a disease is confirmed from uncertain evidence.
5. **Local Expert Escalation**: For severe, contagious, or ambiguous blights, advises consulting a local nursery, university extension, or Krishi Vigyan Kendra.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**:
  - React 19 & TypeScript
  - Vite 8 with Tailwind CSS v4
  - React Router DOM v7
  - Lucide React icons & Framer Motion animations
  - Client-side persistence using IndexedDB (`idb`)
  - Zero client-side API credentials

- **Backend**:
  - Node.js & Express with TypeScript (`tsx`)
  - Secure middleware: Restricted CORS, rate limiting (`express-rate-limit`), security headers
  - In-memory upload handling & validation with `multer` (5 MB file size limit, image mime enforcement)
  - Strict input & output validation with `zod` schemas
  - Centralized error handling returning structured errors (503 on missing credentials, 502 on upstream AI issues, 400 on validation)
  - Request timeouts (`AbortSignal.timeout`) and bounded retries with exponential backoff on transient errors

- **AI Inference**:
  - Hugging Face Inference Providers API (`https://router.huggingface.co/v1/chat/completions`)
  - Vision model: `meta-llama/Llama-3.2-11B-Vision-Instruct`
  - Text model: `meta-llama/Llama-3.3-70B-Instruct`
  - Strictly server-side: `HF_TOKEN` is never exposed to client bundles or `VITE_` variables.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+ (tested on Node v25)
- **npm**: v10+

### 2. Clone and Install
```bash
git clone https://github.com/your-username/Sproutly.git
cd Sproutly
npm install
```

### 3. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```
Open `.env` and configure your credentials:
```ini
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Hugging Face Inference Providers (SERVER-SIDE ONLY)
HF_TOKEN=your_hugging_face_token_here
HF_API_BASE=https://router.huggingface.co/v1
HF_VISION_MODEL=meta-llama/Llama-3.2-11B-Vision-Instruct
HF_TEXT_MODEL=meta-llama/Llama-3.3-70B-Instruct
AI_TIMEOUT_MS=25000

# Optional: Pl@ntNet API Key (for automated species identification)
PLANTNET_API_KEY=

# Opt-in Real AI Inference Smoke Tests (optional)
RUN_SMOKE_TESTS=false
```

> **Note**: If `HF_TOKEN` is not configured, the application functions cleanly in offline mode for garden records, missions, and journaling. When an AI feature (Doctor, Coach, Mission generation) is triggered, the backend returns an explicit 503 error stating that `HF_TOKEN` is required on the server. Mock data is never falsely presented as real AI analysis.

### 4. Running Locally

Start the backend server:
```bash
npm run server
```
*(Runs Express on `http://localhost:3001`)*

In another terminal, start the Vite frontend development server:
```bash
npm run dev
```
*(Runs Vite frontend on `http://localhost:5173` with proxy to `/api`)*

Visit `http://localhost:5173` in your browser.

---

## 🧪 Testing & Verification

Sproutly includes a comprehensive test suite covering IndexedDB persistence, API endpoints, upload validation, error states, weather caching, garden context construction, prompt sanitization, secret leakage prevention, and multilingual prompt generation.

Run unit and integration tests:
```bash
npm run test
```

Run TypeScript compilation check across all targets:
```bash
npx tsc -b
```

Run frontend production bundle build:
```bash
npm run build
```

Run linting:
```bash
npm run lint
```

Run opt-in real AI inference smoke tests:
```bash
RUN_SMOKE_TESTS=true npm run test
```

---

## 🔐 Security & Privacy

- **Zero Secrets in Frontend**: `HF_TOKEN` and `PLANTNET_API_KEY` are kept strictly on the Express backend. Never prefixed with `VITE_`.
- **In-Memory File Processing**: Images uploaded for plant diagnosis are processed in memory buffers and never written to disk.
- **Input Validation & Sanitization**: Multer enforces a 5 MB maximum file size and strict image MIME types. Zod validates all API parameters. Context builder sanitizes special characters to prevent prompt injection.
- **Rate Limiting**: Protects backend endpoints against brute force and token exhaustion.
- **Data Sovereignty**: Garden records, plant notes, and journal entries remain safely inside your browser's IndexedDB.

---

## ⚠️ Known Limitations

- **Offline Mode**: While all garden records, journaling, and mission tracking work completely offline in IndexedDB, Plant Doctor and Garden Coach require active internet connectivity to contact the backend and Hugging Face Inference Providers.
- **Open-Weight Provider Latency**: Hugging Face Inference Providers models may occasionally experience cold-start latency or provider queuing. Sproutly includes structured timeout and retry handling to inform the user.
