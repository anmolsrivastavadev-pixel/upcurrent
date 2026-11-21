// Builds the search-engine extras right before each publish. Nothing here is committed;
// it only changes the copy of the site that goes to GitHub Pages.
//   - daily/YYYY-MM-DD.html: one plain, crawlable page per day from data/api/daily/*.json
//   - daily/index.html: the archive of those pages
//   - sitemap.xml: every public page, with real last-changed times
//   - index.html: optionally filled with the rendered dashboard (see --prerender) so search
//     engines and link previews see today's content without running JavaScript
//   - new-urls.txt (in $RUNNER_TEMP): pages that are new since the live sitemap, for IndexNow
// Usage: node scripts/build-seo.cjs [--prerender path/to/dumped-dom.html]
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://upcurrent.dev/";
const DAILY_JSON = path.join(ROOT, "data", "api", "daily");
const DAILY_OUT = path.join(ROOT, "daily");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = u => /^https?:\/\//i.test(String(u || "")) ? u : null;
const link = (u, text) => safeUrl(u) ? `<a href="${esc(u)}" rel="nofollow noopener">${esc(text)}</a>` : esc(text);
const fmt = n => Number(n || 0).toLocaleString("en-GB");
const longDate = day => new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = day => new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const clip = (s, n) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
const ldJson = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

// Colours, fonts and sizes come from the shared tokens.css (linked in page()).
const CSS = `*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--font-body);-webkit-font-smoothing:antialiased}
a{color:var(--link)}.wrap{max-width:820px;margin:0 auto;padding-inline:16px}
header{border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:14px;flex-wrap:wrap}
.logo{font:800 21px/1 var(--font-display);letter-spacing:-.03em;color:var(--ink);text-decoration:none}
main{padding-block:36px 56px;display:grid;gap:36px}main>section{min-width:0}
h1{font:800 clamp(28px,6vw,42px)/1.08 var(--font-display);letter-spacing:-.035em;margin:0 0 12px;text-wrap:balance}
h2{font:700 22px/1.2 var(--font-display);letter-spacing:-.02em;margin:0 0 12px}
p{margin:0 0 10px;max-width:68ch}.lede{font-size:18px;color:var(--muted)}
.eyebrow{font:600 11.5px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--up-text);margin-bottom:12px}
ol.rows,ul.rows{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.rows li{padding-block:12px;border-bottom:1px solid var(--line);display:grid;gap:3px;min-width:0}
.rows .t{font-weight:600;overflow-wrap:anywhere}.rows .m{color:var(--muted);font-size:14.5px;overflow-wrap:anywhere}
.num{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.stats{display:flex;flex-wrap:wrap;gap:10px 22px;margin:14px 0 0;padding:0;list-style:none;color:var(--muted);font-size:15px}.stats b{color:var(--ink)}
.share{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}.share a{font-weight:600}
.guides{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}.guides a,.guides b{padding:6px 12px;border:1px solid var(--line);border-radius:999px;font-size:14px;text-decoration:none}.guides b{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.asof{font-size:14px;color:var(--muted);margin-top:12px}.tag{font:700 11px var(--font-mono);padding:2px 6px;border-radius:4px;background:var(--badge-up);color:#fff;vertical-align:2px}
h3{font:700 17px/1.3 var(--font-display);margin:18px 0 6px}
.pager{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.cta{padding:22px clamp(16px,4vw,30px);background:var(--band);color:var(--band-ink);border-radius:14px;display:grid;gap:10px}
.cta h2{margin:0}.cta p{margin:0;opacity:.85}.cta a{color:var(--warm);font-weight:700}
footer{border-top:1px solid var(--line);padding-block:22px;color:var(--muted);font-size:14px}
.lang-pick{position:relative;display:inline-flex;align-items:center;gap:6px;color:var(--muted)}.lang-pick svg{width:16px;height:16px;flex:none}
.lang-pick select{appearance:none;-webkit-appearance:none;font:inherit;font-size:14px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:7px 10px;max-width:160px;cursor:pointer}
iframe.skiptranslate,.goog-te-banner-frame,#goog-gt-tt,.goog-te-balloon-frame,.VIpgJd-ZVi9od-ORHb-OEVmcd,.VIpgJd-ZVi9od-aZ2wEe-wOHMyf{display:none!important}
body{top:0!important}font[style]{background:none!important;box-shadow:none!important}`;

