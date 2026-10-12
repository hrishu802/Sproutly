import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Send,
  Loader2,
  User,
  Bot,
  Lightbulb,
  CheckSquare,
  RotateCcw,
  Sparkles,
  Target,
  Stethoscope,
  CloudSun,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage, useGarden } from '../context/AppContext';
import {
  getAllPlants,
  getAllMissions,
  getAllJournalEntries,
  getObservationsByPlant,
  saveMission,
} from '../services/storage/db';
import { chatWithCoach } from '../services/ai/api';
import type {
  ChatMessage,
  CoachActionItem,
  CoachPossibleCause,
  CoachOutdoorMission,
  Language,
} from '../types';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  observations?: string[];
  possibleCauses?: CoachPossibleCause[];
  actions?: CoachActionItem[];
  actionItems?: string[];
  followUpQuestion?: string | null;
  followUpSuggestions?: string[];
  outdoorMission?: CoachOutdoorMission;
  weatherNote?: string;
  references?: string[];
  isError?: boolean;
}

const STORAGE_KEY = 'sproutly_coach_messages_v1';

const SUGGESTIONS_EN = [
  'How do I test my soil moisture before watering?',
  'What should I look for under leaves to spot early pests?',
  'Best companion plants for my garden this season?',
  'How do I prune my herbs to promote bushy growth?',
];

const SUGGESTIONS_HI = [
  'पानी देने से पहले मिट्टी की नमी कैसे जाँचें?',
  'कीटों की पहचान के लिए पत्तियों के नीचे क्या देखना चाहिए?',
  'इस मौसम में मेरे बगीचे के लिए सबसे अच्छे साथी पौधे कौन से हैं?',
  'जड़ी-बूटियों की छंटाई कैसे करें ताकि वे घनी उगें?',
];

const SUGGESTIONS_HINGLISH = [
  'Paani dene se pehle soil moisture kaise check karein?',
  'Keede pehchanne ke liye pattiyon ke neeche kya dekhna chahiye?',
  'Is season mein mere garden ke liye companion plants kaun se hain?',
  'Herbs ki pruning kaise karein taaki wo ghani grow karein?',
];

