// Document upload page (upload.html?u=TOKEN): sends each file to the Apps Script backend,
// which saves it to the lead's Google Drive folder.
(function () {
  var MAX_BYTES = 10 * 1024 * 1024;
  var EXT = /\.(pdf|jpe?g|png|gif|webp|heic|heif|tiff?|csv|xlsx?|docx?)$/i;
  var TYPES = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff',
    csv: 'text/csv', xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  function $(id) { return document.getElementById(id); }
  var token = new URLSearchParams(location.search).get('u') || '';
  var count = 0;
  var queue = [];
  var busy = false;
  var sentThisBatch = 0;

  function fail(text) {
    $('up-loading').hidden = true;
    $('up-error').hidden = false;
    $('up-error-text').textContent = text;
  }

  if (!AUR_REF.enabled) return fail('Uploads are temporarily unavailable. Please email your bills to steve@neuclix.com.');
  if (!token) return fail('This page needs the private link from your confirmation. Please contact us for a new one.');

  AUR_REF.get({ action: 'upload_info', u: token }).then(function (d) {
    if (!d.ok) return fail(d.error || 'This upload link isn’t valid.');
    $('up-loading').hidden = true;
    $('up-body').hidden = false;
    if (d.name) $('up-name').textContent = ', ' + d.name;
    if (d.organization) $('up-org').textContent = 'This review is for ' + d.organization + '.';
    count = d.count || 0;
    $('up-count').textContent = count;
    if (d.loa_url) $('loa-link').href = d.loa_url;
    else $('loa-link').hidden = true;
  }).catch(function () {
    fail('We couldn’t load this page. Please refresh in a moment.');
  });

  function typeOf(file) {
    if (file.type) return file.type;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    return TYPES[ext] || '';
  }

  function addFiles(files) {
    Array.prototype.forEach.call(files, function (file) {
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.className = 'file-list__name';
      name.textContent = file.name;
      var state = document.createElement('span');
      state.className = 'file-list__state';
      li.appendChild(name);
      li.appendChild(state);
      $('file-list').appendChild(li);

      if (!EXT.test(file.name)) return setState(li, 'Not a supported file type', 'error');
      if (file.size > MAX_BYTES) return setState(li, 'Over 10 MB; please email it instead', 'error');
      setState(li, 'Waiting…');
      queue.push({ file: file, li: li });
    });
    next();
  }

  function setState(li, text, kind) {
    var el = li.querySelector('.file-list__state');
    el.textContent = text;
    li.className = kind ? 'is-' + kind : '';
  }

  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Could not read the file.')); };
      r.readAsDataURL(file);
    });
  }

  function next() {
    if (busy) return;
    var item = queue.shift();
    if (!item) {
      if (sentThisBatch) {
        AUR_REF.post({ action: 'upload_done', u: token, count: sentThisBatch }).catch(function () {});
        $('up-msg').textContent = 'Thank you! We’ve received your files. Don’t forget step 2.';
        sentThisBatch = 0;
      }
      return;
    }
    busy = true;
    $('up-msg').textContent = '';
    setState(item.li, 'Uploading…');
    readBase64(item.file)
      .then(function (data) {
        return AUR_REF.post({ action: 'upload', u: token, name: item.file.name, type: typeOf(item.file), data: data });
      })
      .then(function (r) {
        if (!r.ok) throw new Error(r.error);
        count++;
        sentThisBatch++;
        $('up-count').textContent = count;
        setState(item.li, 'Uploaded ✓', 'done');
      })
      .catch(function (err) {
        setState(item.li, err.message || 'Upload failed. Please try again.', 'error');
      })
      .then(function () {
        busy = false;
        next();
      });
  }

  var input = $('file-input');
  input.addEventListener('change', function () {
    addFiles(input.files);
    input.value = '';
  });

  var zone = $('dropzone');
  ['dragenter', 'dragover'].forEach(function (ev) {
    zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('is-over'); });
  });
  zone.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });

  // Warn before leaving mid-upload
  window.addEventListener('beforeunload', function (e) {
    if (busy || queue.length) { e.preventDefault(); e.returnValue = ''; }
  });
})();