function page({ title, description, canonical, body, ld, ogType = "article", up = "../" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0f1829">
<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/json" title="Upcurrent open data" href="${up}data/api/today.json">
<meta property="og:site_name" content="Upcurrent">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Upcurrent: what's rising in AI today">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}og.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Schibsted+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${up}tokens.css">
<style>${CSS}</style>
${ld.map(ldJson).join("\n")}
</head><body>
<header><div class="wrap"><a class="logo notranslate" translate="no" href="${up}">Upcurrent</a><span style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span id="langPick"></span><a href="${up}free-ai-models/">Free models</a><a href="${up}daily/">Daily archive</a><a href="${up}">Live dashboard</a></span></div></header>
<main class="wrap">
${body}
<section class="cta"><h2>Get this in your inbox at 7am</h2><p>One free email each morning with the AI repos, models and stories that are picking up speed. Your own time zone, no spam.</p><p><a href="${up}#signup">Sign up on the dashboard</a></p></section>
</main>
<footer><div class="wrap">Upcurrent tracks what is rising in AI every 30 minutes, from GitHub, Hugging Face, arXiv, Hacker News, AI lab blogs, news sites and model providers. Numbers are as recorded at the time. <a href="${up}data.html">Open data (CC BY 4.0)</a> · ${GUIDES.map(g => `<a href="${up}${g.slug}/">${esc(g.short)}</a>`).join(" · ")}</div></footer>
<script src="${up}translate.js"></script>
</body></html>
`;
}

const shareLinks = (url, title) => {
  const msg = encodeURIComponent(`${title}, from Upcurrent: ${url}`), u = encodeURIComponent(url);
  return [["X", `https://x.com/intent/post?text=${msg}`], ["Bluesky", `https://bsky.app/intent/compose?text=${msg}`], ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["WhatsApp", `https://wa.me/?text=${msg}`], ["Reddit", `https://www.reddit.com/submit?url=${u}&title=${encodeURIComponent(title)}`]]
    .map(([n, h]) => `<a href="${esc(h)}" target="_blank" rel="noopener">${n}</a>`).join("");
};
const breadcrumb = items => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) });

