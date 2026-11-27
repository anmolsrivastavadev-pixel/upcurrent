import os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, "base")

def tokens(t):
    keys = dict(t)
    # derived defaults
    keys.setdefault("paper", keys["bg"]); keys.setdefault("sky", keys["bg"]); keys.setdefault("sky-2", keys["paper"])
    keys.setdefault("sky-ink", keys["ink"]); keys.setdefault("sky-muted", keys["muted"]); keys.setdefault("sky-line", keys["line"])
    keys.setdefault("faint", keys["muted"]); keys.setdefault("link", keys["ink"]); keys.setdefault("hot-text", keys["ink"])
    keys.setdefault("band", keys["ink"]); keys.setdefault("band-ink", keys["bg"])
    keys.setdefault("font-mono", keys["font-body"])
    body = "; ".join(f"--{k}: {v}" for k, v in keys.items())
    return f":root:root:root {{ {body}; }}\n"

# Each theme: name, font URL families, tokens, extra CSS (layout and details)
FB = "full-bleed"
def bleed(sel, bg):  # paint a full-width field behind an element
    return f"{sel} {{ position: relative; isolation: isolate; }} {sel}::before {{ content: \"\"; position: absolute; z-index: -1; top: 0; bottom: 0; left: 50%; width: 100vw; transform: translateX(-50%); background: {bg}; }}\n"

