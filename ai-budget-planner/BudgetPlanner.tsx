import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateBudget, geminiTextToSpeech } from './services/geminiService';
import { elevenLabsTextToSpeech } from './services/elevenLabsService';
import { decode, decodeAudioData } from './utils/audioUtils';
import type { Expense, ActiveInput, SavedPlan } from './types';
import { PlusIcon, TrashIcon, MicIcon, SpeakerIcon, LoadingIcon, StopIcon, ArrowLeftIcon, SaveIcon } from './components/Icons';

// Fix: Add minimal type definitions for Web Speech API to resolve TypeScript errors for SpeechRecognitionEvent and SpeechRecognitionErrorEvent.
interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// SpeechRecognition setup
// Fix: Use type assertion to access experimental browser APIs 'SpeechRecognition' and 'webkitSpeechRecognition' on window.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}

interface BudgetPlannerProps {
    initialPlan: SavedPlan | null;
    onNavigateToDashboard: () => void;
    onSavePlan: (plan: Omit<SavedPlan, 'id' | 'createdAt'>) => void;
    onUpdatePlan: (plan: SavedPlan) => void;
}

const geminiVoices = [
    { id: 'Kore', name: 'Kore (Balanced)' },
    { id: 'Puck', name: 'Puck (Calm)' },
    { id: 'Fenrir', name: 'Fenrir (Deep)' },
    { id: 'Zephyr', name: 'Zephyr (Warm)' },
];