function dailyPage(day, d, prev, next) {
  const url = `${SITE}daily/${day}.html`;
  const rising = d.rising || [], gh = d.github || [], models = d.models || [], news = d.headlines || [], disc = d.discussions || [], bo = d.breakouts || [], rc = d.receipts || [];
  const top = rising[0];
  const title = `AI trends on ${shortDate(day)}: rising repos, models and news | Upcurrent`;
  const lead = [
    top && `The fastest-rising AI project was ${top.owner ? top.owner + "/" : ""}${top.name}${top.cat ? ` (${top.cat})` : ""}.`,
    gh[0] && `The top GitHub repo gained ${fmt(gh[0].d24)} stars in 24 hours (${gh[0].repo}).`,
    bo[0] && `${bo[0].label} was breaking out across ${bo[0].n} sources.`
  ].filter(Boolean).join(" ");
  const description = clip(`What was rising in AI on ${shortDate(day)}. ${lead}`, 160);
  const P = d.pulse || {};
  const sec = (id, h, inner) => inner ? `<section id="${id}"><h2>${h}</h2>${inner}</section>` : "";
  const list = (items, fn, tag = "ol") => items.length ? `<${tag} class="rows">${items.map(fn).join("")}</${tag}>` : "";
  const body = `<section>
  <div class="eyebrow">Daily AI trends · ${esc(longDate(day))}</div>
  <h1>What was rising in AI on ${esc(shortDate(day))}</h1>
  <p class="lede">${esc(lead || "The AI repos, models, papers and stories that picked up speed today.")}</p>
  <ul class="stats">
    ${P.trending != null ? `<li><b class="num">${fmt(P.trending)}</b> items trending</li>` : ""}
    ${P.newModels != null ? `<li><b class="num">${fmt(P.newModels)}</b> new models</li>` : ""}
    ${P.discussions != null ? `<li><b class="num">${fmt(P.discussions)}</b> discussions</li>` : ""}
    ${P.stars ? `<li><b class="num">${fmt(P.stars)}</b> GitHub stars gained by tracked AI repos</li>` : ""}
  </ul>
  <p style="font-size:14px;color:var(--muted);margin-top:12px">Last recorded ${esc(new Date(d.about?.updated || day).toUTCString().replace("GMT", "UTC"))}.</p>
</section>
${sec("rising", "Top movers", list(rising, r => `<li><span class="t">${link(r.url, (r.owner ? r.owner + "/" : "") + r.name)}</span><span class="m">${esc([r.cat, `momentum ${r.score}`, r.grow ? `up ${r.grow}% in a day` : null, ...(r.meta || [])].filter(Boolean).join(" · "))}</span>${r.desc ? `<span class="m">${esc(r.desc)}</span>` : ""}</li>`))}
${sec("breakouts", "Breaking out", list(bo, b => `<li><span class="t">${esc(b.label)}</span><span class="m">Named on ${b.n} sources: ${(b.sources || []).map(s => `${esc(s.src)}: ${link(s.url, s.t)}`).join("; ")}</span></li>`, "ul"))}
${sec("github", "Fastest-growing AI repos on GitHub", list(gh, g => `<li><span class="t">${link("https://github.com/" + g.repo, g.repo)}</span><span class="m"><span class="num">+${fmt(g.d24)}</span> stars in 24h${g.est ? " (estimated)" : ""} · <span class="num">${fmt(g.stars)}</span> stars · ${fmt(g.forks)} forks</span></li>`))}
${sec("models", "Trending models on Hugging Face", list(models, m => `<li><span class="t">${link(`https://huggingface.co/${m.org}/${m.name}`, `${m.org}/${m.name}`)}</span><span class="m">${esc([m.cat, m.lic, `${fmt(m.dl)} downloads`, m.likes != null ? `${fmt(m.likes)} likes` : null].filter(Boolean).join(" · "))}</span></li>`))}
${sec("receipts", "Called it", list(rc, r => `<li><span class="t">${link(r.url, r.name)}</span><span class="m">Tracked at ${fmt(r.firstV)} ${esc(r.kind)} on ${esc(new Date(r.first).toUTCString().slice(5, 22))} UTC, passed ${fmt(r.m)} on ${esc(new Date(r.at).toUTCString().slice(5, 22))} UTC</span></li>`, "ul"))}
${sec("discussions", "Most-discussed threads", list(disc, t => `<li><span class="t">${link(t.url, t.t)}</span><span class="m">${esc(t.src)}${t.up != null ? ` · ${fmt(t.up)} points` : ""}${t.com != null ? ` · ${fmt(t.com)} comments` : ""}</span></li>`))}
${sec("news", "AI headlines", list(news, h => `<li><span class="t">${link(h.url, h.t)}</span><span class="m">${esc([h.src, h.kind].filter(Boolean).join(" · "))}</span></li>`, "ul"))}
<section class="share" aria-label="Share this page"><b>Share this list:</b> ${shareLinks(url, `What was rising in AI on ${shortDate(day)}`)}</section>
<nav class="pager" aria-label="Other days">${prev ? `<a href="${prev}.html" rel="prev">← ${esc(shortDate(prev))}</a>` : "<span></span>"}<a href="./">All days</a>${next ? `<a href="${next}.html" rel="next">${esc(shortDate(next))} →</a>` : "<span></span>"}</nav>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: `What was rising in AI on ${shortDate(day)}`, description, url, mainEntityOfPage: url, datePublished: `${day}T00:00:00Z`, dateModified: d.about?.updated || `${day}T23:59:59Z`, image: SITE + "og.png", inLanguage: "en", author: { "@type": "Organization", name: "Upcurrent", url: SITE }, publisher: { "@type": "Organization", name: "Upcurrent", url: SITE, logo: { "@type": "ImageObject", url: SITE + "icon-512.png" } }, isAccessibleForFree: true },
    breadcrumb([["Upcurrent", SITE], ["Daily archive", SITE + "daily/"], [shortDate(day), url]])
  ];
  return page({ title, description, canonical: url, body, ld });
}

function archivePage(days, data) {
  const url = SITE + "daily/";
  const items = [...days].reverse().map(day => {
    const d = data[day], top = (d.rising || [])[0], gh = (d.github || [])[0];
    const sub = [top && `Top mover: ${top.owner ? top.owner + "/" : ""}${top.name}`, gh && `top repo +${fmt(gh.d24)} stars (${gh.repo})`].filter(Boolean).join(" · ");
    return `<li><span class="t"><a href="${day}.html">${esc(longDate(day))}</a></span>${sub ? `<span class="m">${esc(sub)}</span>` : ""}</li>`;
  }).join("");
  const body = `<section><div class="eyebrow">Archive</div><h1>Daily AI trends archive</h1><p class="lede">One page per day with the AI repos, models, papers, threads and headlines that were rising, as Upcurrent recorded them. Times are UTC.</p></section>
<section><ol class="rows">${items}</ol></section>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: "Daily AI trends archive", url, description: "Every day of AI trends Upcurrent has recorded.", hasPart: days.map(day => ({ "@type": "Article", headline: `What was rising in AI on ${shortDate(day)}`, url: `${SITE}daily/${day}.html` })) },
    breadcrumb([["Upcurrent", SITE], ["Daily archive", url]])
  ];
  return page({ title: "Daily AI trends archive: every day of rising repos, models and news | Upcurrent", description: "A day-by-day archive of the AI repos, models, papers, threads and headlines that were rising, recorded by Upcurrent every 30 minutes.", canonical: url, body, ld, ogType: "website" });
}