export default function GardenCoachPage() {
  const { t, language } = useLanguage();
  const { profile } = useGarden();

  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserPrompt, setLastUserPrompt] = useState<string>('');
  const [plantCount, setPlantCount] = useState<number>(0);
  const [savedMissionIds, setSavedMissionIds] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load garden plant count for context badge
  useEffect(() => {
    getAllPlants()
      .then((plants) => setPlantCount(plants.length))
      .catch(() => {});
  }, []);

  // Save conversation history to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleStartNewChat = () => {
    if (messages.length === 0) return;
    if (window.confirm(language === 'hi' ? 'क्या आप नई बातचीत शुरू करना चाहते हैं?' : 'Start a new conversation?')) {
      setMessages([]);
      setError(null);
      setLastUserPrompt('');
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleSaveOutdoorMission = async (mission: CoachOutdoorMission, msgId: string) => {
    try {
      await saveMission({
        title: mission.title,
        objective: 'Coach recommended outdoor gardening activity',
        instructions: mission.steps,
        estimatedMinutes: mission.durationMinutes || 10,
        materials: ['Clean hands', 'Garden gloves if needed'],
        status: 'available',
      });
      setSavedMissionIds((prev) => ({ ...prev, [msgId]: true }));
    } catch (err) {
      console.error('Failed to save outdoor mission:', err);
    }
  };

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const clean = textToSend.trim();
      if (!clean || loading) return;

      const userMessageId = `user-${Date.now()}`;
      const userMessage: DisplayMessage = {
        id: userMessageId,
        role: 'user',
        content: clean,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setLoading(true);
      setError(null);
      setLastUserPrompt(clean);

      try {
        // Collect real, compact garden context
        const [plants, activeMissions, journalEntries] = await Promise.all([
          getAllPlants(),
          getAllMissions(),
          getAllJournalEntries(),
        ]);

        // Grab observations for the plants
        const plantObsPromises = plants.slice(0, 4).map((p) => getObservationsByPlant(p.id));
        const obsResults = await Promise.all(plantObsPromises);
        const flattenedObs = obsResults.flat().slice(0, 4);

        const history: ChatMessage[] = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await chatWithCoach({
          message: clean,
          conversationHistory: history,
          language: language as Language,
          gardenContext: {
            region: profile?.region,
            environment: profile?.growingEnvironment,
            experienceLevel: profile?.experienceLevel,
            plants: plants.map((p) => ({
              id: p.id,
              name: p.commonName,
              category: p.category,
              location: p.location,
              scientificName: p.scientificName,
              sunlight: p.sunlight,
              wateringPreference: p.wateringPreference,
              notes: p.notes,
            })),
            recentObservations: flattenedObs.map((o) => {
              const matchedPlant = plants.find((p) => p.id === o.plantId);
              return {
                plantName: matchedPlant?.commonName,
                date: o.date,
                symptoms: o.symptoms,
                notes: o.notes,
              };
            }),
            recentJournal: journalEntries.slice(0, 3).map((j) => ({
              plantName: j.plantName,
              date: j.date,
              notes: j.notes,
            })),
            activeMissions: activeMissions
              .filter((m) => m.status !== 'completed')
              .slice(0, 3)
              .map((m) => ({
                title: m.title,
                objective: m.objective,
                status: m.status,
              })),
          },
        });

        const assistantMessage: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          observations: response.observations,
          possibleCauses: response.possibleCauses,
          actions: response.actions,
          actionItems: response.actionItems,
          followUpQuestion: response.followUpQuestion,
          followUpSuggestions: response.followUpSuggestions,
          outdoorMission: response.outdoorMission,
          weatherNote: response.weatherNote,
          references: response.references,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to reach Garden Coach';
        setError(msg);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [loading, messages, language, profile]
  );

  const handleRetry = () => {
    if (lastUserPrompt) {
      sendMessage(lastUserPrompt);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const currentSuggestions =
    language === 'hi' ? SUGGESTIONS_HI : language === 'hinglish' ? SUGGESTIONS_HINGLISH : SUGGESTIONS_EN;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="px-4 py-3.5 bg-white border-b border-sage-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-50 border border-forest-100 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-forest-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="heading-page text-lg text-forest-800">{t.coach.title}</h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-sage-100 text-forest-700 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-forest-600" />
                {t.coach.contextAware}
              </span>
            </div>
            <p className="text-sage-500 text-xs">
              {profile?.region ? `${profile.region} · ` : ''}
              {plantCount > 0 ? `${plantCount} plant${plantCount > 1 ? 's' : ''} connected` : t.coach.subtitle}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleStartNewChat}
            className="btn-ghost text-xs py-1.5 px-2.5 text-sage-600 hover:text-sage-900 border border-sage-200"
            title={t.coach.newChat}
            aria-label={t.coach.newChat}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.coach.newChat}</span>
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* Empty State */}
        {messages.length === 0 && (
          <div className="py-8 max-w-xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-forest-50 to-sage-100 flex items-center justify-center mx-auto mb-4 border border-sage-200 shadow-sm">
              <Lightbulb className="w-7 h-7 text-forest-600" />
            </div>
            <h2 className="text-forest-900 font-serif text-xl font-semibold mb-1">{t.coach.title}</h2>
            <p className="text-sage-600 text-sm mb-6 max-w-md mx-auto">{t.coach.subtitle}</p>

            <div className="text-left mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-sage-500 mb-2">
                {t.coach.suggestions}
              </p>
              <div className="space-y-2">
                {currentSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(suggestion)}
                    className="w-full text-left bg-white border border-sage-200 hover:border-forest-400 p-3 rounded-xl text-sm text-sage-800 hover:bg-sage-50/60 transition-all shadow-xs flex items-center justify-between group"
                  >
                    <span>{suggestion}</span>
                    <Sparkles className="w-4 h-4 text-sage-300 group-hover:text-forest-500 flex-shrink-0 ml-2 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-forest-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                <Bot className="w-4.5 h-4.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3.5 shadow-xs ${
                msg.role === 'user'
                  ? 'bg-forest-600 text-white rounded-br-xs'
                  : 'bg-white border border-sage-200 rounded-bl-xs text-sage-900'
              }`}
            >
              {/* Optional Weather Note */}
              {msg.weatherNote && (
                <div className="mb-3 px-3 py-1.5 bg-blue-50/70 border border-blue-100 rounded-lg flex items-center gap-2 text-xs text-blue-800">
                  <CloudSun className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>{msg.weatherNote}</span>
                </div>
              )}

              {/* Main Content Answer */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

              {/* Observed Facts Mentioned */}
              {msg.observations && msg.observations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-sage-100 text-xs">
                  <span className="font-semibold text-sage-700 block mb-1">Observed from your garden:</span>
                  <ul className="space-y-0.5 list-disc list-inside text-sage-600">
                    {msg.observations.map((obs, idx) => (
                      <li key={idx}>{obs}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Possible Causes with Confidence Levels */}
              {msg.possibleCauses && msg.possibleCauses.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-sage-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-800 mb-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t.coach.possibleCauses}</span>
                  </div>
                  <div className="space-y-1.5">
                    {msg.possibleCauses.map((pc, idx) => (
                      <div
                        key={idx}
                        className="bg-amber-50/60 border border-amber-100 rounded-lg p-2 text-xs flex items-center justify-between"
                      >
                        <span className="font-medium text-amber-900">{pc.cause}</span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            pc.confidence === 'high'
                              ? 'bg-red-100 text-red-700'
                              : pc.confidence === 'moderate'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {pc.confidence}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prioritized Action Items */}
              {((msg.actions && msg.actions.length > 0) || (msg.actionItems && msg.actionItems.length > 0)) && (
                <div className="mt-3.5 pt-2.5 border-t border-sage-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-800 mb-2">
                    <CheckSquare className="w-3.5 h-3.5 text-forest-600" />
                    <span>{t.coach.actions}</span>
                  </div>
                  <div className="space-y-2">
                    {msg.actions && msg.actions.length > 0
                      ? msg.actions.map((act, idx) => (
                          <div
                            key={idx}
                            className="bg-sage-50/60 border border-sage-100 rounded-lg p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-forest-800">{act.title}</span>
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                  act.priority === 'high'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : act.priority === 'medium'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-sage-100 text-forest-700'
                                }`}
                              >
                                {act.priority.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sage-700 leading-normal">{act.instructions}</p>
                          </div>
                        ))
                      : msg.actionItems?.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-xs text-sage-700">
                            <span className="text-forest-600 mt-0.5">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                  </div>
                </div>
              )}

              {/* Follow-up Question Prompt */}
              {msg.followUpQuestion && (
                <div className="mt-3 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-900 block mb-0.5">Quick Question:</span>
                    <span className="text-amber-800">{msg.followUpQuestion}</span>
                  </div>
                </div>
              )}

              {/* Outdoor Mission Suggestion */}
              {msg.outdoorMission && (
                <div className="mt-3.5 p-3 bg-gradient-to-br from-olive-50 to-sage-50 border border-olive-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-olive-900">
                      <Target className="w-3.5 h-3.5 text-olive-600" />
                      <span>{t.coach.outdoorMission}</span>
                      <span className="text-[10px] text-olive-600 bg-olive-100/80 px-1.5 py-0.2 rounded-full font-normal">
                        ~{msg.outdoorMission.durationMinutes} min
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(savedMissionIds[msg.id])}
                      onClick={() => handleSaveOutdoorMission(msg.outdoorMission!, msg.id)}
                      className="text-[11px] font-medium bg-olive-700 text-white hover:bg-olive-800 disabled:opacity-60 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                    >
                      {savedMissionIds[msg.id] ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-white" />
                          <span>{t.coach.addedToMissions}</span>
                        </>
                      ) : (
                        <span>{t.coach.addToMissions}</span>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-olive-800 mb-1">{msg.outdoorMission.title}</p>
                  <ul className="space-y-0.5 list-disc list-inside text-[11px] text-olive-700">
                    {msg.outdoorMission.steps.map((st, idx) => (
                      <li key={idx}>{st}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Actions (Plant Doctor Link) */}
              {(msg.possibleCauses && msg.possibleCauses.length > 0) && (
                <div className="mt-2.5 pt-2 border-t border-sage-100 flex items-center justify-end">
                  <Link
                    to="/plant-doctor"
                    className="text-xs text-red-700 hover:text-red-800 font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>{t.coach.diagnoseInDoctor}</span>
                  </Link>
                </div>
              )}

              {/* Follow-up Question Suggestion Chips */}
              {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                <div className="mt-3 pt-2 border-t border-sage-100 flex flex-wrap gap-1.5">
                  {msg.followUpSuggestions.map((suggestion, j) => (
                    <button
                      key={j}
                      onClick={() => sendMessage(suggestion)}
                      className="text-xs bg-sage-50 hover:bg-forest-50 text-forest-800 border border-sage-200 px-2.5 py-1 rounded-full transition-colors font-medium"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div
                className={`text-[10px] mt-2 ${
                  msg.role === 'user' ? 'text-forest-200 text-right' : 'text-sage-400'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-forest-700 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                <User className="w-4.5 h-4.5" />
              </div>
            )}
          </motion.div>
        ))}

        {/* Loading Bubble */}
        {loading && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-forest-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="bg-white border border-sage-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-medium text-forest-700">
                <Loader2 className="w-4 h-4 animate-spin text-forest-600" />
                <span>{t.coach.thinking}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error Banner with Retry */}
        {error && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start justify-between gap-3 text-sm text-red-800"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs text-red-900">Communication Error</p>
                  <p className="text-xs text-red-700 mt-0.5">{error}</p>
                </div>
              </div>

              {lastUserPrompt && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors flex-shrink-0"
                >
                  {t.coach.retry}
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="px-4 py-3 bg-white border-t border-sage-200">
        <div className="flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.coach.placeholder}
            className="input-field min-h-[2.85rem] max-h-32 resize-none text-sm leading-relaxed"
            rows={1}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="btn-primary p-3 rounded-xl flex-shrink-0 disabled:opacity-50"
            aria-label={t.coach.send}
          >
            {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-4.5 h-4.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
