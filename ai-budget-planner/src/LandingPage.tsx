import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const LandingPage: React.FC = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="relative min-h-screen bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=2511&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')" }}>
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 space-y-8 bg-white bg-opacity-20 backdrop-filter backdrop-blur-lg rounded-2xl shadow-lg">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-white">AI Budget Planner</h1>
            <p className="mt-2 text-lg text-gray-200">Your personal financial assistant.</p>
          </div>
          <div className="space-y-6">
            <div>
              <button
                onClick={() => loginWithRedirect()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500"
              >
                Sign In or Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
