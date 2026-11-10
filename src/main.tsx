import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GameProvider } from './state/GameContext';
import './styles/global.css';
import './styles/game.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Das Wurzelelement #root wurde nicht gefunden.');
}

createRoot(container).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>
);
