// /resume/print: the resume as a plain document, opened in its own tab from the resume
// sheet. It opens the browser's print dialog, where "Save as PDF" is one of the printers.
import { resumeBody } from './views.js';

export function renderPrint(content) {
  document.title = `${content.name || 'Resume'}: Resume`;
  document.body.classList.add('is-print');
  for (const sel of ['#gl', '.nav', '.page-title', '#labels', '.hint', '#intro']) {
    document.querySelector(sel)?.remove();
  }
  const page = document.createElement('article');
  page.className = 'resume resume-print paper-sheet';
  page.innerHTML = `<p class="print-bar"><button type="button">Print / Save as PDF</button></p>${resumeBody(content, { photos: false })}`;
  page.querySelector('.print-bar button').addEventListener('click', () => print());
  document.getElementById('view').replaceWith(page);
  if (!/[?&]noprint/.test(location.search)) document.fonts.ready.then(() => setTimeout(() => print(), 300));
}
