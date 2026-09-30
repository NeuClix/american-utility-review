// Submissions are emailed to the form's action address via FormSubmit (formsubmit.co).
// Without JavaScript the form still posts normally to the same address.
document.getElementById('contact-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var form = this;
  var button = form.querySelector('button');
  var label = button.textContent;
  button.disabled = true;
  button.textContent = 'Sending…';

  fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new FormData(form)
  })
    .then(function (res) {
      return res.json().catch(function () { return {}; });
    })
    .then(function (data) {
      if (String(data.success) !== 'true') throw new Error(data.message || '');
      form.reset();
      button.textContent = 'Thank you. We will be in touch.';
    })
    .catch(function (err) {
      button.disabled = false;
      button.textContent = label;
      alert('Sorry, your request could not be sent. Please try again.' + (err && err.message ? '\n\n' + err.message : ''));
    });
});
