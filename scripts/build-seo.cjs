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
const monthYear = day => new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
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
#langPick{display:inline-flex;min-width:160px;min-height:38px}.lang-pick{position:relative;display:inline-flex;align-items:center;gap:6px;color:var(--muted)}.lang-pick svg{width:16px;height:16px;flex:none}
.lang-pick select{appearance:none;-webkit-appearance:none;font:inherit;font-size:14px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:7px 10px;max-width:160px;cursor:pointer}
iframe.skiptranslate,.goog-te-banner-frame,#goog-gt-tt,.goog-te-balloon-frame,.VIpgJd-ZVi9od-ORHb-OEVmcd,.VIpgJd-ZVi9od-aZ2wEe-wOHMyf{display:none!important}
body{top:0!important}font[style]{background:none!important;box-shadow:none!important}
.nl,.nla{display:flex;flex-wrap:wrap;gap:8px}.alertbox{border:1px solid var(--line);border-radius:14px;padding:4px 18px 18px}.nl input[type=email],.nla input[type=email]{flex:1 1 220px;min-width:0;font:inherit;padding:11px 14px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink)}.nl button,.nla button{font:700 15px var(--font-body);padding:11px 18px;border-radius:10px;border:0;background:var(--warm);color:#111;cursor:pointer}
code{font:13.5px var(--font-mono);background:var(--code,var(--chip));color:var(--code-ink,var(--ink));padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}pre{background:var(--code,var(--chip));padding:14px 16px;border-radius:10px;overflow-x:auto;max-width:100%}pre code{padding:0;background:none;overflow-wrap:normal}
.finder{display:flex;flex-wrap:wrap;gap:8px}.finder label{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:6px 14px;border:1px solid var(--line);border-radius:999px;font-size:14.5px;cursor:pointer}.finder input{width:18px;height:18px;accent-color:var(--hot)}
.tablewrap{overflow-x:auto;margin:12px 0}.tablewrap table{border-collapse:collapse;width:100%;font-size:14.5px}.tablewrap th,.tablewrap td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.tablewrap thead th{font-weight:600}.tablewrap tbody th{font-weight:500;width:28%}.chart{margin:16px 0}.chart img{display:block;max-width:100%;height:auto;border-radius:14px}.chart figcaption{font-size:14px;color:var(--ink-2,inherit);opacity:.8;margin-top:6px}`;

// Contextual internal links for pages whose body copy had few: each links to its cluster's hub,
// a sibling page and the email signup (the money page).
const RELATED = {
  "/trending-ai-github-repos/": `Many of these repos run on free models: see <a href="/free-ai-models/">free AI models you can use right now</a> and <a href="/free-ai-models/coding-tools/">free AI coding tools</a>. For models rather than code, see <a href="/new-ai-models/">new AI models this week</a>. Each repo that reached the top 5 has its own page in <a href="/what-is/">New AI projects explained</a>, and the <a href="/email.html">free morning email</a> sends the list to you daily.`,
  "/free-ai-models/": `To call these models from your own code, start with the <a href="/free-ai-models/api/">free LLM API guide</a> and <a href="/free-ai-models/free-llm-api-key/">how to get a free API key</a>. To see how long free models usually last, check the <a href="/free-ai-models/history/">free AI model tracker</a>. For brand-new releases, see <a href="/new-ai-models/">new AI models this week</a>, and get changes by <a href="/email.html">free morning email</a>.`,
  "/free-ai-models/history/": `For the models that are free today, see the <a href="/free-ai-models/">free AI models list</a> or the <a href="/free-ai-models/openrouter/">OpenRouter free models list</a>. Because free models disappear, the <a href="/free-ai-models/api/">free LLM API guide</a> suggests keeping a backup provider. The same data is free to reuse under CC BY 4.0 from <a href="/data.html">Upcurrent's open data</a>.`,
  "/free-ai-models/opencode/": `OpenCode's free models only work inside OpenCode. To call free models from your own code, see the <a href="/free-ai-models/openrouter/">OpenRouter free models list</a> and the <a href="/free-ai-models/api/">free LLM API guide</a>. Other free editors and agents are in <a href="/free-ai-models/coding-tools/">free AI coding tools</a>, and the <a href="/free-ai-models/coding/">best free models for coding</a> are ranked here.`,
  "/free-ai-models/openrouter/": `To start calling these, follow <a href="/free-ai-models/free-llm-api-key/">how to get a free LLM API key</a>. To weigh OpenRouter against other providers, see <a href="/free-ai-models/openrouter-vs-gemini/">OpenRouter vs Gemini</a> and <a href="/free-ai-models/openrouter-vs-groq/">OpenRouter vs Groq</a>. To see how long free OpenRouter models usually stay free, check the <a href="/free-ai-models/history/">free AI model tracker</a>.`,
  "/free-ai-models/image-and-speech/": `For text models, see the <a href="/free-ai-models/api/">free LLM API guide</a>. Provider details are on the <a href="/free-ai-models/gemini/">Gemini free tier</a>, <a href="/free-ai-models/groq/">Groq free API</a> and <a href="/free-ai-models/cloudflare/">Cloudflare Workers AI</a> pages, and new image models show up first in <a href="/new-ai-models/">new AI models this week</a>.`,
  "/what-is/": `For the whole list as it stands today, see <a href="/trending-ai-github-repos/">trending AI GitHub repos</a> and <a href="/new-ai-models/">new AI models this week</a>. Every day's list is kept in the <a href="/daily/">daily archive</a>, and the <a href="/email.html">free morning email</a> sends the top movers to you daily.`,
  "/daily/": `For this week's picture, see <a href="/trending-ai-github-repos/">trending AI GitHub repos</a>, <a href="/new-ai-models/">new AI models</a> and <a href="/free-ai-models/">free AI models</a>. Projects that reached the top 5 are explained one by one in <a href="/what-is/">New AI projects explained</a>. How the ranking works is on the <a href="/about/">about page</a>.`,
  "/about/": `See the method in action on the <a href="/">live dashboard</a>, the <a href="/daily/">daily archive</a> and the <a href="/free-ai-models/history/">free AI model tracker</a>. The raw numbers are free to reuse from <a href="/data.html">Upcurrent's open data</a>, and the <a href="/email.html">free morning email</a> brings the top movers to you daily.`,
  "/new-ai-models/open-source/": `For every new release, open or not, see <a href="/new-ai-models/">new AI models this week</a> and the <a href="/new-ai-models/tracker/">AI model release tracker</a>. Many open models can also be used for free through an API: see <a href="/free-ai-models/">free AI models you can use right now</a>.`,
  "/new-ai-models/tracker/": `For this week only, see <a href="/new-ai-models/">new AI models this week</a> and <a href="/new-ai-models/open-source/">new open source AI models</a>. To find out how long free models usually stay free, check the <a href="/free-ai-models/history/">free AI model tracker</a>. All of this data is free to reuse from <a href="/data.html">Upcurrent's open data</a>.`
};
// Free model alerts signup (scripts/free-alerts.cjs sends them). Alert-only subscribers are marked so the
// morning email leaves them out.
const ALERT_PAGES = new Set(["/free-ai-models/", "/free-ai-models/history/", "/free-ai-models/openrouter/", "/free-ai-models/api/", "/free-ai-models/opencode/"]);
const ALERT_FORM = `<section id="alerts" class="alertbox"><h2>Get an email when a new AI model goes free</h2><p>One short email on the days a model becomes free on OpenRouter or OpenCode, and nothing on other days. Free offers often end within two weeks, so alerts help you catch them. Unsubscribe any time.</p><form class="nla" action="https://buttondown.com/api/emails/embed-subscribe/anmolsrivastavadev" method="post" target="_blank" onsubmit="try{window.goatcounter&&goatcounter.count&&goatcounter.count({path:'free-alert-signup',title:'Free model alert signup',event:true})}catch(e){}"><input type="email" name="email" required placeholder="you@example.com" aria-label="Email address for free model alerts" autocomplete="email"><input type="hidden" name="metadata__free_alerts" value="yes"><input type="hidden" name="metadata__alerts_only" value="yes"><button type="submit">Alert me</button></form></section>`;
function page({ title, description, canonical, body, ld, ogType = "article", up = "../" }) {
  // On-page rules: title under 60 characters (drop the brand suffix when it would push it over),
  // and the single H1 mirrors the title.
  const bare = title.replace(/\s*\|\s*Upcurrent.*$/, "");
  if (title.length > 60) title = bare;
  body = body.replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${esc(bare)}</h1>`);
  body = body.replace(/(<figure class="chart"><img [^>]*?) loading="lazy"/, "$1 fetchpriority=\"high\""); // first chart is often the largest thing on screen, so load it straight away
  if (ALERT_PAGES.has(canonical.replace(SITE, "/"))) body = body.replace(/(<section id="picks"|<section id="take"|<section id="list"|<section class="share")/, `${ALERT_FORM}\n$1`);
  const rel = RELATED[canonical.replace(SITE, "/")];
  if (rel) body = body.replace(/(<section class="share"|$)/, `<section><h2>Related guides</h2><p>${rel}</p></section>\n$1`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0f1829">
<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/json" title="Upcurrent open data" href="${up}data/api/today.json">
<link rel="alternate" type="application/rss+xml" title="Upcurrent daily AI trends" href="${up}feed.xml">
<meta property="og:site_name" content="Upcurrent">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Upcurrent: what's rising in AI today">
<meta name="twitter:image:alt" content="Upcurrent: what's rising in AI today">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}og.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Schibsted+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=optional" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Schibsted+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=optional"></noscript>
<link rel="stylesheet" href="${up}tokens.css">
<style>${CSS}</style>
${ld.map(ldJson).join("\n")}
</head><body>
<header><div class="wrap"><a class="logo notranslate" translate="no" href="${up}">Upcurrent</a><span style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span id="langPick"></span><a href="${up}free-ai-models/">Free models</a><a href="${up}what-is/">Explained</a><a href="${up}daily/">Daily archive</a><a href="${up}">Live dashboard</a></span></div></header>
<main class="wrap">
${body}
<section class="cta" id="signup"><h2>Get this in your inbox at 7am</h2><p>One free email each morning with the AI repos, models and stories that are picking up speed, including new free models. Your own time zone, no spam.</p>
<form class="nl" action="https://buttondown.com/api/emails/embed-subscribe/anmolsrivastavadev" method="post" target="_blank"><input type="email" name="email" required placeholder="you@example.com" aria-label="Email address" autocomplete="email"><input type="hidden" name="metadata__timezone" value="Europe/London"><button type="submit">Subscribe free</button></form>
<p><a href="${up}email.html">See today's email</a></p></section>
</main>
<footer><div class="wrap">Upcurrent tracks what is rising in AI every 30 minutes, from GitHub, Hugging Face, arXiv, Hacker News, AI lab blogs, news sites and model providers. Numbers are as recorded at the time. <a href="${up}data.html">Open data (CC BY 4.0)</a> · ${GUIDES.map(g => `<a href="${up}${g.slug}/">${esc(g.short)}</a>`).join(" · ")} · <a href="${up}what-is/">New AI projects explained</a> · <a href="${up}reports/">Weekly reports</a> · <a href="${up}about/">About</a> · <a href="${up}faq/">FAQ</a></div></footer>
<script>try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z)document.querySelectorAll('input[name="metadata__timezone"]').forEach(function(i){i.value=z})}catch(e){}document.querySelectorAll("form.nl").forEach(function(f){f.addEventListener("submit",function(){try{window.goatcounter&&window.goatcounter.count&&window.goatcounter.count({path:"subscribe",title:"Subscribed (guide page)",event:true})}catch(e){}})})</script>
<script src="${up}translate.js"></script>
<script data-goatcounter="https://upcurrent.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
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
  const title = `AI trends ${shortDate(day)}: top repos, models, news | Upcurrent`;
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
${sec("rising", "Top movers", list(rising, r => `<li><span class="t">${link(r.url, (r.owner ? r.owner + "/" : "") + r.name)}${EXPLAIN.has(r.url) ? ` · <a href="../what-is/${EXPLAIN.get(r.url)}/">What is it?</a>` : ""}</span><span class="m">${esc([r.cat, `momentum ${r.score}`, r.grow ? `up ${r.grow}% in a day` : null, ...(r.meta || [])].filter(Boolean).join(" · "))}</span>${r.desc ? `<span class="m">${esc(r.desc)}</span>` : ""}</li>`))}
${sec("breakouts", "Breaking out", list(bo, b => `<li><span class="t">${esc(b.label)}</span><span class="m">Named on ${b.n} sources: ${(b.sources || []).map(s => `${esc(s.src)}: ${link(s.url, s.t)}`).join("; ")}</span></li>`, "ul"))}
${sec("github", "Fastest-growing AI repos on GitHub", list(gh, g => `<li><span class="t">${link("https://github.com/" + g.repo, g.repo)}</span><span class="m"><span class="num">+${fmt(g.d24)}</span> stars in 24h${g.est ? " (estimated)" : ""} · <span class="num">${fmt(g.stars)}</span> stars · ${fmt(g.forks)} forks</span></li>`))}
${sec("models", "Trending models on Hugging Face", list(models, m => `<li><span class="t">${link(`https://huggingface.co/${m.org}/${m.name}`, `${m.org}/${m.name}`)}</span><span class="m">${esc([m.cat, m.lic, `${fmt(m.dl)} downloads`, m.likes != null ? `${fmt(m.likes)} likes` : null].filter(Boolean).join(" · "))}</span></li>`))}
${sec("receipts", "Called it", list(rc, r => `<li><span class="t">${link(r.url, r.name)}</span><span class="m">Tracked at ${fmt(r.firstV)} ${esc(r.kind)} on ${esc(new Date(r.first).toUTCString().slice(5, 22))} UTC, passed ${fmt(r.m)} on ${esc(new Date(r.at).toUTCString().slice(5, 22))} UTC</span></li>`, "ul"))}
${sec("discussions", "Most-discussed threads", list(disc, t => `<li><span class="t">${link(t.url, t.t)}</span><span class="m">${esc(t.src)}${t.up != null ? ` · ${fmt(t.up)} points` : ""}${t.com != null ? ` · ${fmt(t.com)} comments` : ""}</span></li>`))}
${sec("news", "AI headlines", list(news, h => `<li><span class="t">${link(h.url, h.t)}</span><span class="m">${esc([h.src, h.kind].filter(Boolean).join(" · "))}</span></li>`, "ul"))}
<section><h2>Keep exploring</h2><p>Every project that reached the top 5 has its own page in <a href="../what-is/">New AI projects explained</a>. For this week's picture, see <a href="../trending-ai-github-repos/">trending AI GitHub repos</a> and <a href="../new-ai-models/">new AI models</a>, or check which <a href="../free-ai-models/">AI models are free right now</a>. Older days are in the <a href="./">daily archive</a>.</p></section>
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
  return page({ title: "Daily AI trends archive: rising repos, models, news | Upcurrent", description: "A day-by-day archive of the AI repos, models, papers, threads and headlines that were rising, recorded by Upcurrent every 30 minutes.", canonical: url, body, ld, ogType: "website" });
}


// Evergreen guide pages: one stable address per question people search for, rebuilt from the latest data on
// every publish. Each takes the last 7 daily files so the lists are fuller and steadier than a single day.
const GUIDES = [
  { slug: "free-ai-models", title: "Free AI models you can use right now", short: "Free AI models" },
  { slug: "trending-ai-github-repos", title: "GitHub trending repositories today: AI projects", short: "GitHub trending (AI)" },
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

  // 1. Free models: a hub page plus a cluster of pages for the longer searches around it.
  Object.assign(out, freeCluster(days, data, last, updated), providerPages(updated), extraPages(last));

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
    const lastDay = days[days.length - 1], today = [...(data[lastDay].github || [])].sort((a, b) => b.d24 - a.d24);
    // "Cool GitHub projects": this week's trending repos that come with a plain description of what they do.
    const coolMap = new Map();
    for (const d of recent) for (const r of data[d].rising || []) if (r.src === "gh" && r.desc && r.url && !/nsfw/i.test(r.name + r.desc) && (!coolMap.has(r.url) || coolMap.get(r.url).score < r.score)) coolMap.set(r.url, r);
    const cool = [...coolMap.values()].sort((a, b) => b.score - a.score).slice(0, 8);
    const lead = repos.length ? `Discover GitHub projects before they blow up: GitHub trending repositories for AI, updated every 30 minutes. Not a huge list to hoard, only what's rising: ${repos.length} trending AI projects on GitHub gaining stars fastest over the last ${recent.length} days. Top of the list: ${repos[0].repo}, which gained ${fmt(repos[0].best)} stars in a single day.` : "GitHub trending repositories for AI: the new AI projects gaining stars fastest this week.";
    const qa = [
      ["How do I see GitHub trending repositories today?", `GitHub's own trending page (github.com/trending) covers every language and doesn't show numbers. This page follows only AI projects and shows how many stars each gained in a day, updated every 30 minutes.${today.length ? " Today's top trending AI repository is " + today[0].repo + "." : ""}`],
      ["Is there a GitHub trending API?", "GitHub's official API has no trending endpoint. Upcurrent publishes its trending AI repositories as free JSON (CC BY 4.0) that you can call from any app: see the free GitHub trending API page on this site."],
      ["What are the top trending GitHub repositories right now?", today.length ? `For AI projects, the top trending GitHub repositories right now are ${today.slice(0, 3).map(r => `${r.repo} (${r.est ? "~" : "+"}${fmt(r.d24)} stars in 24 hours)`).join(", ")}. The list updates every 30 minutes.` : "See the Trending today list on this page."],
      ["What are some cool GitHub projects right now?", cool.length ? `Some cool AI projects trending on GitHub this week: ${cool.slice(0, 3).map(r => `${r.owner}/${r.name} (${clip(r.desc, 70)})`).join("; ")}. The full list with descriptions is on this page.` : "See the list on this page."],
      ["What are some trending GitHub repos this week?", repos.length ? `The fastest-rising AI repos this week were ${repos.slice(0, 5).map(r => r.repo).join(", ")}. Upcurrent ranks young AI repositories by stars gained per day.` : "See the list on this page."],
      ["How does Upcurrent find trending AI repos?", "Every 30 minutes it searches GitHub for recently created AI repositories, compares their star counts with earlier readings, and ranks them by stars gained per day. A day's best gain is used here so one quiet day doesn't hide a breakout."],
      ["Are star counts a sign of quality?", "Not on their own. Stars show attention. Check the code, licence, issues and recent commits before you rely on a project."]
    ];
    const body = `<section><div class="eyebrow">Guide · last ${recent.length} days</div><h1>${esc(g.title)}</h1><p class="lede">${esc(lead)}</p>${guideNav(g.slug)}<p class="asof">Last checked ${esc(asOf(updated))}.</p></section>
${today.length ? `<section id="today"><h2>Trending today</h2><p>The AI repositories gaining the most GitHub stars in the last 24 hours. A <b>~</b> means the number is estimated from the repo's average so far, because Upcurrent hasn't seen it for 6 hours yet.</p><ol class="rows">${today.map(r => `<li><span class="t">${link("https://github.com/" + r.repo, r.repo)}</span><span class="m"><span class="num">${r.est ? "~" : "+"}${fmt(r.d24)}</span> stars in 24h · <span class="num">${fmt(r.stars)}</span> stars · ${fmt(r.forks)} forks</span></li>`).join("")}</ol></section>` : ""}
<section id="vs"><h2>How this differs from GitHub's trending page</h2><p><a href="https://github.com/trending" rel="noopener">GitHub's trending page</a> covers every language and topic, and doesn't say how many stars a repo gained. This list only follows new AI projects (created in the last 30 days, with 100+ stars), counts the stars each one gains per day from GitHub's official API, and keeps every day's list in the <a href="../github-trending-archive/">GitHub trending archive</a>. Want the data in your own app? Use the <a href="../github-trending-api/">free GitHub trending API</a>.</p></section>
${cool.length ? `<section id="cool"><h2>Cool AI GitHub projects to try this week</h2><p>Looking for cool, interesting GitHub projects rather than a leaderboard? These are the coolest open source AI projects trending on GitHub this week, with what each one actually does, in its own words.</p><ul class="rows">${cool.map(r => `<li><span class="t">${link(r.url, r.owner + "/" + r.name)}</span><span class="m">${esc(clip(r.desc, 150))}</span></li>`).join("")}</ul></section>` : ""}
${(() => { const u = repos.filter(r => r.stars).sort((a, b) => a.stars - b.stars).slice(0, 5); return u.length >= 3 ? `<section id="underrated"><h2>Underrated GitHub repos catching on early</h2><p>Underrated GitHub projects: the trending repos this week with the fewest total stars so far, so you can find them before everyone else does.</p><ol class="rows">${u.map(r => `<li><span class="t">${link("https://github.com/" + r.repo, r.repo)}</span><span class="m"><span class="num">+${fmt(r.best)}</span> stars on ${esc(shortDate(r.bestDay))} · <span class="num">${fmt(r.stars)}</span> stars total</span></li>`).join("")}</ol></section>` : ""; })()}
<section id="list"><h2>Trending GitHub repos this week, ranked by best day</h2><ol class="rows">${repos.map(r => `<li><span class="t">${link("https://github.com/" + r.repo, r.repo)}</span><span class="m"><span class="num">+${fmt(r.best)}</span> stars on ${esc(shortDate(r.bestDay))} · <span class="num">${fmt(r.stars)}</span> stars · ${fmt(r.forks)} forks · on the list ${r.days} ${r.days === 1 ? "day" : "days"} · <a href="../daily/${r.bestDay}.html">see that day</a></span></li>`).join("")}</ol></section>
${faqHtml(qa)}`;
    out[g.slug] = page({ title: today.length ? `GitHub Trending Repositories Today: AI (${today[0].est ? "~" : "+"}${fmt(today[0].d24)} stars today)` : `GitHub Trending Repositories Today: AI`, description: clip(lead, 160), canonical: url, body, up: "../",
      ld: [{ "@context": "https://schema.org", "@type": "ItemList", name: g.title, url, numberOfItems: repos.length, itemListElement: repos.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.repo, url: "https://github.com/" + r.repo })) }, faq(qa), breadcrumb([["Upcurrent", SITE], [g.short, url]])] });
  }
  // Content gaps: trending AI papers, MCP servers / Claude Code skills. Both read the latest raw fetch (refreshed every 30 minutes).
  let RAW = {};
  try { RAW = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "latest.json"), "utf8")).raw || {}; } catch {}
  {
    const hf = [...(RAW.hfPapers || [])].filter(p => p.id && p.title).sort((a, b) => (+b.upvotes || 0) - (+a.upvotes || 0));
    const ax = (RAW.arxiv || []).filter(p => p.t && p.url).slice(0, 15);
    const wk = new Map(); for (const d of recent) for (const r of data[d].rising || []) if (r.src === "paper" && r.url && !wk.has(r.url)) wk.set(r.url, { ...r, day: d });
    if (hf.length || ax.length) {
      const url = `${SITE}trending-ai-papers/`;
      const lede = `Trending AI research papers today: the ${hf.length} papers getting the most upvotes on Hugging Face Daily Papers, plus the newest AI papers on arXiv. Updated every 30 minutes, with a one-line summary of each.`;
      const qa = [
        ["What are the trending AI papers today?", hf.length ? `On Hugging Face Daily Papers, the most upvoted right now are ${hf.slice(0, 3).map(p => `"${p.title}" (${+p.upvotes || 0} upvotes)`).join(", ")}.` : "See the list on this page."],
        ["Where can I find trending AI research papers?", "Hugging Face Daily Papers, where researchers share new papers and the community upvotes them, and arXiv, where most AI papers are first published. This page puts both in one place."],
        ["What are Hugging Face trending papers?", "Hugging Face Daily Papers is a feed of new research papers, mostly on AI, that people upvote. The papers with the most upvotes are the ones the community is paying most attention to."],
        ["Which arXiv categories does this cover?", "Artificial intelligence (cs.AI), computation and language (cs.CL) and machine learning (cs.LG), newest first."],
        ["How often is this updated?", "Every 30 minutes, from Hugging Face's and arXiv's official APIs."]
      ];
      const body = `<section><div class="eyebrow">Research · updated every 30 minutes</div><h1>Trending AI research papers today</h1><p class="lede">${esc(lede)}</p><p class="asof">Last checked ${esc(asOf(updated))}.</p></section>
${hf.length ? `<section id="hf"><h2>Hugging Face trending papers</h2><p>From <a href="https://huggingface.co/papers" rel="noopener">Hugging Face Daily Papers</a>, most upvoted first.</p><ol class="rows">${hf.map(p => `<li><span class="t">${link("https://huggingface.co/papers/" + p.id, p.title)}</span><span class="m"><span class="num">▲ ${fmt(+p.upvotes || 0)}</span> upvotes · ${esc(clip(p.summary || "", 200))}</span></li>`).join("")}</ol></section>` : ""}
${wk.size ? `<section id="week"><h2>Popular AI papers this week</h2><p>Papers that made Upcurrent's daily list of what's rising across all of AI.</p><ul class="rows">${[...wk.values()].map(p => `<li><span class="t">${link(p.url, p.name)}</span><span class="m">${esc(clip(p.desc || "", 160))} · <a href="../daily/${p.day}.html">${esc(shortDate(p.day))}</a></span></li>`).join("")}</ul></section>` : ""}
${ax.length ? `<section id="arxiv"><h2>Newest AI papers on arXiv</h2><p>The latest submissions in cs.AI, cs.CL and cs.LG on <a href="https://arxiv.org/list/cs.AI/recent" rel="noopener">arXiv</a>.</p><ul class="rows">${ax.map(p => `<li><span class="t">${link(p.url, p.t)}</span><span class="m">${esc(shortDate((p.at || "").slice(0, 10) || days[days.length - 1]))}</span></li>`).join("")}</ul></section>` : ""}
<section><h2>Related</h2><p>For models rather than papers, see <a href="../new-ai-models/">new AI models and Hugging Face trending models</a>. For code, see <a href="../trending-ai-github-repos/">GitHub trending repositories today</a>.</p></section>
${faqHtml(qa)}`;
      out["trending-ai-papers"] = page({ title: "Trending AI Research Papers Today (Hugging Face, arXiv)", description: clip(lede, 160), canonical: url, body, up: "../",
        ld: [{ "@context": "https://schema.org", "@type": "ItemList", name: "Trending AI research papers", url, numberOfItems: hf.length, itemListElement: hf.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.title, url: "https://huggingface.co/papers/" + p.id })) }, faq(qa), breadcrumb([["Upcurrent", SITE], ["Trending AI papers", url]])] });
    }
  }
  {
    const gh = (RAW.github || []).filter(g => g.repo && !/nsfw/i.test(g.name + g.desc));
    const txt = g => `${g.name} ${g.desc} ${(g.topics || []).join(" ")}`.toLowerCase();
    const nd = g => `${g.name} ${g.desc}`.toLowerCase(), tp = g => (g.topics || []).join(" ");
    const mcp = gh.filter(g => /\bmcp\b|model.context.protocol/.test(nd(g)) || /\bmcp-server\b/.test(tp(g))).sort((a, b) => b.stars - a.stars);
    const skills = gh.filter(g => !mcp.includes(g) && (/claude.?code|\bskills?\b|agent.?skills|\bsubagents?\b/.test(nd(g)) || /\b(agent-skills|claude-skills|claude-code-skills|claude-code-plugin)\b/.test(tp(g)))).sort((a, b) => b.stars - a.stars);
    if (mcp.length + skills.length >= 4) {
      const url = `${SITE}mcp-servers-claude-code-skills/`;
      const ageD = g => Math.max(1, Math.round((Date.now() - Date.parse(g.created)) / 864e5));
      const row = g => `<li><span class="t">${link("https://github.com/" + g.repo, g.repo)}</span><span class="m"><span class="num">★ ${fmt(g.stars)}</span> in ${ageD(g)} ${ageD(g) === 1 ? "day" : "days"}${g.lang ? ` · ${esc(g.lang)}` : ""} · ${esc(clip(g.desc || "", 150))}</span></li>`;
      const lede = `The best new MCP servers and Claude Code skills on GitHub right now: ${mcp.length} MCP servers and ${skills.length} skills and agent add-ons from the last 30 days, ranked by GitHub stars. Updated every 30 minutes.`;
      const qa = [
        ["What are the best new MCP servers on GitHub?", mcp.length ? `By stars, the most popular new ones right now are ${mcp.slice(0, 3).map(g => `${g.repo} (${fmt(g.stars)} stars)`).join(", ")}. Check each repo's code and permissions before connecting it to your tools.` : "See the list on this page."],
        ["What are the best Claude Code skills on GitHub?", skills.length ? `The most starred new skills and agent add-ons right now include ${skills.slice(0, 3).map(g => `${g.repo} (${fmt(g.stars)} stars)`).join(", ")}.` : "See the list on this page."],
        ["What is an MCP server?", "MCP (Model Context Protocol) is an open standard for connecting AI assistants to tools and data. An MCP server gives an assistant like Claude, ChatGPT or an AI code editor a new ability, such as reading a database or controlling an app."],
        ["What are Claude Code skills?", "Skills are folders of instructions, scripts and files that Claude loads when they're relevant to a task, so it can follow a team's workflow or use a tool the same way every time."],
        ["Are these safe to install?", "Stars show popularity, not safety. MCP servers and skills can run code and reach your files, so read the code, check who made it, and only install ones you trust."],
        ["How are these picked?", "Upcurrent searches GitHub's official API every 30 minutes for AI repositories created in the last 30 days with more than 100 stars, then keeps those whose name, description or topics mention MCP, Claude Code or skills."]
      ];
      const body = `<section><div class="eyebrow">GitHub · updated every 30 minutes</div><h1>Best new MCP servers and Claude Code skills</h1><p class="lede">${esc(lede)}</p><p class="asof">Last checked ${esc(asOf(updated))}.</p></section>
${mcp.length ? `<section id="mcp"><h2>Best new MCP servers on GitHub</h2><p>MCP servers work with Claude Code, Claude Desktop, Cursor, OpenCode and other apps that support the <a href="https://modelcontextprotocol.io/" rel="noopener">Model Context Protocol</a>.</p><ol class="rows">${mcp.map(row).join("")}</ol></section>` : ""}
${skills.length ? `<section id="skills"><h2>Claude Code skills and agent add-ons</h2><p>Skills, subagents and add-ons for Claude Code and other coding agents. See <a href="https://code.claude.com/docs/en/skills" rel="noopener">Anthropic's guide to skills</a> for how to install one.</p><ol class="rows">${skills.map(row).join("")}</ol></section>` : ""}
<section><h2>Related</h2><p>Running Claude Code on a budget? See <a href="../free-ai-models/claude-code/">free models for Claude Code</a> and <a href="../free-ai-models/coding-tools/">free AI coding tools</a>. For every trending AI repo, see <a href="../trending-ai-github-repos/">GitHub trending repositories today</a>.</p></section>
${faqHtml(qa)}`;
      out["mcp-servers-claude-code-skills"] = page({ title: "Best New MCP Servers and Claude Code Skills on GitHub", description: clip(lede, 160), canonical: url, body, up: "../",
        ld: [{ "@context": "https://schema.org", "@type": "ItemList", name: "Best new MCP servers and Claude Code skills", url, numberOfItems: mcp.length + skills.length, itemListElement: [...mcp, ...skills].map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.repo, url: "https://github.com/" + g.repo })) }, faq(qa), breadcrumb([["Upcurrent", SITE], ["MCP servers and Claude Code skills", url]])] });
    }
  }
  // GitHub trending archive: every day's top AI repo since tracking began, plus a monthly best-of.
  {
    const url = `${SITE}github-trending-archive/`, rows = days.map(d => ({ d, top: [...(data[d].github || [])].sort((a, b) => b.d24 - a.d24) })).filter(x => x.top.length);
    const months = [...new Set(rows.map(x => x.d.slice(0, 7)))].reverse();
    const monthName = m => new Date(m + "-15T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    const bestOf = m => { const seen = new Map(); rows.filter(x => x.d.startsWith(m)).forEach(x => x.top.forEach(r => { const c = seen.get(r.repo); if (!c || r.d24 > c.d24) seen.set(r.repo, { ...r, day: x.d }); })); return [...seen.values()].sort((a, b) => b.d24 - a.d24); };
    const mb = Object.fromEntries(months.map(m => [m, bestOf(m)]));
    const first = rows[0].d, n = rows.length, prev = months[1];
    const lede = `A GitHub trending archive for AI: the top trending AI repository on every day since ${shortDate(first)} (${n} days), plus the biggest trending repos of each month. GitHub's own trending page doesn't keep past days; this does.`;
    const qa = [
      ["Is there a GitHub trending archive?", "GitHub's trending page only shows the current day, week or month and doesn't keep old lists. Upcurrent has saved its trending AI repositories every day since " + shortDate(first) + ", and every day is on this page."],
      [`What were the top trending GitHub AI repos in ${monthName(months[0])}?`, mb[months[0]].length ? mb[months[0]].slice(0, 3).map(r => `${r.repo} (${r.est ? "~" : "+"}${fmt(r.d24)} stars on ${shortDate(r.day)})`).join(", ") + "." : "See the list on this page."],
      ...(prev ? [[`What were the top trending GitHub AI repos in ${monthName(prev)}?`, mb[prev].slice(0, 3).map(r => `${r.repo} (${r.est ? "~" : "+"}${fmt(r.d24)} stars on ${shortDate(r.day)})`).join(", ") + "."]] : []),
      ["Is there a monthly GitHub trending list?", "Yes, each month on this page lists the AI repos with the biggest single-day star gains that month. GitHub's own monthly view covers all languages but only the current month."],
      ["Can I download the archive?", `Yes. Each day is a free JSON file at ${SITE}data/api/daily/YYYY-MM-DD.json (CC BY 4.0). See the free GitHub trending API page.`]
    ];
    const body = `<section><div class="eyebrow">Archive · ${n} days</div><h1>GitHub trending archive</h1><p class="lede">${esc(lede)}</p></section>
${months.map(m => `<section id="m-${m}"><h2>GitHub trending monthly: ${esc(monthName(m))}</h2><p><a href="../github-trending/${m}/">See every trending AI repo of ${esc(monthName(m))}</a></p><p>${fmt(mb[m].length)} AI repositories trended on GitHub in ${esc(monthName(m))}. The 10 with the biggest one-day star gains:</p><ol class="rows">${mb[m].slice(0, 10).map(r => `<li><span class="t">${link("https://github.com/" + r.repo, r.repo)}</span><span class="m"><span class="num">${r.est ? "~" : "+"}${fmt(r.d24)}</span> stars on <a href="../daily/${r.day}.html">${esc(shortDate(r.day))}</a> · <span class="num">${fmt(r.stars)}</span> stars then</span></li>`).join("")}</ol></section>`).join("\n")}
<section id="days"><h2>Every day's top trending AI repo</h2><div class="tablewrap"><table><thead><tr><th>Day</th><th>Top repo</th><th>Stars that day</th></tr></thead><tbody>${[...rows].reverse().map(x => `<tr><th scope="row"><a href="../daily/${x.d}.html">${esc(shortDate(x.d))}</a></th><td>${link("https://github.com/" + x.top[0].repo, x.top[0].repo)}</td><td class="num">${x.top[0].est ? "~" : "+"}${fmt(x.top[0].d24)}</td></tr>`).join("")}</tbody></table></div><p>A <b>~</b> means the day's number was estimated from the repo's average, because Upcurrent hadn't seen it for 6 hours yet. For what's trending right now, see <a href="../trending-ai-github-repos/">GitHub trending repositories today</a>. To use this data in your own app, see the <a href="../github-trending-api/">free GitHub trending API</a>.</p></section>
${faqHtml(qa)}`;
    out["github-trending-archive"] = page({ title: "GitHub Trending Archive: Every Day's Top AI Repo", description: clip(lede, 160), canonical: url, body, up: "../",
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["GitHub trending archive", url]])] });
  }
  // One page per month of trending AI repos, and a topic page for AI agents (the only topic with enough saved history).
  {
    const lastDay = days[days.length - 1];
    const info = new Map(); // repo -> description and topic, from the daily "rising" lists
    for (const d of days) { for (const r of data[d].rising || []) if (r.src === "gh") info.set(`${r.owner}/${r.name}`, { desc: r.desc, cat: r.cat }); for (const g of data[d].github || []) if (g.cat) info.set(g.repo, { desc: g.desc || info.get(g.repo)?.desc, cat: g.cat }); }
    const monthName = m => new Date(m + "-15T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    const months = [...new Set(days.map(d => d.slice(0, 7)))];
    const collect = ds => { const m = new Map(); for (const d of ds) for (const r of data[d].github || []) { const c = m.get(r.repo) || { repo: r.repo, best: 0, bestDay: d, est: false, days: 0, stars: 0 }; c.days++; if (r.d24 > c.best) { c.best = r.d24; c.bestDay = d; c.est = !!r.est; } c.stars = Math.max(c.stars, r.stars || 0); m.set(r.repo, c); } return [...m.values()].sort((a, b) => b.best - a.best); };
    const rowHtml = (r, up) => `<li><span class="t">${link("https://github.com/" + r.repo, r.repo)}</span><span class="m"><span class="num">${r.est ? "~" : "+"}${fmt(r.best)}</span> stars on <a href="${up}daily/${r.bestDay}.html">${esc(shortDate(r.bestDay))}</a> · <span class="num">${fmt(r.stars)}</span> stars · on the list ${r.days} ${r.days === 1 ? "day" : "days"}${info.get(r.repo)?.desc ? " · " + esc(clip(info.get(r.repo).desc, 140)) : ""}</span></li>`;
    months.forEach((m, i) => {
      const ds = days.filter(d => d.startsWith(m)), repos = collect(ds);
      if (ds.length < 7 || repos.length < 10) return;
      const name = monthName(m), url = `${SITE}github-trending/${m}/`, sofar = m === lastDay.slice(0, 7);
      const cats = Object.entries(repos.reduce((a, r) => { const c = info.get(r.repo)?.cat; if (c) a[c] = (a[c] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
      const most = [...repos].sort((a, b) => b.days - a.days)[0];
      const top10 = repos.slice(0, 10);
      const ch = chart(`github-trending/${m}/top-trending-ai-repos-${m}.svg`, `top-trending-ai-repos-${m}.svg`,
        { title: `Top trending AI repos on GitHub, ${name}`, sub: "Biggest single-day star gain", rows: top10.map(r => [r.repo, r.best]), horizontal: true, w: 600 },
        `Bar chart of the top trending AI GitHub repos in ${name} by biggest single-day star gain: ${top10.map(r => `${r.repo} ${fmt(r.best)}`).join(", ")}.`, `From Upcurrent's daily snapshots of GitHub's official API.`);
      const lede = `GitHub trending ${name}: the ${repos.length} AI repositories that trended on GitHub ${sofar ? "so far this month" : "that month"}, across ${ds.length} days of daily snapshots. Top of the month: ${repos[0].repo}, with ${repos[0].est ? "about " : ""}${fmt(repos[0].best)} stars in one day.`;
      const qa = [
        [`What were the top trending GitHub repos in ${name}?`, `For AI projects: ${repos.slice(0, 3).map(r => `${r.repo} (${r.est ? "~" : "+"}${fmt(r.best)} stars on ${shortDate(r.bestDay)})`).join(", ")}.`],
        [`Which repo stayed trending longest in ${name}?`, `${most.repo}, on Upcurrent's daily top list for ${most.days} ${most.days === 1 ? "day" : "days"}.`],
        ...(cats.length ? [[`What kind of AI projects trended in ${name}?`, cats.map(([c, n]) => `${c}: ${n}`).join(", ") + " (for repos Upcurrent described that month)."]] : []),
        ["How is this measured?", "Every 30 minutes Upcurrent asks GitHub's official API for AI repositories created in the last 30 days with 100+ stars, and records how many stars each gains per day. Each day's top repos are saved (the top 8 until 22 November 2026, the top 20 since); this page ranks every repo by its best single day."]
      ];
      const prev = months[i - 1], next = months[i + 1];
      const body = `<section><div class="eyebrow">GitHub trending · ${esc(name)}${sofar ? " · so far" : ""}</div><h1>GitHub trending ${esc(name)}</h1><p class="lede">${esc(lede)}</p></section>
<section id="top"><h2>Top 10 trending AI repos of ${esc(name)}</h2>${ch}</section>
<section id="list"><h2>Every trending AI repo in ${esc(name)}</h2><ol class="rows">${repos.map(r => rowHtml(r, "../../")).join("")}</ol></section>
<section><h2>More months</h2><p>${prev && collect(days.filter(d => d.startsWith(prev))).length >= 10 ? `<a href="../${prev}/">GitHub trending ${esc(monthName(prev))}</a> · ` : ""}${next ? `<a href="../${next}/">GitHub trending ${esc(monthName(next))}</a> · ` : ""}<a href="../../github-trending-archive/">Every day in the GitHub trending archive</a> · <a href="../../trending-ai-github-repos/">GitHub trending repositories today</a></p></section>
${faqHtml(qa)}`;
      out[`github-trending/${m}`] = page({ title: `GitHub Trending ${name}: Top ${repos.length} AI Repos`, description: clip(lede, 160), canonical: url, body, up: "../../",
        ld: [{ "@context": "https://schema.org", "@type": "ItemList", name: `GitHub trending ${name}`, url, numberOfItems: repos.length, itemListElement: repos.map((r, k) => ({ "@type": "ListItem", position: k + 1, name: r.repo, url: "https://github.com/" + r.repo })) }, faq(qa), breadcrumb([["Upcurrent", SITE], ["GitHub trending archive", SITE + "github-trending-archive/"], [name, url]])] });
    });

    // Other topics get a page only once enough repos have trended in them, so no thin pages go live.
    const TOPICS = { Coding: ["coding", "AI coding"], Infrastructure: ["infrastructure", "AI infrastructure"], Vision: ["vision", "AI image and video"], LLMs: ["llms", "LLM"], Robotics: ["robotics", "AI robotics"], Tools: ["tools", "AI tool"] };
    for (const [cat, [slug, label]] of Object.entries(TOPICS)) {
      const list = collect(days).filter(r => info.get(r.repo)?.cat === cat);
      if (list.length < 15) continue;
      const url = `${SITE}trending-ai-github-repos/${slug}/`;
      const lede = `Trending ${label} repos on GitHub: the ${list.length} ${label} projects that have trended since ${shortDate(days[0])}, ranked by their biggest single day of new stars. Updated every 30 minutes.`;
      const qa = [[`What are the trending ${label} repos on GitHub?`, `The biggest so far: ${list.slice(0, 3).map(r => `${r.repo} (${r.est ? "~" : "+"}${fmt(r.best)} stars on ${shortDate(r.bestDay)})`).join(", ")}.`],
        ["How is this measured?", "Upcurrent checks GitHub's official API every 30 minutes for AI repositories created in the last 30 days with 100+ stars, and records the stars each gains per day."]];
      const body = `<section><div class="eyebrow">GitHub trending · topic</div><h1>Trending ${esc(label)} repos on GitHub</h1><p class="lede">${esc(lede)}</p></section>
<section id="history"><h2>${esc(label)} repos that trended since ${esc(shortDate(days[0]))}</h2><ol class="rows">${list.map(r => rowHtml(r, "../../")).join("")}</ol></section>
<section><h2>Related</h2><p><a href="../">GitHub trending repositories today</a> · <a href="../agents/">Trending AI agent repos</a> · <a href="../../github-trending-archive/">GitHub trending archive</a></p></section>
${faqHtml(qa)}`;
      out[`trending-ai-github-repos/${slug}`] = page({ title: `Trending ${label} Repos on GitHub (${monthYear(lastDay)})`, description: clip(lede, 160), canonical: url, body, up: "../../",
        ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["GitHub trending (AI)", SITE + "trending-ai-github-repos/"], [label, url]])] });
    }

    // AI agents: history (repos tagged Agents) plus the agent repos in today's raw GitHub fetch.
    const agentRe = /\bagents?\b|\bagentic\b|autonomous|multi-agent/;
    const hist = collect(days).filter(r => info.get(r.repo)?.cat === "Agents");
    const now = (RAW.github || []).filter(g => g.repo && !/nsfw/i.test(g.name + g.desc) && agentRe.test(`${g.name} ${g.desc} ${(g.topics || []).join(" ")}`.toLowerCase())).sort((a, b) => b.stars - a.stars);
    if (hist.length >= 10) {
      const url = `${SITE}trending-ai-github-repos/agents/`;
      const ageD = g => Math.max(1, Math.round((Date.now() - Date.parse(g.created)) / 864e5));
      const lede = `Trending AI agent repos on GitHub: ${now.length} new agent projects gaining stars right now, and the ${hist.length} agent repos that have trended since ${shortDate(days[0])}. Updated every 30 minutes, from GitHub's official API.`;
      const qa = [
        ["What are the trending AI agent repos on GitHub right now?", now.length ? `By stars, among agent repos created in the last 30 days: ${now.slice(0, 3).map(g => `${g.repo} (${fmt(g.stars)} stars)`).join(", ")}.` : "See the list on this page."],
        ["Which AI agent repo trended hardest since October?", `${hist[0].repo}, with ${hist[0].est ? "about " : ""}${fmt(hist[0].best)} stars in one day on ${shortDate(hist[0].bestDay)}.`],
        ["How much of GitHub trending is AI agents?", `Of the ${info.size} AI repos Upcurrent described since ${shortDate(days[0])}, ${[...info.values()].filter(x => x.cat === "Agents").length} were agent projects, more than any other kind.`],
        ["Are these agents safe to run?", "Agents can run commands, browse and edit files for you. Read the code and the permissions it asks for, and try new ones in a sandbox first."]
      ];
      const body = `<section><div class="eyebrow">GitHub trending · topic</div><h1>Trending AI agent repos on GitHub</h1><p class="lede">${esc(lede)}</p><p class="asof">Last checked ${esc(asOf(updated))}.</p></section>
${now.length ? `<section id="now"><h2>New AI agent repos gaining stars now</h2><ol class="rows">${now.slice(0, 15).map(g => `<li><span class="t">${link("https://github.com/" + g.repo, g.repo)}</span><span class="m"><span class="num">★ ${fmt(g.stars)}</span> in ${ageD(g)} ${ageD(g) === 1 ? "day" : "days"}${g.lang ? ` · ${esc(g.lang)}` : ""} · ${esc(clip(g.desc || "", 140))}</span></li>`).join("")}</ol></section>` : ""}
<section id="history"><h2>AI agent repos that trended since ${esc(shortDate(days[0]))}</h2><ol class="rows">${hist.map(r => rowHtml(r, "../../")).join("")}</ol></section>
<section><h2>Related</h2><p>Tools for agents: <a href="../../mcp-servers-claude-code-skills/">best new MCP servers and Claude Code skills</a>. Free models to power them: <a href="../../free-ai-models/api/">free LLM API</a>. Everything trending: <a href="../">GitHub trending repositories today</a>.</p></section>
${faqHtml(qa)}`;
      out["trending-ai-github-repos/agents"] = page({ title: `Trending AI Agent Repos on GitHub (${monthYear(lastDay)})`, description: clip(lede, 160), canonical: url, body, up: "../../",
        ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["GitHub trending (AI)", SITE + "trending-ai-github-repos/"], ["AI agents", url]])] });
    }
  }
  // FAQ: the questions people ask before signing up. Every answer describes what the site does today.
  {
    const url = `${SITE}faq/`, free = (last.free || []).filter(isChat).length;
    const groups = [
      ["What Upcurrent is", [
        ["What does Upcurrent actually track?", "What's rising in AI, every 30 minutes: new AI repos on GitHub, new models and papers on Hugging Face, arXiv papers, AI discussions on Hacker News, Lobsters, DEV and Mastodon, AI lab blogs and news, and which AI models are free to use right now on OpenRouter and OpenCode Zen."],
        ["How is it different from GitHub's own Trending page?", "GitHub Trending covers every language and shows no numbers. Upcurrent only follows AI projects, shows how many stars each one gained in a day, adds models, papers and news alongside, and keeps every day in an archive. GitHub doesn't keep past trending lists."],
        ["How is it different from an awesome list or a newsletter like TLDR?", "Awesome lists are curated by hand and grow forever. Newsletters are written by editors once a day. Upcurrent is built from live numbers, updated every 30 minutes, and only shows what is gaining attention now, so it stays short."],
        ["Who is it for?", "Developers building with AI, AI hobbyists who want to try new tools early, and founders keeping an eye on what's taking off. You don't need to be an expert: every top project gets a plain-English explanation."],
        ["Who built it?", "An independent developer in the UK. It is not owned by an AI company, and nobody pays to be ranked."]]],
      ["Cost and catch", [
        ["Is Upcurrent free?", "Yes. The website, the daily email, the free model alerts and the open data are all free."],
        ["If it's free, what's the catch?", "There isn't one hidden in the data. Upcurrent will pay for itself with a clearly labelled sponsor message in the email. Sponsors never change the rankings, and your email address is never sold."],
        ["Will it always be free?", "The plan is to keep the site and the daily email free, paid for by sponsors rather than by readers."],
        ["Do I need a credit card to sign up?", "No. The email only asks for your email address. There's no account and no payment."]]],
      ["Data quality and freshness", [
        ["How often is the data updated?", "Every 30 minutes, around the clock. Each page shows when it was last checked."],
        ["Where does the data come from?", "Each source's official API or feed: GitHub, Hugging Face, arXiv, Hacker News, Lobsters, DEV, Mastodon, Techmeme, AI lab blogs, news APIs, YouTube, Product Hunt, OpenRouter and OpenCode Zen."],
        ["How do you decide a repo is rising and not just hyped?", "Rising means gaining attention fastest right now, measured by stars gained per day compared with everything else from the same source. A separate hype check compares how much a project is talked about with how much it's actually used, and says when the two don't match."],
        ["Are star counts real, or can they be gamed?", "The numbers are real counts from GitHub's API, never edited. Stars can be bought or gamed, though, and Upcurrent doesn't detect fake stars, so treat them as a sign of attention, not quality."],
        ["How do I know a free model is still free today?", `Upcurrent checks OpenRouter's and OpenCode Zen's model lists every 30 minutes. If a model stops being free, it disappears from the list at the next check. Right now ${free} chat models are free.`],
        ["Do you check rate limits and quotas?", "Yes, for the free API providers: the limits for OpenRouter, Groq, Gemini and Cloudflare are taken from each provider's own docs, with the date they were last checked shown on the page."],
        ["Can I see when a model stopped being free?", "Yes. The free AI model tracker lists every model that has been free since October 2026, the day it went free and the day it stopped."]]],
      ["Free AI models", [
        ["Which free models work with Claude Code, OpenCode or Cursor?", "OpenCode has free models built in, listed live on the OpenCode page. Cursor has its own free plan, covered on the free AI coding tools page. Claude Code is harder: it can connect to OpenRouter, but free models aren't guaranteed to work with it. The Claude Code page explains the honest options."],
        ["Is there a free LLM API I can use without a credit card?", "Yes: OpenRouter, Groq and Google Gemini all have free tiers that start without a card. The no-credit-card page has the details and limits."],
        ["Do you show model IDs and context windows?", "Yes. The free API pages list each free model's exact ID to paste into your code, and its context window where the provider gives one."],
        ["Which providers do you cover?", "Live, every 30 minutes: OpenRouter and OpenCode Zen. Checked by hand from their docs: Groq, Google Gemini, Cloudflare Workers AI and Cohere."]]],
      ["Filtering and noise", [
        ["Can I filter out AI repos if I only want other tools?", "No. Upcurrent is only about AI. For everything else on GitHub, GitHub's own Trending page is the better place."],
        ["Can I filter by language or topic?", "There's a filter box on the dashboard that searches by name or keyword, and topic pages for AI agents and for MCP servers and Claude Code skills. There's no programming-language filter yet."],
        ["Will this become another list I bookmark and never read?", "It's built to avoid that: it only shows what's rising now, not a growing pile, and the morning email brings the top of it to you so you don't have to remember to visit."]]],
      ["Email and alerts", [
        ["What do I get by email, and how often?", "One email a day at 7am in your own time zone, with the AI repos, models and stories picking up speed, plus new free models. Nothing else."],
        ["Can I get an alert only when a new model goes free?", "Yes. Free model alerts are a separate sign-up on the free AI model pages. You only get an email on mornings after a model went free."],
        ["Is it easy to unsubscribe?", "Yes. Every email has an unsubscribe link at the bottom, and one click takes you off the list."]]],
      ["Privacy and trust", [
        ["What do you do with my email address?", "It's used only to send you the emails you signed up for. It's stored with Buttondown, the email service, and it's never sold or shared."],
        ["Do I need to sign in with GitHub?", "No. There are no accounts and no sign-in. The site works without one, and the email only needs your address."]]],
      ["Practical", [
        ["Is there an RSS feed, API or JSON?", "Yes. There's an RSS feed of the daily pages, and all the data is free JSON under CC BY 4.0, including a GitHub trending API. No key needed."],
        ["Can I suggest a repo or model you missed?", "Not yet: there's no suggestion form. Repos are picked up automatically: any AI repo on GitHub created in the last 30 days with more than 100 stars is tracked, and new Hugging Face models appear when they start trending."]]]
    ];
    const qa = groups.flatMap(g => g[1]);
    const linkify = t => esc(t)
      .replace("free AI model tracker", '<a href="../free-ai-models/history/">free AI model tracker</a>')
      .replace("OpenCode page", '<a href="../free-ai-models/opencode/">OpenCode page</a>')
      .replace("free AI coding tools page", '<a href="../free-ai-models/coding-tools/">free AI coding tools page</a>')
      .replace("The Claude Code page", 'The <a href="../free-ai-models/claude-code/">Claude Code page</a>')
      .replace("The no-credit-card page", 'The <a href="../free-ai-models/no-credit-card/">no-credit-card page</a>')
      .replace("free API pages", '<a href="../free-ai-models/api/">free API pages</a>')
      .replace("topic pages for AI agents", 'topic pages for <a href="../trending-ai-github-repos/agents/">AI agents</a>')
      .replace("MCP servers and Claude Code skills.", '<a href="../mcp-servers-claude-code-skills/">MCP servers and Claude Code skills</a>.')
      .replace("an RSS feed", 'an <a href="../feed.xml">RSS feed</a>')
      .replace("free JSON under CC BY 4.0", '<a href="../data.html">free JSON under CC BY 4.0</a>')
      .replace("a GitHub trending API", 'a <a href="../github-trending-api/">GitHub trending API</a>')
      .replace("GitHub's own Trending page is the better place", '<a href="https://github.com/trending" rel="noopener">GitHub\'s own Trending page</a> is the better place')
      .replace("Free model alerts are a separate sign-up on the free AI model pages", 'Free model alerts are a separate sign-up on the <a href="../free-ai-models/#alerts">free AI model pages</a>')
      .replace("A separate hype check", 'A separate <a href="../#hype">hype check</a>');
    const body = `<section><div class="eyebrow">Questions</div><h1>Upcurrent FAQ</h1><p class="lede">Is Upcurrent free, where does the data come from, and what do you get by email? Straight answers to the 30 questions people ask before signing up.</p><p><a href="#signup"><b>Get the free 7am email</b></a> · <a href="../">Open the live dashboard</a></p></section>
${groups.map(([h, items]) => `<section><h2>${esc(h)}</h2>${items.map(([q, a]) => `<h3>${esc(q)}</h3><p>${linkify(a)}</p>`).join("")}</section>`).join("\n")}`;
    out["faq"] = page({ title: "Upcurrent FAQ: Is It Free, Where the Data Comes From", description: "Is Upcurrent free? Where does the data come from, how often is it updated, and what do you get by email? 30 straight answers.", canonical: url, body, up: "../",
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["FAQ", url]])] });
  }
  // Free GitHub trending API: GitHub has no trending endpoint, and our open data already has one.
  {
    const lastDay = days[days.length - 1], top = [...(data[lastDay].github || [])].sort((a, b) => b.d24 - a.d24);
    const url = `${SITE}github-trending-api/`, ep = `${SITE}data/api/today.json`;
    const sample = JSON.stringify({ github: top.slice(0, 2).map(({ repo, stars, d24, est, forks }) => ({ repo, stars, d24, est, forks })) }, null, 2);
    const lede = "GitHub's official API has no trending endpoint. Upcurrent's free GitHub trending API gives you the AI repositories gaining the most stars right now, as plain JSON: no key, no sign-up, refreshed every 30 minutes.";
    const qa = [
      ["Does GitHub have a trending API?", "No. GitHub's REST and GraphQL APIs have no trending endpoint, and github.com/trending is a web page, not an API. Upcurrent's JSON file is a free alternative for AI repositories."],
      ["Is the GitHub trending API free?", "Yes. It's a static JSON file with no key, no sign-up and no rate limit of its own. The data is licensed CC BY 4.0, so you can use it anywhere, including commercially, as long as you credit Upcurrent."],
      ["How often is the trending data updated?", "Every 30 minutes. The server lets browsers cache it for up to 10 minutes, so there's no point calling it more often than that."],
      ["Can I call it from a website?", "Yes. The file is served with Access-Control-Allow-Origin: *, so fetch() works from any web page."],
      ["Does it cover all GitHub repositories?", "No, only AI projects: repositories created in the last 30 days, with more than 100 stars, matching AI terms like LLM, agent, MCP, GPT or Claude. For every language, use github.com/trending."],
      ["Can I get past days?", `Yes. Every day is saved as its own file at ${SITE}data/api/daily/YYYY-MM-DD.json, going back to 2 October 2026.`]
    ];
    const pre = t => `<pre><code>${esc(t)}</code></pre>`;
    const body = `<section><div class="eyebrow">Open data · API</div><h1>Free GitHub trending API</h1><p class="lede">${esc(lede)}</p></section>
<section id="endpoint"><h2>The endpoint</h2>${pre("GET " + ep)}<p>The trending repositories are in the <code>github</code> array: the top ${top.length || 8} AI repositories by stars gained in the last 24 hours. Every day is also kept at <code>${esc(SITE)}data/api/daily/YYYY-MM-DD.json</code>. Want to see it first? The same list is on <a href="../trending-ai-github-repos/">GitHub trending repositories today</a>.</p></section>
<section id="fields"><h2>What each repository looks like</h2>${pre(sample)}<div class="tablewrap"><table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>
<tr><th scope="row"><code>repo</code></th><td>owner/name on GitHub</td></tr>
<tr><th scope="row"><code>stars</code></th><td>Total stars at the last check</td></tr>
<tr><th scope="row"><code>d24</code></th><td>Stars gained in the last 24 hours</td></tr>
<tr><th scope="row"><code>est</code></th><td><code>true</code> if <code>d24</code> is estimated from the repo's average so far, because Upcurrent hasn't seen it for 6 hours yet</td></tr>
<tr><th scope="row"><code>forks</code></th><td>Total forks</td></tr></tbody></table></div></section>
<section id="examples"><h2>Examples</h2><h3>curl and jq</h3>${pre(`curl -s ${ep} | jq '.github[] | {repo, d24}'`)}<h3>JavaScript</h3>${pre(`const res = await fetch("${ep}");\nconst { github } = await res.json();\ngithub.forEach(r => console.log(r.repo, "+" + r.d24, "stars today"));`)}<h3>Python</h3>${pre(`import requests\n\nfor r in requests.get("${ep}", timeout=10).json()["github"]:\n    print(r["repo"], r["d24"])`)}</section>
<section id="more"><h2>What else is in the file</h2><p>The same JSON has new Hugging Face models (<code>models</code>), free AI models on OpenRouter and OpenCode (<code>free</code>), cross-source breakouts and AI headlines. The full field list is in the <a href="../data.html">open data docs</a>. Please credit "Data from Upcurrent (https://upcurrent.dev/)" as the <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC BY 4.0 licence</a> asks.</p><p>How the stars are counted: Upcurrent queries <a href="https://docs.github.com/en/rest/search/search#search-repositories" rel="noopener">GitHub's official search API</a> every 30 minutes and compares each repository's star count with earlier readings.</p></section>
${faqHtml(qa)}`;
    out["github-trending-api"] = page({ title: "Free GitHub Trending API (JSON, no key) | Upcurrent", description: clip(lede, 160), canonical: url, body, up: "../",
      ld: [{ "@context": "https://schema.org", "@type": "TechArticle", headline: "Free GitHub trending API", url, author: { "@type": "Organization", name: "Upcurrent", url: SITE } }, faq(qa), breadcrumb([["Upcurrent", SITE], ["GitHub trending API", url]])] });
  }

  // 3. New models: a hub page plus open source models and a release tracker.
  Object.assign(out, modelCluster(days, data, last, updated));
  // 4. Weekly "state of free AI" reports.
  Object.assign(out, reportPages(days, data, updated));
  return out;
}


