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

## Morning email

`scripts/digest.cjs` turns `data/latest.json` into a short email (top movers, headlines, repos, threads) and sends it through [Buttondown](https://buttondown.com). The **Morning email** workflow runs every hour and sends to each subscriber during 7am in their own time zone (the signup form saves it as `metadata.timezone`; anyone without one gets Europe/London).

1. Create a Buttondown account and add its API key as the `BUTTONDOWN_API_KEY` secret.
2. Put your Buttondown username in `const NEWSLETTER = ""` in `index.html` to show the signup box.
3. Optional: add `data/sponsor.json` (`{"name": "...", "url": "https://...", "text": "..."}`) to put a sponsor line at the top of the email.

Run the workflow by hand with "dry run" ticked to preview the email in the run summary without sending it.

## Breakouts and "Called it"

- **Breaking out** lists any model or project named on 3 or more separate sources in the last 3 days (for example GitHub, Hacker News and a news site). Items in the movers list that are breaking out get a red badge.
- **Called it** shows projects Upcurrent was already tracking before they passed a milestone (1K, 2.5K, 5K, 10K… stars, or 10K, 100K, 1M… downloads). The hourly job keeps this record in the `spotted` field of `data/latest.json`. `scripts/backfill-spotted.cjs` rebuilds it from git history.
- **Hype check** puts how many news sites, lab blogs and threads mention something next to how much it's used (GitHub stars per day, Hugging Face downloads).
- **Since your last visit** remembers, in the visitor's own browser only, what they saw last time and marks new items with a NEW tag.

## Free models watch

Every run compares the free model lists from OpenRouter and OpenCode Zen with the last run. A model counts as added the first time it appears, and as removed only after it is missing from two fresh checks in a row (so a provider hiccup doesn't cause false alarms). Changes from the last 24 hours show at the top of the Free models section, and new models get a NEW TODAY tag. The record lives in `spotted.free` inside `data/latest.json`.

## Open data

Each run also writes small, documented JSON files anyone can use for free under CC BY 4.0, with credit to Upcurrent:

- `data/api/today.json`: everything on the dashboard right now
- `data/api/history.json`: everything Upcurrent has tracked, breakouts, and free model changes
- `data/api/daily/YYYY-MM-DD.json`: one snapshot per UTC day

The docs page is `data.html`.

## Search engines
Each publish also runs `scripts/build-seo.cjs`, which only changes the copy that goes to Pages:
- `daily/YYYY-MM-DD.html` and `daily/index.html`: a plain, crawlable page per day from `data/api/daily/`.
- `sitemap.xml` listing every page. Submit `https://anmolsrivastavadev-pixel.github.io/upcurrent/sitemap.xml`
  in Google Search Console and Bing Webmaster Tools.
- `index.html` filled with the rendered dashboard (headless Chrome), so crawlers and link previews see
  today's content without running JavaScript. If that step fails, the plain page is published instead.
After the publish, `scripts/indexnow.cjs` tells Bing and other IndexNow engines about new pages.
