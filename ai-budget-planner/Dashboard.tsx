import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { PlusIcon, TrashIcon } from './components/Icons';
import { apiService } from './services/apiService';
import type { SavedPlan } from './types';

interface DashboardProps {
  plans: SavedPlan[];
  onNavigateToPlanner: (plan: SavedPlan | null) => void;
  onDeletePlan: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ plans, onNavigateToPlanner, onDeletePlan }) => {
  const { user, isAuthenticated, loginWithRedirect } = useAuth0();
  const [username, setUsername] = useState<string | null>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  useEffect(() => {
    const loadUsername = async () => {
      if (user?.sub) {
        const savedUsername = await apiService.getUsername(user.sub);
        if (savedUsername) {
          setUsername(savedUsername);
        } else {
          // First time user - show modal to ask for username
          setShowUsernameModal(true);
        }
      }
    };
    
    if (isAuthenticated && user) {
      loadUsername();
    }
  }, [isAuthenticated, user]);

  // Prevent background scroll when modal is open for full-screen takeover feel
  useEffect(() => {
    if (showUsernameModal) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showUsernameModal]);

  const handleSaveUsername = async () => {
    if (usernameInput.trim() && user?.sub) {
      await apiService.saveUsername(user.sub, usernameInput.trim());
      setUsername(usernameInput.trim());
      setShowUsernameModal(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent navigation when deleting
    if (window.confirm("Are you sure you want to delete this plan?")) {
        onDeletePlan(id);
    }
  };

  if (!isAuthenticated) {
    return (
        <div className="max-w-4xl mx-auto animate-fade-in text-center p-8 bg-card/80 backdrop-blur-sm rounded-2xl shadow-lg border">
            <h1 className="text-3xl font-bold text-card-foreground mb-4">Welcome to Your AI Budget Planner</h1>
            <p className="text-muted-foreground mb-6">Please log in to create and manage your personalized budget plans.</p>
            <button
                onClick={() => loginWithRedirect()}
                className="bg-primary text-primary-foreground font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-primary/90 transition-all duration-300 transform hover:scale-105"
            >
                Log In
            </button>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Username Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 z-50 p-4 flex items-center justify-center">
          <div className="bg-card p-8 rounded-2xl shadow-2xl max-w-md w-full border border-border">
            <h2 className="text-2xl font-bold text-card-foreground mb-4">Welcome!</h2>
            <p className="text-muted-foreground mb-6">Please choose a username for your account:</p>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveUsername()}
              placeholder="Enter your username"
              className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button
              onClick={handleSaveUsername}
              disabled={!usernameInput.trim()}
              className="w-full bg-primary text-primary-foreground font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-primary/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      <header className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-primary">Dashboard</h1>
        <p className="mt-2 text-lg text-muted-foreground">Welcome back, {username || user?.given_name || user?.name}!</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="md:col-span-2">
            <button
                onClick={() => onNavigateToPlanner(null)}
                className="w-full bg-primary text-primary-foreground font-bold py-6 px-4 rounded-2xl shadow-lg hover:bg-primary/90 disabled:opacity-50 transition-all duration-300 transform hover:scale-105 flex flex-col items-center justify-center text-center"
                >
                <PlusIcon className="w-12 h-12 mb-2" />
                <span className="text-2xl font-semibold">Create New Budget Plan</span>
                <span className="text-primary-foreground/80 mt-1">Start with a fresh plan tailored to your needs.</span>
            </button>
        </div>

        <div className="md:col-span-2 bg-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border">
            <h2 className="text-2xl font-bold text-card-foreground mb-4">My Plans</h2>
            {plans.length === 0 ? (
                <div className="text-center text-muted-foreground py-10 border-2 border-dashed border-border rounded-lg">
                    <p>You don't have any saved plans yet.</p>
                    <p className="text-sm">Create a new plan to get started!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(plan => (
                        <div
                            key={plan.id}
                            onClick={() => onNavigateToPlanner(plan)}
                            className="group flex justify-between items-center p-4 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted hover:border-primary transition-all"
                        >
                            <div>
                                <p className="font-bold text-lg text-foreground group-hover:text-primary">{plan.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    Created on {new Date(plan.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={(e) => handleDelete(e, plan.id)}
                                className="p-2 rounded-full text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-800/50 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={`Delete plan ${plan.name}`}
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
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

export default Dashboard;