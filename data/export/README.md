---
license: cc-by-4.0
pretty_name: Upcurrent daily rising AI repos, models and free LLMs
language:
- en
tags:
- ai-trends
- github
- llm
- free-models
- time-series
size_categories:
- 1K<n<10K
configs:
- config_name: rising_daily
  data_files: rising_daily.csv
- config_name: github_ai_repos_daily
  data_files: github_ai_repos_daily.csv
- config_name: free_models_daily
  data_files: free_models_daily.csv
---

# Upcurrent: daily rising AI repos, models and free LLMs

Daily snapshots from [Upcurrent](https://upcurrent.dev), a free site that checks GitHub, Hugging Face, arXiv, Hacker News, AI lab blogs and model providers every 30 minutes and ranks which AI projects are picking up speed fastest.

Covers **2 October 2026 to 27 November 2026** (54 days). For the live, always-current version, use the JSON API at https://upcurrent.dev/data.html.

## Files

| File | Rows | What it is |
|---|---|---|
| `rising_daily.csv` | 534 | The day's top 10 fastest-rising AI repos, models and papers, with Upcurrent's momentum score |
| `github_ai_repos_daily.csv` | 243 | AI GitHub repos gaining stars fastest each day: total stars, stars gained in 24 hours, forks |
| `free_models_daily.csv` | 1,496 | Every model listed as free on OpenRouter and OpenCode Zen each day |

### Columns

**rising_daily.csv:** `date`, `rank` (1 = fastest-rising that day), `source` (GitHub, Hugging Face, arXiv / HF Papers), `name`, `owner`, `category`, `momentum_score` (0–100), `growth_pct` (percentage growth in a day, when known), `url`

**github_ai_repos_daily.csv:** `date`, `repo`, `stars`, `stars_gained_24h`, `stars_24h_estimated` (yes when Upcurrent hadn't seen the repo for 24 hours yet, so the gain is estimated from its average), `forks`, `category`, `url`

**free_models_daily.csv:** `date`, `provider`, `model`, `context_tokens`, `url`

## Things to know

- **Momentum score** is Upcurrent's own. It's a percentile of how fast something is gaining attention compared with everything else from the same source that day, plus a boost for new items.
- **Snapshots are end of day.** A free offer that started and ended within one day may be missing.
- **OpenCode Zen renamed its models on 30 October 2026**, from IDs like `jev-1.13` to names like `Jev 1.13 Free`. They are the same models, so normalise names before counting how long a model stayed free.
- **NSFW items are removed.**
- **Numbers are as recorded at the time** and aren't corrected later.

## Example findings

From `free_models_daily.csv`, after merging the OpenCode renames: 62 models were offered free between 2 October and 27 November 2026, 39 of them stopped being free, and half of those lasted 12 days or less. More in the [free AI model tracker](https://upcurrent.dev/free-ai-models/history/).

## Licence and citation

CC BY 4.0. Please credit and link: **Upcurrent (https://upcurrent.dev)**.
