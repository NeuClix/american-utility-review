# American Utility Review – Technical Reference

For developers maintaining aur.neuclix.com. Covers architecture, files, configuration, the backend API, data model, and deployment.

---

## 1. Architecture

- **Front end:** static HTML, CSS and vanilla JavaScript with no build step. Hosted on **Vercel** (project `american-utility-review`, team "steve-neuclixcom's projects"), auto-deployed from GitHub **NeuClix/american-utility-review**, branch `main`. Custom domain **aur.neuclix.com**: a CNAME at RamNode DNS pointing to `cname.vercel-dns.com`.
- **Back end:** a **Google Apps Script** web app bound to the **AUR Referrals** Google Sheet ("Execute as: Me (steve@neuclix.com)", "Who has access: Anyone"). It stores data in Sheet tabs, files in Google Drive, and sends email with MailApp.
- **Fallback email:** **Web3Forms** (`api.web3forms.com/submit`), used by the contact form when the Apps Script is unreachable or returns an error.
- **Authorization:** a Google Form (Letter of Authorization), pre-filled via `entry.*` URL parameters.
- **PWA:** `manifest.webmanifest` plus `sw.js`. The service worker is network-first with a cache fallback and never caches cross-origin requests (the Apps Script backend, fonts, CDNs).

## 2. Files

