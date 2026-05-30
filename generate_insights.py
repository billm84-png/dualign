#!/usr/bin/env python3
"""
Generate the Insights page from Bill Maggio's Substack RSS feed.

Fetches https://williamjmaggio.substack.com/feed, then rewrites the
marker-delimited regions in:
  - insights.html   (article card grid + Blog/BlogPosting JSON-LD)
  - llms-full.txt   (Insights section for AI search engines)
  - sitemap.xml     (lastmod for the insights.html entry)

The page links OUT to each article on Substack (Substack stays canonical,
which grows subscribers and avoids duplicate-content penalties) while the
excerpt text + structured data live on dualign.io for SEO / AEO / GEO value.

No third-party dependencies — Python standard library only, so it runs
unchanged in GitHub Actions. Regenerate locally with:  python3 generate_insights.py
"""

import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

FEED_URL = "https://williamjmaggio.substack.com/feed"
SITE_ORIGIN = "https://dualign.io"
SUBSTACK_HOME = "https://williamjmaggio.substack.com/"
MAX_ARTICLES = 12
EXCERPT_CHARS = 240

ROOT = Path(__file__).resolve().parent
CONTENT_NS = {"content": "http://purl.org/rss/1.0/modules/content/"}

# Keyword -> topic label. First match wins; order matters.
TOPIC_RULES = [
    (("governance", "national security", "foci", "compliance", "regulat"), "AI Governance"),
    (("ai", "algorithm", "automat", "machine"), "AI & Leadership"),
    (("mentor", "culture", "talent", "team", "people", "trust"), "Leadership & Culture"),
    (("operat", "execution", "scaling", "scale", "process"), "Operations"),
]
DEFAULT_TOPIC = "Leadership"


