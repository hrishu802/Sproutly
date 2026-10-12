import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Plant,
  GardenProfile,
  Observation,
  CareTask,
  Mission,
  JournalEntry,
} from '../../types';

// ========== Database Schema ==========

interface SproutlyDB extends DBSchema {
  gardenProfile: {
    key: string;
    value: GardenProfile;
  };
  plants: {
    key: string;
    value: Plant;
    indexes: {
      'by-category': string;
      'by-updated': string;
    };
  };
  observations: {
    key: string;
    value: Observation;
    indexes: {
      'by-plant': string;
      'by-date': string;
    };
  };
  careTasks: {
    key: string;
    value: CareTask;
    indexes: {
      'by-plant': string;
      'by-status': string;
      'by-due': string;
    };
  };
  missions: {
    key: string;
    value: Mission;
    indexes: {
      'by-status': string;
      'by-created': string;
    };
  };
  journal: {
    key: string;
    value: JournalEntry;
    indexes: {
      'by-plant': string;
      'by-date': string;
    };
  };
}

const DB_NAME = 'sproutly-garden';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<SproutlyDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SproutlyDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SproutlyDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Garden profile store
      if (!db.objectStoreNames.contains('gardenProfile')) {
        db.createObjectStore('gardenProfile', { keyPath: 'id' });
      }

      // Plants store
      if (!db.objectStoreNames.contains('plants')) {
        const plantStore = db.createObjectStore('plants', { keyPath: 'id' });
        plantStore.createIndex('by-category', 'category');
        plantStore.createIndex('by-updated', 'updatedAt');
      }

      // Observations store
      if (!db.objectStoreNames.contains('observations')) {
        const obsStore = db.createObjectStore('observations', { keyPath: 'id' });
        obsStore.createIndex('by-plant', 'plantId');
        obsStore.createIndex('by-date', 'date');
      }

      // Care tasks store
      if (!db.objectStoreNames.contains('careTasks')) {
        const taskStore = db.createObjectStore('careTasks', { keyPath: 'id' });
        taskStore.createIndex('by-plant', 'plantId');
        taskStore.createIndex('by-status', 'status');
        taskStore.createIndex('by-due', 'dueDate');
      }

      // Missions store
      if (!db.objectStoreNames.contains('missions')) {
        const missionStore = db.createObjectStore('missions', { keyPath: 'id' });
        missionStore.createIndex('by-status', 'status');
        missionStore.createIndex('by-created', 'createdAt');
      }

      // Journal store
      if (!db.objectStoreNames.contains('journal')) {
        const journalStore = db.createObjectStore('journal', { keyPath: 'id' });
        journalStore.createIndex('by-plant', 'plantId');
        journalStore.createIndex('by-date', 'date');
      }
    },
  });

  return dbInstance;
}

// ========== ID generation ==========

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ========== Garden Profile ==========

const PROFILE_ID = 'default-garden';

