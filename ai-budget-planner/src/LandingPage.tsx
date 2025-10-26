import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const LandingPage: React.FC = () => {
  const { loginWithRedirect, isLoading } = useAuth0();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-2xl animate-fade-in">
        <h1 className="text-5xl sm:text-7xl font-extrabold text-primary mb-4">
          AI Budget Planner
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-8">
          Take control of your finances with intelligent, personalized budget plans.
          Use your voice or text to input your details and let our AI create a plan tailored just for you.
        </p>
        <button
          onClick={() => loginWithRedirect()}
          disabled={isLoading}
          className="bg-primary text-primary-foreground font-bold py-4 px-8 rounded-lg shadow-lg text-xl hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Log In & Get Started'}
        </button>
      </div>
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

export default LandingPage;
