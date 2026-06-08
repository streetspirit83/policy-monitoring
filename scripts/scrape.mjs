import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const SOURCES_PATH = new URL('../sources/sources.json', import.meta.url);
const OUTPUT_PATH = new URL('../result.json', import.meta.url);

async function loadSources() {
  const raw = await readFile(SOURCES_PATH, 'utf-8');
  return JSON.parse(raw);
}

function absoluteUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

async function scrapeSource(source) {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'policy-monitoring-bot/0.1 (+https://github.com/streetspirit83/policy-monitoring)' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const $ = load(html);
  const { selectors } = source;

  const items = [];
  $(selectors.item).each((_, el) => {
    const node = $(el);
    const title = selectors.title ? node.find(selectors.title).first().text().trim() : null;
    const link = selectors.link ? absoluteUrl(node.find(selectors.link).first().attr('href'), source.url) : null;
    const date = selectors.date ? node.find(selectors.date).first().attr('datetime') || node.find(selectors.date).first().text().trim() : null;
    const summary = selectors.summary ? node.find(selectors.summary).first().text().trim() : null;

    if (title) {
      items.push({ sourceId: source.id, title, link, date, summary });
    }
  });

  return items;
}

async function main() {
  const sources = await loadSources();
  const scrapedAt = new Date().toISOString();
  const items = [];
  const errors = [];

  for (const source of sources) {
    try {
      const sourceItems = await scrapeSource(source);
      items.push(...sourceItems);
      console.log(`[${source.id}] scraped ${sourceItems.length} item(s)`);
    } catch (err) {
      console.error(`[${source.id}] error: ${err.message}`);
      errors.push({ sourceId: source.id, error: err.message });
    }
  }

  const result = { scrapedAt, items, errors };
  await writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`Wrote ${items.length} item(s) from ${sources.length} source(s) to result.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
