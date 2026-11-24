// Turns README.md into the data the site renders.
// Runs at build time (Vite plugin) and in tests; never in the browser.
//
// README conventions (also documented in a hidden comment inside README.md):
//   ### About              paragraphs = bio, images = photos on the wall / About sphere
//   ### Education ...      #### School headings, each followed by a numbered course list;
//                          "(Current)" before a course marks it as in progress
//   ### Projects ...       numbered items: **Title** (Organization), description on the next line,
//                          optional images/videos (![alt](img/...)) and an optional line
//                          "tags: A, B · 2025"
//   ### Honors / ### Certificates   numbered items, **Title** + details
//   Links in any entry: a bare URL or [label](url) on its own line or after the images becomes
//   a link button (labelled from the site when no label is given); [label](img/....pdf|.html)
//   attaches a local document (slides, report) that the build publishes with the site.
// Phone numbers are scrubbed everywhere; contact output is email + GitHub only.

import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';

const PHONE = /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}/g;
const VIDEO = /\.(mp4|webm|mov)$/i;

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function scrub(text) {
  return text.replace(PHONE, '').replace(/(\s*\|\s*)+$/g, '').replace(/^\s*\|\s*/g, '');
}

// Remove phone numbers from every text node in place.
function scrubTree(node) {
  if (node.type === 'text') node.value = scrub(node.value);
  if (node.children) node.children.forEach(scrubTree);
}

function collect(node, type, out = []) {
  if (node.type === type) out.push(node);
  if (node.children) node.children.forEach((c) => collect(c, type, out));
  return out;
}

// <img src="…" alt="…" width="160"> in the README (compact thumbnails on GitHub).
function htmlImages(value) {
  return [...value.matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const attr = (name) => (m[0].match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')) || [])[1] || '';
    return { url: attr('src'), alt: attr('alt') };
  }).filter((i) => i.url);
}

