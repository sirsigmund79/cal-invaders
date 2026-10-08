// Pre-renders every sprite once onto small offscreen canvases, and lays out the invader grid.
// The game loop only ever calls drawImage, so no text is rasterized per frame.
(function () {
  const CI = window.__CI;
  if (!CI) return;

  const BODY_H = 30, LEG = 5;
  const FONT = '"Segoe UI", system-ui, sans-serif';

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  }

  function ink(color) {
    const m = color.match(/[\d.]+/g);
    if (!m) return '#fff';
    return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2] > 165 ? '#1b1b1b' : '#fff';
  }

  function fit(g, text, max) {
    if (g.measureText(text).width <= max) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (g.measureText(text.slice(0, mid) + '…').width <= max) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo) + '…';
  }

  // Two animation frames per meeting: the little legs shuffle on every march step.
  function meetingSprite(m, w, frame) {
    const [c, g] = canvas(w, BODY_H + LEG);
    g.fillStyle = m.color;
    const legs = frame ? [4, 15, w - 20, w - 9] : [9, 20, w - 25, w - 14];
    for (const x of legs) g.fillRect(x, BODY_H - 2, 5, LEG + 2 - (frame ? 0 : 2));
    rr(g, 0, 0, w, BODY_H, 6);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 1;
    rr(g, 0.5, 0.5, w - 1, BODY_H - 1, 6);
    g.stroke();

    const fg = ink(m.color);
    let textMax = w - 10;
    if (w >= 72) {
      // angry little eyes
      g.fillStyle = fg;
      g.fillRect(w - 21, 10, 4, 4);
      g.fillRect(w - 11, 10, 4, 4);
      g.strokeStyle = fg;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(w - 24, 5); g.lineTo(w - 16, 8);
      g.moveTo(w - 4, 5); g.lineTo(w - 12, 8);
      g.stroke();
      textMax = w - 32;
    }
    g.fillStyle = fg;
    g.font = '600 11px ' + FONT;
    g.fillText(fit(g, m.title, textMax), 5, 13);
    g.globalAlpha = 0.75;
    g.font = '10px ' + FONT;
    g.fillText(CI.fmtDur(m.mins) + (m.replyAll ? ' · reply-all' : ''), 5, 25);
    return c;
  }

  CI.INVADER_BODY_H = BODY_H;

  CI.buildFormation = function (meetings, W) {
    const n = meetings.length;
    const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(n * 2.2))));
    const cw = Math.min(130, Math.floor((W * 0.78) / cols));
    const rh = 44;
    const invaders = meetings.map((m, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const w = Math.max(40, Math.round((cw - 6) * (0.6 + (0.4 * Math.min(m.mins, 120)) / 120)));
      m.replyAll = m.replyAll || /\b(all|team|company|org|everyone|town ?hall)\b/i.test(m.title) || m.title.length > 34;
      return {
        m, w, h: BODY_H + LEG, col, row,
        cx: col * cw + cw / 2, cy: row * rh,
        alive: true, tw: null,
        spr: [meetingSprite(m, w, 0), meetingSprite(m, w, 1)],
      };
    });
    return { invaders, cols, cw, rh, width: cols * cw };
  };

  CI.sprites = {
    player() {
      const [c, g] = canvas(56, 32);
      g.fillStyle = '#3ddc84';
      g.fillRect(2, 13, 52, 8);
      g.fillRect(6, 9, 44, 4);
      g.fillRect(24, 0, 8, 10);
      g.fillRect(20, 5, 16, 4);
      g.fillStyle = '#0d3b24';
      g.fillRect(10, 15, 4, 3);
      g.fillRect(42, 15, 4, 3);
      g.fillStyle = '#3ddc84';
      g.font = 'bold 8px ' + FONT;
      g.textAlign = 'center';
      g.fillText('FOCUS TIME', 28, 31);
      return c;
    },
    envelope() {
      const [c, g] = canvas(12, 9);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 12, 9);
      g.strokeStyle = '#e53935';
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(0.5, 0.5); g.lineTo(6, 5); g.lineTo(11.5, 0.5);
      g.stroke();
      return c;
    },
    allHands() {
      const [c, g] = canvas(104, 28);
      g.fillStyle = '#ff5252';
      rr(g, 32, 0, 40, 16, 8); g.fill();
      g.fillStyle = '#e53935';
      rr(g, 0, 9, 104, 19, 9); g.fill();
      g.fillStyle = '#fff';
      g.font = 'bold 11px ' + FONT;
      g.textAlign = 'center';
      g.fillText('ALL-HANDS', 52, 23);
      return c;
    },
    label(text) {
      const [c, g] = canvas(96, 14);
      g.fillStyle = '#3ddc84';
      g.globalAlpha = 0.8;
      g.font = '600 10px ' + FONT;
      g.textAlign = 'center';
      g.fillText(text.toUpperCase(), 48, 11);
      return c;
    },
  };
})();
