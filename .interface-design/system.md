# Upcurrent design record: option 2 (better-design skill)

Subject:    a free public dashboard of the AI repos, models, papers and threads gaining momentum today
Audience:   developers and AI-curious readers, mostly on a laptop or phone, checking in once a day for a minute or two
Job:        see what is rising in AI today, and by how much
Given:      "keep this UI as decision 1 and make decision 2 from this claude skill"; the existing page content,
            live data, email signup, GoatCounter and prerendered SEO markup stay as they are
Look:       open
Filled in:  the page is built on the momentum score and its 24h change for every tracked item; nothing else made up
Register:   between
Default:    deep indigo full-bleed hero, amber/red heat accent, condensed display face (Big Shoulders) with a grotesque
            text face, headline on the left and the momentum chart on the right, top bar with name and links, a
            scrolling ticker and a row of stat figures under the first screen (this is option 1)
Directions: (a) like the Hacker News front page: the numbered list fills the screen from the top, one flat colored bar
                across the top carries all the color, a humanist sans at one size
            (b) like GitHub Trending: a title line with the time-window switch, then ranked rows with the day's gain
                right-aligned; black, white and gray only, color reserved for change; a grotesque for headings and
                plain sans for text, figures in monospace
            (c) like the Hugging Face models list: a filter column down the left, a dense grid of entries on the
                right; color only on the selected filter; a single neutral sans
Chosen:     "https://github.com/novnski/skills/blob/main/skills/better-design/SKILL.md use this claude skill and refine
            but keep this UI as decision 1 and make decision 2 from this claude skill" = 22 words, 22 / 3 leaves 1,
            so (b). It suits people who come back daily to scan a ranking: the list itself is the first thing they see.
Differs:    use of color: indigo flood with a heat ramp everywhere -> no color at all except green/red for change
            typeface class: condensed display -> grotesque with character for headings, monospace for figures
            first-screen composition: headline left, chart right -> headline across the top, ranked list straight under it
Palette:    seen: Hacker News (orange), GitHub (black), Hugging Face (yellow)
            neutrals: plain gray
            spent on: green for a gain and red for a fall; the email panel is one flat black field
Accent:     none
Type:       seen: GitHub's wide grotesque headings, Hacker News in Verdana, Hugging Face in Source Sans
            letters: I K O R S
            face: Onest for headings (a sturdy, slightly wide grotesque like the GitHub headings), IBM Plex Sans
            for text (open humanist shapes like the Hacker News and Hugging Face text), IBM Plex Mono for figures only
First screen: seen: Hacker News is one numbered list under an orange bar; GitHub Trending is a title line with a
            date-range switch over repo rows, color only in small language dots; Hugging Face is a left filter
            column beside a grid of model entries, color only in the logo
            from: (b). The headline sentence runs across the top, one plain line of today's figures under it, the
            email field on the same line, then the window switch and the ranked list start on the first screen
Headline:   generated from live data, e.g. "fast-anything is climbing fastest today."
Action:     "Get the 7am email", the one button in the first screen's email field
Concept:    a ranking you can read in ten seconds: what moved since yesterday and by how much. Carried by the ranked
            list with its 24h change, and by "Called it", which shows how early items were spotted
Picture:    the interface itself: the ranked list with real scores and changes, which shows the size of each move
            in a way the headline cannot
Shape:      sharp row (0-2px small, 2px controls, 4px panels): a reference page for technical readers; one
            rectangular button shape, no pills
Rules:      1. Nothing is colored except change: green for up, red for down. Everything else is black, white or gray.
            2. Every figure is set in IBM Plex Mono with tabular figures.
            3. Nothing sits beside the headline; the ranked list starts on the first screen.
            4. Sections are separated by a rule and space, never boxed; the email panel is the one flat black field.
            5. No label above any heading; what a label said goes in the sentence under the heading.
