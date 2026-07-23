# Obsidian-Inspired Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the VitePress homepage as a dark, Obsidian-inspired personal technical blog while preserving the existing logo and article routes.

**Architecture:** Replace VitePress's stock home hero and feature cards with semantic custom HTML in `docs/index.md`. Keep all visual behavior scoped to `.obsidian-home` in the existing theme stylesheet, and set VitePress to prefer dark appearance at startup.

**Tech Stack:** VitePress 1.6, Markdown with inline HTML, CSS, Node.js built-in assertions.

---

### Task 1: Homepage structure contract

**Files:**
- Create: `scripts/check-homepage.mjs`

- [ ] Add assertions for the retained logo, profile sidebar, article feed, topic navigation, dark appearance, and removed stock hero.
- [ ] Run `node scripts/check-homepage.mjs` and confirm it fails against the old homepage.

### Task 2: Obsidian-inspired content layout

**Files:**
- Modify: `docs/index.md`
- Modify: `docs/.vitepress/config.ts`

- [ ] Replace stock `hero` and `features` frontmatter with the custom two-column homepage.
- [ ] Preserve the existing Logo and real article links.
- [ ] Set VitePress's initial appearance to dark.
- [ ] Run `node scripts/check-homepage.mjs` and confirm it passes.

### Task 3: Responsive visual system

**Files:**
- Modify: `docs/.vitepress/theme/style.css`

- [ ] Add the near-black canvas, blue-violet accents, sticky profile panel, featured story, article rows, and topic links.
- [ ] Add tablet and mobile layouts with stable dimensions and no horizontal overflow.
- [ ] Run `npm run docs:build` and `git diff --check`.
- [ ] Inspect desktop and mobile screenshots in both initial and scrolled states.
