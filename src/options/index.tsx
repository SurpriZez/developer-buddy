import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../styles/globals.css';
import { bootstrapTheme } from '../shared/theme/useTheme';

bootstrapTheme().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
