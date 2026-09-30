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
 *
 * Document uploads: every lead gets a private upload page (upload.html?u=TOKEN). Files are saved
 * to Google Drive under "AUR Client Documents/<organization>". Use the AUR menu in the sheet to
 * create an upload link for any lead row.
 *
 * Updating from an earlier version: paste this file, run `setup` again (it adds the new columns
 * and asks for Drive permission), then Deploy → Manage deployments → Edit → New version.
 */

var SITE_URL = 'https://aur.neuclix.com';
var STATUSES = ['New', 'Qualified', 'Converted', 'Paid', 'Not a fit'];

var SHEETS = {
  Referrers: ['Code', 'Token', 'Name', 'Email', 'Phone', 'Organization', 'Public employee', 'Joined', 'Active', 'Payout notes'],
  Leads: ['Date', 'Referral code', 'Name', 'Organization', 'Contact', 'Status', 'Reward', 'Status updated', 'Notes', 'Flag',
          'Documents', 'Docs folder', 'Upload token'],
  Clicks: ['Date', 'Referral code', 'Page', 'Referrer site'],
  Settings: ['Key', 'Value']
};

var DEFAULT_SETTINGS = [
  ['reward_text', 'a referral reward for every audit that becomes a client'],
  ['notify_email', 'steve@neuclix.com'],
  ['program_name', 'AUR Referral Partner Program'],
  ['loa_form_url', 'https://docs.google.com/forms/d/e/1FAIpQLSfbe3dLUTuI5QLkgWNzkez5zYKyMpAlaFtUGzR5B6BrEwcC0A/viewform'],
  ['docs_folder_id', '']
];

var MAX_FILE_BYTES = 10 * 1024 * 1024;
var MAX_FILES_PER_LEAD = 50;
var ALLOWED_TYPES = /^(application\/pdf|image\/(jpeg|png|gif|webp|heic|heif|tiff)|text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/msword)$/;

/* ---------- setup ---------- */

function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
    // Add any columns introduced by newer versions of this script
    var have = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    SHEETS[name].forEach(function (h, i) {
      if (have[i] !== h) sh.getRange(1, i + 1).setValue(h);
    });
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, SHEETS[name].length).setFontWeight('bold').setBackground('#0a2240').setFontColor('#ffffff');
  });
  var settings = ss.getSheetByName('Settings');
  DEFAULT_SETTINGS.forEach(function (kv) {
    if (!findRow_('Settings', 'Key', kv[0])) settings.appendRow(kv);
  });
  docsRoot_(); // creates the Drive folder and asks for Drive permission

  // Status dropdown on the Leads tab
  var leads = ss.getSheetByName('Leads');
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  leads.getRange(2, col_('Leads', 'Status'), 1000, 1).setDataValidation(rule);

  // Hide the secret token columns from casual view
  ss.getSheetByName('Referrers').hideColumns(col_('Referrers', 'Token'));
  leads.hideColumns(col_('Leads', 'Upload token'));

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
    if (p.action === 'upload_info') return json_(uploadInfo_(p.u));
    return json_({ ok: true, service: 'aur-referrals' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (x) { return json_({ ok: false, error: 'Bad request' }); }
  if (body.website) return json_({ ok: true }); // honeypot: silently ignore bots
  // Uploads save to Drive outside the lock so a big file doesn't hold up other requests
  if (body.action === 'upload') {
    try { return json_(upload_(body)); } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.action === 'signup') return json_(signup_(body));
    if (body.action === 'lead') return json_(lead_(body));
    if (body.action === 'click') return json_(click_(body));
    if (body.action === 'resend') return json_(resend_(body));
    if (body.action === 'upload_done') return json_(uploadDone_(body));
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
  var code = newCode_(), token = newToken_();
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
  var upload = newToken_();
  append_('Leads', {
    Date: new Date(), 'Referral code': code, Name: clean_(b.name, 100),
    Organization: clean_(b.organization, 150), Contact: contact, Status: 'New', Flag: flag,
    Documents: 0, 'Upload token': upload
  });
  notify_('New bill review request - American Utility Review',
    'Name: ' + clean_(b.name, 100) + '\nOrganization: ' + clean_(b.organization, 150) + '\nContact: ' + contact +
    '\nReferred by: ' + (ref && code ? ref.Name + ' (' + code + ')' : 'none') + (flag ? '\nFlag: ' + flag : '') +
    '\n\nTheir document upload page: ' + uploadUrl_(upload) +
    '\nManage it in the Leads tab: ' + SpreadsheetApp.getActive().getUrl(),
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact) ? { replyTo: contact } : {});
  if (ref && code) {
    MailApp.sendEmail(ref.Email, 'You have a new referral',
      'Hi ' + first_(ref.Name) + ',\n\nSomeone just requested a bill review through your link' +
      (b.organization ? ' (' + clean_(b.organization, 150) + ')' : '') + '. We\'ll keep you posted as it moves along.\n\n' +
      'Your dashboard: ' + dashUrl_(ref.Token) + '\n\nAmerican Utility Review');
  }
  return { ok: true, upload: upload };
}

