# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static marketing website for Bill Maggio's fractional executive advisory service targeting CEOs, founders, and C-suite leaders of small and mid-sized companies. The site features a "Heart & Head" leadership framework and includes an interactive leadership assessment tool.

## Technology Stack

- **HTML5** - Static pages with no build process or templating
- **CSS3** - Single stylesheet (`styles.css`) using CSS custom properties for theming
- **Vanilla JavaScript** - Assessment functionality in `assessment.js`, mobile menu toggle inline
- **Google Fonts** - Inter font family loaded via CDN

## Development

No build tools, package manager, or local server required. Open any HTML file directly in a browser to view.

## Architecture

### Pages
- `index.html` - Homepage with hero section (two-column layout with circular graphic) and assessment CTA
- `about.html` - Bill Maggio bio with headshot, stats, credentials, and "I've Sat in Your Chair" narrative
- `services.html` - Six service cards (Strategy, Execution, Fractional Leadership & Operating Rhythms, AI Fluency, Board Services, Executive Coaching & Mentoring)
- `framework.html` - Heart & Head framework explanation + embedded assessment modal
- `contact.html` - Contact form

### Services Offered
1. Strategy Development
2. Execution Excellence
3. Fractional Leadership & Operating Rhythms
4. AI Fluency for Enterprise (including agentic AI workflow design)
5. Board Services (Corporate, Advisory, and GSC director for FOCI-mitigated companies)
6. Executive Coaching & Mentoring

### Marketing Messaging
Key hooks used sparingly throughout (from `Marketing Hooks for Fractional Operations.docx`):
- Homepage headline: "You Built the Business. Let's Make Sure It Doesn't Break You."
- About tagline: "Fractional Executive & Strategic Advisor"
- Services tagline: "All the experience. None of the overhead."

### CSS Organization
`styles.css` contains all styles organized by section:
- CSS variables in `:root` for theming (`--primary`, `--heart`, `--head`, `--text-*`, `--bg-*`)
- Navigation (desktop and mobile hamburger menu), hero, page headers, services grid, about layout, contact form
- Headshot styling with border-radius and shadow
- Assessment modal and quadrant visualization styles
- Mobile responsive breakpoint at 768px

### Assessment Tool
The interactive assessment (`assessment.js` + modal in `framework.html`) has a multi-step flow:
1. Intro step
2. 10 rating questions (5 "Heart" + 5 "Head" category)
3. Lead capture form
4. Results with quadrant visualization

Key functions: `openAssessment()`, `startAssessment()`, `renderQuestion()`, `selectRating()`, `showResults()`, `getProfile()`

The assessment auto-opens when navigating to `framework.html#assessment`.

### Shared Components
- **Navigation**: All pages share the same nav structure (Home, About, Services, Framework, Assessment, Contact) with mobile hamburger menu for screens ≤768px
- **Footer**: Duplicated HTML across pages (no templating)
- **Mobile menu**: Toggle script included inline at bottom of each HTML file

### Assets
- `headshot.jpg` - Bill Maggio's professional headshot used on About page
