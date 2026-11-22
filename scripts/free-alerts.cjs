// Free model alerts: once a day, emails the people who asked for it (Buttondown metadata free_alerts = "yes")
// the AI models that became free yesterday on OpenRouter or OpenCode, and the ones that stopped being free
// (with the paid price when OpenRouter still sells the model).
// It compares yesterday's end-of-day free list with the day before's, so each new free model is announced
// once. It runs in the morning email workflow; the email's slug includes the date, and Buttondown refuses a
// second email with the same slug, so a later run the same day can't send it twice.
// Without BUTTONDOWN_API_KEY, or with DRY_RUN=1, it only prints what it would send.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DAILY = path.join(ROOT, "data", "api", "daily");
const SITE = "https://upcurrent.dev/";
const API = "https://api.buttondown.com/v1";
const key = process.env.BUTTONDOWN_API_KEY;
const FIRST_UTC_HOUR = 8, LAST_UTC_HOUR = 12; // send window, so it lands in the UK morning

const isChat = f => !/^(lyria|jev)\b/i.test(f.name);
const k = f => f.prov + "|" + f.name;
const dayStr = d => d.toISOString().slice(0, 10);
const read = day => { try { return JSON.parse(fs.readFileSync(path.join(DAILY, day + ".json"), "utf8")); } catch { return null; } };
// The paid price of a model that stopped being free, when OpenRouter still sells it (data/api/llm-pricing.json).
let PRICES = null;
const paid = f => {
  if (f.prov !== "OpenRouter" || !f.url) return null;
  try { PRICES = PRICES || JSON.parse(fs.readFileSync(path.join(ROOT, "data", "api", "llm-pricing.json"), "utf8")).models; } catch { return null; }
  const m = PRICES.find(p => p.id === f.url.replace("https://openrouter.ai/", "").replace(/:free$/, ""));
  return m ? `$${m.in} in / $${m.out} out per million tokens` : null;
};
const ctx = n => !n ? "" : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M tokens` : `${Math.round(n / 1000)}K tokens`;

async function main() {
  const now = new Date(), h = now.getUTCHours();
  if (!process.env.FORCE && (h < FIRST_UTC_HOUR || h >= LAST_UTC_HOUR)) return console.log(`Free alerts: outside the ${FIRST_UTC_HOUR}:00-${LAST_UTC_HOUR}:00 UTC window, skipping`);
  const y = new Date(now - 864e5), y2 = new Date(now - 2 * 864e5);
  const a = read(dayStr(y2)), b = read(dayStr(y));
  if (!a || !b) return console.log("Free alerts: missing daily data, skipping");
  const before = new Set((a.free || []).filter(isChat).map(k)), after = new Set((b.free || []).filter(isChat).map(k));
  const added = (b.free || []).filter(isChat).filter(f => !before.has(k(f)));
  const ended = (a.free || []).filter(isChat).filter(f => !after.has(k(f)));
  if (!added.length && !ended.length) return console.log(`Free alerts: no free model changes on ${dayStr(y)}`);

  const day = new Date(dayStr(y) + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  const subject = added.length && ended.length ? `${added.length} went free, ${ended.length} stopped being free (${day})`
    : added.length ? (added.length === 1 ? `Now free: ${added[0].name}` : `${added.length} AI models went free on ${day}`)
    : (ended.length === 1 ? `No longer free: ${ended[0].name}` : `${ended.length} AI models stopped being free on ${day}`);
  const lines = added.map(f => `- **${f.url ? `[${f.name}](${f.url})` : f.name}** on ${f.prov}${f.ctx ? `, ${ctx(f.ctx)} context` : ""}${f.prov === "OpenCode Zen" ? " (works inside OpenCode)" : ""}`);
  const endLines = ended.map(f => { const p = paid(f); return `- **${f.url ? `[${f.name}](${p ? f.url.replace(/:free$/, "") : f.url})` : f.name}** on ${f.prov}${p ? `: now paid, ${p}` : ": no longer free"}`; });
  const body = [added.length ? `These AI models became free on ${day}:\n\n${lines.join("\n")}` : "",
    ended.length ? `**These stopped being free on ${day}.** If you use one, switch to another free model or check the paid price before your next request:\n\n${endLines.join("\n")}` : "",
    `Free offers often end within a couple of weeks. [See every free model right now](${SITE}free-ai-models/) or [how long free models usually last](${SITE}free-ai-models/history/).`,
    "You're getting this because you signed up for Upcurrent's free model alerts."].filter(Boolean).join("\n\n");
  console.log(`::notice::Free alert for ${dayStr(y)}: ${subject}`);
  console.log(body);
  if (!key || process.env.DRY_RUN === "1") return console.log("Free alerts: dry run, not sending");

  const headers = { Authorization: `Token ${key}`, "Content-Type": "application/json", "X-Buttondown-Live-Dangerously": "true" };
  const r = await fetch(API + "/emails", { method: "POST", headers, body: JSON.stringify({
    subject, body, status: "about_to_send", slug: `free-model-alert-${dayStr(y)}`,
    filters: { filters: [{ field: "subscriber.metadata.free_alerts", operator: "equals", value: "yes" }], groups: [], predicate: "and" },
    metadata: { kind: "free-alert", day: dayStr(y) } }) });
  const t = await r.text();
  if (r.ok) return console.log(`::notice::Free alert sent for ${dayStr(y)}`);
  if (/slug/i.test(t)) return console.log(`Free alerts: already sent for ${dayStr(y)}`);
  throw new Error(`Buttondown ${r.status}: ${t.slice(0, 300)}`);
}
main().catch(e => { console.log(`::warning::Free alerts failed: ${e.message}`); });
