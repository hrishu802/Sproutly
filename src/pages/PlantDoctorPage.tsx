import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Camera,
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Target,
  Loader2,
  Info,
} from 'lucide-react';
import { useLanguage, useGarden } from '../context/AppContext';
import { getAllPlants, saveObservation, saveMission } from '../services/storage/db';
import { diagnosePlant } from '../services/ai/api';
import type { Plant, DiagnosisResult, DiagnosisRequest, Language } from '../types';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MiB

export default function PlantDoctorPage() {
  const { t, language } = useLanguage();
  const { profile } = useGarden();
  const [searchParams] = useSearchParams();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState(searchParams.get('plantId') || '');
  const [symptoms, setSymptoms] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMission, setSavedMission] = useState(false);

  useEffect(() => {
    getAllPlants().then(setPlants).catch(console.error);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Image must be under 5 MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    setImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSavedMission(false);

    const selectedPlant = plants.find((p) => p.id === selectedPlantId);
    const contextParts = [additionalContext.trim()];
    if (profile?.region) contextParts.push(`Region: ${profile.region}`);
    if (profile?.growingEnvironment) contextParts.push(`Environment: ${profile.growingEnvironment}`);
    const fullContext = contextParts.filter(Boolean).join('. ');

    const request: DiagnosisRequest = {
      plantId: selectedPlantId || undefined,
      plantName: selectedPlant?.commonName,
      plantCategory: selectedPlant?.category,
      symptoms: symptoms.trim(),
      additionalContext: fullContext || undefined,
      language: language as Language,
      image: image || undefined,
    };

    try {
      const diagnosis = await diagnosePlant(request);
      setResult(diagnosis);
      if (selectedPlantId) {
        await saveObservation({
          plantId: selectedPlantId,
          date: new Date().toISOString(),
          symptoms: diagnosis.visibleObservations.length > 0 ? diagnosis.visibleObservations : [symptoms.trim()],
          notes: diagnosis.summary,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const confidenceColors: Record<'low' | 'moderate' | 'high', string> = {
    low: 'badge-amber',
    moderate: 'badge bg-blue-50 text-blue-700',
    high: 'badge bg-red-50 text-red-700',
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Stethoscope className="w-6 h-6 text-red-500" />
          <h1 className="heading-page">{t.doctor.title}</h1>
        </div>
        <p className="text-sage-600 text-sm">{t.doctor.subtitle}</p>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-2 bg-sage-50 border border-sage-200 rounded-lg p-3 mb-5 text-xs text-sage-600">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-sage-400" />
        <p>{t.doctor.privacyNote}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Plant Selection */}
        <div>
          <label htmlFor="plantSelect" className="label">{t.doctor.selectPlant}</label>
          <select
            id="plantSelect"
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="input-field"
          >
            <option value="">{t.doctor.unknownPlant}</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>{p.commonName}</option>
            ))}
          </select>
        </div>

        {/* Symptoms */}
        <div>
          <label htmlFor="symptoms" className="label">{t.doctor.symptoms} *</label>
          <textarea
            id="symptoms"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            className="input-field resize-none"
            rows={4}
            placeholder={t.doctor.symptomsPlaceholder}
            required
            maxLength={2000}
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label className="label">{t.doctor.uploadPhoto}</label>
          {imagePreview ? (
            <div className="relative w-full max-w-xs">
              <img
                src={imagePreview}
                alt="Plant photo"
                className="w-full h-48 object-cover rounded-lg border border-sage-200"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white"
                aria-label="Remove photo"
              >
                <X className="w-4 h-4 text-sage-600" />
              </button>
            </div>
          ) : (
            <label className="card border-2 border-dashed border-sage-300 p-6 flex flex-col items-center cursor-pointer hover:border-forest-400 transition-colors">
              <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center mb-2">
                <Camera className="w-6 h-6 text-sage-500" />
              </div>
              <span className="text-sm text-sage-600 font-medium">{t.doctor.uploadPhoto}</span>
              <span className="text-xs text-sage-400 mt-1">{t.doctor.photoHelp}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Additional Context */}
        <div>
          <label htmlFor="context" className="label">{t.doctor.additionalContext}</label>
          <textarea
            id="context"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            className="input-field resize-none"
            rows={2}
            placeholder={t.doctor.contextPlaceholder}
            maxLength={1000}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!symptoms.trim() || loading}
          className="btn-primary w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.doctor.analyzing}
            </>
          ) : (
            <>
              <Stethoscope className="w-4 h-4" />
              {t.doctor.analyze}
            </>
          )}
        </button>
      </form>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-8 space-y-4"
          >
            <h2 className="heading-section flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-forest-500" />
              {t.doctor.results}
            </h2>

            {/* Summary */}
            <div className="card-padded">
              <p className="text-sage-800">{result.summary}</p>
            </div>

            {/* Observations */}
            {result.visibleObservations.length > 0 && (
              <div className="card-padded">
                <h3 className="font-medium text-forest-700 mb-2">{t.doctor.observations}</h3>
                <ul className="space-y-1">
                  {result.visibleObservations.map((obs, i) => (
                    <li key={i} className="text-sm text-sage-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-forest-400 rounded-full mt-2 flex-shrink-0" />
                      {obs}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Possible Causes */}
            {result.possibleCauses.length > 0 && (
              <div className="card-padded">
                <h3 className="font-medium text-forest-700 mb-3">{t.doctor.possibleCauses}</h3>
                <div className="space-y-3">
                  {result.possibleCauses.map((cause, i) => (
                    <div key={i} className="border-l-2 border-sage-200 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-sage-800">{cause.cause}</span>
                        <span className={confidenceColors[cause.confidence]}>
                          {cause.confidence}
                        </span>
                      </div>
                      <p className="text-sm text-sage-600">{cause.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Actions */}
            {result.recommendedActions.length > 0 && (
              <div className="card-padded">
                <h3 className="font-medium text-forest-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {t.doctor.recommended}
                </h3>
                <ul className="space-y-1">
                  {result.recommendedActions.map((action, i) => (
                    <li key={i} className="text-sm text-sage-700 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions to Avoid */}
            {result.actionsToAvoid.length > 0 && (
              <div className="card-padded">
                <h3 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  {t.doctor.avoid}
                </h3>
                <ul className="space-y-1">
                  {result.actionsToAvoid.map((action, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">✗</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-up Questions */}
            {result.followUpQuestions.length > 0 && (
              <div className="card-padded">
                <h3 className="font-medium text-forest-700 mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  {t.doctor.followUp}
                </h3>
                <ul className="space-y-1">
                  {result.followUpQuestions.map((q, i) => (
                    <li key={i} className="text-sm text-sage-700 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">?</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Outdoor Mission */}
            {result.outdoorMission && (
              <div className="card-padded bg-olive-50 border-olive-200">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-olive-800 flex items-center gap-2">
                    <Target className="w-4 h-4 text-olive-600" />
                    {t.doctor.tryMission}
                  </h3>
                  <button
                    type="button"
                    disabled={savedMission}
                    onClick={async () => {
                      if (!result.outdoorMission) return;
                      await saveMission({
                        title: result.outdoorMission.title,
                        objective: 'Follow up on plant diagnosis care',
                        instructions: [result.outdoorMission.instructions],
                        estimatedMinutes: result.outdoorMission.estimatedMinutes,
                        materials: [],
                        plantId: selectedPlantId || undefined,
                        plantName: plants.find((p) => p.id === selectedPlantId)?.commonName,
                        status: 'available',
                      });
                      setSavedMission(true);
                    }}
                    className="text-xs bg-olive-600 text-white px-3 py-1 rounded-md hover:bg-olive-700 disabled:opacity-60"
                  >
                    {savedMission ? 'Added to Missions ✓' : 'Add to Missions'}
                  </button>
                </div>
                <p className="text-sm font-medium text-olive-700">{result.outdoorMission.title}</p>
                <p className="text-sm text-olive-600 mt-1">{result.outdoorMission.instructions}</p>
                <p className="text-xs text-olive-500 mt-1">~{result.outdoorMission.estimatedMinutes} min</p>
              </div>
            )}

            {/* Disclaimer */}
            <div className="card-padded bg-amber-50 border-amber-200">
              <h3 className="font-medium text-amber-800 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {t.doctor.disclaimer}
              </h3>
              <p className="text-sm text-amber-700">{result.disclaimer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
