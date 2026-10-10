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

// Sky lab easter egg: fetch its code only the first time it is opened.
const lab = document.getElementById('sky-lab');
if (lab) {
  const version = new URL(import.meta.url).search;
  lab.addEventListener('toggle', () => {
    if (!lab.open || lab.dataset.ready) return;
    lab.dataset.ready = '1';
    import('./skylab.js' + version).then((m) => m.mountSkyLab(lab));
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
