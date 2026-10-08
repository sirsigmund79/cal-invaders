// Reads the meetings Google Calendar is already showing. Read-only: nothing on the page is changed.
(function () {
  const CI = window.__CI;
  if (!CI) return;

  // If Google changes its markup, this list is the place to fix.
  const SELECTORS = ['[data-eventid]', '[data-eventchip]', '[role="gridcell"] [role="button"]'];
  const HOUR_PX = 48; // default Google week-view hour height, used when no time text is found
  const MAX_INVADERS = 40;
  const MIN_REAL = 8;
  const PAD_TO = 12;

  const TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*(?:to|–|—|-)\s*(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/gi;
  const DATE_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}/i;
  const PALETTE = ['#039be5', '#7986cb', '#33b679', '#8e24aa', '#e67c73', '#f6bf26', '#f4511e', '#0b8043', '#3f51b5', '#d50000'];
  const FILLERS = [
    'Sync about the sync', 'Quick 5-min chat', 'Circle back', 'Alignment on alignment',
    'Touch base re: touching base', 'Brainstorm (mandatory fun)', 'Status update update',
    'Pre-meeting prep meeting', 'Weekly weekly', "Let's take this offline", 'Synergy session',
    'Calendar hygiene review', 'Post-mortem pre-mortem', 'All-team FYI',
  ];

  function toMin(h, m, ap) {
    h = +h; m = +(m || 0);
    ap = (ap || '').toLowerCase().replace(/\./g, '');
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }

  // Finds the first plausible "10am to 11:30am" / "10 – 11am" / "14:00 – 15:30" range.
  // Requires a colon or am/pm so titles like "1-1 with Sam" are not read as times.
  function findTime(text) {
    TIME_RE.lastIndex = 0;
    let t;
    while ((t = TIME_RE.exec(text))) {
      if (!(t[2] || t[3] || t[5] || t[6])) continue;
      const end = toMin(t[4], t[5], t[6]);
      let start = toMin(t[1], t[2], t[3] || t[6]);
      if (!t[3] && t[6] && start > end) start = toMin(t[1], t[2], 'am');
      let mins = end - start;
      if (mins <= 0) mins += 1440;
      return { mins, when: t[0].replace(/\s+/g, ' ').trim() };
    }
    return null;
  }

  function read(el, r) {
    const aria = el.getAttribute('aria-label') || '';
    const lines = (aria ? [aria] : [])
      .concat((el.innerText || '').split('\n'))
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (lines.some((l) => /\ball[- ]day\b/i.test(l))) return null;

    let tm = null, title = '', date = '';
    for (const l of lines) {
      const t = findTime(l);
      if (!t) continue;
      if (!tm) tm = t;
      // Google's screen-reader line: "10am to 11am, Title, Organizer, Accepted, ..., October 6, 2026"
      if (!title && l.indexOf(',') !== -1) {
        title = l.split(/,\s*/).find((s) => s && !findTime(s)) || '';
        const d = DATE_RE.exec(l);
        if (d) date = d[0];
      }
    }
    if (!title) title = lines.find((l) => !findTime(l) && l.length < 120) || '';
    title = title.length > 60 ? title.slice(0, 57) + '…' : title;

    let mins = tm ? tm.mins : r.height < 24 ? 60 : Math.max(15, Math.round((r.height / HOUR_PX) * 4) * 15);
    return { title: title || '(No title)', mins, when: [date, tm ? tm.when : ''].filter(Boolean).join(' · ') };
  }

  function parseRGB(c) {
    const m = c && c.match(/[\d.]+/g);
    return m && m.length >= 3 ? m.map(Number) : null;
  }

  function colorOf(el, title) {
    let n = el;
    for (let i = 0; n && i < 3; i++, n = n.firstElementChild) {
      const cs = getComputedStyle(n);
      for (const c of [cs.backgroundColor, cs.borderLeftColor]) {
        const v = parseRGB(c);
        if (!v || (v.length > 3 && v[3] === 0)) continue;
        const lum = 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2];
        if (lum > 235 || lum < 20) continue; // white "declined" chips, black borders
        return 'rgb(' + v[0] + ',' + v[1] + ',' + v[2] + ')';
      }
    }
    return PALETTE[CI.hash(title) % PALETTE.length];
  }

  CI.scrape = function () {
    let sel = '', els = [];
    for (const s of SELECTORS) {
      els = document.querySelectorAll(s);
      if (els.length) { sel = s; break; }
    }
    const vw = innerWidth, vh = innerHeight, seen = new Set(), out = [];
    for (const el of els) {
      if (el.closest('#ci-root')) continue;
      if (el.parentElement && el.parentElement.closest(sel)) continue; // nested match
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) continue;
      const key = (el.getAttribute('data-eventid') || '') + '@' + Math.round(r.left) + ',' + Math.round(r.top);
      if (seen.has(key)) continue;
      seen.add(key);
      const info = read(el, r);
      if (!info || info.mins > 480 || info.mins < 5) continue;
      out.push({
        el,
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
        title: info.title,
        mins: info.mins,
        when: info.when,
        color: colorOf(el, info.title),
      });
    }

    out.sort((a, b) => b.mins - a.mins);
    if (out.length > MAX_INVADERS) out.length = MAX_INVADERS;
    const real = out.length;

    if (real < MIN_REAL) {
      const names = FILLERS.slice().sort(() => Math.random() - 0.5);
      const durs = [30, 30, 45, 60, 60, 90, 120];
      for (let i = 0; out.length < PAD_TO; i++) {
        const title = names[i % names.length];
        out.push({
          el: null, rect: null, title, decoy: true, when: '',
          mins: durs[(Math.random() * durs.length) | 0],
          color: PALETTE[CI.hash(title) % PALETTE.length],
        });
      }
      out.sort((a, b) => b.mins - a.mins);
    }

    const totalH = out.reduce((s, m) => s + m.mins, 0) / 60;
    const targetH = Math.min(totalH, Math.max(2, Math.ceil(totalH * 0.6 * 2) / 2));
    return { meetings: out, real, totalH, targetH };
  };
})();
