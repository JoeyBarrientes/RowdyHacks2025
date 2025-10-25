import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateBudget } from './services/geminiService';
import { elevenLabsTextToSpeech } from './services/elevenLabsService';
import type { Expense, ActiveInput } from './types';
import { PlusIcon, TrashIcon, MicIcon, SpeakerIcon, LoadingIcon, StopIcon } from './components/Icons';

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

const App: React.FC = () => {
  const [income, setIncome] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: crypto.randomUUID(), category: 'Rent', amount: '1200' },
    { id: crypto.randomUUID(), category: 'Groceries', amount: '400' },
  ]);
  const [budgetPlan, setBudgetPlan] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [activeInput, setActiveInput] = useState<ActiveInput>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleAddExpense = () => {
    // Fix: Use functional update for setExpenses to avoid dependency on `expenses` state.
    setExpenses(expenses => [...expenses, { id: crypto.randomUUID(), category: '', amount: '' }]);
  };

  const handleRemoveExpense = (id: string) => {
    // Fix: Use functional update for setExpenses to avoid dependency on `expenses` state.
    setExpenses(expenses => expenses.filter(expense => expense.id !== id));
  };

  // Fix: Use functional update for setExpenses and wrap in useCallback for stable reference.
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
      const plan = await generateBudget(numericIncome, numericExpenses);
      setBudgetPlan(plan);
    // Fix: Corrected syntax for the catch block by removing the arrow '=>'. This was causing all subsequent scope errors.
    } catch (err) {
      setError('Failed to generate budget. Please check your Gemini API key and try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayback = async () => {
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
      return;
    }

    if (!budgetPlan) return;
    
    setIsSpeaking(true);
    setError(null);
    try {
      const audioBlob = await elevenLabsTextToSpeech(budgetPlan);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setError('Failed to play audio.');
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError('Failed to generate audio. Please check that the ElevenLabs API key is configured correctly in the code.');
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

  // Fix: Added `handleExpenseChange` to the dependency array of useCallback.
  const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
    const transcript = event.results[0][0].transcript;
    if (activeInput) {
      if (activeInput.type === 'income') {
        setIncome(transcript.replace(/[^0-9.]/g, ''));
      } else if (activeInput.type === 'expense') {
        const { id, field } = activeInput;
        const value = field === 'amount' ? transcript.replace(/[^0-9.]/g, '') : transcript;
        handleExpenseChange(id, field, value);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-sky-600 dark:text-sky-400">AI Budget Planner</h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">Generate a personalized budget using AI with text or voice.</p>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold mb-6 text-slate-700 dark:text-slate-200">Your Financials</h2>
            
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">{error}</div>}

            <div className="mb-6">
              <label htmlFor="income" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Monthly Income ($)</label>
              <div className="relative">
                <input
                  type="number"
                  id="income"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="e.g., 5000"
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <button onClick={() => startListening({ type: 'income' })} className={`absolute inset-y-0 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'income' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-sky-500'}`} aria-label="Use microphone for income">
                  <MicIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-3 text-slate-700 dark:text-slate-200">Monthly Expenses</h3>
              <div className="space-y-4">
                {expenses.map((expense, index) => (
                  <div key={expense.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 relative">
                       <input
                          type="text"
                          value={expense.category}
                          onChange={(e) => handleExpenseChange(expense.id, 'category', e.target.value)}
                          placeholder="Category"
                          className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                       />
                       <button onClick={() => startListening({ type: 'expense', id: expense.id, field: 'category' })} className={`absolute inset-y-0 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'expense' && activeInput.id === expense.id && activeInput.field === 'category' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-sky-500'}`} aria-label={`Use microphone for expense category ${index + 1}`}>
                         <MicIcon className="w-5 h-5" />
                       </button>
                    </div>
                    <div className="col-span-5 relative">
                      <input
                          type="number"
                          value={expense.amount}
                          onChange={(e) => handleExpenseChange(expense.id, 'amount', e.target.value)}
                          placeholder="Amount ($)"
                          className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                       />
                       <button onClick={() => startListening({ type: 'expense', id: expense.id, field: 'amount' })} className={`absolute inset-y-0 right-0 px-3 flex items-center rounded-r-md ${isListening && activeInput?.type === 'expense' && activeInput.id === expense.id && activeInput.field === 'amount' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-sky-500'}`} aria-label={`Use microphone for expense amount ${index + 1}`}>
                         <MicIcon className="w-5 h-5" />
                       </button>
                    </div>
                    <div className="col-span-2">
                       <button onClick={() => handleRemoveExpense(expense.id)} className="w-full flex justify-center items-center p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-500" aria-label={`Remove expense ${index + 1}`}>
                         <TrashIcon className="w-5 h-5" />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleAddExpense} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-400 text-slate-600 dark:text-slate-400 dark:border-slate-500 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <PlusIcon className="w-5 h-5" />
                Add Expense
              </button>
            </div>
            
            <button
              onClick={handleGenerateBudget}
              disabled={isLoading}
              className="mt-8 w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-700 disabled:bg-sky-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
            >
              {isLoading && <LoadingIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />}
              {isLoading ? 'Generating...' : 'Generate Budget'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">Your AI Budget Plan</h2>
                <button onClick={togglePlayback} disabled={!budgetPlan || isLoading} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {isSpeaking ? <StopIcon className="w-5 h-5" /> : <SpeakerIcon className="w-5 h-5" />}
                    {isSpeaking ? 'Stop Reading' : 'Read Aloud'}
                </button>
            </div>
            
            <div className="prose prose-slate dark:prose-invert max-w-none h-[calc(100%-4rem)] overflow-y-auto p-1 rounded-md">
              {isLoading && (
                <div className="flex justify-center items-center h-full">
                  <LoadingIcon className="w-10 h-10 text-sky-500 animate-spin" />
                </div>
              )}
              {!isLoading && !budgetPlan && (
                <div className="text-center text-slate-500 dark:text-slate-400 h-full flex items-center justify-center">
                  <p>Your personalized budget plan will appear here once generated.</p>
                </div>
              )}
              {budgetPlan && <div dangerouslySetInnerHTML={{ __html: budgetPlan.replace(/\n/g, '<br/>') }} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;