// Posts the morning top 3 to Bluesky and Mastodon, once a day, from data/api/today.json.
// Each network switches on when its secrets exist:
//   Bluesky:  BSKY_HANDLE + BSKY_APP_PASSWORD (the same ones the data job uses for search)
//   Mastodon: MASTODON_INSTANCE (e.g. https://mastodon.social) + MASTODON_TOKEN (needs write:statuses)
// Runs from the morning email workflow, which fires every 15-30 minutes. It posts on the first run
// between POST_HOUR and LAST_HOUR UK time, and checks the account's own latest post so it never posts twice a day.
// DRY_RUN=1 only prints the posts.
const fs = require("fs");
const path = require("path");

const SITE = "https://anmolsrivastavadev-pixel.github.io/upcurrent/";
const TZ = "Europe/London", POST_HOUR = 8, LAST_HOUR = 13;
const dry = process.env.DRY_RUN === "1";

const today = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "api", "today.json"), "utf8"));
const now = new Date();
const ukDate = d => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const ukHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
const dayLabel = new Date(today.about.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const pageUrl = `${SITE}daily/${today.about.updated.slice(0, 10)}.html`;
const fmt = n => Number(n || 0).toLocaleString("en-GB");
const cut = (s, n) => s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";

// Every number here comes straight from today's data.
function lines() {
  const out = [], seen = new Set();
  for (const r of today.rising || []) {
    if (out.length === 3) break;
    const key = (r.owner ? r.owner + "/" : "") + r.name;
    if (seen.has(key)) continue;
    seen.add(key);
    const gh = (today.github || []).find(g => g.repo === key);
    const what = gh ? `+${fmt(gh.d24)} GitHub stars in 24h` : r.src === "hf" ? `trending ${r.cat ? r.cat.toLowerCase() + " " : ""}model on Hugging Face` : r.src === "paper" ? "trending paper" : r.src === "ph" ? "Product Hunt launch" : (r.meta || [])[1] || r.cat || "";
    out.push(`${out.length + 1}. ${cut(r.name, 40)}${r.owner && r.src !== "paper" ? ` by ${cut(r.owner, 24)}` : ""}${what ? `: ${what}` : ""}`);
  }
  return out;
}

// Bluesky links a few words to the page (plus a link card) instead of spelling out the long address.
const LINK_WORDS = "See the full list";
function text(limit, tags = "", short = false) {
  const head = `What's rising in AI today (${dayLabel}):`, tail = short ? `${LINK_WORDS}, updated every 30 min.` : `Full list, updated every 30 min: ${pageUrl}`;
  let ls = lines();
  const join = () => [head, "", ...ls, "", tail + (tags ? "\n\n" + tags : "")].join("\n");
  // Bluesky counts graphemes; drop the last line until it fits.
  while ([...join()].length > limit && ls.length > 1) ls = ls.slice(0, -1);
  return ls.length ? join() : null;
}

async function json(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : {};
}

async function bluesky() {
  const { BSKY_HANDLE: id, BSKY_APP_PASSWORD: pw } = process.env;
  if (!id || !pw) return console.log("Bluesky: no BSKY_HANDLE / BSKY_APP_PASSWORD, skipped");
  const body = text(300, "", true);
  if (!body) return console.log("Bluesky: nothing to post");
  if (dry) return console.log(`Bluesky would post:\n${body}\n`);
  const PDS = "https://bsky.social/xrpc";
  const s = await json(`${PDS}/com.atproto.server.createSession`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: id, password: pw }) });
  const auth = { Authorization: `Bearer ${s.accessJwt}` };
  const feed = await json(`${PDS}/app.bsky.feed.getAuthorFeed?actor=${s.did}&limit=10&filter=posts_no_replies`, { headers: auth });
  if ((feed.feed || []).some(f => f.post.author.did === s.did && f.post.record?.text?.startsWith("What's rising in AI today") && ukDate(new Date(f.post.record.createdAt)) === ukDate(now)))
    return console.log("Bluesky: already posted today");
  // Links are only clickable on Bluesky with a facet (byte offsets), and the card needs its own embed.
  const enc = new TextEncoder(), start = enc.encode(body.slice(0, body.lastIndexOf(LINK_WORDS))).length;
  const record = {
    $type: "app.bsky.feed.post", text: body, createdAt: now.toISOString(), langs: ["en"],
    facets: [{ index: { byteStart: start, byteEnd: start + enc.encode(LINK_WORDS).length }, features: [{ $type: "app.bsky.richtext.facet#link", uri: pageUrl }] }],
    embed: { $type: "app.bsky.embed.external", external: { uri: pageUrl, title: `What was rising in AI on ${dayLabel}`, description: "The AI repos, models, papers and stories picking up speed, from Upcurrent." } }
  };
  try {
    const img = fs.readFileSync(path.join(__dirname, "..", "og.png"));
    const up = await json(`${PDS}/com.atproto.repo.uploadBlob`, { method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: img });
    record.embed.external.thumb = up.blob;
  } catch (e) { console.log("Bluesky: card image skipped:", e.message); }
  const r = await json(`${PDS}/com.atproto.repo.createRecord`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record }) });
  console.log(`::notice::Posted to Bluesky: ${r.uri}`);
}

async function mastodon() {
  const host = (process.env.MASTODON_INSTANCE || "").replace(/\/+$/, ""), token = process.env.MASTODON_TOKEN;
  if (!host || !token) return console.log("Mastodon: no MASTODON_INSTANCE / MASTODON_TOKEN, skipped");
  const body = text(500, "#AI #MachineLearning #LLM #OpenSource");
  if (!body) return console.log("Mastodon: nothing to post");
  if (dry) return console.log(`Mastodon would post:\n${body}\n`);
  const auth = { Authorization: `Bearer ${token}` };
  const me = await json(`${host}/api/v1/accounts/verify_credentials`, { headers: auth });
  const recent = await json(`${host}/api/v1/accounts/${me.id}/statuses?limit=10&exclude_replies=true&exclude_reblogs=true`, { headers: auth });
  if (recent.some(p => p.content.includes("rising in AI today") && ukDate(new Date(p.created_at)) === ukDate(now)))
    return console.log("Mastodon: already posted today");
  const r = await json(`${host}/api/v1/statuses`, { method: "POST", headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": "upcurrent-" + ukDate(now) }, body: JSON.stringify({ status: body, visibility: "public", language: "en" }) });
  console.log(`::notice::Posted to Mastodon: ${r.url}`);
}

(async () => {
  if (!dry && (ukHour < POST_HOUR || ukHour >= LAST_HOUR)) return console.log(`Not posting: it's ${ukHour}:00 UK, posts go out between ${POST_HOUR}:00 and ${LAST_HOUR}:00`);
  if (!dry && Date.now() - Date.parse(today.about.updated) > 6 * 36e5) return console.log("Not posting: today's data is more than 6 hours old");
  for (const [name, fn] of [["Bluesky", bluesky], ["Mastodon", mastodon]]) {
    try { await fn(); } catch (e) { console.log(`::warning::${name} post failed: ${e.message}`); }
  }
})();
