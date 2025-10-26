import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Dashboard from './Dashboard';
import BudgetPlanner from './BudgetPlanner';
import ThemeToggle from './components/ThemeToggle';
import { apiService } from './services/apiService';
import type { SavedPlan } from './types';
import { LoadingIcon } from './components/Icons';

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
    const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
    const [currentPlan, setCurrentPlan] = useState<SavedPlan | null>(null);

    useEffect(() => {
        const loadPlans = async () => {
            if (isAuthenticated && user?.sub) {
                const plans = await apiService.getPlans(user.sub);
                setSavedPlans(plans);
            } else {
                setSavedPlans([]);
            }
        };
        if (!isLoading) {
            loadPlans();
        }
    }, [isAuthenticated, user, isLoading]);

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

    const handleSavePlan = async (plan: Omit<SavedPlan, 'id' | 'createdAt'>) => {
        if (!user?.sub) return;
        const newPlan: SavedPlan = {
            ...plan,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };
        const updatedPlans = await apiService.savePlan(user.sub, newPlan);
        setSavedPlans(updatedPlans);
        navigateToDashboard();
    };

    const handleUpdatePlan = async (updatedPlan: SavedPlan) => {
        if (!user?.sub) return;
        const updatedPlans = await apiService.updatePlan(user.sub, updatedPlan);
        setSavedPlans(updatedPlans);
        navigateToDashboard();
    };

    const handleDeletePlan = async (id: string) => {
        if (!user?.sub) return;
        const updatedPlans = await apiService.deletePlan(user.sub, id);
        setSavedPlans(updatedPlans);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <LoadingIcon className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }


    return (
        <div className="min-h-screen text-foreground font-sans p-4 sm:p-6 lg:p-8 relative">
            {/* Animated Background */}
            <div 
                className="fixed inset-0 -z-10 transition-opacity duration-1000 ease-in-out"
                style={{
                    backgroundImage: `url(${theme === 'dark' ? '/night_background.png' : '/day_background.png'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    opacity: theme === 'dark' ? 0.3 : 0.5
                }}
            />
            
            <div className="fixed inset-0 -z-20 bg-background" />
            
            <header className="flex justify-between items-start mb-24 sm:mb-28 relative pb-14">
                {isAuthenticated && user ? (
                    <div ref={dropdownRef} className="relative">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="block rounded-full transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                            <img
                                src={user.picture}
                                alt={user.name || 'User Profile'}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute left-0 mt-2 w-64 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-xl z-10">
                                <div className="p-4 border-b border-border">
                                    <p className="font-bold text-lg text-foreground">{user.name}</p>
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                                <button
                                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                                    className="w-full text-left px-4 py-3 text-red-500 hover:bg-muted/50 transition-colors"
                                >
                                    Log Out
                                </button>
                            </div>
                        )}
                    </div>
                ) : <div className="w-10 h-10"></div>}
                
                {/* Logo */}
                <div className="absolute left-1/2 transform -translate-x-1/2 mt-30">
                    <img 
                        src="/Cowboy-cash-logo.png" 
                        alt="Cowboy Cash Logo" 
                        className="h-40 sm:h-52 w-auto"
                    />
                </div>
                <br></br>
                
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