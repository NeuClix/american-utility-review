"""
Generate partner marketing materials from the AUR NotebookLM notebook and add them to the
partner dashboard's "Marketing kit".

Run this on YOUR computer (where you're logged in to NotebookLM), from the repo folder:

    pip install notebooklm-py
    notebooklm login                      # only if you're not logged in yet
    python tools/notebooklm_partner_kit.py
    git add partner-kit && git commit -m "Update partner marketing kit" && git push

Vercel publishes the push automatically, and the files appear on every partner's dashboard.
Review each file before pushing: partners will share them publicly.

Uses the unofficial notebooklm-py library (https://github.com/teng-lin/notebooklm-py);
if Google changes NotebookLM, options below may need small tweaks.
"""

import asyncio
import json
import sys
from pathlib import Path

from notebooklm import NotebookLMClient

NOTEBOOK_ID = "5fa38cf3-d35f-439d-bc21-6d1e899a19f8"
KIT_DIR = Path(__file__).resolve().parent.parent / "partner-kit"

# Shared guardrails so generated materials stay accurate and compliant
RULES = (
    "Audience: business owners and managers who might need a utility bill review. "
    "Present American Utility Review (AUR) as independent commercial utility auditors since 1986 who review "
    "electric, gas and water/sewer bills for billing errors, overcharges and better rates, and help recover refunds. "
    "Only use facts from the sources. Do not promise or guarantee savings or refunds, do not invent statistics or "
    "percentages, and do not name specific clients. The call to action is to request a free bill review at "
    "aur.neuclix.com."
)

# What to generate: (key, kit entry, generator)
JOBS = [
    {
        "file": "aur-explainer.mp3",
        "type": "audio",
        "title": "Audio: What a utility bill review is (about 5 minutes)",
        "description": "A short listen that explains how AUR finds billing errors and refunds. Great to send to a business owner.",
        "make": lambda c: c.artifacts.generate_audio(
            NOTEBOOK_ID, format="brief", length="short", language="en",
            instructions=RULES + " Keep it friendly and plain-spoken, for a busy business owner.",
        ),
        "download": lambda c, path: c.artifacts.download_audio(NOTEBOOK_ID, str(path)),
    },
    {
        "file": "aur-infographic.png",
        "type": "image",
        "title": "Infographic: How AUR finds money in your utility bills",
        "description": "One image to post on social media or attach to an email.",
        "make": lambda c: c.artifacts.generate_infographic(NOTEBOOK_ID, orientation="portrait", detail="medium"),
        "download": lambda c, path: c.artifacts.download_infographic(NOTEBOOK_ID, str(path)),
    },
    {
        "file": "aur-overview-slides.pdf",
        "type": "slides",
        "title": "Slides: AUR overview",
        "description": "A short presentation for meetings with business owners, accountants or groups.",
        "make": lambda c: c.artifacts.generate_slide_deck(NOTEBOOK_ID, format="presenter", length="short"),
        "download": lambda c, path: c.artifacts.download_slide_deck(NOTEBOOK_ID, str(path)),
    },
    {
        "file": "aur-partner-brief.md",
        "type": "doc",
        "title": "Partner brief: talking points and FAQs",
        "description": "Plain-language answers to the questions business owners ask most.",
        "make": lambda c: c.artifacts.generate_report(
            NOTEBOOK_ID, template="briefing-doc",
            extra_instructions=RULES + " Write it for referral partners: a short explanation of AUR, 8-10 FAQs "
            "a business owner might ask with plain answers, and a reminder that partners must tell people "
            "they may earn a referral fee.",
        ),
        "download": lambda c, path: c.artifacts.download_report(NOTEBOOK_ID, str(path)),
    },
]


async def main(only):
    KIT_DIR.mkdir(exist_ok=True)
    kit_path = KIT_DIR / "kit.json"
    kit = json.loads(kit_path.read_text()) if kit_path.exists() else {"items": []}
    items = {i["file"]: i for i in kit.get("items", [])}

    async with await NotebookLMClient.from_storage() as client:
        for job in JOBS:
            if only and job["type"] not in only:
                continue
            print(f"Generating {job['file']} ...", flush=True)
            try:
                status = await job["make"](client)
                await client.artifacts.wait_for_completion(NOTEBOOK_ID, status.task_id)
                await job["download"](client, KIT_DIR / job["file"])
            except Exception as err:  # keep going with the other materials
                print(f"  skipped: {err}")
                continue
            items[job["file"]] = {k: job[k] for k in ("file", "type", "title", "description")}
            print("  done")

    kit["items"] = list(items.values())
    kit_path.write_text(json.dumps(kit, indent=2) + "\n")
    print(f"\nUpdated {kit_path}. Review the files, then commit and push the partner-kit folder.")


if __name__ == "__main__":
    # Optional: limit to some types, e.g.  python tools/notebooklm_partner_kit.py audio image
    asyncio.run(main(set(sys.argv[1:])))
