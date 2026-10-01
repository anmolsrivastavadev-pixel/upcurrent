# Upcurrent

A daily dashboard of AI repos, models, papers and threads that are picking up speed.

## How the data stays live
- `.github/workflows/update-data.yml` runs every hour (and on every push to `main`).
- It runs `scripts/update-data.cjs`, which fetches 7 public sources (GitHub, Hugging Face models,
  Hugging Face papers, Hacker News, Reddit, OpenRouter, OpenCode Zen) and writes `data/latest.json`.
  A source that fails keeps its last good data for up to 48 hours.
- The workflow commits `data/latest.json` (it also stores earlier readings, so growth % is real)
  and publishes the site to GitHub Pages.
- `index.html` reads `data/latest.json`. If that file is missing, it fetches the sources from the
  visitor's browser, and if that fails too it shows a built-in snapshot.

`core.js` holds the fetching and scoring logic, shared by the page and the script.

## One-time setup
1. Push this folder to a GitHub repo.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Actions → "Update data and publish" → Run workflow (or wait for the next hour).

Run it locally with `node scripts/update-data.cjs` (Node 18+).

## Reddit (optional)
Reddit blocks requests from GitHub's servers. To read it through Reddit's official API:
1. Log in to Reddit, open https://www.reddit.com/prefs/apps and create an app of type **script**
   (redirect URI can be `http://localhost`).
2. In this repo: Settings → Secrets and variables → Actions → New repository secret. Add
   `REDDIT_CLIENT_ID` (the code under the app name), `REDDIT_CLIENT_SECRET` and `REDDIT_USERNAME`.
Without these, the page tries to load Reddit from each visitor's browser instead.