let seedRan = false;
async function seedDefaultDataIfEmpty(db: IDBPDatabase<SproutlyDB>) {
  if (seedRan) return;
  seedRan = true;
  const profile = await db.get('gardenProfile', PROFILE_ID);
  if (!profile) {
    const now = new Date().toISOString();
    const defaultProfile: GardenProfile = {
      id: PROFILE_ID,
      name: "Maa's Garden",
      region: 'North India (Subtropical)',
      growingEnvironment: 'mixed',
      experienceLevel: 'experienced',
      preferences: {
        language: 'en',
      },
      createdAt: now,
      updatedAt: now,
    };
    await db.put('gardenProfile', defaultProfile);

    const existingPlants = await db.getAll('plants');
    if (existingPlants.length === 0) {
      const demoPlants: Plant[] = [
        {
          id: 'plant-tulsi',
          commonName: 'Tulsi (Holy Basil)',
          scientificName: 'Ocimum tenuiflorum',
          category: 'herb',
          location: 'Courtyard Pot',
          sunlight: 'full-sun',
          wateringPreference: 'daily',
          soilNotes: 'Well-draining loamy soil with leaf compost',
          notes: 'Revered plant in Indian households. Water in early morning and pinch flowers to promote bushiness.',
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'plant-mogra',
          commonName: 'Mogra (Arabian Jasmine)',
          scientificName: 'Jasminum sambac',
          category: 'flower',
          location: 'Balcony South-East',
          sunlight: 'partial-sun',
          wateringPreference: 'every-2-days',
          soilNotes: 'Rich fertile garden soil with cow dung manure',
          notes: 'Fragrant white blooms. Needs light pruning after each flowering flush.',
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'plant-tomato',
          commonName: 'Desi Tomato',
          scientificName: 'Solanum lycopersicum',
          category: 'vegetable',
          location: 'Terrace Raised Bed',
          sunlight: 'full-sun',
          wateringPreference: 'every-2-days',
          soilNotes: 'Loose, organic-rich soil with good drainage',
          notes: 'Staked with bamboo canes. Watch out for leaf curl and aphids on new shoots.',
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'plant-pudina',
          commonName: 'Pudina (Spearmint)',
          scientificName: 'Mentha spicata',
          category: 'herb',
          location: 'Kitchen Window Sill',
          sunlight: 'partial-shade',
          wateringPreference: 'daily',
          soilNotes: 'Moist, humus-rich soil',
          notes: 'Spreads rapidly via runners. Keep soil consistently moist.',
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const p of demoPlants) {
        await db.put('plants', p);
      }

      const demoMissions: Mission[] = [
        {
          id: 'mission-moisture-check',
          title: 'Morning Soil Moisture Touch Test',
          objective: 'Inspect root zone hydration using your bare fingers to prevent root rot.',
          instructions: [
            'Step outdoors into your garden area in the morning.',
            'Insert your index finger 2 inches into the soil near your Tulsi and Mint plants.',
            'If the soil feels damp and clings to your skin, hold off on watering. If it feels crumbly and dry, water deeply at the base.',
            'Record your findings in the observation notes.',
          ],
          estimatedMinutes: 10,
          materials: ['Clean hands', 'Watering can'],
          plantId: 'plant-tulsi',
          plantName: 'Tulsi (Holy Basil)',
          safetyNotes: 'Wash hands thoroughly after handling garden soil.',
          status: 'available',
          createdAt: now,
        },
        {
          id: 'mission-underside-leaf-patrol',
          title: 'Inspect Undersides of Jasmine Leaves',
          objective: 'Scan for early signs of mites, mealybugs, or whiteflies on new Mogra growth.',
          instructions: [
            'Turn over 6 to 8 mature leaves gently on your Mogra plant.',
            'Examine the vein junctions for any tiny webs, white powder, or yellow stippling.',
            'Note whether beneficial pollinators or pests are present around the foliage.',
          ],
          estimatedMinutes: 15,
          materials: ['Magnifying glass or phone camera'],
          plantId: 'plant-mogra',
          plantName: 'Mogra (Arabian Jasmine)',
          safetyNotes: 'Handle fragile new shoots with care.',
          status: 'available',
          createdAt: now,
        },
      ];

      for (const m of demoMissions) {
        await db.put('missions', m);
      }

      const demoJournal: JournalEntry = {
        id: 'journal-welcome',
        plantId: 'plant-tulsi',
        plantName: 'Tulsi (Holy Basil)',
        date: now,
        title: 'Garden Season Kickoff',
        notes: 'Started our garden diary today! Checked the Tulsi and Mogra; fresh leaves are emerging nicely after organic vermicompost feeding.',
        photoUrls: [],
        tags: ['starter', 'season-start'],
        createdAt: now,
        updatedAt: now,
      };
      await db.put('journal', demoJournal);
    }
  }
}

export async function getGardenProfile(): Promise<GardenProfile | undefined> {
  const db = await getDB();
  await seedDefaultDataIfEmpty(db);
  return db.get('gardenProfile', PROFILE_ID);
}

export async function saveGardenProfile(profile: Omit<GardenProfile, 'id' | 'createdAt'> & { createdAt?: string }): Promise<GardenProfile> {
  const db = await getDB();
  const existing = await db.get('gardenProfile', PROFILE_ID);
  const now = new Date().toISOString();
  const record: GardenProfile = {
    ...profile,
    id: PROFILE_ID,
    createdAt: existing?.createdAt || profile.createdAt || now,
    updatedAt: now,
  };
  await db.put('gardenProfile', record);
  return record;
}

// ========== Plants ==========

export async function getAllPlants(): Promise<Plant[]> {
  const db = await getDB();
  return db.getAll('plants');
}

export async function getPlant(id: string): Promise<Plant | undefined> {
  const db = await getDB();
  return db.get('plants', id);
}

export async function savePlant(plant: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Plant> {
  const db = await getDB();
  const now = new Date().toISOString();
  const id = plant.id || generateId();
  const existing = plant.id ? await db.get('plants', plant.id) : undefined;
  const record: Plant = {
    ...plant,
    id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.put('plants', record);
  return record;
}

export async function deletePlant(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('plants', id);
}

export async function getPlantsByCategory(category: string): Promise<Plant[]> {
  const db = await getDB();
  return db.getAllFromIndex('plants', 'by-category', category);
}

// ========== Observations ==========

export async function getObservationsByPlant(plantId: string): Promise<Observation[]> {
  const db = await getDB();
  return db.getAllFromIndex('observations', 'by-plant', plantId);
}

export async function saveObservation(obs: Omit<Observation, 'id' | 'createdAt'> & { id?: string }): Promise<Observation> {
  const db = await getDB();
  const now = new Date().toISOString();
  const record: Observation = {
    ...obs,
    id: obs.id || generateId(),
    createdAt: now,
  };
  await db.put('observations', record);
  return record;
}

export async function deleteObservation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('observations', id);
}

// ========== Care Tasks ==========

export async function getAllTasks(): Promise<CareTask[]> {
  const db = await getDB();
  return db.getAll('careTasks');
}

export async function getTasksByPlant(plantId: string): Promise<CareTask[]> {
  const db = await getDB();
  return db.getAllFromIndex('careTasks', 'by-plant', plantId);
}

export async function getTasksByStatus(status: string): Promise<CareTask[]> {
  const db = await getDB();
  return db.getAllFromIndex('careTasks', 'by-status', status);
}

export async function saveTask(task: Omit<CareTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<CareTask> {
  const db = await getDB();
  const now = new Date().toISOString();
  const id = task.id || generateId();
  const existing = task.id ? await db.get('careTasks', task.id) : undefined;
  const record: CareTask = {
    ...task,
    id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.put('careTasks', record);
  return record;
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('careTasks', id);
}

// ========== Missions ==========

export async function getAllMissions(): Promise<Mission[]> {
  const db = await getDB();
  return db.getAll('missions');
}

export async function getMission(id: string): Promise<Mission | undefined> {
  const db = await getDB();
  return db.get('missions', id);
}

export async function saveMission(mission: Omit<Mission, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Mission> {
  const db = await getDB();
  const now = new Date().toISOString();
  const record: Mission = {
    ...mission,
    id: mission.id || generateId(),
    createdAt: mission.createdAt || now,
  };
  await db.put('missions', record);
  return record;
}

export async function deleteMission(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('missions', id);
}

// ========== Journal ==========

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  const db = await getDB();
  return db.getAll('journal');
}

export async function getJournalEntriesByPlant(plantId: string): Promise<JournalEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('journal', 'by-plant', plantId);
}

export async function saveJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<JournalEntry> {
  const db = await getDB();
  const now = new Date().toISOString();
  const id = entry.id || generateId();
  const existing = entry.id ? await db.get('journal', entry.id) : undefined;
  const record: JournalEntry = {
    ...entry,
    id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.put('journal', record);
  return record;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('journal', id);
}

// ========== Data Export/Import ==========

export interface ExportData {
  version: 1;
  exportedAt: string;
  gardenProfile?: GardenProfile;
  plants: Plant[];
  observations: Observation[];
  careTasks: CareTask[];
  missions: Mission[];
  journal: JournalEntry[];
}

export async function exportAllData(): Promise<ExportData> {
  const db = await getDB();
  const [gardenProfile, plants, observations, careTasks, missions, journal] = await Promise.all([
    getGardenProfile(),
    db.getAll('plants'),
    db.getAll('observations'),
    db.getAll('careTasks'),
    db.getAll('missions'),
    db.getAll('journal'),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    gardenProfile,
    plants,
    observations,
    careTasks,
    missions,
    journal,
  };
}

export async function importData(data: ExportData): Promise<{ imported: number; errors: string[] }> {
  const db = await getDB();
  let imported = 0;
  const errors: string[] = [];

  const tx = db.transaction(
    ['gardenProfile', 'plants', 'observations', 'careTasks', 'missions', 'journal'],
    'readwrite'
  );

  try {
    if (data.gardenProfile) {
      await tx.objectStore('gardenProfile').put(data.gardenProfile);
      imported++;
    }
    for (const plant of data.plants) {
      try {
        await tx.objectStore('plants').put(plant);
        imported++;
      } catch (e) {
        errors.push(`Failed to import plant: ${plant.commonName}`);
      }
    }
    for (const obs of data.observations) {
      try {
        await tx.objectStore('observations').put(obs);
        imported++;
      } catch (e) {
        errors.push(`Failed to import observation: ${obs.id}`);
      }
    }
    for (const task of data.careTasks) {
      try {
        await tx.objectStore('careTasks').put(task);
        imported++;
      } catch (e) {
        errors.push(`Failed to import task: ${task.title}`);
      }
    }
    for (const mission of data.missions) {
      try {
        await tx.objectStore('missions').put(mission);
        imported++;
      } catch (e) {
        errors.push(`Failed to import mission: ${mission.title}`);
      }
    }
    for (const entry of data.journal) {
      try {
        await tx.objectStore('journal').put(entry);
        imported++;
      } catch (e) {
        errors.push(`Failed to import journal entry: ${entry.id}`);
      }
    }
    await tx.done;
  } catch (e) {
    errors.push('Transaction failed');
  }

  return { imported, errors };
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['gardenProfile', 'plants', 'observations', 'careTasks', 'missions', 'journal'],
    'readwrite'
  );
  await Promise.all([
    tx.objectStore('gardenProfile').clear(),
    tx.objectStore('plants').clear(),
    tx.objectStore('observations').clear(),
    tx.objectStore('careTasks').clear(),
    tx.objectStore('missions').clear(),
    tx.objectStore('journal').clear(),
    tx.done,
  ]);
}
