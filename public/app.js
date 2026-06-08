/* Policy Monitoring frontend.
 *
 * Fetches the scraped feed from the read endpoint (served by the
 * `policy-monitoring` Netlify Function backed by Netlify Blobs) and renders it.
 * On Netlify the API is same-origin at /api/policy-monitoring. For local
 * development you can point at a deployed site by adding ?api=<url> to the URL.
 */

const API_DEFAULT = '/api/policy-monitoring';
const apiOverride = new URLSearchParams(location.search).get('api');
const API_URL = apiOverride || API_DEFAULT;

const els = {
  status: document.getElementById('status'),
  feed: document.getElementById('feed'),
  empty: document.getElementById('empty'),
  meta: document.getElementById('meta'),
  search: document.getElementById('search'),
  sourceFilter: document.getElementById('source-filter'),
  refresh: document.getElementById('refresh'),
  themeToggle: document.getElementById('theme-toggle'),
};

let allItems = [];

/* ---------- theme ---------- */
const THEME_KEY = 'pm-theme';
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) applyTheme(savedTheme);
els.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = current === 'dark' || (current === 'auto' && prefersDark);
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

/* ---------- helpers ---------- */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // non-ISO date string, show raw
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, s] of units) {
    const v = Math.floor(secs / s);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/* ---------- rendering ---------- */
function showStatus(message, isError = false) {
  els.status.hidden = false;
  els.status.classList.toggle('error', isError);
  els.status.querySelector('p').textContent = message;
  els.feed.hidden = true;
  els.empty.hidden = true;
}

function populateSourceFilter(items) {
  const sources = [...new Set(items.map((i) => i.sourceId).filter(Boolean))].sort();
  const current = els.sourceFilter.value;
  els.sourceFilter.innerHTML = '<option value="">All sources</option>' +
    sources.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  if (sources.includes(current)) els.sourceFilter.value = current;
}

function renderItems(items) {
  if (!items.length) {
    els.feed.hidden = true;
    els.empty.hidden = false;
    els.status.hidden = true;
    return;
  }
  els.empty.hidden = true;
  els.status.hidden = true;
  els.feed.hidden = false;
  els.feed.innerHTML = items.map((item) => {
    const title = escapeHtml(item.title || 'Untitled');
    const titleHtml = item.link
      ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${title}</a>`
      : title;
    const date = formatDate(item.date);
    return `
      <li class="card">
        <div class="card-top">
          ${item.sourceId ? `<span class="source-tag">${escapeHtml(item.sourceId)}</span>` : ''}
          ${date ? `<span class="card-date">${escapeHtml(date)}</span>` : ''}
        </div>
        <h3>${titleHtml}</h3>
        ${item.summary ? `<p class="summary">${escapeHtml(item.summary)}</p>` : ''}
      </li>`;
  }).join('');
}

function applyFilters() {
  const term = els.search.value.trim().toLowerCase();
  const source = els.sourceFilter.value;
  const filtered = allItems.filter((item) => {
    if (source && item.sourceId !== source) return false;
    if (!term) return true;
    return [item.title, item.summary, item.sourceId]
      .filter(Boolean)
      .some((f) => f.toLowerCase().includes(term));
  });
  renderItems(filtered);
}

/* ---------- data ---------- */
async function load() {
  showStatus('Loading latest scrape…');
  try {
    const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
    if (res.status === 404) {
      allItems = [];
      els.meta.textContent = 'No data published yet — waiting for the first scrape.';
      renderItems([]);
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allItems = Array.isArray(data.items) ? data.items : [];

    const parts = [`${allItems.length} item${allItems.length === 1 ? '' : 's'}`];
    if (data.scrapedAt) parts.push(`updated ${timeAgo(data.scrapedAt)}`);
    if (Array.isArray(data.errors) && data.errors.length) {
      parts.push(`${data.errors.length} source error${data.errors.length === 1 ? '' : 's'}`);
    }
    els.meta.textContent = parts.join(' · ');

    populateSourceFilter(allItems);
    applyFilters();
  } catch (err) {
    els.meta.textContent = '';
    showStatus(`Couldn't load the feed (${err.message}). Try refreshing.`, true);
  }
}

/* ---------- events ---------- */
els.search.addEventListener('input', applyFilters);
els.sourceFilter.addEventListener('change', applyFilters);
els.refresh.addEventListener('click', load);

load();
