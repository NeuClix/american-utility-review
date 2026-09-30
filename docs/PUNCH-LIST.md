# American Utility Review – Punch List

Last updated: September 30, 2026. ✅ = done · ⬜ = to do · 👤 = needs Steve / AUR

## In progress
- ⬜ **User and admin documentation.** Partner, Client, Admin and Technical guides, written so they can also be used as NotebookLM sources (`docs/` folder and Google Drive › AUR Documentation).

## Next up
- ⬜ 👤 **Generate partner marketing materials from NotebookLM.** Run `tools/notebooklm_partner_kit.py` in Claude Code on Steve's computer (logged in to NotebookLM), review the files, then commit and push `partner-kit/`. Notebook: `5fa38cf3-d35f-439d-bc21-6d1e899a19f8`. Add the finished documentation as sources first.
- ⬜ 👤 **Decide the referral reward** and put it in Settings › `reward_text` (e.g. "$500 for every audit that becomes a client").
- ⬜ 👤 **Authorization form tweaks:** Referral Code optional, State dropdown, Utility Account Number as a paragraph with "one per line", soften "Over 70% of the time" unless documented.
- ⬜ 👤 **Clean test data** from Leads, Clicks, authorization responses, and the TEST CO folder in Drive.

## Later
- ⬜ **Google sign-in for partners.** Needs a free OAuth Client ID from Google Cloud Console (about 10 minutes of setup by Steve).
- ⬜ **Push notifications for partners.** Needs a Firebase project; worth it once there are active partners.
- ⬜ **Firebase migration plan** (database, sign-in, push, storage) when the Sheet gets busy.
- ⬜ **"Ask the AUR assistant" button** linking to a public NotebookLM share, if wanted.
- ⬜ **Credibility updates from the research report:** dated and documented results, a typical-outcome line, client-name permissions, a "How we're paid" section, a trust bar, and an anti-scam statement.
- ⬜ **Sector and Missouri content pages:** schools, hospitals, cities, manufacturers (sales-tax exemption), restaurants and hotels.
- ⬜ 👤 **Associations:** BBB, Joplin and Springfield chambers, MoASBO, Missouri Municipal League, Missouri Hospital Association, TIPS cooperative contract.
- ⬜ **Missing Missouri clients:** the original list said 11 but named only 8.
- ⬜ **Client logos**, only with written permission.

## Done
- ✅ Website live at aur.neuclix.com (Vercel, auto-deploys from GitHub NeuClix/american-utility-review)
- ✅ Mobile layout, hamburger menu, request button beside the menu, cropped logo, favicons
- ✅ Contact form → Google Sheet with Web3Forms email fallback
- ✅ Research report: credibility, associations, competitors, claims to avoid
- ✅ Referral partner program: signup, private dashboard, links, QR code, share buttons, message templates, terms
- ✅ Lead tracking with status emails (Qualified, Converted, Paid)
- ✅ Private document upload page → Google Drive folder per client
- ✅ Letter of Authorization form linked and pre-filled (name, company, referral code)
- ✅ Installable app (PWA) that opens to the partner dashboard
- ✅ Partner marketing kit: personal printable flyer plus a slot for NotebookLM materials
