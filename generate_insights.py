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
import time
import urllib.error
import urllib.parse
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


# Substack sits behind Cloudflare, which 403s bot-like User-Agents from
# datacenter IPs (e.g. GitHub Actions runners). Send realistic browser headers.
BROWSER_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_feed(url=FEED_URL, attempts=3):
    last_err = None
    for i in range(attempts):
        req = urllib.request.Request(url, headers=BROWSER_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code not in (403, 429, 503) or i == attempts - 1:
                raise
            time.sleep(2 * (i + 1))
    raise last_err


def strip_html(raw):
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_image(url):
    """Collapse a Substack CDN image URL to its underlying S3 original so the
    value is identical no matter which source produced it. The direct feed and
    rss2json wrap the same image with different Cloudflare transforms
    ($s_ vs %24s_, w_1456, etc.); without this the two sources would fight over
    insights.html on every alternating run."""
    if not url:
        return ""
    marker = "/image/fetch/"
    i = url.find(marker)
    if i == -1:
        return url
    rest = url[i + len(marker):]
    parts = rest.split("/", 1)  # [transform, encoded_original]
    if len(parts) == 2 and ("%3A" in parts[1] or parts[1].startswith("http")):
        return urllib.parse.unquote(parts[1])
    return url


def truncate_excerpt(desc):
    desc = (desc or "").strip()
    if len(desc) <= EXCERPT_CHARS:
        return desc
    cut = desc[:EXCERPT_CHARS].rsplit(" ", 1)[0].rstrip(",.;:")
    return cut + "…"


def pick_topic(haystack):
    haystack = (haystack or "").lower()
    for keywords, label in TOPIC_RULES:
        if any(k in haystack for k in keywords):
            return label
    return DEFAULT_TOPIC


def parse_date(raw):
    """Handle RFC-822 (direct RSS) and 'YYYY-MM-DD HH:MM:SS' (rss2json)."""
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        dt = None
    if dt is None:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(raw, fmt)
                break
            except ValueError:
                continue
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def build_item(title, link, description_html, content_html, pub_raw, image):
    """Normalize one post (from either source) into the render dict."""
    title = strip_html(title)
    link = (link or "").strip()
    if not title or not link:
        return None
    desc = strip_html(description_html) or strip_html(content_html)
    if not image and content_html:
        m = re.search(r'<img[^>]+src="([^"]+)"', content_html)
        if m:
            image = m.group(1)
    dt = parse_date(pub_raw)
    return {
        "title": title,
        "link": link,
        "excerpt": truncate_excerpt(desc),
        "topic": pick_topic(title + " " + (description_html or "")),
        "image": normalize_image(image),
        "date_human": dt.strftime("%B %-d, %Y") if dt else "",
        "date_iso": dt.date().isoformat() if dt else "",          # date-only, for sitemap lastmod
        "date_jsonld": dt.isoformat() if dt else "",              # full ISO-8601 w/ tz, for datePublished
    }


def items_from_xml(xml_bytes):
    # Defense-in-depth: stdlib ElementTree disables external entity loading, but
    # reject DOCTYPE/ENTITY declarations outright to neutralize XXE and
    # billion-laughs entity-expansion. Legitimate RSS never declares these.
    head = xml_bytes[:4096].lower()
    if b"<!doctype" in head or b"<!entity" in xml_bytes.lower():
        raise ValueError("feed contains a DOCTYPE/ENTITY declaration; refusing to parse.")
    root = ET.fromstring(xml_bytes)
    items = []
    for el in root.findall(".//item")[:MAX_ARTICLES]:
        content_el = el.find("content:encoded", CONTENT_NS)
        content_html = content_el.text if content_el is not None else ""
        enc = el.find("enclosure")
        image = enc.get("url") if (enc is not None and enc.get("url")) else ""
        item = build_item(el.findtext("title"), el.findtext("link"),
                          el.findtext("description"), content_html,
                          el.findtext("pubDate"), image)
        if item:
            items.append(item)
    return items


def items_from_rss2json():
    """Fallback for environments where Substack's Cloudflare blocks the source
    IP directly (e.g. GitHub Actions). rss2json fetches server-side and returns
    normalized JSON; the free tier needs no key for low request volume."""
    url = "https://api.rss2json.com/v1/api.json?rss_url=" + urllib.parse.quote(FEED_URL, safe="")
    req = urllib.request.Request(url, headers=BROWSER_HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    if data.get("status") != "ok":
        raise ValueError(f"rss2json status={data.get('status')}")
    items = []
    for it in data.get("items", [])[:MAX_ARTICLES]:
        image = it.get("thumbnail") or (it.get("enclosure") or {}).get("link") or ""
        item = build_item(it.get("title"), it.get("link"),
                          it.get("description"), it.get("content"),
                          it.get("pubDate"), image)
        if item:
            items.append(item)
    return items


def get_items():
    """Try the Substack feed directly (works locally / dependency-free); on any
    failure fall back to rss2json (works from blocked datacenter IPs)."""
    try:
        print(f"Fetching {FEED_URL} directly ...")
        items = items_from_xml(fetch_feed())
        if items:
            print(f"  source: direct RSS ({len(items)} articles)")
            return items
        print("  direct RSS returned 0 items; trying fallback ...")
    except Exception as e:
        print(f"  direct RSS failed ({e}); trying rss2json fallback ...")
    items = items_from_rss2json()
    print(f"  source: rss2json fallback ({len(items)} articles)")
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


def render_home_cards(items, limit=3):
    """Compact teaser cards for the homepage, matching the .linkedin-card look
    (no images) used by the adjacent 'Latest Insights' section."""
    if not items:
        return ('                <p class="insights-empty">Latest essays are loading. '
                'Read them on <a href="insights.html">Insights</a>.</p>')
    cards = []
    for a in items[:limit]:
        title = html.escape(a["title"])
        excerpt = html.escape(a["excerpt"])
        topic = html.escape(a["topic"])
        link = html.escape(a["link"], quote=True)
        cards.append(
            f'                <a href="{link}" target="_blank" rel="noopener noreferrer" class="linkedin-card">\n'
            f'                    <span class="linkedin-topic">{topic}</span>\n'
            f'                    <h3>{title}</h3>\n'
            f'                    <p>{excerpt}</p>\n'
            f'                    <span class="linkedin-read-more">Read on Substack &rarr;</span>\n'
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
        if a["date_jsonld"]:
            post["datePublished"] = a["date_jsonld"]
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
    items = get_items()
    if not items:
        sys.exit("ERROR: no articles from any source; leaving files unchanged.")

    update_file("insights.html", "<!-- ARTICLES:START -->", "<!-- ARTICLES:END -->",
                render_cards(items), "insights.html (articles)")
    update_file("insights.html", "<!-- INSIGHTS-JSONLD:START -->", "<!-- INSIGHTS-JSONLD:END -->",
                render_jsonld(items), "insights.html (json-ld)")

    if (ROOT / "index.html").exists():
        update_file("index.html", "<!-- HOME-ARTICLES:START -->", "<!-- HOME-ARTICLES:END -->",
                    render_home_cards(items), "index.html (home teaser)")

    if (ROOT / "llms-full.txt").exists():
        update_file("llms-full.txt", "<!-- insights:start -->", "<!-- insights:end -->",
                    render_llms_section(items), "llms-full.txt")

    update_sitemap(items)
    print("Done.")


if __name__ == "__main__":
    main()
