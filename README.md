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

## Bluesky and X
Bluesky search refuses GitHub's servers without a login. Create a free app password in Bluesky
(Settings → Privacy and security → App passwords) and add `BSKY_HANDLE` and `BSKY_APP_PASSWORD`
as repository secrets. Without them, the page tries Bluesky from each visitor's browser.
X needs a paid X developer plan. Add its bearer token as the `X_BEARER_TOKEN` repository secret and
posts from X show up on the next hourly run. Without the token, X is skipped.

## More sources
No key needed: arXiv, Lobsters, DEV, Mastodon, AI lab blogs (OpenAI, Google DeepMind, Google Research,
Hugging Face, Meta AI, NVIDIA) and Techmeme.

Each of these switches on when you add its repository secret:
| Source | Secret | Get a key |
|---|---|---|
| The Guardian | `GUARDIAN_API_KEY` | https://open-platform.theguardian.com/access/ |
| GNews | `GNEWS_API_KEY` | https://gnews.io/register |
| NewsAPI | `NEWSAPI_KEY` | https://newsapi.org/register (free plan is for development only) |
| YouTube | `YOUTUBE_API_KEY` | Google Cloud console, enable "YouTube Data API v3", create an API key |
| Product Hunt | `PRODUCTHUNT_TOKEN` | https://www.producthunt.com/v2/oauth/applications, use the developer token |
