# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dualign** ("Dual + Align") is Bill Maggio's fractional executive advisory practice, with the tagline "Leadership in Balance." The business helps CEOs, founders, and C-suite leaders align emotional intelligence (Heart) with analytical rigor (Head). This static marketing website features the Heart & Head leadership framework and an interactive Executive Alignment Risk Scan.

**Domain**: dualign.io
**Repository**: https://github.com/billm84-png/Dualign
**Hosting**: GitHub Pages (deployed from `main` branch)
**Contact**: Bill Maggio, bill@dualign.io, (475) 239-4925

## Development

No build tools, package manager, or local server required. Open any HTML file directly in a browser to view. Deploy by pushing to `main` — GitHub Pages serves from the root.

## Architecture

### File Layout

- 7 HTML pages (index, about, services, framework, contact, privacy, todo)
- `styles.css` — single stylesheet, CSS custom properties in `:root` for theming
- `assessment.js` — interactive Executive Alignment Risk Scan (modal in `framework.html`)
- `logo.png`, `headshot.jpg` — static assets

### Key Patterns to Know

**Nav and footer are duplicated across all HTML files.** There is no templating. When changing navigation links, footer content, or the mobile menu script, you must update every HTML file. The nav includes: Home, About, Services, Framework, Assessment, Contact. Privacy is footer-only, not in nav. `todo.html` is deliberately hidden from both nav and footer.

**`class="active"` on nav links**: about, services, framework, and contact pages each mark their own nav link with `class="active"`. `index.html`, `privacy.html`, and `todo.html` do not set an active nav link. Maintain this convention when editing nav markup.

**`GOOGLE_SCRIPT_URL` is defined in three places** — it must stay in sync:
- `assessment.js` (line 2, top-level const)
- `contact.html` (inline `<script>`, used for the contact form)
- `todo.html` (inline `<script>`, used for the to-do list)

All three POST to the same Google Apps Script endpoint. The script routes by `type` field: `'contact'` → Contact Inquiries sheet, `'todo'` → Tasks sheet, `'assessment'` → Assessment Leads sheet.

**Mobile menu toggle** is an inline `<script>` at the bottom of every HTML page (identical 3-line snippet toggling `.active` on `.mobile-menu-btn` and `.nav-links`).

### Assessment Flow (assessment.js + framework.html)

Multi-step modal: Intro → 10 rating questions (5 Heart, 5 Head) → Lead capture form → Results with quadrant visualization. Auto-opens via `framework.html#assessment`. Each question has a `riskLabel` property shown as context. Scores are percentages of 25 (5 questions × max 5 rating).

**Zone-based profile types** (based on total score out of 50):
- **High-Performance Zone** (total ≥ 40): balanced, heart-heavy, or head-heavy variants
- **Friction Zone** (total 25–39): culture-strong/systems-weak, systems-strong/culture-fragile, or general
- **Fracture Zone** (total < 25): single variant

Within zones, heart/head percentage thresholds (≥60% or <60%) determine the specific variant.

### Backend (Google Apps Script)

A single Google Apps Script endpoint handles all form submissions. Setup details are in `GOOGLE_SHEETS_SETUP.md`. The script uses `GmailApp.sendEmail()` with a Gmail alias (bill@dualign.io via Porkbun SMTP) for all outbound email. Google Sheet has three tabs: "Assessment Leads", "Contact Inquiries", "Tasks". Assessment submissions include a `sendCopy` flag — when checked, the user receives their results via email.

### Branding

- **Brand colors**: Navy primary (`--primary`: #1a365d), Heart red (`--heart`: #e53e3e), Head blue (`--head`: #3182ce)
- **Font**: Inter (Google Fonts CDN)
- **Logo**: `logo.png` — 150px height desktop, 90px mobile
- **Responsive breakpoint**: 768px (mobile hamburger menu)
