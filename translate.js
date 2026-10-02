// Shows the page in the visitor's own language, using Google's free website translator.
// English is the source and always available. The visitor's browser language is the default;
// a choice made in the language picker is remembered in this browser.
(function () {
  const KEY = "uc-lang";
  const LANGS = [
    ["en", "English"], ["ar", "العربية"], ["bn", "বাংলা"], ["zh-CN", "中文 (简体)"], ["zh-TW", "中文 (繁體)"],
    ["cs", "Čeština"], ["da", "Dansk"], ["nl", "Nederlands"], ["fil", "Filipino"], ["fi", "Suomi"],
    ["fr", "Français"], ["de", "Deutsch"], ["el", "Ελληνικά"], ["iw", "עברית"], ["hi", "हिन्दी"],
    ["hu", "Magyar"], ["id", "Bahasa Indonesia"], ["it", "Italiano"], ["ja", "日本語"], ["ko", "한국어"],
    ["ms", "Bahasa Melayu"], ["no", "Norsk"], ["fa", "فارسی"], ["pl", "Polski"], ["pt", "Português"],
    ["pa", "ਪੰਜਾਬੀ"], ["ro", "Română"], ["ru", "Русский"], ["es", "Español"], ["sw", "Kiswahili"],
    ["sv", "Svenska"], ["ta", "தமிழ்"], ["te", "తెలుగు"], ["th", "ไทย"], ["tr", "Türkçe"],
    ["uk", "Українська"], ["ur", "اردو"], ["vi", "Tiếng Việt"],
  ];
  const codes = LANGS.map(l => l[0]);

  // Browser language -> Google's code ("nl-BE" -> "nl", "zh-HK" -> "zh-TW", "he" -> "iw").
  const fromBrowser = () => {
    for (const raw of navigator.languages || [navigator.language || "en"]) {
      const l = String(raw).toLowerCase(), base = l.split("-")[0];
      if (base === "zh") return /tw|hk|mo|hant/.test(l) ? "zh-TW" : "zh-CN";
      if (base === "he") return "iw";
      if (base === "nb" || base === "nn") return "no";
      if (base === "tl") return "fil";
      if (codes.includes(base)) return base;
    }
    return "en";
  };
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  const lang = codes.includes(saved) ? saved : fromBrowser();

  // Google's translator reads this cookie to decide the target language.
  const setCookie = to => {
    const host = location.hostname;
    const kill = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = kill; document.cookie = `${kill}; domain=${host}`; document.cookie = `${kill}; domain=.${host}`;
    if (to !== "en") document.cookie = `googtrans=/en/${to}; path=/`;
  };
  setCookie(lang);

  // The picker, placed wherever the page has <span id="langPick">.
  const mount = () => {
    const slot = document.getElementById("langPick");
    if (!slot) return;
    slot.className = "lang-pick notranslate";
    slot.setAttribute("translate", "no");
    slot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>
      <select aria-label="Language">${LANGS.map(([c, n]) => `<option value="${c}"${c === lang ? " selected" : ""}>${n}</option>`).join("")}</select>`;
    slot.querySelector("select").addEventListener("change", e => {
      const to = e.target.value;
      try { localStorage.setItem(KEY, to); } catch {}
      setCookie(to);
      location.reload();
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  // Only load Google's script when the page needs translating.
  if (lang === "en") return;
  window.ucTranslateInit = () => {
    try { new google.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "gtHost"); } catch {}
  };
  const host = document.createElement("div");
  host.id = "gtHost"; host.hidden = true;
  (document.body || document.documentElement).appendChild(host);
  const s = document.createElement("script");
  s.src = "https://translate.google.com/translate_a/element.js?cb=ucTranslateInit";
  s.async = true;
  document.head.appendChild(s);
})();