| File | Purpose |
|---|---|
| `index.html` | Home page: hero, services, process, industries, results, clients, request form |
| `refer.html` | Partner program landing page and signup form |
| `partner.html` | Private partner dashboard (`?t=TOKEN`) |
| `upload.html` | Private client upload page (`?u=UPLOAD_TOKEN`) |
| `referral-terms.html` | Partner program terms |
| `flyer.html` | Printable partner flyer (`?code=CODE&name=NAME`) |
| `styles.css` | All styles |
| `main.js` | Mobile menu; referral link capture; request form submission (Sheet with Web3Forms fallback); service-worker registration |
| `referral-config.js` | `window.AUR_REFERRAL` config and the shared `AUR_REF` helpers (save/load code, GET/POST to the backend) |
| `referral.js` | Signup, dashboard rendering, sharing, QR code, message templates, marketing kit, install prompt |
| `upload.js` | Upload page: file queue, base64 upload, pre-filled authorization link |
| `qrcode.min.js` | QRCode.js (MIT), self-hosted |
| `sw.js` | Service worker (bump `VERSION` when the cached file list changes) |
| `manifest.webmanifest` | PWA manifest (`start_url` /partner.html?source=app) |
| `partner-kit/kit.json` | List of shared marketing materials shown on dashboards |
| `apps-script/Code.gs` | Backend source (paste into the Sheet's Apps Script) |
| `apps-script/SETUP.md` | Backend setup and update steps |
| `tools/notebooklm_partner_kit.py` | Generates marketing materials from NotebookLM (run locally) |
| `docs/` | Documentation (not deployed) |
| Icons | `logo.png`, `favicon-32.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` |

Pages share the same header and footer markup. The referral pages were generated from one template, so keep them consistent when editing.

## 3. Configuration (`referral-config.js`)

```js
window.AUR_REFERRAL = {
  API: 'https://script.google.com/macros/s/…/exec', // Apps Script web app URL; '' turns the program off
  COOKIE_DAYS: 90,                                  // referral attribution window
  LOA_FIELDS: { name: 'entry.1492896387', company: 'entry.1731655679', code: 'entry.26090282' }
};
```

- **Attribution:** `?ref=CODE` on any page is saved to localStorage and a cookie (`aur_ref`) for `COOKIE_DAYS`, last click wins. Then a `click` is posted, and the parameter is removed from the address bar.
- **Contact form:** posts `lead` to the API. On success it stores `{name, company, code}` under `localStorage['aur_lead_' + uploadToken]` for authorization pre-fill, then redirects to `upload.html?u=TOKEN`. On failure it falls back to Web3Forms and shows a thank-you message.
- **Partner token:** saved in `localStorage['aur_partner']`, so `partner.html` and the installed app open without `?t=`.

## 4. Backend API (Apps Script)

Every request goes to the same `/exec` URL. POST bodies are JSON sent as text/plain, which avoids a CORS preflight. Responses are JSON, `{ ok: true|false, error? }`.

### GET
| `action` | Params | Returns |
|---|---|---|
| `config` | none | `{ reward_text }` |
| `dashboard` | `token` | `{ name, code, link, reward_text, stats{clicks, referrals, converted, earned, paid}, referrals[{date, organization, status, reward}] }` |
| `upload_info` | `u` | `{ name (first), organization, count, loa_url }` |

### POST
| `action` | Body | Effect |
|---|---|---|
| `signup` | name, email, phone, organization, public_employee, agree | Creates a partner (code plus token) or re-emails an existing one. Returns `{token}` or `{existing:true}`. Rejects public employees. |
| `resend` | email | Emails the dashboard link if the email is registered. Always returns `ok`. |
| `lead` | name, organization, contact, ref | Adds a Leads row with an upload token. Emails admin (reply-to = contact if it's an email) and the referrer. Returns `{upload}`. |
| `click` | ref, page, referrer | Logs a click for a valid code |
| `upload` | u, name, type, data (base64) | Saves a file to the lead's Drive folder (created on first upload). Max 10 MB, 50 files per lead, allowed MIME types only. Runs outside the script lock. |
| `upload_done` | u, count | Emails admin a summary with the folder link |

**Bot handling:** POSTs with a truthy `website` field are silently accepted and ignored. The signup page sets it when the form is sent under 1.5 seconds after page load. The request form uses Web3Forms' `botcheck` checkbox. Don't add hidden text "honeypot" inputs to signup: browser autofill fills them and legitimate signups get dropped.

**Other triggers and functions:**

- `onLeadEdit` (installable onEdit trigger): stamps "Status updated" and emails the referrer on Qualified, Converted, Paid or Not a fit.
- `onOpen` adds the **AUR** menu; `menuUploadLink` creates or shows a lead's upload link.
- `setup()` is idempotent. It creates missing tabs, columns and settings, the status dropdown, the docs root folder and the trigger, and hides token columns.

**Security notes:** tokens are UUIDv4 without dashes. Inputs are trimmed and length-limited, and leading `= + - @` are stripped to prevent spreadsheet formula injection. File names are sanitized.

## 5. Data model (Sheet tabs)

- **Referrers:** Code, Token, Name, Email, Phone, Organization, Public employee, Joined, Active, Payout notes
- **Leads:** Date, Referral code, Name, Organization, Contact, Status, Reward, Status updated, Notes, Flag, Documents, Docs folder, Upload token
- **Clicks:** Date, Referral code, Page, Referrer site
- **Settings (Key/Value):** reward_text, notify_email, program_name, loa_form_url, docs_folder_id

Columns are matched by header name. New columns must be appended at the end, and `setup()` adds them to existing sheets.

## 6. Deployment

- **Website:** push to `main`, and Vercel deploys to production automatically (about a minute).
- **Backend:** paste `apps-script/Code.gs` into the Apps Script editor, run `setup`, then **Deploy → Manage deployments → Edit → New version**. Keep the same deployment so the `/exec` URL doesn't change. If the URL ever changes, update `API` in `referral-config.js`.
- **Scopes used:** Sheets, Drive, Gmail send (MailApp), script triggers.
- **Quotas:** MailApp daily recipients (about 1,500 on Google Workspace); Apps Script runtime of 6 minutes per call; POST payloads up to about 50 MB (the 10 MB file limit keeps base64 bodies well under this).

## 7. Testing notes

- Locally, run `python3 -m http.server` in the repo and route the API URL to a mock (the Playwright tests used during development mocked `script.google.com`).
- The backend logic can be unit-tested in Node by loading `Code.gs` into a `vm` context with stubbed SpreadsheetApp, DriveApp, MailApp, Utilities, LockService, ScriptApp and ContentService.