// Evergreen guide pages: one stable address per question people search for, rebuilt from the latest data on
// every publish. Each takes the last 7 daily files so the lists are fuller and steadier than a single day.
const GUIDES = [
  { slug: "free-ai-models", title: "Free AI models you can use right now", short: "Free AI models" },
  { slug: "trending-ai-github-repos", title: "Trending AI GitHub repos this week", short: "Trending AI repos" },
  { slug: "new-ai-models", title: "New AI models this week on Hugging Face", short: "New AI models" }
];
const capsOf = caps => {
  const all = (caps || []).join(" ").toLowerCase(), out = [];
  if (/image/.test(all)) out.push("images");
  if (/audio/.test(all)) out.push("audio");
  if (/video/.test(all)) out.push("video");
  if (/pdf|file/.test(all)) out.push("files");
  if (/reason/.test(all)) out.push("reasoning");
  if (/tool/.test(all)) out.push("tool calling");
  return out;
};
const ctxLabel = n => !n ? null : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M tokens` : `${Math.round(n / 1e3)}K tokens`;
const guideNav = cur => `<nav class="guides" aria-label="Guides">${GUIDES.map(g => g.slug === cur ? `<b>${esc(g.short)}</b>` : `<a href="../${g.slug}/">${esc(g.short)}</a>`).join("")}</nav>`;
const faq = qa => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
const faqHtml = qa => `<section id="faq"><h2>Questions</h2>${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}</section>`;
const asOf = iso => new Date(iso).toUTCString().replace(/:\d\d GMT$/, " UTC");

function guidePages(days, data) {
  const recent = days.slice(-7), last = data[days[days.length - 1]], updated = last.about?.updated || new Date().toISOString();
  const out = {};

  // 1. Free models: today's full list, newest additions first, plus every add/remove seen this week.
  {
    const g = GUIDES[0], url = `${SITE}${g.slug}/`, free = last.free || [];
    const byProv = free.reduce((a, f) => (a[f.prov] = (a[f.prov] || 0) + 1, a), {});
    const events = [...new Map(recent.flatMap(d => data[d].freeChanges?.events || []).map(e => [e.type + e.name + e.prov + e.at, e])).values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const provs = Object.entries(byProv).map(([p, n]) => `${n} on ${p}`).join(" and ");
    const lead = `Right now you can call ${free.length} AI models for free: ${provs}. Upcurrent checks both lists every 30 minutes, so this page shows what is actually free today, not last month.`;
    const qa = [
      ["Which AI models are free to use right now?", `As of ${asOf(updated)}, ${free.length} models were free to call: ${free.slice(0, 6).map(f => f.name).join(", ")}${free.length > 6 ? " and more" : ""}. The full list is on this page and updates every 30 minutes.`],
      ["Where can I call free AI models?", `OpenRouter and OpenCode Zen both offer models at zero cost. You sign up, create an API key and pick a model marked free. Free models often have rate limits and can be removed without notice.`],
      ["How often do free AI models change?", `Often. This week Upcurrent saw ${events.filter(e => e.type === "added").length} free models added and ${events.filter(e => e.type === "removed").length} removed across both providers.`]
    ];
    const body = `<section><div class="eyebrow">Guide · updated every 30 minutes</div><h1>${esc(g.title)}</h1><p class="lede">${esc(lead)}</p>${guideNav(g.slug)}<p class="asof">Last checked ${esc(asOf(updated))}.</p></section>