// "Free AI models" topic cluster: one hub page plus five pages for the longer searches around it
// (coding, API, OpenRouter, OpenCode, history). Every page is rebuilt from the saved daily files on each
// publish, links to the others and to the morning email. Facts about providers come from their own docs
// (linked on the page); everything else is what Upcurrent recorded.
const OR_LIMITS = "https://openrouter.ai/docs/api/reference/limits", OC_DOCS = "https://opencode.ai/docs/console/models/";
const FREE_PAGES = [
  ["", "All free models"], ["coding/", "For coding"], ["api/", "Free API"], ["free-llm-api-key/", "Get a key"], ["no-credit-card/", "No card"], ["coding-tools/", "Coding tools"], ["calculator/", "Calculator"], ["for-students/", "Students"], ["langchain/", "LangChain"], ["n8n/", "n8n"], ["janitor-ai/", "Janitor AI"], ["openrouter/", "OpenRouter"], ["opencode/", "OpenCode"], ["history/", "Tracker"]
];
const freeNav = (cur, up) => `<nav class="guides" aria-label="Free AI models guides">${FREE_PAGES.map(([p, n]) => p === cur ? `<b>${esc(n)}</b>` : `<a href="${up}free-ai-models/${p}">${esc(n)}</a>`).join("")}</nav>`;
const modelId = f => f.prov === "OpenRouter" ? (String(f.url || "").match(/openrouter\.ai\/([^?#]+)/) || [])[1] || null
  : f.prov === "OpenCode Zen" ? f.name.toLowerCase().trim().replace(/\s+/g, "-") : null;
const isChat = f => !/^(lyria|jev)\b/i.test(f.name);
const hasTools = f => capsOf(f.caps).includes("tool calling");
const freeRow = (f, extra) => `<li data-prov="${esc(f.prov)}" data-caps="${esc(capsOf(f.caps).join(","))}" data-ctx="${f.ctx || 0}"><span class="t">${f.added ? `<span class="tag">New today</span> ` : ""}${link(f.url, f.name)}${modelId(f) ? ` <code>${esc(modelId(f))}</code>` : ""}</span><span class="m">${esc([f.prov, ctxLabel(f.ctx) && `${ctxLabel(f.ctx)} context`, capsOf(f.caps).join(", "), extra].filter(Boolean).join(" · "))}</span></li>`;

// Charts: plain SVG images built from Upcurrent's own numbers on every publish. Light card with dark
// text so they read the same in light and dark mode and in Google Images. CHART_FILES is written to disk
// at the end of the build; each chart gets a descriptive file name and alt text that states its numbers.
const CHART_FILES = {};
const svgEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function chartSvg({ title, sub, rows, horizontal, w = 800 }) {
  const font = `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"`, max = Math.max(1, ...rows.map(r => r[1]));
  let inner, h;
  if (horizontal) {
    // Label above each bar, so the chart can stay narrow and readable on phones.
    const step = 64, top = 92, plot = w - 64 - 120;
    h = top + rows.length * step + 20;
    inner = rows.map(([l, v, vl], i) => { const y = top + i * step, bw = Math.max(2, v / max * plot);
      return `<text x="32" y="${y + 4}" font-size="17" fill="#1d2433">${svgEsc(clip(l, 46))}</text><rect x="32" y="${y + 14}" width="${bw.toFixed(1)}" height="24" rx="4" fill="#2f6fde"/><text x="${(32 + bw + 10).toFixed(1)}" y="${y + 32}" font-size="17" font-weight="600" fill="#1d2433">${svgEsc(vl ?? fmt(v))}</text>`; }).join("");
  } else {
    const top = 96, ph = 260, left = 40, plot = w - left * 2, slot = plot / rows.length, bw = Math.min(90, slot * .62);
    h = top + ph + 64;
    inner = `<line x1="${left}" y1="${top + ph}" x2="${w - left}" y2="${top + ph}" stroke="#c9cfdb"/>` + rows.map(([l, v, vl], i) => { const x = left + i * slot + (slot - bw) / 2, bh = Math.max(2, v / max * (ph - 24)), y = top + ph - bh;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${l === "Still free" ? "#1f9d6b" : "#2f6fde"}"/><text x="${(x + bw / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" font-size="16" font-weight="600" fill="#1d2433">${svgEsc(vl ?? fmt(v))}</text><text x="${(x + bw / 2).toFixed(1)}" y="${top + ph + 24}" text-anchor="middle" font-size="14" fill="#4a5468">${svgEsc(l)}</text>`; }).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${svgEsc(title)}" ${font}><title>${svgEsc(title)}</title><rect width="${w}" height="${h}" rx="14" fill="#f7f8fb"/><text x="32" y="42" font-size="22" font-weight="700" fill="#111827">${svgEsc(title)}</text><text x="32" y="68" font-size="14" fill="#4a5468">${svgEsc(sub)}</text>${inner}<text x="${w - 24}" y="${h - 14}" text-anchor="end" font-size="12" fill="#6b7385">upcurrent.dev</text></svg>`;
}
// file: site path of the SVG; src: path as the page links it. Returns the <figure>.
function chart(file, src, spec, alt, caption) {
  CHART_FILES[file] = chartSvg(spec);
  const m = CHART_FILES[file].match(/width="(\d+)" height="(\d+)"/);
  return `<figure class="chart"><img src="${src}" width="${m[1]}" height="${m[2]}" alt="${esc(alt)}" loading="lazy" decoding="async"><figcaption>${caption}</figcaption></figure>`;
}

function freeHistory(days, data) {
  const seen = new Map();
  days.forEach(day => (data[day].free || []).forEach(f => {
    const k = f.prov + "|" + f.name, cur = seen.get(k) || { ...f, first: day, last: day, n: 0 };
    cur.last = day; cur.n++; cur.url = f.url || cur.url; cur.caps = f.caps || cur.caps; cur.ctx = f.ctx || cur.ctx;
    seen.set(k, cur);
  }));
  const lastDay = days[days.length - 1], all = [...seen.values()];
  all.forEach(m => { m.now = m.last === lastDay; m.span = Math.round((Date.parse(m.last) - Date.parse(m.first)) / 864e5) + 1; });
  return all;
}

// Free tiers of other LLM APIs. Upcurrent can't read these live, so every fact is hand-checked from the
// provider's own docs; CHECKED says when. Re-check before changing the date.
const CHECKED = "22 November 2026";
const PROVIDERS = [
  { slug: "gemini", name: "Google Gemini API", short: "Gemini", card: true,
    title: "Gemini API free tier: which models are free | Upcurrent", h1: "Gemini API free tier",
    lede: "Google's Gemini API has a free tier with no billing account. Here is which Gemini models are free, the limits, and the catch.",
    facts: [["Free models", "Gemini 4 Hydrogen, Gemini 3.8 Flash, Gemini 3.6 Flash and Gemini 3.5 Flash-Lite are free of charge on the free tier."],
      ["Not free", "The newest top models (Gemini 4 Carbon, Gemini 4 Argon, Gemini 4 Neon) are paid only, as are Genie 4 and Gemini Omni Flash."],
      ["Card needed?", "No. The free tier needs only an active project. You add a billing account only to move up to Tier 1."],
      ["Limits", "Set per model and shown in Google AI Studio. Daily limits reset at midnight Pacific time, and preview models have tighter limits."],
      ["The catch", "On the free tier, Google may use your prompts and responses to improve its products. Don't send private data."]],
    docs: [["Pricing", "https://ai.google.dev/gemini-api/docs/pricing"], ["Rate limits", "https://ai.google.dev/gemini-api/docs/rate-limits"]],
    qa: [["Is the Gemini API free?", "Yes, on some models. Gemini 4 Hydrogen, Gemini 3.8 Flash, 3.6 Flash and 3.5 Flash-Lite are free of charge on the free tier. Gemini 4 Carbon, Argon and Neon are paid only."],
      ["Do I need a credit card for the Gemini API?", "No. The free tier needs an active project but no billing account."],
      ["Does Google train on free Gemini API data?", "On the free tier, Google says content may be used to improve its products. The paid tier does not."],
      ["What is the Gemini API free tier rate limit?", "Google sets it per model and shows your exact limits in Google AI Studio. Daily limits reset at midnight Pacific time, and preview models have tighter limits."],
      ["Which models are on the Gemini API free tier?", "Gemini 4 Hydrogen, Gemini 3.8 Flash, Gemini 3.6 Flash and Gemini 3.5 Flash-Lite for text, plus Gemini 3.8 Flash TTS, Gemini 3.5 Transcribe and gemini-embedding-2."]] },
  { slug: "groq", name: "Groq", short: "Groq", card: true,
    title: "Groq free API: models and rate limits | Upcurrent", h1: "Groq free API",
    lede: "Groq has a free plan for its fast inference API. Here are the free models, their exact limits, and when you need to pay.",
    facts: [["Free models", "openai/gpt-oss-120b, openai/gpt-oss-20b and qwen/qwen3.8-27b, plus Whisper speech-to-text and a few others."],
      ["Limits", "gpt-oss-120b, gpt-oss-20b and qwen3.8-27b: 30 requests a minute, 1,000 a day, 8,000 tokens a minute and 200,000 tokens a day. Limits apply to your whole organisation."],
      ["Card needed?", "No. Groq asks for a payment method only when you upgrade to its Developer plan."],
      ["Works with", "Groq offers OpenAI compatibility, so most OpenAI-style tools work with it."],
      ["When you hit a limit", "Requests fail with error 429. The retry-after header says how many seconds to wait."]],
    docs: [["Rate limits", "https://console.groq.com/docs/rate-limits"], ["Billing FAQs", "https://console.groq.com/docs/billing-faqs"]],
    qa: [["Is the Groq API free?", "Yes. Groq's Free plan lets you call models like gpt-oss-120b and qwen3.8-27b at no cost, up to 30 requests a minute and 1,000 a day each."],
      ["What are Groq's free rate limits?", "For gpt-oss-120b, gpt-oss-20b and qwen3.8-27b: 30 requests per minute, 1,000 per day, 8,000 tokens per minute and 200,000 tokens per day."],
      ["Do I need a credit card for Groq?", "No. A payment method is only needed to upgrade to the Developer plan."], ["Which Groq models are free?", "On the free plan you can call gpt-oss-120b, gpt-oss-20b and qwen3.8-27b for chat, whisper-large-v3 and whisper-large-v3-turbo for speech-to-text, and orpheus-v1-english for text-to-speech, each with its own limits."], ["What are the Groq free tier limits for Whisper?", "whisper-large-v3 allows 20 requests a minute, 2,000 a day and 7,200 audio seconds an hour on the free plan."]] },
  { slug: "cloudflare", name: "Cloudflare Workers AI", short: "Cloudflare", card: false,
    title: "Cloudflare Workers AI free tier: 10,000 Neurons a day | Upcurrent", h1: "Cloudflare Workers AI free tier",
    lede: "Cloudflare Workers AI gives everyone 10,000 Neurons a day for free, across most of its models. Here is what that means and which models are excluded.",
    facts: [["Free allowance", "10,000 Neurons a day, on both the Workers Free and Workers Paid plans. It resets at 00:00 UTC."],
      ["What a Neuron is", "Cloudflare's own unit for the compute a request uses. Each model's price page shows how many Neurons a million tokens cost, so small models stretch the allowance much further."],
      ["Not on the free plan", "Some newer models need a paid billing method, including kimi-k2.6, glm-5.3, deepseek-v4.1-flash and deepseek-v4-pro."],
      ["Beyond the free allowance", "You need the Workers Paid plan, then pay $0.011 per 1,000 Neurons."],
      ["Works with", "Cloudflare offers OpenAI-compatible API endpoints for Workers AI."]],
    docs: [["Pricing", "https://developers.cloudflare.com/workers-ai/platform/pricing/"]],
    qa: [["Is Cloudflare Workers AI free?", "Yes, up to 10,000 Neurons a day on any Workers plan. Above that you need Workers Paid, at $0.011 per 1,000 Neurons."],
      ["Which Cloudflare AI models are not free?", "Some newer models need a paid billing method, including Kimi K2.6, GLM 5.3 and DeepSeek V4.1 Flash."],
      ["When does the Cloudflare Workers AI free allowance reset?", "Every day at 00:00 UTC, which is midnight in the UK in winter and 1am in summer."],
      ["What is a Neuron in Cloudflare Workers AI?", "Cloudflare's unit for the compute a request uses. Each model's pricing shows how many Neurons a million tokens cost, so smaller models stretch the 10,000 daily Neurons further."],
      ["Can I use the OpenAI SDK with Cloudflare Workers AI?", "Yes. Cloudflare offers OpenAI-compatible endpoints for Workers AI, so you can point the OpenAI SDK at your account's Workers AI URL."]] }
];
function providerPages(updated) {
  const out = {};
  PROVIDERS.forEach(pv => {
    const url = `${SITE}free-ai-models/${pv.slug}/`, up = "../../";
    const html = `<section><div class="eyebrow">Free AI models · ${esc(pv.short)}</div><h1>${esc(pv.h1)}</h1><p class="lede">${esc(pv.lede)}</p>${freeNav(pv.slug + "/", up)}<p class="asof">Checked ${esc(CHECKED)} from ${esc(pv.name)}'s own docs. Free tiers change, so check the links below before you build on one.</p></section>
<section><h2>${esc(pv.short)} free tier at a glance</h2><ul class="rows">${pv.facts.map(([k, v]) => `<li><span class="t">${esc(k)}</span><span class="m">${esc(v)}</span></li>`).join("")}</ul>
<p>Sources: ${pv.docs.map(([n, u]) => link(u, `${pv.short} ${n.toLowerCase()}`)).join(", ")}.</p>
<p>To see how ${esc(pv.short)} stacks up, look at the <a href="../api/#compare">free LLM API comparison table</a>${(() => { const v = COMPARES.filter(c => c.includes(pv.slug)); return v.length ? ", or the side-by-side pages for " + v.map(([a, b]) => `<a href="../${a}-vs-${b}/">${esc(API_FACTS[a].name.replace("Google ", ""))} vs ${esc(API_FACTS[b].name.replace("Google ", ""))}</a>`).join(" and ") : ""; })()}. If you don't have a key yet, <a href="../free-llm-api-key/">here's how to get one</a>.</p></section>
<section><h2>Other free options</h2><ul class="rows"><li><span class="t"><a href="../api/">Free AI model API</a></span><span class="m">Every free LLM API compared, plus the OpenRouter models Upcurrent checks every 30 minutes</span></li><li><span class="t"><a href="../no-credit-card/">Free LLM APIs with no credit card</a></span><span class="m">Which free tiers you can start without a card</span></li>${PROVIDERS.filter(o => o !== pv).map(o => `<li><span class="t"><a href="../${o.slug}/">${esc(o.h1)}</a></span><span class="m">${esc(o.lede.split(". ")[0])}.</span></li>`).join("")}</ul></section>
${faqHtml(pv.qa)}
<section class="share" aria-label="Share this page"><b>Share:</b> ${shareLinks(url, pv.h1)}</section>`;
    out["free-ai-models/" + pv.slug] = page({ title: pv.title, description: clip(pv.lede, 160), canonical: url, body: html, ld: [faq(pv.qa), breadcrumb([["Upcurrent", SITE], ["Free AI models", SITE + "free-ai-models/"], [pv.h1, url]])], up, ogType: "article" });
  });
  return out;
}

// More free-tier guides from the competitor content-gap check. Hand-checked facts (CHECKED) plus Upcurrent's live
// OpenRouter and OpenCode counts.
const API_FACTS = {
  openrouter: { name: "OpenRouter", page: "openrouter/", base: "https://openrouter.ai/api/v1", models: n => `${n} free models today (IDs end in :free), checked live every 30 minutes`,
    limits: "20 requests a minute; 50 a day, or 1,000 a day after buying 10 credits", card: "No", data: "Many free models note that the provider may log prompts to improve its model",
    docs: "https://openrouter.ai/docs/api/reference/limits" },
  gemini: { name: "Google Gemini API", page: "gemini/", base: "https://generativelanguage.googleapis.com/v1beta/openai/", models: () => "Gemini 4 Hydrogen, Gemini 3.8 Flash, Gemini 3.6 Flash and Gemini 3.5 Flash-Lite",
    limits: "Set per model, shown in Google AI Studio; daily limits reset at midnight Pacific time", card: "No (only an active project)", data: "Free-tier content may be used to improve Google's products",
    docs: "https://ai.google.dev/gemini-api/docs/openai" },
  groq: { name: "Groq", page: "groq/", base: "https://api.groq.com/openai/v1", models: () => "gpt-oss-120b, gpt-oss-20b and qwen3.8-27b",
    limits: "30 requests a minute and 1,000 a day per model, plus token caps", card: "No (a payment method only to upgrade)", data: "Not covered on the pages we checked",
    docs: "https://console.groq.com/docs/openai" },
  cloudflare: { name: "Cloudflare Workers AI", page: "cloudflare/", base: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1", models: () => "Most Workers AI models, within 10,000 Neurons a day",
    limits: "10,000 Neurons a day, reset at 00:00 UTC", card: "Not stated on the pricing page", data: "Not covered on the pages we checked",
    docs: "https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/" }
};
const COMPARES = [["openrouter", "gemini"], ["openrouter", "groq"], ["groq", "gemini"]];

function extraPages(last) {
  const out = {}, free = (last.free || []).filter(isChat);
  const orN = free.filter(f => f.prov === "OpenRouter").length, oc = free.filter(f => f.prov === "OpenCode Zen");
  const shell = (slug, { title, h1, eyebrow, lede, body, qa, crumb }) => {
    const url = `${SITE}free-ai-models/${slug}/`, up = "../../";
    const html = `<section><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(h1)}</h1><p class="lede">${esc(lede)}</p>${freeNav(slug + "/", up)}<p class="asof">Checked ${esc(CHECKED)} from each provider's own docs. Free tiers change, so follow the source links before you build on one.</p></section>
${body}
<section><h2>More free AI guides</h2><ul class="rows"><li><span class="t"><a href="../api/">Free AI model API</a></span><span class="m">Every free LLM API, plus the free OpenRouter models Upcurrent checks every 30 minutes</span></li><li><span class="t"><a href="../no-credit-card/">Free LLM APIs with no credit card</a></span><span class="m">Which free tiers start without a card</span></li><li><span class="t"><a href="../free-llm-api-key/">How to get a free LLM API key</a></span><span class="m">Five steps to your first request</span></li></ul></section>
${faqHtml(qa)}
<section class="share" aria-label="Share this page"><b>Share:</b> ${shareLinks(url, h1)}</section>`;
    out["free-ai-models/" + slug] = page({ title, description: clip(lede, 160), canonical: url, body: html, ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["Free AI models", SITE + "free-ai-models/"], [crumb || h1, url]])], up, ogType: "article" });
  };
  const rows = items => `<ul class="rows">${items.map(([t, m]) => `<li><span class="t">${t}</span><span class="m">${esc(m)}</span></li>`).join("")}</ul>`;

  // OpenAI-compatible free APIs: same SDK, swap the base URL.
  {
    const list = ["openrouter", "gemini", "groq", "cloudflare"].map(k => API_FACTS[k]);
    const body = `<section><h2>Swap one line, keep your code</h2><p>Each API below works with the official OpenAI libraries. Change <code>base_url</code> and the API key, and pick a model the provider offers for free.</p>
<pre><code>from openai import OpenAI
client = OpenAI(base_url="BASE_URL_FROM_THE_LIST", api_key="YOUR_KEY")</code></pre></section>
<section id="list"><h2>${list.length} free OpenAI-compatible APIs</h2><ul class="rows">${list.map(p => `<li><span class="t"><a href="../${p.page}">${esc(p.name)}</a> <code>${esc(p.base)}</code></span><span class="m">${esc(`Free: ${p.models(orN)} · ${p.limits}`)} · ${link(p.docs, "docs")}</span></li>`).join("")}</ul></section>`;
    const qa = [["Which free APIs are OpenAI-compatible?", `OpenRouter, Google's Gemini API, Groq and Cloudflare Workers AI all offer OpenAI-compatible endpoints with a free tier. OpenRouter has ${orN} free models today.`],
      ["What is the Gemini OpenAI-compatible base URL?", "https://generativelanguage.googleapis.com/v1beta/openai/ — Google says this support is still in beta."],
      ["What is the Groq OpenAI-compatible base URL?", "https://api.groq.com/openai/v1. Groq notes a few OpenAI fields such as logprobs and logit_bias are not supported."]];
    shell("openai-compatible", { title: "Free OpenAI-compatible APIs: 4 that work today | Upcurrent", h1: "Free OpenAI-compatible APIs", eyebrow: "Free AI models · OpenAI-compatible",
      lede: `Four free LLM APIs that work with the OpenAI SDK by changing one line: OpenRouter (${orN} free models), Gemini, Groq and Cloudflare, with base URLs and limits.`, body, qa, crumb: "OpenAI-compatible" });
  }

  // Free image and speech APIs.
  {
    const body = `<section><h2>Free speech-to-text</h2>${rows([
      [`<a href="../groq/">Groq</a>: whisper-large-v3 and whisper-large-v3-turbo`, "Free plan: 20 requests a minute, 2,000 a day, 7,200 audio seconds an hour and 28,800 a day"],
      [`<a href="../cloudflare/">Cloudflare Workers AI</a>: @cf/openai/whisper and whisper-large-v3-turbo`, "Inside the 10,000 free Neurons a day. Whisper costs 41.14 Neurons per audio minute, about 240 minutes a day (Upcurrent's sum from Cloudflare's price list)"],
      [`<a href="../gemini/">Gemini API</a>: gemini-3.5-transcribe`, "Free of charge on the free tier (free-tier content may be used to improve Google's products)"]])}</section>
<section><h2>Free text-to-speech</h2>${rows([
      [`<a href="../groq/">Groq</a>: canopylabs/orpheus-v1-english`, "Free plan: 10 requests a minute and 100 a day"],
      [`<a href="../cloudflare/">Cloudflare Workers AI</a>: @cf/myshell-ai/melotts`, "18.63 Neurons per audio minute, inside the free daily Neurons"],
      [`<a href="../gemini/">Gemini API</a>: gemini-3.8-flash-tts and gemini-3.8-flash-lite-tts`, "Free of charge on the free tier, within its rate limits"]])}</section>
<section><h2>Free image generation</h2>${rows([
      [`<a href="../cloudflare/">Cloudflare Workers AI</a>: @cf/black-forest-labs/flux-1-schnell`, "4.80 Neurons per 512x512 tile plus 9.60 per step, inside the 10,000 free Neurons a day. Other FLUX models cost more"],
      ["Gemini API image models (Nano Banana)", "Not on the free tier: every Gemini image model is marked \"Not available\" for free"]])}</section>
<p>Sources: ${link("https://console.groq.com/docs/rate-limits", "Groq rate limits")}, ${link("https://developers.cloudflare.com/workers-ai/platform/pricing/", "Cloudflare Workers AI pricing")}, ${link("https://ai.google.dev/gemini-api/docs/pricing", "Gemini pricing")}.</p>`;
    const qa = [["Is there a free speech-to-text API?", "Yes. Groq's free plan includes Whisper large v3 (2,000 requests a day), Cloudflare Workers AI runs Whisper inside its 10,000 free Neurons a day, and Gemini 3.5 Transcribe is free on Gemini's free tier."],
      ["Is there a free image generation API?", "Yes. Cloudflare Workers AI runs FLUX.1 schnell inside its free 10,000 Neurons a day. Gemini's image models (Nano Banana) are not on its free tier."],
      ["Is there a free text-to-speech API?", "Yes. Groq's free plan includes Orpheus English (100 requests a day), Gemini 3.8 Flash TTS is free on Gemini's free tier, and Cloudflare offers MeloTTS inside its free daily Neurons."]];
    shell("image-and-speech", { title: "Free image and speech APIs: what's free today | Upcurrent", h1: "Free image generation and speech APIs", eyebrow: "Free AI models · image and speech",
      lede: "Free APIs for speech-to-text, text-to-speech and image generation from Groq, Cloudflare and Google Gemini, with the free limits from each one's own docs.", body, qa, crumb: "Image and speech" });
  }

  // Free AI coding tools.
  {
    const tools = [
      [`<a href="../opencode/">OpenCode</a>`, `${oc.length} chat models free inside the app today (checked live every 30 minutes)`],
      [link("https://github.com/features/copilot/plans", "GitHub Copilot Free"), "$0. 2,000 completions a month, limited chat and agent use, models like Claude Haiku 4.5 and GPT-5 mini. No credit card"],
      [link("https://antigravity.google/pricing", "Google Antigravity (Individual)"), "$0. A baseline agent quota refreshed weekly, with Gemini 3.8 Flash. Its Claude and GPT-OSS models leave the free plan on 30 November 2026"],
      [link("https://kilo.ai/landing/free-models", "Kilo Code"), "Free hosted models (Nemotron 3.5 Super VL and Nemotron 3 Ultra when checked). No card or API key needed"],
      [link("https://cursor.com/pricing", "Cursor (Free)"), "$0 with limited agent and chat requests"],
      [`<a href="../free-llm-api-key/">Any agent that takes an OpenAI-style key</a>`, `Point it at OpenRouter's free models (${orN} today) with a free key`]];
    const body = `<section id="list"><h2>${tools.length} free ways to code with AI</h2>${rows(tools)}</section>
<section><h2>Which free models are best for coding?</h2><p>Coding agents need tool calling and a long context window. See the <a href="../coding/">free AI models for coding</a>, updated every 30 minutes.</p></section>`;
    const qa = [["What is the best free AI coding tool?", `For the most free model choice, OpenCode (${oc.length} free models today) or any agent using OpenRouter's free models. GitHub Copilot Free is the easiest start inside VS Code, with 2,000 completions a month.`],
      ["Is GitHub Copilot free?", "Yes, there is a Copilot Free plan: 2,000 completions a month and limited chat and agent use, with no credit card required."],
      ["Is Cursor free?", "Cursor has a $0 plan with limited agent and chat requests. Paid plans add more usage."]];
    shell("coding-tools", { title: "Free AI coding tools: 6 you can use today | Upcurrent", h1: "Free AI coding tools", eyebrow: "Free AI models · coding tools",
      lede: `Six free ways to code with AI, from GitHub Copilot Free to OpenCode's ${oc.length} free models, with each free plan's real limits.`, body, qa, crumb: "Coding tools" });
  }

  // Free LLM API calculator: a small tool (linkable asset). Every number comes from the hand-checked facts
  // above (CHECKED date); the static table below the tool carries the same facts for readers without JS.
  {
    const qa = [
      ["How many free LLM API requests can I make a day?", "On OpenRouter, 50 a day on free models, or 1,000 a day once you have bought 10 credits. On Groq's free plan, gpt-oss-120b allows 1,000 requests a day and 200,000 tokens a day. Cohere trial keys allow 1,000 calls a month. Gemini and Cloudflare limits depend on the model."],
      ["Can I combine free API tiers?", "Yes. Each provider's free tier is separate, so using OpenRouter and Groq together gives you both allowances. Because all of them are OpenAI-compatible, switching between them is a change of base URL and model name."],
      ["Why does my token count matter?", "Some free tiers cap tokens as well as requests. Groq's gpt-oss-120b allows 200,000 tokens a day on the free plan, so at 2,000 tokens a request you run out after 100 requests, well before the 1,000-request limit."]
    ];
    const body = `<section id="calc"><h2>Free LLM API calculator</h2>
<p>Enter roughly how many requests your project makes a day and how long each one is. The calculator checks which free tiers cover it, using the limits each provider publishes.</p>
<form class="calc" onsubmit="return false">
<label>Requests a day <input id="cReq" type="number" min="1" step="1" value="200" inputmode="numeric"></label>
<label>Tokens per request (prompt + reply) <input id="cTok" type="number" min="1" step="100" value="1500" inputmode="numeric"></label>
<label class="chk"><input id="cPriv" type="checkbox"> My prompts include private or customer data</label>
</form>
<div id="cOut" aria-live="polite"><noscript><p>The calculator needs JavaScript. The limits it uses are in the table below.</p></noscript></div>
</section>
<section id="limits"><h2>The free limits it uses</h2><div class="tablewrap"><table><thead><tr><th>Provider</th><th>Free requests</th><th>Other caps</th></tr></thead><tbody>
<tr><th scope="row"><a href="../openrouter/">OpenRouter</a></th><td>50 a day; 1,000 a day after buying 10 credits</td><td>20 requests a minute on free models</td></tr>
<tr><th scope="row"><a href="../groq/">Groq</a> (gpt-oss-120b)</th><td>1,000 a day, per model</td><td>30 requests and 8,000 tokens a minute; 200,000 tokens a day</td></tr>
<tr><th scope="row"><a href="https://docs.cohere.com/docs/rate-limits" rel="nofollow noopener">Cohere</a> (trial key)</th><td>1,000 a month</td><td>20 requests a minute on chat models</td></tr>
<tr><th scope="row"><a href="../gemini/">Google Gemini</a></th><td>Set per model, shown in Google AI Studio</td><td>Free-tier content may be used to improve Google's products</td></tr>
<tr><th scope="row"><a href="../cloudflare/">Cloudflare Workers AI</a></th><td>10,000 Neurons a day</td><td>Neurons per request depend on the model</td></tr>
</tbody></table></div><p>Checked ${esc(CHECKED)} from each provider's docs. Linked pages list the sources.</p></section>
<style>.calc{display:grid;gap:12px;margin:12px 0}.calc label{display:grid;gap:4px;font-weight:600}.calc input[type=number]{font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:transparent;color:inherit;max-width:260px}.calc .chk{display:flex;gap:8px;align-items:center;font-weight:400}#cOut .rows .ok{color:#1f9d6b;font-weight:700}#cOut .rows .no{color:#c2410c;font-weight:700}#cOut .rows .maybe{font-weight:700}</style>
<script>(function(){var R=document.getElementById("cReq"),T=document.getElementById("cTok"),P=document.getElementById("cPriv"),O=document.getElementById("cOut");
function f(n){return Math.floor(n).toLocaleString("en-GB")}
function run(){var r=Math.max(1,+R.value||0),t=Math.max(1,+T.value||0),rows=[],sum=0;
var orN=r<=50?["ok","Covers it","Within the 50 free requests a day."]:r<=1000?["maybe","Covers it after a one-off top-up","Over 50 a day, so you would need to buy 10 credits to unlock 1,000 a day."]:["no","Not enough","Free models stop at 1,000 requests a day, even with credits."];
rows.push(["OpenRouter","../openrouter/",orN]);sum+=50;
var gMax=Math.min(1000,Math.floor(200000/t));sum+=gMax;
rows.push(["Groq (gpt-oss-120b)","../groq/",r<=gMax?["ok","Covers it","Up to "+f(gMax)+" requests a day at "+f(t)+" tokens each."]:["no","Not enough","At "+f(t)+" tokens a request, the 200,000 tokens a day cap allows about "+f(gMax)+" requests."+(gMax<1000?" Shorter prompts would fit more.":"")+" Groq's other free models, gpt-oss-20b and qwen3.8-27b, each have the same allowance on top."]]);
var cDay=1000/30;rows.push(["Cohere (trial key)","https://docs.cohere.com/docs/rate-limits",r<=cDay?["ok","Covers it","About 33 a day on average (1,000 a month)."]:["no","Not enough","Trial keys allow 1,000 calls a month, about 33 a day."]]);
rows.push(["Google Gemini","../gemini/",["maybe","Check your model","Limits are set per model and shown in Google AI Studio."+(P.checked?" Free-tier content may be used to improve Google's products, so avoid it for private data.":"")]]);
rows.push(["Cloudflare Workers AI","../cloudflare/",["maybe","Depends on the model","10,000 Neurons a day; how many requests that buys depends on the model."]]);
var fit=rows.filter(function(x){return x[2][0]==="ok"}).length;
O.innerHTML="<p><b>"+(fit?fit+" free tier"+(fit>1?"s cover":" covers")+" "+f(r)+" requests a day.":"No single free tier covers "+f(r)+" requests a day for nothing."+(orN[0]==="maybe"?" OpenRouter covers it after a one-off purchase of 10 credits.":""))+"</b> "+(r>50?"Using OpenRouter and Groq together gives up to about "+f(sum)+" free requests a day at this length.":"")+"</p><ul class='rows'>"+rows.map(function(x){return '<li><span class="t"><a href="'+x[1]+'">'+x[0]+'</a>: <span class="'+x[2][0]+'">'+x[2][1]+'</span></span><span class="m">'+x[2][2]+'</span></li>'}).join("")+"</ul>"+(P.checked?"<p><b>Private data:</b> don't send it to any free tier. Many free OpenRouter models say prompts may be logged, and Gemini's free tier may use content to improve Google's products. Use a paid plan for customer data.</p>":"");}
[R,T,P].forEach(function(e){e.addEventListener("input",run)});run();})();</script>`;
    shell("calculator", { title: "Free LLM API calculator: what can you run for free?", h1: "Free LLM API calculator", eyebrow: "Free AI models · tool",
      lede: "Enter your requests a day and prompt length to see which free LLM API tiers (OpenRouter, Groq, Cohere, Gemini, Cloudflare) cover your project.", body, qa, crumb: "Calculator" });
  }

  // "Free LLM API for ___" pages: long-tail searches from Google autocomplete (22 Nov 2026). Setup steps are
  // copied from each tool's own docs (links on each page); model lists come from today's live free list.
  {
    const orFree = free.filter(f => f.prov === "OpenRouter"), orTools = orFree.filter(hasTools);
    const ids = (list, n) => `<ol class="rows">${list.slice(0, n).map(f => freeRow(f)).join("")}</ol>`;
    const firstId = (orTools[0] && modelId(orTools[0])) || (orFree[0] && modelId(orFree[0])) || "openrouter/free";
    const src = (u, t) => `<a href="${u}" rel="nofollow noopener">${esc(t)}</a>`;

    shell("for-students", { title: "Free AI API for students: what's actually free (2026)", h1: "Free AI API for students", eyebrow: "Free AI models · students", crumb: "For students",
      lede: "There's no special student AI API, but students get GitHub Copilot free, and four LLM APIs have free tiers that need no credit card.",
      qa: [["Is there a free AI API for students?", "Not a student-only one among the providers Upcurrent checked. Use a general free tier instead: OpenRouter's free models, Groq's free plan or Gemini's free tier all start without a credit card."],
        ["Can students get GitHub Copilot for free?", "Yes. Verified students on GitHub Education get Copilot Student free. GitHub checks eligibility every month."],
        ["Which free AI API is best for a student project?", "OpenRouter, because one free key reaches many free models. Add Groq or Gemini as a backup for when you hit OpenRouter's 50 requests a day."]],
      body: `<section><h2>Free for verified students: GitHub Copilot Student</h2><p>Verified students on GitHub Education get free access to Copilot's paid features, called Copilot Student. GitHub re-checks eligibility every month.</p><ol class="rows">
<li><span class="t">Go to github.com/settings/education/benefits</span><span class="m">If you aren't verified yet, click Start an application and finish the verification</span></li>
<li><span class="t">Under "Free GitHub developer resources for students and teachers", click Learn more</span><span class="m">Then follow the prompts to activate Copilot Student</span></li>
<li><span class="t">If you only see paid options, don't pay</span><span class="m">GitHub says the benefit can take several days to apply after approval. Wait and try again</span></li></ol>
<p>Source: ${src("https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/enable-copilot/set-up-for-students", "GitHub Docs: Access GitHub Copilot for free as a student")}.</p></section>
<section><h2>Free LLM APIs any student can use</h2><p>None of these needs a student account, and none asks for a credit card to start.</p><ul class="rows">
<li><span class="t"><a href="../openrouter/">OpenRouter</a></span><span class="m">${orFree.length} free models today; 50 requests a day, 20 a minute</span></li>
<li><span class="t"><a href="../groq/">Groq</a></span><span class="m">gpt-oss-120b at 1,000 requests a day on the free plan; fast replies</span></li>
<li><span class="t"><a href="../gemini/">Google Gemini</a></span><span class="m">Free tier on Gemini 4 Hydrogen and Gemini 3.8 Flash; free-tier content may be used to improve Google's products</span></li>
<li><span class="t"><a href="../cloudflare/">Cloudflare Workers AI</a></span><span class="m">10,000 Neurons a day across most of its models</span></li></ul>
<p>Not sure which fits your project? The <a href="../calculator/">free LLM API calculator</a> checks it for you, and <a href="../free-llm-api-key/">this guide</a> gets you a key in five steps.</p></section>` });

    shell("langchain", { title: "Free LLM API for LangChain: 3 that work with ChatOpenAI", h1: "Free LLM API for LangChain", eyebrow: "Free AI models · LangChain", crumb: "LangChain",
      lede: "Groq and Gemini's free tiers work with LangChain's ChatOpenAI by changing the base URL. OpenRouter works too, with one catch LangChain warns about.",
      qa: [["Can I use LangChain for free?", "LangChain itself is free and open source. You only pay for the model, and Groq, Gemini and OpenRouter all have free tiers you can call from LangChain."],
        ["How do I use a free model with ChatOpenAI?", "Install langchain-openai, then pass base_url and api_key for the free provider, plus one of its model names. For Groq the base URL is https://api.groq.com/openai/v1."],
        ["Does ChatOpenAI work with OpenRouter?", "Basic chat works, but LangChain's docs say ChatOpenAI only follows the official OpenAI format and drops extra fields such as reasoning, and recommend a provider-specific package for OpenRouter."]],
      body: `<section><h2>Free LangChain setup with Groq</h2><p>Install the package, get a free key from <a href="../groq/">Groq</a>, then point ChatOpenAI at Groq's OpenAI-compatible endpoint:</p>
<pre><code>pip install -U langchain-openai

from langchain_openai import ChatOpenAI
import os

llm = ChatOpenAI(
    model="openai/gpt-oss-120b",
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ["GROQ_API_KEY"],
)
print(llm.invoke("Say hi in five words").text)</code></pre>
<p>Groq's free plan allows 1,000 requests a day and 200,000 tokens a day on gpt-oss-120b. Check the exact model name in your Groq console.</p></section>
<section><h2>The same code with other free providers</h2><div class="tablewrap"><table><thead><tr><th>Provider</th><th>base_url</th><th>Free limit</th></tr></thead><tbody>
<tr><th scope="row"><a href="../groq/">Groq</a></th><td><code>https://api.groq.com/openai/v1</code></td><td>1,000 requests a day per model</td></tr>
<tr><th scope="row"><a href="../gemini/">Gemini</a></th><td><code>https://generativelanguage.googleapis.com/v1beta/openai/</code></td><td>Set per model in Google AI Studio</td></tr>
<tr><th scope="row"><a href="../openrouter/">OpenRouter</a></th><td><code>https://openrouter.ai/api/v1</code></td><td>50 requests a day on :free models</td></tr></tbody></table></div>
<p>With OpenRouter, use a free model ID such as <code>${esc(firstId)}</code>. LangChain's docs say ChatOpenAI drops non-standard fields (like reasoning output) from providers such as OpenRouter and suggest a provider-specific package instead (${src("https://docs.langchain.com/oss/python/integrations/chat/openai", "LangChain ChatOpenAI docs")}). For plain chat and tool calling, ChatOpenAI is enough.</p>
<p>LangChain reads the base URL from <code>OPENAI_BASE_URL</code> too, so you can switch provider without touching code.</p></section>` });

    shell("n8n", { title: "Free AI models in n8n: OpenRouter, Groq and Gemini", h1: "Free AI models in n8n", eyebrow: "Free AI models · n8n", crumb: "n8n",
      lede: `n8n has built-in chat model nodes for OpenRouter, Groq and Google Gemini. Pick a free model in the node and your AI agent runs at no cost, within each free tier's limits.`,
      qa: [["Which AI model is free in n8n?", `Any free model from a provider n8n supports. The OpenRouter Chat Model node lists the models your account can use, and ${orFree.length} OpenRouter models were free as of today; their IDs end in :free.`],
        ["Does n8n have a Groq node?", "Yes. n8n has a Groq Chat Model node, and Groq's free plan allows 1,000 requests a day on gpt-oss-120b."],
        ["Will a free model run my n8n workflow all day?", "Probably not on one provider. OpenRouter's free models allow 50 requests a day (1,000 after buying 10 credits). Each agent step can use a request, so busy workflows need a backup provider."]],
      body: `<section><h2>Set up a free model in n8n</h2><ol class="rows">
<li><span class="t">Get a free OpenRouter key</span><span class="m">Sign up at openrouter.ai, then open Keys and create one. <a href="../free-llm-api-key/">Step-by-step guide</a></span></li>
<li><span class="t">Add an AI Agent node, then attach the OpenRouter Chat Model node</span><span class="m">It's a sub-node: connect it to the agent's Chat Model input</span></li>
<li><span class="t">Create an OpenRouter credential with your key</span><span class="m">n8n then loads the models your account can use</span></li>
<li><span class="t">Choose a model whose ID ends in :free</span><span class="m">Today's free models with tool calling (agents need it) are below</span></li></ol>
<p>Source: ${src("https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenrouter/", "n8n docs: OpenRouter Chat Model")}. n8n also has Groq Chat Model and Google Gemini Chat Model nodes that work the same way.</p></section>
<section><h2>Free models for n8n agents today</h2>${orTools.length ? ids(orTools, 8) : ids(orFree, 8)}<p><a href="../openrouter/">All ${orFree.length} free OpenRouter models</a> · checked every 30 minutes.</p></section>` });

    shell("claude-code", { title: "Free Claude Code? What Works With Free Models (Honest Answer)", h1: "Free LLM API for Claude Code", eyebrow: "Free AI models · Claude Code", crumb: "Claude Code",
      lede: "Claude Code can run through OpenRouter with a few environment variables, but OpenRouter only guarantees it with Anthropic's own models, which aren't free. Here are the honest options.",
      qa: [["Can I use Claude Code for free?", "Not reliably. Claude Code can connect to OpenRouter, but usage is billed in OpenRouter credits, and OpenRouter says Claude Code is only guaranteed to work with Anthropic's own provider. Free models may not work correctly."],
        ["How do I connect Claude Code to OpenRouter?", "Set ANTHROPIC_BASE_URL to https://openrouter.ai/api, put your OpenRouter key in ANTHROPIC_AUTH_TOKEN, and set ANTHROPIC_API_KEY to an empty string. Then run /logout once if you were logged in to Anthropic, and restart Claude Code."],
        ["What's a free alternative to Claude Code?", `OpenCode has ${oc.length} free models built in, and GitHub Copilot Free includes limited agent use. Both are on the free AI coding tools page.`]],
      body: `<section><h2>Connect Claude Code to OpenRouter</h2><p>From OpenRouter's own guide. Add these lines to your shell profile, then reload it:</p>
<pre><code>export OPENROUTER_API_KEY="&lt;your-openrouter-api-key&gt;"
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""</code></pre>
<p>If you were logged in to Claude Code with an Anthropic account, run <code>/logout</code> once, then restart. Check with <code>/status</code>: it should show the OpenRouter base URL. Source: ${src("https://openrouter.ai/docs/cookbook/coding-agents/claude-code-integration", "OpenRouter: Use Claude Code with OpenRouter")}.</p></section>
<section><h2>The catch: it isn't really free</h2><h3>Usage is billed in OpenRouter credits</h3><p>Requests go through your OpenRouter account and use its credits.</p><h3>Free models may not work well</h3><p>OpenRouter says Claude Code with OpenRouter is only guaranteed to work with Anthropic's first-party provider, and that Claude Code is optimized for Anthropic models and may not work correctly with others. You can point its model settings at other models, but expect broken tool calls with many free ones.</p></section>
<section><h2>Free alternatives that do work</h2><ul class="rows">
<li><span class="t"><a href="../opencode/">OpenCode</a></span><span class="m">${oc.length} free models built in, no key needed</span></li>
<li><span class="t"><a href="../coding-tools/">GitHub Copilot Free</a></span><span class="m">2,000 completions a month and limited agent use, no card</span></li>
<li><span class="t"><a href="../coding/">Free models for coding</a></span><span class="m">Free models with tool calling, for any agent that takes an OpenAI-compatible API</span></li></ul></section>` });

    shell("janitor-ai", { title: `Free API for Janitor AI: OpenRouter setup (${monthYear(new Date().toISOString().slice(0, 10))})`, h1: "Free API for Janitor AI", eyebrow: "Free AI models · Janitor AI", crumb: "Janitor AI",
      lede: `Janitor AI works with a free OpenRouter key: add it under API Settings with a free model ID. Today ${orFree.length} OpenRouter models are free; the list below updates every 30 minutes.`,
      qa: [["Is there a free API for Janitor AI?", "Yes. Janitor's own help guide uses OpenRouter, which has free models. You get 50 free messages a day, or 1,000 a day after a one-off purchase of 10 credits. Janitor also has its own free model, JLLM, which needs no setup."],
        ["What proxy URL do I use for Janitor AI with OpenRouter?", "https://openrouter.ai/api/v1/chat/completions, pasted exactly as it is."],
        ["Why did my free Janitor AI model stop working?", "Free OpenRouter models come and go. Of the models Upcurrent has seen stop being free, half lasted 12 days or less. If yours stops, swap in a model from the current list on this page."]],
      body: `<section><h2>Set up a free API in Janitor AI</h2><p>These steps follow Janitor's own quickstart guide (${src("https://help.janitorai.com/en/article/tldr-quickstart-proxy-instructions-1x0fptu/", "Janitor help: Quickstart proxy instructions")}). Its example model is no longer free, so use one from today's list below.</p><ol class="rows">
<li><span class="t">Sign up at openrouter.ai</span><span class="m">Free, no card</span></li>
<li><span class="t">Create a key</span><span class="m">Profile, then Keys, then Create. Keep it private, like a password</span></li>
<li><span class="t">In a Janitor chat, open the gear icon, then API Settings, then Add Configuration</span><span class="m">Give it any name</span></li>
<li><span class="t">Model name: a free model ID</span><span class="m">Copy one exactly from the list below, for example ${esc(firstId)}</span></li>
<li><span class="t">Proxy URL: https://openrouter.ai/api/v1/chat/completions</span><span class="m">Paste it exactly</span></li>
<li><span class="t">Paste your key, save, refresh and send a test message</span><span class="m">50 free messages a day, reset at midnight UTC</span></li></ol></section>
<section><h2>Free OpenRouter models you can use today</h2>${ids(orFree, 12)}<p>Free models change often. <a href="../history/">See how long they usually last</a>.</p></section>` });

    shell("no-limit", { title: "Free LLM API with no limit: does it exist? (honest answer)", h1: "Free LLM API with no limit", eyebrow: "Free AI models · limits", crumb: "No limit",
      lede: "No. Every free LLM API has a limit, and lists promising unlimited free keys are out of date or reselling someone's quota. Here are the real limits and how to stretch them.",
      qa: [["Is there a free LLM API with no limit?", "No. Every provider Upcurrent checked caps free use: OpenRouter at 50 requests a day, Groq at 1,000 a day per model, Cloudflare at 10,000 Neurons a day, and Cohere at 1,000 calls a month."],
        ["How can I get more free AI API requests?", "Combine providers. Each free tier is separate, so OpenRouter plus Groq gives you both allowances. They're all OpenAI-compatible, so switching is a change of base URL."],
        ["Is there an unlimited free AI API key on GitHub?", "Keys shared on GitHub are other people's keys. Using them breaks the providers' terms, and they get revoked quickly. Get your own free key instead."]],
      body: `<section><h2>The real free limits</h2><div class="tablewrap"><table><thead><tr><th>Provider</th><th>Free limit</th></tr></thead><tbody>
<tr><th scope="row"><a href="../openrouter/">OpenRouter</a></th><td>50 requests a day (1,000 after buying 10 credits); 20 a minute</td></tr>
<tr><th scope="row"><a href="../groq/">Groq</a></th><td>1,000 requests and 200,000 tokens a day per model (gpt-oss-120b)</td></tr>
<tr><th scope="row"><a href="../cloudflare/">Cloudflare Workers AI</a></th><td>10,000 Neurons a day</td></tr>
<tr><th scope="row"><a href="../gemini/">Google Gemini</a></th><td>Set per model in Google AI Studio</td></tr>
<tr><th scope="row">Cohere</th><td>1,000 calls a month on a trial key</td></tr></tbody></table></div><p class="m">Sources: <a href="https://openrouter.ai/docs/api/reference/limits" rel="noopener">OpenRouter limits</a> · <a href="https://console.groq.com/docs/rate-limits" rel="noopener">Groq rate limits</a> · <a href="https://developers.cloudflare.com/workers-ai/platform/pricing/" rel="noopener">Cloudflare Workers AI pricing</a> · <a href="https://ai.google.dev/gemini-api/docs/rate-limits" rel="noopener">Gemini rate limits</a> · <a href="https://docs.cohere.com/docs/rate-limits" rel="noopener">Cohere rate limits</a>.</p></section>
<section><h2>How to get as close to unlimited as possible</h2><h3>Stack free tiers</h3><p>Use OpenRouter first and fall back to Groq, then Gemini, when one runs out. The <a href="../calculator/">free LLM API calculator</a> shows how far that stretches for your project.</p><h3>Use the router</h3><p>OpenRouter's <code>openrouter/free</code> picks an available free model for each request, so a removed model doesn't break your app.</p><h3>Run a model yourself</h3><p>Open models run on your own computer with tools like Ollama or LM Studio, with no request limit at all. See <a href="../../new-ai-models/open-source/">new open source AI models</a>.</p></section>` });
  }

  // X vs Y comparisons built from the same facts table.
  COMPARES.forEach(([a, b]) => {
    const A = API_FACTS[a], B = API_FACTS[b], slug = `${a}-vs-${b}`;
    const line = (label, f) => `<tr><th scope="row">${esc(label)}</th><td>${esc(f(A))}</td><td>${esc(f(B))}</td></tr>`;
    const body = `<section><h2>${esc(A.name)} vs ${esc(B.name)}: free tiers side by side</h2><div class="tablewrap"><table><thead><tr><th></th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>
${line("Free models", p => p.models(orN))}${line("Limits", p => p.limits)}${line("Credit card needed?", p => p.card)}${line("Your data", p => p.data)}${line("OpenAI-compatible base URL", p => p.base)}
</tbody></table></div>
<p>Full details: <a href="../${A.page}">${esc(A.name)}</a> · <a href="../${B.page}">${esc(B.name)}</a>. Sources: <a href="${A.docs}" rel="noopener">${esc(A.name)} docs</a> · <a href="${B.docs}" rel="noopener">${esc(B.name)} docs</a>.</p></section>
<section><h2>Which should you use?</h2><p>Use ${esc(A.name)} if ${esc(PICK[a])}. Use ${esc(B.name)} if ${esc(PICK[b])}. Both are free to start, so many developers keep a key for each and switch when one hits its limit.</p></section>`;
    const qa = [[`Is ${A.name} or ${B.name} better for free?`, `${A.name}: ${PICK[a]}. ${B.name}: ${PICK[b]}. Both have free tiers with limits.`],
      [`Do ${A.name} and ${B.name} need a credit card?`, `${A.name}: ${A.card}. ${B.name}: ${B.card}.`],
      [`What are the free limits on ${A.name} and ${B.name}?`, `${A.name}: ${A.limits}. ${B.name}: ${B.limits}.`],
      [`Do ${A.name} and ${B.name} use my prompts?`, `${A.name}: ${A.data}. ${B.name}: ${B.data}.`],
      [`Can I use the OpenAI SDK with ${A.name} and ${B.name}?`, `Yes. Both accept OpenAI-style requests: point the SDK at ${A.base} for ${A.name} or ${B.base} for ${B.name}, and use that provider's own API key.`]];
    shell(slug, { title: `${A.name.replace("Google ", "")} vs ${B.name.replace("Google ", "")}: free tiers compared | Upcurrent`, h1: `${A.name} vs ${B.name} (free tiers)`, eyebrow: "Free AI models · compare",
      lede: `${A.name} and ${B.name} free tiers compared: free models, rate limits, card rules and data use, from each provider's own docs.`, body, qa, crumb: `${A.short || A.name} vs ${B.short || B.name}` });
  });
  return out;
}
const PICK = { openrouter: "you want the most free models to choose from behind one key", gemini: "you want a Google model with a big context window", groq: "you want very fast responses from open models like gpt-oss-120b", cloudflare: "you already build on Cloudflare" };


function freeCluster(days, data, last, updated) {
  const out = {}, free = (last.free || []).filter(isChat), firstDay = days[0], lastDay = days[days.length - 1];
  const recent = days.slice(-7), hist = freeHistory(days, data);
  const events = [...new Map(recent.flatMap(d => data[d].freeChanges?.events || []).map(e => [e.type + e.name + e.prov + e.at, e])).values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const byProv = p => free.filter(f => f.prov === p);
  const or = byProv("OpenRouter"), oc = byProv("OpenCode Zen");
  const gone = hist.filter(m => !m.now), lifespans = gone.map(m => m.span).sort((a, b) => a - b);
  const median = lifespans.length ? lifespans[Math.floor(lifespans.length / 2)] : null;
  const allTime = hist.filter(m => m.first === firstDay && m.now).length;
  const buckets = [["1-3 days", 1, 3], ["4-7 days", 4, 7], ["8-14 days", 8, 14], ["15-30 days", 15, 30], ["31+ days", 31, 1e9]].map(([l, a, b]) => [l, gone.filter(m => m.span >= a && m.span <= b).length]);
  const lifeRows = [...buckets, ["Still free", hist.length - gone.length]];
  const lifeChart = src => gone.length ? chart("free-ai-models/history/how-long-free-ai-models-stay-free.svg", src,
    { title: "How long free AI models stay free", sub: `${hist.length} models seen free on OpenRouter and OpenCode since ${shortDate(firstDay)}, by how long the free offer lasted`, rows: lifeRows },
    `Bar chart of how long free AI models stayed free. Of ${gone.length} models that stopped being free: ${buckets.map(([l, n]) => `${n} lasted ${l}`).join(", ")}. ${hist.length - gone.length} are still free.`,
    `Of ${gone.length} models that stopped being free, half lasted ${median} days or less. "Still free" counts every model type, including a few that aren't chat models. From Upcurrent's daily snapshots, ${esc(asOf(updated))}.`) : "";
  const perDay = days.map(d => [d, (data[d].free || []).filter(isChat).length]).filter(([, n]) => n > 0);
  const weekly = perDay.filter((_, i) => (perDay.length - 1 - i) % 7 === 0);
  const dayChart = src => weekly.length > 2 ? chart("free-ai-models/history/free-ai-models-count-by-week.svg", src,
    { title: "Free AI models on offer over time", sub: `Free chat models on OpenRouter and OpenCode, counted at the end of each day shown`, rows: weekly.map(([d, n]) => [shortDate(d).replace(/ \d{4}$/, ""), n]) },
    `Bar chart of how many free AI models were on offer over time: ${weekly.map(([d, n]) => `${n} on ${shortDate(d)}`).join(", ")}.`,
    `The number of free models goes up and down as providers add and remove offers. ${esc(asOf(updated))}.`) : "";
  const asof = `<p class="asof">Last checked ${esc(asOf(updated))}. Upcurrent checks OpenRouter and OpenCode every 30 minutes.</p>`;
  const mk = (sub, { title, h1, eyebrow, lede, desc, body, qa, list, crumb }) => {
    const url = `${SITE}free-ai-models/${sub}`, up = sub ? "../../" : "../";
    const html = `<section><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(h1)}</h1><p class="lede">${esc(lede)}</p>${freeNav(sub, up)}${asof}</section>
${body}
${faqHtml(qa)}
<section class="share" aria-label="Share this page"><b>Share:</b> ${shareLinks(url, h1)}</section>`;
    const ld = [...(list ? [{ "@context": "https://schema.org", "@type": "ItemList", name: h1, url, numberOfItems: list.length, itemListElement: list.map((f, i) => ({ "@type": "ListItem", position: i + 1, name: f.name, ...(safeUrl(f.url) ? { url: f.url } : {}) })) }] : []),
      faq(qa), breadcrumb([["Upcurrent", SITE], ["Free AI models", SITE + "free-ai-models/"], ...(sub ? [[crumb, url]] : [])])];
    out["free-ai-models" + (sub ? "/" + sub.replace(/\/$/, "") : "")] = page({ title, description: clip(desc, 160), canonical: url, body: html, ld, up, ogType: sub ? "article" : "website" });
  };

  // Hub: the full list with a filter, linked to every page in the cluster.
  {
    const tools = free.filter(hasTools).length, img = free.filter(f => capsOf(f.caps).includes("images")).length;
    const qa = [
      ["Which AI models are free to use right now?", `As of ${asOf(updated)}, ${free.length} AI models were free to use: ${free.slice(0, 6).map(f => f.name).join(", ")}${free.length > 6 ? " and more" : ""}. ${or.length} are on OpenRouter and ${oc.length} are free inside OpenCode.`],
      ["Is there a completely free AI model with no limits?", `No. Every free model has limits. On OpenRouter, free models allow 20 requests a minute and 50 a day, or 1,000 a day once you have bought at least 10 credits. OpenCode's free models only work inside the OpenCode app.`],
      ["How long do AI models stay free?", median ? `Not long. Since ${shortDate(firstDay)} Upcurrent has seen ${hist.length} different models offered free. ${gone.length} of them have stopped being free, and half of those lasted ${median} days or less.` : `Free offers change often, so check the date on any list you use.`],
      ["How can I get an AI model for free?", `Three ways: call a free model by API (OpenRouter has ${or.length} today), use a coding app with free models built in (OpenCode has ${oc.length}), or download an open model from Hugging Face and run it on your own computer with a tool like Ollama or LM Studio.`],
      ["What are the top 5 free AI models right now?", `Today's free list, in Upcurrent's order, starts with ${free.slice(0, 5).map(f => `${f.name} (${f.prov})`).join(", ")}. Free offers change often, so check the date.`],
      ["Which free AI model is best?", `It depends on the job. For coding agents you need tool calling and a long context window; ${tools} of today's free models have tool calling. ${img} accept images. Use the filter on this page, or see the free models for coding page.`]
    ];
    const body = `<section id="finder"><h2>Find a free model</h2><p>Tick what you need. The list below updates as you go.</p>
<div class="finder" role="group" aria-label="Filter free models">
<label><input type="checkbox" data-f="tool calling"> Tool calling</label><label><input type="checkbox" data-f="reasoning"> Reasoning</label><label><input type="checkbox" data-f="images"> Reads images</label>
<label><input type="checkbox" data-f="ctx"> 1M+ token context</label><label><input type="checkbox" data-f="api"> Works in any app (API)</label></div>
<p class="asof" id="finderCount" aria-live="polite">Showing all ${free.length}.</p></section>
<section id="list"><h2>All ${free.length} free AI models</h2><ol class="rows" id="freeList">${free.map(f => freeRow(f)).join("")}</ol></section>
<section><h2>Free models by what you want to do</h2><ul class="rows">
<li><span class="t"><a href="coding/">Free AI models for coding</a></span><span class="m">${free.filter(hasTools).length} free models with tool calling, for coding agents like OpenCode, Cline and Aider</span></li>
<li><span class="t"><a href="api/">Free AI model API</a></span><span class="m">How to call a free LLM from your own code, with rate limits and an example request</span></li>
<li><span class="t"><a href="free-llm-api-key/">How to get a free LLM API key</a></span><span class="m">Step by step, from sign-up to your first reply, no card needed</span></li>
<li><span class="t"><a href="openrouter/">OpenRouter free models list</a></span><span class="m">${or.length} models with their <code>:free</code> IDs</span></li>
<li><span class="t"><a href="opencode/">OpenCode free models</a></span><span class="m">${oc.length} models that are free inside the OpenCode coding agent</span></li>
<li><span class="t"><a href="history/">Free AI model tracker</a></span><span class="m">All ${hist.length} models seen free since ${shortDate(firstDay)}, and how long each lasted</span></li>
</ul></section>
${(() => {
  const toolBig0 = free.filter(hasTools).sort((a, b) => (b.ctx || 0) - (a.ctx || 0))[0], big = [...free].filter(f => f !== toolBig0).sort((a, b) => (b.ctx || 0) - (a.ctx || 0))[0], toolBig = free.filter(hasTools).sort((a, b) => (b.ctx || 0) - (a.ctx || 0))[0], vis = free.find(f => f !== toolBig && capsOf(f.caps).includes("images") && hasTools(f)) || free.find(f => f !== toolBig && capsOf(f.caps).includes("images"));
  const picks = [[toolBig, "For coding agents", "has tool calling and the longest context of the free models that do"], [vis, "For reading screenshots and images", hasTools(vis || {}) ? "accepts images and can call tools" : "accepts images"], [big, "For long documents", big && big.prov === "OpenCode Zen" ? "has one of the biggest context windows on the free list (inside OpenCode only)" : "has one of the biggest context windows on the free list"]].filter(([f]) => f);
  return `<section id="picks"><h2>Upcurrent's picks from today's list</h2><p>Picked by rule from today's data, not by hand, so they change when the list does.</p><ul class="rows">${picks.map(([f, why, how]) => `<li><span class="t">${esc(why)}: ${link(f.url, f.name)}</span><span class="m">${esc(`${f.prov} · ${ctxLabel(f.ctx) || "?"} context · it ${how}`)}</span></li>`).join("")}</ul></section>`;
})()}
<section id="catch"><h2>What's the catch with free AI models?</h2>
<h3>Your data and privacy</h3><p>Free models are often free because the provider wants feedback or training data. Many free OpenRouter models say prompts may be logged, and Gemini's free tier may use content to improve Google's products. Don't paste customer data or secrets into a free model.</p>
<h3>They disappear</h3><p>Since ${esc(shortDate(firstDay))} Upcurrent has seen ${hist.length} models offered free; ${gone.length} have stopped being free, half within ${median ?? "a few"} days. Only ${allTime} ${allTime === 1 ? "has" : "have"} been free every day since then. Build so you can swap models.</p>
${lifeChart("history/how-long-free-ai-models-stay-free.svg")}
<h3>Limits</h3><p>Free-tier limits are much lower than paid ones. OpenRouter allows 20 requests a minute and 50 a day (1,000 after buying 10 credits). OpenCode's free models only work inside OpenCode. Free OpenRouter models are called through the same OpenAI-compatible API as paid ones, so moving up later is a one-line change.</p></section>
<section><h2>Free models from other providers</h2><ul class="rows"><li><span class="t"><a href="gemini/">Gemini API free tier</a></span><span class="m">Gemini 4 Hydrogen and Gemini 3.8 Flash, free with no billing account</span></li><li><span class="t"><a href="groq/">Groq free API</a></span><span class="m">gpt-oss-120b and qwen3.8-27b, 1,000 requests a day each</span></li><li><span class="t"><a href="cloudflare/">Cloudflare Workers AI</a></span><span class="m">10,000 Neurons a day across most of its models</span></li><li><span class="t"><a href="coding-tools/">Free AI coding tools</a></span><span class="m">GitHub Copilot Free, Cursor, Kilo Code, Antigravity and more</span></li></ul></section>
<section id="by-tool"><h2>Free AI for the tool you use</h2><ul class="rows"><li><span class="t"><a href="langchain/">Free LLM API for LangChain</a></span><span class="m">Groq, Gemini and OpenRouter with ChatOpenAI</span></li><li><span class="t"><a href="n8n/">Free AI models in n8n</a></span><span class="m">Free models for n8n AI agents</span></li><li><span class="t"><a href="claude-code/">Free LLM API for Claude Code</a></span><span class="m">What works, and the free alternatives</span></li><li><span class="t"><a href="janitor-ai/">Free API for Janitor AI</a></span><span class="m">OpenRouter setup with today's free models</span></li><li><span class="t"><a href="for-students/">Free AI API for students</a></span><span class="m">GitHub Copilot Student and free API tiers</span></li><li><span class="t"><a href="no-limit/">Free LLM API with no limit?</a></span><span class="m">The honest answer, and how to stretch free tiers</span></li><li><span class="t"><a href="embed/">Embed this list on your site</a></span><span class="m">A live box that updates itself, free</span></li><li><span class="t"><a href="../reports/">State of free AI: weekly reports</a></span><span class="m">Which models went free and which ended, week by week</span></li></ul></section>
${events.length ? `<section id="changes"><h2>Added and removed this week</h2><ul class="rows">${events.slice(0, 30).map(e => `<li><span class="t">${e.type === "added" ? "Added" : "Removed"}: ${link(e.url, e.name)}</span><span class="m">${esc(e.prov)} · ${esc(asOf(e.at))}</span></li>`).join("")}</ul></section>` : ""}
<script>(function(){var bs=[].slice.call(document.querySelectorAll(".finder input")),rows=[].slice.call(document.querySelectorAll("#freeList li")),c=document.getElementById("finderCount");
function run(){var on=bs.filter(function(b){return b.checked}).map(function(b){return b.dataset.f}),n=0;rows.forEach(function(r){var caps=r.dataset.caps.split(","),ok=on.every(function(f){return f==="ctx"?+r.dataset.ctx>=1e6:f==="api"?r.dataset.prov==="OpenRouter":caps.indexOf(f)>-1});r.hidden=!ok;if(ok)n++});c.textContent=on.length?("Showing "+n+" of "+rows.length+"."):("Showing all "+rows.length+".")}
bs.forEach(function(b){b.addEventListener("change",run)})})();</script>`;
    mk("", { title: `Free AI models list: ${free.length} you can use right now | Upcurrent`, h1: `Free AI models you can use right now`, eyebrow: "Free AI models · updated every 30 minutes",
      lede: `${free.length} AI models are free to use today: ${or.length} on OpenRouter and ${oc.length} inside OpenCode. Free offers come and go every week, so this list is checked every 30 minutes, not once a month.`,
      desc: `${free.length} AI models you can use free today, on OpenRouter and OpenCode, with model IDs, context size and features. Filter by tool calling or images. Checked every 30 minutes.`,
      body, qa, list: free });
  }

  // Coding: free models a coding agent can use (tool calling), longest context first.
  {
    const pick = free.filter(f => hasTools(f) || f.prov === "OpenCode Zen").sort((a, b) => (hasTools(b) - hasTools(a)) || (b.ctx || 0) - (a.ctx || 0));
    const qa = [
      ["What is the best free AI model for coding right now?", `Upcurrent doesn't run its own coding benchmark, so it lists the free models that have what a coding agent needs: tool calling and a long context window. As of ${asOf(updated)} that includes ${pick.slice(0, 4).map(f => f.name).join(", ")}. Try two or three on your own project and keep the one that edits your code best.`],
      ["Why does tool calling matter for coding?", "Coding agents such as OpenCode, Cline and Aider work by letting the model call tools: read a file, run a command, edit code. A model without tool calling can chat about code but can't act on your project."],
      ["Can I use free models in VS Code?", "Yes. Extensions such as Cline and Continue accept an OpenRouter API key, and any OpenRouter model ending in :free costs nothing within its rate limits."],
      ["Are free coding models safe for private code?", "Be careful. Free endpoints may log prompts or use them to improve models. Check each provider's data policy before sending code you can't share."]
    ];
    const body = `<section><h2>How this list is made</h2><p>Every model here is free today and either supports tool calling (needed by coding agents) or is offered free inside OpenCode, a coding agent. Models with tool calling come first, then the longest context window, because a longer window lets the model read more of your project at once.</p></section>
<section id="list"><h2>${pick.length} free models for coding</h2><ol class="rows">${pick.map(f => freeRow(f, f.prov === "OpenCode Zen" ? "free inside OpenCode" : "")).join("")}</ol></section>
<section><h2>How to use them</h2><h3>In OpenCode</h3><p>Run <code>/models</code> in OpenCode and pick a model marked Free. See the <a href="../opencode/">OpenCode free models</a> page for the IDs.</p>
<h3>In VS Code, Cline, Aider or your own tools</h3><p>Create a free <a href="https://openrouter.ai" rel="nofollow noopener">OpenRouter</a> key and use a model ID ending in <code>:free</code>. The <a href="../api/">free AI model API</a> page has an example request.</p></section>`;
    mk("coding/", { title: `Free AI models for coding: ${pick.length} options today | Upcurrent`, h1: "Free AI models for coding", eyebrow: "Free AI models · coding",
      lede: `${pick.length} free AI models you can use for coding today, filtered for what coding agents need: tool calling and a long context window. Rebuilt every 30 minutes from live provider lists.`,
      desc: `${pick.length} free AI models for coding today, with tool calling and context size, and how to use them in OpenCode, Cline, Aider and VS Code. Updated every 30 minutes.`,
      body, qa, list: pick, crumb: "For coding" });
  }

  // API: how to call a free LLM from code.
  {
    const ex = or.find(f => /nemotron-3-ultra/.test(modelId(f) || "")) || or.find(hasTools) || or[0];
    const id = ex ? modelId(ex) : "openrouter/free";
    const qa = [
      ["Is there a free AI model API?", `Yes. OpenRouter offers ${or.length} models free through its API today, with IDs ending in :free. Google Gemini, Groq, Cloudflare Workers AI and NVIDIA also have free tiers with their own limits.`],
      ["What are the free API rate limits?", "On OpenRouter, free models allow 20 requests per minute. You get 50 free requests a day, or 1,000 a day once you have bought at least 10 credits in total."],
      ["Do I need a credit card for a free LLM API key?", "No. You can create an OpenRouter account and API key without paying and use the :free models within the limits above."],
      ["Can I use OpenCode's free models through the API?", "No. OpenCode says its free chat models only work inside OpenCode. From other apps you need its paid models."],
      ["Which LLM API is totally free?", `None is free without limits. OpenRouter's :free models (${or.length} today) cost nothing to call, and Google Gemini, Groq, Cloudflare and NVIDIA have free tiers. Each caps how many requests you can make.`],
      ["What is the cheapest LLM API to use?", "A free model is the cheapest: $0 per token within its limits. When you outgrow the free limits, the same OpenRouter key works with paid models, so you can compare their live prices on OpenRouter's models page and switch by changing one line."]
    ];
    const body = `<section><h2>The short version</h2><ol class="rows">
<li><span class="t">1. Make a free account at <a href="https://openrouter.ai" rel="nofollow noopener">OpenRouter</a> and create an API key.</span></li>
<li><span class="t">2. Pick a model ID ending in <code>:free</code> from the list below.</span></li>
<li><span class="t">3. Call it like the OpenAI API, with base URL <code>https://openrouter.ai/api/v1</code>.</span></li></ol></section>
<section><h2>Example request</h2><pre><code>curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${esc(id)}", "messages": [{"role": "user", "content": "Hello"}]}'</code></pre>
<p>Swap in any ID from the list. <code>openrouter/free</code> picks an available free model for you.</p>
<p>The same call in Python, with the OpenAI library:</p><pre><code>from openai import OpenAI
client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key="YOUR_OPENROUTER_KEY")
reply = client.chat.completions.create(model="${esc(id)}", messages=[{"role": "user", "content": "Hello"}])
print(reply.choices[0].message.content)</code></pre>
<p>New to this? <a href="../free-llm-api-key/">How to get a free LLM API key, step by step</a>.</p></section>
<section><h2>Free API limits</h2><ul class="rows"><li><span class="t">20 requests per minute</span><span class="m">on any :free model</span></li><li><span class="t">50 requests per day</span><span class="m">if you have bought less than 10 credits</span></li><li><span class="t">1,000 requests per day</span><span class="m">once you have bought 10 credits or more</span></li></ul>
<p>Source: <a href="${OR_LIMITS}" rel="nofollow noopener">OpenRouter's rate limit docs</a>, checked ${esc(shortDate(lastDay))}.</p></section>
<section id="other"><h2>Other free LLM APIs</h2><p>Upcurrent tracks OpenRouter live. These providers also have free tiers; facts below were checked on 22 November 2026 from each provider's own page. Want to skip the card? See <a href="../no-credit-card/">free LLM APIs with no credit card</a>.</p><ul class="rows">
<li><span class="t"><a href="../gemini/">Google Gemini API</a></span><span class="m">Free tier on some models, such as Gemini 4 Hydrogen, Gemini 3.8 Flash and Gemini 3.5 Flash-Lite. The newest top models (Gemini 4 Carbon, Argon, Neon) are paid only. Free-tier prompts may be used to improve Google's products.</span></li>
<li><span class="t"><a href="../groq/">Groq</a></span><span class="m">Free plan with limits per model. For example, gpt-oss-120b allows 30 requests a minute and 1,000 a day.</span></li>
<li><span class="t"><a href="../cloudflare/">Cloudflare Workers AI</a></span><span class="m">10,000 Neurons a day free (its own unit of compute), across most of its models. Some newer models need a paid plan.</span></li>
<li><span class="t"><a href="https://build.nvidia.com/" rel="nofollow noopener">NVIDIA (build.nvidia.com)</a></span><span class="m">Free inference endpoints for leading models, including Nemotron 3 Ultra and Kimi K3.1 Pro.</span></li>
<li><span class="t"><a href="https://docs.cohere.com/docs/rate-limits" rel="nofollow noopener">Cohere</a></span><span class="m">Free trial keys for its Command models: 1,000 API calls a month and 20 requests a minute on chat models.</span></li>
<li><span class="t"><a href="https://mistral.ai/pricing" rel="nofollow noopener">Mistral</a></span><span class="m">Its Free plan includes access to Mistral Studio, where the API lives. The pricing page doesn't say how much free API use that includes, so check your Studio dashboard.</span></li></ul></section>
<section id="compare"><h2>Free LLM APIs compared</h2><div class="tablewrap"><table><thead><tr><th>API</th><th>Free limits</th><th>Card?</th><th>Your data</th></tr></thead><tbody>
${["openrouter", "gemini", "groq", "cloudflare"].map(k => API_FACTS[k]).map(p => `<tr><th scope="row"><a href="../${p.page}">${esc(p.name)}</a></th><td>${esc(p.limits)}</td><td>${esc(p.card)}</td><td>${esc(p.data)}</td></tr>`).join("")}
</tbody></table></div><p>Not sure which fits your project? Try the <a href="../calculator/">free LLM API calculator</a>. Side by side: <a href="../openrouter-vs-gemini/">OpenRouter vs Gemini</a> · <a href="../openrouter-vs-groq/">OpenRouter vs Groq</a> · <a href="../groq-vs-gemini/">Groq vs Gemini</a>.</p></section>
${(() => {
  const vis = or.filter(f => capsOf(f.caps).includes("images")).length;
  const fam = Object.entries(or.reduce((a, f) => { const k = (f.name.split(/[\s:\/-]/)[0] || "").replace(/[^A-Za-z]/g, ""); if (k.length > 2) a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return `<section id="more"><h2>Beyond chat: vision, speech-to-text and embeddings for free</h2><ul class="rows">
<li><span class="t">Vision (multimodal models)</span><span class="m">${vis} of today's ${or.length} free OpenRouter models accept images as well as text. More in <a href="../image-and-speech/">free image and speech APIs</a></span></li>
<li><span class="t">Speech-to-text</span><span class="m">Groq's free plan runs whisper-large-v3 at 20 requests a minute and 2,000 a day. Gemini 3.5 Transcribe is also on Gemini's free tier</span></li>
<li><span class="t">Embeddings</span><span class="m">gemini-embedding-2 is free on Gemini's free tier, for search and retrieval projects</span></li>
<li><span class="t">Tokens per minute, not just requests</span><span class="m">Some limits count tokens too. Groq's gpt-oss-120b allows 8,000 tokens per minute on the free plan, so long prompts hit the cap before the request count does</span></li>
<li><span class="t">One SDK for all of them</span><span class="m">OpenRouter, Gemini, Groq and Cloudflare are all OpenAI-compatible, so the OpenAI SDK works with each by changing the base URL. <a href="../openai-compatible/">Base URLs here</a></span></li>
${fam.length ? `<li><span class="t">Model families on the free list today</span><span class="m">${esc(fam.map(([k, n]) => `${k} (${n})`).join(", "))}</span></li>` : ""}</ul></section>`;
})()}
<section id="experience"><h2>From the person who runs Upcurrent</h2><blockquote style="margin:0;padding:12px 16px;border-left:3px solid var(--line)"><p>"I've used Gemini and Groq. Gemini is very good for school homework. Groq is good too, but I found its safety filters frustrating. I haven't used OpenRouter myself yet. I first heard about it in the early days of vibe coding, and I recommend it below because of what Upcurrent's data shows, not personal use."</p><p>Anmol, who built and runs Upcurrent</p></blockquote></section>
<section id="take"><h2>Upcurrent's take: which free API should you use?</h2>
<h3>Start with OpenRouter</h3><p>One free key reaches ${or.length} free models today, and switching model is one line. That matters more than any single model, because free models don't last: of the ${gone.length} models Upcurrent has seen stop being free since ${esc(shortDate(firstDay))}, half lasted ${median ?? "a few"} days or less (<a href="../history/">tracker</a>).</p>
<h3>Add a second provider as a backup</h3><p>Gemini's free tier for a big-context Google model, or Groq when speed matters. When one hits its limit, switch to the other instead of waiting.</p>
<h3>Don't send private data to any free tier</h3><p>Gemini says free-tier content may be used to improve Google's products, and many free OpenRouter models say prompts may be logged. Free is fine for side projects and testing; pay for anything with customer data.</p>
<h3>"Unlimited free" doesn't exist</h3><p>Every provider above caps requests or compute. Lists that promise unlimited free keys are usually out of date or reselling someone else's quota.</p></section>

<section id="list"><h2>${or.length} free models you can call by API</h2><ol class="rows">${or.map(f => freeRow(f)).join("")}</ol></section>`;
    mk("api/", { title: "Free AI model API: free LLMs you can call today | Upcurrent", h1: "Free AI model API: free LLMs you can call today", eyebrow: "Free AI models · API",
      lede: `You can call ${or.length} AI models for free through an API today, with no card needed. Here is how, with exact model IDs, rate limits, example code, how 8 free LLM APIs compare, and which one we'd pick.`,
      desc: `How to use a free LLM API: ${or.length} free models with exact IDs, OpenRouter rate limits (20 a minute, 50 or 1,000 a day) and a copy-paste example request.`,
      body, qa, list: or, crumb: "Free API" });
  }

  // No credit card: which free tiers start without one.
  {
    const noCard = [["OpenRouter", "../openrouter/", `${or.length} free models today, 20 requests a minute and 50 a day (1,000 after buying 10 credits)`, "No card for :free models"]]
      .concat(PROVIDERS.filter(p => p.card).map(p => [p.name, `../${p.slug}/`, p.facts[0][1], p.facts.find(f => f[0] === "Card needed?")[1].replace(/^No\. /, "No card: ")]));
    const qa = [
      ["Is there a free LLM API with no credit card?", `Yes. OpenRouter's ${or.length} free models, Google's Gemini API free tier and Groq's Free plan all start without a card. Each has its own limits.`],
      ["Which free LLM API is best without a card?", "For the most model choice, OpenRouter. For a big-name model, Gemini's free tier. For speed, Groq. Many people sign up to two and switch when one hits its limit."],
      ["Are no-card free APIs safe for private data?", "Be careful. Gemini's free tier and many free OpenRouter models may use or log your prompts. Don't send personal or confidential data to a free tier."]
    ];
    const body = `<section id="list"><h2>${noCard.length} free LLM APIs you can start without a card</h2><ul class="rows">${noCard.map(([n, href, what, card]) => `<li><span class="t"><a href="${href}">${esc(n)}</a></span><span class="m">${esc(what)} · ${esc(card)}</span></li>`).join("")}</ul>
<p>Card rules checked ${esc(CHECKED)} from each provider's own docs. OpenRouter's free list is checked live every 30 minutes.</p></section>
<section><h2>Free, but check the plan</h2><ul class="rows"><li><span class="t"><a href="../cloudflare/">Cloudflare Workers AI</a></span><span class="m">10,000 Neurons a day free on the Workers Free plan; some newer models need a paid billing method</span></li><li><span class="t"><a href="https://build.nvidia.com/" rel="nofollow noopener">NVIDIA (build.nvidia.com)</a></span><span class="m">Offers free inference with models like Nemotron 3 Ultra; its card and limit rules aren't stated on the page we checked</span></li></ul></section>
<section><h2>Start in two minutes</h2><p>Follow the <a href="../free-llm-api-key/">step-by-step guide to a free LLM API key</a>. It uses OpenRouter, which needs no card.</p></section>`;
    mk("no-credit-card/", { title: "Free LLM API with no credit card: 3 that work | Upcurrent", h1: "Free LLM APIs with no credit card",
      eyebrow: "Free AI models · no card",
      lede: `${noCard.length} free LLM APIs you can start using without a credit card, with their free models and limits. Checked against each provider's own docs.`,
      desc: `Free LLM APIs with no credit card needed: OpenRouter (${or.length} free models), Gemini's free tier and Groq's free plan, with limits and the catch.`, body, qa, crumb: "No credit card" });
  }

  // Tutorial (top of funnel): get a free key and make a first request.
  {
    const ex = or.find(f => /nemotron-3-ultra/.test(modelId(f) || "")) || or.find(hasTools) || or[0];
    const id = ex ? modelId(ex) : "openrouter/free";
    const qa = [
      ["How do I get a free LLM API key?", "Sign up at OpenRouter, open the Keys page in your dashboard and create a key. It is free and needs no card. Use it with any model ID ending in :free, or with openrouter/free."],
      ["Can I use an LLM for free?", `Yes. With a free OpenRouter key you can call ${or.length} models today at no cost, up to 50 requests a day (1,000 a day once you have bought at least 10 credits).`],
      ["Is a free LLM API key safe to use?", "Treat it like a password: keep it in an environment variable, never in code you share. On many free models the provider may log prompts to improve its model, so do not send private or sensitive data."],
      ["What happens when I hit the free limit?", "Requests fail with error 429 until the limit resets. Wait and retry, switch to another free model, or buy 10 credits to raise the daily limit to 1,000."]
    ];
    const body = `<section><h2>Step 1: create a free account</h2><p>Go to <a href="https://openrouter.ai" rel="nofollow noopener">openrouter.ai</a> and sign up. No card is needed for free models.</p></section>
<section><h2>Step 2: create an API key</h2><p>In your OpenRouter dashboard, open <b>Keys</b> and create a new key. Copy it straight away and keep it somewhere private. Then save it as an environment variable:</p><pre><code>export OPENROUTER_API_KEY=sk-or-v1-...</code></pre></section>
<section><h2>Step 3: pick a free model</h2><p>Any model whose ID ends in <code>:free</code> costs nothing. ${or.length} are free today; a few with tool calling:</p><ol class="rows">${or.filter(hasTools).slice(0, 5).map(f => freeRow(f)).join("")}</ol><p>Or use <code>openrouter/free</code>, which picks an available free model for each request. <a href="../openrouter/">See all ${or.length} free OpenRouter models</a>.</p></section>
<section><h2>Step 4: make your first request</h2><pre><code>curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${esc(id)}", "messages": [{"role": "user", "content": "Hello"}]}'</code></pre>
<p>OpenRouter works like the OpenAI API, so most tools only need the base URL <code>https://openrouter.ai/api/v1</code> and your key.</p></section>
<section><h2>Step 5: know the limits</h2><ul class="rows"><li><span class="t">20 requests per minute</span><span class="m">on any :free model</span></li><li><span class="t">50 requests per day</span><span class="m">if you have bought less than 10 credits</span></li><li><span class="t">1,000 requests per day</span><span class="m">once you have bought 10 credits or more</span></li></ul>
<p>Free models come and go: half of those that stopped being free lasted ${median ?? "a few"} days or less (<a href="../history/">tracker</a>). Have a second model ready. Source: <a href="${OR_LIMITS}" rel="nofollow noopener">OpenRouter's limits docs</a>, checked ${esc(shortDate(lastDay))}.</p></section>`;
    mk("free-llm-api-key/", { title: "How to get a free LLM API key (step by step) | Upcurrent", h1: "How to get a free LLM API key", eyebrow: "Free AI models · guide",
      lede: `Five steps from sign-up to your first AI reply, at no cost and with no card. Works with the ${or.length} models that are free on OpenRouter today.`,
      desc: `Get a free LLM API key in five steps: sign up, create a key, pick one of ${or.length} free models, send your first request, and know the limits. No card needed.`,
      body, qa, crumb: "Free LLM API key" });
  }

  // OpenRouter list with IDs.
  {
    const qa = [
      ["Which OpenRouter models are free?", `As of ${asOf(updated)}: ${or.map(f => f.name).join(", ")}.`],
      ["Are free OpenRouter models really free?", "Yes, within limits: 20 requests a minute and 50 a day, or 1,000 a day after buying at least 10 credits. If your account balance goes negative, free models stop working until you top up."],
      ["How do I use free models on OpenRouter?", "Use a model ID ending in :free, or openrouter/free to let OpenRouter pick one. Free models can be removed without notice, so have a fallback."]
    ];
    const body = `<section id="list"><h2>${or.length} free OpenRouter models</h2><ol class="rows">${or.map(f => freeRow(f)).join("")}</ol></section>
<section><h2>OpenRouter free models limit</h2><p>20 requests per minute on free models. 50 requests per day, or 1,000 per day after buying 10 credits. <a href="${OR_LIMITS}" rel="nofollow noopener">OpenRouter's docs</a>.</p></section>
<section><h2>Next steps</h2><ul class="rows"><li><span class="t"><a href="../free-llm-api-key/">How to use OpenRouter free models</a></span><span class="m">Get a key and make your first request, step by step</span></li><li><span class="t"><a href="../coding/">OpenRouter free models for coding</a></span><span class="m">The free models with tool calling, for coding agents</span></li></ul></section>`;
    mk("openrouter/", { title: `OpenRouter free models: all ${or.length} listed (${monthYear(lastDay)}) | Upcurrent`, h1: "OpenRouter free models list", eyebrow: "Free AI models · OpenRouter",
      lede: `${or.length} models are free on OpenRouter right now. Here are their exact :free IDs, context windows and features, checked every 30 minutes.`,
      desc: `Every free model on OpenRouter today (${or.length}), with exact :free model IDs, context size, tool calling and rate limits. Checked every 30 minutes.`,
      body, qa, list: or, crumb: "OpenRouter" });
  }

  // OpenCode list.
  {
    const ocChat = oc;
    const qa = [
      ["Which models are free in OpenCode?", `As of ${asOf(updated)}: ${ocChat.map(f => f.name).join(", ")}.`],
      ["How do I use free models in OpenCode?", "Run /models in OpenCode and pick a model marked Free, or set the model in opencode.json as opencode/<model-id>."],
      ["Can I use OpenCode's free models in other apps?", "No. OpenCode's docs say free-tier chat models require OpenCode. For other apps, use OpenRouter's free models."]
    ];
    const body = `<section id="list"><h2>${ocChat.length} free OpenCode models</h2><ol class="rows">${ocChat.map(f => freeRow(f)).join("")}</ol></section>
<section><h2>Setting one in opencode.json</h2><pre><code>{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/${esc(ocChat[0] ? modelId(ocChat[0]) : "model-id")}"
}</code></pre><p>Model IDs follow <a href="${OC_DOCS}" rel="nofollow noopener">OpenCode's model list</a>. Free models only work inside OpenCode.</p></section>`;
    mk("opencode/", { title: `OpenCode free models: ${ocChat.length} free today | Upcurrent`, h1: "OpenCode free models", eyebrow: "Free AI models · OpenCode",
      lede: `${ocChat.length} models are free inside the OpenCode coding agent today. Here are their IDs and context windows, and how to switch to one.`,
      desc: `The ${ocChat.length} models that are free in OpenCode today, with model IDs, context size and how to set them in opencode.json. Checked every 30 minutes.`,
      body, qa, list: ocChat, crumb: "OpenCode" });
  }

  // History: Upcurrent's own record of every free model, the cluster's linkable data.
  {
    const sorted = [...hist].sort((a, b) => (b.now - a.now) || b.last.localeCompare(a.last) || a.first.localeCompare(b.first));
    const qa = [
      ["How many AI models have been free?", `Since ${shortDate(firstDay)}, Upcurrent has recorded ${hist.length} different models offered free on OpenRouter and OpenCode. ${free.length} are free today.`],
      ["How long do free AI models last?", median ? `Of the ${gone.length} that are no longer free, half lasted ${median} days or less. Only ${allTime} have been free every day since ${shortDate(firstDay)}.` : "See the table on this page."],
      ["Can I use this data?", "Yes. It comes from Upcurrent's open data, licensed CC BY 4.0. Please link to this page if you cite it."]
    ];
    const body = `<section><h2>Key numbers</h2><ul class="stats"><li><b class="num">${hist.length}</b> models seen free since ${esc(shortDate(firstDay))}</li><li><b class="num">${free.length}</b> free today</li><li><b class="num">${gone.length}</b> no longer free</li>${median ? `<li><b class="num">${median} days</b> median time free, for those that ended</li>` : ""}<li><b class="num">${allTime}</b> free every day since the start</li></ul>
<p>From end-of-day snapshots, so an offer that started and ended within one day may be missing. Cite as: Upcurrent free AI model tracker, ${esc(SITE)}free-ai-models/history/ (CC BY 4.0).</p></section>
<section id="charts"><h2>Free AI models over time</h2>${lifeChart("how-long-free-ai-models-stay-free.svg")}${dayChart("free-ai-models-count-by-week.svg")}</section>
<section id="cite"><h2>Use these numbers in your article</h2><p>Writing about free AI models? You're welcome to quote these figures and use the chart, with a link back to this page (CC BY 4.0).</p>
<h3>Quotable facts</h3><ul class="rows"><li><span class="t">${esc(`Since ${shortDate(firstDay)}, ${hist.length} different AI models have been offered free on OpenRouter and OpenCode, and ${gone.length} of them have stopped being free.`)}</span><span class="m">Source: Upcurrent free AI model tracker</span></li>${median ? `<li><span class="t">${esc(`Half of the free AI models that stopped being free lasted ${median} days or less.`)}</span><span class="m">Source: Upcurrent free AI model tracker</span></li>` : ""}<li><span class="t">${esc(`Only ${allTime} models have been free every day since ${shortDate(firstDay)}.`)}</span><span class="m">Source: Upcurrent free AI model tracker</span></li></ul>
<h3>Embed the chart</h3><p>Copy this into your page:</p><pre><code>${esc(`<a href="${SITE}free-ai-models/history/"><img src="${SITE}free-ai-models/history/how-long-free-ai-models-stay-free.svg" alt="How long free AI models stay free, from the Upcurrent tracker" width="800" height="420"></a>`)}</code></pre>
<p>The chart updates every day. For a live list of today's free models instead, use the <a href="../embed/">embeddable box</a>. Raw data is in <a href="../../data.html">Upcurrent's open data</a> as JSON.</p></section>
<section id="list"><h2>Every free model Upcurrent has seen</h2><ol class="rows">${sorted.map(m => `<li><span class="t">${m.now ? `<span class="tag">Free now</span> ` : ""}${link(m.url, m.name)}</span><span class="m">${esc([m.prov, `free from ${shortDate(m.first)}${m.now ? "" : ` to ${shortDate(m.last)}`}`, `${m.span} ${m.span === 1 ? "day" : "days"}`, ctxLabel(m.ctx) && `${ctxLabel(m.ctx)} context`].filter(Boolean).join(" · "))}</span></li>`).join("")}</ol></section>`;
    mk("history/", { title: "Free AI model tracker: how long free models last | Upcurrent", h1: "Free AI model tracker", eyebrow: "Free AI models · open data",
      lede: `${hist.length} different AI models have been free on OpenRouter and OpenCode since ${shortDate(firstDay)}. ${median ? `Half of the ones that ended lasted ${median} days or less.` : ""} Here is every one, with when it was free.`.replace(/\s+/g, " "),
      desc: `${hist.length} AI models have been free since ${shortDate(firstDay)}; ${median ? `half of those that ended lasted ${median} days or less` : "see how long each lasted"}. Full history, CC BY 4.0.`,
      body, qa, list: null, crumb: "Tracker" });
  }

  // Embeddable "free AI models right now" box: a standalone page other sites can put in an iframe.
  // The embed code also carries a plain link to the hub, which is what passes on search credit.
  {
    const top = free.slice(0, 8);
    const rows = top.map(f => `<li><a href="${esc(f.url || SITE + "free-ai-models/")}" target="_blank" rel="noopener">${esc(f.name)}</a><span>${esc([f.prov.replace(" Zen", ""), ctxLabel(f.ctx)].filter(Boolean).join(" · "))}</span></li>`).join("");
    CHART_FILES["embed/free-ai-models.html"] = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Free AI models right now (Upcurrent)</title><link rel="canonical" href="${SITE}free-ai-models/">
<style>:root{--bg:#fff;--ink:#141a26;--mut:#5b6476;--line:#e3e7ee;--acc:#2f6fde}@media (prefers-color-scheme:dark){:root{--bg:#121826;--ink:#eef1f6;--mut:#9aa3b5;--line:#253047;--acc:#7aa7ff}}*{box-sizing:border-box}body{margin:0;background:transparent;color:var(--ink);font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.w{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:14px 16px}h1{font-size:17px;margin:0 0 2px}p{margin:0 0 10px;color:var(--mut);font-size:13px}ol{list-style:none;margin:0;padding:0}li{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line)}li a{color:var(--ink);font-weight:600;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}li a:hover{color:var(--acc)}li span{color:var(--mut);font-size:13px;white-space:nowrap}.f{margin-top:10px;font-size:12.5px}.f a{color:var(--acc)}</style></head>
<body><div class="w"><h1>Free AI models right now</h1><p>${free.length} free on OpenRouter and OpenCode · updated ${esc(asOf(updated))}</p><ol>${rows}</ol><div class="f"><a href="${SITE}free-ai-models/" target="_blank" rel="noopener">See all ${free.length} free models on Upcurrent →</a></div></div></body></html>`;
    const code = `<iframe src="${SITE}embed/free-ai-models.html" title="Free AI models right now, by Upcurrent" width="100%" height="470" style="border:0;max-width:440px" loading="lazy"></iframe>\n<p><a href="${SITE}free-ai-models/">Free AI models list</a> by Upcurrent</p>`;
    mk("embed/", { title: "Embed a live free AI models list on your site", h1: "Embed a live free AI models list", eyebrow: "Free AI models · embed", crumb: "Embed",
      lede: "Add a box to your blog or docs that always shows today's free AI models. It updates every 30 minutes, it's free, and it needs no sign-up.",
      desc: "Copy one snippet to show a live, auto-updating list of free AI models on your own website. Free, no sign-up, works in light and dark mode.",
      body: `<section><h2>Preview</h2><iframe src="../../embed/free-ai-models.html" title="Free AI models right now, by Upcurrent" width="100%" height="470" style="border:0;max-width:440px" loading="lazy"></iframe></section>
<section><h2>Copy this code</h2><p>Paste it into any page that allows HTML (WordPress Custom HTML block, Ghost HTML card, Notion embeds, Webflow embed, plain HTML):</p><pre><code>${esc(code)}</code></pre><p>Please keep the line with the link under the box. It's how readers find the full list, and it's the only thing we ask in return.</p></section>
<section><h2>Details</h2><ul class="rows"><li><span class="t">Updates every 30 minutes</span><span class="m">From the same live data as the <a href="../">free AI models list</a></span></li><li><span class="t">Light and dark mode</span><span class="m">Follows your reader's system setting</span></li><li><span class="t">No tracking, no scripts</span><span class="m">The box is plain HTML and CSS</span></li><li><span class="t">Free to use</span><span class="m">The data is also available as JSON under CC BY 4.0 in <a href="../../data.html">Upcurrent's open data</a></span></li></ul></section>`,
      qa: [["Can I put a list of free AI models on my website?", "Yes. Copy the embed code on this page into any page that accepts HTML. The box shows today's free models and updates itself every 30 minutes."],
        ["Does the embed cost anything?", "No. It's free and needs no account. We only ask that you keep the link under the box."]], list: null });
  }
  return out;
}

// "New AI models" topic cluster: hub (this week), open source models, and a release tracker built from every
// trending Hugging Face model Upcurrent has recorded. Numbers are Upcurrent's own readings.
const MODEL_PAGES = [["", "This week"], ["open-source/", "Open source"], ["tracker/", "Release tracker"]];
const modelNav = (cur, up) => `<nav class="guides" aria-label="New AI models guides">${MODEL_PAGES.map(([p, n]) => p === cur ? `<b>${esc(n)}</b>` : `<a href="${up}new-ai-models/${p}">${esc(n)}</a>`).join("")}<a href="${up}what-is/">Explained</a></nav>`;
// Weekly "state of free AI" reports: one page per complete Monday-Sunday week, built from the daily
// snapshots, plus an index. Each has its own numbers, so no two pages say the same thing.
function reportPages(days, data, updated) {
  const out = {}, have = new Set(days);
  const monday = d => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
  const addDays = (d, n) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const today = days[days.length - 1];
  const weeks = [...new Set(days.map(monday))].filter(w => addDays(w, 6) < today).map(w => ({ w, days: [0, 1, 2, 3, 4, 5, 6].map(i => addDays(w, i)).filter(d => have.has(d)) })).filter(x => x.days.length >= 4);
  const key = f => f.prov + "|" + f.name, chat = d => (data[d].free || []).filter(isChat);
  const reports = weeks.map(({ w, days: wd }, idx) => {
    const prevDay = days.filter(d => d < wd[0]).pop();
    let prev = new Set((prevDay ? chat(prevDay) : chat(wd[0])).map(key)), cur;
    const went = new Map(), ended = new Map();
    for (const d of wd) { cur = new Map(chat(d).map(f => [key(f), f])); for (const [k2, f] of cur) if (!prev.has(k2)) went.set(k2, { ...f, day: d }); for (const k2 of prev) if (!cur.has(k2) && !went.has(k2)) ended.set(k2, { name: k2.split("|")[1], prov: k2.split("|")[0], day: d }); prev = new Set(cur.keys()); }
    for (const k2 of [...went.keys()]) if (ended.has(k2)) ended.delete(k2);
    const counts = wd.map(d => [d, chat(d).length]);
    const models = modelHistory(wd, data).filter(m => !m.at || m.at.slice(0, 10) >= addDays(w, -7)).sort((a, b) => b.dl - a.dl).slice(0, 5);
    const repoMap = new Map();
    for (const d of wd) for (const r of data[d].github || []) { const c = repoMap.get(r.repo) || { repo: r.repo, best: 0 }; c.best = Math.max(c.best, r.d24 || 0); repoMap.set(r.repo, c); }
    const repos = [...repoMap.values()].sort((a, b) => b.best - a.best).slice(0, 5);
    return { w, wd, went: [...went.values()], ended: [...ended.values()], counts, models, repos, start: counts[0][1], end: counts[counts.length - 1][1] };
  });
  const label = w => shortDate(w);
  reports.forEach((r, i) => {
    const slug = `reports/${r.w}`, url = `${SITE}${slug}/`, prevR = reports[i - 1], nextR = reports[i + 1];
    const delta = r.end - r.start;
    const lede = `In the week of ${label(r.w)}, ${r.went.length} AI model${r.went.length === 1 ? "" : "s"} went free and ${r.ended.length} stopped being free. The free list went from ${r.start} to ${r.end}${r.models[0] ? `, and the most downloaded new model was ${r.models[0].org}/${r.models[0].name}` : ""}.`;
    const ch = r.counts.length > 2 ? chart(`${slug}/free-ai-models-per-day.svg`, "free-ai-models-per-day.svg", { title: `Free AI models each day, week of ${label(r.w)}`, sub: "Free chat models on OpenRouter and OpenCode at the end of each day", rows: r.counts.map(([d, n]) => [new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }), n]) },
      `Bar chart of free AI models each day in the week of ${label(r.w)}: ${r.counts.map(([d, n]) => `${n} on ${shortDate(d)}`).join(", ")}.`, `End-of-day counts from Upcurrent's snapshots.`) : "";
    const li = (t, m) => `<li><span class="t">${t}</span><span class="m">${esc(m)}</span></li>`;
    const body = `<section><div class="eyebrow">Weekly report · ${esc(label(r.w))} to ${esc(shortDate(r.wd[r.wd.length - 1]))}</div><h1>x</h1><p class="lede">${esc(lede)}</p><p class="asof">Built from Upcurrent's daily snapshots. <a href="../">All weekly reports</a>.</p></section>
<section><h2>The week in numbers</h2><ul class="stats"><li><b class="num">${r.went.length}</b> went free</li><li><b class="num">${r.ended.length}</b> stopped being free</li><li><b class="num">${r.end}</b> free at the end of the week (${delta >= 0 ? "+" : ""}${delta})</li></ul>${ch}</section>
<section><h2>Went free this week</h2>${r.went.length ? `<ul class="rows">${r.went.map(f => li(f.url ? link(f.url, f.name) : esc(f.name), `${f.prov} · ${shortDate(f.day)}${f.ctx ? " · " + ctxLabel(f.ctx) + " context" : ""}`)).join("")}</ul>` : "<p>No new free models this week.</p>"}</section>
<section><h2>Stopped being free this week</h2>${r.ended.length ? `<ul class="rows">${r.ended.map(f => li(esc(f.name), `${f.prov} · gone by ${shortDate(f.day)}`)).join("")}</ul>` : "<p>None ended this week.</p>"}</section>
${r.models.length ? `<section><h2>Most downloaded new AI models</h2><ol class="rows">${r.models.map(m => li(link(hfUrl(m), `${m.org}/${m.name}`), `${fmt(m.dl)} downloads on Hugging Face`)).join("")}</ol></section>` : ""}
${r.repos.length ? `<section><h2>Fastest-rising AI repos on GitHub</h2><ol class="rows">${r.repos.map(x => li(link("https://github.com/" + x.repo, x.repo), `+${fmt(x.best)} stars on its best day`)).join("")}</ol></section>` : ""}
<section><h2>Other weeks</h2><p>${prevR ? `<a href="../${prevR.w}/">← Week of ${esc(label(prevR.w))}</a>` : ""}${prevR && nextR ? " · " : ""}${nextR ? `<a href="../${nextR.w}/">Week of ${esc(label(nextR.w))} →</a>` : ""}${!prevR && !nextR ? "This is the first report." : ""}</p><p>Want this every week? The <a href="../../email.html">free morning email</a> has the daily version, and <a href="../../free-ai-models/#alerts">free model alerts</a> tell you the day a model goes free.</p></section>
<section class="share" aria-label="Share this page"><b>Share:</b> ${shareLinks(url, `State of free AI, week of ${label(r.w)}`)}</section>`;
    out[slug] = page({ title: `State of free AI: week of ${label(r.w)} | Upcurrent`, description: clip(lede, 160), canonical: url, body, up: "../../",
      ld: [{ "@context": "https://schema.org", "@type": "Article", headline: `State of free AI: week of ${label(r.w)}`, datePublished: r.wd[r.wd.length - 1], dateModified: updated, author: { "@type": "Organization", name: "Upcurrent", url: SITE }, publisher: { "@type": "Organization", name: "Upcurrent", url: SITE } }, breadcrumb([["Upcurrent", SITE], ["Weekly reports", SITE + "reports/"], [`Week of ${label(r.w)}`, url]])] });
  });
  if (reports.length) {
    const L = reports[reports.length - 1];
    out["reports"] = page({ title: "State of free AI: weekly reports | Upcurrent", description: clip(`A weekly report on free AI models: which went free, which ended, and the new models and repos that rose. Latest: week of ${label(L.w)}.`, 160), canonical: `${SITE}reports/`, up: "../",
      body: `<section><div class="eyebrow">Weekly reports</div><h1>x</h1><p class="lede">Every Monday-to-Sunday week since ${esc(label(reports[0].w))}: which AI models went free, which stopped, and the new models and GitHub repos that rose fastest. Built automatically from Upcurrent's daily data.</p></section>
<section><h2>All weeks</h2><ul class="rows">${[...reports].reverse().map(r => `<li><span class="t"><a href="${r.w}/">Week of ${esc(label(r.w))}</a></span><span class="m">${esc(`${r.went.length} went free · ${r.ended.length} ended · ${r.end} free at the end`)}</span></li>`).join("")}</ul></section>`,
      ld: [breadcrumb([["Upcurrent", SITE], ["Weekly reports", SITE + "reports/"]])] });
  }
  return out;
}
function modelHistory(days, data) {
  const seen = new Map();
  days.forEach(day => (data[day].models || []).forEach(m => {
    const k = m.org + "/" + m.name, cur = seen.get(k) || { ...m, first: day, days: 0, dl: 0 };
    cur.days++; cur.last = day; cur.dl = Math.max(cur.dl || 0, m.dl || 0); cur.likes = Math.max(cur.likes || 0, m.likes || 0);
    cur.at = m.at || cur.at; cur.lic = m.lic || cur.lic; cur.cat = m.cat || cur.cat; seen.set(k, cur);
  }));
  return [...seen.values()];
}
const hfUrl = m => `https://huggingface.co/${m.org}/${m.name}`;
const modelRow = (m, extra) => {
  const slug = EXPLAIN.get(hfUrl(m));
  return `<li><span class="t">${link(hfUrl(m), `${m.org}/${m.name}`)}${slug ? ` <a class="wi" href="/what-is/${slug}/">What is it?</a>` : ""}</span><span class="m">${esc([m.at && `released ${shortDate(m.at.slice(0, 10))}`, m.cat, m.lic, `${fmt(m.dl)} downloads`, m.likes ? `${fmt(m.likes)} likes` : null, extra].filter(Boolean).join(" · "))}</span></li>`;
};
// Big model launches (GPT, Gemini, Claude...) from official lab blog posts, plus Techmeme launch headlines
// when no lab post covers the same model. Lab posts come from the daily archive and the latest fetch.
const BIG_MODEL = /\b(GPT|Gemini|Claude|Llama|Grok|Qwen|DeepSeek|Mistral|Kimi|Nemotron|Genie|Gemma|Sora|Veo|Phi)(?:[- ][A-Z][a-z]+)?[- ]?\d[\w.]*/;
function bigReleases(days, data) {
  const found = new Map(), seen = new Set();
  const take = (h, day, labPost) => {
    const t = h.t || "", m = t.match(BIG_MODEL);
    if (!m || !h.url) return;
    const lab = labPost && /^(introducing|announcing)\b|\bis now available\b|\blaunch/i.test(t);
    const news = !labPost && /Techmeme/.test(h.src || "") && /\b(releases|launches|rolls out|unveils|debuts|introduces)\b/i.test(t) && !/\b(sources?|reportedly|report)\b/i.test(t);
    if (!lab && !news) return;
    const key = m[0].replace(/[- ]/g, " ").toLowerCase() + "|" + day;
    if (!found.has(h.url)) found.set(h.url, { t, url: h.url, src: h.src, day, lab, key });
  };
  days.forEach(day => (data[day].headlines || []).forEach(h => take(h, day, h.kind === "Lab blog")));
  try { (JSON.parse(fs.readFileSync(path.join(ROOT, "data", "latest.json"), "utf8")).raw.blogs || []).forEach(b => { const d = (b.at || "").slice(0, 10); if (d >= days[0]) take(b, d, true); }); } catch {}
  const all = [...found.values()], labKeys = new Set(all.filter(x => x.lab).map(x => x.key.split("|")[0]));
  return all.filter(x => x.lab || !labKeys.has(x.key.split("|")[0])).filter(x => !seen.has(x.url) && seen.add(x.url)).sort((a, b) => b.day.localeCompare(a.day));
}
function modelCluster(days, data, last, updated) {
  const out = {}, recent = days.slice(-7), firstDay = days[0], hist = modelHistory(days, data);
  const week = modelHistory(recent, data).sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));
  const asof = `<p class="asof">Last checked ${esc(asOf(updated))}. Upcurrent reads Hugging Face's trending models every 30 minutes.</p>`;
  const mk = (sub, { title, h1, eyebrow, lede, desc, body, qa, list, crumb }) => {
    const url = `${SITE}new-ai-models/${sub}`, up = sub ? "../../" : "../";
    const html = `<section><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(h1)}</h1><p class="lede">${esc(lede)}</p>${modelNav(sub, up)}${asof}</section>
${body}
${faqHtml(qa)}
<section class="share" aria-label="Share this page"><b>Share:</b> ${shareLinks(url, h1)}</section>`;
    const ld = [...(list ? [{ "@context": "https://schema.org", "@type": "ItemList", name: h1, url, numberOfItems: list.length, itemListElement: list.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: `${m.org}/${m.name}`, url: hfUrl(m) })) }] : []),
      faq(qa), breadcrumb([["Upcurrent", SITE], ["New AI models", SITE + "new-ai-models/"], ...(sub ? [[crumb, url]] : [])])];
    out["new-ai-models" + (sub ? "/" + sub.replace(/\/$/, "") : "")] = page({ title, description: clip(desc, 160), canonical: url, body: html, ld, up, ogType: sub ? "article" : "website" });
  };

  {
    const open = week.filter(m => /^open source/i.test(m.lic || "")).length;
    const top = [...week].sort((a, b) => b.dl - a.dl)[0];
    const qa = [
      ["What new AI models came out this week?", week.length ? `New models trending on Hugging Face this week include ${week.slice(0, 5).map(m => `${m.org}/${m.name}`).join(", ")}.${top ? ` The most downloaded so far is ${top.org}/${top.name} with ${fmt(top.dl)} downloads.` : ""}` : "See the list on this page."],
      ["Where can I find new AI models?", "Hugging Face hosts most new open models. Upcurrent reads its trending list every 30 minutes and keeps only recent releases, so new models aren't buried under old favourites."],
      ["Can I download these models for free?", `Yes. Every model listed is downloadable from Hugging Face. ${open} of this week's ${week.length} are open source; the rest are open weights, which can carry use limits, so check each licence.`],
      ["How are models picked?", "A model appears when it is trending on Hugging Face and was released recently. The list keeps each model's highest recorded download count."]
    ];
    const big = bigReleases(days.slice(-14), data);
    const bigHtml = big.length ? `<section id="big"><h2>Big model releases in the last 14 days</h2><p>Launches from the big AI labs, from their own blog posts${big.some(b => !b.lab) ? " and Techmeme" : ""}. Most of these are used through an app or API rather than downloaded.</p><ul class="rows">${big.map(b => `<li><span class="t">${link(b.url, b.t)}</span><span class="m">${esc(`${b.src} · ${shortDate(b.day)}`)}</span></li>`).join("")}</ul></section>
` : "";
    if (big.length) qa.unshift(["What are the latest big AI model releases?", `In the last 14 days: ${big.slice(0, 4).map(b => `${b.t.replace(/^(Introducing|Announcing) /i, "").replace(/ is now available$/i, "")} (${b.src}, ${shortDate(b.day)})`).join("; ")}.`]);
    let hfT = []; try { hfT = (JSON.parse(fs.readFileSync(path.join(ROOT, "data", "latest.json"), "utf8")).raw.hfModels || []).filter(m => m.id).slice(0, 10); } catch {}
    if (hfT.length) qa.splice(1, 0, ["What are the trending models on Hugging Face right now?", `Hugging Face's trending list is led by ${hfT.slice(0, 3).map(m => m.id).join(", ")}. It counts all models, old and new, by recent likes and downloads.`]);
    const hfHtml = hfT.length ? `<section id="hf-trending"><h2>Hugging Face trending models right now</h2><p>The top of <a href="https://huggingface.co/models?sort=trending" rel="noopener">Hugging Face's trending list</a>, which includes older models that are popular again. The list below it only keeps new releases.</p><ol class="rows">${hfT.map(m => `<li><span class="t">${link("https://huggingface.co/" + m.id, m.id)}</span><span class="m">${m.task ? esc(m.task.replace(/-/g, " ")) + " · " : ""}<span class="num">${fmt(m.downloads)}</span> downloads · ♥ ${fmt(m.likes)}</span></li>`).join("")}</ol></section>` : "";
    const body = bigHtml + hfHtml + `<section id="list"><h2>${week.length} new open AI models, newest first</h2><ol class="rows">${week.map(m => modelRow(m)).join("")}</ol></section>
${(() => {
  const byOrg = Object.entries(week.reduce((a, m) => (a[m.org] = (a[m.org] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const quant = week.filter(m => /gguf|awq|fp8|int4|mlx/i.test(m.name)).length;
  const topDl = [...week].filter(m => m.dl > 0).sort((a, b) => b.dl - a.dl).slice(0, 8);
  const dlChart = topDl.length > 2 ? chart("new-ai-models/new-ai-models-most-downloaded-this-week.svg", "new-ai-models-most-downloaded-this-week.svg",
    { title: "Most downloaded new AI models this week", sub: `Hugging Face downloads, models released in the last 7 days`, rows: topDl.map(m => [`${m.org}/${m.name}`, m.dl]), horizontal: true, w: 600 },
    `Horizontal bar chart of the most downloaded new AI models this week on Hugging Face: ${topDl.map(m => `${m.org}/${m.name} with ${fmt(m.dl)} downloads`).join(", ")}.`,
    `Downloads since release, from Hugging Face. ${esc(asOf(updated))}.`) : "";
  return `<section id="take"><h2>What stands out this week</h2>${dlChart}<ul class="rows">${top ? `<li><span class="t">Most downloaded new model: ${link(hfUrl(top), top.org + "/" + top.name)}</span><span class="m">${fmt(top.dl)} downloads, released ${esc(shortDate((top.at || "").slice(0, 10) || recent[0]))}</span></li>` : ""}${byOrg.length && byOrg[0][1] > 1 ? `<li><span class="t">Busiest publishers: ${esc(byOrg.map(([o, n]) => `${o} (${n})`).join(", "))}</span><span class="m">Models on this week's list, by Hugging Face account</span></li>` : ""}<li><span class="t">${quant} of ${week.length} are compressed versions (GGUF, AWQ, FP8, MLX)</span><span class="m">Smaller copies of bigger models, made to run on ordinary computers with tools like Ollama or LM Studio</span></li></ul></section>`;
})()}
<section id="names"><h2>How to read AI model names</h2><ul class="rows">
<li><span class="t">Version numbers (Gemini 4, GPT-6.2)</span><span class="m">A bigger first number is a new generation; the decimal is an update to it</span></li>
<li><span class="t">Size words: Flash, Lite, Mini, Nano, Small</span><span class="m">Smaller, faster and cheaper versions of the same family</span></li>
<li><span class="t">Pro, Ultra, Max, Large</span><span class="m">The bigger, slower, more capable versions</span></li>
<li><span class="t">Numbers with B (27B, 120B)</span><span class="m">Billions of parameters, a rough measure of size. "A12B" means only 12 billion are active per word, which makes big models cheaper to run</span></li>
<li><span class="t">GGUF, AWQ, FP8, MLX</span><span class="m">Compressed formats for running a model on your own machine; GGUF works with Ollama and LM Studio, MLX with Apple Silicon Macs</span></li>
<li><span class="t">Thinking, Reasoning, R1</span><span class="m">Reasoning models that work through a problem step by step before answering: slower, but better at maths and code</span></li>
<li><span class="t">VL, Omni, Vision</span><span class="m">Multimodal models that take images, and sometimes audio or video, as well as text</span></li>
<li><span class="t">Instruct, Chat, Base</span><span class="m">Instruct and Chat versions are tuned to follow requests; Base versions are raw and meant for further training</span></li></ul></section>
<section id="method"><h2>How this list is ranked</h2><p>Upcurrent ranks new models by real Hugging Face downloads and likes since release, not by benchmark scores. A model can top a benchmark leaderboard and still be little used, or the other way round. For benchmark accuracy comparisons, see <a href="https://artificialanalysis.ai/" rel="nofollow noopener">Artificial Analysis</a>. <a href="../about/">Full method</a>.</p></section>
<section><h2>More on new models</h2><ul class="rows">
<li><span class="t"><a href="open-source/">New open source AI models</a></span><span class="m">Only models you can freely use and change, with what "open source" and "open weights" mean</span></li>
<li><span class="t"><a href="tracker/">AI model release tracker</a></span><span class="m">All ${hist.length} new models Upcurrent has seen trending since ${shortDate(firstDay)}</span></li>
<li><span class="t"><a href="../what-is/">New AI projects explained</a></span><span class="m">A plain explanation of every model and repo that reached the top 5</span></li>
<li><span class="t"><a href="../free-ai-models/">Free AI models to use right now</a></span><span class="m">Models you can call for free, no download needed</span></li></ul></section>`;
    mk("", { title: `New AI models this week: ${week.length} trending releases | Upcurrent`, h1: "New AI models this week", eyebrow: "New AI models · updated every 30 minutes",
      lede: `The big model launches from AI labs, Hugging Face trending models right now, and ${week.length} recently released open models that trended on Hugging Face over the last ${recent.length} days. Newest first, with real download counts.`,
      desc: `New AI models this week: big launches from OpenAI, Google and other labs, plus ${week.length} new open models trending on Hugging Face. Updated every 30 minutes.`, body, qa, list: week });
  }
  {
    const os = [...hist].filter(m => /^open (source|weights)/i.test(m.lic || "")).sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0)).slice(0, 40);
    const n = os.filter(m => /^open source/i.test(m.lic)).length;
    const qa = [
      ["What are the newest open source AI models?", `The most recent open models Upcurrent has seen trending are ${os.slice(0, 5).map(m => `${m.org}/${m.name}`).join(", ")}.`],
      ["What is the difference between open source and open weights?", "Open source models use a licence such as Apache 2.0 or MIT that lets you use, change and share them freely, including commercially. Open weights models let you download and run the model, but their licence can limit use, for example by company size or purpose."],
      ["How do I run an open source model?", "Download it from Hugging Face and run it with a tool such as Ollama, LM Studio or llama.cpp. Smaller and quantised versions (often marked GGUF) run on a normal laptop."]
    ];
    const body = `<section id="list"><h2>${os.length} newest open models</h2><p>${n} are open source and ${os.length - n} open weights, as labelled on Hugging Face.</p><ol class="rows">${os.map(m => modelRow(m)).join("")}</ol></section>`;
    mk("open-source/", { title: "New open source AI models: latest releases | Upcurrent", h1: "New open source AI models", eyebrow: "New AI models · open source",
      lede: `The ${os.length} newest open AI models that trended on Hugging Face, with their licence, downloads and category. ${n} are fully open source.`,
      desc: `The newest open source and open weights AI models trending on Hugging Face, with licence, downloads and how to run them. Updated every 30 minutes.`, body, qa, list: os, crumb: "Open source" });
  }
  {
    const sorted = [...hist].sort((a, b) => Date.parse(b.at || b.first) - Date.parse(a.at || a.first));
    const cats = Object.entries(hist.reduce((a, m) => (a[m.cat || "Other"] = (a[m.cat || "Other"] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]);
    const longest = [...hist].sort((a, b) => b.days - a.days)[0], biggest = [...hist].sort((a, b) => b.dl - a.dl)[0];
    const qa = [
      ["How many new AI models trend each month?", `Since ${shortDate(firstDay)}, Upcurrent has recorded ${hist.length} newly released models trending on Hugging Face.`],
      ["What kind of AI models are being released most?", `${cats.slice(0, 3).map(([c, n]) => `${c} (${n})`).join(", ")} lead the count of new trending models since ${shortDate(firstDay)}.`],
      ["Can I use this data?", "Yes. It is part of Upcurrent's open data, licensed CC BY 4.0. Please link to this page if you cite it."]
    ];
    const body = `<section><h2>Key numbers</h2><ul class="stats"><li><b class="num">${hist.length}</b> new models trending since ${esc(shortDate(firstDay))}</li>${cats.slice(0, 4).map(([c, n]) => `<li><b class="num">${n}</b> ${esc(c)}</li>`).join("")}${biggest ? `<li>Most downloaded: <b>${esc(biggest.org + "/" + biggest.name)}</b> (${fmt(biggest.dl)})</li>` : ""}${longest ? `<li>Trended longest: <b>${esc(longest.org + "/" + longest.name)}</b> (${longest.days} days)</li>` : ""}</ul>
<p>From end-of-day snapshots of Hugging Face's trending list. Cite as: Upcurrent AI model release tracker, ${esc(SITE)}new-ai-models/tracker/ (CC BY 4.0).</p></section>
<section id="list"><h2>Every new model, newest release first</h2><ol class="rows">${sorted.map(m => modelRow(m, `trended ${m.days} ${m.days === 1 ? "day" : "days"}`)).join("")}</ol></section>`;
    mk("tracker/", { title: "AI model release tracker: every new open model | Upcurrent", h1: "AI model release tracker", eyebrow: "New AI models · open data",
      lede: `${hist.length} newly released AI models have trended on Hugging Face since ${shortDate(firstDay)}. Here is every one, with its release date, peak downloads and how long it stayed trending.`,
      desc: `Every new AI model that trended on Hugging Face since ${shortDate(firstDay)} (${hist.length}), with release date, downloads, licence and days trending. CC BY 4.0.`, body, qa, list: sorted, crumb: "Release tracker" });
  }
  return out;
}

// Crawler helpers written at the site root: robots.txt (now that the site owns its domain), an RSS feed of the
// daily pages, llms.txt for AI crawlers, and the email preview filled in so its text is in the HTML.
function crawlerFiles(days, data, guides, latest) {
  fs.writeFileSync(path.join(ROOT, "robots.txt"), `# Upcurrent: every page is open to search engines and AI crawlers.
User-agent: *
Allow: /
Disallow: /scripts/

Sitemap: ${SITE}sitemap.xml
`);
  const xmlEsc = s => esc(s).replace(/&#39;/g, "&apos;");
  const items = [...days].reverse().slice(0, 30).map(day => {
    const d = data[day], top = (d.rising || [])[0], gh = (d.github || [])[0];
    const desc = [top && `Top mover: ${top.owner ? top.owner + "/" : ""}${top.name}.`, gh && `Top repo gained ${fmt(gh.d24)} stars (${gh.repo}).`].filter(Boolean).join(" ");
    const u = `${SITE}daily/${day}.html`;
    return `<item><title>${xmlEsc(`What was rising in AI on ${shortDate(day)}`)}</title><link>${u}</link><guid isPermaLink="true">${u}</guid><pubDate>${new Date(d.about?.updated || day).toUTCString()}</pubDate><description>${xmlEsc(desc)}</description></item>`;
  });
  fs.writeFileSync(path.join(ROOT, "feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Upcurrent: daily AI trends</title><link>${SITE}</link><description>The AI repos, models, papers and stories picking up speed, one page a day.</description><language>en</language>
<atom:link href="${SITE}feed.xml" rel="self" type="application/rss+xml"/><lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>
${items.join("\n")}
</channel></rss>
`);
  fs.writeFileSync(path.join(ROOT, "llms.txt"), `# Upcurrent

> A free dashboard of what is rising in AI, refreshed every 30 minutes from GitHub, Hugging Face, arXiv, Hacker News, AI lab blogs, news sites and model providers. Data is CC BY 4.0: credit "Data from Upcurrent (${SITE})".

## Pages
- [Live dashboard](${SITE}): today's fastest-rising AI repos, models, papers, threads and headlines
${GUIDES.filter(g => guides[g.slug]).map(g => `- [${g.title}](${SITE}${g.slug}/)`).join("\n")}
- [Free GitHub trending API (JSON, no key)](${SITE}github-trending-api/)
- [GitHub trending archive: every day's top AI repo](${SITE}github-trending-archive/)
- [Trending AI research papers today (Hugging Face, arXiv)](${SITE}trending-ai-papers/)
- [Trending AI agent repos on GitHub](${SITE}trending-ai-github-repos/agents/)
- [Upcurrent FAQ: is it free, where the data comes from, what the email is](${SITE}faq/)
- [Best new MCP servers and Claude Code skills on GitHub](${SITE}mcp-servers-claude-code-skills/)
- [Free AI models for coding](${SITE}free-ai-models/coding/)
- [Free AI model API: rate limits and model IDs](${SITE}free-ai-models/api/)
- [How to get a free LLM API key, step by step](${SITE}free-ai-models/free-llm-api-key/)
- [Free LLM APIs with no credit card](${SITE}free-ai-models/no-credit-card/)
- [Gemini API free tier](${SITE}free-ai-models/gemini/)
- [Groq free API](${SITE}free-ai-models/groq/)
- [Cloudflare Workers AI free tier](${SITE}free-ai-models/cloudflare/)
- [Free OpenAI-compatible APIs](${SITE}free-ai-models/openai-compatible/)
- [Free image and speech APIs](${SITE}free-ai-models/image-and-speech/)
- [Free AI coding tools](${SITE}free-ai-models/coding-tools/)
- [Free AI API for students](${SITE}free-ai-models/for-students/)
- [Free LLM API for LangChain](${SITE}free-ai-models/langchain/)
- [Free AI models in n8n](${SITE}free-ai-models/n8n/)
- [Free LLM API for Claude Code](${SITE}free-ai-models/claude-code/)
- [Free API for Janitor AI](${SITE}free-ai-models/janitor-ai/)
- [Free LLM API with no limit](${SITE}free-ai-models/no-limit/)
- [Embed a live free AI models list](${SITE}free-ai-models/embed/)
- [State of free AI: weekly reports](${SITE}reports/)
- [Free LLM API calculator](${SITE}free-ai-models/calculator/): which free API tiers cover a given number of requests a day
- [OpenRouter vs Gemini free tiers](${SITE}free-ai-models/openrouter-vs-gemini/)
- [OpenRouter vs Groq free tiers](${SITE}free-ai-models/openrouter-vs-groq/)
- [Groq vs Gemini free tiers](${SITE}free-ai-models/groq-vs-gemini/)
- [OpenRouter free models list](${SITE}free-ai-models/openrouter/)
- [OpenCode free models](${SITE}free-ai-models/opencode/)
- [New open source AI models](${SITE}new-ai-models/open-source/)
- [AI model release tracker: every new model trending since October 2026](${SITE}new-ai-models/tracker/)
- [Free AI model tracker: every model seen free and how long it lasted](${SITE}free-ai-models/history/)
- [New AI projects explained](${SITE}what-is/): one page per AI repo, model or paper that reached the top ${EXPLAIN_TOP} rising
- [Daily archive](${SITE}daily/): one page per day since ${shortDate(days[0])}
- [Today's email](${SITE}email.html): the morning digest

## Data
- [today.json](${SITE}data/api/today.json): everything on the dashboard right now
- [history.json](${SITE}data/api/history.json): tracked items, breakouts and free model changes over time
- [Open data docs](${SITE}data.html)
`);
  // Email preview: same Markdown subset as email.html's script, rendered here so the words are in the page.
  try {
    const md = fs.readFileSync(path.join(ROOT, "data", "digest.md"), "utf8");
    const inl = t => { const links = []; t = t.replace(/\[((?:\\.|[^\]])*)\]\((https?:\/\/[^)\s]+)\)/g, (m, a, u) => { links.push([a, u]); return `\u0000${links.length - 1}\u0000`; });
      t = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); t = t.replace(/\u0000(\d+)\u0000/g, (m, i) => `<a href="${esc(links[i][1])}" target="_blank" rel="noopener">${inl(links[i][0])}</a>`); return t.replace(/\\([\\`*_[\]<>])/g, "$1"); };
    const lines = md.split("\n"), out = []; let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const line of lines.slice(1)) { let m;
      if (!line.trim()) { close(); continue; }
      if ((m = line.match(/^## (.*)/))) { close(); out.push(`<h2>${inl(m[1])}</h2>`); }
      else if ((m = line.match(/^\d+\. (.*)/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inl(m[1])}</li>`); }
      else if ((m = line.match(/^- (.*)/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inl(m[1])}</li>`); }
      else { close(); out.push(`<p>${inl(line)}</p>`); } }
    close();
    const file = path.join(ROOT, "email.html"), html = fs.readFileSync(file, "utf8");
    const subj = esc((lines[0] || "").replace(/^# /, "").replace(/\\(.)/g, "$1"));
    const filled = html.replace('<span class="subj" id="subj">Loading…</span>', () => `<span class="subj" id="subj">${subj}</span>`)
      .replace('<div class="mail-body" id="mail"><p class="loading">Loading the latest email…</p></div>', () => `<div class="mail-body" id="mail">${out.join("")}</div>`);
    if (filled !== html) { fs.writeFileSync(file, filled); console.log("Filled email.html with today's email"); }
  } catch (e) { console.error("Skipped filling email.html:", e.message); }
}

// Copies the dashboard's rendered sections into index.html so the first byte already holds today's content.
// The page's script re-renders the same places from data/latest.json as soon as it loads.
const PRERENDER_IDS = ["ticker", "qaList", "demoTabs", "demoWin", "dateline", "headline", "brief", "pulse", "pills", "boList", "hypeList", "risingList", "rcList", "modelGrid", "ghBody", "disc", "newToday", "newsList", "freeSub", "freeBody"];
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
  // The dashboard was rendered before the explainer pages existed, so add their links for crawlers here.
  filled.risingList = filled.risingList.replace(/(<a href="([^"]+)" target="_blank" rel="noopener">[^<]*<\/a>)(<\/h3>)/g, (m, a, href, end) => {
    const slug = EXPLAIN.get(href.replace(/&amp;/g, "&"));
    return slug && !m.includes('class="wi"') ? `${a} <a class="wi" href="what-is/${slug}/">What is it?</a>${end}` : m;
  });
  if (!filled.headline.trim() || !filled.risingList.includes("<a")) throw new Error("the rendered page has no movers");
  if (!/Live · updated/.test(dumped)) throw new Error("the rendered page did not load live data");
  let out = src;
  for (const id of PRERENDER_IDS) {
    const re = new RegExp(`(<([a-zA-Z][\\w-]*)\\b[^>]*\\bid="${id}"[^>]*>)(</\\2>)`);
    if (!re.test(out)) throw new Error(`#${id} is not empty in index.html`);
    out = out.replace(re, (_, a, _t, b) => a + filled[id].replace(/\$/g, "$$$$") + b);
  }
  // The quick answers double as a FAQ for search engines, built from exactly what the page shows.
  const strip = h => h.replace(/<\/li>/g, "; ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").replace(/;\s*$/, "").trim();
  const qa = [...filled.qaList.matchAll(/<h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/div>/g)].map(m => [strip(m[1]), strip(m[2])]).filter(([q, a]) => q && a);
  if (qa.length) { const ld = ldJson(faq(qa)); out = out.replace("</head>", () => ld + "\n</head>"); }
  return out.replace("<html lang=\"en\">", "<html lang=\"en\" data-prerendered>");
}


// "What is X?" pages: one per project that reached the top 5 movers on any day. Built from the saved daily
// files only, so every number is one Upcurrent recorded. New pages appear on their own as new things rise.
const EXPLAIN_TOP = 5;
const EXPLAIN = new Map(); // item url -> slug, filled before the daily pages are built so they can link here
const KIND = { gh: ["an open-source AI project on GitHub", "GitHub project", "Code on GitHub"], hf: ["an AI model on Hugging Face", "Hugging Face model", "Model page on Hugging Face"], paper: ["an AI research paper", "Research paper", "Read the paper"] };
const slugify = s => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 70).replace(/-$/, "");
const itemLabel = r => r.src === "paper" ? r.name : `${r.owner ? r.owner + "/" : ""}${r.name}`;
const nOf = (meta, re) => { const m = (meta || []).find(x => re.test(x)); return m ? Number(m.replace(/[^\d]/g, "")) || null : null; };

function collectExplainers(days, data) {
  const items = new Map();
  days.forEach(day => {
    const d = data[day];
    (d.rising || []).forEach((r, i) => {
      if (!r.url || !KIND[r.src]) return;
      let it = items.get(r.url);
      if (!it && i >= EXPLAIN_TOP) return;
      if (!it) items.set(r.url, it = { url: r.url, src: r.src, name: r.name, owner: r.owner, cat: r.cat, desc: r.desc, at: r.at, hist: [], top: 0 });
      Object.assign(it, { cat: r.cat || it.cat, desc: r.desc || it.desc, at: r.at || it.at });
      if (i < EXPLAIN_TOP) it.top++;
      const g = r.src === "gh" ? (d.github || []).find(x => x.repo === `${r.owner}/${r.name}`) : null;
      const m = r.src === "hf" ? (d.models || []).find(x => `${x.org}/${x.name}` === `${r.owner}/${r.name}`) : null;
      if (m?.lic) it.lic = m.lic;
      it.hist.push({ day, rank: i + 1, score: r.score,
        stars: g?.stars ?? nOf(r.meta, /^★/), d24: g?.d24 ?? nOf(r.meta, /in 24h/), est: g ? g.est : (r.meta || []).some(x => /^~/.test(x)),
        dl: m?.dl ?? nOf(r.meta, /downloads/), likes: m?.likes ?? null, up: nOf(r.meta, /upvotes/) });
    });
  });
  const used = new Set();
  for (const it of items.values()) {
    let s = slugify(it.src === "paper" ? it.name : `${it.owner}-${it.name}`) || "item", base = s, n = 2;
    while (used.has(s)) s = `${base}-${n++}`;
    used.add(s); it.slug = s; EXPLAIN.set(it.url, s);
  }
  return [...items.values()];
}

function numbersLine(it, h) {
  if (it.src === "gh") return [h.stars != null && `★ ${fmt(h.stars)} stars`, h.d24 != null && `${h.est ? "~" : "+"}${fmt(h.d24)} in 24h`].filter(Boolean).join(", ");
  if (it.src === "hf") return [h.dl != null && `${fmt(h.dl)} downloads`, h.likes != null && `${fmt(h.likes)} likes`].filter(Boolean).join(", ");
  return h.up != null ? `${fmt(h.up)} upvotes` : "";
}

function explainerPage(it, all) {
  const url = `${SITE}what-is/${it.slug}/`;
  const [kindLong, kindShort, tryLabel] = KIND[it.src];
  const first = it.hist[0], last = it.hist[it.hist.length - 1];
  const best = Math.min(...it.hist.map(h => h.rank));
  const released = it.at ? shortDate(it.at.slice(0, 10)) : null;
  const label = itemLabel(it);
  const isHfDesc = it.src === "hf" || /^Model on Hugging Face/.test(it.desc || "");
  const what = it.src === "paper"
    ? `“${it.name}” is ${kindLong}${released ? `, published on ${released}` : ""}.`
    : `${it.name} is ${kindLong}${it.owner ? ` from ${it.owner}` : ""}${it.cat ? `, in the ${it.cat} category` : ""}.${it.lic ? ` Its licence is listed as ${it.lic.toLowerCase()}.` : ""}`;
  const summary = !isHfDesc && it.desc ? it.desc : "";
  let growth = "";
  if (it.hist.length > 1) {
    if (it.src === "gh" && first.stars != null && last.stars != null && last.stars > first.stars) growth = `Between ${shortDate(first.day)} and ${shortDate(last.day)} it went from ${fmt(first.stars)} to ${fmt(last.stars)} GitHub stars, a gain of ${fmt(last.stars - first.stars)}.`;
    else if (it.src === "hf" && first.dl != null && last.dl != null && last.dl > first.dl) growth = `Between ${shortDate(first.day)} and ${shortDate(last.day)} its recorded downloads went from ${fmt(first.dl)} to ${fmt(last.dl)}.`;
  }
  const latestNums = numbersLine(it, last);
  const seen = `Upcurrent first spotted it among the fastest-rising AI projects on ${shortDate(first.day)}. It has appeared on ${it.hist.length} daily list${it.hist.length > 1 ? "s" : ""} so far, peaking at #${best}.`;
  const title = it.src === "paper" ? `${clip(it.name, 52)}: paper explained | Upcurrent` : [`What is ${it.name}? ${kindShort}${it.owner ? ` by ${it.owner}` : ""} | Upcurrent`, ...(it.owner ? [`What is ${it.name}? By ${it.owner} | Upcurrent`] : []), `What is ${it.name.length <= 40 ? it.name : it.name.slice(0, 39) + "…"}? | Upcurrent`].find(t => t.length <= 66) || `What is ${it.name.slice(0, 39)}…? | Upcurrent`;
  const description = clip(`${what} ${summary ? summary + " " : ""}${latestNums ? `Latest: ${latestNums}.` : ""}`.replace(/\s+/g, " "), 160);
  const related = all.filter(o => o !== it && o.cat && o.cat === it.cat).sort((a, b) => b.hist[b.hist.length - 1].day.localeCompare(a.hist[a.hist.length - 1].day)).slice(0, 6);
  const qa = [
    [it.src === "paper" ? `What is the paper “${clip(it.name, 80)}” about?` : `What is ${it.name}?`, `${what}${summary ? " " + summary : ""}`],
    ...(it.owner && it.src !== "paper" ? [[`Who made ${it.name}?`, `${it.name} is published by ${it.owner} on ${it.src === "gh" ? "GitHub" : "Hugging Face"}.`]] : []),
    ...(latestNums ? [[`How popular is ${it.src === "paper" ? "this paper" : it.name}?`, `On ${shortDate(last.day)} Upcurrent recorded ${latestNums}. ${growth}`.trim()]] : []),
    ...(released && it.src !== "paper" ? [[`When was ${it.name} released?`, `${it.src === "gh" ? "The repository was created" : "The model was released"} on ${released}.`]] : [])
  ];
  const facts = [
    ["Type", kindShort], it.owner && it.src !== "paper" && ["Made by", it.owner], it.cat && ["Category", it.cat],
    released && [it.src === "gh" ? "Created" : it.src === "hf" ? "Released" : "Published", released],
    ["First spotted", `<a href="../../daily/${first.day}.html">${esc(shortDate(first.day))}</a>`, true],
    ["Best position", `#${best} of the day's top movers`], latestNums && ["Latest numbers", `${latestNums} (${shortDate(last.day)})`]
  ].filter(Boolean);
  const body = `<section>
  <div class="eyebrow">${esc(kindShort)}${it.cat ? " · " + esc(it.cat) : ""}</div>
  <h1>${it.src === "paper" ? esc(it.name) : `What is ${esc(it.name)}?`}</h1>
  <p class="lede">${esc(what)}</p>
  ${summary ? `<p>${it.src === "paper" ? "From the abstract" : "In its own words"}: “${esc(summary)}”</p>` : ""}
  <p>${esc(seen)} ${esc(growth)}</p>
  <p><a href="${esc(it.url)}" rel="noopener"><b>${esc(tryLabel)} →</b></a></p>
  <p>${it.src === "gh" ? `It sits alongside the other <a href="../../trending-ai-github-repos/">GitHub trending repositories today</a>.` : it.src === "hf" ? `It's one of the <a href="../../new-ai-models/">new AI models</a> Upcurrent tracks on Hugging Face${/gguf|awq|fp8|mlx/i.test(it.name) ? "" : `, alongside <a href="../../new-ai-models/open-source/">new open source releases</a>`}.` : `See what else was rising on <a href="../../daily/${last.day}.html">${esc(shortDate(last.day))}</a>, or browse <a href="../">every project explained</a>.`}</p>
</section>
<section><h2>Quick facts</h2><ul class="rows">${facts.map(([k, v, raw]) => `<li><span class="m">${esc(k)}</span><span class="t">${raw ? v : esc(v)}</span></li>`).join("")}</ul></section>
<section><h2>How it rose, day by day</h2><p>Recorded by Upcurrent at the end of each day (UTC). Rank is its place among that day's fastest-rising AI projects.</p>
<ol class="rows">${[...it.hist].reverse().map(h => `<li><span class="t"><a href="../../daily/${h.day}.html">${esc(shortDate(h.day))}</a> · #${h.rank}</span><span class="m num">${esc([numbersLine(it, h), `momentum ${h.score}`].filter(Boolean).join(" · "))}</span></li>`).join("")}</ol></section>
${related.length ? `<section><h2>Also rising in ${esc(it.cat)}</h2><ul class="rows">${related.map(o => `<li><span class="t"><a href="../${o.slug}/">${esc(itemLabel(o))}</a></span><span class="m">${esc(KIND[o.src][1])} · last on the list ${esc(shortDate(o.hist[o.hist.length - 1].day))}</span></li>`).join("")}</ul></section>` : ""}
${faqHtml(qa)}
<section class="share" aria-label="Share this page"><b>Share:</b> ${shareLinks(url, it.src === "paper" ? clip(it.name, 90) : `What is ${it.name}?`)}</section>
<nav class="pager"><a href="../">All explained projects</a><a href="../../daily/">Daily archive</a></nav>`;
  const thing = it.src === "gh" ? { "@type": "SoftwareSourceCode", name: it.name, codeRepository: it.url, author: { "@type": "Person", name: it.owner }, description: summary || what }
    : it.src === "hf" ? { "@type": "SoftwareApplication", name: it.name, applicationCategory: "AI model", url: it.url, author: { "@type": "Organization", name: it.owner } }
    : { "@type": "ScholarlyArticle", headline: clip(it.name, 110), url: it.url, abstract: summary || undefined };
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: clip(it.src === "paper" ? it.name : `What is ${it.name}?`, 110), description, url, mainEntityOfPage: url, about: thing,
      datePublished: `${first.day}T00:00:00Z`, dateModified: `${last.day}T23:59:59Z`, image: SITE + "og.png", inLanguage: "en",
      author: { "@type": "Organization", name: "Upcurrent", url: SITE }, publisher: { "@type": "Organization", name: "Upcurrent", url: SITE, logo: { "@type": "ImageObject", url: SITE + "icon-512.png" } } },
    faq(qa),
    breadcrumb([["Upcurrent", SITE], ["Explained", SITE + "what-is/"], [clip(label, 60), url]])
  ];
  return page({ title, description, canonical: url, body, ld, up: "../../" });
}

function explainerIndex(items) {
  const url = SITE + "what-is/";
  const sorted = [...items].sort((a, b) => b.hist[0].day.localeCompare(a.hist[0].day) || a.hist[0].rank - b.hist[0].rank);
  const body = `<section><div class="eyebrow">Explained</div><h1>New AI projects, explained</h1>
<p class="lede">Every AI repo, model and paper that reached Upcurrent's top ${EXPLAIN_TOP} fastest-rising list, with what it is, who made it and how fast it grew. A new page appears as soon as something new rises.</p></section>
<section><ol class="rows">${sorted.map(o => `<li><span class="t"><a href="${o.slug}/">${esc(itemLabel(o))}</a></span><span class="m">${esc([KIND[o.src][1], o.cat, `first spotted ${shortDate(o.hist[0].day)}`].filter(Boolean).join(" · "))}</span></li>`).join("")}</ol></section>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: "New AI projects, explained", url, hasPart: sorted.slice(0, 100).map(o => ({ "@type": "Article", headline: o.src === "paper" ? clip(o.name, 110) : `What is ${o.name}?`, url: `${url}${o.slug}/` })) },
    breadcrumb([["Upcurrent", SITE], ["Explained", url]])
  ];
  return page({ title: "New AI projects explained: what they are and how they grew", description: "Plain explanations of the newest AI repos, models and papers that are rising fast, with real growth numbers recorded by Upcurrent.", canonical: url, body, ld, ogType: "website" });
}


