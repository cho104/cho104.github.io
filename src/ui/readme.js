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

document.addEventListener('click', async (e) => {
  const a = e.target.closest?.('a[href^="mailto:"]');
  if (!a || !document.body.classList.contains('is-readme')) return;
  e.preventDefault();
  const email = a.getAttribute('href').slice(7);
  try {
    await navigator.clipboard.writeText(email);
  } catch {
    location.href = a.href;
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
