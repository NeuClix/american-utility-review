# American Utility Review

Static marketing site for American Utility Review. No build step: `index.html`, `styles.css`, `main.js`, `logo.png`.

The contact form posts to Web3Forms (web3forms.com). Submissions are emailed to the address tied to the `access_key` in `index.html`.

## Referral program
`refer.html` (signup), `partner.html` (referrer dashboard) and `referral-terms.html`, with logic in `referral.js` and settings in `referral-config.js`. The backend is a Google Sheet with Apps Script (`apps-script/Code.gs`); see `apps-script/SETUP.md`. While `API` in `referral-config.js` is empty, the program is off and the contact form sends through Web3Forms only.

## Partner marketing kit
Partner dashboards show a "Marketing kit": a personal printable flyer (`flyer.html`, with the partner's QR code) plus any files listed in `partner-kit/kit.json`. To generate materials from the AUR NotebookLM notebook, run `tools/notebooklm_partner_kit.py` on a computer logged in to NotebookLM, review the files, then commit and push the `partner-kit` folder.
