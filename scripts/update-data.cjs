// Fetches every source and writes data/latest.json for the page to read.
// Run by .github/workflows/update-data.yml every hour. Locally: node scripts/update-data.cjs
const fs = require("fs");
const path = require("path");
const C = require("../core.js");

const OUT = path.join(__dirname, "..", "data", "latest.json");
const KEEP_STALE_HOURS = 48;
const SITE = "https://anmolsrivastavadev-pixel.github.io/upcurrent/";

// Open data: small, documented JSON files anyone can use with credit. See data.html.
function writeOpenData(out) {
  const now = Date.parse(out.fetchedAt);
  const empty = { rising: [], activity: {}, discussions: [], freeCounts: { zen: 0, or: 0 }, free: [], pulse: {}, github: [], brief: [], models: [], newToday: [], headlines: [] };
  const D = C.build(out.raw, { hist: out.hist, spotted: out.spotted, fetchedAt: out.fetchedAt, now, fallback: empty });
  const about = { name: "Upcurrent", site: SITE, docs: SITE + "data.html", license: "CC BY 4.0", attribution: `Data from Upcurrent (${SITE})`, updated: out.fetchedAt };
  const today = { about, pulse: D.pulse, rising: D.rising.map(r => ({ ...r, url: r.url || (r.src === "gh" ? `https://github.com/${r.owner}/${r.name}` : r.src === "hf" ? `https://huggingface.co/${r.owner}/${r.name}` : null) })), breakouts: D.breakouts, hype: D.hype, receipts: D.receipts, github: D.github, models: D.models,
    free: D.free.map(({ name, prov, ctx, url, caps, added }) => ({ name, prov, ctx, url: url || null, caps, added })), freeChanges: D.freeChanges, headlines: D.headlines, discussions: D.discussions.map(({ vel, ...d }) => d) };
  const history = { about, trackingSince: out.spotted.since, tracked: out.spotted.items, breakouts: out.spotted.breakouts, freeModels: out.spotted.free };
  const dir = path.join(__dirname, "..", "data", "api");
  fs.mkdirSync(path.join(dir, "daily"), { recursive: true });
  fs.writeFileSync(path.join(dir, "today.json"), JSON.stringify(today, null, 1));
  fs.writeFileSync(path.join(dir, "history.json"), JSON.stringify(history));
  // One file per UTC day; later runs that day overwrite it, so it ends as that day's final picture.
  fs.writeFileSync(path.join(dir, "daily", out.fetchedAt.slice(0, 10) + ".json"), JSON.stringify(today));
}

(async () => {
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}

  const now = Date.now();
  const { raw, errors } = await C.fetchAll({
    githubToken: process.env.GITHUB_TOKEN,
    redditId: process.env.REDDIT_CLIENT_ID,
    redditSecret: process.env.REDDIT_CLIENT_SECRET,
    xToken: process.env.X_BEARER_TOKEN,
    bskyHandle: process.env.BSKY_HANDLE,
    bskyPassword: process.env.BSKY_APP_PASSWORD,
    keys: {
      guardian: process.env.GUARDIAN_API_KEY,
      gnews: process.env.GNEWS_API_KEY,
      newsapi: process.env.NEWSAPI_KEY,
      youtube: process.env.YOUTUBE_API_KEY,
      producthunt: process.env.PRODUCTHUNT_TOKEN
    },
    userAgent: `script:upcurrent-dashboard:v1.0 (by /u/${process.env.REDDIT_USERNAME || "upcurrent"})`
  });

  // A source that failed this run keeps its last good data for up to 48 hours.
  const stale = [];
  const prevAge = prev.sourceTimes || {};
  const sourceTimes = {};
  for (const n of C.SOURCE_NAMES) {
    if (raw[n]) { sourceTimes[n] = new Date(now).toISOString(); continue; }
    if ((raw.off || []).includes(n)) continue;
    const t = prevAge[n] && Date.parse(prevAge[n]);
    if (prev.raw?.[n] && t && now - t < KEEP_STALE_HOURS * 36e5) { raw[n] = prev.raw[n]; sourceTimes[n] = prevAge[n]; stale.push(n); }
  }
  if (!raw.contrib && prev.raw?.contrib) raw.contrib = prev.raw.contrib;

  const live = C.SOURCE_NAMES.filter(n => raw[n]);
  if (!live.length) { console.error("Every source failed and there is no earlier data:", errors); process.exit(1); }

  const hist = C.updateHistory(prev.hist || {}, raw, now);
  // Long-lived record of what Upcurrent tracked and when, for the "Called it" receipts.
  const spotted = C.updateSpotted(prev.spotted || {}, raw, now, { stale });
  // Belt and braces: strip anything key-like from saved errors.
  for (const k in errors) errors[k] = String(errors[k]).replace(/([?&](?:api-key|apikey|apiKey|key|token)=)[^&\s]+/gi, "$1REDACTED");
  const out = { fetchedAt: new Date(now).toISOString(), sourceTimes, stale, errors, raw, hist, spotted };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));

  console.log(`Wrote ${OUT}`);
  try { writeOpenData(out); } catch (e) { console.error("Open data files not written:", e.message); }
  for (const n of C.SOURCE_NAMES) console.log(`  ${n.padEnd(11)} ${raw[n] ? raw[n].length + " items" : "missing"}${stale.includes(n) ? " (kept from last run)" : ""}${errors[n] ? "  error: " + errors[n] : ""}`);
})();