<section id="list"><h2>All ${free.length} free models</h2><ol class="rows">${free.map(f => `<li><span class="t">${f.added ? `<span class="tag">New today</span> ` : ""}${link(f.url, f.name)}</span><span class="m">${esc([f.prov, ctxLabel(f.ctx) && `${ctxLabel(f.ctx)} context`, capsOf(f.caps).join(", ")].filter(Boolean).join(" · "))}</span></li>`).join("")}</ol></section>
${events.length ? `<section id="changes"><h2>Added and removed this week</h2><ul class="rows">${events.slice(0, 30).map(e => `<li><span class="t">${e.type === "added" ? "Added" : "Removed"}: ${link(e.url, e.name)}</span><span class="m">${esc(e.prov)} · ${esc(asOf(e.at))}</span></li>`).join("")}</ul></section>` : ""}
${faqHtml(qa)}`;
    out[g.slug] = page({ title: `Free AI models you can use right now (${free.length} today) | Upcurrent`, description: clip(`${free.length} AI models you can call for free today on OpenRouter and OpenCode Zen, with context size and features. Checked every 30 minutes.`, 160), canonical: url, body, up: "../", ogType: "article",
      ld: [{ "@context": "https://schema.org", "@type": "ItemList", name: g.title, url, numberOfItems: free.length, itemListElement: free.map((f, i) => ({ "@type": "ListItem", position: i + 1, name: f.name, ...(safeUrl(f.url) ? { url: f.url } : {}) })) }, faq(qa), breadcrumb([["Upcurrent", SITE], [g.short, url]])] });
  }

  // 2. Trending repos: every repo that made the daily list this week, ranked by its best day.
  {
    const g = GUIDES[1], url = `${SITE}${g.slug}/`, seen = new Map();
    for (const d of recent) for (const r of data[d].github || []) {
      const cur = seen.get(r.repo) || { repo: r.repo, best: 0, bestDay: d, days: 0, stars: 0, forks: 0 };
      cur.days++; if (r.d24 > cur.best) { cur.best = r.d24; cur.bestDay = d; }
      cur.stars = Math.max(cur.stars, r.stars || 0); cur.forks = Math.max(cur.forks, r.forks || 0);
      seen.set(r.repo, cur);
    }
    const repos = [...seen.values()].sort((a, b) => b.best - a.best);
    const lead = repos.length ? `${repos.length} young AI repositories were gaining GitHub stars fastest over the last ${recent.length} days. Top of the list: ${repos[0].repo}, which gained ${fmt(repos[0].best)} stars in a single day.` : "The AI repositories gaining GitHub stars fastest this week.";
    const qa = [
      ["What are the trending AI repos on GitHub this week?", repos.length ? `The fastest-rising this week were ${repos.slice(0, 5).map(r => r.repo).join(", ")}. Upcurrent ranks young AI repositories by stars gained per day.` : "See the list on this page."],
      ["How does Upcurrent find trending AI repos?", "Every 30 minutes it searches GitHub for recently created AI repositories, compares their star counts with earlier readings, and ranks them by stars gained per day. A day's best gain is used here so one quiet day doesn't hide a breakout."],
      ["Are star counts a sign of quality?", "Not on their own. Stars show attention. Check the code, licence, issues and recent commits before you rely on a project."]
    ];
    const body = `<section><div class="eyebrow">Guide · last ${recent.length} days</div><h1>${esc(g.title)}</h1><p class="lede">${esc(lead)}</p>${guideNav(g.slug)}<p class="asof">Last checked ${esc(asOf(updated))}.</p></section>
