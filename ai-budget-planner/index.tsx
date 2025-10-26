
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';
import LandingPage from './src/LandingPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain="dev-qgl4efnazhfyumes.us.auth0.com"
      clientId="maGVE9TGZSH4KFrarZ8f3ovQqRwAzrXi"
      authorizationParams={{
        // Use hash-based routing to avoid server 404s on refresh
        redirect_uri: window.location.origin + '/#/dashboard'
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<App />} />
          {/* Fallback: send unknown routes to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </Auth0Provider>
  </React.StrictMode>
);
