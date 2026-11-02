import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './3/App.jsx';
import './3/styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
