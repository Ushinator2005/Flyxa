import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { AppSettingsProvider } from './contexts/AppSettingsContext.js';
import { RiskProvider } from './contexts/RiskContext.js';
import { ThemeProvider } from './contexts/ThemeContext.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppSettingsProvider>
            <RiskProvider>
              <App />
            </RiskProvider>
          </AppSettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
