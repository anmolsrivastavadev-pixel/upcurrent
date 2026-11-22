// Builds the morning email from data/latest.json and sends it through Buttondown.
// Without BUTTONDOWN_API_KEY (or with DRY_RUN=1) it only writes data/digest.md as a preview.
const fs = require("fs");
const path = require("path");
const { build, comma, fmt } = require("../core.js");

// The email has one job: be the 30-second version of the AI feed. Five short items, strongest first,
// each led by a real number, then "you're done". The subject line is the best item of the day.
const SITE = "https://upcurrent.dev/";
const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/latest.json"), "utf8"));
const now = Date.parse(data.fetchedAt);
const DAY = 864e5;
const empty = { rising: [], activity: {}, discussions: [], freeCounts: { zen: 0, or: 0 }, free: [], pulse: {}, github: [], brief: [], models: [], newToday: [] };
const D = build(data.raw, { win: "24h", hist: data.hist || {}, spotted: data.spotted || null, now, fetchedAt: data.fetchedAt, fallback: empty });

// Optional paid placement: data/sponsor.json = { "name": "...", "url": "https://...", "text": "One or two sentences." }
let sponsor = null;
try { sponsor = JSON.parse(fs.readFileSync(path.join(root, "data/sponsor.json"), "utf8")); } catch {}
if (!sponsor?.name || !sponsor?.url) sponsor = null;

const md = s => String(s).replace(/([\\`*_[\]<>])/g, "\\$1");
const link = (t, u) => u ? `[${md(t)}](${u})` : md(t);
const clip = (s, n = 120) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, "") + "…" : s; };
// A description cut to its first sentence when that fits, so items don't end mid-thought.
const sentence = (s, n = 130) => {
  let out = "";
  for (const f of String(s || "").trim().match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || []) { if ((out + f).length > n) break; out += f; }
  return out.trim().length >= 30 ? out.trim() : clip(s, n);
};
const dropFree = n => String(n).replace(/\s*\(?free\)?$/i, "");
const days = iso => Math.max(1, Math.round((now - Date.parse(iso)) / DAY));
const recent = (iso, d = 1) => iso && now - Date.parse(iso) < d * DAY;
const names = (list, n = 2) => list.length <= n ? list.join(" and ") : `${list.slice(0, n).join(", ")} and ${list.length - n} more`;

// Each item: hook (short, for the subject line), title (bold lead sentence), text (one line of context), more (link),
// and weight: how strong a reason to open it is. The strongest item leads and becomes the subject line.
const items = [];
const freeTotal = D.freeCounts.zen + D.freeCounts.or;
const freeEv = (D.freeChanges?.events || []).filter(e => !/^(lyria|jev)\b/i.test(e.name));
// How long a model that just stopped being free had been free, when Upcurrent saw it start.
const freeLasted = e => {
  if (removed.length !== 1) return "";
  const start = (data.spotted?.free?.events || []).filter(x => x.type === "added" && x.name === e.name && x.prov === e.prov && Date.parse(x.at) < Date.parse(e.at)).pop();
  if (!start) return "";
  const d = Math.round((Date.parse(e.at) - Date.parse(start.at)) / DAY);
  return start ? `It was free for ${d < 1 ? "less than a day" : d === 1 ? "1 day" : d + " days"}. ` : "";
};
// Median length of the free offers Upcurrent has seen start and end, for "try it while it lasts".
const spans = [];
{ const open = new Map();
  for (const e of [...(data.spotted?.free?.events || [])].sort((x, y) => Date.parse(x.at) - Date.parse(y.at))) {
    const k = e.prov + "|" + e.name;
    if (e.type === "added") open.set(k, e.at);
    else if (e.type === "removed" && open.has(k)) { spans.push((Date.parse(e.at) - Date.parse(open.get(k))) / DAY); open.delete(k); }
  } }
spans.sort((x, y) => x - y);
const medianFree = spans.length >= 5 ? Math.max(1, Math.round(spans[Math.floor(spans.length / 2)])) : null;
const added = freeEv.filter(e => e.type === "added"), removed = freeEv.filter(e => e.type === "removed");
if (added.length) items.push({
  hook: added.length === 1 ? `Now free: ${dropFree(added[0].name)}` : `${added.length} AI models just went free`,
  title: added.length === 1 ? `${dropFree(added[0].name)} just went free on ${added[0].prov}.` : `${added.length} AI models went free: ${names(added.map(e => dropFree(e.name)))}.`,
  text: `${medianFree ? `Half the free offers Upcurrent has tracked ended within ${medianFree} days, so try them soon.` : "Free offers often end without warning, so try them soon."}${removed.length ? ` Ended: ${names(removed.map(e => dropFree(e.name)))}.` : ""}`,
  more: ["Try them", (added.length === 1 && added[0].url) || SITE + "free-ai-models/"],
  weight: 100
});
else if (removed.length) items.push({
  hook: removed.length === 1 ? `No longer free: ${dropFree(removed[0].name)}` : `${removed.length} free AI models just ended`,
  title: removed.length === 1 ? `${dropFree(removed[0].name)} is no longer free on ${removed[0].prov}.` : `${removed.length} AI models stopped being free: ${names(removed.map(e => dropFree(e.name)))}.`,
  text: `${freeLasted(removed[0])}${freeTotal} models are still free right now (${D.freeCounts.or} on OpenRouter, ${D.freeCounts.zen} on OpenCode Zen).`,
  more: ["See what's still free", SITE + "free-ai-models/"],
  weight: 60
});

const repo = D.github.filter(g => g.d24 >= 100)[0];
if (repo) {
  const short = repo.repo.split("/")[1];
  items.push({
    hook: `+${comma(repo.d24)} GitHub stars in a day: ${short}`,
    title: `${short} gained ${repo.est ? "about " : ""}${comma(repo.d24)} GitHub stars in a day.`,
    text: sentence(repo.desc, 130) || `${comma(repo.stars)} stars in total.`,
    more: ["Open on GitHub", `https://github.com/${repo.repo}`],
    weight: repo.d24 >= 1000 ? 90 : repo.d24 >= 300 ? 70 : 40
  });
}

