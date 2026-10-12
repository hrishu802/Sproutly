import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllPlants,
  savePlant,
  getPlant,
  deletePlant,
  getGardenProfile,
  saveMission,
  getAllJournalEntries,
  saveJournalEntry,
  exportAllData,
  importData,
  clearAllData,
} from '../src/services/storage/db';

describe('Sproutly IndexedDB Storage Services', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('initializes default garden profile and starter plants if empty', async () => {
    const profile = await getGardenProfile();
    expect(profile).toBeDefined();
    expect(profile?.name).toBe("Maa's Garden");
    expect(profile?.preferences.language).toBe('en');

    const plants = await getAllPlants();
    expect(plants.length).toBeGreaterThanOrEqual(4);
    expect(plants.some((p) => p.commonName.includes('Tulsi'))).toBe(true);
    expect(plants.some((p) => p.commonName.includes('Mogra'))).toBe(true);
  });

  it('creates, reads, updates, and deletes a plant', async () => {
    const newPlant = await savePlant({
      commonName: 'Ajwain (Mexican Mint)',
      category: 'herb',
      location: 'South Balcony',
      sunlight: 'partial-sun',
      wateringPreference: 'every-2-days',
      notes: 'Thick succulent aromatic leaves.',
      isDemo: false,
    });

    expect(newPlant.id).toBeDefined();
    expect(newPlant.commonName).toBe('Ajwain (Mexican Mint)');

    // Retrieve
    const fetched = await getPlant(newPlant.id);
    expect(fetched).toBeDefined();
    expect(fetched?.category).toBe('herb');

    // Update
    await savePlant({
      ...fetched!,
      notes: 'Updated notes: Propagation through stem cuttings is easy.',
    });
    const updated = await getPlant(newPlant.id);
    expect(updated?.notes).toContain('Propagation through stem cuttings');

    // Delete
    await deletePlant(newPlant.id);
    const deleted = await getPlant(newPlant.id);
    expect(deleted).toBeUndefined();
  });

  it('persists and updates missions', async () => {
    const mission = await saveMission({
      title: 'Inspect Soil Acidity and Texture',
      objective: 'Observe whether soil drains well after watering',
      instructions: ['Dig a small hole', 'Check for earthworms', 'Refill soil'],
      estimatedMinutes: 10,
      materials: ['Trowel'],
      status: 'available',
    });

    expect(mission.id).toBeDefined();
    expect(mission.status).toBe('available');

    // Mark completed with observation
    const completed = await saveMission({
      ...mission,
      status: 'completed',
      observation: 'Found 2 healthy earthworms! Soil has rich organic matter.',
      completedAt: new Date().toISOString(),
    });

    expect(completed.status).toBe('completed');
    expect(completed.observation).toContain('healthy earthworms');
  });

  it('saves and lists journal entries', async () => {
    const entry = await saveJournalEntry({
      date: new Date().toISOString(),
      title: 'First Mogra bloom',
      notes: 'Noticed the first fragrant white bud opening up this morning.',
      photoUrls: [],
      tags: ['blooming', 'mogra'],
    });

    expect(entry.id).toBeDefined();
    const all = await getAllJournalEntries();
    expect(all.some((e) => e.title === 'First Mogra bloom')).toBe(true);
  });

  it('exports and imports backup data cleanly', async () => {
    await savePlant({
      commonName: 'Neem Tree Sapling',
      category: 'tree',
      isDemo: false,
    });

    const exportData = await exportAllData();
    expect(exportData.version).toBe(1);
    expect(exportData.plants.length).toBeGreaterThan(0);

    // Clear everything
    await clearAllData();
    const clearedPlants = await getAllPlants();
    expect(clearedPlants.length).toBe(0);

    // Import back
    const result = await importData(exportData);
    expect(result.errors.length).toBe(0);
    expect(result.imported).toBeGreaterThan(0);

    const restoredPlants = await getAllPlants();
    expect(restoredPlants.some((p) => p.commonName === 'Neem Tree Sapling')).toBe(true);
  });
});