/* ---------- document uploads ---------- */

function leadByUpload_(token) {
  token = clean_(token, 64);
  var lead = token && findRow_('Leads', 'Upload token', token);
  if (!lead) throw new Error('This upload link isn\'t valid. Please contact us for a new one.');
  return lead;
}

function uploadInfo_(token) {
  var lead = leadByUpload_(token);
  return {
    ok: true,
    name: first_(lead.Name || ''),
    organization: lead.Organization || '',
    count: Number(lead.Documents) || 0,
    loa_url: setting_('loa_form_url')
  };
}

function upload_(b) {
  var lead = leadByUpload_(b.u);
  var name = clean_(b.name, 150).replace(/[\\\/:*?"<>|]/g, '_') || 'document';
  var type = clean_(b.type, 100).toLowerCase();
  if (!ALLOWED_TYPES.test(type)) throw new Error(name + ': please upload PDF, image, Excel, CSV or Word files.');
  var bytes = Utilities.base64Decode(String(b.data || ''));
  if (!bytes.length) throw new Error(name + ': the file is empty.');
  if (bytes.length > MAX_FILE_BYTES) throw new Error(name + ': files must be under 10 MB.');
  if ((Number(lead.Documents) || 0) >= MAX_FILES_PER_LEAD) throw new Error('This upload page has reached its file limit. Please email any remaining documents.');

  var folder = leadFolder_(lead);
  folder.createFile(Utilities.newBlob(bytes, type, name));

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var fresh = findRow_('Leads', 'Upload token', lead['Upload token']);
    updateRow_('Leads', 'Upload token', lead['Upload token'], { Documents: (Number(fresh.Documents) || 0) + 1 });
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function uploadDone_(b) {
  var lead = leadByUpload_(b.u);
  var n = Math.max(0, Math.min(Number(b.count) || 0, MAX_FILES_PER_LEAD));
  if (!n) return { ok: true };
  notify_('Documents uploaded: ' + (lead.Organization || lead.Name || 'a lead'),
    (lead.Name || 'Someone') + (lead.Organization ? ' (' + lead.Organization + ')' : '') + ' uploaded ' + n +
    ' file' + (n === 1 ? '' : 's') + '. Total on file: ' + (Number(lead.Documents) || 0) + '.\n\nFolder: ' + lead['Docs folder'] +
    '\nLeads tab: ' + SpreadsheetApp.getActive().getUrl());
  return { ok: true };
}

function docsRoot_() {
  var id = setting_('docs_folder_id');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (x) {}
  }
  var folder = DriveApp.createFolder('AUR Client Documents');
  updateRow_('Settings', 'Key', 'docs_folder_id', { Value: folder.getId() });
  return folder;
}

function leadFolder_(lead) {
  var url = String(lead['Docs folder'] || '');
  var m = url.match(/folders\/([A-Za-z0-9_-]+)/);
  if (m) {
    try { return DriveApp.getFolderById(m[1]); } catch (x) {}
  }
  var date = lead.Date instanceof Date ? iso_(lead.Date) : iso_(new Date());
  var folder = docsRoot_().createFolder((lead.Organization || lead.Name || 'Lead') + ' - ' + date);
  updateRow_('Leads', 'Upload token', lead['Upload token'], { 'Docs folder': folder.getUrl() });
  return folder;
}

/* ---------- sheet menu ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('AUR')
    .addItem('Create upload link for selected lead', 'menuUploadLink')
    .addToUi();
}

function menuUploadLink() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSheet();
  var row = sh.getActiveRange().getRow();
  if (sh.getName() !== 'Leads' || row < 2) {
    ui.alert('Select a row in the Leads tab first. To collect documents from someone new, add a row with their Name and Organization, then run this again.');
    return;
  }
  var cell = sh.getRange(row, col_('Leads', 'Upload token'));
  var token = cell.getValue();
  if (!token) {
    token = newToken_();
    cell.setValue(token);
    var docs = sh.getRange(row, col_('Leads', 'Documents'));
    if (docs.getValue() === '') docs.setValue(0);
    var status = sh.getRange(row, col_('Leads', 'Status'));
    if (!status.getValue()) status.setValue('New');
  }
  ui.alert('Upload link', 'Send this private link to the client:\n\n' + uploadUrl_(token), ui.ButtonSet.OK);
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
function uploadUrl_(token) { return SITE_URL + '/upload.html?u=' + token; }
function newToken_() { return Utilities.getUuid().replace(/-/g, ''); }

function updateRow_(name, keyHeader, keyValue, obj) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var head = values[0];
  var k = head.indexOf(keyHeader);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][k]) === String(keyValue)) {
      Object.keys(obj).forEach(function (h) {
        var c = head.indexOf(h);
        if (c >= 0) sh.getRange(r + 1, c + 1).setValue(obj[h]);
      });
      return true;
    }
  }
  return false;
}

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
