// Upcurrent data core. Shared by the page (browser) and scripts/update-data.cjs (Node 18+).
// fetchAll() pulls the 7 public sources; build() turns raw source data into what the page renders.
(function (root) {
  const DAY = 864e5;
  const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
  const fmt = n => n == null ? "—" : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K" : String(Math.round(n));
  const comma = n => Math.round(n).toLocaleString("en-US");
  const ago = (iso, now = Date.now()) => {
    const m = (now - Date.parse(iso)) / 6e4;
    if (m < 60) return `${Math.max(1, Math.round(m))} min ago`;
    if (m < 1440) return `${Math.round(m / 60)}h ago`;
    return `${Math.round(m / 1440)} days ago`;
  };

  /* ---------- sources ---------- */
  function caps(mods = [], params = []) {
    const m = (mods || []).filter(x => x !== "text");
    const out = m.length ? [m.join("/")] : [];
    if ((params || []).some(p => /reason/.test(p))) out.push("reasoning");
    if ((params || []).some(p => /tool/.test(p))) out.push("tools");
    return out;
  }

  function makeSources(opts = {}) {
    const ghHeaders = { Accept: "application/vnd.github+json", ...(opts.githubToken ? { Authorization: `Bearer ${opts.githubToken}` } : {}) };
    const ua = opts.userAgent ? { "User-Agent": opts.userAgent } : {};
    async function getJSON(url, headers = {}) {
      const r = await fetch(url, { headers: { Accept: "application/json", ...ua, ...headers } });
      if (!r.ok) throw new Error(url + " → " + r.status);
      return r.json();
    }
    return {
      async github() {
        const since = isoDay(Date.now() - 30 * DAY);
        const q = `llm OR agent OR ai OR claude OR mcp OR gpt created:>${since} stars:>100`;
        const j = await getJSON(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=60`, ghHeaders);
        return j.items.map(x => ({ repo: x.full_name, owner: x.owner.login, name: x.name, desc: x.description || "", stars: x.stargazers_count, forks: x.forks_count, created: x.created_at, topics: x.topics || [], lang: x.language }));
      },
      async hfModels() {
        const j = await getJSON("https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=40");
        return j.map(x => ({ id: x.id || x.modelId, likes: x.likes || 0, downloads: x.downloads || 0, trending: x.trendingScore || 0, task: x.pipeline_tag || "", tags: x.tags || [], created: x.createdAt }));
      },
      async hfPapers() {
        const j = await getJSON("https://huggingface.co/api/daily_papers?limit=20");
        return j.map(x => ({ id: x.paper?.id, title: x.paper?.title || x.title, summary: x.paper?.summary || "", upvotes: x.paper?.upvotes ?? 0, at: x.publishedAt || x.paper?.publishedAt }));
      },
      async hn() {
        const since = Math.floor((Date.now() - DAY) / 1000);
        const terms = ["AI", "LLM", "GPT", "Claude", "Gemini", "OpenAI"];
        const res = await Promise.allSettled(terms.map(t => getJSON(`https://hn.algolia.com/api/v1/search?query=${t}&tags=story&numericFilters=created_at_i>${since},points>20&hitsPerPage=20`)));
        const ok = res.filter(x => x.status === "fulfilled");
        if (!ok.length) throw new Error("hn unreachable");
        const seen = new Map();
        ok.forEach(x => x.value.hits.forEach(h => seen.set(h.objectID, { src: "Hacker News", t: h.title, url: `https://news.ycombinator.com/item?id=${h.objectID}`, up: h.points, com: h.num_comments || 0, at: new Date(h.created_at_i * 1000).toISOString() })));
        return [...seen.values()];
      },
      async reddit() {
        const j = await getJSON("https://www.reddit.com/r/OpenAI+ClaudeAI+singularity+LocalLLaMA+MachineLearning/hot.json?limit=60&raw_json=1");
        return j.data.children.map(c => c.data).filter(d => !d.stickied).map(d => ({ src: "r/" + d.subreddit, t: d.title, url: "https://www.reddit.com" + d.permalink, up: d.ups, com: d.num_comments, at: new Date(d.created_utc * 1000).toISOString() }));
      },
      async openrouter() {
        const j = await getJSON("https://openrouter.ai/api/v1/models");
        return j.data.filter(m => m.id.endsWith(":free") || (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0 && !m.id.startsWith("openrouter/auto")))
          .map(m => ({ name: m.name.replace(/\s*\(free\)\s*$/i, "").replace(/^[^:]+:\s*/, ""), prov: "OpenRouter", ctx: m.context_length, at: new Date((m.created || 0) * 1000).toISOString(), url: `https://openrouter.ai/${m.id}`, caps: caps(m.architecture?.input_modalities, m.supported_parameters) }));
      },
      async zen() {
        const j = await getJSON("https://opencode.ai/zen/v1/models");
        return (j.data || j).filter(m => /free/i.test(m.id) || Number(m.pricing?.prompt ?? m.cost?.input ?? 1) === 0)
          .map(m => ({ name: m.name || m.id.replace(/-free$/i, ""), prov: "OpenCode Zen", ctx: m.context_length || m.limit?.context || null, at: new Date((m.created || 0) * 1000).toISOString(), caps: caps(m.modalities?.input || m.architecture?.input_modalities, m.supported_parameters || [m.reasoning && "reasoning", m.tool_call && "tools"].filter(Boolean)) }));
      },
      async contributors(repos) {
        const c = await Promise.allSettled(repos.map(repo => fetch(`https://api.github.com/repos/${repo}/contributors?per_page=1&anon=1`, { headers: { ...ua, ...ghHeaders } })
          .then(r => { const m = (r.headers.get("link") || "").match(/[?&]page=(\d+)>; rel="last"/); return r.ok ? (m ? +m[1] : 1) : null; })));
        return Object.fromEntries(repos.map((repo, i) => [repo, c[i].status === "fulfilled" ? c[i].value : null]));
      }
    };
  }
  const SOURCE_NAMES = ["github", "hfModels", "hfPapers", "hn", "reddit", "openrouter", "zen"];

  // Returns { raw, errors }. A source that fails or returns nothing is null in raw.
  async function fetchAll(opts = {}) {
    const S = makeSources(opts);
    const settled = await Promise.allSettled(SOURCE_NAMES.map(n => S[n]()));
    const raw = {}, errors = {};
    SOURCE_NAMES.forEach((n, i) => {
      const s = settled[i];
      raw[n] = s.status === "fulfilled" && s.value?.length ? s.value : null;
      if (!raw[n]) errors[n] = s.status === "rejected" ? String(s.reason?.message || s.reason) : "empty response";
    });
    if (raw.github) raw.contrib = await S.contributors(raw.github.slice(0, 12).map(g => g.repo));
    return { raw, errors };
  }

  /* ---------- history: earlier readings, for real growth numbers ---------- */
  function updateHistory(hist = {}, raw, now = Date.now()) {
    hist = { ...hist };
    const put = (k, v) => { const p = hist[k]; if (!p || now - p.ts > 20 * 36e5) hist[k] = { v, ts: now }; };
    (raw.github || []).forEach(g => put("gh:" + g.repo, g.stars));
    (raw.hfModels || []).forEach(m => put("hf:" + m.id, m.downloads));
    for (const k in hist) if (now - hist[k].ts > 7 * DAY) delete hist[k];
    return hist;
  }

  /* ---------- turning raw sources into the dashboard ---------- */
  function category(text, task = "") {
    const t = (text + " " + task).toLowerCase();
    if (/robot|embodied|humanoid/.test(t)) return "Robotics";
    if (/\bagent|mcp\b|claude code|codex|autonomous|multi-agent|skills?\b/.test(t)) return "Agents";
    if (/coder|coding|\bcode\b|ide\b|copilot|programming/.test(t)) return "Coding";
    if (/inference|serving|vllm|llama\.cpp|kernel|gpu|cuda|runtime|deploy|quantiz/.test(t)) return "Infrastructure";
    if (/vision|image|video|diffusion|segment|detection|ocr|text-to-image|image-to|3d|visual/.test(t)) return "Vision";
    if (/llm|language model|gguf|instruct|chat|text-generation|reasoning|\bgpt\b|qwen|llama|mistral/.test(t)) return "LLMs";
    return "Tools";
  }
  const pctRank = arr => { const s = [...arr].sort((a, b) => a - b); return v => arr.length < 2 ? 1 : s.indexOf(v) / (s.length - 1); };
  const license = tags => { const l = (tags.find(t => t.startsWith("license:")) || "").slice(8); return !l ? "Open weights" : /apache|mit|bsd|gpl|cc-by|openrail|mpl/.test(l) ? "Open source" : "Open weights"; };

  // fallback: the snapshot sections to use for any source that did not answer
  function build(raw, { win = "24h", hist = {}, now = Date.now(), fetchedAt = new Date(now).toISOString(), fallback }) {
    const prev = id => hist[id];
    const winDays = win === "7d" ? 7 : win === "30d" ? 30 : 1;
    const live = SOURCE_NAMES.filter(n => raw[n]).length;
    const items = [];

    const gh = raw.github || [];
    const ghVel = gh.map(g => g.stars / Math.max(0.5, (now - Date.parse(g.created)) / DAY));
    const ghPct = pctRank(ghVel);
    const ghRows = gh.map((g, i) => {
      const age = (now - Date.parse(g.created)) / DAY;
      const p = prev("gh:" + g.repo);
      const hrs = p ? (now - p.ts) / 36e5 : 0;
      const d24 = p && hrs >= 6 ? Math.round((g.stars - p.v) * 24 / hrs) : Math.round(ghVel[i]);
      const grow = p && hrs >= 6 && p.v > 0 ? Math.round((g.stars - p.v) / p.v * 100 * Math.min(1, 24 / hrs)) : null;
      const score = Math.min(99, Math.round(45 + 45 * ghPct(ghVel[i]) + Math.max(0, 9 - age)));
      return { ...g, d24, est: !(p && hrs >= 6), grow, score, age, cat: category(g.desc + " " + g.topics.join(" ") + " " + g.name) };
    }).filter(g => win !== "24h" || g.age <= 7);
    ghRows.forEach(g => items.push({ name: g.name, owner: g.owner, src: "gh", cat: g.cat, score: g.score, grow: g.grow, desc: g.desc, meta: [`★ ${comma(g.stars)}`, `${g.est ? "~" : "+"}${comma(g.d24)} in 24h`, `Created ${ago(g.created, now)}`], at: g.created }));

    const hf = (raw.hfModels || []).filter(m => (now - Date.parse(m.created)) / DAY <= Math.max(winDays, 30) * 2);
    const hfPct = pctRank(hf.map(m => m.trending));
    const models = hf.map(m => {
      const [org, ...rest] = m.id.split("/"); const name = rest.join("/") || org;
      const p = prev("hf:" + m.id); const hrs = p ? (now - p.ts) / 36e5 : 0;
      const grow = p && hrs >= 6 && p.v > 0 ? Math.round((m.downloads - p.v) / p.v * 100) : null;
      const age = (now - Date.parse(m.created)) / DAY;
      const size = (m.id.match(/(\d+(?:\.\d+)?[BM])\b/i) || [])[1];
      return { name, org, size, lic: license(m.tags), at: m.created, dl: m.downloads, grow, score: Math.min(99, Math.round(45 + 45 * hfPct(m.trending) + Math.max(0, 9 - age))), cat: category(name + " " + m.tags.join(" "), m.task), likes: m.likes };
    }).sort((a, b) => b.score - a.score);
    models.forEach(m => items.push({ name: m.name, owner: m.org, src: "hf", cat: m.cat, score: m.score, grow: m.grow, desc: `${m.cat === "Vision" ? "Vision" : "Model"} on Hugging Face · ${m.lic.toLowerCase()} · ♥ ${fmt(m.likes)}`, meta: [`${fmt(m.dl)} downloads`, `Released ${ago(m.at, now)}`], at: m.at }));

    const papers = raw.hfPapers || [];
    const ppPct = pctRank(papers.map(p => p.upvotes));
    papers.forEach(p => items.push({ name: p.title, owner: "Paper", src: "paper", url: `https://huggingface.co/papers/${p.id}`, cat: "Research", score: Math.min(95, Math.round(45 + 40 * ppPct(p.upvotes))), grow: null, desc: p.summary.split(/(?<=\.)\s/)[0] || "", meta: [`▲ ${p.upvotes} upvotes`, "Hugging Face Papers"], at: p.at }));

    const S = fallback;
    const rising = items.length ? items.sort((a, b) => b.score - a.score).slice(0, 10) : S.rising;
    const activity = items.length ? items.reduce((a, it) => (a[it.cat] = (a[it.cat] || 0) + 1, a), {}) : S.activity;

    const disc = [...(raw.reddit || []), ...(raw.hn || [])].map(d => ({ ...d, vel: d.up / Math.max(1, (now - Date.parse(d.at)) / 36e5) }));
    const discussions = disc.length ? disc.sort((a, b) => b.vel - a.vel).slice(0, 6) : S.discussions;

    const free = [...(raw.zen || []), ...(raw.openrouter || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const freeCounts = { zen: raw.zen ? raw.zen.length : S.freeCounts.zen, or: raw.openrouter ? raw.openrouter.length : S.freeCounts.or };
    const freeRows = raw.zen && raw.openrouter ? free : free.length ? [...free, ...S.free.filter(f => !(raw.zen && f.prov === "OpenCode Zen") && !(raw.openrouter && f.prov === "OpenRouter"))].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : S.free;

    const newToday = [
      ...disc.filter(d => d.up > 300).map(d => ({ at: d.at, t: `${d.src}: ${d.t}`, url: d.url })),
      ...ghRows.filter(g => g.age <= 1).map(g => ({ at: g.created, t: `${g.repo} is new on GitHub`, url: `https://github.com/${g.repo}` })),
      ...ghRows.flatMap(g => { const p = prev("gh:" + g.repo); return [1e3, 5e3, 1e4, 5e4].filter(m => p && p.v < m && g.stars >= m).map(m => ({ at: fetchedAt, t: `${g.repo} passes ${fmt(m)} GitHub stars`, url: `https://github.com/${g.repo}` })); })
    ].filter(n => now - Date.parse(n.at) < DAY).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);

    const top = rising[0];
    const lead = Object.entries(rising.reduce((a, r) => (a[r.cat] = (a[r.cat] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1])[0];
    const newModels = models.filter(m => (now - Date.parse(m.at)) / DAY <= 7);
    const pulse = {
      trending: raw.github || raw.hfModels ? items.length : S.pulse.trending,
      accelerating: raw.github || raw.hfModels ? items.filter(i => (i.grow ?? 0) >= 100).length : S.pulse.accelerating,
      newModels: raw.hfModels ? newModels.length : S.pulse.newModels,
      discussions: disc.length ? disc.filter(d => now - Date.parse(d.at) < DAY).length : S.pulse.discussions,
      stars: raw.github ? ghRows.reduce((a, g) => a + g.d24, 0) : S.pulse.stars
    };
    const brief = [
      top && `Top mover: ${top.name}, score ${top.score}${top.grow != null ? `, up ${top.grow}% in a day` : ""}.`,
      lead && `${lead[0]} make up ${lead[1]} of the top ${rising.length}.`,
      raw.hfModels && `Hugging Face has ${newModels.length} trending models released this week, ${newModels.filter(m => m.lic === "Open source").length} of them open source.`,
      `You can call ${freeCounts.zen + freeCounts.or} models for free: ${freeCounts.zen} on OpenCode Zen and ${freeCounts.or} on OpenRouter.`
    ].filter(Boolean);

    const github = ghRows.length ? [...ghRows].sort((a, b) => b.d24 - a.d24).slice(0, 8).map(g => ({ repo: g.repo, stars: g.stars, d24: g.d24, est: g.est, forks: g.forks, contrib: (raw.contrib || {})[g.repo] ?? null, score: g.score })) : S.github;

    return {
      updated: fetchedAt, generated: fetchedAt, live, total: SOURCE_NAMES.length, isSnapshot: false,
      pulse, brief: brief.length ? brief : S.brief, freeCounts, rising, activity,
      models: models.length ? models.slice(0, 6) : S.models, github, discussions, newToday: newToday.length ? newToday : S.newToday,
      free: freeRows
    };
  }

  root.UpcurrentCore = { fetchAll, build, updateHistory, SOURCE_NAMES, fmt, comma, ago };
  if (typeof module !== "undefined" && module.exports) module.exports = root.UpcurrentCore;
})(typeof globalThis !== "undefined" ? globalThis : this);
