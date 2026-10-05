# Nevis frontend take-home

A React dashboard for exploring monthly client figures. Read the [development methodology](methodology.md) for my approach and technology choices.

## Run and test

Requires **Node.js 20.19+ (20.x), 22.12+ (22.x), or 24+** and npm. No credentials or external services.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The Node/Express API runs on port 3001; Vite proxies `/api/clients` to it. The supplied payload is served unchanged.

```sh
npm run check                    # TypeScript, lint, unit/component/API tests
npx playwright install chromium  # Once, before browser tests
npm run test:e2e                 # Desktop and 375px browser checks
```

Browser tests use ports 3111/4173. For production, stop the dev server, run `npm run build`, then `npm start`; open **http://127.0.0.1:3001**.

## Assumptions and questions for the team

**Intentional differences from Figma.** For this interview task, I chose to chart the available hierarchy: branches, advisors, and channels where supplied. Figma shows Existing clients / New organic / New paid, but only Anna has those figures. I kept the supplied data rather than changing or inventing values to fit the mockup. This is a useful way to explore the dataset, but changes the graph's original purpose: **if company-wide acquisition-channel visibility is the priority, this chart does not meet that need.**

I took the original description and went with what was available to provide immediate value.

> Advisors and their managers need to see how their book of business develops over time, and to
> drill from the whole company down to a single branch, advisor or acquisition channel.

I also added chart-selection buttons and breadcrumbs so chart drill-down is independent of table expansion, plus dotted underlines with tooltips to explain conflicting totals.

In a real team setting, I'd handle this with a quick async conversation. It seems like the data that we have in this case doesn't allow us to successfully drill down into acquisition channels, so with that in mind, showing data by branch and advisor is still useful, based on the task given. Ideally, I'd design this with “group by” functionality to group either by branches and advisors or by acquisition channels, provided it's possible with the user data.

**Seven totals do not add up.** May's branches sum to **279**, while Company reports **301**; August's advisors sum to **216**, while Branch 1 reports **214**. I would first investigate why these differ. A backend calculation issue should be fixed at source; if the differences are expected, the UI needs to explain what they mean. For this task, I treated them as possible user-input errors and explained the discrepancies in keyboard/touch-accessible tooltips. The chart stacks the supplied child figures and the table keeps the reported totals.

**Missing detail is unavailable, not zero.** Containers without children open an empty state; terminal channels do not expand. Figures are treated as client counts.

**The API has no period metadata.** I fixed the labels and validation to the brief's 12 months, February 2024 to January 2025. For a live API, I would implement `periodStart` and `periodCount` alongside the tree so the client can derive labels and validate the actual period.

## What I would do next

- Agree the metric definitions, reconciliation rules, and company-wide channel breakdown with design, product, and the data owner.
- Ask what shapes and sizes real datasets can take. For a branch with 1,000 employees, discuss how users should find and compare advisors and how the chart should handle that many series. Decide whether filtering, grouping, or performance optimisation is needed to keep the experience usable.
- Replace the fixture-specific UUID-to-portrait mapping in the frontend with an optional `avatarUrl` supplied by the API, keeping a fallback for missing or unavailable images.
