---
name: design-preview
description: Use whenever the user wants to create something NEW that needs UI/UX or motion design — a new view/screen/page, a new flow, a new UI component, or a new animation/transition — before writing any production code. Asks the user whether they want a design preview; if yes, produces an artifact with at least three distinct options to choose from, then implements the chosen one. Does not apply to bug fixes, copy changes, or small tweaks to existing UI that add no new view, component or animation.
---

# Design preview before building

When a request creates something new with UI/UX or motion impact, **ask first, then do**. Never jump straight into production code.

## 1. Detect

Triggers: new view/screen/page, new flow, new component, new animation or transition (including reworking an existing one into something noticeably different).

Skip: bug fixes, wording/copy, spacing/color tweaks, or edits that add no new view, component or animation.

## 2. Ask (short)

Before touching code, ask the user in one or two lines, e.g.:

> This adds a new <view/component/animation>. Want me to show a design preview first (an artifact with 3 options), or build it directly?

Use `AskUserQuestion` if it is available, with options "Yes, show 3 options" / "No, build it directly". Do not start implementing while waiting for the answer. If the user already said to skip previews for this request, or says no, go straight to step 4.

## 3. Preview (if yes)

Delegate to the `ui-ux-designer` agent (it owns mockups and the artifact flow). Brief it with:

- what is being created and who uses it (athlete vs. coach), plus the data it must show;
- relevant existing screens/components to stay consistent with (`apps/web/src/app`, `apps/web/src/components`);
- for motion: the interaction being animated, and the constraint that motion here is dependency-free (CSS transitions/animations + small React helpers, no Framer Motion);
- the requirement: **at least three genuinely different options** (different layout/interaction/motion approach — not three recolors), each labeled (A, B, C…) with a one-line rationale and tradeoff, shown in a single artifact so they can be compared side by side. Animations must actually play in the preview (replay button, hover/focus states).

Share the artifact link and ask which option to build (or what to mix/change). Iterate on the preview if asked; do not write app code until an option is chosen.

## 4. Build

Implement the chosen option in `apps/web`, following existing patterns. For anything involving motion, use the `animation-engineer` agent or follow its rules (transform/opacity only, double rAF, overflow containment on the scrolling ancestor). Terminology must match `docs/terminologia-ui.md`.

Afterwards follow the repo working agreements in `CLAUDE.md` (update `docs/funcionalidades.md` if the feature changed state; push + `deploy-testing` if committing on `testing`).