// Images and videos inside a node, in document order: ![alt](src) and <img src>.
function media(node) {
  const out = [];
  const walk = (n) => {
    if (n.type === 'image') out.push({ url: n.url, alt: n.alt || '' });
    else if (n.type === 'html') out.push(...htmlImages(n.value));
    (n.children || []).forEach(walk);
  };
  walk(node);
  return out.map((i) => ({ src: i.url.replace(/^\.?\//, ''), alt: i.alt, kind: VIDEO.test(i.url) ? 'video' : 'image' }));
}

const plain = (n) => toString(n, { includeImageAlt: false, includeHtml: false });

// --- links and documents in an entry --------------------------------------------------------
const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g;
const DOC = /\.(pdf|html?)$/i;
// A readable label for a bare URL, from where it points.
export function linkLabel(url) {
  let u;
  try { u = new URL(url); } catch { return url; }
  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'github.com' && parts.length >= 2) return `GitHub · ${parts[1]}`;
  if (host === 'github.com') return 'GitHub';
  if (host === 'huggingface.co') return 'Hugging Face';
  if (/isca-archive|arxiv|aclanthology|openreview/.test(host) || /\.pdf$/i.test(u.pathname)) return 'Paper (PDF)';
  if (host === 'velog.io') return 'Blog post';
  if (host === 'nationalcyberscholarship.org') return 'Winners list';
  if (/notion\.(so|site|com)$/.test(host)) return 'Notion';
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'Google Drive';
  return host;
}
// Pull the links out of an entry: [label](url) nodes and bare URLs in its text.
// Local documents (img/....pdf/.html) come back separately.
function linksIn(node) {
  const links = [], docs = [], seen = new Set();
  const add = (url, label) => {
    url = url.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    if (!/^https?:/i.test(url)) {
      const src = url.replace(/^\.?\//, '');
      if (DOC.test(src)) docs.push({ src, label: label || src.split('/').pop(), kind: /\.pdf$/i.test(src) ? 'pdf' : 'html' });
      return;
    }
    links.push({ url, label: label && label !== url ? label : linkLabel(url) });
  };
  for (const l of collect(node, 'link')) add(l.url, toString(l).trim());
  for (const t of collect(node, 'text')) for (const m of t.value.matchAll(URL_RE)) add(m[0]);
  for (const h of collect(node, 'html')) for (const m of h.value.replace(/<img\b[^>]*>/gi, '').matchAll(URL_RE)) add(m[0]);
  return { links, docs };
}
// The text of an entry line with its links taken out.
function stripLinks(line, labels) {
  let out = line.replace(URL_RE, ' ');
  for (const l of labels) if (l) out = out.split(l).join(' ');
  return out.replace(/\s{2,}/g, ' ').trim();
}

// Splits the document into { name, key, nodes } by "###" headings.
function sections(tree) {
  const out = [];
  let current = { name: '_preamble', key: '_preamble', nodes: [] };
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth <= 3) {
      out.push(current);
      const name = toString(node).trim();
      current = { name, key: sectionKey(name), nodes: [] };
    } else {
      current.nodes.push(node);
    }
  }
  out.push(current);
  return out;
}

function sectionKey(name) {
  const n = name.toLowerCase();
  if (n.startsWith('about')) return 'about';
  if (n.startsWith('education') || n.includes('course')) return 'education';
  if (n.startsWith('project')) return 'projects';
  if (n.startsWith('honor') || n.startsWith('award')) return 'honors';
  if (n.startsWith('certific')) return 'certificates';
  return slugify(name);
}

// "**Title** (Org)  \n description ... tags: a, b · 2025" → structured entry
function entry(item) {
  const strong = collect(item, 'strong')[0];
  const title = strong ? toString(strong).trim() : toString(item).split('\n')[0].trim();
  const full = plain(item);
  const rest = full.slice(full.indexOf(title) + title.length);
  const labels = collect(item, 'link').map((l) => toString(l).trim());
  const lines = rest.split('\n').map((l) => stripLinks(l.trim(), labels)).filter(Boolean);

  let org = '';
  let meta = '';
  let year = '';
  if (lines.length) {
    const first = lines[0];
    const m = first.match(/^\(([^)]*)\)\s*(.*)$/);
    if (m) {
      org = m[1].trim();
      if (/^\d{4}$/.test(org)) { // "**Title** (2025)" is a year, not an organisation
        year = org;
        org = '';
      }
      if (m[2]) lines[0] = m[2];
      else lines.shift();
    } else if (/^,/.test(first)) {
      // Honors style: "**Title**, Nationwide (2022)"
      meta = first.replace(/^,\s*/, '');
      lines.shift();
    }
  }

  const { links, docs } = linksIn(item);
  let tags = [];
  const body = [];
  for (const line of lines) {
    const t = line.match(/^tags\s*:\s*(.*)$/i);
    if (t) {
      const [list, y] = t[1].split('·').map((s) => s.trim());
      tags = (list || '').split(',').map((s) => s.trim()).filter(Boolean);
      year = y || '';
    } else {
      body.push(line);
    }
  }
  if (!year) {
    const y = (org + ' ' + meta + ' ' + title).match(/\((\d{4})\)|\b(20\d{2})\b/);
    if (y) year = y[1] || y[2];
  }

  return {
    title: scrub(title),
    slug: slugify(title),
    org,
    meta,
    description: scrub(body.join(' ')),
    tags,
    year,
    media: media(item),
    links,
    docs,
  };
}

// Numbered lists in a section; images in loose paragraphs attach to the previous entry
// (so an unindented image line after a blank line still belongs to its project).
function entries(nodes) {
  const out = [];
  for (const node of nodes) {
    if (node.type === 'list') {
      for (const item of node.children) out.push(entry(item));
    } else if (out.length) {
      const extra = media(node);
      if (extra.length) out[out.length - 1].media.push(...extra);
      const more = linksIn(node);
      const last = out[out.length - 1];
      for (const l of more.links) if (!last.links.some((x) => x.url === l.url)) last.links.push(l);
      last.docs.push(...more.docs);
      const tagLine = toString(node).match(/^tags\s*:\s*(.*)$/im);
      if (tagLine) {
        const [list, y] = tagLine[1].split('·').map((s) => s.trim());
        out[out.length - 1].tags = (list || '').split(',').map((s) => s.trim()).filter(Boolean);
        if (y) out[out.length - 1].year = y;
      }
    }
  }
  return out;
}

function education(nodes) {
  const schools = [];
  let school = null;
  for (const node of nodes) {
    if (node.type === 'heading') {
      const text = toString(node).trim();
      const strong = collect(node, 'strong')[0];
      const name = strong ? toString(strong).trim() : text.split(',')[0];
      const detail = text.slice(text.indexOf(name) + name.length).replace(/^,\s*/, '').trim();
      school = { name, detail, courses: [] };
      schools.push(school);
    } else if (node.type === 'list' && school) {
      for (const item of node.children) {
        const raw = toString(item).trim();
        const current = /^\(current\)\s*/i.test(raw);
        school.courses.push({ name: raw.replace(/^\(current\)\s*/i, ''), current });
      }
    }
  }
  return schools;
}

function contact(preamble) {
  const texts = preamble.flatMap((n) => collect(n, 'text')).flatMap((t) => t.value.split(/[\s|]+/));
  const text = texts.join(' ');
  const email = texts.find((w) => /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(w)) || '';
  const links = preamble.flatMap((n) => collect(n, 'link'));
  const gh = links.find((l) => /github\.com\//i.test(l.url));
  const githubUrl = gh ? gh.url : (text.match(/https?:\/\/github\.com\/[\w-]+/i) || [])[0] || '';
  return {
    email,
    github: githubUrl ? githubUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : '',
    githubUrl,
  };
}

// --- Minimal mdast → HTML, used for the phone page ---------------------------------
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let thumbOf = (src) => src; // set per parse: uses "<name>.thumb.jpg" when it exists

function html(node) {
  const kids = () => (node.children || []).map(html).join('');
  switch (node.type) {
    case 'root': return kids();
    case 'heading': return `<h${node.depth}>${kids()}</h${node.depth}>`;
    case 'paragraph': return `<p>${kids()}</p>`;
    case 'text': return esc(node.value);
    case 'strong': return `<strong>${kids()}</strong>`;
    case 'emphasis': return `<em>${kids()}</em>`;
    case 'inlineCode': return `<code>${esc(node.value)}</code>`;
    case 'code': return `<pre><code>${esc(node.value)}</code></pre>`;
    case 'break': return '<br>';
    case 'thematicBreak': return '<hr>';
    case 'blockquote': return `<blockquote>${kids()}</blockquote>`;
    case 'link': return `<a href="${esc(node.url)}" rel="noopener">${kids()}</a>`;
    case 'image':
      return VIDEO.test(node.url)
        ? `<video src="/${esc(node.url.replace(/^\.?\//, ''))}" muted playsinline controls preload="metadata"></video>`
        : `<img src="/${esc(node.url.replace(/^\.?\//, ''))}" alt="${esc(node.alt || '')}" loading="lazy">`;
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      return `<${tag}>${kids()}</${tag}>`;
    }
    case 'listItem': return `<li>${kids()}</li>`;
    case 'html': // only <img> tags are rendered; comments and other HTML are dropped
      return htmlImages(node.value)
        .map((i) => `<img class="thumb" src="/${esc(thumbOf(i.url.replace(/^\.?\//, '')))}" alt="${esc(i.alt)}" loading="lazy">`)
        .join('');
    default: return '';
  }
}

// First-page preview of a document, written by `npm run images`: slides.pdf → slides.pdf.thumb.jpg
export const docThumb = (src) => `${src}.thumb.jpg`;

export function parseReadme(markdown, { exists = () => false } = {}) {
  const thumbPath = (src) => src.replace(/\.(jpe?g|png|webp)$/i, '.thumb.jpg');
  thumbOf = (src) => (exists(thumbPath(src)) ? thumbPath(src) : src);
  const tree = fromMarkdown(markdown);
  scrubTree(tree);
  // "# Your Name" at the top is the site owner's name.
  const h1 = tree.children.find((n) => n.type === 'heading' && n.depth === 1);
  const name = h1 ? toString(h1).trim() : '';
  if (h1) tree.children.splice(tree.children.indexOf(h1), 1);
  const parts = sections(tree);
  const by = (k) => parts.find((p) => p.key === k);

  const about = by('about');
  const bio = about
    ? about.nodes.filter((n) => n.type === 'paragraph').map((n) => plain(n).trim())
    : [];

  const data = {
    name,
    contact: contact(by('_preamble')?.nodes || []),
    about: {
      bio: bio.filter(Boolean),
      photos: about ? about.nodes.flatMap(media).filter((m) => m.kind === 'image') : [],
    },
    education: education(by('education')?.nodes || []),
    projects: entries(by('projects')?.nodes || []),
    honors: entries(by('honors')?.nodes || []),
    certificates: entries(by('certificates')?.nodes || []),
    readmeHtml: '',
  };

  // Phone page: README as-is, except the contact lines are rebuilt from the scrubbed data.
  const c = data.contact;
  const contactHtml = [
    c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`,
    c.githubUrl && `<a href="${esc(c.githubUrl)}" rel="noopener">${esc(c.github)}</a>`,
  ].filter(Boolean).join(' · ');
  const body = tree.children.filter((n) => !(by('_preamble')?.nodes || []).includes(n));
  data.readmeHtml =
    (name ? `<h1>${esc(name)}</h1>` : '') +
    `<p class="readme-contact">${contactHtml}</p>` +
    body.map(html).join('');

  // Make project slugs unique.
  const seen = new Map();
  for (const p of data.projects) {
    const n = seen.get(p.slug) || 0;
    seen.set(p.slug, n + 1);
    if (n) p.slug = `${p.slug}-${n + 1}`;
  }

  // Thumbnails for every local image, and the list of files the build must publish.
  const groups = [data.about.photos, ...[...data.projects, ...data.honors, ...data.certificates].map((e) => e.media)];
  for (const list of groups) for (const m of list) if (m.kind === 'image') m.thumb = thumbOf(m.src);
  const local = (s) => s && !/^https?:/i.test(s);
  const docs = [...data.projects, ...data.honors, ...data.certificates].flatMap((e) => e.docs);
  for (const d of docs) d.thumb = exists(docThumb(d.src)) ? docThumb(d.src) : '';
  data.mediaFiles = [
    ...new Set(
      [
        ...[...groups.flat(), ...media(tree)].flatMap((m) => [m.src, m.thumb || thumbOf(m.src)]),
        ...docs.flatMap((d) => [d.src, d.thumb]),
      ].filter(local),
    ),
  ];

  return data;
}
