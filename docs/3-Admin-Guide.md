# American Utility Review – Admin Guide

This guide is for the people who run AUR's website, leads, documents and referral program day to day: NeuClix and AUR staff. It explains how the pieces fit together, the daily workflow, how to manage partners and payouts, settings, maintenance, and troubleshooting. No coding is needed for anything here.

---

## 1. The system at a glance

| Piece | What it is | Where |
|---|---|---|
| **Website / app** | Public site, referral pages, upload page, partner dashboard. Installable as an app (PWA). | aur.neuclix.com (hosted on Vercel) |
| **Website code** | Every change pushed here goes live automatically in about a minute. | GitHub: NeuClix/american-utility-review |
| **AUR Referrals Sheet** | The "back office": partners, leads, link visits, settings. | Google Drive, owned by steve@neuclix.com |
| **Apps Script** | The engine behind the Sheet. Receives form data, saves uploads, sends emails. | AUR Referrals Sheet › Extensions › Apps Script |
| **Client documents** | One folder per request with the client's uploaded bills. | Google Drive › **AUR Client Documents** |
| **Letter of Authorization** | Google Form clients sign. Responses go to their own Sheet. | "LETTER OF AUTHORIZATION TO DEAL WITH UTILITY COMPANIES" Form and "(Responses)" Sheet |
| **Emails** | Sent automatically from steve@neuclix.com by the Apps Script. | Gmail |
| **Backup email path** | If the Sheet can't be reached, the request form emails via Web3Forms instead. | Web3Forms (key tied to steve@neuclix.com) |

### How a request flows
1. A visitor submits **Request a free bill review** on the website. If they arrived through a partner link, the partner's code is attached.
2. A row is added to **Leads**, and steve@neuclix.com gets a "New bill review request" email. Reply goes straight to the requester when they gave an email. The referring partner gets a "You have a new referral" email.
3. The visitor lands on their **private upload page**, uploads bills (saved to Drive), and signs the **Letter of Authorization** (pre-filled with name, company and referral code).
4. When they finish uploading, you get a "Documents uploaded" email with a link to their folder.
5. You work the lead and update its **Status** in the Leads tab. The partner is emailed at each change and their dashboard updates.

---

## 2. The AUR Referrals Sheet

### Leads tab (your main worklist)
| Column | Meaning |
|---|---|
| Date | When the request came in |
| Referral code | Partner who referred it (blank = direct) |
| Name, Organization, Contact | From the request form |
| **Status** | New → Qualified → Converted → Paid, or Not a fit (dropdown) |
| **Reward** | Partner reward amount for this lead (numbers only, e.g. 500) |
| Status updated | Filled in automatically when Status changes |
| Notes | Your notes |
| Flag | "Self-referral?" if the contact matches the partner's own email (for your information; self-referrals are allowed) |
| Documents | Number of files uploaded |
| Docs folder | Link to the client's Drive folder |
| Upload token | Hidden. Powers the client's private upload link. Don't edit. |

### Referrers tab (partners)
| Column | Meaning |
|---|---|
| Code | The partner's referral code (in their link) |
| Token | Hidden. Powers their private dashboard link. Don't edit. |
| Name, Email, Phone, Organization | From signup |
| Public employee | Not used (always "No") |
| Joined | Signup date |
| **Active** | Yes/No. Set to **No** to stop crediting a partner. |
| **Payout notes** | W-9 received? Payment method, dates and amounts paid |

### Clicks tab
One row per visit through a partner link: date, code, page, and where the visitor came from. Safe to clear anytime; it only affects the "Link visits" count.

### Settings tab
| Key | What it does |
|---|---|
| `reward_text` | Reward wording shown on the website and dashboards, e.g. "$500 for every audit that becomes a client". Change it anytime. |
| `notify_email` | Where new-lead, partner-signup and upload emails go |
| `program_name` | Name used in partner welcome emails |
| `loa_form_url` | The Letter of Authorization form the upload page links to |
| `docs_folder_id` | ID of the AUR Client Documents folder. Filled in automatically; don't change it. |

### The AUR menu
In the Sheet's menu bar: **AUR → Create upload link for selected lead**. Use it to collect documents from anyone, including people who called or emailed (see section 4).

---

## 3. Daily workflow

1. **Check new leads.** Each new request emails you and appears in Leads with status **New**.
2. **Contact the client.** Reply to the notification email, or use the contact in the row.
3. **Check documents and authorization.**
    - Documents: the Documents count and Docs folder link in the row.
    - Authorization: the Letter of Authorization (Responses) Sheet. Match by name/company. The Referral Code column shows the partner, if any.
4. **Update the Status as you go:**
    - **Qualified**: you're reviewing it.
    - **Converted**: they became a client. Enter the **Reward** amount first, then set the status.
    - **Paid**: you've paid the partner.
     - **Not a fit**: close it out.

    The partner is emailed automatically at each change (except New). Leads without a referral code don't send partner emails.

5. **Add notes** in the Notes column for your own tracking.

**Tip:** set the Reward before changing Status to Converted, so the partner's dashboard shows the right amount.

---

## 4. Collecting documents from anyone

For a client who called, emailed, or was referred in person:

1. In **Leads**, add a row with at least their **Name** and **Organization** (and Referral code if a partner sent them).
2. Click anywhere in that row.
3. Choose **AUR → Create upload link for selected lead**.
4. Copy the link from the pop-up and send it to the client.

Their files appear in AUR Client Documents › *Organization - date*, and the row's Documents and Docs folder columns fill in.

