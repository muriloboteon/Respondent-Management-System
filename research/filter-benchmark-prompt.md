# Prompt: filter benchmarking + low-fidelity prototypes

> Copy everything below the line and paste it into the session/tool that will run the research.

---

## Role and goal

You are a UX researcher specialized in dense data interfaces (tables, lists, CRMs, analytics tools). Your task has two parts:

1. **Benchmarking**: research how modern platforms handle **filtering lists/tables with many columns** and extract the interaction patterns.
2. **Prototypes**: based on the research, build **4 to 5 low-fidelity prototypes** (clickable grayscale HTML, published as artifacts) showing different approaches to filtering in our product.

Write your reports (Part 1 and the final summary of Part 2) in **Brazilian Portuguese**. Keep the prototypes' UI text in **English**, the product's language.

## Product context

**Respondent Hub** is a tool for managing qualitative research respondents (interviews, self-captures, tech checks, consent). The main screen is a table of a project's respondents with many columns, which can be reordered, pinned and hidden. Users are researchers and research ops teams who need to quickly find groups of respondents to act on in bulk (assign to an interview, send a tech check, chase consent, etc.).

**Filterable properties today** (every column can become a filter):

| Type | Properties |
|---|---|
| Text (contains / doesn't contain) | Respondent (name), ID, Email |
| Single-value list (is / is not, with "Not set") | Assign to Interview, Role, Self Captures (Completed / Not completed), Tech check (Completed / Attempted / Not sent), Consent form (Signed / Not signed), Timezone, Source |
| Yes / no | Repeat Respondent, Favorite |
| Date (in the last N days / before / after / between) | Added on, Last activity |
| Segments (list, one or several values) | Age, Area, Gender, Household and other demographic segments configured per project |

**How filters work today**:
- A **single-row** toolbar with a free-text search (name, email or ID; accepts several, comma-separated) and a **Filter** button.
- The button opens a **popover** listing the properties, grouped (Respondent / Segments). After picking one, the user sets the operator and values, and the filter is only added via an explicit **Add filter / Apply** button.
- Each active filter becomes a **chip**, one chip per property, all combined with **AND**. There is no OR and no condition groups.
- Users can also filter from a column's menu and from a cell's value ("Filter by…").

**Current design guidelines** (from earlier decisions):
1. No fixed bar of per-column dropdowns: there are too many columns, so filtering must work for any of them.
2. The area above the table stays **a single row**, with no extra filter row or band.
3. The filter popover **does not move** while the user interacts with it.
4. A filter is only added or applied through an explicit button.

The team is **not happy** with the current solution and wants to see alternatives. Prototypes may **challenge** these guidelines, but each prototype must state which ones it follows and which it breaks, and why. At least 2 prototypes must follow all of them.

## Part 1: Benchmarking

### Platforms

Required:
- **Stripe** (Dashboard: payments, customers, filters and search)
- **PostHog** (persons, cohorts, property filters, AND/OR groups)
- **Pendo** (segments, visitor and account filters)
- **Rally UXR** (research participant management; our most direct competitor)
- **Jira** (basic filter vs. JQL, saved filters)

Supplementary (include those with enough public material):
- Research ops / panels: User Interviews, Great Question, Respondent.io, Qualtrics XM Directory, Dovetail
- Tables and work tools: Linear, Notion, Airtable, Attio, HubSpot, GitHub (Issues/Projects)
- Analytics and observability: Mixpanel, Amplitude, Datadog

Many of these tools require a login. Use public documentation, help centers, changelogs, blog posts, demo videos and public screenshots. **Cite the source (URL) for every claim** and mark what is **verified** versus **inferred**. Do not invent interface details.

### What to analyze for each platform

1. **Entry point**: where the user starts filtering (button, search, column menu, keyboard shortcut, command bar).
2. **Building a condition**: the property → operator → value sequence, number of clicks, whether properties are searchable, how long value lists are handled.
3. **Operators by data type**: text, list, boolean, date (relative/absolute), "empty / not set".
4. **Logic**: AND only? AND/OR? Nested groups? How is this shown without overwhelming casual users?
5. **Showing active filters**: chips, a natural-language sentence, a side panel, a text query. How to edit, remove and clear all.
6. **Applying**: instant, or with an "Apply" button? How is the result count shown (live, preview)?
7. **Quick filters and saved views**: presets, view tabs, saved and shareable segments, filters in the URL.
8. **Advanced mode**: query language (JQL, Stripe/GitHub search syntax), natural-language or AI filtering.
9. **Density and space**: how it fits in a small bar when there are many filters (overflow, "+3 more", collapsing).
10. **Strengths and weaknesses** for our use case.

### Part 1 deliverables

1. **Platform profile**: a short summary of the 10 points above for each platform, with links.
2. **Pattern catalog**: 6 to 10 filtering patterns identified (e.g. "chips with popover", "sentence builder", "query bar with autocomplete", "faceted side panel", "saved views as tabs", "natural-language filter"), each with: description, who uses it, when it works well, when it fails, implementation complexity.
3. **Comparison matrix**: platforms × criteria (speed for a simple filter, power for a complex filter, discoverability, space taken, OR support, saved views, keyboard support).
4. **Recommendation**: which 4 or 5 approaches are worth prototyping, and why.

**Stop here and present Part 1 for review before building the prototypes.**

## Part 2: Low-fidelity prototypes

### Format
- **Clickable HTML** pages, **grayscale** (wireframe style: no brand colors, no elaborate icons, system typography). At most one neutral accent color for active states.
- Each prototype is **a separate published artifact**, plus **an index page** linking them all and summarizing how they differ.
- All prototypes use **the same fake dataset** (around 30 respondents with the columns listed above) and **the same frame**: toolbar above the table + table. This keeps the comparison fair.
- Filtering must **actually work** on the fake data (the table updates and shows the result count). A static picture is not enough.
- A small header on each prototype with: the approach's name, the platforms that inspired it, and which design guidelines it follows or breaks.

### Scenarios every prototype must support
For comparison, each prototype must let the tester run these scenarios (list them in a collapsible side panel or at the top for whoever is testing):

1. **Quick**: show only respondents whose Consent form is **Not signed**.
2. **Combined**: Tech check **is not Completed** AND Assign to Interview **is** a specific session AND Timezone **is** one of two timezones.
3. **Segments**: Age **is** 18-31 or 32-44 AND Area **is** urban AND Last activity **in the last 30 days**.
4. **Empty**: Role is **Not set**.
5. **Editing**: change the value of an active filter, remove a filter, clear all.
6. **OR across properties** (optional, to test whether it's missed): Tech check **is Not sent** OR Consent form **is Not signed**.
7. **Shortcut**: start a filter from a cell's value or a column's menu.

### Part 2 deliverables
- The 4 or 5 published artifacts + the index page, with their links.
- A final table: prototype × scenario, with the number of clicks/steps for each scenario and notes on what was easy or hard.