<section id="list"><h2>Ranked by best day</h2><ol class="rows">${repos.map(r => `<li><span class="t">${link("https://github.com/" + r.repo, r.repo)}</span><span class="m"><span class="num">+${fmt(r.best)}</span> stars on ${esc(shortDate(r.bestDay))} · <span class="num">${fmt(r.stars)}</span> stars · ${fmt(r.forks)} forks · on the list ${r.days} ${r.days === 1 ? "day" : "days"} · <a href="../daily/${r.bestDay}.html">see that day</a></span></li>`).join("")}</ol></section>
${faqHtml(qa)}`;
    out[g.slug] = page({ title: `Trending AI GitHub repos this week (${shortDate(days[days.length - 1])}) | Upcurrent`, description: clip(lead, 160), canonical: url, body, up: "../",
      ld: [{ "@context": "https://schema.org", "@type": "ItemList", name: g.title, url, numberOfItems: repos.length, itemListElement: repos.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.repo, url: "https://github.com/" + r.repo })) }, faq(qa), breadcrumb([["Upcurrent", SITE], [g.short, url]])] });
  }

  // 3. New models: every trending Hugging Face model seen this week, newest release first.
  {
    const g = GUIDES[2], url = `${SITE}${g.slug}/`, seen = new Map();
    for (const d of recent) for (const m of data[d].models || []) {
      const k = m.org + "/" + m.name, cur = seen.get(k);
      if (!cur || (m.dl || 0) > (cur.dl || 0)) seen.set(k, { ...m, lastDay: d });
    }
    const models = [...seen.values()].sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));
    const open = models.filter(m => /open/i.test(m.lic || "")).length;
    const lead = `${models.length} newly released models were trending on Hugging Face over the last ${recent.length} days, ${open} of them open source. Newest first, with downloads so far.`;
    const qa = [
      ["What new AI models came out this week?", models.length ? `Trending new releases on Hugging Face this week include ${models.slice(0, 5).map(m => `${m.org}/${m.name}`).join(", ")}.` : "See the list on this page."],
      ["Can I download these models?", "Most are hosted on Hugging Face and can be downloaded there. Check each model's licence: open source and open weights licences allow different uses."],
      ["How are models picked?", "Upcurrent reads Hugging Face's trending list every 30 minutes and keeps models released recently, so older popular models don't crowd out new ones."]
    ];
    const body = `<section><div class="eyebrow">Guide · last ${recent.length} days</div><h1>${esc(g.title)}</h1><p class="lede">${esc(lead)}</p>${guideNav(g.slug)}<p class="asof">Last checked ${esc(asOf(updated))}.</p></section>
<section id="list"><h2>Newest first</h2><ol class="rows">${models.map(m => `<li><span class="t">${link(`https://huggingface.co/${m.org}/${m.name}`, `${m.org}/${m.name}`)}</span><span class="m">${esc([m.at && `released ${shortDate(m.at.slice(0, 10))}`, m.cat, m.lic, `${fmt(m.dl)} downloads`, m.likes != null ? `${fmt(m.likes)} likes` : null].filter(Boolean).join(" · "))}</span></li>`).join("")}</ol></section>
${faqHtml(qa)}`;
    out[g.slug] = page({ title: `New AI models this week: trending on Hugging Face | Upcurrent`, description: clip(lead, 160), canonical: url, body, up: "../",
      ld: [{ "@context": "https://schema.org", "@type": "ItemList", name: g.title, url, numberOfItems: models.length, itemListElement: models.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: `${m.org}/${m.name}`, url: `https://huggingface.co/${m.org}/${m.name}` })) }, faq(qa), breadcrumb([["Upcurrent", SITE], [g.short, url]])] });
  }
  return out;
}

