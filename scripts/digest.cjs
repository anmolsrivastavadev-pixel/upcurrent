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

// Every reader who forwards or shares the email can bring in another reader.
function share() {
  const page = `${SITE}daily/${data.fetchedAt.slice(0, 10)}.html`;
  const msg = encodeURIComponent(`What's rising in AI today, from Upcurrent: ${page}`);
  return `## Know someone who'd like this?\n\nForward this email to them, or send them the free sign-up link: ${link("get Upcurrent every morning", SITE + "#signup")}.\n\nShare today's list: ${link("X", "https://x.com/intent/post?text=" + msg)} · ${link("Bluesky", "https://bsky.app/intent/compose?text=" + msg)} · ${link("LinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(page))} · ${link("WhatsApp", "https://wa.me/?text=" + msg)} · ${link("Reddit", "https://www.reddit.com/submit?url=" + encodeURIComponent(page) + "&title=" + encodeURIComponent("What's rising in AI today"))}`;
}

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
  share(),
  `[See the full dashboard](${SITE})`
].filter(Boolean);

const subject = rising[0] ? `Upcurrent: ${rising[0].name} leads ${date}` : `Upcurrent for ${date}`;
const body = parts.join("\n\n");
fs.writeFileSync(path.join(root, "data/digest.md"), `# ${subject}\n\n${body}\n`);
console.log(`Subject: ${subject}\n${body.length} chars, ${rising.length} movers, ${news.length} headlines`);

const key = process.env.BUTTONDOWN_API_KEY;
if (!key) { console.log("::notice::No BUTTONDOWN_API_KEY, preview only."); process.exit(0); }

// Each subscriber gets the email once a day, at 7am in their own time zone. GitHub sometimes runs
// scheduled jobs late or skips them, so a zone that missed 7am is caught up on the next run before noon.
// metadata.last_sent (their local date) stops anyone getting it twice.
// The signup form stores their zone as metadata.timezone; anyone without one is treated as DEFAULT_TZ.
const API = "https://api.buttondown.com/v1";
const DEFAULT_TZ = "Europe/London";
const SEND_HOUR = 7, LAST_HOUR = 12;
const headers = { Authorization: `Token ${key}`, "Content-Type": "application/json" };

async function api(method, url, body, extra = {}) {
  const r = await fetch(url.startsWith("http") ? url : API + url, { method, headers: { ...headers, ...extra }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`Buttondown ${r.status} on ${method} ${url.replace(API, "")}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}

const validTz = tz => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };
const localDate = (tz, at) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at);
const localHour = (tz, at) => Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(at));

async function main() {
  const subs = [];
  for (let url = "/subscribers?type=regular"; url; ) { const page = await api("GET", url); subs.push(...page.results); url = page.next; }

  // Give subscribers with a missing or unknown zone the default, so the filter below can reach them.
  for (const s of subs) {
    const tz = s.metadata?.timezone;
    if (tz && validTz(tz)) continue;
    if (process.env.DRY_RUN !== "1") await api("PATCH", `/subscribers/${s.id}`, { metadata: { ...(s.metadata || {}), timezone: DEFAULT_TZ } });
    s.metadata = { ...(s.metadata || {}), timezone: DEFAULT_TZ };
  }

  const now = new Date();
  const zones = [...new Set(subs.map(s => s.metadata.timezone))];
  const waiting = tz => subs.some(s => s.metadata.timezone === tz && s.metadata.last_sent !== localDate(tz, now));
  const due = process.env.ONLY_TZ ? [process.env.ONLY_TZ] : zones.filter(tz => { const h = localHour(tz, now); return h >= SEND_HOUR && h < LAST_HOUR && waiting(tz); });
  const reach = subs.filter(s => due.includes(s.metadata.timezone)).length;
  console.log(`::notice::${subs.length} subscribers in ${zones.length} time zones (${zones.join(", ") || "none"}). Due now: ${due.join(", ") || "none"} (${reach} people).`);
  const filters = { filters: (due.length ? due : zones).map(tz => ({ field: "subscriber.metadata.timezone", operator: "equals", value: tz })), groups: [], predicate: "or" };
  if (process.env.DRY_RUN === "1") {
    // Check that Buttondown accepts the time-zone filter by saving it on a draft, then delete the draft.
    const draft = await api("POST", "/emails", { subject: `[test] ${subject}`, body, status: "draft", filters });
    console.log(`::notice::Filter accepted: ${JSON.stringify(draft.filters)}`);
    await api("DELETE", `/emails/${draft.id}`);
    return;
  }
  if (!due.length) return;
  if (!rising.length && !news.length) throw new Error("Nothing to send today.");

  await api("POST", "/emails", { subject, body, status: "about_to_send", filters }, { "X-Buttondown-Live-Dangerously": "true" });
  console.log(`::notice::Sent to ${due.join(", ")}.`);
  // Mark who got today's email, so later runs this morning skip them.
  for (const s of subs.filter(s => due.includes(s.metadata.timezone))) {
    try { await api("PATCH", `/subscribers/${s.id}`, { metadata: { ...s.metadata, last_sent: localDate(s.metadata.timezone, now) } }); }
    catch (e) { console.log(`::warning::Could not mark ${s.id} as sent: ${e.message}`); }
  }
}

main().catch(e => { console.error(`::error::${e.message}`); process.exit(1); });
