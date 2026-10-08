// Runs the stages in order (scrape → crawl → title → lift-off → game → end) and owns teardown.
(function () {
  const CI = window.__CI;
  if (!CI || CI.started) return;
  CI.started = true;
  const h = CI.h, A = CI.audio;

  const data = CI.scrape();

  // ---------- Overlay root + static starfield (painted once, never animated) ----------
  const root = (CI.root = h('div', { id: 'ci-root' }));
  const stars = h('div', { class: 'ci-stars' });
  stars.style.backgroundImage = 'url(' + starTile() + ')';
  root.appendChild(stars);
  document.body.appendChild(root);

  function starTile() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 46; i++) {
      g.fillStyle = 'rgba(255,255,255,' + CI.rand(0.25, 0.9).toFixed(2) + ')';
      const s = Math.random() < 0.12 ? 2 : 1;
      g.fillRect((Math.random() * 256) | 0, (Math.random() * 256) | 0, s, s);
    }
    const url = c.toDataURL();
    c.width = c.height = 0;
    return url;
  }

  // ---------- Hide Google Calendar while we play so it does no layout/paint work ----------
  const hidden = [];
  function hidePage() {
    if (hidden.length) return;
    for (const el of document.body.children) {
      if (el === root) continue;
      hidden.push([el, el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  }
  function restore(list) {
    for (const [el, v, p] of list) {
      if (v) el.style.setProperty('visibility', v, p);
      else el.style.removeProperty('visibility');
    }
    list.length = 0;
  }
  const hiddenChips = [];
  function hideChips() {
    for (const m of data.meetings) {
      if (!m.el) continue;
      hiddenChips.push([m.el, m.el.style.getPropertyValue('visibility'), m.el.style.getPropertyPriority('visibility')]);
      m.el.style.setProperty('visibility', 'hidden', 'important');
    }
  }

  // ---------- Input: swallow everything so Calendar's own shortcuts (c, d, w...) never fire ----------
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.stopImmediatePropagation();
    if (e.key === 'Tab') return;
    e.preventDefault();
    if (e.type === 'keypress') return;
    if (e.type === 'keydown') {
      A.resume();
      if (e.key === 'Escape') return teardown();
      if ((e.key === 'm' || e.key === 'M') && !e.repeat) { A.toggleMute(); return; }
    }
    if (CI.onKey) CI.onKey(e);
  }
  const KEY_EVENTS = ['keydown', 'keyup', 'keypress'];
  const MOUSE_EVENTS = ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'pointerdown'];
  const stopMouse = (e) => { A.resume(); e.stopPropagation(); };
  KEY_EVENTS.forEach((t) => addEventListener(t, onKey, true));
  MOUSE_EVENTS.forEach((t) => root.addEventListener(t, stopMouse));
  const onVis = () => { if (document.hidden && CI.engine) CI.engine.pause(true); };
  document.addEventListener('visibilitychange', onVis);

  // ---------- Stages ----------
  A.init();
  hidePage();
  CI.crawl(data, (opts) => startGame(opts, 1, true));

  function startGame(opts, level, reveal) {
    if (reveal) {
      // Show the real calendar for a beat, with our sprites sitting exactly on its chips,
      // then fade to space as the meetings lift into formation.
      restore(hidden);
      hideChips();
      root.classList.add('ci-reveal');
      void root.offsetWidth;
      requestAnimationFrame(() => root.classList.remove('ci-reveal'));
    }
    CI.engine = CI.createGame({
      meetings: data.meetings,
      targetH: data.targetH,
      level,
      danger: opts.danger,
      lowRes: opts.lowRes,
      fromRects: reveal,
      onAssembled: hidePage,
      onEnd(res) {
        CI.engine = null;
        CI.showEnd(res, {
          again: () => startGame(opts, res.win ? level + 1 : level, false),
          quit: teardown,
        });
      },
    });
  }

  function teardown() {
    if (!CI.root) return;
    if (CI.engine) CI.engine.stop();
    CI.engine = null;
    CI.onKey = null;
    CI.timers.forEach(clearTimeout);
    A.close();
    KEY_EVENTS.forEach((t) => removeEventListener(t, onKey, true));
    document.removeEventListener('visibilitychange', onVis);
    restore(hiddenChips);
    restore(hidden);
    root.remove();
    CI.root = null;
    for (const m of data.meetings) m.el = null;
    delete window.__CI;
  }
  CI.teardown = teardown;
})();