// Copies the dashboard's rendered sections into index.html so the first byte already holds today's content.
// The page's script re-renders the same places from data/latest.json as soon as it loads.
const PRERENDER_IDS = ["ticker", "dateline", "headline", "brief", "pulse", "pills", "boList", "hypeList", "risingList", "rcList", "modelGrid", "ghBody", "disc", "newToday", "newsList", "freeSub", "freeBody"];
function innerById(html, id) {
  const open = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
  if (!open) return null;
  const tag = open[1].toLowerCase(), start = open.index + open[0].length;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[1]) { if (--depth === 0) return html.slice(start, m.index); }
    else if (!m[0].endsWith("/>")) depth++;
  }
  return null;
}
function prerender(src, dumped) {
  const filled = {};
  for (const id of PRERENDER_IDS) {
    const inner = innerById(dumped, id);
    if (inner == null) throw new Error(`#${id} not found in the rendered page`);
    if (/<script/i.test(inner)) throw new Error(`#${id} holds a script`);
    filled[id] = inner;
  }
  if (!filled.headline.trim() || !filled.risingList.includes("<a")) throw new Error("the rendered page has no movers");
  if (!/Live · updated/.test(dumped)) throw new Error("the rendered page did not load live data");
  let out = src;
  for (const id of PRERENDER_IDS) {
    const re = new RegExp(`(<([a-zA-Z][\\w-]*)\\b[^>]*\\bid="${id}"[^>]*>)(</\\2>)`);
    if (!re.test(out)) throw new Error(`#${id} is not empty in index.html`);
    out = out.replace(re, (_, a, _t, b) => a + filled[id].replace(/\$/g, "$$$$") + b);
  }
  return out.replace("<html lang=\"en\">", "<html lang=\"en\" data-prerendered>");
}

(async () => {
  const args = process.argv.slice(2);
  const days = fs.readdirSync(DAILY_JSON).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => f.slice(0, 10)).sort();
  const data = Object.fromEntries(days.map(d => [d, JSON.parse(fs.readFileSync(path.join(DAILY_JSON, d + ".json"), "utf8"))]));
  fs.mkdirSync(DAILY_OUT, { recursive: true });
  days.forEach((day, i) => fs.writeFileSync(path.join(DAILY_OUT, day + ".html"), dailyPage(day, data[day], days[i - 1], days[i + 1])));
  fs.writeFileSync(path.join(DAILY_OUT, "index.html"), archivePage(days, data));
  console.log(`Wrote ${days.length} daily pages and the archive`);
  const guides = days.length ? guidePages(days, data) : {};
  for (const [slug, html] of Object.entries(guides)) { fs.mkdirSync(path.join(ROOT, slug), { recursive: true }); fs.writeFileSync(path.join(ROOT, slug, "index.html"), html); }
  console.log(`Wrote ${Object.keys(guides).length} guide pages`);

  const latest = days.length ? data[days[days.length - 1]].about?.updated : new Date().toISOString();
  const urls = [
    { loc: SITE, lastmod: latest, changefreq: "hourly", priority: "1.0" },
    { loc: SITE + "daily/", lastmod: latest, changefreq: "daily", priority: "0.8" },
    ...Object.keys(guides).map(slug => ({ loc: `${SITE}${slug}/`, lastmod: latest, changefreq: "hourly", priority: "0.9" })),
    { loc: SITE + "email.html", lastmod: latest, changefreq: "daily", priority: "0.6" },
    { loc: SITE + "data.html", lastmod: latest, changefreq: "weekly", priority: "0.6" },
    ...days.map(day => ({ loc: `${SITE}daily/${day}.html`, lastmod: data[day].about?.updated || day, changefreq: day === days[days.length - 1] ? "hourly" : "monthly", priority: "0.7" }))
  ];
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`);
  console.log(`Wrote sitemap.xml with ${urls.length} addresses`);

  // Which addresses are new since the live site, so the publish step can tell Bing and others (IndexNow).
  if (process.env.RUNNER_TEMP) {
    let live = "";
    try { const r = await fetch(SITE + "sitemap.xml", { signal: AbortSignal.timeout(10000) }); if (r.ok) live = await r.text(); } catch {}
    const fresh = urls.map(u => u.loc).filter(l => !live.includes(`<loc>${l}</loc>`));
    // A new day also changes the home page and the archive.
    if (fresh.length) fresh.push(SITE, SITE + "daily/");
    fs.writeFileSync(path.join(process.env.RUNNER_TEMP, "new-urls.txt"), [...new Set(fresh)].join("\n"));
    console.log(`${fresh.length ? [...new Set(fresh)].length : 0} addresses to announce`);
  }

  const pi = args.indexOf("--prerender");
  if (pi >= 0) {
    try {
      const file = path.join(ROOT, "index.html");
      fs.writeFileSync(file, prerender(fs.readFileSync(file, "utf8"), fs.readFileSync(args[pi + 1], "utf8")));
      console.log("Filled index.html with the rendered dashboard");
    } catch (e) { console.error("Skipped filling index.html:", e.message); }
  }
})();
