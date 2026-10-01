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
  // Never let an API key end up in an error message (errors are saved to the public data file).
  const redact = u => String(u).replace(/([?&](?:api-key|apikey|apiKey|key|token)=)[^&\s]+/gi, "$1REDACTED");
  const decode = t => t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");
  const stripHtml = t => decode(String(t || "").replace(/<[^>]+>/g, " "));
  // Minimal RSS / Atom reader: titles, links and dates only.
  function parseFeed(xml) {
    const tag = (c, n) => { const m = c.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)); return m ? decode(m[1]).trim() : ""; };
    return xml.split(/<item[\s>]|<entry[\s>]/).slice(1).map(c => {
      const href = (c.match(/<link[^>]*href="([^"]+)"/) || [])[1];
      return { t: stripHtml(tag(c, "title")).replace(/\s+/g, " ").trim(), url: href || tag(c, "link") || tag(c, "id"), at: new Date(tag(c, "pubDate") || tag(c, "published") || tag(c, "updated") || tag(c, "dc:date") || Date.now()).toISOString() };
    }).filter(i => i.t && i.url);
  }
  const AI_WORDS = /\b(AI|A\.I\.|LLMs?|GPT|ChatGPT|OpenAI|Anthropic|Claude|Gemini|DeepMind|Copilot|machine learning|neural|chatbot|artificial intelligence|Llama|Mistral|Nvidia|agents?)\b/i;
  const FEEDS = [
    ["OpenAI", "https://openai.com/news/rss.xml"],
    ["Google DeepMind", "https://deepmind.google/blog/rss.xml"],
    ["Google Research", "https://research.google/blog/rss/"],
    ["Hugging Face", "https://huggingface.co/blog/feed.xml"],
    ["Meta AI", "https://ai.meta.com/blog/rss/"],
    ["NVIDIA", "https://blogs.nvidia.com/feed/"]
  ];
  const oneLine = (t = "") => { t = t.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim(); return t.length > 160 ? t.slice(0, 157) + "…" : t; };
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
    async function getText(url) {
      const r = await fetch(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*", ...ua } });
      if (!r.ok) throw new Error(redact(url) + " → " + r.status);
      return r.text();
    }
    async function getJSON(url, headers = {}) {
      const r = await fetch(url, { headers: { Accept: "application/json", ...ua, ...headers } });
      if (!r.ok) {
        let why = "";
        try { const b = await r.json(); why = b?.message || b?.error?.message || b?.errors?.[0] || ""; } catch {}
        throw new Error(`${redact(url)} → ${r.status}${why ? " " + redact(String(why)).slice(0, 160) : ""}`);
      }
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
        // With a Reddit app (client id + secret) use the official OAuth API; otherwise the public JSON.
        const path = "/r/OpenAI+ClaudeAI+singularity+LocalLLaMA+MachineLearning/hot.json?limit=60&raw_json=1";
        let j;
        if (opts.redditId && opts.redditSecret) {
          const basic = typeof btoa === "function" ? btoa(`${opts.redditId}:${opts.redditSecret}`) : Buffer.from(`${opts.redditId}:${opts.redditSecret}`).toString("base64");
          const t = await fetch("https://www.reddit.com/api/v1/access_token", { method: "POST", headers: { ...ua, Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
          if (!t.ok) throw new Error("reddit token → " + t.status);
          const { access_token } = await t.json();
          j = await getJSON("https://oauth.reddit.com" + path, { Authorization: `Bearer ${access_token}` });
        } else {
          j = await getJSON("https://www.reddit.com" + path);
        }
        return j.data.children.map(c => c.data).filter(d => !d.stickied).map(d => ({ src: "r/" + d.subreddit, t: d.title, url: "https://www.reddit.com" + d.permalink, up: d.ups, com: d.num_comments, at: new Date(d.created_utc * 1000).toISOString() }));
      },
      async bluesky() {
        // Bluesky's public search API needs no key.
        const since = new Date(Date.now() - DAY).toISOString();
        const terms = ["LLM", "Claude", "OpenAI", "Gemini", "AI agents"];
        // With a Bluesky app password, search as that account; otherwise use the public endpoint.
        let host = "https://public.api.bsky.app", auth = {};
        if (opts.bskyHandle && opts.bskyPassword) {
          const r = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { ...ua, "Content-Type": "application/json" }, body: JSON.stringify({ identifier: opts.bskyHandle, password: opts.bskyPassword }) });
          if (!r.ok) throw new Error("bluesky login → " + r.status);
          host = "https://bsky.social"; auth = { Authorization: `Bearer ${(await r.json()).accessJwt}` };
        }
        const res = await Promise.allSettled(terms.map(t => getJSON(`${host}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(t)}&sort=top&lang=en&since=${since}&limit=25`, auth)));
        const ok = res.filter(x => x.status === "fulfilled");
        if (!ok.length) throw new Error(String(res[0]?.reason?.message || "bluesky unreachable"));
        const seen = new Map();
        ok.forEach(x => (x.value.posts || []).forEach(p => seen.set(p.uri, {
          src: "Bluesky", t: oneLine(p.record?.text), url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`,
          up: p.likeCount || 0, com: p.replyCount || 0, at: p.record?.createdAt || p.indexedAt
        })));
        return [...seen.values()].filter(p => p.t);
      },
      async x() {
        // X's API is paid; this only runs when an X_BEARER_TOKEN is configured.
        if (!opts.xToken) return null;
        const q = '(LLM OR "AI agent" OR Claude OR ChatGPT OR Gemini OR "open source model") -is:retweet -is:reply lang:en';
        const j = await getJSON(`https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&sort_order=relevancy&max_results=50&tweet.fields=public_metrics,created_at&expansions=author_id&user.fields=username`, { Authorization: `Bearer ${opts.xToken}` });
        const users = Object.fromEntries((j.includes?.users || []).map(u => [u.id, u.username]));
        return (j.data || []).map(t => ({
          src: "X", t: oneLine(t.text), url: `https://x.com/${users[t.author_id] || "i"}/status/${t.id}`,
          up: t.public_metrics?.like_count || 0, com: t.public_metrics?.reply_count || 0, at: t.created_at
        }));
      },
      async blogs() {
        // Official AI lab blogs. Each feed fails on its own without sinking the rest.
        const res = await Promise.allSettled(FEEDS.map(([name, url]) => getText(url).then(x => parseFeed(x).slice(0, 8).map(i => ({ ...i, src: name, kind: "Lab blog" })))));
        const ok = res.filter(r => r.status === "fulfilled").flatMap(r => r.value);
        if (!ok.length) throw new Error("no lab blog feed answered");
        return ok;
      },
      async techmeme() {
        return parseFeed(await getText("https://www.techmeme.com/feed.xml")).filter(i => AI_WORDS.test(i.t)).map(i => ({ ...i, t: i.t.replace(/\s*\([^)]*\)\s*$/, ""), src: "Techmeme", kind: "News" }));
      },
      async lobsters() {
        const j = await getJSON("https://lobste.rs/t/ai.json");
        return j.map(x => ({ src: "Lobsters", t: x.title, url: x.comments_url || x.short_id_url, up: x.score || 0, com: x.comment_count || 0, at: x.created_at }));
      },
      async dev() {
        const j = await getJSON("https://dev.to/api/articles?tag=ai&top=2&per_page=30");
        return j.map(x => ({ src: "DEV", t: x.title, url: x.url, up: x.positive_reactions_count || 0, com: x.comments_count || 0, at: x.published_at }));
      },
      async mastodon() {
        const tags = ["llm", "ai", "generativeai"];
        const res = await Promise.allSettled(tags.map(t => getJSON(`https://mastodon.social/api/v1/timelines/tag/${t}?limit=40`)));
        const ok = res.filter(r => r.status === "fulfilled").flatMap(r => r.value);
        if (!ok.length) throw new Error("mastodon unreachable");
        const seen = new Map();
        ok.filter(x => !x.reblog && (x.favourites_count || 0) >= 3).forEach(x => seen.set(x.url, { src: "Mastodon", t: oneLine(stripHtml(x.content)), url: x.url, up: x.favourites_count || 0, com: x.replies_count || 0, at: x.created_at }));
        return [...seen.values()].filter(x => x.t);
      },
      async arxiv() {
        const x = await getText("https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=25");
        return parseFeed(x).filter(i => /arxiv\.org\/abs/.test(i.url)).map(i => ({ ...i, src: "arXiv" }));
      },
      async guardian() {
        if (!opts.keys?.guardian) return null;
        const j = await getJSON(`https://content.guardianapis.com/search?tag=technology/artificialintelligenceai&order-by=newest&page-size=20&api-key=${opts.keys.guardian}`);
        return j.response.results.map(r => ({ t: r.webTitle, url: r.webUrl, at: r.webPublicationDate, src: "The Guardian", kind: "News" }));
      },
      async gnews() {
        if (!opts.keys?.gnews) return null;
        const j = await getJSON(`https://gnews.io/api/v4/search?q=%22artificial%20intelligence%22%20OR%20OpenAI%20OR%20LLM&lang=en&max=20&sortby=publishedAt&apikey=${opts.keys.gnews}`);
        return j.articles.map(a => ({ t: a.title, url: a.url, at: a.publishedAt, src: a.source?.name || "GNews", kind: "News" }));
      },
      async newsapi() {
        if (!opts.keys?.newsapi) return null;
        const j = await getJSON("https://newsapi.org/v2/everything?q=%22artificial%20intelligence%22%20OR%20OpenAI%20OR%20LLM&language=en&sortBy=publishedAt&pageSize=20", { "X-Api-Key": opts.keys.newsapi, "User-Agent": "Upcurrent/1.0 (+https://anmolsrivastavadev-pixel.github.io/upcurrent/)" });
        return j.articles.filter(a => a.title && a.title !== "[Removed]").map(a => ({ t: a.title, url: a.url, at: a.publishedAt, src: a.source?.name || "NewsAPI", kind: "News" }));
      },
      async youtube() {
        if (!opts.keys?.youtube) return null;
        const after = new Date(Date.now() - 3 * DAY).toISOString();
        const j = await getJSON(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&q=AI%20news%7CLLM%7COpenAI%7CClaude&relevanceLanguage=en&publishedAfter=${after}&maxResults=15&key=${opts.keys.youtube}`);
        return j.items.map(v => ({ t: decode(v.snippet.title), url: `https://www.youtube.com/watch?v=${v.id.videoId}`, at: v.snippet.publishedAt, src: v.snippet.channelTitle, kind: "Video" }));
      },
      async producthunt() {
        if (!opts.keys?.producthunt) return null;
        const after = new Date(Date.now() - 2 * DAY).toISOString();
        const query = `{ posts(order: VOTES, topic: "artificial-intelligence", postedAfter: "${after}", first: 20) { edges { node { name tagline votesCount commentsCount url createdAt } } } }`;
        const r = await fetch("https://api.producthunt.com/v2/api/graphql", { method: "POST", headers: { ...ua, "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${opts.keys.producthunt}` }, body: JSON.stringify({ query }) });
        if (!r.ok) throw new Error("producthunt → " + r.status);
        return ((await r.json()).data?.posts?.edges || []).map(e => e.node).map(n => ({ name: n.name, tagline: n.tagline, votes: n.votesCount, comments: n.commentsCount, url: n.url, at: n.createdAt }));
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
  const SOURCE_NAMES = ["github", "hfModels", "hfPapers", "arxiv", "producthunt", "hn", "reddit", "bluesky", "x", "lobsters", "dev", "mastodon", "blogs", "techmeme", "guardian", "gnews", "newsapi", "youtube", "openrouter", "zen"];
  // Sources that only run when their key is configured.
  const KEYED = { x: o => o.xToken, guardian: o => o.keys?.guardian, gnews: o => o.keys?.gnews, newsapi: o => o.keys?.newsapi, youtube: o => o.keys?.youtube, producthunt: o => o.keys?.producthunt };

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
    raw.off = Object.keys(KEYED).filter(n => !KEYED[n](opts));
    raw.off.forEach(n => delete errors[n]);
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
    const off = raw.off || (raw.xOff ? ["x"] : []);
    const counted = SOURCE_NAMES.filter(n => !off.includes(n) || raw[n]);
    const live = counted.filter(n => raw[n]).length;
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

    const ph = raw.producthunt || [];
    const phPct = pctRank(ph.map(p => p.votes));
    ph.forEach(p => items.push({ name: p.name, owner: "Product Hunt", src: "ph", url: p.url, cat: category(p.name + " " + p.tagline), score: Math.min(95, Math.round(45 + 40 * phPct(p.votes))), grow: null, desc: p.tagline, meta: [`▲ ${comma(p.votes)} votes`, `${p.comments} comments`, `Launched ${ago(p.at, now)}`], at: p.at }));

    const S = fallback;
    const rising = items.length ? items.sort((a, b) => b.score - a.score).slice(0, 10) : S.rising;
    const activity = items.length ? items.reduce((a, it) => (a[it.cat] = (a[it.cat] || 0) + 1, a), {}) : S.activity;

    const disc = [...(raw.reddit || []), ...(raw.hn || []), ...(raw.bluesky || []), ...(raw.x || []), ...(raw.lobsters || []), ...(raw.dev || []), ...(raw.mastodon || [])].map(d => ({ ...d, vel: d.up / Math.max(1, (now - Date.parse(d.at)) / 36e5) }));
    const discussions = disc.length ? disc.sort((a, b) => b.vel - a.vel).slice(0, 6) : S.discussions;

    const free = [...(raw.zen || []), ...(raw.openrouter || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const freeCounts = { zen: raw.zen ? raw.zen.length : S.freeCounts.zen, or: raw.openrouter ? raw.openrouter.length : S.freeCounts.or };
    const freeRows = raw.zen && raw.openrouter ? free : free.length ? [...free, ...S.free.filter(f => !(raw.zen && f.prov === "OpenCode Zen") && !(raw.openrouter && f.prov === "OpenRouter"))].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : S.free;

    const seenT = new Set();
    const headlines = [...(raw.blogs || []), ...(raw.techmeme || []), ...(raw.guardian || []), ...(raw.gnews || []), ...(raw.newsapi || []), ...(raw.youtube || [])]
      .filter(h => now - Date.parse(h.at) < 7 * DAY)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .filter(h => { const k = h.t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60); if (seenT.has(k)) return false; seenT.add(k); return true; })
      .slice(0, 16);

    const newToday = [
      ...(raw.arxiv || []).slice(0, 4).map(a => ({ at: a.at, t: `New on arXiv: ${a.t}`, url: a.url })),
      ...(raw.blogs || []).map(b => ({ at: b.at, t: `${b.src}: ${b.t}`, url: b.url })),
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
      updated: fetchedAt, generated: fetchedAt, live, total: counted.length, isSnapshot: false,
      pulse, brief: brief.length ? brief : S.brief, freeCounts, rising, activity,
      models: models.length ? models.slice(0, 6) : S.models, github, discussions, newToday: newToday.length ? newToday : S.newToday,
      free: freeRows, headlines
    };
  }

  // Fetch one source by name, e.g. fetchOne("reddit"). Returns null if it fails or is empty.
  async function fetchOne(name, opts = {}) {
    try { const v = await makeSources(opts)[name](); return v?.length ? v : null; } catch { return null; }
  }

  root.UpcurrentCore = { fetchAll, fetchOne, parseFeed, build, updateHistory, SOURCE_NAMES, fmt, comma, ago };
  if (typeof module !== "undefined" && module.exports) module.exports = root.UpcurrentCore;
})(typeof globalThis !== "undefined" ? globalThis : this);