**Limits:** 10 MB per file, 50 files per lead. File types: PDF, images (JPG, PNG, HEIC, GIF, WebP, TIFF), Excel, CSV and Word. Larger files can be emailed and saved to the folder by hand.

---

## 5. Managing partners

- **New partners** sign up themselves at aur.neuclix.com/refer.html. You get a "New referral partner" email.
- **Pause or remove a partner:** set **Active** to **No**. They stop earning credit, and new requests using their code come in as direct leads. **Don't delete partner rows.** Deleting one permanently breaks their dashboard link and code; if that happens, re-enter the row exactly as it was, with the same Code and Token.
- **Partner lost their dashboard link:** they can re-enter their email on the signup page and it's emailed again. You can also build it: `aur.neuclix.com/partner.html?t=` followed by their Token (unhide column B to see it).
- **Self-referrals are allowed.** A business owner who refers their own business earns the reward. The Flag column just marks them.
- **Clubs and organizations:** when the Organization column holds a club, booster group or charity, pay the organization and collect a W-9 in its name.
- **Public employees** can join and earn rewards, except for referring the public entity they work for. If a lead is a school district, city or county, check whether the partner works there; if so, the reward can go to their club or booster group, not to them personally.

### Paying partners
1. When a referral is **Converted** and the client has paid AUR, pay the partner.
2. **Before the first payment, collect a W-9.** Note "W-9 received" in Payout notes.
3. Pay by your chosen method (check, ACH, PayPal…) and note the date and amount in Payout notes.
4. Set the lead's Status to **Paid**. The partner is emailed and their dashboard shows it as paid.
5. At year end, issue 1099s as required. Ask your accountant about the current reporting threshold.

---

## 6. Partner marketing kit

Every partner dashboard has a **Marketing kit**:

- **Personal flyer:** automatic, with the partner's own QR code and link. Nothing to maintain.
- **Campaign pieces (video, blog post, social and LinkedIn posts):** made in NotebookLM with the prompts in **6. Partner Campaign – NotebookLM Prompts**, then published to the website. Posts and captions contain `{link}`, which each partner's dashboard replaces with their own link. Blog posts live at aur.neuclix.com/blog/.
- **Shared materials:** files in the website's `partner-kit` folder, listed in `partner-kit/kit.json`. They can be generated from the AUR NotebookLM notebook with `tools/notebooklm_partner_kit.py`, run from a computer logged in to NotebookLM. **Review every file before publishing:** no promised savings, no invented statistics, no client names without permission.

---

## 7. Changing things

| To change… | Do this |
|---|---|
| Reward wording | Settings › `reward_text` (live immediately) |
| Who gets notification emails | Settings › `notify_email` |
| Authorization form questions | Edit the Google Form. Keep the Name, Company and Referral Code questions; if you delete and recreate them, the pre-fill IDs change and the website needs updating. |
| Website text, pages, design | Ask your developer (a change in GitHub goes live automatically) |
| Apps Script code | Paste new code in Extensions › Apps Script, run **setup** once, then **Deploy → Manage deployments → pencil → Version: New version → Deploy**. The web address stays the same. |

---

## 8. Troubleshooting

| Problem | Cause and fix |
|---|---|
| Website form says "could not be sent" | Usually a browser extension or a temporary outage. The form automatically tries the Web3Forms email backup. Try again in a private window. |
| A request arrived by email from Web3Forms but isn't in Leads | The Sheet couldn't be reached at that moment. Add the row by hand, and use the AUR menu to create an upload link. |
| Partner says "We couldn't open this dashboard" | Their row was deleted or their link is incomplete. Restore the row, or have them re-enter their email on the signup page. |
| A referral didn't credit the partner | The partner is set to Active = No or was deleted, or the client used a different device or browser than the one where they opened the link. Add the code to the lead by hand if appropriate. |
| Emails stop sending | Google limits automated emails per day (about 1,500 for Google Workspace accounts). Check Apps Script › Executions for errors. |
| Upload page says the link isn't valid | The lead's Upload token is missing or was edited. Clear the Upload token cell (unhide column M), then use the AUR menu to create a new link. |
| Changes to the website don't show | Refresh, or open it in a private window. Installed apps update on the next launch. |
| Google shows "Authorization required" or "unverified app" when running setup | Normal for your own script: Review permissions → your account → Advanced → Go to project → Allow. If you see "OAuth client not found," try again in a private window signed in only to steve@neuclix.com. |

---

## 9. Compliance reminders

This is general guidance, not legal advice.

- **Savings and refund claims** on the website need records behind them (FTC rules). Date and document case results; don't promise or guarantee savings.
- **Client names and logos:** get written permission before publishing.
- **"Free" offers** must state the fee terms clearly.
- **Partners must disclose** that they may earn a referral fee. The tools include this automatically.
- **Public employees** can't be paid personally for referring their own employer (conflict of interest and kickback risk). Paying a club or booster group instead is cleaner; confirm AUR is comfortable with that for school districts, since some districts have their own rules.
- **Filing with the Missouri PSC** on a client's behalf requires a Missouri-licensed attorney. **Sales tax refund claims** handled for a client require the client's signed Missouri DOR Form 2827 (power of attorney).

---

## 10. Security and access

- The Sheet, Apps Script, Drive folders and Form are owned by **steve@neuclix.com**. Share them with staff as editors only when needed.
- Partner dashboard links and client upload links are private "keys" (long random tokens). Don't post them publicly.
- The Web3Forms access key and the Apps Script web address are visible in the website's code by design; they only allow submitting forms, not reading data.
- Keep the **AUR Client Documents** folder private. Don't use "Anyone with the link" sharing on it.