const elevenLabsVoices = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    { id: '29vD33N1CtxCmqQRPO9k', name: 'Drew' },
    { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde' },
    { id: '5Q0t7uMcjvnagumLfvZi', name: 'Paul' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
];

const BudgetPlanner: React.FC<BudgetPlannerProps> = ({ initialPlan, onNavigateToDashboard, onSavePlan, onUpdatePlan }) => {
  const [income, setIncome] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: crypto.randomUUID(), category: 'Rent', amount: '1200' },
    { id: crypto.randomUUID(), category: 'Groceries', amount: '400' },
  ]);
  const [budgetPlan, setBudgetPlan] = useState<string>('');
  const [planName, setPlanName] = useState<string>('');
  const [userNotes, setUserNotes] = useState<string>('');
  const [ttsProvider, setTtsProvider] = useState<'gemini' | 'elevenlabs'>('gemini');
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState<string>(geminiVoices[0].id);
  const [selectedElevenLabsVoice, setSelectedElevenLabsVoice] = useState<string>(elevenLabsVoices[0].id);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [activeInput, setActiveInput] = useState<ActiveInput>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
      if (initialPlan) {
          setIncome(initialPlan.income);
          setExpenses(initialPlan.expenses);
          setBudgetPlan(initialPlan.planText);
          setPlanName(initialPlan.name);
          setUserNotes(initialPlan.userNotes || '');
      }
  }, [initialPlan]);

  const handleAddExpense = () => {
    setExpenses(expenses => [...expenses, { id: crypto.randomUUID(), category: '', amount: '' }]);
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses(expenses => expenses.filter(expense => expense.id !== id));
  };

  const handleExpenseChange = useCallback((id: string, field: 'category' | 'amount', value: string) => {
    setExpenses(expenses => 
      expenses.map(expense => 
        expense.id === id ? { ...expense, [field]: value } : expense
      )
    );
  }, []);
  
  const handleGenerateBudget = async () => {
    if (!income || expenses.some(e => !e.category || !e.amount)) {
      setError('Please fill in your income and all expense fields.');
      return;
    }
    setError(null);
    setIsLoading(true);
    setBudgetPlan('');
    try {
      const numericIncome = parseFloat(income);
      const numericExpenses = expenses.map(e => ({...e, amount: parseFloat(e.amount)}));
      const plan = await generateBudget(numericIncome, numericExpenses, userNotes);
      setBudgetPlan(plan);
      if (!planName) {
        const date = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
        setPlanName(`Budget for ${date}`);
      }
    } catch (err) {
      setError('Failed to generate budget. Please check your Gemini API key and try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
      if (!planName) {
          setError("Please enter a name for your plan.");
          return;
      }
      if(initialPlan) {
        onUpdatePlan({
            ...initialPlan,
            name: planName,
            income,
            expenses,
            planText: budgetPlan,
            userNotes,
        });
      } else {
        onSavePlan({
            name: planName,
            income,
            expenses,
            planText: budgetPlan,
            userNotes,
        });
      }
  };

  const togglePlayback = async () => {
    if (isSpeaking && audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current.onended = null;
      audioSourceRef.current = null;
      setIsSpeaking(false);
      return;
    }
  
    if (!budgetPlan) return;
  
    setIsSpeaking(true);
    setError(null);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      const audioContext = audioContextRef.current;
      
      let audioBuffer: AudioBuffer;

      if (ttsProvider === 'gemini') {
          const base64Audio = await geminiTextToSpeech(budgetPlan, selectedGeminiVoice);
          audioBuffer = await decodeAudioData(
            decode(base64Audio),
            audioContext,
            24000,
            1,
          );
      } else {
          const blob = await elevenLabsTextToSpeech(budgetPlan, selectedElevenLabsVoice);
          const arrayBuffer = await blob.arrayBuffer();
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      }
  
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
  
      audioSourceRef.current = source;
  
      source.onended = () => {
        setIsSpeaking(false);
        audioSourceRef.current = null;
      };
  
    } catch (err) {
      const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate audio: ${errorMessage}`);
      console.error(err);
      setIsSpeaking(false);
    }
  };

  const startListening = (target: ActiveInput) => {
    if (!recognition || isListening) return;
    setActiveInput(target);
    setIsListening(true);
    recognition.start();
  };

  const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
    const transcript = event.results[0][0].transcript;
    if (activeInput) {
      if (activeInput.type === 'income') {
        setIncome(transcript.replace(/[^0-9.]/g, ''));
      } else if (activeInput.type === 'expense') {
        const { id, field } = activeInput;
        const value = field === 'amount' ? transcript.replace(/[^0-9.]/g, '') : transcript;
        handleExpenseChange(id, field, value);
      } else if (activeInput.type === 'notes') {
        setUserNotes(transcript);
      }
    }
  }, [activeInput, handleExpenseChange]);

  useEffect(() => {
    if (!recognition) {
        setError("Speech recognition is not supported in this browser.");
        return;
    }
    
    recognition.onresult = handleRecognitionResult;
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    return () => {
        if(recognition){
            recognition.onresult = null;
            recognition.onend = null;
            recognition.onerror = null;
        }
    }
  }, [handleRecognitionResult]);
  
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="mb-6">
            <button 
                onClick={onNavigateToDashboard} 
                className="flex items-center gap-2 text-muted-foreground hover:text-primary font-semibold transition-colors"
            >
                <ArrowLeftIcon className="w-5 h-5" />
                Back to Dashboard
            </button>
        </div>

      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-primary">AI Budget Planner</h1>
        <p className="mt-2 text-lg text-muted-foreground">
            {initialPlan ? `Editing "${initialPlan.name}"` : "Generate a personalized budget with text or voice."}
        </p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card p-6 rounded-2xl shadow-lg border">
          <h2 className="text-2xl font-bold mb-6 text-card-foreground">Your Financials</h2>
          
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">{error}</div>}

          <div className="mb-6">
            <label htmlFor="income" className="block text-sm font-medium text-muted-foreground mb-1">Monthly Income ($)</label>
            <div className="relative">
              <input
                type="number"
                id="income"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="e.g., 5000"
                className="w-full pl-3 pr-10 py-2 bg-muted border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button onClick={() => startListening({ type: 'income' })} className={`absolute inset-y-0 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'income' ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-primary'}`} aria-label="Use microphone for income">
                <MicIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-3 text-card-foreground">Monthly Expenses</h3>
            <div className="space-y-4">
              {expenses.map((expense, index) => (
                <div key={expense.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 relative">
                     <input
                        type="text"
                        value={expense.category}
                        onChange={(e) => handleExpenseChange(expense.id, 'category', e.target.value)}
                        placeholder="Category"
                        className="w-full pl-3 pr-10 py-2 bg-muted border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                     />
                     <button onClick={() => startListening({ type: 'expense', id: expense.id, field: 'category' })} className={`absolute inset-y-0 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'expense' && activeInput.id === expense.id && activeInput.field === 'category' ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-primary'}`} aria-label={`Use microphone for expense category ${index + 1}`}>
                       <MicIcon className="w-5 h-5" />
                     </button>
                  </div>
                  <div className="col-span-5 relative">
                    <input
                        type="number"
                        value={expense.amount}
                        onChange={(e) => handleExpenseChange(expense.id, 'amount', e.target.value)}
                        placeholder="Amount ($)"
                        className="w-full pl-3 pr-10 py-2 bg-muted border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                     />
                     <button onClick={() => startListening({ type: 'expense', id: expense.id, field: 'amount' })} className={`absolute inset-y-0 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'expense' && activeInput.id === expense.id && activeInput.field === 'amount' ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-primary'}`} aria-label={`Use microphone for expense amount ${index + 1}`}>
                       <MicIcon className="w-5 h-5" />
                     </button>
                  </div>
                  <div className="col-span-2">
                     <button onClick={() => handleRemoveExpense(expense.id)} className="w-full flex justify-center items-center p-2 text-muted-foreground hover:text-red-600 dark:hover:text-red-500" aria-label={`Remove expense ${index + 1}`}>
                       <TrashIcon className="w-5 h-5" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleAddExpense} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-border text-muted-foreground rounded-md hover:bg-muted/80 transition-colors">
              <PlusIcon className="w-5 h-5" />
              Add Expense
            </button>
          </div>
          
          <div className="mt-6">
            <label htmlFor="user-notes" className="block text-sm font-medium text-muted-foreground mb-1">Additional Notes for AI</label>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-2">
              Tell the AI your goals, concerns, or any specific things to consider (e.g., "I'm trying to save for a vacation").
            </p>
            <div className="relative">
              <textarea
                id="user-notes"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Type your thoughts here..."
                rows={3}
                className="w-full pl-3 pr-10 py-2 bg-muted border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              />
              <button onClick={() => startListening({ type: 'notes' })} className={`absolute top-2 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'notes' ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-primary'}`} aria-label="Use microphone for notes">
                <MicIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerateBudget}
            disabled={isLoading}
            className="mt-6 w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
          >
            {isLoading && <LoadingIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />}
            {isLoading ? 'Generating...' : 'Generate Budget'}
          </button>
        </div>

        <div className="bg-card p-6 rounded-2xl shadow-lg border flex flex-col">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-card-foreground">Your AI Budget Plan</h2>
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="tts-provider" className="text-sm font-medium text-muted-foreground">Provider</label>
                    <select
                        id="tts-provider"
                        value={ttsProvider}
                        onChange={(e) => setTtsProvider(e.target.value as 'gemini' | 'elevenlabs')}
                        disabled={!budgetPlan || isLoading || isSpeaking}
                        className="bg-muted border border-border rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                    >
                        <option value="gemini">Gemini</option>
                        <option value="elevenlabs">ElevenLabs</option>
                    </select>
                </div>
                <div>
                  <label htmlFor="voice-select" className="sr-only">Select Voice</label>
                  <select
                    id="voice-select"
                    value={ttsProvider === 'gemini' ? selectedGeminiVoice : selectedElevenLabsVoice}
                    onChange={(e) => {
                      if (ttsProvider === 'gemini') {
                        setSelectedGeminiVoice(e.target.value);
                      } else {
                        setSelectedElevenLabsVoice(e.target.value);
                      }
                    }}
                    disabled={!budgetPlan || isLoading || isSpeaking}
                    className="bg-muted border border-border rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {(ttsProvider === 'gemini' ? geminiVoices : elevenLabsVoices).map(voice => (
                      <option key={voice.id} value={voice.id}>{voice.name}</option>
                    ))}
                  </select>
                </div>
              </div>
          </div>
          <div className='mb-6'>
            <button onClick={togglePlayback} disabled={!budgetPlan || isLoading} className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {isSpeaking ? <StopIcon className="w-5 h-5" /> : <SpeakerIcon className="w-5 h-5" />}
                <span>{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</span>
            </button>
          </div>
          
          <div className="prose prose-slate dark:prose-invert max-w-none flex-grow overflow-y-auto p-1 rounded-md">
            {isLoading && (
              <div className="flex justify-center items-center h-full">
                <LoadingIcon className="w-10 h-10 text-primary animate-spin" />
              </div>
            )}
            {!isLoading && !budgetPlan && (
              <div className="text-center text-muted-foreground h-full flex items-center justify-center">
                <p>Your personalized budget plan will appear here once generated.</p>
              </div>
            )}
            {budgetPlan && <div dangerouslySetInnerHTML={{ __html: budgetPlan.replace(/\n/g, '<br/>') }} />}
          </div>
          {budgetPlan && !isLoading && (
              <div className="mt-6 pt-6 border-t border-border">
                <label htmlFor="planName" className="block text-sm font-medium text-muted-foreground mb-1">Plan Name</label>
                  <div className="flex gap-4">
                      <input
                          type="text"
                          id="planName"
                          value={planName}
                          onChange={(e) => setPlanName(e.target.value)}
                          placeholder="e.g., Budget for August"
                          className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      <button 
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                          <SaveIcon className="w-5 h-5"/>
                          <span>{initialPlan ? 'Update Plan' : 'Save Plan'}</span>
                      </button>
                  </div>
              </div>
          )}
        </div>
      </main>
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default BudgetPlanner;