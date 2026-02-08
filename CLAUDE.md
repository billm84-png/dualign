# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dualign** ("Dual + Align") is Bill Maggio's fractional executive advisory practice, with the tagline "Leadership in Balance." The business helps CEOs, founders, and C-suite leaders align emotional intelligence (Heart) with analytical rigor (Head). This static marketing website features the Heart & Head leadership framework and an interactive leadership assessment tool.

**Domain**: dualign.io
**Repository**: https://github.com/billm84-png/Dualign
**Hosting**: GitHub Pages (deployed from `main` branch)
**Contact**: Bill Maggio, bill@dualign.io, (475) 239-4925

## Technology Stack

- **HTML5** - Static pages with no build process or templating
- **CSS3** - Single stylesheet (`styles.css`) using CSS custom properties for theming
- **Vanilla JavaScript** - Assessment functionality in `assessment.js`, mobile menu toggle inline
- **Google Fonts** - Inter font family loaded via CDN
- **Google Apps Script** - Backend for lead capture (Google Sheets) and email notifications

## Development

No build tools, package manager, or local server required. Open any HTML file directly in a browser to view.

## Architecture

### Pages
- `index.html` - Homepage with hero section (two-column layout with circular graphic) and assessment CTA
- `about.html` - Bill Maggio bio with headshot, LinkedIn link, stats, and sections: "I've Sat in Your Chair", "Why Dualign", "How I Work", "Now in Your Corner"
- `services.html` - Six service cards (Strategy, Execution, Fractional Leadership & Operating Rhythms, AI Fluency, Board Services, Executive Coaching & Mentoring)
- `framework.html` - Heart & Head framework explanation + embedded assessment modal
- `contact.html` - Contact form (name, email, company, phone, message) with direct contact options; form POSTs to Google Apps Script
- `privacy.html` - Privacy policy (linked from footer only, not in nav)
- `todo.html` - Personal to-do list (private, not linked from nav or footer; accessible at dualign.io/todo.html). Tasks are stored in a "Tasks" tab in the Google Sheet via Apps Script `doGet()`/`doPost()` handlers. Supports add, complete, and delete actions with optimistic UI updates.

### Branding
- **Company name**: Dualign (Dual + Align)
- **Tagline**: "Leadership in Balance"
- **Logo**: `logo.png` - Integrated heart/head emblem with company name and tagline (150px height desktop, 90px mobile)
- **Brand colors**: Navy primary (#1a365d), Heart red (#e53e3e), Head blue (#3182ce)

### CSS Organization
`styles.css` contains all styles organized by section:
- CSS variables in `:root` for theming (`--primary`, `--heart`, `--head`, `--text-*`, `--bg-*`)
- Navigation (desktop and mobile hamburger menu), hero, page headers, services grid, about layout, contact form
- Assessment modal and quadrant visualization styles
- Privacy policy page styles
- Mobile responsive breakpoint at 768px

### Assessment Tool & Lead Capture
The interactive assessment (`assessment.js` + modal in `framework.html`) has a multi-step flow:
1. Intro step
2. 10 rating questions (5 "Heart" + 5 "Head" category)
3. Lead capture form (with "Email me a copy of my results" checkbox)
4. Results with quadrant visualization

Key functions: `openAssessment()`, `startAssessment()`, `renderQuestion()`, `selectRating()`, `submitLead()`, `showResults()`, `getProfile()`

The assessment auto-opens when navigating to `framework.html#assessment`.

**Lead capture flow**: On form submission, `submitLead()` POSTs lead data (name, email, company, role, scores, profile type) to a Google Apps Script endpoint which:
- Appends the lead to a Google Sheet (serves as the lead database)
- Sends an email notification to bill@dualign.io
- Optionally emails the user a copy of their results

The Google Apps Script URL is configured as `GOOGLE_SCRIPT_URL` at the top of `assessment.js`. Setup instructions are in `GOOGLE_SHEETS_SETUP.md`.

### Contact Form & Inquiry Capture
The contact form (`contact.html`) POSTs to the same Google Apps Script endpoint as the assessment. The payload includes `type: 'contact'` so the script routes it to the "Contact Inquiries" sheet tab (separate from assessment leads). On submission:
- The inquiry is appended to the "Contact Inquiries" Google Sheet tab
- Bill receives an email notification (with `replyTo` set to the submitter's address)
- The submitter receives an auto-confirmation email

The `GOOGLE_SCRIPT_URL` is duplicated in an inline `<script>` in `contact.html` (same URL as `assessment.js`). Both assessment and contact emails are sent via `GmailApp.sendEmail()` from bill@dualign.io (configured as a Gmail alias using Porkbun SMTP).

### Shared Components
- **Navigation**: All pages share the same nav structure with logo image link to home, nav links (Home, About, Services, Framework, Assessment, Contact), and mobile hamburger menu for screens ≤768px. Privacy policy is deliberately excluded from nav.
- **Footer**: Duplicated HTML across pages with Dualign branding, tagline, and links (About, Services, Framework, Contact, Privacy Policy)
- **Mobile menu**: Toggle script included inline at bottom of each HTML file

### Assets
- `logo.png` - Dualign logo with integrated heart/head emblem, used in navigation
- `headshot.jpg` - Bill Maggio's professional headshot used on About page