THEMES = [
 ("01-desk", "Trading desk", "Red+Hat+Text:wght@400;500;700&family=Red+Hat+Mono:wght@500;700",
  dict(bg="#0e0e0e", paper="#151515", chip="#222", line="#2a2a2a", ink="#ededed", muted="#a6a6a6",
       cool="#3a3a3a", warm="#8a6a1a", hot="#ffb000", up="#2fd07a", **{"up-text": "#3ddc84", "badge-up": "#14703f", "badge-hot": "#5a4400",
       "font-display": '"Red Hat Text", system-ui, sans-serif', "font-body": '"Red Hat Text", system-ui, sans-serif', "font-mono": '"Red Hat Mono", ui-monospace, monospace',
       "text-xl": "22px"}),
  """
body { font-size: 14px; }
.wrap { max-width: 1440px; }
.top { background: #000; } .logo { color: #ffb000; font-weight: 700; }
nav.main a { font-size: 13.5px; } nav.main a:hover { background: #222; color: #ffb000; }
.hero > div:first-child { padding-top: 20px; }
.hero h1 { font: 700 34px/1.15 var(--font-display); max-width: none; letter-spacing: 0; }
.hero h1 .mover { color: #ffb000; }
.brief { grid-template-columns: repeat(4, minmax(0, 1fr)); font-size: 13.5px; }
.brief li { font-size: 13.5px; }
.mini-row button { background: #ffb000; color: #000; }
.glance b { color: #ffb000; }
.row { padding-block: 10px; } .row .desc { display: none; }
.row h3, .row.lead h3 { font: 700 16px var(--font-mono); }
.rank { font-size: 16px; }
.heat .score { font-size: 16px; background: #222; color: #ffb000; }
.sec-head h2 { font: 700 18px var(--font-mono); }
.movers, .bo-list, .receipts, .hype, .models, .tbl, .threads, .timeline, .free, .news { border-top: 1px solid #ffb000; }
.signup { background: #ffb000; color: #000; } .signup button { background: #000; color: #ffb000; }
.updraft canvas { height: 160px; min-height: 0; flex: none; }
"""),
 ("02-orange-bar", "Orange bar", "Golos+Text:wght@400;500;700",
  dict(bg="#f6f6f6", paper="#ffffff", chip="#ebebeb", line="#dddddd", ink="#111", muted="#5f5f5f",
       cool="#d0d0d0", warm="#ffb27a", hot="#ff6600", up="#1a8a3c", **{"up-text": "#14782f",
       "font-display": '"Golos Text", Verdana, sans-serif', "font-body": '"Golos Text", Verdana, sans-serif', "text-xl": "20px"}),
  """
body { font-size: 14.5px; }
.wrap { max-width: 980px; }
.top { background: #ff6600; border: 0; } .top, .top a, nav.main a { color: #111; }
nav.main a:hover { background: rgba(0,0,0,.12); color: #000; }
.logo { font: 700 18px var(--font-display); }
.search input, .top .lang-pick select { background: #fff; border-color: #c25000; }
.hero > div:first-child { padding-top: 22px; }
.hero h1 { font: 700 28px/1.2 var(--font-display); letter-spacing: 0; max-width: none; }
.brief { grid-template-columns: 1fr 1fr; } .brief li { font-size: 14px; }
.mini-row button { background: #ff6600; color: #111; }
.sec-head h2 { font-size: 20px; }
.row { padding-block: 10px; grid-template-columns: 30px minmax(0,1fr) 110px; }
.rank { font-size: 15px; color: #828282; } .row.lead .rank { color: #ff6600; }
.row h3, .row.lead h3 { font-size: 16px; } .row .desc { font-size: 13.5px; }
.heat .score { font-size: 16px; }
.movers, .bo-list, .receipts, .hype, .models, .tbl, .threads, .timeline, .free, .news { border-top: 2px solid #ff6600; }
.chip[aria-pressed="true"], .seg button[aria-pressed="true"] { background: #ff6600; border-color: #ff6600; color: #111; }
.signup { background: #ff6600; color: #111; } .signup button { background: #111; color: #fff; }
.updraft canvas { height: 180px; min-height: 0; flex: none; }
"""),
 ("03-poster", "Pink poster", "Familjen+Grotesk:wght@400;500;700",
  dict(bg="#ffffff", chip="#f1f1f1", line="#e4e4e4", ink="#111", muted="#555",
       cool="#e0e0e0", warm="#ff9fcb", hot="#ff2e88", **{"up-text": "#0b7a3e",
       "font-display": '"Familjen Grotesk", system-ui, sans-serif', "font-body": '"Familjen Grotesk", system-ui, sans-serif', "text-xl": "clamp(32px,4vw,48px)"}),
  bleed(".hero > div:first-child", "#ff4fa3") + """
.hero > div:first-child { padding: 56px 0 48px; }
.hero h1 { font: 700 clamp(48px, 7vw, 96px)/.95 var(--font-display); letter-spacing: -.03em; max-width: 14ch; color: #111; }
.hero .eyebrow, .live, .brief li, .hero .sample-link, .gen, .mini-signup label { color: #111 !important; }
.brief li::before { color: #111; }
.mini-row input { border-color: #111; } .mini-row button { background: #111; color: #fff; }
.glance { padding-top: 24px; }
.sec-head h2 { letter-spacing: -.02em; }
.row.lead .rank, .row.lead h3 { color: #d1006a; }
.chip[aria-pressed="true"], .seg button[aria-pressed="true"] { background: #ff4fa3; border-color: #ff4fa3; color: #111; }
.signup { background: #ff4fa3; color: #111; } .signup button { background: #111; color: #fff; }
"""),
 ("04-scoreboard", "Scoreboard", "Doto:wght@700;900&family=Geologica:wght@400;500;700",
  dict(bg="#f4f5f3", paper="#ffffff", chip="#e8eae6", line="#d9dcd6", ink="#111", muted="#555",
       cool="#cfd3cc", warm="#9db58f", hot="#0d5c3a", **{"up-text": "#0b6b35",
       "font-display": '"Geologica", system-ui, sans-serif', "font-body": '"Geologica", system-ui, sans-serif', "font-mono": '"Doto", ui-monospace, monospace'}),
  bleed(".hero > div:first-child", "#0d3b28") + bleed("#top > .glance", "#0d3b28") + """
.hero > div:first-child { padding: 40px 0 28px; color: #fff; }
.hero h1 { font: 700 clamp(36px, 4.8vw, 60px)/1.05 var(--font-display); color: #fff; max-width: 20ch; }
.hero .eyebrow, .live, .brief li, .hero .sample-link, .gen, .mini-signup label, .hero .sample-link a { color: #d7e6dc !important; }
.brief li:first-child { color: #fff !important; } .brief li::before { color: #ffd400; }
.mini-row input { background: #0a2e1f; border-color: #3d7a5c; color: #fff; } .mini-row button { background: #ffd400; color: #111; }
#top > .glance { padding: 8px 0 36px; gap: 8px 48px; }
.glance b { font: 900 52px/1 "Doto", monospace; color: #ffd400; display: block; }
.glance span { color: #d7e6dc; }
.rank { font: 900 36px/1 "Doto", monospace; color: #9aa39a; } .row.lead .rank { color: #0d5c3a; }
.heat .score { font: 900 30px/1 "Doto", monospace; background: #0d3b28; color: #ffd400; }
.heat .score small { color: #d7e6dc; }
.chip[aria-pressed="true"], .seg button[aria-pressed="true"] { background: #0d3b28; border-color: #0d3b28; color: #ffd400; }
.signup { background: #0d3b28; } .signup button { background: #ffd400; color: #111; }
"""),
 ("05-editorial", "Morning paper", "Domine:wght@500;700&family=Fira+Sans:wght@400;500;600",
  dict(bg="#ffffff", chip="#f2f2f2", line="#e2e2e2", ink="#141414", muted="#555",
       cool="#e3e3e3", warm="#a8a8a8", hot="#141414", **{"up-text": "#0b7a3e",
       "font-display": '"Domine", Georgia, serif', "font-body": '"Fira Sans", system-ui, sans-serif', "text-xl": "32px"}),
  """
.wrap { max-width: 760px; }
.top .wrap { max-width: 1180px; }
.hero > div:first-child { padding-top: 56px; text-align: center; }
.dateline { justify-content: center; }
.hero h1 { font: 700 clamp(36px, 5vw, 54px)/1.12 var(--font-display); margin-inline: auto; max-width: 18ch; }
.brief { grid-template-columns: 1fr; text-align: left; max-width: 60ch; margin: 0 auto; }
.mini-signup { margin-inline: auto; text-align: left; }
.glance { justify-content: center; }
.sec-head { flex-direction: column; align-items: center; text-align: center; }
.sec-head > div { align-items: center; }
.sec-head h2 { font-weight: 700; }
.movers, .bo-list, .receipts, .hype, .models, .tbl, .threads, .timeline, .free, .news { border-top: 3px double #141414; }
.row h3, .hy h3, .bo h3, .model h3 { font-family: var(--font-display); }
.models { grid-template-columns: 1fr 1fr; } .split, .news, .free { grid-template-columns: 1fr; }
.signup { grid-template-columns: 1fr; text-align: center; background: #141414; }
"""),
 ("06-swiss", "Swiss grid", "Geist:wght@400;500;700;800",
  dict(bg="#ffffff", chip="#f0f0f0", line="#e0e0e0", ink="#000", muted="#555",
       cool="#e0e0e0", warm="#f59a8f", hot="#e10600", **{"up-text": "#0b7a3e",
       "font-display": '"Geist", system-ui, sans-serif', "font-body": '"Geist", system-ui, sans-serif', "text-xl": "40px"}),
  bleed(".top", "#e10600") + """
.top { background: #e10600; border: 0; } .top a, nav.main a, .logo { color: #fff; }
nav.main a:hover { background: rgba(0,0,0,.18); color: #fff; }
.search input, .top .lang-pick select { background: #fff; border-color: #fff; }
.hero > div:first-child { padding-top: 64px; display: grid; grid-template-columns: 3fr 9fr; column-gap: 32px; }
.hero > div:first-child > * { grid-column: 2; }
.hero > div:first-child > .dateline { grid-column: 1; grid-row: 1 / span 3; flex-direction: column; align-items: flex-start; }
.hero h1 { font: 800 clamp(44px, 6vw, 88px)/.95 var(--font-display); letter-spacing: -.04em; margin-top: 0; max-width: 12ch; }
.brief { grid-template-columns: 1fr 1fr; }
section.block { display: grid; grid-template-columns: 3fr 9fr; column-gap: 32px; }
section.block > * { grid-column: 2; } section.block .controls { flex-direction: column; align-items: flex-start; } section.block > .sec-head { grid-column: 1; grid-row: 1 / span 9; align-self: start; position: sticky; top: 90px; flex-direction: column; align-items: flex-start; }
.sec-head h2 { font: 800 30px/1 var(--font-display); letter-spacing: -.03em; }
.rank { font-weight: 800; color: #000; } .row.lead .rank { color: #e10600; }
.chip[aria-pressed="true"], .seg button[aria-pressed="true"] { background: #e10600; border-color: #e10600; color: #fff; }
.mini-row button { background: #e10600; color: #fff; }
.signup { background: #e10600; color: #fff; } .signup button { background: #000; color: #fff; }
@media (max-width: 900px) { .hero > div:first-child, section.block { display: block; } .sec-head { position: static; } }
"""),
 ("07-friendly", "Friendly mint", "Fredoka:wght@500;600;700&family=Figtree:wght@400;500;600",
  dict(bg="#eef7f5", paper="#ffffff", chip="#e2f0ec", line="#d3e6e1", ink="#10221f", muted="#4f615d",
       cool="#cfe5df", warm="#7fd3c3", hot="#0e9f8a", **{"up-text": "#0b7a5a",
       "font-display": '"Fredoka", system-ui, sans-serif', "font-body": '"Figtree", system-ui, sans-serif',
       "radius-sm": "8px", "radius-md": "14px", "radius-lg": "22px", "radius-pill": "999px"}),
  """
.hero > div:first-child { padding: 40px 36px 32px; margin-top: 28px; background: #fff; border-radius: 28px; }
.hero h1 { font: 600 clamp(38px, 5vw, 62px)/1.05 var(--font-display); }
.mini-row input { border-radius: 999px; padding-inline: 18px; } .mini-row button { border-radius: 999px; background: #0e9f8a; color: #fff; }
.glance { padding: 24px 0 0; }
.sec-head h2 { font: 600 34px/1.1 var(--font-display); }
.movers { border: 0; display: grid; gap: 12px; } .row { background: #fff; border: 0; border-radius: 22px; padding: 18px 20px; }
.rank { font: 600 28px var(--font-display); color: #0e9f8a; }
.row h3 { font-family: var(--font-display); font-weight: 600; }
.heat .score { border-radius: 14px; background: #e2f0ec; }
.chip, .seg { border-radius: 999px; } .chip[aria-pressed="true"], .seg button[aria-pressed="true"] { background: #0e9f8a; border-color: #0e9f8a; color: #fff; }
.updraft { background: #fff; border-radius: 22px; padding: 22px; border: 0; }
.signup { background: #0e9f8a; border-radius: 28px; } .signup button { background: #fff; color: #0b5c50; border-radius: 999px; }
"""),
 ("08-blue-brutal", "Blue brutal", "Dela+Gothic+One&family=Gantari:wght@400;500;700",
  dict(bg="#1f3bff", paper="#1f3bff", chip="#1630d6", line="rgba(255,255,255,.55)", ink="#ffffff", muted="#dfe4ff",
       cool="#6f80ff", warm="#c9d0ff", hot="#ffffff", up="#ffffff", **{"up-text": "#ffffff", "badge-up": "#000", "badge-hot": "#000",
       "font-display": '"Dela Gothic One", system-ui, sans-serif', "font-body": '"Gantari", system-ui, sans-serif',
       "band": "#000", "band-ink": "#fff", "radius-sm": "0", "radius-md": "0", "radius-lg": "0", "radius-pill": "0"}),
  """
.top { background: #1f3bff; border-bottom: 3px solid #fff; }
.search input, .top .lang-pick select, .mini-row input { background: transparent; border: 2px solid #fff; color: #fff; }
.search input::placeholder, .mini-row input::placeholder { color: #dfe4ff; }
.hero h1 { font: 400 clamp(40px, 6vw, 84px)/1.02 var(--font-display); letter-spacing: -.01em; max-width: 16ch; }
.mini-row button { background: #fff; color: #1f3bff; }
.sec-head h2 { font: 400 36px/1.05 var(--font-display); }
.movers, .bo-list, .receipts, .hype, .models, .tbl, .threads, .timeline, .free, .news { border-top: 3px solid #fff; }
.row, .bo, .receipts li, .hy, .model, td, th, .thread, .news li, .fm { border-bottom: 2px solid #fff !important; }
.rank { font: 400 32px var(--font-display); color: #fff; }
.row h3 { font: 400 22px/1.15 var(--font-display); }
.heat .score { background: #fff; color: #1f3bff; }
.chip, .seg { border: 2px solid #fff; color: #fff; } .chip[aria-pressed="true"], .seg button[aria-pressed="true"] { background: #fff; color: #1f3bff; }
.since-bar, .poll, .steps li, .qa > div, .win, .free-watch, .updraft { background: transparent; border: 2px solid #fff; }
.src { background: #fff; color: #1f3bff; }
.signup { background: #000; } .signup button { background: #fff; color: #000; }
"""),
 ("09-night-cyan", "Night cyan", "Gabarito:wght@400;500;700&family=Geist+Mono:wght@500;600",
  dict(bg="#131315", paper="#1b1b1e", chip="#26262a", line="#2e2e33", ink="#eeeeef", muted="#a9a9b0",
       cool="#2c3a40", warm="#2b8fb0", hot="#38d6ff", up="#3ddc84", **{"up-text": "#4ee08f", "badge-up": "#14703f", "badge-hot": "#0d5f73",
       "font-display": '"Gabarito", system-ui, sans-serif', "font-body": '"Gabarito", system-ui, sans-serif', "font-mono": '"Geist Mono", ui-monospace, monospace'}),
  """
.top { background: #131315; }
.hero h1 { font: 700 clamp(38px, 5vw, 64px)/1.04 var(--font-display); letter-spacing: -.02em; }
.hero h1 .mover { color: #38d6ff; }
.mini-row input { background: #1b1b1e; border-color: #4a4a52; color: #fff; } .mini-row button { background: #38d6ff; color: #04161c; }
.chip[aria-pressed="true"], .seg button[aria-pressed="true"] { background: #38d6ff; border-color: #38d6ff; color: #04161c; }
.row.lead { box-shadow: inset 3px 0 0 #38d6ff; }
.heat .score { color: #38d6ff; background: #1b2a30; }
.movers, .bo-list, .receipts, .hype, .models, .tbl, .threads, .timeline, .free, .news { border-top: 1px solid #38d6ff; }
.signup { background: #0d2a33; } .signup button { background: #38d6ff; color: #04161c; }
.updraft { background: #1b1b1e; border: 1px solid #2e2e33; border-radius: 10px; padding: 20px; }
"""),
 ("10-tiles", "Dashboard tiles", "Rubik:wght@400;500;600;700",
  dict(bg="#eef0f3", paper="#ffffff", chip="#eef0f3", line="#dfe3e8", ink="#141820", muted="#59606b",
       cool="#d5dae1", warm="#9aa8ff", hot="#3d5afe", **{"up-text": "#0b7a3e",
       "font-display": '"Rubik", system-ui, sans-serif', "font-body": '"Rubik", system-ui, sans-serif',
       "radius-sm": "6px", "radius-md": "8px", "radius-lg": "14px"}),
  """
.hero > div:first-child { margin-top: 24px; padding: 28px; background: #fff; border-radius: 14px; }
.hero h1 { font: 600 clamp(32px, 4vw, 48px)/1.1 var(--font-display); }
.mini-row button { background: #3d5afe; color: #fff; }
.glance { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding-top: 12px; }
.glance div { background: #fff; border-radius: 14px; padding: 16px 18px !important; }
.glance b { display: block; font: 600 30px/1.1 var(--font-display); }
.movers { border: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.row { background: #fff; border: 0; border-radius: 14px; padding: 18px; grid-template-columns: 34px minmax(0,1fr); }
.row .heat { grid-column: 2; justify-self: start; justify-items: start; grid-auto-flow: column; align-items: center; }
.row .desc { display: none; }
.rank { font-size: 20px; }
.chip[aria-pressed="true"], .seg button[aria-pressed="true"] { background: #3d5afe; border-color: #3d5afe; color: #fff; }
.updraft { background: #fff; border-radius: 14px; padding: 20px; border: 0; }
.bo-list, .receipts, .hype, .models, .tbl, .threads, .timeline, .free, .news { border: 0; background: #fff; border-radius: 14px; padding: 4px 20px; }
.signup { background: #3d5afe; border-radius: 14px; } .signup button { background: #fff; color: #3d5afe; }
@media (max-width: 700px) { .glance { grid-template-columns: 1fr 1fr; } .movers { grid-template-columns: 1fr; } }
"""),
]

out = os.path.join(HERE, "sites")
if os.path.exists(out): shutil.rmtree(out)
for slug, name, fonts, tok, css in THEMES:
    d = os.path.join(out, slug)
    shutil.copytree(BASE, d)
    with open(os.path.join(d, "theme.css"), "w") as f:
        f.write(f"@import url('https://fonts.googleapis.com/css2?family={fonts}&display=swap');\n" + tokens(tok) + css + "\n@media (max-width: 700px) { .brief { grid-template-columns: minmax(0, 1fr) !important; } }\n.sec-head .controls { min-width: 0; }\n")
    p = os.path.join(d, "index.html"); s = open(p).read()
    s = s.replace("</head>", '<link rel="stylesheet" href="theme.css"></head>', 1)
    open(p, "w").write(s)
print("built", len(THEMES))
