// One-off: rebuilds the "spotted" record in data/latest.json by replaying every earlier
// version of that file from git history, oldest first. Run: node scripts/backfill-spotted.cjs
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const C = require("../core.js");

const root = path.join(__dirname, "..");
const git = cmd => execSync(`git ${cmd}`, { cwd: root, maxBuffer: 1 << 30 }).toString();
const snaps = git("log --format=%H -- data/latest.json").trim().split("\n").filter(Boolean)
  .map(h => { try { return JSON.parse(git(`show ${h}:data/latest.json`)); } catch { return null; } })
  .filter(j => j && j.raw && j.fetchedAt)
  .sort((a, b) => Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt));

const file = path.join(root, "data/latest.json");
const cur = JSON.parse(fs.readFileSync(file, "utf8"));
let sp = {};
for (const j of [...snaps, cur]) sp = C.updateSpotted(sp, j.raw, Date.parse(j.fetchedAt));
cur.spotted = sp;
fs.writeFileSync(file, JSON.stringify(cur));
const n = Object.values(sp.items).reduce((a, it) => a + it.hits.length, 0);
console.log(`Replayed ${snaps.length + 1} versions since ${sp.since}: ${Object.keys(sp.items).length} items tracked, ${n} milestones, ${Object.keys(sp.breakouts).length} breakouts.`);
console.log(JSON.stringify(C.receipts(sp, Date.parse(cur.fetchedAt)), null, 1));
