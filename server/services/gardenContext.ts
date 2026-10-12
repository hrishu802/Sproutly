import { fetchWeatherForLocation, type WeatherContext } from './weather';
import type { GardenContextPayload } from '../../src/types';

export interface BuiltGardenContext {
  formattedContext: string;
  weather: WeatherContext | null;
  relevantPlantNames: string[];
}

/**
 * Sanitizes user-provided string to prevent prompt boundary breakout
 */
function sanitizeDataField(val?: string, maxLen = 300): string {
  if (!val) return '';
  return val
    .replace(/[<>{}[\]]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export async function buildGardenContext(
  userMessage: string,
  rawContext?: GardenContextPayload
): Promise<BuiltGardenContext> {
  if (!rawContext) {
    return {
      formattedContext: 'No garden profile or plant records provided.',
      weather: null,
      relevantPlantNames: [],
    };
  }

  const queryLower = userMessage.toLowerCase();

  // 1. Filter and prioritize plants
  const allPlants = rawContext.plants || [];
  const mentionedPlants = allPlants.filter((p) => {
    const pName = p.name.toLowerCase();
    if (queryLower.includes(pName)) return true;
    // Check parts if plant name has aliases e.g. "Curry Leaf (Kadi Patta)" -> "curry leaf", "kadi patta"
    const parts = pName.split(/[\(\)\/,]+/).map((s) => s.trim()).filter((s) => s.length >= 3);
    if (parts.some((part) => queryLower.includes(part))) return true;
    if (p.scientificName && queryLower.includes(p.scientificName.toLowerCase())) return true;
    if (p.category && queryLower.includes(p.category.toLowerCase())) return true;
    return false;
  });

  // If specific plants are mentioned, highlight them; otherwise take top 4
  const priorityPlants = mentionedPlants.length > 0 ? mentionedPlants : allPlants.slice(0, 4);
  const relevantPlantNames = priorityPlants.map((p) => sanitizeDataField(p.name, 60));

  const plantDescriptions = priorityPlants.map((p) => {
    const details = [
      p.scientificName ? `(${sanitizeDataField(p.scientificName, 60)})` : undefined,
      `Category: ${p.category}`,
      p.location ? `Location: ${sanitizeDataField(p.location, 60)}` : undefined,
      p.sunlight ? `Sunlight: ${p.sunlight}` : undefined,
      p.wateringPreference ? `Watering: ${p.wateringPreference}` : undefined,
      p.notes ? `Notes: ${sanitizeDataField(p.notes, 120)}` : undefined,
    ]
      .filter(Boolean)
      .join(' | ');
    return `- ${sanitizeDataField(p.name, 60)}: ${details}`;
  });

  // 2. Filter recent observations (up to 3)
  const observations = (rawContext.recentObservations || [])
    .filter((obs) => {
      if (mentionedPlants.length === 0) return true;
      return obs.plantName && mentionedPlants.some((mp) => mp.name.toLowerCase() === obs.plantName!.toLowerCase());
    })
    .slice(0, 3)
    .map((obs) => {
      const plantPart = obs.plantName ? `[${sanitizeDataField(obs.plantName, 50)}] ` : '';
      const symptomPart = obs.symptoms.length > 0 ? `Symptoms: ${obs.symptoms.map((s) => sanitizeDataField(s, 40)).join(', ')}. ` : '';
      const notesPart = obs.notes ? sanitizeDataField(obs.notes, 120) : '';
      return `- ${plantPart}${symptomPart}${notesPart}`;
    });

  // 3. Filter active missions (up to 2)
  const missions = (rawContext.activeMissions || [])
    .slice(0, 2)
    .map((m) => `- "${sanitizeDataField(m.title, 80)}" (${m.status}): ${sanitizeDataField(m.objective, 120)}`);

  // 4. Fetch optional live weather
  let weather: WeatherContext | null = null;
  if (rawContext.coordinates || (rawContext.region && rawContext.region.trim().length >= 2)) {
    weather = await fetchWeatherForLocation(rawContext.region, rawContext.coordinates);
  }

  // 5. Build structured, injection-safe text
  const sections: string[] = [];

  sections.push(`<garden_data>`);
  sections.push(`[GARDENER PROFILE]`);
  if (rawContext.region) sections.push(`Confirmed Region: ${sanitizeDataField(rawContext.region, 80)}`);
  if (rawContext.environment) sections.push(`Growing Environment: ${sanitizeDataField(rawContext.environment, 50)}`);
  if (rawContext.experienceLevel) sections.push(`Experience Level: ${sanitizeDataField(rawContext.experienceLevel, 30)}`);

  if (weather) {
    sections.push(`\n[CURRENT WEATHER FORECAST (Open-Meteo Data)]`);
    sections.push(`Location: ${weather.locationName}`);
    sections.push(`Conditions: ${weather.temperatureC}°C, ${weather.weatherDescription}`);
    if (weather.humidityPercent !== undefined) sections.push(`Relative Humidity: ${weather.humidityPercent}%`);
    if (weather.precipitationProbabilityPercent !== undefined) {
      sections.push(`Precipitation Probability: ${weather.precipitationProbabilityPercent}%`);
    }
    if (weather.dailyForecast.length > 1) {
      const tom = weather.dailyForecast[1];
      sections.push(`Upcoming (Tomorrow): Max ${tom.tempMaxC}°C / Min ${tom.tempMinC}°C, Rain Prob: ${tom.precipitationProbabilityMax ?? 0}%`);
    }
  }

  if (plantDescriptions.length > 0) {
    sections.push(`\n[RELEVANT PLANTS IN GARDEN]`);
    sections.push(plantDescriptions.join('\n'));
    if (allPlants.length > priorityPlants.length) {
      const remainingNames = allPlants
        .filter((p) => !priorityPlants.includes(p))
        .map((p) => p.name)
        .slice(0, 6)
        .join(', ');
      if (remainingNames) sections.push(`Other garden plants: ${remainingNames}`);
    }
  }

  if (observations.length > 0) {
    sections.push(`\n[RECENT OBSERVATIONS]`);
    sections.push(observations.join('\n'));
  }

  if (missions.length > 0) {
    sections.push(`\n[OUTDOOR MISSIONS STATUS]`);
    sections.push(missions.join('\n'));
  }

  sections.push(`</garden_data>`);

  return {
    formattedContext: sections.join('\n'),
    weather,
    relevantPlantNames,
  };
}
