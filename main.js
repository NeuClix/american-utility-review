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

// Submissions are emailed to the address tied to the form's Web3Forms access key.
// Without JavaScript the form still posts normally to the same endpoint.
document.getElementById('contact-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var form = this;
  var button = form.querySelector('button');
  var label = button.textContent;
  button.disabled = true;
  button.textContent = 'Sending…';

  fetch(form.action, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new FormData(form)
  })
    .then(function (res) {
      return res.json().catch(function () { return {}; });
    })
    .then(function (data) {
      if (data.success !== true) throw new Error(data.message || '');
      form.reset();
      button.textContent = 'Thank you. We will be in touch.';
    })
    .catch(function (err) {
      button.disabled = false;
      button.textContent = label;
      alert('Sorry, your request could not be sent. Please try again.' + (err && err.message ? '\n\n' + err.message : ''));
    });
});
