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
const SITE = "https://anmolsrivastavadev-pixel.github.io/upcurrent/";
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

const CSS = `:root{--bg:#eef1f4;--paper:#fff;--ink:#0f1829;--muted:#566276;--line:#d6dce4;--link:#2a45cf;--up:#12895f;--chip:#e3e8ee;--band:#0f1829;--band-ink:#e9eef6;--warm:#ef9b2d;
--font-display:"Bricolage Grotesque","Avenir Next",system-ui,sans-serif;--font-body:"Schibsted Grotesk","Helvetica Neue",system-ui,sans-serif;--font-mono:"JetBrains Mono",ui-monospace,"SF Mono",monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0c111a;--paper:#131a26;--ink:#e8edf5;--muted:#95a1b5;--line:#232d3f;--link:#8fa3ff;--up:#3fd09a;--chip:#1c2535;--band:#19223a;--band-ink:#e8edf5;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0c111a;--paper:#131a26;--ink:#e8edf5;--muted:#95a1b5;--line:#232d3f;--link:#8fa3ff;--up:#3fd09a;--chip:#1c2535;--band:#19223a;--band-ink:#e8edf5;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--font-body);-webkit-font-smoothing:antialiased}
a{color:var(--link)}.wrap{max-width:820px;margin:0 auto;padding-inline:16px}
header{border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:14px;flex-wrap:wrap}
.logo{font:800 21px/1 var(--font-display);letter-spacing:-.03em;color:var(--ink);text-decoration:none}
main{padding-block:36px 56px;display:grid;gap:36px}main>section{min-width:0}
h1{font:800 clamp(28px,6vw,42px)/1.08 var(--font-display);letter-spacing:-.035em;margin:0 0 12px;text-wrap:balance}
h2{font:700 22px/1.2 var(--font-display);letter-spacing:-.02em;margin:0 0 12px}
p{margin:0 0 10px;max-width:68ch}.lede{font-size:18px;color:var(--muted)}
.eyebrow{font:600 11.5px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--up);margin-bottom:12px}
ol.rows,ul.rows{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.rows li{padding-block:12px;border-bottom:1px solid var(--line);display:grid;gap:3px;min-width:0}
.rows .t{font-weight:600;overflow-wrap:anywhere}.rows .m{color:var(--muted);font-size:14.5px;overflow-wrap:anywhere}
.num{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.stats{display:flex;flex-wrap:wrap;gap:10px 22px;margin:14px 0 0;padding:0;list-style:none;color:var(--muted);font-size:15px}.stats b{color:var(--ink)}
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
<style>${CSS}</style>
${ld.map(ldJson).join("\n")}
</head><body>
<header><div class="wrap"><a class="logo notranslate" translate="no" href="${up}">Upcurrent</a><span style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span id="langPick"></span><a href="${up}daily/">Daily archive</a><a href="${up}">Live dashboard</a></span></div></header>
<main class="wrap">
${body}
<section class="cta"><h2>Get this in your inbox at 7am</h2><p>One free email each morning with the AI repos, models and stories that are picking up speed. Your own time zone, no spam.</p><p><a href="${up}#signup">Sign up on the dashboard</a></p></section>
</main>
<footer><div class="wrap">Upcurrent tracks what is rising in AI every 30 minutes, from GitHub, Hugging Face, arXiv, Hacker News, AI lab blogs, news sites and model providers. Numbers are as recorded at the time. <a href="${up}data.html">Open data (CC BY 4.0)</a></div></footer>
<script src="${up}translate.js"></script>
</body></html>
`;
}

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

  const latest = days.length ? data[days[days.length - 1]].about?.updated : new Date().toISOString();
  const urls = [
    { loc: SITE, lastmod: latest, changefreq: "hourly", priority: "1.0" },
    { loc: SITE + "daily/", lastmod: latest, changefreq: "daily", priority: "0.8" },
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
