// Fetches every source and writes data/latest.json for the page to read.
// Run by .github/workflows/update-data.yml every hour. Locally: node scripts/update-data.cjs
const fs = require("fs");
const path = require("path");
const C = require("../core.js");

const OUT = path.join(__dirname, "..", "data", "latest.json");
const KEEP_STALE_HOURS = 48;

(async () => {
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}

  const now = Date.now();
  const { raw, errors } = await C.fetchAll({ githubToken: process.env.GITHUB_TOKEN, userAgent: "upcurrent-dashboard/1.0 (GitHub Actions)" });

  // A source that failed this run keeps its last good data for up to 48 hours.
  const stale = [];
  const prevAge = prev.sourceTimes || {};
  const sourceTimes = {};
  for (const n of C.SOURCE_NAMES) {
    if (raw[n]) { sourceTimes[n] = new Date(now).toISOString(); continue; }
    const t = prevAge[n] && Date.parse(prevAge[n]);
    if (prev.raw?.[n] && t && now - t < KEEP_STALE_HOURS * 36e5) { raw[n] = prev.raw[n]; sourceTimes[n] = prevAge[n]; stale.push(n); }
  }
  if (!raw.contrib && prev.raw?.contrib) raw.contrib = prev.raw.contrib;

  const live = C.SOURCE_NAMES.filter(n => raw[n]);
  if (!live.length) { console.error("Every source failed and there is no earlier data:", errors); process.exit(1); }

  const hist = C.updateHistory(prev.hist || {}, raw, now);
  const out = { fetchedAt: new Date(now).toISOString(), sourceTimes, stale, errors, raw, hist };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));

  console.log(`Wrote ${OUT}`);
  for (const n of C.SOURCE_NAMES) console.log(`  ${n.padEnd(11)} ${raw[n] ? raw[n].length + " items" : "missing"}${stale.includes(n) ? " (kept from last run)" : ""}${errors[n] ? "  error: " + errors[n] : ""}`);
})();
