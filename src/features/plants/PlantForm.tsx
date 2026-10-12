import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../context/AppContext';
import type { Plant, PlantCategory, SunlightLevel, WateringFrequency } from '../../types';

interface PlantFormProps {
  plant?: Plant | null;
  onSave: (plant: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onCancel: () => void;
}

export default function PlantForm({ plant, onSave, onCancel }: PlantFormProps) {
  const { t } = useLanguage();
  const [commonName, setCommonName] = useState(plant?.commonName || '');
  const [scientificName, setScientificName] = useState(plant?.scientificName || '');
  const [category, setCategory] = useState<PlantCategory>(plant?.category || 'flower');
  const [location, setLocation] = useState(plant?.location || '');
  const [sunlight, setSunlight] = useState<SunlightLevel | ''>(plant?.sunlight || '');
  const [wateringPreference, setWateringPreference] = useState<WateringFrequency | ''>(plant?.wateringPreference || '');
  const [soilNotes, setSoilNotes] = useState(plant?.soilNotes || '');
  const [notes, setNotes] = useState(plant?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commonName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...(plant?.id ? { id: plant.id } : {}),
        commonName: commonName.trim(),
        scientificName: scientificName.trim() || undefined,
        category,
        location: location.trim() || undefined,
        sunlight: sunlight || undefined,
        wateringPreference: wateringPreference || undefined,
        soilNotes: soilNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        isDemo: plant?.isDemo || false,
      });
    } finally {
      setSaving(false);
    }
  };

  const categories: PlantCategory[] = ['flower', 'vegetable', 'herb', 'indoor', 'fruit', 'succulent', 'tree', 'other'];
  const sunlightLevels: SunlightLevel[] = ['full-sun', 'partial-sun', 'partial-shade', 'full-shade'];
  const wateringLevels: WateringFrequency[] = ['daily', 'every-2-days', 'twice-weekly', 'weekly', 'biweekly', 'monthly', 'as-needed'];

  return (
    <form onSubmit={handleSubmit} className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="heading-section">
          {plant ? t.plants.editPlant : t.plants.addPlant}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost p-2"
          aria-label={t.common.close}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Common Name */}
        <div>
          <label htmlFor="commonName" className="label">{t.plants.commonName} *</label>
          <input
            id="commonName"
            type="text"
            value={commonName}
            onChange={(e) => setCommonName(e.target.value)}
            className="input-field"
            required
            maxLength={150}
            autoFocus
          />
        </div>

        {/* Scientific Name */}
        <div>
          <label htmlFor="scientificName" className="label">{t.plants.scientificName}</label>
          <input
            id="scientificName"
            type="text"
            value={scientificName}
            onChange={(e) => setScientificName(e.target.value)}
            className="input-field"
            maxLength={200}
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="label">{t.plants.category}</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as PlantCategory)}
            className="input-field"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {t.plants.categories[cat]}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="label">{t.plants.location}</label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input-field"
            placeholder="e.g., Front yard, Kitchen window, Balcony"
            maxLength={200}
          />
        </div>

        {/* Sunlight */}
        <div>
          <label htmlFor="sunlight" className="label">{t.plants.sunlight}</label>
          <select
            id="sunlight"
            value={sunlight}
            onChange={(e) => setSunlight(e.target.value as SunlightLevel)}
            className="input-field"
          >
            <option value="">—</option>
            {sunlightLevels.map((level) => (
              <option key={level} value={level}>
                {t.plants.sunlightLevels[level]}
              </option>
            ))}
          </select>
        </div>

        {/* Watering */}
        <div>
          <label htmlFor="watering" className="label">{t.plants.watering}</label>
          <select
            id="watering"
            value={wateringPreference}
            onChange={(e) => setWateringPreference(e.target.value as WateringFrequency)}
            className="input-field"
          >
            <option value="">—</option>
            {wateringLevels.map((level) => (
              <option key={level} value={level}>
                {t.plants.wateringLevels[level]}
              </option>
            ))}
          </select>
        </div>

        {/* Soil Notes */}
        <div>
          <label htmlFor="soilNotes" className="label">{t.plants.soilNotes}</label>
          <textarea
            id="soilNotes"
            value={soilNotes}
            onChange={(e) => setSoilNotes(e.target.value)}
            className="input-field resize-none"
            rows={2}
            maxLength={500}
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="label">{t.plants.notes}</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field resize-none"
            rows={3}
            maxLength={2000}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-sage-100">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
        >
          {t.plants.cancel}
        </button>
        <button
          type="submit"
          disabled={!commonName.trim() || saving}
          className="btn-primary flex-1"
        >
          {saving ? t.common.loading : t.plants.save}
        </button>
      </div>
    </form>
  );
}
