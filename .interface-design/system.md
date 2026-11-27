# Upcurrent design record: option 3 (all the skills: better-design + frontend-design, reviewed with
# design-critique, accessibility-review and ux-copy)

Subject:    a free public dashboard of the AI repos, models, papers and threads gaining momentum today
Audience:   developers and AI-curious readers on a laptop or phone, checking in once a day, sometimes jumping
            straight to one section (models, repos, free models)
Job:        see what is rising in AI today, and jump to the part you care about
Given:      "use all the skills and make me another redesign"; content, live data, signup, GoatCounter and the
            prerendered SEO markup stay as they are; options 1 and 2 already exist and this must differ from both
Look:       open
Filled in:  the page is built on its sections (movers, breakouts, hype check, called it, models, repos, threads,
            headlines, free models): a reader picks one, so the section index is always in view
Register:   between
Default:    option 1 (indigo hero, condensed face, heat colours) or option 2 (white page, grotesque, list first)
Directions: (a) like the Hacker News front page: one flat coloured bar across the top, a numbered list under it
            (b) like GitHub Trending: a title line with a time switch over ranked rows (this was option 2)
            (c) like the Hugging Face models list: a filter column down the left beside the content; colour only
                on what is selected
Chosen:     "use all the skills and make me another redesign" = 8 words, 8 / 3 leaves 2, so (c). Readers who come
            for one section get there in one click from anywhere on the page.
Differs:    use of color: indigo flood / none -> yellow only on what is selected and on the main button
            typeface class: condensed / grotesque -> a text serif for headings, like the papers this field reads
            first-screen composition: headline beside chart / headline over list -> a section column down the
            left, headline and today's chart stacked in the content column
Palette:    seen: Hacker News (orange), GitHub (black), Hugging Face (yellow)
            neutrals: plain gray
            spent on: the main button, the selected filter and time window, the hovered/current section in the
            left column, and the top mover's rank. Green and red are kept for up and down.
Accent:     yellow
Type:       seen: arXiv papers set in a book serif, Hugging Face pages in a soft rounded sans, GitHub's grotesque
            letters: A B E F O
            face: Faustina for headings (a sturdy newspaper text serif, like the papers' headings), Figtree for
            text and figures (a soft, open sans like the Hugging Face pages), tabular figures throughout
First screen: seen: Hacker News is one list under an orange bar; GitHub Trending is a title line with a range
            switch over rows; Hugging Face is a filter column on the left beside a dense grid, colour in the logo
            from: (c). The left column holds the name, the filter field and the section index; the content
            column opens with the date, the headline, the brief, the email field, then today's chart full width
Headline:   generated from live data, e.g. "opengame is climbing fastest today."
Action:     "Get the 7am email", the one yellow button on the first screen
Concept:    an index of today's AI momentum: every section is one click away in the left column, and the chart
            under the headline filters the whole page by category. Carried by the section column and the chart
Picture:    the interface itself: today's momentum chart by category, which shows where the activity is in a way
            the headline cannot
Shape:      balanced row (4px small, 6px controls, 10px panels): a friendly public reference; one button shape
Rules:      1. Yellow appears only on the selected thing and the main button; everything else is gray.
            2. Headings are Faustina, never bold above 600, never above 56px; text and figures are Figtree.
            3. The section column is always visible on wide screens; nothing duplicates it in the content.
            4. Sections sit on the page, separated by space and one rule; only repeated items get a border.
            5. No label above a heading and no capitals labels; what a label said goes in the sentence under it.
