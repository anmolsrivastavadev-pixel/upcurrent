// The "promote your AI project" cluster, built around the /promote/ money page (Featured spots).
//   Middle (choosing where to launch): /promote/launch-platforms/, /promote/show-hn/
//   Top (learning how growth works): /promote/github-stars/, /promote/github-trending/, /promote/buy-github-stars/
// Numbers come from Upcurrent's own daily files (data/api/daily) and history.json, so they grow with every day tracked.
// Platform rules were checked by hand against each platform's own pages on CHECKED; re-check monthly.
const fs = require("fs");
const path = require("path");
const CHECKED = "22 November 2026";

module.exports = function promoteCluster(days, data, h) {
  const { page, esc, link, faq, faqHtml, breadcrumb, clip, chart, fmt, SITE, ROOT } = h;
  const out = {};
  const P = `${SITE}promote/`;
  const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  let hist = {}; try { hist = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "api", "history.json"), "utf8")); } catch {}
  const since = days[0], last = days[days.length - 1];
  const longD = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  // --- GitHub: the daily AI repo lists ---
  const rows = days.map(d => [d, data[d].github || []]);
  const atRank = k => rows.map(([, g]) => g[k]?.d24).filter(n => n != null);
  const r1 = med(atRank(0)), r8 = med(atRank(7)), r3 = med(atRank(2));
  const repos = new Map();
  rows.forEach(([d, g]) => g.forEach((r, i) => { const c = repos.get(r.repo) || { repo: r.repo, days: 0, first: d, stars0: r.stars, best: 0, bestRank: 99, desc: r.desc }; c.days++; c.best = Math.max(c.best, r.d24 || 0); c.bestRank = Math.min(c.bestRank, i + 1); c.stars = r.stars; c.forks = r.forks; repos.set(r.repo, c); }));
  const R = [...repos.values()];
  const oneDay = R.filter(c => c.days === 1).length, medDays = med(R.map(c => c.days)), medStart = med(R.map(c => c.stars0)), under1k = R.filter(c => c.stars0 < 1000).length;
  const tracked = Object.values(hist.tracked || {}).filter(x => x.kind === "stars");
  const MS = {}; tracked.forEach(x => (x.hits || []).forEach(t => { (MS[t.m] = MS[t.m] || []).push((Date.parse(t.at) - Date.parse(x.first)) / 864e5); }));
  const msRows = Object.keys(MS).map(Number).sort((a, b) => a - b).map(m => [m, MS[m].length, med(MS[m])]);
  const big = R.filter(c => c.best > 0).sort((a, b) => b.best - a.best).slice(0, 8);
  const ghLink = r => link("https://github.com/" + r.repo, r.repo);
  const dataNote = `<p class="asof">From Upcurrent's daily lists of the fastest-rising AI repos on GitHub, ${longD(since)} to ${longD(last)} (${days.length} days). Some daily gains are estimates where GitHub's data was late.</p>`;
  const toMoney = up => `<section class="alertbox"><h2>Launched something? Get it seen</h2><p>Every new AI repo with 100+ stars is tracked by Upcurrent for free, and the fastest risers make the <a href="${up}trending-ai-github-repos/">trending list</a> on their own. Want a guaranteed, clearly labelled spot while you wait? See <a href="${up}promote/">promote your AI project</a>.</p></section>`;
  const NAV = [["github-stars", "Get more GitHub stars"], ["github-trending", "Get on GitHub trending"], ["buy-github-stars", "Buying stars?"], ["show-hn", "Show HN guide"], ["launch-platforms", "Where to launch"]];
  const nav = cur => `<nav class="guides" aria-label="Promotion guides">${NAV.map(([s, n]) => s === cur ? `<b>${esc(n)}</b>` : `<a href="../${s}/">${esc(n)}</a>`).join("")}</nav>`;
  const mk = (slug, { title, h1, lede, body, qa }) => {
    const url = `${P}${slug}/`;
    out[`promote/${slug}`] = page({ title, description: clip(lede, 160), canonical: url, up: "../../",
      body: `<section><div class="eyebrow">Promote your AI project</div><h1>${esc(h1)}</h1><p class="lede">${esc(lede)}</p>${nav(slug)}</section>\n${body}\n${toMoney("../../")}\n${faqHtml(qa)}`,
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["Promote your AI project", P], [h1, url]])] });
  };

  // 1. How to get more GitHub stars
  {
    const fig = msRows.length > 2 ? chart("promote/github-stars/days-to-github-star-milestones.svg", "days-to-github-star-milestones.svg",
      { title: "How fast rising AI repos hit star milestones", sub: `Median days after Upcurrent first spotted them · ${tracked.length} repos since ${longD(since)}`, rows: msRows.map(([m, n, d]) => [`${fmt(m)} stars (${n} repos)`, d, `${d.toFixed(1)} days`]), horizontal: true },
      `Bar chart: median days from first being spotted to star milestones. ${msRows.map(([m, n, d]) => `${fmt(m)} stars: ${d.toFixed(1)} days (${n} repos)`).join("; ")}.`,
      "Median days from when Upcurrent first spotted a rising AI repo to each star milestone.") : "";
    mk("github-stars", { title: `How to Get More GitHub Stars: Data From ${R.length} AI Repos`, h1: "How to get more GitHub stars",
      lede: `How AI repos really gain GitHub stars, from ${days.length} days of tracking the fastest risers: how many stars a day it takes to stand out, how fast stars snowball once a repo takes off, and the honest ways to get there.`,
      body: `<section id="numbers"><h2>What the numbers say</h2><ul class="stats"><li><b>${fmt(r1)}</b> stars in a day: median for the day's #1 rising AI repo</li><li><b>${fmt(r3)}</b> for #3</li><li><b>${fmt(r8)}</b> for #8</li><li><b>${fmt(medStart)}</b> median stars when a repo first made the list</li></ul>
<p>Only ${under1k} of the ${R.length} repos that made Upcurrent's daily AI list had fewer than 1,000 stars on their first day there. Repos rarely appear from nothing: by the time they trend, they already have a launch behind them. Most don't stay long either: the median repo stayed on the list for ${medDays} days, and ${oneDay} lasted a single day.</p>${dataNote}</section>
<section id="snowball"><h2>Stars snowball once a repo takes off</h2><p>Of the ${tracked.length} rising AI repos Upcurrent has tracked, ${msRows.map(([m, n, d]) => `${n} passed ${fmt(m)} stars (median ${d.toFixed(1)} days after first being spotted)`).join(", ")}. The first push is the hard part; after that, trending pages, newsletters and social shares do the work.</p>${fig}</section>
<section id="how"><h2>Ten honest ways to get more stars</h2><ol class="rows">
<li><span class="t">Solve one clear problem, and say it in the first line</span><span class="m">The description is what people see in lists like this one. The repos that topped Upcurrent's list say what they do in one plain sentence.</span></li>
<li><span class="t">Show it working before anything else</span><span class="m">A GIF, screenshot or 30-second video at the top of the README beats paragraphs of features.</span></li>
<li><span class="t">Make it run in one command</span><span class="m">Every extra setup step loses people who would have starred it.</span></li>
<li><span class="t">Launch where developers already look</span><span class="m">A <a href="../show-hn/">Show HN</a> post, relevant subreddits and <a href="../launch-platforms/">launch platforms</a>, all on the same day, so the stars arrive close together.</span></li>
<li><span class="t">Concentrate your launch into one day</span><span class="m">Trending lists reward stars gained in a short window, not your total.</span></li>
<li><span class="t">Add GitHub topics</span><span class="m">Topics like ai-agents or mcp-server put you on GitHub's topic pages and in filtered lists such as Upcurrent's <a href="../../mcp-servers-claude-code-skills/">MCP servers list</a>.</span></li>
<li><span class="t">Ride a current wave</span><span class="m">Build for what people are excited about this month. See <a href="../../trending-ai-github-repos/">what's trending now</a> and <a href="../../what-is/">new AI projects explained</a>.</span></li>
<li><span class="t">Ask for the star, once</span><span class="m">A single line in the README ("If this helped, a star helps others find it") is fine. Spamming people is not.</span></li>
<li><span class="t">Reply to every issue fast in launch week</span><span class="m">Early users who get help become the ones who share it.</span></li>
<li><span class="t">Never buy stars</span><span class="m">It breaks GitHub's rules and researchers have shown it stops helping within two months. <a href="../buy-github-stars/">Why buying GitHub stars backfires</a>.</span></li></ol></section>
<section id="top"><h2>The biggest single days on the list</h2><ul class="rows">${big.map(r => `<li><span class="t">${ghLink(r)}</span><span class="m">${fmt(r.best)} stars in a day · best rank #${r.bestRank} · ${r.days} day${r.days > 1 ? "s" : ""} on the list${r.desc ? " · " + esc(clip(r.desc, 110)) : ""}</span></li>`).join("")}</ul></section>
<section id="meaning"><h2>What GitHub stars mean</h2><p>GitHub's own docs describe a star as a bookmark: starring makes it easy to find a repository again and shows appreciation to the maintainer. GitHub also says many of its repository rankings depend on star counts, and Explore shows popular repositories by stars. That's why stars matter for being found, even though they say little about code quality. <span class="asof">(GitHub Docs, "Saving repositories with stars", checked ${CHECKED}.)</span></p></section>`,
      qa: [["How do I get more GitHub stars?", "Make the repo's purpose clear in one line, show a demo at the top of the README, make it run in one command, and launch it everywhere on the same day so stars arrive together."],
        ["How many stars do you need to trend on GitHub?", `On Upcurrent's daily list of rising AI repos, the #1 repo gained a median of ${fmt(r1)} stars in a day and the #8 repo ${fmt(r8)}. GitHub's own Trending page doesn't publish its formula.`],
        ["What do stars on GitHub mean?", "A star is a bookmark and a thank-you. GitHub uses star counts in many of its rankings, so stars help people discover a repo."],
        ["How long does it take to get 1,000 GitHub stars?", `For AI repos that took off, it was quick: the ${MS[1000]?.length || 0} tracked repos that passed 1,000 stars did it a median ${med(MS[1000] || [0])?.toFixed(1)} days after Upcurrent first spotted them. Most repos never get there.`],
        ["Can I buy GitHub stars?", "Sellers exist, but fake stars break GitHub's Acceptable Use Policies, which ban automated starring and secondary markets for inauthentic activity. Accounts and repos can be removed."]] });
  }

  // 2. How to get on GitHub trending
  {
    const minRows = rows.filter(([, g]) => g.length >= 8).map(([d, g]) => [d, g[0].d24, g[7].d24]);
    mk("github-trending", { title: "How to Get on GitHub Trending (With Real Star Counts)", h1: "How to get on GitHub trending",
      lede: `What it takes to get an AI repo onto GitHub's trending lists: the stars per day that made the cut over ${days.length} days, how long repos stay, and a launch-day plan built around that.`,
      body: `<section id="how-works"><h2>How GitHub Trending works</h2><p>GitHub's docs don't describe how its Trending page ranks repositories, so nobody outside GitHub knows the exact formula. What is visible: it lists repositories gaining stars fastest over a day, week or month, and you can filter by language.</p><p>Upcurrent runs its own version for AI only: every AI repo created in the last 30 days with 100+ stars, ranked by stars gained in the last 24 hours. Its numbers show what "fast" means in practice.</p></section>
<section id="cutoff"><h2>How many stars a day it takes</h2><ul class="stats"><li><b>${fmt(r1)}</b> median stars/day for #1</li><li><b>${fmt(r3)}</b> for #3</li><li><b>${fmt(r8)}</b> for #8</li></ul><p>On a typical day, a few hundred stars in 24 hours puts an AI repo near the top of Upcurrent's list, and the top spot usually takes over a thousand.</p><p>The 10 most recent days with a full top 8:</p><div class="tablewrap"><table><thead><tr><th>Day</th><th>#1 gained</th><th>#8 gained</th></tr></thead><tbody>${minRows.slice(-10).reverse().map(([d, a, b]) => `<tr><th scope="row"><a href="../../daily/${d}.html">${esc(longD(d))}</a></th><td class="num">${fmt(a)}</td><td class="num">${fmt(b)}</td></tr>`).join("")}</tbody></table></div>${dataNote}</section>
<section id="stay"><h2>How long repos stay trending</h2><p>The median repo stayed on the list for ${medDays} days; ${oneDay} of ${R.length} lasted one day. Trending is a burst, so plan what happens next: a follow-up release, a blog post, or a second launch on another platform a few days later.</p></section>
<section id="plan"><h2>A launch-day plan</h2><ol class="rows"><li><span class="t">Before: get the README ready</span><span class="m">One-line description, demo GIF, one-command install, topics added.</span></li><li><span class="t">Morning (US time): post a Show HN</span><span class="m">Follow the <a href="../show-hn/">Show HN rules</a>; it must be something people can try.</span></li><li><span class="t">Same day: share where your users are</span><span class="m">Relevant subreddits, X, Bluesky, Discord servers, and one <a href="../launch-platforms/">launch platform</a>.</span></li><li><span class="t">Stay around</span><span class="m">Answer comments and issues for the whole day. Momentum comes from people who try it and share it.</span></li><li><span class="t">Don't fake it</span><span class="m">Asking friends to upvote breaks Hacker News's rules, and bought stars break GitHub's. See <a href="../buy-github-stars/">why buying stars backfires</a>.</span></li></ol></section>
<section><h2>See who's trending now</h2><p>Today's list: <a href="../../trending-ai-github-repos/">GitHub trending AI repos</a>. Every day's #1 since ${longD(since)}: the <a href="../../github-trending-archive/">GitHub trending archive</a>. The data is free as JSON from the <a href="../../github-trending-api/">GitHub trending API</a>.</p></section>`,
      qa: [["How do you get on GitHub trending?", "Gain a lot of stars in a short time, usually by launching on Hacker News, Reddit and social media on the same day. GitHub ranks by recent star growth, not total stars."],
        ["How does the GitHub trending algorithm work?", "GitHub hasn't published it. Its Trending page shows repositories gaining stars fastest over a day, week or month, with filters by language."],
        ["How many stars do I need to trend?", `On Upcurrent's AI list, the #1 repo gained a median of ${fmt(r1)} stars in a day and #8 gained ${fmt(r8)}. GitHub's overall Trending page covers every language, so the bar there can differ.`],
        ["How long do repos stay on GitHub trending?", `On Upcurrent's AI list, a median of ${medDays} days.`]] });
  }

  // 3. Buying stars
  {
    mk("buy-github-stars", { title: "Should You Buy GitHub Stars? What the Rules and Research Say", h1: "Should you buy GitHub stars?",
      lede: "Short answer: no. Buying GitHub stars breaks GitHub's rules, and researchers who found millions of suspected fake stars showed they stop helping within two months. Here's the evidence, and what works instead.",
      body: `<section id="rules"><h2>What GitHub's rules say</h2><p>GitHub's Acceptable Use Policies ban "inauthentic interactions, such as fake accounts and automated inauthentic activity", "rank abuse, such as automated starring or following", and "creation of or participation in secondary markets for the purpose of the proliferation of inauthentic activity". Bought stars fall under all three. <span class="asof">(GitHub Acceptable Use Policies, section 4, checked ${CHECKED}.)</span></p></section>
<section id="research"><h2>What the research found</h2><p>A peer-reviewed study by Hao He and colleagues, <a href="https://arxiv.org/abs/2412.13459" rel="noopener">"Six Million (Suspected) Fake Stars in GitHub"</a> (ICSE 2026), built a tool called StarScout to scan GitHub from 2019 to 2024. They found:</p><ul class="rows"><li><span class="t">Fake-star activity surged in 2024</span></li><li><span class="t">Most fake stars promote short-lived phishing and malware repos</span><span class="m">The rest mostly promote AI/LLM, blockchain, tool and tutorial repos.</span></li><li><span class="t">Fake stars only help in the short term</span><span class="m">The promotion effect lasted less than two months and became a liability after that.</span></li></ul></section>
<section id="why-not"><h2>Why it backfires for an AI project</h2><p>The study names AI/LLM repos among the main users of fake stars, and found the accounts behind them have very little other activity, the kind of pattern detection tools look for. Real interest leaves other traces too, such as forks: across the AI repos on Upcurrent's list, the median repo had ${fmt(med(R.map(r => r.forks)))} forks to ${fmt(med(R.map(r => r.stars)))} stars when last seen.</p></section>
<section id="instead"><h2>What to do instead</h2><p>Real stars come from people finding the repo useful. The <a href="../github-stars/">how to get more GitHub stars</a> guide has ten honest ways, backed by Upcurrent's data, and <a href="../github-trending/">how to get on GitHub trending</a> has a launch-day plan. If you want paid visibility, use something clearly labelled, like a sponsored post or Upcurrent's <a href="../">Featured spot</a>, which never changes rankings or star counts.</p></section>`,
      qa: [["Is it legal to buy GitHub stars?", "It breaks GitHub's Acceptable Use Policies, which ban automated starring and secondary markets for inauthentic activity. GitHub can remove the stars, the repo or the account."],
        ["Do fake GitHub stars work?", "Only briefly. The StarScout study found the promotion effect of fake stars lasts less than two months and then becomes a liability."],
        ["How can you tell if a repo has fake stars?", "Warning signs include a sudden spike of stars with few forks, issues or contributors, and stargazers with empty, brand-new accounts. Tools like StarScout look for these patterns."],
        ["Is there a legitimate paid way to promote a repo?", "Yes: clearly labelled sponsorships and ads, such as newsletter sponsorships or Upcurrent's Featured spot, which never touch star counts or rankings."]] });
  }

  // 4. Show HN
  {
    const sh = new Map(), hn = new Map();
    days.forEach(d => (data[d].discussions || []).filter(z => z.src === "Hacker News").forEach(z => { hn.set(z.url, z); if (/^Show HN/i.test(z.t)) { const c = sh.get(z.url); if (!c || c.up < z.up) sh.set(z.url, { ...z, day: d }); } }));
    const S = [...sh.values()].sort((a, b) => b.up - a.up), H = [...hn.values()];
    const gh = S.filter(s => /github\.com/.test(s.link || "")).length;
    mk("show-hn", { title: `Show HN Guide: Rules, Tips and ${S.length} Posts That Took Off`, h1: "How to do a Show HN",
      lede: `Show HN is how developers launch on Hacker News. Here are the official rules in plain English, what to post and when, and real results from ${S.length} Show HN posts that reached Upcurrent's list of the most-discussed threads.`,
      body: `<section id="rules"><h2>The Show HN rules, in plain English</h2><ul class="rows"><li><span class="t">It must be something people can try</span><span class="m">Software they can run, hardware they can hold (a video is fine), or a sample chapter of a book. Blog posts, sign-up pages, newsletters and lists are off topic.</span></li><li><span class="t">You must have made it, and be around to discuss it</span></li><li><span class="t">Make it easy to try</span><span class="m">Ideally with no sign-up or email. Not ready to try? Don't post yet.</span></li><li><span class="t">No landing pages, fundraisers or minor updates</span><span class="m">"Foo 1.3.1 is out" isn't a Show HN; a major overhaul can be.</span></li><li><span class="t">Non-trivial work only</span><span class="m">HN asks people not to post quickly generated one-offs.</span></li><li><span class="t">Never ask friends to upvote or comment</span><span class="m">HN says plainly that's not OK.</span></li><li><span class="t">Title starts with "Show HN:"</span><span class="m">It appears on the Show New page, then on the Show page once it clears a small points threshold.</span></li></ul><p class="asof">From <a href="https://news.ycombinator.com/showhn.html" rel="noopener">Hacker News's Show HN guidelines</a>, checked ${CHECKED}.</p></section>
<section id="results"><h2>Show HN posts that took off</h2><p>Since ${longD(since)}, Upcurrent has recorded ${H.length} Hacker News threads on its most-discussed list (median ${fmt(med(H.map(z => z.up)))} points). ${S.length} were Show HNs, with a median of ${fmt(med(S.map(z => z.up)))} points, and ${gh} of them linked straight to a GitHub repo.</p><ul class="rows">${S.slice(0, 10).map(s => `<li><span class="t">${link(s.url, s.t)}</span><span class="m">${fmt(s.up)} points · ${fmt(s.com)} comments · ${esc(longD(s.day))}</span></li>`).join("")}</ul></section>
<section id="tips"><h2>What the successful ones have in common</h2><ul class="rows"><li><span class="t">A title that says what it does</span><span class="m">"Show HN: X – one plain phrase about what it does", not a tagline.</span></li><li><span class="t">Something you can try in seconds</span><span class="m">A live demo or one-command install.</span></li><li><span class="t">A first comment from the maker</span><span class="m">Why you built it, how it works, what's next. HN's guidelines ask makers to explain how and why.</span></li><li><span class="t">Answering every question</span><span class="m">The thread is the launch; stay for the day.</span></li></ul></section>
<section><h2>Pair it with a GitHub push</h2><p>A Show HN that links to a repo can carry it onto trending lists the same day. See <a href="../github-trending/">how to get on GitHub trending</a> and <a href="../launch-platforms/">other places to launch</a>.</p></section>`,
      qa: [["What is Show HN?", "A Hacker News post type for sharing something you made that people can try. The title starts with \"Show HN:\"."],
        ["What are the Show HN rules?", "It must be something people can try, made by you, with you around to discuss it. No landing pages, sign-up pages, fundraisers or minor updates, and never ask friends to upvote."],
        ["How many points does a good Show HN get?", `Among the ${S.length} Show HNs on Upcurrent's most-discussed list, the median was ${fmt(med(S.map(z => z.up)))} points. Most Show HNs get far fewer and never reach the front page.`],
        ["When should I post a Show HN?", "When your project is ready to try and you can spend the day answering comments. Many makers post on a weekday morning, US time."]] });
  }

  // 5. Launch platforms (Product Hunt alternatives)
  {
    const PL = [
      ["Product Hunt", "https://www.producthunt.com/", "The biggest general launch site. You need a personal account (company accounts can't post), new accounts need access before posting, and you don't need a 'hunter': Product Hunt recommends posting your own product.", "Consumer and business tools with a polished page"],
      ["Hacker News (Show HN)", "https://news.ycombinator.com/showhn.html", "Free. Must be something people can try, made by you. Huge developer audience, strict rules.", "Developer tools and open-source repos", "../show-hn/"],
      ["DevHunt", "https://devhunt.org/", "A launchpad and directory for developer tools, voted on by developers, with weekly voting and a top tool of each week. It says over 7,600 tools have launched there.", "Developer tools, APIs, MCP servers"],
      ["Uneed", "https://www.uneed.best/", "A launch platform with a daily leaderboard. You can start a submission without an account; it reads your page first and asks you to sign up to save it. Has free and paid options.", "Indie products and side projects"],
      ["BetaList", "https://betalist.com/", "For early-stage startups looking for first users. You submit your website and pick a plan before anything is published.", "Pre-launch startups wanting beta users"],
      ["Microlaunch", "https://microlaunch.net/", "A launch platform with monthly launches and a leaderboard; it listed 162 products for November 2026. Has a premium option.", "Indie tech products"]
    ];
    mk("launch-platforms", { title: "Product Hunt Alternatives: Where to Launch an AI Project", h1: "Where to launch an AI project",
      lede: "Product Hunt isn't the only place to launch. Here are six launch platforms for AI and developer projects, what each requires, which suits what, and how to line them up on one day. Every rule is checked against the platform's own pages.",
      body: `<section id="list"><h2>Six places to launch, compared</h2><ul class="rows">${PL.map(([n, u, d, best, inner]) => `<li><span class="t"><a href="${u}" rel="noopener">${esc(n)}</a></span><span class="m">${esc(d)} Best for: ${esc(best)}.${inner ? ` <a href="${inner}">Full guide</a>.` : ""}</span></li>`).join("")}</ul><p class="asof">Checked against each platform's own site on ${CHECKED}. Prices and rules change; check before you launch.</p></section>
<section id="pick"><h2>Which one for an AI project?</h2><div class="tablewrap"><table><thead><tr><th>You built…</th><th>Start with</th></tr></thead><tbody><tr><th scope="row">An open-source repo or CLI</th><td>Show HN, then DevHunt</td></tr><tr><th scope="row">An MCP server or agent skill</th><td>DevHunt and Show HN; add the mcp-server topic on GitHub</td></tr><tr><th scope="row">A paid AI app</th><td>Product Hunt, then Uneed or Microlaunch</td></tr><tr><th scope="row">Something not finished yet</th><td>BetaList, for early users</td></tr></tbody></table></div></section>
<section id="data"><h2>Where AI projects actually get noticed</h2><p>Across ${days.length} days, Upcurrent's daily AI list featured ${R.length} GitHub repos, and the median #1 repo gained ${fmt(r1)} stars in a day. Hacker News is one of the main places new projects get discussed: see <a href="../show-hn/">the Show HN guide</a> for the Show HNs that took off. A launch works best when the platforms, social posts and your repo all move on the same day.</p></section>
<section><h2>Launch checklist</h2><ol class="rows"><li><span class="t">README with demo and one-line install</span></li><li><span class="t">A short description that says what it does</span></li><li><span class="t">Screenshots or a 30-second video</span></li><li><span class="t">Pick one main platform for the day, and two supporting ones</span></li><li><span class="t">Be online to answer questions all day</span></li><li><span class="t">Never buy upvotes or stars</span><span class="m"><a href="../buy-github-stars/">Why it backfires</a></span></li></ol></section>`,
      qa: [["What are the best Product Hunt alternatives?", "For developer and AI projects: Hacker News (Show HN) and DevHunt. For indie products: Uneed and Microlaunch. For pre-launch startups: BetaList."],
        ["Is it free to launch on Product Hunt?", "Posting your own product needs a personal account with posting access. Product Hunt recommends posting it yourself rather than finding a hunter."],
        ["Where should I launch an open-source AI tool?", "Show HN on Hacker News first, since it reaches developers directly, then DevHunt. Link to your GitHub repo so stars come with the traffic."],
        ["Should I launch on several platforms on the same day?", "Yes, ideally one main platform plus a couple of others. Trending lists reward attention that arrives close together."]] });
  }

  const moneyLinks = `<section id="cluster"><h2>Guides for makers</h2><p>Free guides built from Upcurrent's own tracking data: <a href="github-stars/">how to get more GitHub stars</a>, <a href="github-trending/">how to get on GitHub trending</a>, <a href="show-hn/">how to do a Show HN</a>, <a href="launch-platforms/">where to launch an AI project</a> and <a href="buy-github-stars/">why buying GitHub stars backfires</a>.</p></section>`;
  return { pages: out, moneyLinks };
};