const model = D.models.filter(m => m.dl >= 1000 && recent(m.at, 7)).sort((a, b) => b.dl - a.dl)[0];
if (model) items.push({
  hook: `${fmt(model.dl)} downloads in ${days(model.at)} days: ${model.name}`,
  title: `${model.name} hit ${fmt(model.dl)} downloads ${days(model.at) === 1 ? "in its first day" : `in ${days(model.at)} days`}.`,
  text: `New ${model.lic.toLowerCase()} model from ${model.org}.`,
  more: ["See the model", `https://huggingface.co/${model.org}/${model.name}`],
  weight: model.dl >= 1e5 ? 85 : 50
});

// "Called it": something Upcurrent flagged early that has now passed a milestone. Only ones from the last day.
const receipt = (D.receipts || []).find(r => recent(r.at) && !items.some(i => i.more[1] === r.url));
if (receipt) {
  const unit = receipt.kind === "stars" ? "stars" : "downloads";
  const lead = receipt.lead >= 48 ? `${Math.round(receipt.lead / 24)} days` : `${Math.round(receipt.lead)} hours`;
  items.push({
    hook: `Called it: ${receipt.name.split("/").pop()} passed ${fmt(receipt.m)} ${unit}`,
    title: `Spotted early: ${receipt.name.split("/").pop()} just passed ${fmt(receipt.m)} ${unit}.`,
    text: `Upcurrent flagged it ${lead} earlier, at ${comma(receipt.firstV)} ${unit}.`,
    more: ["Take a look", receipt.url],
    weight: 55
  });
}

const talk = D.discussions.filter(d => recent(d.at) && d.com >= 20).sort((a, b) => b.com - a.com)[0];
if (talk) items.push({
  hook: `${comma(talk.com)} comments: ${clip(talk.t, 50)}`,
  title: `${comma(talk.com)} comments on ${talk.src}: "${clip(talk.t, 110)}"`,
  text: `${comma(talk.up)} points.`,
  more: ["Read the thread", talk.url],
  weight: talk.com >= 300 ? 65 : 45
});

