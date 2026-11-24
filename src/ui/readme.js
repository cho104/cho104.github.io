// The phone page: README.md rendered as a styled page (no 3D). Contact lines are rebuilt
// from parsed data at build time, so the phone number never appears.
export function renderReadme(content) {
  document.body.classList.add('is-readme');
  for (const sel of ['#gl', '.nav', '.page-title', '#labels', '.hint', '#intro']) {
    document.querySelector(sel)?.remove();
  }
  const article = document.createElement('article');
  article.className = 'readme';
  article.innerHTML = content.readmeHtml;
  document.getElementById('view').replaceWith(article);
}

// Email copies instead of opening a mail app (same as the desktop Contact page).
document.addEventListener('click', async (e) => {
  const a = e.target.closest?.('a[href^="mailto:"]');
  if (!a || !document.body.classList.contains('is-readme')) return;
  e.preventDefault();
  const email = a.getAttribute('href').slice(7);
  try {
    await navigator.clipboard.writeText(email);
  } catch {
    return;
  }
  const s = document.createElement('div');
  s.className = 'splash splash-css';
  s.setAttribute('role', 'status');
  s.innerHTML = '<span class="word">copied!</span><span class="small"></span>';
  s.querySelector('.small').textContent = email;
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 1600);
});
