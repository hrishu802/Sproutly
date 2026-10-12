import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Sprout,
  Flower2,
  Carrot,
  Leaf,
  TreePine,
  X,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../context/AppContext';
import { getAllPlants, savePlant, deletePlant } from '../services/storage/db';
import type { Plant, PlantCategory } from '../types';
import PlantForm from '../features/plants/PlantForm';

const categoryIcons: Record<string, React.ReactNode> = {
  flower: <Flower2 className="w-4.5 h-4.5" />,
  vegetable: <Carrot className="w-4.5 h-4.5" />,
  herb: <Leaf className="w-4.5 h-4.5" />,
  tree: <TreePine className="w-4.5 h-4.5" />,
};

const categoryColors: Record<string, string> = {
  flower: 'bg-pink-50 text-pink-600',
  vegetable: 'bg-orange-50 text-orange-600',
  herb: 'bg-emerald-50 text-emerald-600',
  indoor: 'bg-teal-50 text-teal-600',
  fruit: 'bg-red-50 text-red-600',
  succulent: 'bg-lime-50 text-lime-600',
  tree: 'bg-amber-50 text-amber-700',
  other: 'bg-sage-50 text-sage-600',
};

export default function GardenPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(searchParams.get('add') === 'true');
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);

  const loadPlants = useCallback(async () => {
    try {
      const allPlants = await getAllPlants();
      setPlants(allPlants.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (err) {
      console.error('Failed to load plants:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

  const handleSavePlant = async (plantData: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    await savePlant(plantData);
    await loadPlants();
    setShowForm(false);
    setEditingPlant(null);
    setSearchParams({});
  };

  const handleDeletePlant = async (id: string) => {
    if (!window.confirm(t.plants.deleteConfirm)) return;
    await deletePlant(id);
    await loadPlants();
  };

  const filteredPlants = plants.filter((plant) => {
    const matchesSearch =
      plant.commonName.toLowerCase().includes(search.toLowerCase()) ||
      plant.scientificName?.toLowerCase().includes(search.toLowerCase()) ||
      plant.location?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'all' || plant.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: PlantCategory[] = ['flower', 'vegetable', 'herb', 'indoor', 'fruit', 'succulent', 'tree', 'other'];

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="heading-page">{t.plants.myGarden}</h1>
        <button
          onClick={() => {
            setEditingPlant(null);
            setShowForm(true);
          }}
          className="btn-primary text-sm"
          aria-label={t.plants.addPlant}
        >
          <Plus className="w-4 h-4" />
          {t.plants.addPlant}
        </button>
      </div>

      {/* Search & Filter */}
      {plants.length > 0 && (
        <div className="mb-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-sage-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.plants.searchPlants}
              className="input-field pl-10"
              aria-label={t.common.search}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filterCategory === 'all'
                  ? 'bg-forest-600 text-white'
                  : 'bg-sage-100 text-sage-600 hover:bg-sage-200'
              }`}
            >
              All ({plants.length})
            </button>
            {categories.map((cat) => {
              const count = plants.filter((p) => p.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    filterCategory === cat
                      ? 'bg-forest-600 text-white'
                      : 'bg-sage-100 text-sage-600 hover:bg-sage-200'
                  }`}
                >
                  {t.plants.categories[cat]} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Plant Form Modal */}
      <AnimatePresence>
        {(showForm || editingPlant) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowForm(false);
                setEditingPlant(null);
              }
            }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <PlantForm
                plant={editingPlant}
                onSave={handleSavePlant}
                onCancel={() => {
                  setShowForm(false);
                  setEditingPlant(null);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plant List */}
      {filteredPlants.length > 0 ? (
        <div className="space-y-2">
          {filteredPlants.map((plant, index) => (
            <motion.div
              key={plant.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link
                to={`/garden/${plant.id}`}
                className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow group block"
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                    categoryColors[plant.category] || categoryColors.other
                  }`}
                >
                  {categoryIcons[plant.category] || <Sprout className="w-4.5 h-4.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-forest-800 truncate">{plant.commonName}</p>
                    {plant.isDemo && (
                      <span className="text-[10px] bg-cream-200 text-cream-700 px-1.5 py-0.5 rounded flex-shrink-0">
                        {t.plants.demoLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-sage-500 truncate">
                    {t.plants.categories[plant.category as keyof typeof t.plants.categories]}
                    {plant.location && ` · ${plant.location}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeletePlant(plant.id);
                    }}
                    className="p-1.5 text-sage-300 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                    aria-label={t.plants.deletePlant}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-sage-300 group-hover:text-sage-500 flex-shrink-0" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : plants.length === 0 ? (
        <div className="text-center py-12">
          <Sprout className="w-16 h-16 text-sage-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-sage-700 mb-2">{t.plants.noPlants}</h3>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary mt-4"
          >
            <Plus className="w-4 h-4" />
            {t.plants.addPlant}
          </button>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-sage-500">{t.common.noResults}</p>
        </div>
      )}
    </div>
  );
}
