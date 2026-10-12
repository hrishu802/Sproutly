import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Plus,
  Calendar,
  Sprout,
  X,
  Download,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../context/AppContext';
import {
  getAllJournalEntries,
  saveJournalEntry,
  deleteJournalEntry,
  getAllPlants,
} from '../services/storage/db';
import type { JournalEntry, Plant } from '../types';

export default function JournalPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formNotes, setFormNotes] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPlantId, setFormPlantId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [e, p] = await Promise.all([getAllJournalEntries(), getAllPlants()]);
      setEntries(e.sort((a, b) => b.date.localeCompare(a.date)));
      setPlants(p);
    } catch (err) {
      console.error('Failed to load journal:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNotes.trim()) return;
    setSaving(true);

    try {
      const plant = plants.find((p) => p.id === formPlantId);
      await saveJournalEntry({
        ...(editingId ? { id: editingId } : {}),
        title: formTitle.trim() || undefined,
        notes: formNotes.trim(),
        plantId: formPlantId || undefined,
        plantName: plant?.commonName,
        date: new Date().toISOString(),
        photoUrls: [],
        tags: [],
      });
      setShowForm(false);
      resetForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormNotes('');
    setFormTitle('');
    setFormPlantId('');
    setEditingId(null);
  };

  const handleEdit = (entry: JournalEntry) => {
    setFormNotes(entry.notes);
    setFormTitle(entry.title || '');
    setFormPlantId(entry.plantId || '');
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.journal.deleteConfirm)) return;
    await deleteJournalEntry(id);
    await loadData();
  };

  const handleExport = () => {
    const data = entries.map((e) => ({
      date: new Date(e.date).toLocaleString(),
      title: e.title || '',
      notes: e.notes,
      plant: e.plantName || '',
    }));
    const csv = [
      'Date,Title,Notes,Plant',
      ...data.map((d) => `"${d.date}","${d.title}","${d.notes.replace(/"/g, '""')}","${d.plant}"`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sproutly-journal-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
            <BookOpen className="w-6 h-6 text-forest-500" />
            <h1 className="heading-page">{t.journal.title}</h1>
          </div>
          <p className="text-sage-500 text-sm">{t.journal.subtitle}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary text-sm flex-1"
        >
          <Plus className="w-4 h-4" />
          {t.journal.addEntry}
        </button>
        {entries.length > 0 && (
          <button onClick={handleExport} className="btn-secondary text-sm" aria-label={t.journal.export}>
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <form onSubmit={handleSave} className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="heading-section">
                    {editingId ? t.journal.editEntry : t.journal.addEntry}
                  </h2>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="btn-ghost p-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="jTitle" className="label">Title (optional)</label>
                    <input
                      id="jTitle"
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="input-field"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <label htmlFor="jNotes" className="label">Notes *</label>
                    <textarea
                      id="jNotes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="input-field resize-none"
                      rows={5}
                      placeholder={t.journal.notesPlaceholder}
                      required
                      maxLength={5000}
                    />
                  </div>

                  <div>
                    <label htmlFor="jPlant" className="label">{t.journal.selectPlant}</label>
                    <select
                      id="jPlant"
                      value={formPlantId}
                      onChange={(e) => setFormPlantId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">—</option>
                      {plants.map((p) => (
                        <option key={p.id} value={p.id}>{p.commonName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t border-sage-100">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="btn-secondary flex-1"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!formNotes.trim() || saving}
                    className="btn-primary flex-1"
                  >
                    {saving ? t.common.loading : t.journal.save}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries */}
      {entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-padded"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-sage-500">
                  <Calendar className="w-3 h-3" />
                  {formatDate(entry.date)}
                  {entry.plantName && (
                    <>
                      <span>·</span>
                      <span className="text-forest-600">🌱 {entry.plantName}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="btn-ghost p-1 text-sage-400 hover:text-sage-600"
                    aria-label="Edit"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="btn-ghost p-1 text-sage-400 hover:text-red-500"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {entry.title && (
                <h3 className="font-medium text-forest-800 mb-1">{entry.title}</h3>
              )}
              <p className="text-sm text-sage-700 whitespace-pre-wrap">{entry.notes}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-sage-200 mx-auto mb-3" />
          <p className="text-sage-500">{t.journal.noEntries}</p>
        </div>
      )}
    </div>
  );
}