const SKIP_SRC = /natural news/i;
const news = D.headlines.filter(h => recent(h.at) && !SKIP_SRC.test(h.src));
if (news[0]) items.push({
  hook: clip(news[0].t, 60),
  title: clip(news[0].t, 140),
  text: news[1] ? `Also: ${link(clip(news[1].t, 90), news[1].url)} (${md(news[1].src)})` : "",
  textIsMd: true,
  more: [`Read on ${news[0].src}`, news[0].url],
  weight: 30
});

const top = items.sort((a, b) => b.weight - a.weight).slice(0, 5);
const date = new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// Inbox preview text: the first line of the body, so people see more than the subject before they open it.
// The reading time is worked out from the five items themselves (at 240 words a minute), so the promise stays true.
const itemWords = top.map(i => `${i.title} ${i.text}`).join(" ").replace(/\]\([^)]*\)/g, "]").split(/\s+/).length;
const secs = Math.max(20, Math.ceil(itemWords / 4 / 10) * 10);
const preview = `${top.slice(1, 3).map(i => i.hook).join(". ")}${top.length > 3 ? `, and ${top.length - 3} more` : ""}. A ${secs}-second read.`.replace(/^\. /, "");

function share() {
  const page = `${SITE}daily/${data.fetchedAt.slice(0, 10)}.html`;
  const msg = encodeURIComponent(`What's rising in AI today, from Upcurrent: ${page}`);
  return `Know someone who'd like this? Forward it, or share today's list on ${link("X", "https://x.com/intent/post?text=" + msg)}, ${link("Bluesky", "https://bsky.app/intent/compose?text=" + msg)}, ${link("LinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(page))} or ${link("WhatsApp", "https://wa.me/?text=" + msg)}.`;
}

const parts = [
  md(preview),
  sponsor && `**Sponsor: ${link(sponsor.name, sponsor.url)}**. ${md(sponsor.text || "")}`.trim(),
  `## ${top.length} things in AI, ${date}`,
  ...top.map((it, i) => `**${i + 1}. ${md(it.title)}** ${it.textIsMd ? it.text : md(it.text)} ${link(it.more[0] + " →", it.more[1])}`.replace(/\s+$/, "")),
  `That's it, you're done. ${freeTotal ? `${freeTotal} AI models are free to use right now: ${link("see the list", SITE + "free-ai-models/")}. ` : ""}${link("Everything else rising today", SITE)}.`,
  share()
].filter(Boolean);

const subject = top[0] ? top[0].hook : `Upcurrent for ${date}`;
const body = parts.join("\n\n");
fs.writeFileSync(path.join(root, "data/digest.md"), `# ${subject}\n\n${body}\n`);
console.log(`Subject: ${subject}\n${body.length} chars, ${top.length} items, ${body.split(/\s+/).length} words`);

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
  // People who only signed up for free model alerts (scripts/free-alerts.cjs) don't get the morning email.
  // They have no time zone, so the time-zone filter below never reaches them; leave them out here too.
  for (let i = subs.length - 1; i >= 0; i--) if (subs[i].metadata?.alerts_only === "yes" && !subs[i].metadata?.timezone) subs.splice(i, 1);

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
  if (top.length < 2) throw new Error("Nothing to send today.");

  await api("POST", "/emails", { subject, body, status: "about_to_send", filters }, { "X-Buttondown-Live-Dangerously": "true" });
  console.log(`::notice::Sent to ${due.join(", ")}.`);
  // Mark who got today's email, so later runs this morning skip them.
  for (const s of subs.filter(s => due.includes(s.metadata.timezone))) {
    try { await api("PATCH", `/subscribers/${s.id}`, { metadata: { ...s.metadata, last_sent: localDate(s.metadata.timezone, now) } }); }
    catch (e) { console.log(`::warning::Could not mark ${s.id} as sent: ${e.message}`); }
  }
}

main().catch(e => { console.error(`::error::${e.message}`); process.exit(1); });
