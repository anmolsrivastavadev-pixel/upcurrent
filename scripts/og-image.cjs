// Builds today's link-preview card (og-live.png, 1200x630) from data/api/today.json,
// then points the published pages' og:image / twitter:image at it.
// Runs in the publish job after build-seo.cjs, on the deploy copy only.
// Usage: node scripts/og-image.cjs <chrome-binary>
// If anything fails, the pages keep the plain og.png, so a share card always exists.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SITE = "https://upcurrent.dev/";
const chrome = process.argv[2];
if (!chrome) { console.log("og-image: no Chrome, keeping og.png"); process.exit(0); }

const d = JSON.parse(fs.readFileSync(path.join(ROOT, "data/api/today.json"), "utf8"));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SRC = { gh: "GitHub", hf: "Hugging Face", paper: "Paper", ph: "Product Hunt" };

function stat(r) {
  const m = r.meta || [];
  const day = m.find(x => /in 24h/.test(x));
  if (day) return day.replace(/in 24h/, "stars today");
  const dl = m.find(x => /downloads/.test(x) && !/^0 /.test(x));
  if (dl) return dl;
  const up = m.find(x => /upvotes/.test(x));
  if (up) return up.replace(/^▲\s*/, "");
  return "";
}
function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }

const top = (d.rising || []).slice(0, 3);
if (top.length < 3) { console.log("og-image: not enough items, keeping og.png"); process.exit(0); }
const updated = new Date(d.about?.updated || Date.now());
const dateLabel = updated.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
const p = d.pulse || {};
const foot = [
  p.stars ? `${Number(p.stars).toLocaleString("en-GB")} stars gained by tracked AI repos today` : "",
  d.free?.length ? `${d.free.length} free models` : "",
].filter(Boolean).join("  ·  ");

const rows = top.map((r, i) => `
  <div class="row">
    <div class="rank">${i + 1}</div>
    <div class="body">
      <div class="name">${esc(clip(r.name, r.src === "paper" ? 46 : 30))}</div>
      <div class="sub">${esc(SRC[r.src] || r.src)}${r.owner ? " · " + esc(clip(r.owner, 22)) : ""}</div>
    </div>
    <div class="stat">${esc(stat(r))}</div>
  </div>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Hanken+Grotesk:wght@500;600;700&display=block">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:#16112f;color:#f3f0ff;font-family:"Hanken Grotesk",system-ui,sans-serif;padding:52px 64px;display:flex;flex-direction:column;
  background-image:radial-gradient(900px 500px at 105% -10%,rgba(226,65,47,.22),transparent 60%),radial-gradient(700px 420px at -10% 110%,rgba(47,157,181,.18),transparent 60%)}
.top{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:14px;font-family:"Big Shoulders Display";font-weight:800;font-size:42px}
.live{font-family:"Hanken Grotesk";font-size:20px;color:#b9b2dc;display:flex;align-items:center;gap:10px}
.dot{width:12px;height:12px;border-radius:50%;background:#3fd09a;box-shadow:0 0 0 6px rgba(63,208,154,.18)}
h1{font-family:"Big Shoulders Display";font-weight:900;font-size:76px;line-height:.95;letter-spacing:0;margin:30px 0 22px}
h1 em{font-style:normal;color:#f5ad45}
.rows{display:flex;flex-direction:column;gap:12px}
.row{display:flex;align-items:center;gap:22px;background:#131a26;border:1px solid #232d3f;border-radius:14px;padding:14px 24px}
.rank{font-family:"Big Shoulders Display";font-weight:800;font-size:44px;color:#ff5c48;width:26px}
.body{flex:1;min-width:0}
.name{font-family:"Big Shoulders Display";font-weight:800;font-size:38px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{font-size:19px;color:#b9b2dc;margin-top:2px}
.stat{font-family:"Hanken Grotesk";font-weight:600;font-size:24px;color:#3fd09a;white-space:nowrap}
.foot{margin-top:auto;display:flex;justify-content:space-between;font-family:"Hanken Grotesk";font-size:19px;color:#b9b2dc}
.foot b{color:#f3f0ff;font-weight:600}
</style></head><body>
<div class="top">
  <div class="brand"><svg width="42" height="42" viewBox="0 0 32 32"><g fill="none" stroke-width="3.2" stroke-linecap="round"><path d="M5 25c4-1 6-5 6-10" stroke="#46b9d1"/><path d="M13 26c4.5-1.5 7-7 6.5-15" stroke="#f5ad45"/><path d="M21 27c5-2 7.5-10 6-21" stroke="#ff5c48"/></g></svg>Upcurrent</div>
  <div class="live"><span class="dot"></span>${esc(dateLabel)} · live</div>
</div>
<h1>Rising in AI <em>right now</em></h1>
<div class="rows">${rows}</div>
<div class="foot"><span>${esc(foot)}</span><b>upcurrent.dev</b></div>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "og-"));
const src = path.join(tmp, "card.html");
const out = path.join(ROOT, "og-live.png");
fs.writeFileSync(src, html);
try {
  execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1200,630", "--virtual-time-budget=8000", `--screenshot=${out}`, "file://" + src], { stdio: "ignore", timeout: 60000 });
} catch (e) { /* checked below */ }
if (!fs.existsSync(out) || fs.statSync(out).size < 10000) { console.log("og-image: screenshot failed, keeping og.png"); process.exit(0); }

// Point the live pages at the new card. The ?v= stamp makes Discord, X and others fetch the fresh one.
const stamp = updated.toISOString().slice(0, 13).replace(/\D/g, "");
const img = `${SITE}og-live.png?v=${stamp}`;
const lead = top[0];
const ogDesc = `#1 right now: ${lead.name}${stat(lead) ? " (" + stat(lead) + ")" : ""}. Rising AI repos, new models and free models, updated every 30 minutes.`;
const pages = ["index.html", "email.html", "free-ai-models/index.html", "trending-ai-github-repos/index.html", "new-ai-models/index.html", "daily/index.html"];
for (const rel of pages) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) continue;
  let h = fs.readFileSync(f, "utf8");
  h = h.replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*og\.png[^"]*"/g, `$1${img}"`)
       .replace(/(<meta property="og:image:alt" content=")[^"]*"/, `$1Upcurrent: top 3 rising in AI on ${esc(dateLabel)}"`);
  if (rel === "index.html") {
    h = h.replace(/(<meta property="og:title" content=")[^"]*"/, `$1Upcurrent: what's rising in AI today"`)
         .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1Upcurrent: what's rising in AI today"`)
         .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(ogDesc)}"`)
         .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${esc(ogDesc)}"`);
  }
  fs.writeFileSync(f, h);
}
console.log("og-image: wrote og-live.png, stamp", stamp);
