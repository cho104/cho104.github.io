import '@fontsource/reenie-beanie';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import './styles.css';
import content from 'virtual:content';
import { renderReadme } from './ui/readme.js';

document.title = content.name ? `${content.name}: Portfolio` : 'Portfolio';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Phones (and browsers without WebGL) get the README as a page; desktops get the desk.
const phone =
  matchMedia('(max-width: 760px)').matches ||
  matchMedia('(pointer: coarse) and (max-width: 1100px)').matches;

const path = location.pathname.replace(/\/$/, '');
if (path === '/resume/print') {
  import('./ui/print.js').then(({ renderPrint }) => renderPrint(content));
} else if (phone || !hasWebGL() || path === '/readme') {
  renderReadme(content);
} else {
  import('./app.js').then(({ start }) => start(content));
}
