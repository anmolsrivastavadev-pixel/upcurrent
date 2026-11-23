// Facts about the GitHub repos that have a "What is X?" page: language, licence, forks, contributors,
// last push, live star count, and the install command from the project's own README.
// Saved to data/api/repo-facts.json, refreshed at most once every 20 hours per repo.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DAILY = path.join(ROOT, "data", "api", "daily");
const FILE = path.join(ROOT, "data", "api", "repo-facts.json");
const EXPLAIN_TOP = 5; // same rule as build-seo.cjs: repos that reached the top 5 rising on any day
const MAX_PER_RUN = 80;
const STALE_MS = 20 * 3600e3;

// Commands we are willing to show. Anything piped into a shell, or any other command, is left out:
// trending lists attract fake repos, and we would rather show nothing than a dangerous one-liner.
const OK_CMD = /^(pip3?|python3?|uvx?|pipx|poetry|conda|npm|npx|pnpm|yarn|bunx?|deno|cargo|rustup|go|brew|docker(-compose)?|git|cd|make|claude|gh|ollama|mkdir|export|cp)\b/;

function installSnippet(md, name) {
  const lines = md.split(/\r?\n/);
  const low = name.toLowerCase();
  const own = new RegExp("^" + low.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
  const safe = c => c.length <= 140 && !/\|\s*(ba|z)?sh\b|\bsudo\b|\.exe\b|\.bat\b|\.ps1\b|Invoke-|iex\b/i.test(c) && (c.startsWith("#") || OK_CMD.test(c) || own.test(c.toLowerCase()));
  const mentions = cmds => cmds.some(c => !c.startsWith("#") && c.toLowerCase().includes(low));
  for (let i = 0; i < lines.length; i++) {
    if (!/^#{1,4}\s.*\b(install(ation|ing)?|quick ?start|getting started|setup|set up)\b/i.test(lines[i])) continue;
    let end = i + 1;
    while (end < lines.length && end < i + 80 && !/^#{1,4}\s/.test(lines[end])) end++;
    for (let j = i + 1; j < end; j++) {
      if (/^\s*(```|~~~)/.test(lines[j])) {
        const block = [];
        let k = j + 1;
        for (; k < end && !/^\s*(```|~~~)/.test(lines[k]); k++) block.push(lines[k].trim().replace(/^\$\s+/, ""));
        const cmds = [];
        for (const c of block.filter(Boolean)) { if (!safe(c)) break; cmds.push(c); }
        while (cmds.length && cmds[cmds.length - 1].startsWith("#")) cmds.pop();
        if (cmds.length && cmds.length <= 6 && mentions(cmds)) return cmds.join("\n");
        j = k;
      } else {
        const spans = [...lines[j].matchAll(/`([^`\n]+)`/g)].map(m => m[1].trim()).filter(c => safe(c) && !c.startsWith("#"));
        const from = spans.findIndex(c => OK_CMD.test(c) && /\b(install|add|clone|i|run|x|pull)\b/.test(c));
        const use = from < 0 ? [] : spans.slice(from, from + 3);
        if (use.length && mentions(use)) return use.join("\n");
      }
    }
  }
  return null;
}

async function gh(url, token, accept) {
  const r = await fetch("https://api.github.com/" + url, { headers: { "User-Agent": "upcurrent-dashboard", Accept: accept || "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return r;
}

module.exports = async function refreshRepoFacts(token) {
  let facts = {};
  try { facts = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
  const repos = new Set();
  for (const f of fs.readdirSync(DAILY).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
    const d = JSON.parse(fs.readFileSync(path.join(DAILY, f), "utf8"));
    (d.rising || []).slice(0, EXPLAIN_TOP).forEach(r => { if (r.src === "gh" && r.owner && r.name) repos.add(`${r.owner}/${r.name}`); });
  }
  const now = Date.now();
  const todo = [...repos].filter(r => !facts[r] || now - Date.parse(facts[r].fetched) > STALE_MS)
    .sort((a, b) => (facts[a] ? Date.parse(facts[a].fetched) : 0) - (facts[b] ? Date.parse(facts[b].fetched) : 0)).slice(0, MAX_PER_RUN);
  let done = 0;
  for (const repo of todo) {
    try {
      const r = await gh(`repos/${repo}`, token);
      if (r.status === 404 || r.status === 451) { facts[repo] = { gone: true, fetched: new Date().toISOString() }; done++; continue; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const f = { stars: j.stargazers_count, forks: j.forks_count, lang: j.language || null, license: j.license && j.license.spdx_id !== "NOASSERTION" ? j.license.spdx_id : null,
        pushed: j.pushed_at, archived: !!j.archived, homepage: j.homepage || null, fetched: new Date().toISOString() };
      const c = await gh(`repos/${repo}/contributors?per_page=1&anon=1`, token);
      if (c.ok) { const last = (c.headers.get("link") || "").match(/[?&]page=(\d+)>;\s*rel="last"/); f.contributors = last ? +last[1] : (await c.json()).length; }
      const m = await gh(`repos/${repo}/readme`, token, "application/vnd.github.raw");
      if (m.ok) f.install = installSnippet(await m.text(), repo.split("/")[1]);
      facts[repo] = f;
      done++;
    } catch (e) { console.error(`Repo facts for ${repo}: ${e.message}`); }
  }
  fs.writeFileSync(FILE, JSON.stringify(facts));
  console.log(`Repo facts: refreshed ${done} of ${repos.size} explained repos`);
};
module.exports.installSnippet = installSnippet;
