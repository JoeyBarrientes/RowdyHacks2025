import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Dashboard from './Dashboard';
import BudgetPlanner from './BudgetPlanner';
import ThemeToggle from './components/ThemeToggle';
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
    const { user, logout, isAuthenticated, isLoading } = useAuth0();
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [theme, setTheme] = useState<Theme>(getInitialTheme);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

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

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }


    return (
        <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-8 sm:mb-12">
                {/* Profile Icon & Dropdown */}
                {isAuthenticated && user && (
                    <div ref={dropdownRef} className="relative">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="block rounded-full transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                            <img
                                src={user.picture}
                                alt={user.name || 'User Profile'}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-xl z-10">
                                <div className="p-4 border-b border-border">
                                    <p className="font-bold text-lg text-foreground">{user.name}</p>
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                                <button
                                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                                    className="w-full text-left px-4 py-3 text-red-500 hover:bg-muted transition-colors"
                                >
                                    Log Out
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex-grow"></div> {/* This will push the theme toggle to the right */}
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