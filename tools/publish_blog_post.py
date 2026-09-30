"""
Publish a blog post (for example, one written in NotebookLM) as a page on aur.neuclix.com
and add it to every partner's dashboard, where partners share it with their own tracking link.

    python tools/publish_blog_post.py post.md --slug utility-refund \
        --title "Could your business be owed a utility refund?" \
        --description "How commercial utility bill errors happen, and how to find out if you're owed money back."

post.md is Markdown. The first "# Heading" becomes the page headline if --title isn't given.
Writes blog/<slug>.html and adds (or updates) a "page" item in partner-kit/kit.json.
Needs:  pip install markdown
"""

import argparse
import html
import json
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://aur.neuclix.com"

CTA = """
<aside class="blog-cta">
  <h2>Find out if you&rsquo;re owed a refund</h2>
  <p>Requesting a review is free, with no upfront cost. AUR is paid a share of refunds and savings only after you receive them.</p>
  <a href="/#contact" class="btn btn--primary">Request a free bill review</a>
</aside>
"""

NOTE = """
<p class="fine-print blog-note">Dollar amounts mentioned are individual examples, not typical results. Results vary; every situation is different.
If someone shared this page with you, they may be an AUR referral partner who may earn a referral fee from AUR, never from you.</p>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("markdown_file")
    ap.add_argument("--slug", required=True, help="page name, e.g. utility-refund")
    ap.add_argument("--title")
    ap.add_argument("--description", default="")
    ap.add_argument("--kit-title", help="title shown on partner dashboards")
    args = ap.parse_args()

    slug = re.sub(r"[^a-z0-9-]", "", args.slug.lower())
    text = Path(args.markdown_file).read_text(encoding="utf-8")
    first = re.match(r"\s*#\s+(.+)\n", text)
    title = args.title or (first.group(1).strip() if first else slug.replace("-", " ").capitalize())
    if first:
        text = text[first.end():]  # the headline is rendered separately
    body = markdown.markdown(text, extensions=["extra", "sane_lists"])
    desc = args.description or re.sub(r"<[^>]+>", "", body).strip().split("\n")[0][:160]

    # Reuse the site's header and footer from the terms page, with absolute paths so /blog/ works
    shell = (ROOT / "referral-terms.html").read_text(encoding="utf-8")
    head, rest = shell.split("<main>", 1)
    foot = rest.split("</main>", 1)[1]
    for attr in ("href", "src"):
        head = re.sub(rf'{attr}="(?!/|https?:|#)([^"]+)"', rf'{attr}="/\1"', head)
        foot = re.sub(rf'{attr}="(?!/|https?:|#)([^"]+)"', rf'{attr}="/\1"', foot)
    url = f"{SITE}/blog/{slug}.html"
    t, d = html.escape(title), html.escape(desc)
    head = re.sub(r"<title>.*?</title>", f"<title>{t} | American Utility Review</title>", head)
    head = re.sub(r'<meta name="description" content="[^"]*">', (
        f'<meta name="description" content="{d}">\n'
        f'<link rel="canonical" href="{url}">\n'
        f'<meta property="og:type" content="article">\n'
        f'<meta property="og:title" content="{t}">\n'
        f'<meta property="og:description" content="{d}">\n'
        f'<meta property="og:url" content="{url}">\n'
        f'<meta property="og:image" content="{SITE}/icon-512.png">\n'
        f'<meta name="twitter:card" content="summary">'), head)

    page = (f'{head}<main>\n<article class="section">\n  <div class="wrap measure prose">\n'
            f'    <div class="eyebrow">American Utility Review</div>\n    <h1 class="h2">{t}</h1>\n'
            f'{body}\n{CTA}{NOTE}  </div>\n</article>\n</main>{foot}')
    out = ROOT / "blog" / f"{slug}.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(page, encoding="utf-8")

    kit_path = ROOT / "partner-kit" / "kit.json"
    kit = json.loads(kit_path.read_text())
    items = [i for i in kit.get("items", []) if i.get("url") != f"/blog/{slug}.html"]
    items.insert(0, {
        "type": "page",
        "url": f"/blog/{slug}.html",
        "title": args.kit_title or f"Blog post: {title}",
        "description": "Share this article. Your link credits you for anyone who requests a review after reading it.",
    })
    kit["items"] = items
    kit_path.write_text(json.dumps(kit, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {out.relative_to(ROOT)} and updated partner-kit/kit.json")


if __name__ == "__main__":
    main()
