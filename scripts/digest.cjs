// Builds the morning email from data/latest.json and sends it through Buttondown.
// Without BUTTONDOWN_API_KEY (or with DRY_RUN=1) it only writes data/digest.md as a preview.
const fs = require("fs");
const path = require("path");
const { build, comma } = require("../core.js");

const SITE = "https://anmolsrivastavadev-pixel.github.io/upcurrent/";
const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/latest.json"), "utf8"));
const empty = { rising: [], activity: {}, discussions: [], freeCounts: { zen: 0, or: 0 }, free: [], pulse: {}, github: [], brief: [], models: [], newToday: [] };
const D = build(data.raw, { win: "24h", hist: data.hist || {}, fetchedAt: data.fetchedAt, fallback: empty });

// Optional paid placement: data/sponsor.json = { "name": "...", "url": "https://...", "text": "One or two sentences." }
let sponsor = null;
try { sponsor = JSON.parse(fs.readFileSync(path.join(root, "data/sponsor.json"), "utf8")); } catch {}
if (!sponsor?.name || !sponsor?.url) sponsor = null;

const md = s => String(s).replace(/([\\`*_[\]<>])/g, "\\$1");
const link = (t, u) => u ? `[${md(t)}](${u})` : md(t);
const clip = s => s.length > 150 ? s.slice(0, 147).replace(/\s+\S*$/, "") + "…" : s;
const itemUrl = r => r.url || (r.src === "gh" ? `https://github.com/${r.owner}/${r.name}` : r.src === "hf" ? `https://huggingface.co/${r.owner}/${r.name}` : null);

const date = new Date(data.fetchedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const rising = D.rising.slice(0, 5);
const news = D.headlines.filter(h => Date.now() - Date.parse(h.at) < 2 * 864e5).slice(0, 5);
const repos = D.github.slice(0, 3);
const threads = D.discussions.slice(0, 3);

const parts = [
  `Good morning. Here's what picked up speed in AI over the last day.`,
  D.brief.length && D.brief.slice(0, 2).map(md).join(" "),
  sponsor && `**Today's sponsor: ${link(sponsor.name, sponsor.url)}**. ${md(sponsor.text || "")}`.trim(),
  rising.length && `## Climbing fastest\n\n` + rising.map((r, i) => `${i + 1}. **${link(r.name, itemUrl(r))}** (score ${r.score}). ${md(clip(r.desc || ""))}`).join("\n"),
  news.length && `## Headlines\n\n` + news.map(h => `- ${link(h.t, h.url)} (${md(h.src)})`).join("\n"),
  repos.length && `## Repos gaining stars\n\n` + repos.map(g => `- ${link(g.repo, "https://github.com/" + g.repo)}: ${g.est ? "about " : ""}+${comma(g.d24)} stars in 24h`).join("\n"),
  threads.length && `## Threads people are discussing\n\n` + threads.map(d => `- ${link(d.t, d.url)} (${md(d.src)})`).join("\n"),
  `[See the full dashboard](${SITE})`
].filter(Boolean);

const subject = rising[0] ? `Upcurrent: ${rising[0].name} leads ${date}` : `Upcurrent for ${date}`;
const body = parts.join("\n\n");
fs.writeFileSync(path.join(root, "data/digest.md"), `# ${subject}\n\n${body}\n`);
console.log(`Subject: ${subject}\n${body.length} chars, ${rising.length} movers, ${news.length} headlines`);

const key = process.env.BUTTONDOWN_API_KEY;
if (!key) { console.log("::notice::No BUTTONDOWN_API_KEY, preview only."); process.exit(0); }
if (process.env.DRY_RUN === "1") {
  // Check the key without sending anything.
  fetch("https://api.buttondown.com/v1/subscribers?page_size=1", { headers: { Authorization: `Token ${key}` } })
    .then(async r => { const t = await r.text(); console.log(r.ok ? `::notice::Key works. Subscribers: ${JSON.parse(t).count}. DRY_RUN set, not sending.` : `::error::Buttondown ${r.status}: ${t.slice(0, 300)}`); process.exit(r.ok ? 0 : 1); })
    .catch(e => { console.error(e.message); process.exit(1); });
  return;
}
if (!rising.length && !news.length) { console.error("Nothing to send today."); process.exit(1); }

fetch("https://api.buttondown.com/v1/emails", {
  method: "POST",
  headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ subject, body, status: "about_to_send" })
}).then(async r => {
  const t = await r.text();
  if (!r.ok) { console.error(`::error::Buttondown ${r.status}: ${t.slice(0, 400)}`); process.exit(1); }
  console.log("::notice::Sent.");
}).catch(e => { console.error(e.message); process.exit(1); });
