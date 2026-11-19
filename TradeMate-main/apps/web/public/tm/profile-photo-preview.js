/*
 * Profile picture page: preview a chosen photo BEFORE it is saved.
 *
 * Today app.js crops and saves a photo the moment it is picked, so there is no
 * preview and it changes everywhere straight away. This intercepts that pick,
 * shows the square-cropped result on the Profile picture page only, and keeps
 * the old picture everywhere else until the person taps "Save photo". Saving
 * hands the same file back to app.js's own handler, so cropping, saving and the
 * "Photo updated" message behave exactly as before. "Cancel", leaving the page,
 * or choosing an avatar / Remove discards the preview.
 *
 * Runs as a DOM patch so app.js does not need to change.
 */
(function () {
  'use strict';

  var pending = null;   // { file, url } - the chosen photo, not saved yet
  var problem = '';     // inline error text for the preview area
  var ver = 0;          // bumps whenever the preview state changes
  var committing = false;

  var css = document.createElement('style');
  css.id = 'tm-photo-preview-css';
  css.textContent = [
    '.tm-pp{display:grid;justify-items:center;gap:12px;padding:6px 16px 16px}',
    '.tm-pp-img{width:132px;height:132px;border-radius:30px;object-fit:cover;display:block;background:#0d1319;border:2px solid var(--am)}',
    '.tm-pp-note{margin:0;text-align:center;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}',
    '.tm-pp-actions{display:flex;gap:10px}',
    '.tm-photo-pending .btn.wide[data-back]{display:none}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function setState(next, err) {
    pending = next;
    problem = err || '';
    ver++;
    render();
  }

  function readPreview(file) {
    var reader = new FileReader();
    reader.onerror = function () { setState(null, 'Could not read that photo'); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { setState(null, 'Could not open that photo'); };
      img.onload = function () {
        // Same square crop and size the app uses when it saves, so the preview matches the result.
        var side = Math.min(img.width, img.height);
        var canvas = document.createElement('canvas');
        canvas.width = canvas.height = 320;
        canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 320, 320);
        setState({ file: file, url: canvas.toDataURL('image/jpeg', 0.85) });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // Runs before app.js's own "change" listener (which is on document, bubbling).
  window.addEventListener('change', function (ev) {
    var input = ev.target;
    if (!input || input.id !== 'photoin' || committing) return;
    var file = input.files && input.files[0];
    if (!file || !/^image\//.test(file.type)) return; // let the app show its own "choose an image" message
    ev.stopImmediatePropagation();
    input.value = '';
    readPreview(file);
  }, true);

  function save() {
    var input = document.getElementById('photoin');
    if (!input || !pending) return;
    try {
      var transfer = new DataTransfer();
      transfer.items.add(pending.file);
      input.files = transfer.files;
    } catch (e) {
      setState(pending, 'This browser cannot save from the preview. Tap Cancel and choose the photo again.');
      return;
    }
    committing = true;
    try { input.dispatchEvent(new Event('change', { bubbles: true })); }
    finally { committing = false; }
    setState(null);
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var btn = t.closest('[data-tm-pp]');
    if (btn) {
      ev.preventDefault();
      if (btn.getAttribute('data-tm-pp') === 'save') save();
      else setState(null);
      return;
    }
    // Picking an avatar or removing the photo overrides any unsaved preview.
    if ((pending || problem) && t.closest('[data-act="avatar"],[data-act="rmphoto"]')) setState(null);
  });

  function render() {
    var input = document.getElementById('photoin');
    if (!input) {            // page closed: the preview must not outlive it
      if (pending || problem) { pending = null; problem = ''; ver++; }
      return;
    }
    var page = input.closest('.pgs') || document.body;
    var row = input.closest('label');
    var anchor = row && row.parentNode && row.parentNode.parentNode;
    if (!anchor || !anchor.parentNode) return;

    var block = page.querySelector('.tm-pp');
    if (!pending && !problem) {
      if (block) block.remove();
      page.classList.remove('tm-photo-pending');
      return;
    }
    if (block && block.getAttribute('data-v') === String(ver)) return;
    if (block) block.remove();

    block = el('div', 'tm-pp');
    block.setAttribute('data-v', String(ver));
    if (pending) {
      var img = el('img', 'tm-pp-img');
      img.alt = 'Preview of your new profile photo';
      img.src = pending.url;
      block.appendChild(img);
      block.appendChild(el('p', 'tm-pp-note', 'Preview \u00b7 not saved yet'));
    }
    if (problem) block.appendChild(el('p', 'tm-pp-note', problem));
    if (pending) {
      var actions = el('div', 'tm-pp-actions');
      var saveBtn = el('button', 'btn sm', 'Save photo');
      saveBtn.type = 'button';
      saveBtn.setAttribute('data-tm-pp', 'save');
      var cancelBtn = el('button', 'btn sm o', 'Cancel');
      cancelBtn.type = 'button';
      cancelBtn.setAttribute('data-tm-pp', 'cancel');
      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      block.appendChild(actions);
    }
    anchor.parentNode.insertBefore(block, anchor);
    page.classList.toggle('tm-photo-pending', !!pending);
  }

  function start() {
    render();
    new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
  }
  start();
})();
