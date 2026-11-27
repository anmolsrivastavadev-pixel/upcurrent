// Real newsletter numbers for the site's signup boxes, from Buttondown's API.
// Writes data/api/newsletter.json with counts only (never emails or names). Runs in the publish job.
// Without BUTTONDOWN_API_KEY, or if Buttondown fails, it leaves the last saved file alone.
//
// SHOW_FROM: the site only shows the numbers once this many people get the morning email.
// Change it here (0 shows them straight away). Numbers are never rounded up or padded.
const SHOW_FROM = 50;

const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "..", "data/api/newsletter.json");
const key = process.env.BUTTONDOWN_API_KEY;
if (!key) { console.log("Newsletter stats: no BUTTONDOWN_API_KEY, keeping the last file."); process.exit(0); }

const API = "https://api.buttondown.com/v1";
const headers = { Authorization: `Token ${key}` };
async function get(url) {
  const r = await fetch(url.startsWith("http") ? url : API + url, { headers });
  if (!r.ok) throw new Error(`Buttondown ${r.status} on ${url.replace(API, "")}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function all(url, max = 50) {
  const rows = [];
  for (let n = 0; url && n < max; n++) { const p = await get(url); rows.push(...(p.results || [])); url = p.next; }
  return rows;
}

async function main() {
  // Confirmed subscribers only ("regular"); unconfirmed sign-ups aren't counted.
  const subs = await all("/subscribers?type=regular");
  const alertsOnly = subs.filter(s => s.metadata?.alerts_only === "yes" && !s.metadata?.timezone).length;
  const morning = subs.length - alertsOnly;

  // Morning emails sent in the last 7 days (free model alerts are left out).
  const since = Date.now() - 7 * 864e5;
  const emails = (await all("/emails?status=sent&ordering=-publish_date", 5))
    .filter(e => !String(e.slug || "").startsWith("free-model-alert") && !/^\[test\]/.test(e.subject || ""))
    .filter(e => Date.parse(e.publish_date || e.creation_date) >= since);

  // Unique people: someone who opened three emails counts once.
  let recipients = 0;
  const openers = new Set(), clickers = new Set();
  const who = ev => ev.subscriber_id || ev.subscriber?.id || ev.subscriber || ev.email_address || ev.id;
  async function events(id, type) {
    for (const t of [type, "subscriber." + type]) {
      try { return await all(`/events?email_id=${id}&event_type=${t}`, 20); } catch (e) { if (!/ 400 /.test(e.message)) throw e; }
    }
    return [];
  }
  for (const e of emails) {
    const a = await get(`/emails/${e.id}/analytics`).catch(() => ({}));
    recipients += a.recipients || 0;
    for (const ev of await events(e.id, "opened")) openers.add(who(ev));
    for (const ev of await events(e.id, "clicked")) clickers.add(who(ev));
  }

  const stats = {
    updated: new Date().toISOString(),
    subscribers: subs.length,
    morning_email_subscribers: morning,
    last_7_days: {
      emails_sent: emails.length,
      deliveries: recipients,
      people_who_opened: openers.size,
      people_who_clicked: clickers.size,
      open_rate: morning ? Math.min(100, Math.round(openers.size / morning * 100)) : null
    },
    show_on_site: morning >= SHOW_FROM,
    show_from: SHOW_FROM,
    notes: "Counts from Buttondown. Opens tracked from 24 Nov 2026. Some mail apps (Apple Mail) report an open automatically, so the open rate can read high."
  };
  fs.writeFileSync(out, JSON.stringify(stats, null, 2) + "\n");
  console.log(`::notice::Newsletter: ${morning} morning email subscribers (${subs.length} total). Last 7 days: ${emails.length} emails, ${openers.size} people opened, ${clickers.size} clicked. Shown on site: ${stats.show_on_site}.`);
}

main().catch(e => { console.log(`::warning::Newsletter stats skipped: ${e.message}`); });
