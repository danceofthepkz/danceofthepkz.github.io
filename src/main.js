import { Site } from './scene.js';

const q = new URLSearchParams(location.search);

const site = new Site({
  companion: ['light', 'bird', 'traveler'].indexOf(q.get('companion')) >= 0 ? q.get('companion') : 'light',
  theme: ['day', 'night'].indexOf(q.get('theme')) >= 0 ? q.get('theme') : 'auto'
});

const start = () => {
  site.applyMode();
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', () => site.renderVals().toggle());
  site.componentDidMount();
  // Stop drawing entirely while the tab is hidden; resume with a fresh clock.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) site.stop();
    else site.start();
  });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
