# Development methodology

I relied heavily on agentic coding during the implementation, as I would in my day-to-day work. I used **Codex with Astra** for the main implementation and **Claude Code with Opus 5.5** for tandem reviews, alongside an agentic harness and a process that I regularly use for development, including best practices, preferred technologies, etc.

In this agentic development process, I prioritise harness engineering itself. I'm fully responsible for the outcome, final code review, and handover, with a primary focus on product direction, understanding ambiguities, and figuring out user needs.

## Understanding the task before coding

I manually explored the brief and designs, obviously running into the issue of very incomplete data conflicting with the task output, but decided to press forward. I then asked Codex to load the context, inspect the Figma file and its design variables, and discuss decisions with me before starting implementation. My first questions were what the chart stacks, what changes its scope, what missing children mean for the outcome, and whether parent totals should equal their breakdowns.

The missing company-wide channel data and conflicting totals affected the meaning of the dashboard. I chose to preserve the supplied figures and chart the available hierarchy instead of inventing data to match the mockup.

In a real team, I would raise these questions with design and product in a quick Slack message: an example, its effect on the user, and my proposed approach. For this task, I made the assumptions explicit in the [README](README.md) and refined the interactions during review.

## My technical choices and preferences

React, TypeScript, and a Node REST API were requirements. I chose the following:

- **Vite + React:** a client dashboard without a server-rendering requirement did not need Next.js.
- **CSS Modules:** I wanted component-owned styles, separate from JSX, with shared design variables. This suited the reusable component foundation I wanted to build.
- **Recharts:** I had good previous experience with it and wanted to keep chart presentation behind a reusable component.

I asked Codex to propose the API setup, fetching logic, component interfaces, and test setup, with reasons for the choices. I accepted Express for the single JSON endpoint and TanStack Query for the request lifecycle, keeping expansion and chart selection in local React state. A fetch hook could also handle this fixture; I accepted Query to avoid maintaining the request lifecycle myself.

This would probably not be my preferred architecture for a large-scale application, but I did prefer simplicity over overengineering in this home task example.

My component requirement was to separate presentation from client-specific data and fetching. I reviewed the proposed `TreeTable<T>` accessors, columns, controlled expansion, and independent row actions, and the `StackedBarChart<T>` categories, series, and summaries. Examples using [folders](src/components/TreeTable/README.md) and [sales](src/components/StackedBarChart/README.md) checked that the APIs worked beyond this dataset. I kept the recursive, data-driven table with render callbacks; `<TreeTable.Row>` children would offer more markup control but add coordination for the hierarchy. Following review, I had Codex remove layout-width props and an unused rendering hook, leaving feature-specific widths in CSS.

## Implementation and my manual review

I used focused prompts for components and corrections, with Codex writing code and tests and using browser inspection to check the result. I compared the running UI with Figma and reviewed the code and behaviour.

## What I asked Claude to review

I used Claude Code to compare the implementation against the brief and Figma, check functionality and accessibility, and challenge unnecessary complexity, weak assumptions, and generic documentation. The review questions included whether chart drill-down fulfilled the main use case, whether chart and table totals could mislead users, and whether the component APIs had become overly configurable.

I assessed the findings and asked Codex to make the corrections I accepted. For example, review led me to extend chart scope beyond table expansion and then reduce the visual weight of the added controls. I also requested a final pass for vague prose and unnecessary abstractions. The reviewers informed my decisions; they did not replace my code, UX, and product review.

## Verification before delivery

I asked Codex to exercise loading, server and network errors, invalid payloads, and retry recovery, alongside keyboard expansion, chart mapping, sparse nodes, zeroes, conflicting totals, and scope navigation. Browser checks covered desktop and 375px layouts, tooltips, touch and keyboard interactions, Figma geometry, and automated accessibility checks.

Before delivery, Codex checked a fresh clone with a clean dependency install, type checks, lint, unit/component/API tests, browser tests, a production build, and startup. I reviewed the results alongside the manual checks above. Automated geometry and accessibility checks do not establish complete design fidelity or replace assistive-technology testing.

Assets: [font license](public/fonts/LICENSE.txt), [portrait provenance](public/avatars/README.md).
