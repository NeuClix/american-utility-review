// Mobile menu: toggle open/closed, and close after choosing a link or pressing Escape.
(function () {
  var header = document.querySelector('.site-header');
  var toggle = header.querySelector('.nav-toggle');
  function setOpen(open) {
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', function () {
    setOpen(!header.classList.contains('nav-open'));
  });
  header.querySelectorAll('.site-nav a').forEach(function (link) {
    link.addEventListener('click', function () { setOpen(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });
})();

// Referral links: remember ?ref=CODE on this device and count the click.
(function () {
  var code = (new URLSearchParams(location.search).get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!code) return;
  AUR_REF.save(code);
  if (AUR_REF.enabled) {
    AUR_REF.post({ action: 'click', ref: code, page: location.pathname, referrer: document.referrer }).catch(function () {});
  }
  // Tidy the address bar so the code isn't re-shared by accident
  history.replaceState(null, '', location.pathname + location.hash);
})();

// Contact form: goes to the Google Sheet (with any referral code) when the referral program is on,
// falling back to Web3Forms email if the Sheet can't be reached. Without JavaScript it posts to Web3Forms.
function sendToWeb3Forms(form) {
  return fetch(form.action, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new FormData(form)
  })
    .then(function (res) {
      return res.json().catch(function () { return {}; });
    })
    .then(function (data) {
      if (data.success !== true) throw new Error(data.message || '');
    });
}

function sendToSheet(form) {
  return AUR_REF.post({
    action: 'lead',
    name: form.elements.name.value,
    organization: form.elements.organization.value,
    contact: form.elements.contact.value,
    ref: AUR_REF.load(),
    website: form.elements.botcheck.checked ? 'bot' : ''
  }).then(function (data) {
    if (!data.ok) throw new Error(data.error || '');
    return data.upload || '';
  });
}

var contactForm = document.getElementById('contact-form');
if (contactForm) contactForm.addEventListener('submit', function (e) {
  e.preventDefault();
  var form = this;
  var button = form.querySelector('button');
  var label = button.textContent;
  button.disabled = true;
  button.textContent = 'Sending…';

  var send = AUR_REF.enabled
    ? sendToSheet(form).catch(function () { return sendToWeb3Forms(form); })
    : sendToWeb3Forms(form);

  send
    .then(function (upload) {
      // Next step: the private page for uploading bills and signing the authorization
      if (upload) {
        // Remember details on this device so the upload page can pre-fill the authorization form
        try {
          localStorage.setItem('aur_lead_' + upload, JSON.stringify({
            name: form.elements.name.value, company: form.elements.organization.value, code: AUR_REF.load()
          }));
        } catch (x) {}
        location.href = 'upload.html?u=' + encodeURIComponent(upload);
        return;
      }
      form.reset();
      button.textContent = 'Thank you. We will be in touch.';
    })
    .catch(function (err) {
      button.disabled = false;
      button.textContent = label;
      alert('Sorry, your request could not be sent. Please try again.' + (err && err.message ? '\n\n' + err.message : ''));
    });
});

// Installable app (PWA): register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
