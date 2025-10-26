import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateBudget } from './services/geminiService';
import { generateSpeechStream } from './services/elevenLabsService';
import type { Expense, ActiveInput, SavedPlan } from './types';
import { PlusIcon, TrashIcon, MicIcon, SpeakerIcon, LoadingIcon, StopIcon, ArrowLeftIcon, SaveIcon } from './components/Icons';

// Minimal type definitions for Web Speech API
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

// Define the SpeechRecognition interface for type safety
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}


interface BudgetPlannerProps {
    initialPlan: SavedPlan | null;
    onNavigateToDashboard: () => void;
    onSavePlan: (plan: Omit<SavedPlan, 'id' | 'createdAt'>) => void;
    onUpdatePlan: (plan: SavedPlan) => void;
}

const elevenLabsVoices = [
    { id: 'aOcS60CY8CoaVaZfqqb5', name: 'John' },
    { id: '4YYIPFl9wE5c4L2eu2Gb', name: 'Burt' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
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
  const [selectedVoice, setSelectedVoice] = useState<string>(elevenLabsVoices[0].id);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [activeInput, setActiveInput] = useState<ActiveInput>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const streamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const isAppendingRef = useRef(false);
  const audioQueue = useRef<Uint8Array[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
      const numericExpenses = expenses.map(e => ({...e, amount: parseFloat(e.amount)})).filter(e => !isNaN(e.amount));
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
  
  const stopPlayback = useCallback(async () => {
      if (streamReaderRef.current) {
          try {
              await streamReaderRef.current.cancel();
          } catch(e) {
              console.warn("Error cancelling stream reader:", e);
          }
          streamReaderRef.current = null;
      }

      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
      }
      if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
          try {
             if(sourceBufferRef.current && mediaSourceRef.current.sourceBuffers.length > 0) mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
             mediaSourceRef.current.endOfStream();
          } catch(e) {
             console.warn("Error ending MediaSource stream:", e);
          }
      }
      
      mediaSourceRef.current = null;
      sourceBufferRef.current = null;
      audioQueue.current = [];
      isAppendingRef.current = false;
      setIsSpeaking(false);
  }, []);

  const togglePlayback = async () => {
    if (isSpeaking) {
        stopPlayback();
        return;
    }

    if (!budgetPlan) return;

    setIsSpeaking(true);
    setError(null);
    audioQueue.current = [];
    isAppendingRef.current = false;

    if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.onended = () => {
            stopPlayback();
        };
    }

    try {
        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;
        audioRef.current.src = URL.createObjectURL(mediaSource);

        mediaSource.addEventListener('sourceopen', async () => {
            if (!audioRef.current) {
                console.error("Audio element was not available.");
                stopPlayback();
                return;
            }
            URL.revokeObjectURL(audioRef.current.src);
            const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
            sourceBufferRef.current = sourceBuffer;

            const processQueue = () => {
                if (!isAppendingRef.current && audioQueue.current.length > 0) {
                    const chunk = audioQueue.current.shift();
                    if (chunk) {
                        isAppendingRef.current = true;
            try {
              // Copy into a fresh ArrayBuffer to ensure the type is ArrayBuffer (not SharedArrayBuffer)
              const ab = new ArrayBuffer(chunk.byteLength);
              new Uint8Array(ab).set(chunk);
              sourceBuffer.appendBuffer(ab);
            } catch (e) {
                            console.error('Error appending buffer:', e);
                            audioQueue.current.unshift(chunk); // retry
                            isAppendingRef.current = false;
                        }
                    }
                }
            };
            
            sourceBuffer.addEventListener('updateend', () => {
                isAppendingRef.current = false;
                processQueue();
            });

            try {
                const response = await generateSpeechStream(budgetPlan, selectedVoice);

                if (!response.body) {
                    throw new Error("Response body is not available for streaming.");
                }
                streamReaderRef.current = response.body.getReader();

                audioRef.current.play().catch(e => {
                    console.error("Audio playback failed:", e);
                    setError("Audio playback failed. Please interact with the page and try again.");
                    stopPlayback();
                });

                while (true) {
                    const { done, value } = await streamReaderRef.current.read();
                    if (done) {
                        const checkEndOfStream = () => {
                            if (!isAppendingRef.current && mediaSource.readyState === 'open') {
                                try {
                                   if (!sourceBuffer.updating) mediaSource.endOfStream();
                                   else setTimeout(checkEndOfStream, 100);
                                } catch (e) {
                                    console.warn("Error ending MediaSource stream:", e);
                                }
                            } else if (mediaSource.readyState === 'open') {
                                setTimeout(checkEndOfStream, 100);
                            }
                        };
                        checkEndOfStream();
                        break;
                    }
                    if (value) {
                      audioQueue.current.push(value);
                    }
                    if (!isAppendingRef.current) {
                        processQueue();
                    }
                }
            } catch (err) {
                const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred.';
                setError(`Failed to play audio: ${errorMessage}`);
                console.error(err);
                stopPlayback();
            }
        });
    } catch (err) {
        const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred.';
        setError(`Failed to set up audio playback: ${errorMessage}`);
        console.error(err);
        stopPlayback();
    }
  };
  
  useEffect(() => {
    return () => {
        stopPlayback();
    };
  }, [stopPlayback]);

  // Lazily get or create the speech recognition instance
  const getRecognition = () => {
    if (!recognitionRef.current) {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognitionAPI) {
            const instance: SpeechRecognition = new SpeechRecognitionAPI();
            instance.continuous = false;
            instance.lang = 'en-US';
            instance.interimResults = false;
            instance.maxAlternatives = 1;
            recognitionRef.current = instance;
        }
    }
    return recognitionRef.current;
  };

  const startListening = (target: ActiveInput) => {
    const recognition = getRecognition();
    if (!recognition) {
        setError("Speech recognition is not supported in this browser.");
        return;
    }
    if (isListening) {
        recognition.stop();
        return;
    }
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
        const value = field === 'amount' ? transcript.match(/(\d+(\.\d+)?)/)?.[0] || '' : transcript;
        handleExpenseChange(id, field, value);
      } else if (activeInput.type === 'notes') {
        setUserNotes(prev => (prev ? prev + ' ' : '') + transcript);
      }
    }
  }, [activeInput, handleExpenseChange]);

  useEffect(() => {
    const recognition = getRecognition();
    if (!recognition) return;

    const handleResult = (event: Event) => handleRecognitionResult(event as SpeechRecognitionEvent);
    const handleError = (event: Event) => {
      const errorEvent = event as SpeechRecognitionErrorEvent;
      console.error('Speech recognition error', errorEvent.error);
      setError(`Speech recognition error: ${errorEvent.error}`);
      setIsListening(false);
    };
    const handleEnd = () => setIsListening(false);
    
    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('error', handleError);
    recognition.addEventListener('end', handleEnd);

    return () => {
        recognition.removeEventListener('result', handleResult);
        recognition.removeEventListener('error', handleError);
        recognition.removeEventListener('end', handleEnd);
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
                      <button onClick={() => startListening({ type: 'expense', id: expense.id, field: 'category' })} className={`absolute inset-y-0 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'expense' && activeInput.id === expense.id && activeInput.field === 'category' ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-primary'}`} aria-label={`Use microphone for category of expense ${index + 1}`}>
                          <MicIcon className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="col-span-5 relative">
                      <input
                        type="number"
                        value={expense.amount}
                        onChange={(e) => handleExpenseChange(expense.id, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="w-full pl-3 pr-10 py-2 bg-muted border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      <button onClick={() => startListening({ type: 'expense', id: expense.id, field: 'amount' })} className={`absolute inset-y-0 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'expense' && activeInput.id === expense.id && activeInput.field === 'amount' ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-primary'}`} aria-label={`Use microphone for amount of expense ${index + 1}`}>
                          <MicIcon className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button onClick={() => handleRemoveExpense(expense.id)} className="p-2 rounded-full text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-800/50 dark:hover:text-red-400" aria-label={`Remove expense ${index + 1}`}>
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleAddExpense} className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80">
              <PlusIcon className="w-4 h-4" />
              Add Expense
            </button>
          </div>
           <div className="mt-6">
                <label htmlFor="user-notes" className="block text-sm font-medium text-muted-foreground mb-1">Additional Notes</label>
                <div className="relative">
                    <textarea
                        id="user-notes"
                        value={userNotes}
                        onChange={(e) => setUserNotes(e.target.value)}
                        placeholder="e.g., I'm saving for a vacation, I want to reduce my dining out expenses."
                        rows={3}
                        className="w-full pl-3 pr-10 py-2 bg-muted border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <button onClick={() => startListening({ type: 'notes' })} className={`absolute top-2 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'notes' ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-primary'}`} aria-label="Use microphone for notes">
                        <MicIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>

        <div className="bg-card p-6 rounded-2xl shadow-lg border flex flex-col">
          <h2 className="text-2xl font-bold mb-4 text-card-foreground">Generated Plan</h2>
          
          <div className="flex-grow mb-4">
            <button
                onClick={handleGenerateBudget}
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-md shadow hover:bg-primary/90 disabled:opacity-50 transition-all mb-4 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                    <>
                        <LoadingIcon className="w-5 h-5 animate-spin" />
                        Generating...
                    </>
                ) : 'Generate Budget Plan'}
            </button>
            <div className="bg-muted p-4 rounded-lg min-h-[200px] text-muted-foreground whitespace-pre-wrap font-sans">
              {budgetPlan || 'Your personalized budget plan will appear here.'}
            </div>
          </div>
          
          <div className="mt-auto">
            <div className="flex items-center gap-4 mb-4">
                <label htmlFor="voice-select" className="text-sm font-medium text-muted-foreground">Voice:</label>
                <select 
                    id="voice-select"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    disabled={isSpeaking}
                    className="flex-grow bg-muted border border-border rounded-md py-1 px-2 focus:ring-2 focus:ring-primary focus:border-primary"
                >
                    {elevenLabsVoices.map(voice => (
                        <option key={voice.id} value={voice.id}>{voice.name}</option>
                    ))}
                </select>
                <button
                    onClick={togglePlayback}
                    disabled={!budgetPlan || isLoading}
                    className="p-3 rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition-all"
                    aria-label={isSpeaking ? "Stop reading plan" : "Read plan aloud"}
                >
                    {isSpeaking ? <StopIcon className="w-6 h-6" /> : <SpeakerIcon className="w-6 h-6" />}
                </button>
            </div>
            <div>
                 <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="Enter a name for this plan"
                    className="w-full mb-2 pl-3 py-2 bg-muted border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                 />
                 <button 
                    onClick={handleSave}
                    disabled={!budgetPlan || !planName}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-4 rounded-md shadow hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                    <SaveIcon className="w-5 h-5" />
                    {initialPlan ? 'Update Plan' : 'Save Plan'}
                </button>
            </div>
          </div>
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
        .animate-pulse {
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default BudgetPlanner;