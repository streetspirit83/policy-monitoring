# policy-monitoring

Scrapes configured political-development sources and persists the results
through a Netlify Blobs ingest/read pipeline so they can be served to a
frontend or other consumers.

## Architecture

```
Scheduled GitHub Action (Node.js scraper)
   - fetches configured source URLs (HTML)
   - parses with cheerio, normalizes into result.json
        |  curl POST + shared secret (x-deploy-secret)
        v
Netlify Function  POST /api/policy-monitoring-ingest   (writes to Netlify Blobs)
        |
        v
Netlify Blobs store "policy-monitoring" (durable JSON, key "data.json")
        |
        v
Netlify Function  GET /api/policy-monitoring   (reads back, serves to frontend/CLI)
```

## Local development

```bash
npm install
npm run scrape   # writes result.json to the repo root
```

## Sources

Sources to scrape are declared in `sources/sources.json`. Each entry describes
a URL and the CSS selectors used to extract items:

```json
{
  "id": "example-source",
  "name": "Example Government News Page",
  "url": "https://example.com/news",
  "selectors": {
    "item": "article.news-item",
    "title": "h2",
    "link": "a",
    "date": "time",
    "summary": "p.summary"
  }
}
```

Add new sources by appending entries — no code changes required.

## Deployment / secrets (manual, one-time setup)

This repo expects to run on a Netlify site with the functions in
`netlify/functions/`. After connecting the site:

1. Generate one random secret value and set it identically in:
   - Netlify site env vars: `POLICY_MONITORING_INGEST_SECRET`
   - GitHub repo secrets: `POLICY_MONITORING_INGEST_SECRET`
2. Add a GitHub repo secret `POLICY_MONITORING_INGEST_URL` pointing at
   `https://<site-name>.netlify.app/api/policy-monitoring-ingest`
3. Merge to the site's production branch and confirm the deploy picked up
   the new commit before relying on the scheduled scrape.

## Scheduled scraping

`.github/workflows/scrape.yml` runs the scraper every 6 hours (and on manual
`workflow_dispatch`), then POSTs `result.json` to the ingest endpoint.
