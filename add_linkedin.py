#!/usr/bin/env python3
"""
Add (or manage) a LinkedIn post on the homepage "Latest Insights" section.

LinkedIn has no usable public RSS for a personal profile and no official API
for arbitrary member feeds, so this stays a curated, one-command step rather
than a hands-free feed like Substack. `linkedin_posts.json` is the source of
truth (newest first); this script regenerates three marker-delimited regions
from it so they never drift:
  - index.html  <!-- LINKEDIN-CARDS:START/END -->   (the visible cards)
  - index.html  <!-- LINKEDIN-JSONLD:START/END -->  (the ItemList JSON-LD)
  - llms-full.txt <!-- linkedin:start/end -->        (the AI-search list)

Typical use (after Claude reads the post and drafts copy in Bill's voice):
  python3 add_linkedin.py <post-url> --topic "Leadership" \
      --title "Headline." --blurb "Two or three sentence summary."

Other modes:
  python3 add_linkedin.py <url> --fetch     # best-effort: pull og: title/desc as a starting point
  python3 add_linkedin.py --render          # rebuild the 3 regions from the JSON (no add)
  python3 add_linkedin.py --list            # show current posts
  python3 add_linkedin.py --remove <url>    # drop a post by URL

By default only the newest --max (3) posts are shown on the homepage.
Stdlib only — no pip installs.
"""

import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "linkedin_posts.json"
INDEX = ROOT / "index.html"
LLMS = ROOT / "llms-full.txt"
DEFAULT_MAX = 3

BROWSER_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
}


# ---------- data ----------

def load_posts():
    if not DATA.exists():
        return []
    return json.loads(DATA.read_text(encoding="utf-8"))


