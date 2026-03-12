import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../styles/globals.css';

document.documentElement.setAttribute('data-theme', 'dark');

createRoot(document.getElementById('root')!).render(<App />);
