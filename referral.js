// Referral program pages: signup (refer.html), dashboard (partner.html) and terms (referral-terms.html).
(function () {
  var OFF_MSG = 'The referral program is launching soon. Please check back shortly.';

  function $(id) { return document.getElementById(id); }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function msg(form, text, isError) {
    var el = form.querySelector('.form-msg');
    el.textContent = text;
    el.classList.toggle('form-msg--error', !!isError);
  }

  // Show the current reward wording from the Settings tab
  function applyReward(text) {
    if (!text) return;
    document.querySelectorAll('.js-reward').forEach(function (el) { el.textContent = text; });
  }
  if (AUR_REF.enabled && !$('dash')) {
    AUR_REF.get({ action: 'config' }).then(function (c) { if (c.ok) applyReward(c.reward_text); }).catch(function () {});
  }

  /* ---------- signup ---------- */
  var signup = $('signup-form');
  var loadedAt = Date.now();
  if (signup) signup.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = signup.elements;
    if (!AUR_REF.enabled) return msg(signup, OFF_MSG, true);
    if (!f.name.value.trim() || !f.email.checkValidity() || !f.email.value) return msg(signup, 'Please enter your name and a valid email.', true);
    if (!f.agree.checked) return msg(signup, 'Please accept the program terms.', true);
    var button = signup.querySelector('button');
    button.disabled = true;
    msg(signup, 'Setting up your link…');
    AUR_REF.post({
      action: 'signup',
      name: f.name.value, email: f.email.value, phone: f.phone.value, organization: f.organization.value,
      public_employee: f.public_employee.checked, agree: f.agree.checked,
      // Bot check: real people take more than a second to fill in the form.
      // (No hidden trap field here: browser autofill fills those in.)
      website: Date.now() - loadedAt < 1500 ? 'bot' : ''
    }).then(function (r) {
      if (!r.ok) throw new Error(r.error);
      if (r.token) {
        try { localStorage.setItem('aur_partner', r.token); } catch (x) {}
        location.href = 'partner.html?t=' + r.token;
        return;
      }
      button.disabled = false;
      if (!r.existing) throw new Error('');
      msg(signup, 'You’re already signed up. We’ve emailed your dashboard link to ' + f.email.value + '.');
    }).catch(function (err) {
      button.disabled = false;
      msg(signup, err.message || 'Something went wrong. Please try again.', true);
    });
  });

  /* ---------- dashboard ---------- */
  if (!$('dash')) return;

  var token = new URLSearchParams(location.search).get('t') || '';
  try {
    if (token) localStorage.setItem('aur_partner', token);
    else token = localStorage.getItem('aur_partner') || '';
  } catch (x) {}

  function showError(text) {
    $('dash-loading').hidden = true;
    $('dash-error').hidden = false;
    $('dash-error-text').textContent = text;
  }

  var resend = $('resend-form');
  resend.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!AUR_REF.enabled) return msg(resend, OFF_MSG, true);
    AUR_REF.post({ action: 'resend', email: resend.elements.email.value })
      .then(function () { msg(resend, 'If that email is signed up, a dashboard link is on its way.'); })
      .catch(function () { msg(resend, 'Something went wrong. Please try again.', true); });
  });

  if (!AUR_REF.enabled) return showError(OFF_MSG);
  if (!token) return showError('Open the dashboard link from your welcome email, or have it sent again.');

  AUR_REF.get({ action: 'dashboard', token: token }).then(function (d) {
    if (!d.ok) return showError(d.error || 'This dashboard link isn’t valid.');
    render(d);
  }).catch(function () {
    showError('We couldn’t load your dashboard. Please refresh the page in a moment.');
  });

  function render(d) {
    $('dash-loading').hidden = true;
    $('dash-body').hidden = false;
    applyReward(d.reward_text);
    $('d-name').textContent = String(d.name).split(' ')[0];
    $('d-code').textContent = d.code;
    $('d-link').value = d.link;
    $('s-clicks').textContent = d.stats.clicks;
    $('s-referrals').textContent = d.stats.referrals;
    $('s-converted').textContent = d.stats.converted;
    $('s-earned').textContent = money(d.stats.earned);
    $('s-paid').textContent = money(d.stats.paid);

    var rows = $('ref-rows');
    rows.innerHTML = '';
    d.referrals.forEach(function (r) {
      var tr = document.createElement('tr');
      [r.date, r.organization, r.status, r.reward ? money(r.reward) : '—'].forEach(function (v, i) {
        var td = document.createElement('td');
        if (i === 2) {
          var span = document.createElement('span');
          span.className = 'status status--' + v.toLowerCase().replace(/[^a-z]/g, '');
          span.textContent = v;
          td.appendChild(span);
        } else td.textContent = v;
        tr.appendChild(td);
      });
      rows.appendChild(tr);
    });
    $('ref-empty').hidden = d.referrals.length > 0;

    setupInstall();
    setupKit(d);
    setupSharing(d.link);
    setupQr(d.link, d.code);
    setupTemplates(d.link);
  }

  function copy(text, button) {
    var done = function () {
      var old = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(function () { button.textContent = old; }, 1500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }

  // "Get the app": Android/desktop Chrome and Edge offer an install prompt; iPhone needs Share → Add to Home Screen
  var installEvent = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    if (!$('dash-body').hidden) setupInstall();
  });
  function setupInstall() {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    var panel = $('install-panel');
    if (standalone) { panel.hidden = true; return; }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (installEvent) {
      panel.hidden = false;
      $('install-btn').hidden = false;
      $('install-btn').onclick = function () {
        installEvent.prompt();
        installEvent.userChoice.then(function () { panel.hidden = true; installEvent = null; });
      };
    } else if (ios) {
      panel.hidden = false;
      $('install-btn').hidden = true;
      $('install-text').innerHTML = 'On iPhone: tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.';
    }
  }

  // Marketing kit: personal flyer plus shared materials listed in partner-kit/kit.json
  function setupKit(d) {
    $('flyer-link').href = 'flyer.html?code=' + encodeURIComponent(d.code) + '&name=' + encodeURIComponent(d.name || '');
    var box = $('kit-items');
    box.innerHTML = '';
    fetch('partner-kit/kit.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (kit) {
      (kit.items || []).forEach(function (it) {
        if (!it || !it.file) return;
        var src = 'partner-kit/' + it.file;
        var item = document.createElement('div');
        item.className = 'kit-item';
        var text = document.createElement('div');
        var h = document.createElement('h3');
        h.textContent = it.title || it.file;
        text.appendChild(h);
        if (it.description) {
          var p = document.createElement('p');
          p.className = 'fine-print';
          p.textContent = it.description;
          text.appendChild(p);
        }
        if (it.type === 'audio') {
          var audio = document.createElement('audio');
          audio.controls = true;
          audio.preload = 'none';
          audio.src = src;
          text.appendChild(audio);
        } else if (it.type === 'video') {
          var video = document.createElement('video');
          video.controls = true;
          video.preload = 'none';
          video.src = src;
          text.appendChild(video);
        } else if (it.type === 'image') {
          var img = document.createElement('img');
          img.src = src;
          img.alt = it.title || '';
          img.loading = 'lazy';
          text.appendChild(img);
        }
        item.appendChild(text);
        var a = document.createElement('a');
        a.className = 'btn btn--outline-dark';
        a.href = src;
        a.download = '';
        a.textContent = 'Download';
        item.appendChild(a);
        box.appendChild(item);
      });
    }).catch(function () {});
  }

  function setupSharing(link) {
    var short = 'Free utility bill review for businesses: American Utility Review checks electric, gas and water bills for overcharges and refunds. No upfront cost. (I may earn a referral fee.)';
    var u = encodeURIComponent(link), s = encodeURIComponent(short);
    $('copy-link').onclick = function () { copy(link, this); };
    $('share-email').href = 'mailto:?subject=' + encodeURIComponent('Worth a look: free utility bill review') + '&body=' + encodeURIComponent(short + '\n\n' + link);
    $('share-sms').href = 'sms:?&body=' + encodeURIComponent(short + ' ' + link);
    $('share-linkedin').href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + u;
    $('share-facebook').href = 'https://www.facebook.com/sharer/sharer.php?u=' + u;
    $('share-x').href = 'https://twitter.com/intent/tweet?text=' + s + '&url=' + u;
    $('share-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(short + ' ' + link);
    if (navigator.share) {
      var native = $('share-native');
      native.hidden = false;
      native.onclick = function () { navigator.share({ title: 'Free utility bill review', text: short, url: link }).catch(function () {}); };
    }
  }

  function setupQr(link, code) {
    var box = $('qr');
    box.innerHTML = '';
    if (!window.QRCode) { box.textContent = 'QR code unavailable.'; return; }
    new QRCode(box, { text: link, width: 200, height: 200, colorDark: '#0a2240', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    $('qr-download').onclick = function () {
      var canvas = box.querySelector('canvas');
      if (!canvas) return;
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'AUR-referral-' + code + '.png';
      a.click();
    };
  }

  function setupTemplates(link) {
    var list = [
      { title: 'Text message', text: 'Hi! Quick tip: American Utility Review does free reviews of business utility bills and often finds overcharges or refunds. No upfront cost. Here’s my link if you want them to take a look: ' + link + ' (Full disclosure: I may earn a referral fee.)' },
      { title: 'Email to a business owner', text: 'Subject: Could your utility bills be overcharging you?\n\nHi [Name],\n\nI wanted to pass along American Utility Review. They’re independent auditors (since 1986) who review electric, gas and water/sewer bills for billing errors, overcharges and better rates, and they help recover refunds. The review is free to request, with no upfront cost.\n\nYou can request one here: ' + link + '\n\nFull disclosure: I’m part of their referral program and may earn a fee if you become a client.\n\n[Your name]' },
      { title: 'LinkedIn or Facebook post', text: 'If your business, school, church or organization pays utility bills, it’s worth a second look. American Utility Review has been auditing commercial electric, gas and water bills since 1986, finding billing errors and recovering refunds. Requesting a review is free: ' + link + '\n\n#utilities #smallbusiness (I may earn a referral fee.)' },
      { title: 'For accountants and bookkeepers', text: 'Hi [Name], you see your clients’ utility bills every month. American Utility Review audits commercial electric, gas and water/sewer bills for overcharges and refunds, with no upfront cost to the client. If any of your clients have large utility bills, they can request a free review here: ' + link + '\n\nFull disclosure: I may earn a referral fee.' }
    ];
    var box = $('templates');
    box.innerHTML = '';
    list.forEach(function (t) {
      var wrap = document.createElement('div');
      wrap.className = 'template';
      var head = document.createElement('div');
      head.className = 'template__head';
      var h = document.createElement('h3');
      h.textContent = t.title;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--outline-dark btn--small';
      btn.textContent = 'Copy';
      btn.onclick = function () { copy(t.text, btn); };
      head.appendChild(h);
      head.appendChild(btn);
      var pre = document.createElement('p');
      pre.className = 'template__text';
      pre.textContent = t.text;
      wrap.appendChild(head);
      wrap.appendChild(pre);
      box.appendChild(wrap);
    });
  }
})();