function aboutPage(days, data, nExplained) {
  const url = SITE + "about/";
  const qa = [
    ["What is Upcurrent?", "A free dashboard of what is rising in AI. Every 30 minutes it checks public sources and ranks the AI repos, models, papers and stories that are picking up speed, with links back to each original page."],
    ["Where does the data come from?", "GitHub, Hugging Face (models and daily papers), arXiv, Hacker News, Lobsters, DEV, Mastodon, Techmeme, AI lab blogs, news APIs (The Guardian, GNews, NewsAPI), YouTube, Product Hunt, OpenRouter and OpenCode Zen. Only official APIs and public feeds are used."],
    ["How is the momentum score worked out?", "Each item gets a 0 to 100 score. It is ranked against other items from the same source by attention per day (GitHub stars gained, Hugging Face trending score, paper upvotes), then gets a small boost if it is less than nine days old. Scores compare items within a day, so a 95 means near the top of that day, not a grade."],
    ["How often does it update?", "Every 30 minutes, around the clock. The morning email goes out at 7am in each reader's own time zone."],
    ["Are the numbers real?", "Yes. Every number is what the source reported when Upcurrent checked it. Nothing is estimated except where marked with ~ (GitHub stars gained in 24 hours, when a repo is too new for an exact count). Daily pages keep the numbers as they were recorded."],
    ["Can I use the data?", "Yes. The data is free under CC BY 4.0: credit Upcurrent with a link. See the open data page for the JSON files."]
  ];
  const body = `<section><div class="eyebrow">About</div><h1>About Upcurrent and how it works</h1>
<p class="lede">${esc(qa[0][1])}</p>
<ul class="stats"><li><b class="num">17</b> sources</li><li><b class="num">30</b> minutes between checks</li><li><b class="num">${days.length}</b> days recorded since ${esc(shortDate(days[0]))}</li><li><b class="num">${nExplained}</b> projects explained</li></ul></section>
${qa.slice(1).map(([q, a]) => `<section><h2>${esc(q)}</h2><p>${esc(a)}</p></section>`).join("")}
<section><h2>Who it's for</h2><p>Developers, founders, researchers and anyone curious who wants to know which AI tools and models are worth a look today, without reading twenty sites. It is built and run independently, with no paid placements in the rankings.</p></section>
<nav class="guides" aria-label="Explore">${[["", "Live dashboard"], ["daily/", "Daily archive"], ["what-is/", "Projects explained"], ["data.html", "Open data"], ...GUIDES.map(g => [g.slug + "/", g.short])].map(([h, n]) => `<a href="../${h}">${esc(n)}</a>`).join("")}</nav>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "AboutPage", name: "About Upcurrent", url, mainEntity: { "@type": "Organization", name: "Upcurrent", url: SITE, logo: SITE + "icon-512.png", description: qa[0][1] } },
    faq(qa), breadcrumb([["Upcurrent", SITE], ["About", url]])
  ];
  return page({ title: "About Upcurrent: how the AI trends dashboard works | Upcurrent", description: "How Upcurrent tracks what is rising in AI: 17 sources checked every 30 minutes, how the momentum score works, and where every number comes from.", canonical: url, body, ld, ogType: "website" });
}
(async () => {
  const args = process.argv.slice(2);
  const days = fs.readdirSync(DAILY_JSON).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => f.slice(0, 10)).sort();
  const data = Object.fromEntries(days.map(d => [d, JSON.parse(fs.readFileSync(path.join(DAILY_JSON, d + ".json"), "utf8"))]));
  const explained = collectExplainers(days, data);
  fs.mkdirSync(DAILY_OUT, { recursive: true });
  days.forEach((day, i) => fs.writeFileSync(path.join(DAILY_OUT, day + ".html"), dailyPage(day, data[day], days[i - 1], days[i + 1])));
  fs.writeFileSync(path.join(DAILY_OUT, "index.html"), archivePage(days, data));
  console.log(`Wrote ${days.length} daily pages and the archive`);
  const guides = days.length ? guidePages(days, data) : {};
  for (const [slug, html] of Object.entries(guides)) { fs.mkdirSync(path.join(ROOT, slug), { recursive: true }); fs.writeFileSync(path.join(ROOT, slug, "index.html"), html); }
  console.log(`Wrote ${Object.keys(guides).length} guide pages`);
  const EXPLAIN_OUT = path.join(ROOT, "what-is");
  fs.rmSync(EXPLAIN_OUT, { recursive: true, force: true });
  for (const it of explained) { fs.mkdirSync(path.join(EXPLAIN_OUT, it.slug), { recursive: true }); fs.writeFileSync(path.join(EXPLAIN_OUT, it.slug, "index.html"), explainerPage(it, explained)); }
  if (explained.length) fs.writeFileSync(path.join(EXPLAIN_OUT, "index.html"), explainerIndex(explained));
  fs.writeFileSync(path.join(EXPLAIN_OUT, "map.json"), JSON.stringify(Object.fromEntries(EXPLAIN)));
  for (const [file, svg] of Object.entries(CHART_FILES)) { fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true }); fs.writeFileSync(path.join(ROOT, file), svg); }
  fs.mkdirSync(path.join(ROOT, "about"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "about", "index.html"), aboutPage(days, data, explained.length));
  console.log(`Wrote ${explained.length} explainer pages`);

  const latest = days.length ? data[days[days.length - 1]].about?.updated : new Date().toISOString();
  const urls = [
    { loc: SITE, lastmod: latest, changefreq: "hourly", priority: "1.0" },
    { loc: SITE + "daily/", lastmod: latest, changefreq: "daily", priority: "0.8" },
    ...Object.keys(guides).map(slug => ({ loc: `${SITE}${slug}/`, lastmod: latest, changefreq: "hourly", priority: "0.9" })),
    { loc: SITE + "about/", lastmod: latest, changefreq: "monthly", priority: "0.5" },
    ...(explained.length ? [{ loc: SITE + "what-is/", lastmod: latest, changefreq: "daily", priority: "0.8" }] : []),
    ...explained.map(it => ({ loc: `${SITE}what-is/${it.slug}/`, lastmod: data[it.hist[it.hist.length - 1].day].about?.updated || latest, changefreq: "daily", priority: "0.7" })),
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
  crawlerFiles(days, data, guides, latest);
  console.log("Wrote robots.txt, feed.xml and llms.txt");

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
