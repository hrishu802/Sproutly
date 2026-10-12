import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sprout,
  Stethoscope,
  MessageCircle,
  Target,
  Plus,
  ArrowRight,
  Sun,
  CloudRain,
  Leaf,
} from 'lucide-react';
import { useLanguage } from '../context/AppContext';
import { getAllPlants, getAllMissions } from '../services/storage/db';
import type { Plant, Mission } from '../types';

export default function HomePage() {
  const { t } = useLanguage();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, m] = await Promise.all([getAllPlants(), getAllMissions()]);
        setPlants(p.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        setMissions(m.filter((m) => m.status !== 'completed'));
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.common.morning;
    if (hour < 17) return t.common.afternoon;
    return t.common.evening;
  };

  const getSeasonalIcon = () => {
    const month = new Date().getMonth();
    if (month >= 5 && month <= 8) return <CloudRain className="w-5 h-5 text-blue-500" />;
    if (month >= 9 && month <= 11) return <Leaf className="w-5 h-5 text-amber-600" />;
    return <Sun className="w-5 h-5 text-amber-500" />;
  };

  const getSeason = () => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 8) return 'Monsoon / Summer';
    if (month >= 9 && month <= 10) return 'Autumn';
    return 'Winter';
  };

  const recentPlants = plants.slice(0, 4);
  const activeMission = missions.find((m) => m.status === 'in-progress') || missions[0];

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Sprout className="w-10 h-10 text-forest-500 mx-auto mb-3 animate-pulse" />
          <p className="text-subtle">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <Sprout className="w-8 h-8 text-forest-500" />
          <h1 className="text-2xl font-serif font-semibold text-forest-800">
            {t.appName}
          </h1>
        </div>
        <p className="text-sage-600 text-lg">
          {t.home.greeting.replace('{timeOfDay}', getTimeOfDay())}
        </p>
      </motion.div>

      {/* Seasonal Context */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-padded mb-6 flex items-center gap-3"
      >
        {getSeasonalIcon()}
        <div>
          <p className="text-sm font-medium text-forest-700">{t.home.seasonalTip}</p>
          <p className="text-sm text-sage-600">
            {getSeason()} — {plants.length > 0 
              ? `You have ${plants.length} plant${plants.length !== 1 ? 's' : ''} in your garden.`
              : 'Start adding plants to get personalized seasonal tips.'
            }
          </p>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
      >
        <h2 className="heading-section mb-3">{t.home.quickActions}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/plant-doctor"
            className="card p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow group"
          >
            <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
              <Stethoscope className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-forest-700 text-center">
              {t.home.diagnosePlant}
            </span>
          </Link>
          <Link
            to="/coach"
            className="card p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow group"
          >
            <div className="w-11 h-11 rounded-full bg-forest-50 flex items-center justify-center group-hover:bg-forest-100 transition-colors">
              <MessageCircle className="w-5 h-5 text-forest-600" />
            </div>
            <span className="text-sm font-medium text-forest-700 text-center">
              {t.home.askCoach}
            </span>
          </Link>
        </div>
      </motion.div>

      {/* Recent Plants */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="heading-section">{t.home.recentPlants}</h2>
          {plants.length > 0 && (
            <Link to="/garden" className="text-sm text-forest-600 font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        
        {recentPlants.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {recentPlants.map((plant) => (
              <Link
                key={plant.id}
                to={`/garden/${plant.id}`}
                className="card p-4 hover:shadow-md transition-shadow"
              >
                <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center mb-2">
                  <Sprout className="w-4.5 h-4.5 text-forest-600" />
                </div>
                <p className="font-medium text-forest-800 text-sm truncate">
                  {plant.commonName}
                </p>
                <p className="text-xs text-sage-500 capitalize">{plant.category}</p>
                {plant.isDemo && (
                  <span className="inline-block mt-1 text-[10px] bg-cream-200 text-cream-700 px-1.5 py-0.5 rounded">
                    {t.plants.demoLabel}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center">
            <Sprout className="w-10 h-10 text-sage-300 mx-auto mb-3" />
            <p className="text-sage-600 mb-4">{t.home.noPlants}</p>
            <Link to="/garden?add=true" className="btn-primary text-sm">
              <Plus className="w-4 h-4" />
              {t.home.addFirstPlant}
            </Link>
          </div>
        )}
      </motion.div>

      {/* Suggested Mission */}
      {activeMission && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-6"
        >
          <h2 className="heading-section mb-3">{t.home.suggestedMission}</h2>
          <Link to="/missions" className="card p-4 hover:shadow-md transition-shadow block">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-olive-100 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-olive-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-forest-800 text-sm">{activeMission.title}</p>
                <p className="text-xs text-sage-500 mt-0.5">{activeMission.objective}</p>
                <p className="text-xs text-olive-600 mt-1">
                  ~{activeMission.estimatedMinutes} min
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-sage-400 flex-shrink-0 mt-1" />
            </div>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