def save_posts(posts):
    DATA.write_text(json.dumps(posts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def clean_url(url):
    return (url or "").strip()


# ---------- best-effort metadata fetch ----------

def fetch_og(url):
    """Pull og:title / og:description as *suggested* defaults. LinkedIn often
    serves these even without login, but it is not guaranteed — review output."""
    try:
        req = urllib.request.Request(url, headers=BROWSER_HEADERS)
        with urllib.request.urlopen(req, timeout=30) as resp:
            page = resp.read().decode("utf-8", "ignore")
    except Exception as e:
        print(f"  (--fetch failed: {e})")
        return {}
    def meta(prop):
        m = re.search(r'<meta[^>]+property="og:%s"[^>]+content="([^"]*)"' % prop, page)
        return html.unescape(m.group(1)).strip() if m else ""
    title = meta("title")
    # LinkedIn prefixes og:title with "Author on LinkedIn: ..."
    title = re.sub(r"^.*? on LinkedIn:\s*", "", title).strip().strip('"')
    return {"title": title, "blurb": meta("description")}


# ---------- rendering ----------

def render_cards(posts):
    cards = []
    for p in posts:
        url = html.escape(p["url"], quote=True)               # attribute: escape quotes too
        topic = html.escape(p.get("topic", "Leadership"), quote=False)  # text content: leave ' and " literal
        title = html.escape(p["title"], quote=False)
        blurb = html.escape(p["blurb"], quote=False)
        cards.append(
            f'                <a href="{url}" target="_blank" rel="noopener noreferrer" class="linkedin-card">\n'
            f'                    <span class="linkedin-topic">{topic}</span>\n'
            f'                    <h3>{title}</h3>\n'
            f'                    <p>{blurb}</p>\n'
            f'                    <span class="linkedin-read-more">Read on LinkedIn &rarr;</span>\n'
            f'                </a>'
        )
    return "\n".join(cards)


def render_jsonld(posts):
    items = []
    for i, p in enumerate(posts, start=1):
        items.append({
            "@type": "ListItem",
            "position": i,
            "item": {
                "@type": "Article",
                "headline": p["title"],
                "author": {
                    "@type": "Person",
                    "@id": "https://dualign.io/about.html#bill-maggio",
                    "name": "Bill Maggio",
                },
                "publisher": {
                    "@type": "Organization",
                    "@id": "https://dualign.io/#organization",
                    "name": "Dualign",
                },
                "about": p.get("topic", "Leadership"),
                "url": p["url"],
            },
        })
    obj = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Latest Insights",
        "itemListElement": items,
    }
    body = json.dumps(obj, indent=4, ensure_ascii=False)
    body = "\n".join(("    " + line if line else line) for line in body.split("\n"))
    return '    <script type="application/ld+json">\n' + body + '\n    </script>'


def render_llms(posts):
    return "\n\n".join(f"{i}. **{p['title']}** {p['blurb']}"
                       for i, p in enumerate(posts, start=1))


# ---------- marker replacement ----------

def replace_region(text, start, end, inner, label):
    pat = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    if not pat.search(text):
        sys.exit(f"ERROR: markers {start} / {end} not found in {label}")
    return pat.sub(f"{start}\n{inner}\n{end}", text)


def write_region(path, start, end, inner, label):
    text = path.read_text(encoding="utf-8")
    updated = replace_region(text, start, end, inner, label)
    if updated != text:
        path.write_text(updated, encoding="utf-8")
        print(f"updated {path.name}")
    else:
        print(f"no change to {path.name}")


def render_all(posts):
    write_region(INDEX, "<!-- LINKEDIN-CARDS:START -->", "<!-- LINKEDIN-CARDS:END -->",
                 render_cards(posts), "index.html (cards)")
    write_region(INDEX, "<!-- LINKEDIN-JSONLD:START -->", "<!-- LINKEDIN-JSONLD:END -->",
                 render_jsonld(posts), "index.html (json-ld)")
    write_region(LLMS, "<!-- linkedin:start -->", "<!-- linkedin:end -->",
                 render_llms(posts), "llms-full.txt")


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser(description="Manage homepage LinkedIn Latest Insights cards.")
    ap.add_argument("url", nargs="?", help="LinkedIn post URL to add")
    ap.add_argument("--title", help="card headline")
    ap.add_argument("--topic", help='topic tag (e.g. "Leadership", "AI Governance")')
    ap.add_argument("--blurb", help="2-3 sentence summary in Bill's voice")
    ap.add_argument("--fetch", action="store_true", help="best-effort pull og: title/desc as defaults")
    ap.add_argument("--max", type=int, default=DEFAULT_MAX, help=f"posts shown on homepage (default {DEFAULT_MAX})")
    ap.add_argument("--list", action="store_true", help="list current posts and exit")
    ap.add_argument("--render", action="store_true", help="rebuild regions from JSON, no add")
    ap.add_argument("--remove", metavar="URL", help="remove a post by URL")
    args = ap.parse_args()

    posts = load_posts()

    if args.list:
        for i, p in enumerate(posts, 1):
            print(f"{i}. [{p.get('topic','?')}] {p['title']}\n   {p['url']}")
        return

    if args.remove:
        target = clean_url(args.remove)
        before = len(posts)
        posts = [p for p in posts if p["url"] != target]
        if len(posts) == before:
            sys.exit(f"ERROR: URL not found: {target}")
        save_posts(posts)
        render_all(posts)
        print(f"Removed. {len(posts)} post(s) remain.")
        return

    if args.render:
        render_all(posts[:args.max])
        print(f"Rendered {min(len(posts), args.max)} post(s).")
        return

    if not args.url:
        ap.error("provide a post URL, or use --list / --render / --remove")

    url = clean_url(args.url)
    title, blurb, topic = args.title, args.blurb, args.topic
    if args.fetch and (not title or not blurb):
        og = fetch_og(url)
        title = title or og.get("title") or ""
        blurb = blurb or og.get("blurb") or ""
        print(f"  fetched title: {title!r}")
        print(f"  fetched blurb: {blurb[:80]!r}...")

    if not title or not blurb:
        sys.exit("ERROR: need --title and --blurb (or --fetch that succeeds). "
                 "Topic defaults to 'Leadership' if omitted.")

    entry = {"url": url, "topic": topic or "Leadership", "title": title.strip(), "blurb": blurb.strip()}
    # de-dupe by URL, then prepend as newest
    posts = [p for p in posts if p["url"] != url]
    posts.insert(0, entry)
    save_posts(posts)
    render_all(posts[:args.max])
    print(f'Added "{entry["title"]}" as newest. Homepage shows {min(len(posts), args.max)} of {len(posts)}.')


if __name__ == "__main__":
    main()
