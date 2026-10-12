import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Check,
  Download,
  Upload,
  Trash2,
  Shield,
  Cpu,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage, useGarden } from '../context/AppContext';
import { checkAIStatus } from '../services/ai/api';
import { exportAllData, importData, clearAllData, type ExportData } from '../services/storage/db';
import type { GrowingEnvironment } from '../types';
import type { SupportedLanguage } from '../locales/translations';

export default function SettingsPage() {
  const { t, language, setLanguage } = useLanguage();
  const { profile, updateProfile } = useGarden();

  const [gardenName, setGardenName] = useState(profile?.name || 'My Garden');
  const [region, setRegion] = useState(profile?.region || '');
  const [environment, setEnvironment] = useState(profile?.growingEnvironment || '');
  const [experience, setExperience] = useState(profile?.experienceLevel || '');
  const [saved, setSaved] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; model?: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setGardenName(profile.name);
      setRegion(profile.region || '');
      setEnvironment(profile.growingEnvironment || '');
      setExperience(profile.experienceLevel || '');
    }
  }, [profile]);

  useEffect(() => {
    checkAIStatus().then(setAiStatus).catch(() => setAiStatus({ available: false }));
  }, []);

  const handleSave = async () => {
    await updateProfile({
      name: gardenName.trim() || 'My Garden',
      region: region.trim() || undefined,
      growingEnvironment: (environment || undefined) as GrowingEnvironment | undefined,
      experienceLevel: (experience || undefined) as 'beginner' | 'intermediate' | 'experienced' | undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sproutly-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data: ExportData = JSON.parse(text);
        if (data.version !== 1) {
          alert('Incompatible backup version');
          return;
        }
        const result = await importData(data);
        alert(`Imported ${result.imported} items. ${result.errors.length ? `Errors: ${result.errors.join(', ')}` : ''}`);
        window.location.reload();
      } catch (err) {
        alert('Failed to import: Invalid backup file');
      }
    };
    input.click();
  };

  const handleClear = async () => {
    if (!window.confirm(t.settings.clearConfirm)) return;
    await clearAllData();
    window.location.reload();
  };

  const environments: GrowingEnvironment[] = ['outdoor-garden', 'balcony', 'terrace', 'indoor', 'greenhouse', 'mixed'];
  const experienceLevels = ['beginner', 'intermediate', 'experienced'] as const;
  const languages: { value: SupportedLanguage; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'हिन्दी (Hindi)' },
    { value: 'hinglish', label: 'Hinglish' },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="w-6 h-6 text-sage-500" />
        <h1 className="heading-page">{t.settings.title}</h1>
      </div>

      <div className="space-y-6">
        {/* Garden Profile */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-padded"
        >
          <h2 className="heading-section mb-4">{t.settings.gardenProfile}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="gardenName" className="label">{t.settings.gardenName}</label>
              <input
                id="gardenName"
                type="text"
                value={gardenName}
                onChange={(e) => setGardenName(e.target.value)}
                className="input-field"
                maxLength={100}
              />
            </div>

            <div>
              <label htmlFor="region" className="label">{t.settings.region}</label>
              <input
                id="region"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="input-field"
                placeholder={t.settings.regionPlaceholder}
                maxLength={200}
              />
            </div>

            <div>
              <label htmlFor="environment" className="label">{t.settings.environment}</label>
              <select
                id="environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="input-field"
              >
                <option value="">—</option>
                {environments.map((env) => (
                  <option key={env} value={env}>
                    {t.settings.environments[env]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="experience" className="label">{t.settings.experience}</label>
              <select
                id="experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="input-field"
              >
                <option value="">—</option>
                {experienceLevels.map((level) => (
                  <option key={level} value={level}>
                    {t.settings.experienceLevels[level]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </motion.section>

        {/* Language */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card-padded"
        >
          <h2 className="heading-section mb-4">{t.settings.language}</h2>
          <div className="space-y-2">
            {languages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between ${
                  language === lang.value
                    ? 'border-forest-400 bg-forest-50 text-forest-700'
                    : 'border-sage-200 hover:border-sage-300 text-sage-700'
                }`}
              >
                <span className="font-medium text-sm">{lang.label}</span>
                {language === lang.value && <Check className="w-4 h-4 text-forest-600" />}
              </button>
            ))}
          </div>
        </motion.section>

        {/* AI Status */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-padded"
        >
          <h2 className="heading-section mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            {t.settings.aiStatus}
          </h2>
          {aiStatus === null ? (
            <p className="text-sm text-sage-500">{t.common.loading}</p>
          ) : aiStatus.available ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-700">{t.settings.aiConnected}</span>
              {aiStatus.model && (
                <span className="text-xs text-sage-500 ml-1">({aiStatus.model})</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-700">{t.settings.aiNotConfigured}</span>
            </div>
          )}
        </motion.section>

        {/* Save Button */}
        <button onClick={handleSave} className="btn-primary w-full">
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              {t.settings.saved}
            </>
          ) : (
            t.settings.save
          )}
        </button>

        {/* Data Management */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card-padded"
        >
          <h2 className="heading-section mb-4">{t.settings.dataManagement}</h2>
          <div className="space-y-2">
            <button onClick={handleExport} className="btn-secondary w-full text-sm">
              <Download className="w-4 h-4" />
              {t.settings.exportData}
            </button>
            <button onClick={handleImport} className="btn-secondary w-full text-sm">
              <Upload className="w-4 h-4" />
              {t.settings.importData}
            </button>
            <button onClick={handleClear} className="btn-danger w-full text-sm">
              <Trash2 className="w-4 h-4" />
              {t.settings.clearData}
            </button>
          </div>
        </motion.section>

        {/* Privacy */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-padded"
        >
          <h2 className="heading-section mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            {t.settings.privacy}
          </h2>
          <p className="text-sm text-sage-600">{t.settings.privacyInfo}</p>
        </motion.section>
      </div>
    </div>
  );
}
