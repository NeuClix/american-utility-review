// Referral program settings.
// REFERRAL_API: the Google Apps Script web app URL (ends in /exec). Leave empty to turn the program off;
// the contact form then keeps sending through Web3Forms only.
window.AUR_REFERRAL = {
  API: '',
  // How long a referral link is remembered on a visitor's device, in days
  COOKIE_DAYS: 90
};

// Shared helpers for the referral pages and the main site
window.AUR_REF = (function () {
  var cfg = window.AUR_REFERRAL;
  var KEY = 'aur_ref';

  function save(code) {
    var rec = JSON.stringify({ code: code, at: Date.now() });
    try { localStorage.setItem(KEY, rec); } catch (e) {}
    document.cookie = KEY + '=' + encodeURIComponent(rec) + ';max-age=' + cfg.COOKIE_DAYS * 86400 + ';path=/;SameSite=Lax';
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) {
      var m = document.cookie.match(new RegExp('(?:^|; )' + KEY + '=([^;]*)'));
      raw = m && decodeURIComponent(m[1]);
    }
    try {
      var rec = JSON.parse(raw);
      if (rec && rec.code && Date.now() - rec.at < cfg.COOKIE_DAYS * 86400000) return rec.code;
    } catch (e) {}
    return '';
  }

  function post(payload) {
    // text/plain avoids a CORS preflight, which Apps Script can't answer
    return fetch(cfg.API, { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); });
  }

  function get(params) {
    var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(cfg.API + '?' + q).then(function (r) { return r.json(); });
  }

  return { enabled: !!cfg.API, save: save, load: load, post: post, get: get };
})();
