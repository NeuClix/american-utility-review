# Referral program setup (Google Sheets + Apps Script)

One-time setup, about 10 minutes. Everything runs in your Google Workspace account at no extra cost.

## 1. Create the Sheet and paste the script
1. Create a new Google Sheet named **AUR Referrals**.
2. In the Sheet, open **Extensions → Apps Script**.
3. Delete the sample code, paste the contents of `apps-script/Code.gs`, and click **Save**.

## 2. Run setup once
1. In the function dropdown at the top, choose **setup**, then click **Run**.
2. Approve the permissions (Sheets and Gmail). If Google shows "unverified app", click **Advanced → Go to project**; it's your own script.
3. The Sheet now has four tabs: **Referrers, Leads, Clicks, Settings**.

## 3. Deploy it as a web app
1. Click **Deploy → New deployment**, then the gear icon → **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**.
3. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
4. Send that URL to your developer, or paste it into `referral-config.js` as `API: '…/exec'`.

If you change the script later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## Running the program day to day
- **Settings tab:** `reward_text` is the wording shown on the site (e.g. "$500 for every audit that becomes a client"). `notify_email` gets every new lead and partner signup.
- **Leads tab:** every contact-form request lands here, with the referral code if one applies. Change **Status** as it progresses:
  - **Qualified**: you're reviewing it
  - **Converted**: it became a client (enter the **Reward** amount)
  - **Paid**: you've paid the referrer
  - **Not a fit**
  
  The referrer gets an email at each change, and their dashboard updates.
- **Flag** column: "Self-referral?" means the lead's contact matches the referrer's email.
- **Referrers tab:** set **Active** to `No` to stop crediting someone. Use **Payout notes** to record W-9 received and payment details.
- **Clicks tab:** one row per visit through a referral link.

## Before paying anyone
Collect a W-9 before the first payment and issue 1099s as required. Ask your accountant for the current reporting threshold.
