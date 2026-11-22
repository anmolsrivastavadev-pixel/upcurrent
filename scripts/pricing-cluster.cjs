// The LLM API pricing cluster: one funnel built around the /llm-api-pricing/ money page.
//   Middle (comparing before buying): /llm-api-pricing/<lab>/, /cheapest/, /calculator/, and "X vs Y" pages.
//   Top (learning): /llm-api/ guides on what an LLM API is, tokens, API keys, Python, caching and cutting costs.
// Every number comes from data/api/llm-pricing.json (OpenRouter's live price list, refreshed every 30 minutes).
// Provider facts below were checked by hand against each provider's own docs on CHECKED; re-check monthly.
const CHECKED = "22 November 2026";

module.exports = function pricingCluster(P, h) {
  const { page, esc, link, faq, faqHtml, breadcrumb, clip, asOf, chart, SITE } = h;
  const out = {};
  const all = P.models.filter(m => !/guard/i.test(m.name));
  const main = all.filter(m => !/\(batch\)/i.test(m.name));
  const batchOf = m => all.find(b => b.id !== m.id && /\(batch\)/i.test(b.name) && b.name.replace(/\s*\(batch\)/i, "") === m.name);
  const short = m => m.name.replace(/^[^:]+:\s*/, "");
  const usd = n => n == null ? "—" : "$" + (n >= 1 ? (+n.toFixed(2)).toString() : (+n.toFixed(3)).toString());
  const money = n => n == null ? "—" : n === 0 ? "$0" : n < 0.01 ? "$" + (+n.toPrecision(2)).toString() : n < 100 ? "$" + n.toFixed(2) : "$" + Math.round(n).toLocaleString("en-GB");
  const ctxS = n => !n ? "—" : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}K`;
  const cost = (m, i, o) => (i * m.in + o * m.out) / 1e6;
  const mon = new Date(P.updated).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const when = asOf(P.updated);
  const or = m => "https://openrouter.ai/" + m.id;
  const blend = m => m.in * 3 + m.out; // most requests send ~3x more tokens than they get back
  const PRICING = `${SITE}llm-api-pricing/`;

  // Typical jobs, used to turn per-million prices into money people can picture.
  const JOBS = [
    { k: "chat", name: "One chatbot reply", i: 1500, o: 400, note: "1,500 tokens in, 400 out" },
    { k: "report", name: "Summarise a 30-page report", i: 20000, o: 1000, note: "20,000 tokens in, 1,000 out" },
    { k: "support", name: "1,000 customer-support replies", i: 2000000, o: 400000, note: "2,000 tokens in and 400 out, 1,000 times" },
    { k: "app", name: "A chat app with 1,000 replies a day for a month", i: 45000000, o: 12000000, note: "30,000 replies of 1,500 in and 400 out" }
  ];
  const jobTable = ms => `<div class="tablewrap"><table class="jt"><thead><tr><th>Job</th>${ms.map(m => `<th>${esc(short(m))}</th>`).join("")}</tr></thead><tbody>${JOBS.map(j => `<tr><th scope="row">${esc(j.name)}<br><small>${esc(j.note)}</small></th>${ms.map(m => `<td class="num">${money(cost(m, j.i, j.o))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const thead = `<thead><tr><th>Model</th><th>Input / 1M</th><th>Output / 1M</th><th>Cached input / 1M</th><th>Context</th></tr></thead>`;
  const row = (m, sh = true) => `<tr><th scope="row">${link(or(m), sh ? short(m) : m.name)}</th><td class="num">${usd(m.in)}</td><td class="num">${usd(m.out)}</td><td class="num">${usd(m.cached)}</td><td class="num">${ctxS(m.ctx)}</td></tr>`;
  const table = (ms, sh) => `<div class="tablewrap"><table>${thead}<tbody>${ms.map(m => row(m, sh)).join("")}</tbody></table></div>`;
  const asof = `<p class="asof">Prices in US dollars per 1 million tokens, from OpenRouter's live list. Last checked ${esc(when)}.</p>`;
  const toMoney = `<section class="alertbox"><h2>Compare every model's price</h2><p>This page covers one slice. The <a href="${PRICING}">LLM API pricing table</a> lists all ${main.length} models side by side, refreshed every 30 minutes, with a filter to find any model fast.</p></section>`;

  // ---------- Labs ----------
  const LABS = [
    { slug: "claude", labs: ["anthropic"], brand: "Claude", maker: "Anthropic", official: "https://platform.claude.com/docs/en/about-claude/pricing", key: "https://platform.claude.com/settings/keys",
      facts: [
        "Batch: the Message Batches API charges 50% of the standard price for jobs that can wait (most finish within an hour, all within 24 hours).",
        "Prompt caching: writing to the 5-minute cache costs 1.25× the input price, the 1-hour cache costs 2×, and cache reads cost 0.1× on most models (less on a few; see cached prices below).",
        "Long prompts: Claude Haiku 5.5 costs more once a prompt passes 100,000 tokens ($0.50 rather than $0.10 per million input tokens).",
        "Subscription or API: Claude Pro is $20 a month ($17 a month paid yearly). Max ($100 a month) includes $100 of API credits each month, and Ultra ($200) includes $200. The API itself is pay as you go."
      ],
      qa: [["Is the Claude API included in Claude Pro?", "No. Claude Pro ($20 a month) covers the Claude apps and Claude Code. The API is billed separately per token through the Claude Console. The Max ($100) and Ultra ($200) plans include $100 and $200 of API credits a month."],
        ["Does Claude have a batch discount?", "Yes. Anthropic's Message Batches API charges 50% of the normal price, for requests that can wait up to 24 hours."]] },
    { slug: "openai", labs: ["openai"], brand: "OpenAI", maker: "OpenAI", official: "https://developers.openai.com/api/docs/pricing", key: "https://platform.openai.com/api-keys",
      facts: [
        "Batch: the Batch API costs 50% less and returns results within 24 hours.",
        "Prompt caching is automatic. On GPT-5.6 and later, cache writes cost 1.25× the input price (30-minute cache) or 2.5× (12-hour cache), and reads cost 0.1×, or 0.05× on GPT-6.2 Astra, GPT-6.2 Sol, GPT-6.1 Sol and GPT-6.1 Terra.",
        "Reasoning tokens (the model's hidden thinking) are billed as output tokens, so a short answer can cost more than its length suggests.",
        "Counting input tokens before you send a request is free, through the Responses input-token counting endpoint."
      ],
      qa: [["Is the OpenAI API included in ChatGPT Plus?", "No. ChatGPT subscriptions and the OpenAI API are billed separately; the API is pay as you go, per token, from the OpenAI Platform."],
        ["Why did my OpenAI bill have more output tokens than the answer?", "Reasoning models think before they answer, and OpenAI bills those hidden reasoning tokens as output tokens."]] },
    { slug: "gemini", labs: ["google"], brand: "Gemini", maker: "Google", official: "https://aistudio.google.com/docs/pricing", key: "https://aistudio.google.com/apikey", free: "../../free-ai-models/gemini/",
      facts: [
        "Free tier: Google AI Studio gives new users an API key and a free tier with lower rate limits; add billing to raise them.",
        "Batch: the Gemini Batch API is priced at 50% of the standard interactive price.",
        "Caching: implicit caching is on by default for Gemini 2.5 and newer, and Google passes the savings on automatically when a request hits the cache."
      ],
      qa: [["Is the Gemini API free?", "Partly. Google AI Studio has a free tier with lower rate limits; paid use is billed per token at the prices above. See the Gemini API free tier guide for the current limits."]] },
    { slug: "deepseek", labs: ["deepseek"], brand: "DeepSeek", maker: "DeepSeek", official: "https://api-docs.deepseek.com/quick_start/pricing", key: "https://platform.deepseek.com/api_keys",
      facts: [
        "Peak and off-peak: buying direct from DeepSeek, off-peak prices are half the peak prices. Peak hours are 01:00 to 04:00 and 06:00 to 10:00 UTC, Monday to Friday (UK time in winter; add an hour in summer). Weekends are off-peak all day.",
        "Direct prices for deepseek-flash: $0.15 per million input tokens off-peak ($0.30 peak), $0.60 per million output off-peak ($1.20 peak), and $0.003 for cached input off-peak.",
        "Direct prices for deepseek-v4-pro: $0.66 input and $1.98 output off-peak, $1.32 and $3.96 at peak.",
        "The API works with the OpenAI and Anthropic SDKs: base URL https://api.deepseek.com (or /anthropic)."
      ],
      qa: [["When is DeepSeek API cheapest?", "Off-peak, when direct prices are half. Peak hours are 01:00 to 04:00 and 06:00 to 10:00 UTC on weekdays; every other hour, and all weekend, is off-peak."]] },
    { slug: "grok", labs: ["x-ai"], brand: "Grok", maker: "SpaceXSI (formerly xAI)", official: "https://docs.x.ai/developers/pricing", key: "https://console.x.ai",
      facts: [
        "Credits first: you sign up at console.x.ai and load credits before the API will answer.",
        "Prompt caching is automatic; setting the x-grok-conv-id header raises the cache hit rate, and cached tokens are billed at a lower rate.",
        "The API works with the OpenAI SDK: base URL https://api.x.ai/v1."
      ], qa: [] },
    { slug: "mistral", labs: ["mistralai"], brand: "Mistral", maker: "Mistral AI", official: "https://mistral.ai/pricing", facts: [], qa: [] },
    { slug: "qwen", labs: ["qwen"], brand: "Qwen", maker: "Alibaba", official: "https://www.alibabacloud.com/help/en/model-studio/model-pricing", facts: [], qa: [] },
    { slug: "kimi", labs: ["moonshotai"], brand: "Kimi", maker: "Moonshot AI", official: "https://platform.moonshot.ai/docs/pricing/chat", facts: [], qa: [] },
    { slug: "llama", labs: ["meta", "meta-llama"], brand: "Meta Llama", maker: "Meta (Llama and Muse models)", facts: [], qa: [] }
  ];
  const PAIRS = [["openai", "claude"], ["gemini", "claude"], ["deepseek", "openai"]];
  const labModels = L => main.filter(m => L.labs.includes(m.lab)).sort((a, b) => b.created.localeCompare(a.created));
  const built = LABS.filter(L => labModels(L).length >= 3);
  const labNav = cur => `<nav class="guides" aria-label="API pricing by lab">${built.map(L => L.slug === cur ? `<b>${esc(L.brand)}</b>` : `<a href="../${L.slug}/">${esc(L.brand)}</a>`).join("")}<a href="../cheapest/">Cheapest</a><a href="../calculator/">Calculator</a></nav>`;
  const guideLinks = up => `<section><h2>New to LLM APIs?</h2><p>Start with <a href="${up}llm-api/what-is-an-llm-api/">what an LLM API is</a>, then <a href="${up}llm-api/tokens/">how tokens work</a> and <a href="${up}llm-api/api-key/">how to get an API key</a>. When you're ready to write code, see <a href="${up}llm-api/python/">how to use an LLM API in Python</a>, and to keep bills down read <a href="${up}llm-api/prompt-caching/">prompt caching explained</a> and <a href="${up}llm-api/reduce-costs/">how to cut LLM API costs</a>. Want it free? See the <a href="${up}free-ai-models/api/">free LLM API guide</a>.</p></section>`;

  for (const L of built) {
    const ms = labModels(L), url = `${PRICING}${L.slug}/`;
    const recent = ms.slice(0, 20), top = ms.slice(0, 4);
    const cheapest = [...ms].sort((a, b) => blend(a) - blend(b))[0];
    const priciest = [...ms].sort((a, b) => blend(b) - blend(a))[0];
    const biggest = [...ms].sort((a, b) => (b.ctx || 0) - (a.ctx || 0))[0];
    const newest = ms[0];
    const batched = ms.filter(batchOf).slice(0, 6);
    const cachedOnes = top.filter(m => m.cached != null && m.in > 0);
    const lede = `${L.brand} API pricing: ${newest.name.replace(/^[^:]+:\s*/, "")} costs ${usd(newest.in)} per million input tokens and ${usd(newest.out)} per million output tokens. Here is every current ${L.maker} model's price, what typical jobs cost, and how to pay less.`;
    const chartFig = chart(`llm-api-pricing/${L.slug}/${L.slug}-api-cost-1000-replies.svg`, `${L.slug}-api-cost-1000-replies.svg`,
      { title: `${L.brand} API: cost of 1,000 support replies`, sub: `2,000 tokens in, 400 out each · OpenRouter prices, ${mon}`, horizontal: true,
        rows: [...ms.slice(0, 8)].sort((a, b) => cost(b, 2e6, 4e5) - cost(a, 2e6, 4e5)).map(m => [short(m), cost(m, 2e6, 4e5), money(cost(m, 2e6, 4e5))]) },
      `Bar chart: cost of 1,000 support replies on ${L.brand} models. ${ms.slice(0, 8).map(m => `${short(m)} ${money(cost(m, 2e6, 4e5))}`).join(", ")}.`,
      `What 1,000 replies (2,000 tokens in and 400 out each) cost on ${ms.slice(0, 8).length} recent ${L.brand} models.`);
    const qa = [
      [`How much does the ${L.brand} API cost?`, `It depends on the model. Right now ${short(newest)} costs ${usd(newest.in)} per million input tokens and ${usd(newest.out)} per million output tokens. The cheapest ${L.brand} model, ${short(cheapest)}, costs ${usd(cheapest.in)} in and ${usd(cheapest.out)} out.`],
      [`How much does the ${L.brand} API cost per token?`, `Divide the per-million price by a million. ${short(newest)} costs $${(newest.in / 1e6).toPrecision(2)} per input token and $${(newest.out / 1e6).toPrecision(2)} per output token. A token is about three quarters of an English word.`],
      [`What is the cheapest ${L.brand} model?`, `${short(cheapest)}, at ${usd(cheapest.in)} per million input tokens and ${usd(cheapest.out)} per million output tokens, with a ${ctxS(cheapest.ctx)}-token context window.`],
      [`How much does a typical ${L.brand} API request cost?`, `A chatbot reply of about 1,500 tokens in and 400 out costs ${money(cost(newest, 1500, 400))} on ${short(newest)} and ${money(cost(cheapest, 1500, 400))} on ${short(cheapest)}.`],
      ...L.qa
    ];
    const body = `<section><div class="eyebrow">LLM API pricing · ${esc(L.brand)}</div><h1>${esc(L.brand)} API pricing</h1><p class="lede">${esc(lede)}</p>${asof}${labNav(L.slug)}</section>
<section id="newest"><h2>Newest ${esc(L.brand)} models and prices</h2>${table(top)}<p>Highest price: ${esc(short(priciest))} at ${usd(priciest.in)} in and ${usd(priciest.out)} out. Biggest context window: ${esc(short(biggest))} with ${ctxS(biggest.ctx)} tokens. Output tokens cost more than input on almost every model, so long answers matter more than long prompts.</p></section>
<section id="jobs"><h2>What typical jobs cost on ${esc(L.brand)}</h2><p>Per-million prices are hard to picture, so here is the same work priced on the newest models. Change the numbers in the <a href="../calculator/">LLM API cost calculator</a>.</p>${jobTable(top)}${chartFig}</section>
${L.facts.length ? `<section id="direct"><h2>${esc(L.maker)} pricing rules worth knowing</h2><ul class="rows">${L.facts.map(f => `<li><span class="m">${esc(f)}</span></li>`).join("")}</ul><p class="asof">Checked against ${L.official ? `<a href="${L.official}" rel="noopener">${esc(L.maker)}'s pricing docs</a>` : "the provider's docs"} on ${CHECKED}.${L.free ? ` Free use is covered in the <a href="${L.free}">${esc(L.brand)} free tier guide</a>.` : ""}</p></section>` : ""}
${batched.length ? `<section id="batch"><h2>${esc(L.brand)} batch prices</h2><p>If an answer can wait, the batch version of a model costs less. These are the batch prices OpenRouter lists today.</p><div class="tablewrap"><table><thead><tr><th>Model</th><th>Normal in / out</th><th>Batch in / out</th><th>Saving on output</th></tr></thead><tbody>${batched.map(m => { const b = batchOf(m); return `<tr><th scope="row">${esc(short(m))}</th><td class="num">${usd(m.in)} / ${usd(m.out)}</td><td class="num">${usd(b.in)} / ${usd(b.out)}</td><td class="num">${m.out ? Math.round((1 - b.out / m.out) * 100) + "%" : "—"}</td></tr>`; }).join("")}</tbody></table></div></section>` : ""}
${cachedOnes.length ? `<section id="caching"><h2>Cached input on ${esc(L.brand)}</h2><p>When you send the same long prompt again (a system prompt, a document, a codebase), the repeated part can be read from a cache at a much lower price. ${cachedOnes.map(m => `${esc(short(m))}: ${usd(m.cached)} cached against ${usd(m.in)} normal, ${Math.round((1 - m.cached / m.in) * 100)}% off`).join("; ")}. How it works: <a href="../../llm-api/prompt-caching/">prompt caching explained</a>.</p></section>` : ""}
<section id="all"><h2>Every current ${esc(L.brand)} model</h2><p>${ms.length} ${esc(L.brand)} models are on OpenRouter's list today${ms.length > 20 ? "; these are the 20 newest" : ""}, newest first.</p>${table(recent)}</section>
<section id="compare"><h2>How ${esc(L.brand)} compares</h2><p>${compareLinks(L.slug)}See the <a href="../cheapest/">cheapest LLM APIs</a> across every lab.</p></section>
${toMoney}
<section id="source"><h2>Where these prices come from</h2><p>Prices are read every 30 minutes from <a href="https://openrouter.ai/docs/api/reference/models" rel="noopener">OpenRouter's public models API</a>, which <a href="https://openrouter.ai/docs/faq" rel="noopener">passes through each provider's price</a> with no markup (it adds a 5.5% fee when you buy credits).${L.official ? ` Buying direct, check <a href="${L.official}" rel="noopener">${esc(L.maker)}'s own pricing page</a>.` : ""}</p></section>
${guideLinks("../../")}
${faqHtml(qa)}`;
    out[`llm-api-pricing/${L.slug}`] = page({ title: `${L.brand} API Pricing (${mon}): Cost per Million Tokens`, description: clip(lede, 160), canonical: url, body, up: "../../",
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["LLM API pricing", PRICING], [`${L.brand} API pricing`, url]])] });
  }

  // ---------- Head to head ----------
  function compareLinks(slug) {
    const ps = PAIRS.filter(p => p.includes(slug));
    return ps.length ? ps.map(([a, b]) => `<a href="../${a}-vs-${b}/">${esc(LABS.find(x => x.slug === a).brand)} vs ${esc(LABS.find(x => x.slug === b).brand)} API pricing</a>`).join(", ") + ". " : "";
  }
  for (const [a, b] of PAIRS) {
    const A = LABS.find(x => x.slug === a), B = LABS.find(x => x.slug === b);
    if (!built.includes(A) || !built.includes(B)) continue;
    const ma = labModels(A), mb = labModels(B), url = `${PRICING}${a}-vs-${b}/`;
    const fa = ma[0], fb = mb[0], ca = [...ma].sort((x, y) => blend(x) - blend(y))[0], cb = [...mb].sort((x, y) => blend(x) - blend(y))[0];
    const job = JOBS[2], cheaperTop = cost(fa, job.i, job.o) <= cost(fb, job.i, job.o) ? fa : fb, cheaperLow = cost(ca, job.i, job.o) <= cost(cb, job.i, job.o) ? ca : cb;
    const ratioLine = (x, y) => { const cx = cost(x, job.i, job.o), cy = cost(y, job.i, job.o), [hi, lo] = cx >= cy ? [x, y] : [y, x]; const r = Math.max(cx, cy) / Math.min(cx, cy);
      return r < 1.05 ? `${esc(short(x))} and ${esc(short(y))} cost about the same.` : `${esc(short(hi))} costs ${r >= 10 ? Math.round(r) : r.toFixed(1)} times as much as ${esc(short(lo))}.`; };
    const lede = `${A.brand} vs ${B.brand} API pricing, side by side: ${short(fa)} costs ${usd(fa.in)} in and ${usd(fa.out)} out per million tokens; ${short(fb)} costs ${usd(fb.in)} and ${usd(fb.out)}. Live prices, real job costs and the cheapest model from each.`;
    const qa = [
      [`Is ${A.brand} or ${B.brand} cheaper?`, `For 1,000 support replies (2,000 tokens in and 400 out each), the newest models cost ${money(cost(fa, job.i, job.o))} on ${short(fa)} and ${money(cost(fb, job.i, job.o))} on ${short(fb)}, so ${short(cheaperTop)} is cheaper. Comparing each lab's cheapest model, ${short(cheaperLow)} wins.`],
      [`What is the cheapest ${A.brand} model and the cheapest ${B.brand} model?`, `${short(ca)} at ${usd(ca.in)} in and ${usd(ca.out)} out, and ${short(cb)} at ${usd(cb.in)} in and ${usd(cb.out)} out, per million tokens.`],
      [`Which has the bigger context window, ${A.brand} or ${B.brand}?`, `The largest on OpenRouter today: ${short([...ma].sort((x, y) => (y.ctx || 0) - (x.ctx || 0))[0])} with ${ctxS(Math.max(...ma.map(m => m.ctx || 0)))} tokens, and ${short([...mb].sort((x, y) => (y.ctx || 0) - (x.ctx || 0))[0])} with ${ctxS(Math.max(...mb.map(m => m.ctx || 0)))} tokens.`],
      ["Is the cheaper model always the better deal?", "No. A cheaper model that needs two tries, or writes longer answers, can cost more per finished task. Test both on a few real requests and compare the total cost, not just the price per token."]
    ];
    const body = `<section><div class="eyebrow">LLM API pricing · head to head</div><h1>${esc(A.brand)} vs ${esc(B.brand)} API pricing</h1><p class="lede">${esc(lede)}</p>${asof}</section>
<section id="flagship"><h2>Newest models, side by side</h2>${table([...ma.slice(0, 3), ...mb.slice(0, 3)])}</section>
<section id="jobs"><h2>The same jobs on both</h2><p>Newest and cheapest model from each lab, priced on the same work.</p>${jobTable([fa, fb, ca, cb].filter((m, i, s) => s.indexOf(m) === i))}<p>On 1,000 support replies, ${ratioLine(fa, fb)}</p></section>
<section id="rules"><h2>Pricing rules that change the answer</h2><ul class="rows">${[A, B].map(L => L.facts.slice(0, 2).map(f => `<li><span class="t">${esc(L.brand)}</span><span class="m">${esc(f)}</span></li>`).join("")).join("")}</ul><p class="asof">Checked against each provider's pricing docs on ${CHECKED}. Full detail: <a href="../${a}/">${esc(A.brand)} API pricing</a> and <a href="../${b}/">${esc(B.brand)} API pricing</a>.</p></section>
${toMoney}
${guideLinks("../../")}
${faqHtml(qa)}`;
    out[`llm-api-pricing/${a}-vs-${b}`] = page({ title: `${A.brand} vs ${B.brand} API Pricing (${mon}): Live Comparison`, description: clip(lede, 160), canonical: url, body, up: "../../",
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["LLM API pricing", PRICING], [`${A.brand} vs ${B.brand}`, url]])] });
  }

  // ---------- Cheapest ----------
  {
    const url = `${PRICING}cheapest/`, ok = main.filter(m => (m.ctx || 0) >= 32000 && m.out > 0);
    const cheap = [...ok].sort((a, b) => blend(a) - blend(b)).slice(0, 10);
    const coding = [...ok].filter(m => /cod|devstral|coder/i.test(m.name)).sort((a, b) => blend(a) - blend(b)).slice(0, 6);
    const long = [...ok].filter(m => (m.ctx || 0) >= 1e6).sort((a, b) => blend(a) - blend(b)).slice(0, 6);
    const vision = [...ok].filter(m => (m.input || []).includes("image")).sort((a, b) => blend(a) - blend(b)).slice(0, 6);
    const perLab = built.map(L => [L, [...labModels(L)].sort((a, b) => blend(a) - blend(b))[0]]);
    const c0 = cheap[0];
    const lede = `The cheapest LLM API right now is ${c0.name} at ${usd(c0.in)} per million input tokens and ${usd(c0.out)} per million output tokens. Here are the 10 lowest-priced models, the cheapest for coding, for long documents and for images, and the cheapest model from each big lab.`;
    const qa = [
      ["What is the cheapest LLM API?", `${c0.name}, at ${usd(c0.in)} in and ${usd(c0.out)} out per million tokens, among models with at least a 32K context window. Next are ${cheap.slice(1, 3).map(m => `${m.name} (${usd(m.in)} / ${usd(m.out)})`).join(" and ")}.`],
      ...(coding.length ? [["What is the cheapest LLM API for coding?", `Among models built for code, ${coding[0].name} is cheapest at ${usd(coding[0].in)} in and ${usd(coding[0].out)} out per million tokens. Coding agents send a lot of input, so cached input prices matter too.`]] : []),
      ["Is there a free LLM API?", "Yes. Several providers have free tiers or free models, with daily limits. The free LLM API guide lists the ones that work today."],
      ["Which cheap LLM API provider should I use?", "If you want one key for many models, OpenRouter lists all of the models here at the providers' own prices plus a 5.5% fee when buying credits. If you only use one lab's models, buying direct skips that fee."],
      ["How do you rank the cheapest models?", "By input price × 3 + output price, because most requests send about three times more tokens than they get back. Models with less than a 32K-token context window, and free models, are left out."]
    ];
    const body = `<section><div class="eyebrow">LLM API pricing · cheapest</div><h1>Cheapest LLM API</h1><p class="lede">${esc(lede)}</p>${asof}</section>
<section id="top10"><h2>The 10 cheapest LLM APIs</h2>${table(cheap, false)}<p>A chatbot reply (1,500 tokens in, 400 out) costs ${money(cost(c0, 1500, 400))} on ${esc(c0.name)}. A thousand of them cost ${money(cost(c0, 1.5e6, 4e5))}.</p></section>
${coding.length ? `<section id="coding"><h2>Cheapest LLM API for coding</h2><p>Models made for code (their names say Code, Coder or Devstral), cheapest first.</p>${table(coding, false)}</section>` : ""}
${long.length ? `<section id="long"><h2>Cheapest with a 1M-token context window</h2><p>For whole codebases, books or long chats.</p>${table(long, false)}</section>` : ""}
${vision.length ? `<section id="vision"><h2>Cheapest that can read images</h2>${table(vision, false)}</section>` : ""}
<section id="labs"><h2>Cheapest model from each lab</h2><div class="tablewrap"><table><thead><tr><th>Lab</th><th>Cheapest model</th><th>In / out per 1M</th><th>1,000 replies</th></tr></thead><tbody>${perLab.map(([L, m]) => `<tr><th scope="row"><a href="../${L.slug}/">${esc(L.brand)}</a></th><td>${esc(short(m))}</td><td class="num">${usd(m.in)} / ${usd(m.out)}</td><td class="num">${money(cost(m, 1.5e6, 4e5))}</td></tr>`).join("")}</tbody></table></div></section>
<section id="free"><h2>Cheaper still: free</h2><p>If your project is small, you may not need to pay at all. The <a href="../../free-ai-models/api/">free LLM API guide</a> lists free models with their daily limits, and the <a href="../../free-ai-models/calculator/">free LLM API calculator</a> shows whether a free tier covers your use.</p></section>
${toMoney}
${guideLinks("../../")}
${faqHtml(qa)}`;
    out["llm-api-pricing/cheapest"] = page({ title: `Cheapest LLM API (${mon}): 10 Lowest Prices, Live`, description: clip(lede, 160), canonical: url, body, up: "../../",
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["LLM API pricing", PRICING], ["Cheapest LLM API", url]])] });
  }

  // ---------- Calculator ----------
  {
    const url = `${PRICING}calculator/`;
    const pool = main.filter(m => m.out > 0).sort((a, b) => a.name.localeCompare(b.name));
    const data = pool.map(m => [m.name, m.in, m.out, m.cached ?? m.in]);
    const pop = built.slice(0, 5).map(L => labModels(L)[0]);
    const def = pop.find(m => m.lab === "anthropic") || pop[0];
    const lede = `Work out what an LLM API will cost you: pick any of ${pool.length} models from Claude, OpenAI, Gemini, DeepSeek and more, enter your tokens and requests, and see the cost per request, per day and per month at today's prices.`;
    const qa = [
      ["How do I calculate LLM API cost?", "Cost = input tokens × input price + output tokens × output price, with prices per million tokens divided by 1,000,000. Multiply by how many requests you make. Cached input, if your provider supports it, is charged at the lower cached price."],
      ["How many tokens is my text?", "In English, one token is about four characters or three quarters of a word, so 1,000 words is roughly 1,300 tokens. Use the words box in the calculator to convert."],
      [`How much does the Claude API cost per month?`, `For a chat app with 1,000 replies a day (1,500 tokens in and 400 out each), ${short(def)} would cost about ${money(cost(def, 4.5e7, 1.2e7))} a month at today's prices.`],
      ["Are these prices exact?", "They are OpenRouter's live prices, which pass through what each provider charges. Your real bill also depends on how long the model's answers are, reasoning tokens, and any caching or batch discounts."]
    ];
    const body = `<section><div class="eyebrow">LLM API pricing · calculator</div><h1>LLM API cost calculator</h1><p class="lede">${esc(lede)}</p>${asof}</section>
<section id="calc" class="alertbox"><h2>Your cost</h2>
<p><label for="cm">Model</label><br><input id="cms" type="search" placeholder="Filter models, e.g. claude" aria-label="Filter models" style="max-width:280px"><br><select id="cm" style="max-width:100%;margin-top:6px"></select></p>
<div class="finder" style="gap:12px"><label>Input tokens per request <input id="ci" type="number" min="0" value="1500" style="width:110px"></label><label>Output tokens per request <input id="co" type="number" min="0" value="400" style="width:110px"></label><label>Requests per day <input id="cr" type="number" min="0" value="1000" style="width:110px"></label><label>Input that hits the cache (%) <input id="cc" type="number" min="0" max="100" value="0" style="width:80px"></label></div>
<p><label>Or turn words into tokens: <input id="cw" type="number" min="0" placeholder="words" style="width:110px"></label> <span id="cwo" class="m"></span></p>
<ul class="stats" aria-live="polite"><li>Per request <b id="r1" class="num">—</b></li><li>Per day <b id="rd" class="num">—</b></li><li>Per month (30 days) <b id="rm" class="num">—</b></li></ul>
<h3>The same job on the cheapest models</h3><div class="tablewrap"><table id="calt"><thead><tr><th>Model</th><th>Per month</th></tr></thead><tbody></tbody></table></div>
<script>(()=>{const D=${JSON.stringify(data).replace(/</g, "\\u003c")},$=id=>document.getElementById(id),sel=$("cm"),f=$("cms");
const m$=n=>n===0?"$0":n<0.01?"$"+(+n.toPrecision(2)):n<100?"$"+n.toFixed(2):"$"+Math.round(n).toLocaleString("en-GB");
function fill(){const v=f.value.toLowerCase(),cur=sel.value;sel.innerHTML=D.filter(d=>!v||d[0].toLowerCase().includes(v)).map(d=>'<option'+(d[0]===cur?' selected':'')+'>'+d[0].replace(/[<&]/g,"")+'</option>').join("");calc()}
function c(d,i,o,h){return((i*(1-h)*d[1])+(i*h*d[3])+(o*d[2]))/1e6}
function calc(){const d=D.find(x=>x[0]===sel.value);const i=+$("ci").value||0,o=+$("co").value||0,r=+$("cr").value||0,h=Math.min(1,Math.max(0,(+$("cc").value||0)/100));if(!d)return;const one=c(d,i,o,h);$("r1").textContent=m$(one);$("rd").textContent=m$(one*r);$("rm").textContent=m$(one*r*30);
$("calt").tBodies[0].innerHTML=D.map(x=>[x,c(x,i,o,h)*r*30]).sort((a,b)=>a[1]-b[1]).slice(0,8).map(([x,v])=>'<tr><th scope="row">'+x[0].replace(/[<&]/g,"")+'</th><td class="num">'+m$(v)+'</td></tr>').join("")}
f.addEventListener("input",fill);["cm","ci","co","cr","cc"].forEach(id=>$(id).addEventListener("input",calc));$("cw").addEventListener("input",e=>{const w=+e.target.value||0;$("cwo").textContent=w?"≈ "+Math.round(w/0.75).toLocaleString("en-GB")+" tokens":""});
fill();sel.value=${JSON.stringify(def.name)};calc()})();</script></section>
<section id="examples"><h2>Example costs on popular models</h2><p>The same four jobs on the newest model from each of the big labs, so you can sanity-check the calculator.</p>${jobTable(pop)}</section>
<section id="how"><h2>How the calculator works</h2><p>For each request it adds input tokens × input price, cached tokens × cached price and output tokens × output price, using prices per million tokens from OpenRouter, refreshed every 30 minutes. Reasoning models also bill their hidden thinking as output, so leave room for that in the output box. To learn what counts as a token, read <a href="../../llm-api/tokens/">what are tokens in AI</a>.</p></section>
${toMoney}
${guideLinks("../../")}
${faqHtml(qa)}`;
    out["llm-api-pricing/calculator"] = page({ title: "LLM API Cost Calculator: Claude, OpenAI, Gemini, DeepSeek", description: clip(lede, 160), canonical: url, body, up: "../../",
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["LLM API pricing", PRICING], ["Cost calculator", url]])] });
  }

  // ---------- Top of the funnel: /llm-api/ guides ----------
  const G = `${SITE}llm-api/`;
  const flag = built.slice(0, 5).map(L => [L, labModels(L)[0]]);
  const priceList = flag.map(([L, m]) => `${short(m)} (${L.brand}) costs ${usd(m.in)} in and ${usd(m.out)} out`).join("; ");
  const GUIDES = [
    ["what-is-an-llm-api", "What is an LLM API?"], ["tokens", "What are tokens?"], ["api-key", "How to get an API key"],
    ["python", "Use an LLM API in Python"], ["prompt-caching", "Prompt caching explained"], ["reduce-costs", "Cut LLM API costs"]
  ];
  const gNav = cur => `<nav class="guides" aria-label="LLM API guides">${GUIDES.map(([s, n]) => s === cur ? `<b>${esc(n)}</b>` : `<a href="../${s}/">${esc(n)}</a>`).join("")}</nav>`;
  const next = up => `<section class="alertbox"><h2>Next: compare prices</h2><p>Ready to pick a model? See the <a href="${up}llm-api-pricing/">LLM API pricing table</a> for all ${main.length} models, the <a href="${up}llm-api-pricing/cheapest/">cheapest LLM APIs</a>, and the <a href="${up}llm-api-pricing/calculator/">cost calculator</a>. By lab: ${built.map(L => `<a href="${up}llm-api-pricing/${L.slug}/">${esc(L.brand)}</a>`).join(", ")}.</p></section>`;
  const guide = (slug, { title, h1, lede, body, qa }) => {
    const url = `${G}${slug}/`;
    out[`llm-api/${slug}`] = page({ title, description: clip(lede, 160), canonical: url, up: "../../",
      body: `<section><div class="eyebrow">LLM API guide</div><h1>${esc(h1)}</h1><p class="lede">${esc(lede)}</p>${gNav(slug)}</section>\n${body}\n${next("../../")}\n${faqHtml(qa)}`,
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["LLM API guide", G], [h1, url]])] });
  };
  const pre = s => `<pre><code>${esc(s)}</code></pre>`;
  const claudeM = labModels(LABS[0])[0], oaiM = labModels(LABS[1])[0];
  const cheapAny = [...main.filter(m => (m.ctx || 0) >= 32000 && m.out > 0)].sort((a, b) => blend(a) - blend(b))[0];

  guide("what-is-an-llm-api", { title: "What Is an LLM API? A Plain-English Guide, With Prices", h1: "What is an LLM API?",
    lede: "An LLM API lets your own code send text to an AI model like Claude, GPT or Gemini and get its answer back, paying a tiny amount per word instead of a monthly subscription. Here is how it works, what it costs today, and how to start.",
    body: `<section><h2>The short answer</h2><p>LLM stands for large language model, the kind of AI behind ChatGPT, Claude and Gemini. API stands for application programming interface: a web address your program can send requests to. Put together, an LLM API is a way for your app, script or website to ask an AI model a question and get the answer back as data, without anyone typing into a chat window.</p><p>You send a request with your prompt and an API key (a secret password that identifies you). The provider runs the model and sends back the reply, along with how many tokens it used. You are billed for those tokens.</p></section>
<section><h2>What one API call looks like</h2><p>This request asks a model a question through OpenRouter, which uses the same format as OpenAI and works with hundreds of models:</p>${pre(`curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${cheapAny.id}", "messages": [{"role": "user", "content": "Explain APIs in one sentence."}]}'`)}<p>The reply is JSON: the model's answer plus a <code>usage</code> block counting input and output tokens. That count is what you pay for.</p></section>
<section><h2>What an LLM API costs</h2><p>APIs charge per million tokens (a token is about three quarters of a word), with separate prices for what you send and what comes back. Today: ${esc(priceList)}, all per million tokens. A typical chatbot reply costs ${money(cost(claudeM, 1500, 400))} on ${esc(short(claudeM))} and ${money(cost(cheapAny, 1500, 400))} on ${esc(cheapAny.name)}, the cheapest model on the list.</p></section>
<section><h2>API or subscription?</h2><p>A chat subscription such as Claude Pro ($20 a month) is for a person using the app. The API is for software: you pay only for what your code uses, which can be pennies for a small project or far more for a busy app. Subscriptions and API usage are billed separately, though Anthropic's Max ($100) and Ultra ($200) plans now include $100 and $200 a month of API credits (checked ${CHECKED}).</p></section>
<section><h2>Who offers LLM APIs</h2><ul class="rows">${flag.map(([L, m]) => `<li><span class="t"><a href="../../llm-api-pricing/${L.slug}/">${esc(L.brand)} API</a> (${esc(L.maker)})</span><span class="m">Newest: ${esc(short(m))}, ${usd(m.in)} in / ${usd(m.out)} out per million tokens</span></li>`).join("")}<li><span class="t">Gateways such as OpenRouter</span><span class="m">One key and one format for models from every lab, at the labs' own prices plus a 5.5% fee when you buy credits</span></li></ul></section>
<section><h2>How to start</h2><p>1. <a href="../api-key/">Get an API key</a> from one provider. 2. Learn <a href="../tokens/">how tokens are counted</a> so the bill makes sense. 3. Make your first call <a href="../python/">in Python</a>. If you want to try it for nothing first, the <a href="../../free-ai-models/api/">free LLM API guide</a> lists providers with free tiers.</p></section>`,
    qa: [["What does LLM API mean?", "An LLM API is a web service that lets programs send prompts to a large language model and receive its responses, usually billed per token."],
      ["What is an LLM API call?", "One request to the model: your prompt goes in, the answer comes back, and the provider records the input and output tokens for billing."],
      ["What is an LLM API key?", "A secret string that identifies your account. Every request sends it, so keep it out of public code and websites."],
      ["What is an LLM API gateway?", "A service such as OpenRouter that sits in front of many providers, so one key and one request format reach models from different labs."],
      ["Is an LLM API free?", "Some are, with limits. Gemini, Groq, OpenRouter's free models and others have free tiers; paid use is billed per token."]] });

  const words = [["A tweet (40 words)", 40], ["An email (200 words)", 200], ["A page of a book (500 words)", 500], ["A 30-page report (15,000 words)", 15000], ["A novel (90,000 words)", 90000]];
  guide("tokens", { title: "What Are Tokens in AI? How LLM Tokens Work and Cost", h1: "What are tokens in AI?",
    lede: "Tokens are the small chunks of text an AI model reads and writes: roughly four characters, or three quarters of a word, each. They decide how much an LLM API costs and how much text fits in one request. Here is how they work, with real prices.",
    body: `<section><h2>Tokens in one minute</h2><p>Before a model reads your text, it splits it into tokens. A token can be a whole word (<code>cat</code>), part of a word, a single character or a punctuation mark. OpenAI's rule of thumb for English is 1 token ≈ 4 characters ≈ ¾ of a word, so 100 tokens is about 75 words. Google says the same for Gemini: about 4 characters per token, and 100 tokens is 60 to 80 words. Other languages and code usually take more tokens per word.</p></section>
<section><h2>The four kinds of token you pay for</h2><ul class="rows"><li><span class="t">Input tokens</span><span class="m">Everything you send: the prompt, the chat history, any documents. Also called prompt tokens.</span></li><li><span class="t">Output tokens</span><span class="m">What the model writes back. Usually priced 3 to 8 times higher than input.</span></li><li><span class="t">Cached input tokens</span><span class="m">Input the provider has seen recently and reuses, charged at a much lower rate. See <a href="../prompt-caching/">prompt caching</a>.</span></li><li><span class="t">Reasoning tokens</span><span class="m">The hidden thinking of reasoning models. You don't see them, but they are billed as output.</span></li></ul><p class="asof">From OpenAI's and Google's token guides, checked ${CHECKED}.</p></section>
<section><h2>How many tokens is my text, and what does it cost?</h2><p>Using ¾ of a word per token, priced on ${esc(short(claudeM))} (${usd(claudeM.in)} per million input tokens) and ${esc(cheapAny.name)} (${usd(cheapAny.in)}), the cheapest model today:</p><div class="tablewrap"><table><thead><tr><th>Text</th><th>About</th><th>To send on ${esc(short(claudeM))}</th><th>On ${esc(short(cheapAny))}</th></tr></thead><tbody>${words.map(([n, w]) => { const t = Math.round(w / 0.75); return `<tr><th scope="row">${esc(n)}</th><td class="num">${t.toLocaleString("en-GB")} tokens</td><td class="num">${money(t * claudeM.in / 1e6)}</td><td class="num">${money(t * cheapAny.in / 1e6)}</td></tr>`; }).join("")}</tbody></table></div>
<p><label>Paste text to estimate its tokens: <textarea id="tt" rows="4" style="width:100%;font:inherit"></textarea></label><span id="tto" class="m" aria-live="polite"></span></p>
<script>(()=>{const t=document.getElementById("tt"),o=document.getElementById("tto");t.addEventListener("input",()=>{const c=t.value.length,w=(t.value.match(/\\S+/g)||[]).length;o.textContent=c?"≈ "+Math.round(c/4).toLocaleString("en-GB")+" tokens ("+w.toLocaleString("en-GB")+" words, "+c.toLocaleString("en-GB")+" characters). A rough guide: the exact count depends on the model.":""})})();</script></section>
<section><h2>Tokens and the context window</h2><p>A model's context window is the most tokens it can handle in one request, input and output together. The biggest windows on OpenRouter today reach ${ctxS(Math.max(...main.map(m => m.ctx || 0)))} tokens, about ${Math.round(Math.max(...main.map(m => m.ctx || 0)) * 0.75 / 1000).toLocaleString("en-GB")} thousand words. Filling it is possible, but you pay for every token each time you send it.</p></section>
<section><h2>Count tokens exactly</h2><p>For an exact count, use the provider's own tools: OpenAI's Tokenizer page and its <code>tiktoken</code> library, OpenAI's free input-token counting endpoint, or Anthropic's token counting API. Every API response also reports the tokens it used.</p></section>`,
    qa: [["What is a token in AI?", "A small piece of text, about four characters or three quarters of an English word, that a language model reads or writes. APIs charge per token."],
      ["How many words is 1,000 tokens?", "About 750 English words, using OpenAI's rule of thumb that a token is three quarters of a word."],
      ["How many tokens per word?", "About 1.3 tokens per English word on average. Rare words, other languages and code take more."],
      ["Why do output tokens cost more?", "The model has to generate output one token at a time, which takes more computing than reading input, so providers price it higher."],
      ["Do spaces count as tokens?", "Spaces are usually joined to the next word, so \" red\" and \"red\" can be different tokens. They still affect the count."]] });

  const KEYS = [
    ["Claude (Anthropic)", "https://platform.claude.com/", ["Sign up or sign in at the Claude Console (platform.claude.com).", "Open Settings > API keys (platform.claude.com/settings/keys) and create a key.", "Add credit under billing, then set it as ANTHROPIC_API_KEY in your terminal."], "claude"],
    ["OpenAI", "https://platform.openai.com/api-keys", ["Sign in at the OpenAI Platform and open the API keys page (platform.openai.com/api-keys).", "Create a key and store it somewhere safe; you won't see it again.", "Export it as OPENAI_API_KEY. Add credits to go beyond a first test request."], "openai"],
    ["Gemini (Google)", "https://aistudio.google.com/apikey", ["Sign in to Google AI Studio. New users get a project and key created automatically.", "Copy it from the API keys page, or click Create API key for a new one.", "Export it as GEMINI_API_KEY. The free tier works straight away; set up billing for higher limits."], "gemini"],
    ["Grok (SpaceXSI)", "https://console.x.ai", ["Sign up at console.x.ai and load credits.", "Create a key on the API Keys page.", "Export it as XAI_API_KEY. It works with the OpenAI SDK at https://api.x.ai/v1."], "grok"],
    ["DeepSeek", "https://platform.deepseek.com/api_keys", ["Sign up on the DeepSeek Platform and top up your balance.", "Create a key under API keys.", "Use it with the OpenAI SDK at https://api.deepseek.com, model deepseek-flash."], "deepseek"]
  ];
  guide("api-key", { title: "How to Get an API Key: Claude, OpenAI, Gemini, Grok", h1: "How to get an LLM API key",
    lede: "Step-by-step: how to get an API key from Claude, OpenAI, Gemini, Grok and DeepSeek, what each one costs to use, and how to keep the key safe. Every step is checked against the provider's own docs.",
    body: KEYS.map(([n, u, steps, slug]) => { const L = LABS.find(x => x.slug === slug), m = built.includes(L) ? labModels(L)[0] : null;
      return `<section><h2>How to get an API key from ${esc(n)}</h2><ol class="rows">${steps.map(s => `<li><span class="t">${esc(s)}</span></li>`).join("")}</ol><p><a href="${u}" rel="noopener">Open the ${esc(n)} key page</a>.${m ? ` Using it costs from ${usd(m.in)} per million input tokens on ${esc(short(m))}; see <a href="../../llm-api-pricing/${slug}/">${esc(L.brand)} API pricing</a>.` : ""}</p></section>`; }).join("\n") +
      `\n<section><h2>Want one key for every model?</h2><p>OpenRouter gives you one key that reaches models from all of these labs at the same prices, plus a 5.5% fee on credit purchases, and has free models too. See <a href="../../free-ai-models/free-llm-api-key/">how to get a free LLM API key</a> for the steps.</p></section>
<section><h2>Keep your key safe</h2><ul class="rows"><li><span class="t">Never put a key in a website or app people can download</span><span class="m">Anyone can read it and spend your credit. Call the API from your own server.</span></li><li><span class="t">Store it as an environment variable</span><span class="m">The official SDKs read OPENAI_API_KEY, ANTHROPIC_API_KEY and GEMINI_API_KEY automatically.</span></li><li><span class="t">Don't commit it to GitHub</span><span class="m">Leaked keys get found by bots within minutes. If one leaks, delete it and make a new one.</span></li><li><span class="t">Set a spend limit</span><span class="m">The Claude Console and other dashboards let you cap monthly spend.</span></li></ul><p class="asof">Steps checked against each provider's quickstart on ${CHECKED}.</p></section>`,
    qa: [["Is an API key free?", "Creating a key is free everywhere. Using it costs money per token, except on free tiers such as Gemini's or OpenRouter's free models."],
      ["How do I get a Claude API key?", "Sign in at platform.claude.com, open Settings > API keys, and create a key. Add credit to start making requests."],
      ["How do I get an OpenAI API key?", "Sign in at platform.openai.com, open the API keys page and create a key, then export it as OPENAI_API_KEY."],
      ["How do I get a Gemini API key?", "Sign in to Google AI Studio: new users get a key automatically on the API keys page, and the free tier works without billing."],
      ["Is a ChatGPT or Claude subscription the same as an API key?", "No. Subscriptions are for the chat apps; the API is billed separately per token through the developer console."]] });

  guide("python", { title: "How to Use an LLM API in Python: Claude, OpenAI, Gemini", h1: "How to use an LLM API in Python",
    lede: "Copy-paste Python to call Claude, OpenAI, Gemini, Grok and DeepSeek, taken from each provider's own quickstart, plus how to see what each call cost.",
    body: `<section><h2>Before you start</h2><p>You need Python 3, an API key (<a href="../api-key/">how to get one</a>) saved as an environment variable, and the provider's library. Each example sends one prompt and prints the answer.</p></section>
<section><h2>Claude (Anthropic)</h2>${pre("pip install anthropic")}${pre(`import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

message = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=1000,
    messages=[{"role": "user", "content": "Explain APIs in one sentence."}],
)

for block in message.content:
    if block.type == "text":
        print(block.text)
print(message.usage)  # input_tokens and output_tokens`)}</section>
<section><h2>OpenAI</h2>${pre("pip install openai")}${pre(`from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY

response = client.responses.create(
    model="gpt-6.2-astra",
    input="Explain APIs in one sentence.",
)

print(response.output_text)
print(response.usage)  # input_tokens, output_tokens, total_tokens`)}</section>
<section><h2>Gemini (Google)</h2>${pre("pip install -U google-genai")}${pre(`from google import genai

client = genai.Client()  # reads GEMINI_API_KEY

interaction = client.interactions.create(
    model="gemini-4-hydrogen",
    input="Explain APIs in one sentence.",
)
print(interaction.output_text)`)}</section>
<section><h2>Grok, DeepSeek and OpenRouter (OpenAI-compatible)</h2><p>These accept the OpenAI library: change <code>base_url</code>, the key and the model.</p>${pre(`from openai import OpenAI

client = OpenAI(
    api_key="<YOUR_XAI_API_KEY_HERE>",
    base_url="https://api.x.ai/v1",          # DeepSeek: https://api.deepseek.com
)

response = client.responses.create(
    model="grok-4.7",                          # DeepSeek: deepseek-flash
    input="Explain APIs in one sentence.",
)

print(response.output_text)`)}<p>OpenRouter uses <code>https://openrouter.ai/api/v1</code> with the Chat Completions format and model IDs like <code>${esc(cheapAny.id)}</code>.</p><p class="asof">Code from each provider's quickstart, checked ${CHECKED}. Model names change often; check the provider's model list if one stops working.</p></section>
<section><h2>What did that call cost?</h2><p>Every response reports its tokens. Multiply by the model's price per million: one call with 20 tokens in and 60 out on ${esc(short(claudeM))} costs ${money(cost(claudeM, 20, 60))}, and a busy app is just that times many requests. Try your own numbers in the <a href="../../llm-api-pricing/calculator/">LLM API cost calculator</a>.</p></section>
<section><h2>Common errors</h2><ul class="rows"><li><span class="t">401 / authentication error</span><span class="m">The key is missing or wrong. Check the environment variable name.</span></li><li><span class="t">429 / rate limit</span><span class="m">Too many requests, or no credit left. Wait and retry, or add credit.</span></li><li><span class="t">Model not found</span><span class="m">The model name has changed or retired. Copy a current ID from the provider's list.</span></li></ul></section>`,
    qa: [["How do I use an LLM API in Python?", "Install the provider's library (pip install anthropic, openai or google-genai), set your API key as an environment variable, create a client and call its create method with a model and your prompt."],
      ["Can I use the OpenAI library for other models?", "Yes, for providers with OpenAI-compatible APIs such as Grok, DeepSeek and OpenRouter: set base_url and use their key and model names."],
      ["How do I use an LLM API for free in Python?", "Use a free tier: a Gemini key from Google AI Studio, or OpenRouter's free models with the OpenAI library. See the free LLM API guide."],
      ["How do I see how many tokens a call used?", "Read the usage field on the response; it lists input and output tokens, which is what you're billed for."]] });

  const cacheRows = flag.map(([L, m]) => m).filter(m => m.cached != null && m.in > 0);
  guide("prompt-caching", { title: "Prompt Caching Explained: Claude, OpenAI, Gemini, Grok", h1: "Prompt caching explained",
    lede: "Prompt caching lets an LLM API reuse the start of a prompt it saw recently, so you pay up to 90% less for that part and get answers faster. Here is how it works at Claude, OpenAI, Gemini, Grok and DeepSeek, with today's cached prices.",
    body: `<section><h2>What prompt caching is</h2><p>Many requests start the same way: the same system prompt, the same document, the same codebase, then a new question at the end. With prompt caching, the provider keeps that shared beginning (the prefix) for a few minutes. When the next request starts with exactly the same text, the cached part is read back at a fraction of the normal input price, and the answer starts sooner.</p><p>Caching only works on an exact match from the very first token. Put things that never change first and things that change (the user's question, today's date) last.</p></section>
<section><h2>Cached prices today</h2><div class="tablewrap"><table><thead><tr><th>Model</th><th>Input / 1M</th><th>Cached input / 1M</th><th>Saving</th></tr></thead><tbody>${cacheRows.map(m => `<tr><th scope="row">${esc(m.name)}</th><td class="num">${usd(m.in)}</td><td class="num">${usd(m.cached)}</td><td class="num">${Math.round((1 - m.cached / m.in) * 100)}%</td></tr>`).join("")}</tbody></table></div><p class="asof">From OpenRouter's live price list, ${esc(when)}.</p></section>
<section><h2>How each provider does it</h2><ul class="rows"><li><span class="t">Claude (Anthropic)</span><span class="m">You mark what to cache with <code>cache_control</code>, or turn on automatic caching. The cache lasts 5 minutes by default and refreshes free each time it's used; a 1-hour cache is available. Writes cost 1.25× the input price (2× for 1 hour) and reads cost 0.1× on most models, with a few exceptions priced lower. The prefix must be at least 1,024 to 4,096 tokens, depending on the model.</span></li><li><span class="t">OpenAI</span><span class="m">Automatic. On GPT-5.6 and later the minimum is 1,024 tokens, writes cost 1.25× for the default 30-minute cache or 2.5× for 12 hours, and reads cost 0.1× (0.05× on GPT-6.2 Astra and Sol, GPT-6.1 Sol and Terra).</span></li><li><span class="t">Gemini (Google)</span><span class="m">Implicit caching is on by default for Gemini 2.5 and newer, and the saving is passed on automatically. Explicit caching is also available.</span></li><li><span class="t">Grok (SpaceXSI)</span><span class="m">Automatic. Sending the same <code>x-grok-conv-id</code> header with each request in a conversation raises the hit rate.</span></li><li><span class="t">DeepSeek</span><span class="m">Automatic, with a separate cache-hit price: $0.003 per million input tokens off-peak on deepseek-flash, against $0.15 for a miss.</span></li></ul><p class="asof">Checked against each provider's caching docs on ${CHECKED}.</p></section>
<section><h2>What it saves: a worked example</h2>${(() => { const m = claudeM; if (m.cached == null) return ""; const sys = 50000, q = 500, o = 500, n = 100; const no = n * cost(m, sys + q, o), yes = cost(m, sys * 1.25 + q, o) + (n - 1) * ((sys * m.cached + q * m.in + o * m.out) / 1e6); return `<p>A coding assistant sends the same 50,000-token codebase with 100 questions in a row (500 tokens each, 500-token answers) on ${esc(short(m))}. Without caching that costs ${money(no)}. With caching (one 1.25× write, then 99 cached reads) it costs about ${money(yes)}, ${Math.round((1 - yes / no) * 100)}% less.</p>`; })()}</section>`,
    qa: [["What is prompt caching?", "A discount for repeated prompt beginnings: the provider stores the start of your prompt for a few minutes and charges much less when the next request reuses it exactly."],
      ["How much does prompt caching save?", `Cache reads cost 10% of the normal input price or less at Anthropic and OpenAI. On ${short(claudeM)}, cached input is ${usd(claudeM.cached)} against ${usd(claudeM.in)} per million tokens.`],
      ["How long does a prompt cache last?", "Claude: 5 minutes by default, refreshed each use, or 1 hour at a higher write price. OpenAI: 30 minutes by default, or 12 hours. Check the provider's docs for others."],
      ["Do I have to turn prompt caching on?", "OpenAI, Gemini, Grok and DeepSeek cache automatically. Claude needs cache_control on the request, or automatic caching turned on."],
      ["What is the difference between prompt caching and KV caching?", "KV caching is the internal memory a model keeps while writing one answer. Prompt caching keeps that work between separate requests, so a repeated prefix doesn't have to be processed again."]] });

  {
    const pairs = built.map(L => { const ms = labModels(L); const big = ms[0], small = [...ms].sort((a, b) => blend(a) - blend(b))[0]; return [L, big, small]; }).filter(([, b, s]) => b !== s).slice(0, 5);
    const bt = flag.map(([, m]) => [m, batchOf(m)]).filter(([, b]) => b);
    guide("reduce-costs", { title: "How to Reduce LLM API Costs: 8 Ways, With Real Numbers", h1: "How to cut LLM API costs",
      lede: "Eight ways to pay less for Claude, OpenAI, Gemini and other LLM APIs, from picking a smaller model to batching and caching, each with today's real price difference so you can see what it's worth.",
      body: `<section id="smaller"><h2>1. Use the smallest model that does the job</h2><p>The gap inside one lab is huge. For 1,000 support replies:</p><div class="tablewrap"><table><thead><tr><th>Lab</th><th>Newest model</th><th>Cheapest model</th><th>Difference</th></tr></thead><tbody>${pairs.map(([L, b, s]) => `<tr><th scope="row">${esc(L.brand)}</th><td>${esc(short(b))}: ${money(cost(b, 2e6, 4e5))}</td><td>${esc(short(s))}: ${money(cost(s, 2e6, 4e5))}</td><td class="num">${(cost(b, 2e6, 4e5) / cost(s, 2e6, 4e5)).toFixed(0)}×</td></tr>`).join("")}</tbody></table></div><p>Try the small model first and move up only for the requests it gets wrong.</p></section>
<section id="batch"><h2>2. Batch anything that can wait</h2><p>Anthropic, OpenAI and Google all charge 50% for batch requests that return within 24 hours.${bt.length ? ` On OpenRouter today: ${bt.map(([m, b]) => `${esc(short(m))} ${usd(m.out)} → ${usd(b.out)} per million output tokens`).join("; ")}.` : ""}</p></section>
<section id="cache"><h2>3. Cache the parts you repeat</h2><p>Put your fixed instructions and documents at the start of every prompt so they can be cached; reads cost about 10% of the normal price. See <a href="../prompt-caching/">prompt caching explained</a> for the rules and a worked example.</p></section>
<section id="output"><h2>4. Cap and shorten the output</h2><p>Output costs ${(() => { const r = flag.map(([, m]) => m.out / m.in).filter(Boolean); return `${Math.min(...r).toFixed(0)} to ${Math.max(...r).toFixed(0)}`; })()} times more than input on the big labs' newest models. Ask for short answers, set <code>max_tokens</code> (or <code>max_output_tokens</code>), and remember reasoning models bill their hidden thinking as output.</p></section>
<section id="prompt"><h2>5. Send fewer input tokens</h2><p>Trim old chat history, summarise long threads, and send only the parts of a document that matter. Count before you send: OpenAI's input-token counting endpoint is free.</p></section>
<section id="offpeak"><h2>6. Use off-peak hours where they exist</h2><p>DeepSeek charges half price off-peak when you buy direct. Peak hours are 01:00 to 04:00 and 06:00 to 10:00 UTC on weekdays; everything else, including weekends, is off-peak.</p></section>
<section id="free"><h2>7. Use free tiers for testing</h2><p>Build and test on free models, then switch to paid for production. The <a href="../../free-ai-models/api/">free LLM API guide</a> lists what's free today, with limits.</p></section>
<section id="shop"><h2>8. Compare prices regularly</h2><p>New models often launch cheaper than the ones they replace. The <a href="../../llm-api-pricing/cheapest/">cheapest LLM API list</a> updates every 30 minutes; right now the cheapest is ${esc(cheapAny.name)} at ${usd(cheapAny.in)} in and ${usd(cheapAny.out)} out per million tokens.</p><p class="asof">Provider rules checked ${CHECKED}; prices from OpenRouter, ${esc(when)}.</p></section>`,
      qa: [["What is the easiest way to cut LLM API costs?", "Switch the requests that don't need the top model to a smaller one. Within one lab, the newest and cheapest models can differ in price by 10 times or more."],
        ["Does the batch API really halve the price?", "Yes, at Anthropic, OpenAI and Google: batch requests cost 50% of the normal price, in exchange for waiting up to 24 hours."],
        ["Is OpenRouter more expensive than going direct?", "Per token it's the same price, since OpenRouter passes provider prices through, but it adds a 5.5% fee (minimum $0.80) when you buy credits."],
        ["How do I estimate my monthly LLM API bill?", "Multiply your tokens per request by the price, then by requests per month. The LLM API cost calculator does it for any model."]] });
  }

  // Hub
  {
    const url = G, lede = "Everything you need before you pay for an LLM API: what it is, how tokens and prices work, how to get a key, your first Python call, and how to keep the bill small. Then compare live prices for every model.";
    const qa = [["Where should a beginner start with LLM APIs?", "Read what an LLM API is and how tokens work, get a key from one provider (Gemini has a free tier), then make a first call in Python."],
      ["How much does an LLM API cost?", `From fractions of a cent per request to a few cents. Today ${priceList}, per million tokens.`]];
    out["llm-api"] = page({ title: "LLM API Guide for Beginners: Keys, Tokens, Costs", description: clip(lede, 160), canonical: url, up: "../",
      body: `<section><div class="eyebrow">LLM API guide</div><h1>LLM API guide for beginners</h1><p class="lede">${esc(lede)}</p></section>
<section><h2>Learn the basics</h2><ul class="rows">${GUIDES.map(([s, n]) => `<li><span class="t"><a href="${s}/">${esc(n)}</a></span></li>`).join("")}</ul></section>
<section><h2>Compare prices</h2><ul class="rows"><li><span class="t"><a href="../llm-api-pricing/">LLM API pricing: every model</a></span><span class="m">${main.length} models, refreshed every 30 minutes</span></li><li><span class="t"><a href="../llm-api-pricing/cheapest/">Cheapest LLM API</a></span><span class="m">Now: ${esc(cheapAny.name)}, ${usd(cheapAny.in)} in / ${usd(cheapAny.out)} out</span></li><li><span class="t"><a href="../llm-api-pricing/calculator/">LLM API cost calculator</a></span></li>${built.map(L => `<li><span class="t"><a href="../llm-api-pricing/${L.slug}/">${esc(L.brand)} API pricing</a></span></li>`).join("")}${PAIRS.map(([a, b]) => `<li><span class="t"><a href="../llm-api-pricing/${a}-vs-${b}/">${esc(LABS.find(x => x.slug === a).brand)} vs ${esc(LABS.find(x => x.slug === b).brand)} API pricing</a></span></li>`).join("")}</ul></section>
<section><h2>Or start free</h2><p>The <a href="../free-ai-models/api/">free LLM API guide</a> lists free models and their limits.</p></section>
${faqHtml(qa)}`,
      ld: [faq(qa), breadcrumb([["Upcurrent", SITE], ["LLM API guide", url]])] });
  }

  // Links from the money page down into the cluster.
  const moneyLinks = `<section id="cluster"><h2>Pricing by lab, calculator and guides</h2><p>By lab: ${built.map(L => `<a href="${L.slug}/">${esc(L.brand)} API pricing</a>`).join(", ")}. Head to head: ${PAIRS.map(([a, b]) => `<a href="${a}-vs-${b}/">${esc(LABS.find(x => x.slug === a).brand)} vs ${esc(LABS.find(x => x.slug === b).brand)}</a>`).join(", ")}. Tools: the <a href="calculator/">LLM API cost calculator</a> and the <a href="cheapest/">cheapest LLM APIs</a>. New to this? Start with the <a href="../llm-api/">LLM API guide for beginners</a>.</p></section>`;
  return { pages: out, moneyLinks };
};
