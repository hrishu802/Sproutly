import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Clock,
  CheckCircle2,
  Play,
  Loader2,
  RefreshCw,
  Sprout,
  Package,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage, useGarden } from '../context/AppContext';
import { getAllPlants, getAllMissions, saveMission, generateId } from '../services/storage/db';
import { generateMissions } from '../services/ai/api';
import type { Mission, Plant, Language } from '../types';

export default function MissionsPage() {
  const { t, language } = useLanguage();
  const { profile } = useGarden();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'in-progress' | 'completed'>('available');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [observation, setObservation] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([getAllMissions(), getAllPlants()]);
      setMissions(m.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPlants(p);
    } catch (err) {
      console.error('Failed to load missions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (plants.length === 0) return;
    setGenerating(true);
    setError(null);

    try {
      const generated = await generateMissions({
        plants: plants.map((p) => ({
          id: p.id,
          name: p.commonName,
          category: p.category,
          location: p.location,
        })),
        language: language as Language,
        region: profile?.region,
      });

      const now = new Date().toISOString();
      for (const mission of generated) {
        await saveMission({
          ...mission,
          id: generateId(),
          status: 'available',
          createdAt: now,
        });
      }
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate missions';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const startMission = async (mission: Mission) => {
    await saveMission({ ...mission, status: 'in-progress' });
    await loadData();
    setActiveTab('in-progress');
  };

  const completeMission = async (mission: Mission) => {
    await saveMission({
      ...mission,
      status: 'completed',
      observation: observation.trim() || undefined,
      completedAt: new Date().toISOString(),
    });
    setCompletingId(null);
    setObservation('');
    await loadData();
  };

  const filteredMissions = missions.filter((m) => {
    if (activeTab === 'available') return m.status === 'available';
    if (activeTab === 'in-progress') return m.status === 'in-progress';
    return m.status === 'completed';
  });

  const tabCounts = {
    available: missions.filter((m) => m.status === 'available').length,
    'in-progress': missions.filter((m) => m.status === 'in-progress').length,
    completed: missions.filter((m) => m.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Sprout className="w-10 h-10 text-forest-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-6 h-6 text-olive-600" />
            <h1 className="heading-page">{t.missions.title}</h1>
          </div>
          <p className="text-sage-500 text-sm">{t.missions.subtitle}</p>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating || plants.length === 0}
        className="btn-primary w-full mb-5"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t.missions.generating}
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            {t.missions.generate}
          </>
        )}
      </button>

      {plants.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-5">
          {t.missions.needPlants}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-5">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-sage-100 rounded-lg p-1 mb-5">
        {(['available', 'in-progress', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-white text-forest-700 shadow-sm'
                : 'text-sage-500 hover:text-sage-700'
            }`}
          >
            {tab === 'in-progress' ? t.missions.inProgress : tab === 'available' ? t.missions.available : t.missions.completed} ({tabCounts[tab]})
          </button>
        ))}
      </div>

      {/* Mission List */}
      {filteredMissions.length > 0 ? (
        <div className="space-y-3">
          {filteredMissions.map((mission, i) => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-padded"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-medium text-forest-800 text-sm">{mission.title}</h3>
                <div className="flex items-center gap-1 text-xs text-sage-500 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {t.missions.minutes.replace('{n}', String(mission.estimatedMinutes))}
                </div>
              </div>

              <p className="text-sm text-sage-600 mb-2">{mission.objective}</p>

              {/* Instructions */}
              {mission.instructions.length > 0 && (
                <ol className="space-y-1 mb-3">
                  {mission.instructions.map((step, j) => (
                    <li key={j} className="text-xs text-sage-600 flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-sage-100 text-sage-500 text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {j + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}

              {/* Materials */}
              {mission.materials.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-sage-500 mb-2">
                  <Package className="w-3 h-3" />
                  <span className="font-medium">{t.missions.materials}:</span>
                  {mission.materials.join(', ')}
                </div>
              )}

              {/* Safety */}
              {mission.safetyNotes && (
                <div className="flex items-start gap-1 text-xs text-amber-600 bg-amber-50 rounded p-2 mb-2">
                  <ShieldAlert className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {mission.safetyNotes}
                </div>
              )}

              {/* Plant Link */}
              {mission.plantName && (
                <p className="text-xs text-sage-500 mb-3">
                  🌱 {mission.plantName}
                </p>
              )}

              {/* Completed observation */}
              {mission.status === 'completed' && mission.observation && (
                <div className="bg-sage-50 rounded-lg p-3 mt-2 mb-2">
                  <p className="text-xs font-medium text-sage-600 mb-0.5">Your observation:</p>
                  <p className="text-sm text-sage-700">{mission.observation}</p>
                </div>
              )}

              {/* Actions */}
              {mission.status === 'available' && (
                <button
                  onClick={() => startMission(mission)}
                  className="btn-primary text-sm w-full mt-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  {t.missions.start}
                </button>
              )}

              {mission.status === 'in-progress' && completingId !== mission.id && (
                <button
                  onClick={() => setCompletingId(mission.id)}
                  className="btn-primary text-sm w-full mt-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t.missions.complete}
                </button>
              )}

              {/* Completion form */}
              <AnimatePresence>
                {completingId === mission.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <label className="label">{t.missions.observation}</label>
                    <textarea
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      className="input-field resize-none mb-2"
                      rows={3}
                      placeholder={t.missions.observationPlaceholder}
                      maxLength={2000}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setCompletingId(null); setObservation(''); }}
                        className="btn-secondary flex-1 text-sm"
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        onClick={() => completeMission(mission)}
                        className="btn-primary flex-1 text-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t.missions.saveObservation}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-sage-200 mx-auto mb-3" />
          <p className="text-sage-500">{t.missions.noMissions}</p>
        </div>
      )}
    </div>
  );
}
