import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import './app/theme';
import { makeRouter } from './app/router';
import { initProgress } from './progress/store';

// Progress must be loaded before the router runs, because route guards read it.
void initProgress().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={makeRouter()} />
    </StrictMode>,
  );
});
