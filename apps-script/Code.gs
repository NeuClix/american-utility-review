/**
 * American Utility Review – Referral Program backend (Google Apps Script).
 *
 * Setup (one time):
 *   1. Create a new Google Sheet. Extensions → Apps Script. Paste this file as Code.gs.
 *   2. Run `setup` once (authorize when asked). It creates the tabs and the status-change trigger.
 *   3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone. Copy the /exec URL.
 *   4. Put that URL in the site's referral-config.js (REFERRAL_API).
 *
 * AUR works entirely in the sheet: change a lead's Status in the "Leads" tab
 * (New → Qualified → Converted → Paid, or Not a fit) and fill in Reward when known.
 * Referrers see the change on their dashboard and get an email.
 */

var SITE_URL = 'https://aur.neuclix.com';
var STATUSES = ['New', 'Qualified', 'Converted', 'Paid', 'Not a fit'];

var SHEETS = {
  Referrers: ['Code', 'Token', 'Name', 'Email', 'Phone', 'Organization', 'Public employee', 'Joined', 'Active', 'Payout notes'],
  Leads: ['Date', 'Referral code', 'Name', 'Organization', 'Contact', 'Status', 'Reward', 'Status updated', 'Notes', 'Flag'],
  Clicks: ['Date', 'Referral code', 'Page', 'Referrer site'],
  Settings: ['Key', 'Value']
};

var DEFAULT_SETTINGS = [
  ['reward_text', 'a referral reward for every audit that becomes a client'],
  ['notify_email', 'steve@neuclix.com'],
  ['program_name', 'AUR Referral Partner Program']
];

/* ---------- setup ---------- */

function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, SHEETS[name].length).setFontWeight('bold').setBackground('#0a2240').setFontColor('#ffffff');
    }
  });
  var settings = ss.getSheetByName('Settings');
  if (settings.getLastRow() === 1) settings.getRange(2, 1, DEFAULT_SETTINGS.length, 2).setValues(DEFAULT_SETTINGS);

  // Status dropdown on the Leads tab
  var leads = ss.getSheetByName('Leads');
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  leads.getRange(2, col_('Leads', 'Status'), 1000, 1).setDataValidation(rule);

  // Hide the secret tokens column from casual view
  ss.getSheetByName('Referrers').hideColumns(col_('Referrers', 'Token'));

  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);

  // Installable trigger: email referrers when AUR changes a lead's status
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onLeadEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onLeadEdit').forSpreadsheet(ss).onEdit().create();
}

/* ---------- web app ---------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'config') return json_({ ok: true, reward_text: setting_('reward_text') });
    if (p.action === 'dashboard') return json_(dashboard_(p.token));
    return json_({ ok: true, service: 'aur-referrals' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (x) { return json_({ ok: false, error: 'Bad request' }); }
  if (body.website) return json_({ ok: true }); // honeypot: silently ignore bots
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.action === 'signup') return json_(signup_(body));
    if (body.action === 'lead') return json_(lead_(body));
    if (body.action === 'click') return json_(click_(body));
    if (body.action === 'resend') return json_(resend_(body));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- actions ---------- */

function signup_(b) {
  var name = clean_(b.name, 100), email = clean_(b.email, 200).toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter your name and a valid email.');
  if (!b.agree) throw new Error('Please accept the program terms.');
  if (b.public_employee) throw new Error('Thanks for your interest. Employees of public entities can\'t receive referral rewards, but you\'re welcome to request a free review for your organization.');

  var existing = findRow_('Referrers', 'Email', email);
  if (existing) {
    sendDashboardEmail_(existing.Name, existing.Email, existing.Token);
    return { ok: true, existing: true };
  }
  var code = newCode_(), token = Utilities.getUuid().replace(/-/g, '');
  append_('Referrers', {
    Code: code, Token: token, Name: name, Email: email,
    Phone: clean_(b.phone, 50), Organization: clean_(b.organization, 150),
    'Public employee': 'No', Joined: new Date(), Active: 'Yes'
  });
  sendDashboardEmail_(name, email, token);
  notify_('New referral partner: ' + name, name + ' <' + email + '> joined with code ' + code + '.');
  return { ok: true, token: token };
}

function resend_(b) {
  var email = clean_(b.email, 200).toLowerCase();
  var r = email && findRow_('Referrers', 'Email', email);
  if (r) sendDashboardEmail_(r.Name, r.Email, r.Token);
  return { ok: true }; // same answer either way, so emails can't be probed
}

function lead_(b) {
  var code = clean_(b.ref, 12).toUpperCase();
  var ref = code && findRow_('Referrers', 'Code', code);
  if (!ref || ref.Active !== 'Yes') code = '';
  var contact = clean_(b.contact, 200);
  var flag = '';
  if (ref && contact && contact.toLowerCase() === String(ref.Email).toLowerCase()) flag = 'Self-referral?';
  append_('Leads', {
    Date: new Date(), 'Referral code': code, Name: clean_(b.name, 100),
    Organization: clean_(b.organization, 150), Contact: contact, Status: 'New', Flag: flag
  });
  notify_('New bill review request - American Utility Review',
    'Name: ' + clean_(b.name, 100) + '\nOrganization: ' + clean_(b.organization, 150) + '\nContact: ' + contact +
    '\nReferred by: ' + (ref && code ? ref.Name + ' (' + code + ')' : 'none') + (flag ? '\nFlag: ' + flag : '') +
    '\n\nManage it in the Leads tab: ' + SpreadsheetApp.getActive().getUrl(),
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact) ? { replyTo: contact } : {});
  if (ref && code) {
    MailApp.sendEmail(ref.Email, 'You have a new referral',
      'Hi ' + first_(ref.Name) + ',\n\nSomeone just requested a bill review through your link' +
      (b.organization ? ' (' + clean_(b.organization, 150) + ')' : '') + '. We\'ll keep you posted as it moves along.\n\n' +
      'Your dashboard: ' + dashUrl_(ref.Token) + '\n\nAmerican Utility Review');
  }
  return { ok: true };
}

