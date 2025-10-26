import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import BudgetPlanner from './BudgetPlanner';
import ThemeToggle from './components/ThemeToggle';
import { UserIcon } from './components/Icons';
import type { SavedPlan } from './types';

type Page = 'dashboard' | 'planner';
type Theme = 'light' | 'dark';

const getInitialTheme = (): Theme => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const storedPrefs = window.localStorage.getItem('theme');
        if (typeof storedPrefs === 'string' && (storedPrefs === 'light' || storedPrefs === 'dark')) {
            return storedPrefs;
        }
        const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
        if (userMedia.matches) {
            return 'dark';
        }
    }
    return 'light';
};


const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [theme, setTheme] = useState<Theme>(getInitialTheme);
    const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
        try {
            const item = window.localStorage.getItem('budget-plans');
            return item ? JSON.parse(item) : [];
        } catch (error) {
            console.error("Error reading from localStorage", error);
            return [];
        }
    });
    const [currentPlan, setCurrentPlan] = useState<SavedPlan | null>(null);

    useEffect(() => {
        try {
            window.localStorage.setItem('budget-plans', JSON.stringify(savedPlans));
        } catch (error) {
            console.error("Error writing to localStorage", error);
        }
    }, [savedPlans]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'dark' ? 'light' : 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    const navigateToPlanner = (plan: SavedPlan | null) => {
        setCurrentPlan(plan);
        setCurrentPage('planner');
    };

    const navigateToDashboard = () => {
        setCurrentPlan(null);
        setCurrentPage('dashboard');
    };

    const handleSavePlan = (plan: Omit<SavedPlan, 'id' | 'createdAt'>) => {
        const newPlan: SavedPlan = {
            ...plan,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };
        setSavedPlans(prevPlans => [...prevPlans, newPlan]);
        navigateToDashboard();
    };

    const handleUpdatePlan = (updatedPlan: SavedPlan) => {
        setSavedPlans(prevPlans => 
            prevPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
        );
        navigateToDashboard();
    };



    const handleDeletePlan = (id: string) => {
        setSavedPlans(prevPlans => prevPlans.filter(plan => plan.id !== id));
    };


    return (
        <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-8 sm:mb-12">
                <div className="p-2 rounded-full bg-muted text-muted-foreground cursor-pointer">
                    <UserIcon className="w-6 h-6" />
                </div>
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            </header>
            <main>
                {currentPage === 'dashboard' && (
                    <Dashboard 
                        plans={savedPlans} 
                        onNavigateToPlanner={navigateToPlanner}
                        onDeletePlan={handleDeletePlan}
                    />
                )}
                {currentPage === 'planner' && (
                    <BudgetPlanner 
                        initialPlan={currentPlan}
                        onNavigateToDashboard={navigateToDashboard} 
                        onSavePlan={handleSavePlan}
                        onUpdatePlan={handleUpdatePlan}
                    />
                )}
            </main>
        </div>
    );
};

export default App;