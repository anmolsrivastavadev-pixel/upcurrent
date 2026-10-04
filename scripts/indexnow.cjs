// Tells Bing, Yandex, Seznam and Naver about new pages through IndexNow (free, no account).
// build-seo.cjs lists the new addresses; this runs after the publish so the pages are already live.
// The key is public on purpose: it only proves this site owns the key file next to the pages.
const fs = require("fs");
const path = require("path");

const SITE = "https://anmolsrivastavadev-pixel.github.io/upcurrent/";
const KEY = "32e13645f4000d6a81557a7f4db5e0b0";

(async () => {
  let urls = [];
  try { urls = fs.readFileSync(path.join(process.env.RUNNER_TEMP || ".", "new-urls.txt"), "utf8").split("\n").filter(Boolean); } catch {}
  if (!urls.length) return console.log("Nothing new to announce");
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}${KEY}.txt`, urlList: urls }),
    signal: AbortSignal.timeout(20000)
  });
  console.log(`IndexNow answered ${r.status} for ${urls.length} addresses:\n${urls.join("\n")}`);
})().catch(e => console.log("IndexNow skipped:", e.message));