function click_(b) {
  var code = clean_(b.ref, 12).toUpperCase();
  if (!code || !findRow_('Referrers', 'Code', code)) return { ok: true };
  append_('Clicks', { Date: new Date(), 'Referral code': code, Page: clean_(b.page, 200), 'Referrer site': clean_(b.referrer, 200) });
  return { ok: true };
}

function dashboard_(token) {
  token = clean_(token, 64);
  var r = token && findRow_('Referrers', 'Token', token);
  if (!r) return { ok: false, error: 'This dashboard link isn\'t valid. Request a new one below.' };
  var leads = rows_('Leads').filter(function (l) { return l['Referral code'] === r.Code; });
  var clicks = rows_('Clicks').filter(function (c) { return c['Referral code'] === r.Code; }).length;
  var earned = 0, paid = 0;
  var list = leads.map(function (l) {
    var reward = Number(l.Reward) || 0;
    if (l.Status === 'Converted') earned += reward;
    if (l.Status === 'Paid') { earned += reward; paid += reward; }
    return {
      date: iso_(l.Date),
      organization: l.Organization || '(organization not given)',
      status: l.Status || 'New',
      reward: reward || null
    };
  }).reverse();
  return {
    ok: true,
    name: r.Name,
    code: r.Code,
    link: SITE_URL + '/?ref=' + r.Code,
    reward_text: setting_('reward_text'),
    stats: {
      clicks: clicks,
      referrals: leads.length,
      converted: leads.filter(function (l) { return l.Status === 'Converted' || l.Status === 'Paid'; }).length,
      earned: earned,
      paid: paid
    },
    referrals: list
  };
}

/* ---------- status-change emails ---------- */

function onLeadEdit(e) {
  var sh = e.range.getSheet();
  if (sh.getName() !== 'Leads' || e.range.getRow() < 2 || e.range.getColumn() !== col_('Leads', 'Status')) return;
  var row = e.range.getRow();
  sh.getRange(row, col_('Leads', 'Status updated')).setValue(new Date());
  var status = e.range.getValue();
  var code = sh.getRange(row, col_('Leads', 'Referral code')).getValue();
  var org = sh.getRange(row, col_('Leads', 'Organization')).getValue();
  var ref = code && findRow_('Referrers', 'Code', code);
  if (!ref) return;
  var msgs = {
    Qualified: 'good news: the referral' + (org ? ' for ' + org : '') + ' is being reviewed by our auditors.',
    Converted: 'your referral' + (org ? ' (' + org + ')' : '') + ' became a client. Your reward will be released once the client\'s payment to AUR is received.',
    Paid: 'your referral reward' + (org ? ' for ' + org : '') + ' has been paid. Thank you!',
    'Not a fit': 'the referral' + (org ? ' for ' + org : '') + ' wasn\'t a fit for an audit this time. Thanks for sending them our way.'
  };
  if (!msgs[status]) return;
  MailApp.sendEmail(ref.Email, 'Referral update: ' + status,
    'Hi ' + first_(ref.Name) + ',\n\n' + msgs[status].charAt(0).toUpperCase() + msgs[status].slice(1) +
    '\n\nYour dashboard: ' + dashUrl_(ref.Token) + '\n\nAmerican Utility Review');
}

/* ---------- helpers ---------- */

function sendDashboardEmail_(name, email, token) {
  MailApp.sendEmail(email, 'Your AUR referral dashboard',
    'Hi ' + first_(name) + ',\n\nWelcome to the ' + setting_('program_name') + '. Your private dashboard, with your personal link, ' +
    'share tools and referral status, is here:\n\n' + dashUrl_(token) +
    '\n\nKeep this link to yourself; anyone with it can see your dashboard. Bookmark it for later.\n\n' +
    'When you share your link, please mention that you may earn a referral fee.\n\nAmerican Utility Review\n' + SITE_URL);
}

function notify_(subject, body, options) {
  var to = setting_('notify_email');
  if (to) MailApp.sendEmail(to, subject, body, options || {});
}

function dashUrl_(token) { return SITE_URL + '/partner.html?t=' + token; }

function newCode_() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', code;
  do {
    code = '';
    for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  } while (findRow_('Referrers', 'Code', code));
  return code;
}

function sheet_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function col_(name, header) { return SHEETS[name].indexOf(header) + 1; }

function rows_(name) {
  var values = sheet_(name).getDataRange().getValues();
  var head = values.shift();
  return values.map(function (v) {
    var o = {};
    head.forEach(function (h, i) { o[h] = v[i]; });
    return o;
  });
}

function findRow_(name, header, value) {
  var list = rows_(name);
  for (var i = 0; i < list.length; i++) if (String(list[i][header]) === String(value)) return list[i];
  return null;
}

function append_(name, obj) {
  sheet_(name).appendRow(SHEETS[name].map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
}

function setting_(key) {
  var r = findRow_('Settings', 'Key', key);
  return r ? String(r.Value) : '';
}

function clean_(v, max) {
  // Strip leading formula characters so submitted text can't run as a spreadsheet formula
  return String(v == null ? '' : v).trim().slice(0, max).replace(/^[=+\-@]+/, '');
}

function first_(name) { return String(name).split(' ')[0]; }
function iso_(d) { return d instanceof Date ? Utilities.formatDate(d, 'America/Chicago', 'yyyy-MM-dd') : String(d); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