def fetch_feed(url=FEED_URL):
    req = urllib.request.Request(url, headers={"User-Agent": "DualignInsightsBot/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def strip_html(raw):
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def make_excerpt(item):
    desc = strip_html(item.findtext("description") or "")
    if not desc:
        content_el = item.find("content:encoded", CONTENT_NS)
        desc = strip_html(content_el.text if content_el is not None else "")
    if len(desc) <= EXCERPT_CHARS:
        return desc
    cut = desc[:EXCERPT_CHARS].rsplit(" ", 1)[0].rstrip(",.;:")
    return cut + "…"


def pick_topic(item):
    haystack = ((item.findtext("title") or "") + " " +
                (item.findtext("description") or "")).lower()
    for keywords, label in TOPIC_RULES:
        if any(k in haystack for k in keywords):
            return label
    return DEFAULT_TOPIC


def first_image(item):
    enc = item.find("enclosure")
    if enc is not None and enc.get("url"):
        return enc.get("url")
    content_el = item.find("content:encoded", CONTENT_NS)
    if content_el is not None and content_el.text:
        m = re.search(r'<img[^>]+src="([^"]+)"', content_el.text)
        if m:
            return m.group(1)
    return ""


def parse_items(xml_bytes):
    # Defense-in-depth: stdlib ElementTree disables external entity loading, but
    # reject DOCTYPE/ENTITY declarations outright to neutralize XXE and
    # billion-laughs entity-expansion. Legitimate RSS never declares these.
    head = xml_bytes[:4096].lower()
    if b"<!doctype" in head or b"<!entity" in xml_bytes.lower():
        sys.exit("ERROR: feed contains a DOCTYPE/ENTITY declaration; refusing to parse.")
    root = ET.fromstring(xml_bytes)
    items = []
    for el in root.findall(".//item")[:MAX_ARTICLES]:
        title = strip_html(el.findtext("title") or "")
        link = (el.findtext("link") or "").strip()
        if not title or not link:
            continue
        pub_raw = el.findtext("pubDate") or ""
        try:
            pub_dt = parsedate_to_datetime(pub_raw)
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            pub_dt = None
        items.append({
            "title": title,
            "link": link,
            "excerpt": make_excerpt(el),
            "topic": pick_topic(el),
            "image": first_image(el),
            "date_human": pub_dt.strftime("%B %-d, %Y") if pub_dt else "",
            "date_iso": pub_dt.date().isoformat() if pub_dt else "",
        })
    return items


def render_cards(items):
    if not items:
        return ('                <p class="insights-empty">Latest essays are loading. '
                f'Read them all on <a href="{SUBSTACK_HOME}">Substack</a>.</p>')
    cards = []
    for a in items:
        title = html.escape(a["title"])
        excerpt = html.escape(a["excerpt"])
        topic = html.escape(a["topic"])
        link = html.escape(a["link"], quote=True)
        img = html.escape(a["image"], quote=True)
        date = html.escape(a["date_human"])
        img_html = (f'                    <img class="insight-card-image" src="{img}" '
                    f'alt="{title}" loading="lazy">\n') if img else ""
        meta = f'<span class="insight-topic">{topic}</span>'
        if date:
            meta += f'<span class="insight-date">{date}</span>'
        cards.append(
            f'                <a href="{link}" target="_blank" rel="noopener noreferrer" class="insight-card">\n'
            f'{img_html}'
            f'                    <div class="insight-card-body">\n'
            f'                        <div class="insight-meta">{meta}</div>\n'
            f'                        <h3>{title}</h3>\n'
            f'                        <p class="insight-excerpt">{excerpt}</p>\n'
            f'                        <span class="insight-read-more">Read on Substack &rarr;</span>\n'
            f'                    </div>\n'
            f'                </a>'
        )
    return "\n".join(cards)


def render_jsonld(items):
    blog_posts = []
    for a in items:
        post = {
            "@type": "BlogPosting",
            "headline": a["title"],
            "description": a["excerpt"],
            "url": a["link"],
            "mainEntityOfPage": a["link"],
            "author": {
                "@type": "Person",
                "@id": f"{SITE_ORIGIN}/about.html#bill-maggio",
                "name": "Bill Maggio",
            },
            "publisher": {
                "@type": "Organization",
                "@id": f"{SITE_ORIGIN}/#organization",
                "name": "Dualign",
            },
        }
        if a["date_iso"]:
            post["datePublished"] = a["date_iso"]
        if a["image"]:
            post["image"] = a["image"]
        blog_posts.append(post)

    blog = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": f"{SITE_ORIGIN}/insights.html#blog",
        "name": "Dualign Insights",
        "description": "Long-form essays on leadership, operations, culture, and AI governance from Bill Maggio, founder of Dualign.",
        "url": f"{SITE_ORIGIN}/insights.html",
        "publisher": {
            "@type": "Organization",
            "@id": f"{SITE_ORIGIN}/#organization",
            "name": "Dualign",
        },
        "author": {
            "@type": "Person",
            "@id": f"{SITE_ORIGIN}/about.html#bill-maggio",
            "name": "Bill Maggio",
        },
        "blogPost": blog_posts,
    }
    body = json.dumps(blog, indent=8, ensure_ascii=False)
    body = "\n".join(("    " + line if line else line) for line in body.split("\n"))
    return ('    <script type="application/ld+json">\n'
            f'{body}\n'
            '    </script>')


def replace_region(text, start_marker, end_marker, new_inner, label):
    pattern = re.compile(re.escape(start_marker) + r".*?" + re.escape(end_marker), re.DOTALL)
    if not pattern.search(text):
        sys.exit(f"ERROR: markers {start_marker} / {end_marker} not found in {label}")
    return pattern.sub(f"{start_marker}\n{new_inner}\n{end_marker}", text)


def render_llms_section(items):
    lines = ["## Writing & Insights", "",
             "Bill Maggio publishes long-form essays on leadership, operating discipline, "
             "culture, and AI governance. Read the full archive at "
             "https://williamjmaggio.substack.com/ or the curated list at "
             f"{SITE_ORIGIN}/insights.html.", ""]
    for a in items:
        date = f" ({a['date_human']})" if a["date_human"] else ""
        lines.append(f"- **{a['title']}**{date}: {a['excerpt']} {a['link']}")
    return "\n".join(lines)


def update_file(path, start, end, inner, label):
    p = ROOT / path
    text = p.read_text(encoding="utf-8")
    updated = replace_region(text, start, end, inner, label)
    if updated != text:
        p.write_text(updated, encoding="utf-8")
        print(f"updated {path}")
    else:
        print(f"no change to {path}")


def update_sitemap(items):
    p = ROOT / "sitemap.xml"
    if not p.exists():
        return
    lastmod = items[0]["date_iso"] if items and items[0]["date_iso"] else \
        datetime.now(timezone.utc).date().isoformat()
    text = p.read_text(encoding="utf-8")
    insights_url = f"{SITE_ORIGIN}/insights.html"
    block_re = re.compile(
        r"(<url>\s*<loc>" + re.escape(insights_url) + r"</loc>\s*<lastmod>)([^<]*)(</lastmod>)")
    if block_re.search(text):
        new_text = block_re.sub(r"\g<1>" + lastmod + r"\g<3>", text)
    else:
        entry = (f"  <url>\n    <loc>{insights_url}</loc>\n"
                 f"    <lastmod>{lastmod}</lastmod>\n    <priority>0.9</priority>\n  </url>\n")
        new_text = text.replace("</urlset>", entry + "</urlset>")
    if new_text != text:
        p.write_text(new_text, encoding="utf-8")
        print("updated sitemap.xml")
    else:
        print("no change to sitemap.xml")


def main():
    print(f"Fetching {FEED_URL} ...")
    items = parse_items(fetch_feed())
    print(f"Parsed {len(items)} article(s).")

    update_file("insights.html", "<!-- ARTICLES:START -->", "<!-- ARTICLES:END -->",
                render_cards(items), "insights.html (articles)")
    update_file("insights.html", "<!-- INSIGHTS-JSONLD:START -->", "<!-- INSIGHTS-JSONLD:END -->",
                render_jsonld(items), "insights.html (json-ld)")

    if (ROOT / "llms-full.txt").exists():
        update_file("llms-full.txt", "<!-- insights:start -->", "<!-- insights:end -->",
                    render_llms_section(items), "llms-full.txt")

    update_sitemap(items)
    print("Done.")


if __name__ == "__main__":
    main()
