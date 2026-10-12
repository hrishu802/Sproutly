import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Sun,
  Droplets,
  MapPin,
  Sprout,
  Stethoscope,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { useLanguage } from '../context/AppContext';
import {
  getPlant,
  deletePlant,
  savePlant,
  getObservationsByPlant,
  getJournalEntriesByPlant,
  getTasksByPlant,
} from '../services/storage/db';
import type { Plant, Observation, JournalEntry, CareTask } from '../types';
import PlantForm from '../features/plants/PlantForm';

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [p, obs, entries, t] = await Promise.all([
          getPlant(id),
          getObservationsByPlant(id),
          getJournalEntriesByPlant(id),
          getTasksByPlant(id),
        ]);
        setPlant(p || null);
        setObservations(obs.sort((a: Observation, b: Observation) => b.date.localeCompare(a.date)));
        setJournalEntries(entries.sort((a: JournalEntry, b: JournalEntry) => b.date.localeCompare(a.date)));
        setTasks(t);
      } catch (err) {
        console.error('Failed to load plant:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!plant || !window.confirm(t.plants.deleteConfirm)) return;
    await deletePlant(plant.id);
    navigate('/garden');
  };

  const handleSave = async (data: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    await savePlant(data);
    const updated = await getPlant(data.id!);
    if (updated) setPlant(updated);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Sprout className="w-10 h-10 text-forest-500 animate-pulse" />
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="page-container text-center py-16">
        <p className="text-sage-600 mb-4">Plant not found</p>
        <Link to="/garden" className="btn-primary">
          {t.common.back}
        </Link>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="page-container">
      {/* Back & Actions */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate(-1)} className="btn-ghost">
          <ArrowLeft className="w-4 h-4" />
          {t.common.back}
        </button>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="btn-ghost" aria-label={t.plants.editPlant}>
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="btn-ghost text-red-600 hover:bg-red-50" aria-label={t.plants.deletePlant}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <PlantForm plant={plant} onSave={handleSave} onCancel={() => setEditing(false)} />
          </motion.div>
        </div>
      )}

      {/* Plant Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-padded mb-4"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-sage-100 flex items-center justify-center flex-shrink-0">
            <Sprout className="w-7 h-7 text-forest-600" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold text-forest-800">
              {plant.commonName}
            </h1>
            {plant.scientificName && (
              <p className="text-sm text-sage-500 italic">{plant.scientificName}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="badge-green capitalize">
                {t.plants.categories[plant.category as keyof typeof t.plants.categories]}
              </span>
              {plant.isDemo && (
                <span className="badge bg-cream-200 text-cream-700">{t.plants.demoLabel}</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Growing Conditions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-padded mb-4"
      >
        <h2 className="heading-section mb-3">Growing Conditions</h2>
        <div className="grid grid-cols-2 gap-3">
          {plant.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-sage-400" />
              <span className="text-sage-700">{plant.location}</span>
            </div>
          )}
          {plant.sunlight && (
            <div className="flex items-center gap-2 text-sm">
              <Sun className="w-4 h-4 text-amber-500" />
              <span className="text-sage-700">
                {t.plants.sunlightLevels[plant.sunlight]}
              </span>
            </div>
          )}
          {plant.wateringPreference && (
            <div className="flex items-center gap-2 text-sm">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-sage-700">
                {t.plants.wateringLevels[plant.wateringPreference]}
              </span>
            </div>
          )}
        </div>
        {plant.soilNotes && (
          <p className="text-sm text-sage-600 mt-3 pt-3 border-t border-sage-100">
            <span className="font-medium">Soil:</span> {plant.soilNotes}
          </p>
        )}
        {plant.notes && (
          <p className="text-sm text-sage-600 mt-2">
            <span className="font-medium">Notes:</span> {plant.notes}
          </p>
        )}
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-4"
      >
        <Link
          to={`/plant-doctor?plantId=${plant.id}`}
          className="card p-3 text-center hover:shadow-md transition-shadow"
        >
          <Stethoscope className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <span className="text-xs font-medium text-forest-700">{t.home.diagnosePlant}</span>
        </Link>
        <Link
          to={`/journal?plantId=${plant.id}`}
          className="card p-3 text-center hover:shadow-md transition-shadow"
        >
          <BookOpen className="w-5 h-5 text-forest-500 mx-auto mb-1" />
          <span className="text-xs font-medium text-forest-700">View Journal</span>
        </Link>
      </motion.div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card-padded mb-4"
        >
          <h2 className="heading-section mb-3">Care Tasks</h2>
          <div className="space-y-2">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  task.status === 'completed' ? 'bg-green-400' :
                  task.status === 'in-progress' ? 'bg-amber-400' : 'bg-sage-300'
                }`} />
                <span className={task.status === 'completed' ? 'text-sage-400 line-through' : 'text-sage-700'}>
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Journal Entries */}
      {journalEntries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-padded mb-4"
        >
          <h2 className="heading-section mb-3">Recent Journal</h2>
          <div className="space-y-3">
            {journalEntries.slice(0, 3).map((entry) => (
              <div key={entry.id} className="text-sm border-l-2 border-sage-200 pl-3">
                <div className="flex items-center gap-1 text-sage-500 mb-0.5">
                  <Calendar className="w-3 h-3" />
                  <span className="text-xs">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sage-700 line-clamp-2">{entry.notes}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Observations */}
      {observations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card-padded mb-4"
        >
          <h2 className="heading-section mb-3">Recorded Observations</h2>
          <div className="space-y-3">
            {observations.slice(0, 3).map((obs) => (
              <div key={obs.id} className="text-sm border-l-2 border-forest-300 pl-3">
                <div className="flex items-center gap-1 text-sage-500 mb-0.5">
                  <Calendar className="w-3 h-3" />
                  <span className="text-xs">{formatDate(obs.date)}</span>
                </div>
                {obs.symptoms.length > 0 && (
                  <p className="font-medium text-forest-700 text-xs mb-1">
                    Symptoms: {obs.symptoms.join(', ')}
                  </p>
                )}
                {obs.notes && <p className="text-sage-700 line-clamp-2">{obs.notes}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Added on */}
      <p className="text-xs text-sage-400 text-center mt-6">
        Added {formatDate(plant.createdAt)} · Updated {formatDate(plant.updatedAt)}
      </p>
    </div>
  );
}
