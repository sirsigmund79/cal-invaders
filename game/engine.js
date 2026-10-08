// The game. One canvas, fixed-step 60 Hz logic, preallocated pools, no per-frame allocation.
(function () {
  const CI = window.__CI;
  if (!CI) return;
  const h = CI.h, rand = CI.rand;

  const STEP = 1 / 60;
  const ASSEMBLE_DUR = 1.1;
  const PLAYER_SPEED = 380, SHOT_SPEED = 640, FIRE_CD = 0.32;
  const MARCH_PX = 12, DROP_PX = 22, EDGE = 12;
  const CELL_W = 10, CELL_H = 7, B_COLS = 8, B_ROWS = 4;
  const BODY_H = CI.INVADER_BODY_H;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pool = (n, make) => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = make(); return a; };
  const take = (arr) => { for (let i = 0; i < arr.length; i++) if (!arr[i].on) return arr[i]; return null; };

  CI.createGame = function (o) {
    const A = CI.audio, root = CI.root;
    const level = o.level || 1;
    const target = o.targetH;
    const scale = o.lowRes ? 0.5 : 1;

    // ---------- DOM: canvas + HUD (HUD text only changes on events, never per frame) ----------
    const canvas = h('canvas', { class: 'ci-canvas' });
    const ctx = canvas.getContext('2d');
    const savedB = h('b'), bar = h('i'), livesS = h('span');
    const toast = h('div', { class: 'ci-toast' });
    const pauseEl = h('div', { class: 'ci-pause' }, 'PAUSED', h('small', null, 'P to resume  ·  Esc to quit'));
    const perfEl = h('div', { class: 'ci-perf' });
    const hud = h('div', { class: 'ci-hud' },
      h('div', { class: 'ci-saved' }, h('span', { class: 'ci-lbl' }, 'HOURS SAVED '), savedB, h('div', { class: 'ci-bar' }, bar)),
      o.danger ? h('div', { class: 'ci-badge' }, '● LIVE CALENDAR') : h('div', { class: 'ci-lvl' }, 'WAVE ' + level),
      h('div', { class: 'ci-lives' }, 'PTO DAYS ', livesS));
    root.append(canvas, hud, toast, pauseEl, perfEl);

    // ---------- World ----------
    let W = innerWidth, H = innerHeight;
    const F = CI.buildFormation(o.meetings, W);
    const inv = F.invaders;
    let fx = Math.round((W - F.width) / 2), fy = 64, dir = 1;

    const player = { x: W / 2 - 28, y: H - 60, w: 56, h: 22, lives: 3, invuln: 0, cd: 0, spr: CI.sprites.player() };
    const envSpr = CI.sprites.envelope(), ufoSpr = CI.sprites.allHands();
    const ufo = { on: false, x: 0, y: 34, vx: 0, w: ufoSpr.width, h: ufoSpr.height };

    const pShots = pool(8, () => ({ on: false, x: 0, y: 0 }));
    const eShots = pool(24, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0 }));
    const parts = pool(64, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, c: '#fff' }));
    const pops = pool(8, () => ({ on: false, x: 0, y: 0, t: 0, text: '', c: '#fff' }));
    const bunkers = ['Lunch', 'Focus', 'Gym', 'Deep Work'].map((name) => ({
      x: 0, y: 0, cells: new Uint8Array(B_COLS * B_ROWS).fill(2), lbl: CI.sprites.label(name),
    }));

    let saved = 0;
    const destroyed = [];
    let phase = 'assemble', assembleT = 0, assembleEnd = 0;
    let stepT = 0.5, frameIdx = 0, fireT = 1.6, shuffleT = rand(4, 7), ufoT = rand(14, 22), elapsed = 0;
    let overT = 0, result = null, aliveCount = inv.length;
    let paused = false, lowQ = !!o.lowRes, perfOn = false, running = true;
    let raf = 0, last = performance.now(), acc = 0, skipFrame = false, ema = 16.7, warm = 0, perfT = 0;
    const keys = Object.create(null);

    // Start positions for the "lift out of the calendar" animation.
    for (const v of inv) {
      const r = o.fromRects && v.m.rect;
      if (r) { v.sx = r.x; v.sy = r.y; v.sw = r.w; v.sh = r.h; }
      else { v.sx = rand(0, W - v.w); v.sy = -80 - rand(0, 240); v.sw = v.w; v.sh = v.h; }
      v.delay = (o.fromRects ? 0.5 : 0.1) + v.col * 0.04 + v.row * 0.07;
      assembleEnd = Math.max(assembleEnd, v.delay + ASSEMBLE_DUR);
    }

    function resize() {
      W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      player.y = H - 60;
      player.x = clamp(player.x, 8, W - player.w - 8);
      bunkers.forEach((b, i) => { b.x = Math.round((W * (i + 1)) / 5 - (B_COLS * CELL_W) / 2); b.y = H - 132; });
    }
    resize();

    const ix = (v) => fx + v.cx - v.w / 2;
    const iy = (v) => fy + v.cy;

    // ---------- HUD ----------
    function updHud() {
      savedB.textContent = CI.fmtH(saved) + ' / ' + CI.fmtH(target);
      bar.style.transform = 'scaleX(' + Math.min(1, saved / target) + ')';
      livesS.textContent = '▮'.repeat(player.lives) + '▯'.repeat(Math.max(0, 3 - player.lives));
    }
    updHud();

    function showToast(text) {
      toast.textContent = text;
      toast.classList.remove('show');
      void toast.offsetWidth; // restart the CSS animation
      toast.classList.add('show');
    }

    // ---------- Effects ----------
    function explode(x, y, c, n) {
      if (lowQ) return;
      for (let i = 0; i < n; i++) {
        const p = take(parts);
        if (!p) return;
        const a = Math.random() * Math.PI * 2, s = rand(60, 220);
        p.on = true; p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 60; p.life = rand(0.35, 0.7); p.c = c;
      }
    }
    function popup(text, x, y, c) {
      const p = take(pops);
      if (!p) return;
      p.on = true; p.text = text; p.x = x; p.y = y; p.t = 1.1; p.c = c || '#fff';
    }

    // ---------- Gameplay ----------
    function retarget(v) {
      v.tw = { x0: v.cx, y0: v.cy, x1: v.col * F.cw + F.cw / 2, y1: v.row * F.rh, t: 0 };
    }

    function shuffle() {
      const alive = inv.filter((v) => v.alive); // runs every few seconds, not per frame
      if (alive.length < 2) return;
      const i = (Math.random() * alive.length) | 0;
      const a = alive[i], b = alive[(i + 1 + ((Math.random() * (alive.length - 1)) | 0)) % alive.length];
      if ((elapsed > 30 || level > 1) && Math.random() < 0.3) {
        const row = a.row;
        for (const v of inv) if (v.alive && v.row === row) { v.col = (v.col + 1) % F.cols; retarget(v); }
        popup('Pushed back!', ix(a) + a.w / 2, iy(a) - 6, '#ffd54a');
      } else {
        const c = a.col, r = a.row;
        a.col = b.col; a.row = b.row; b.col = c; b.row = r;
        retarget(a); retarget(b);
        popup('Rescheduled!', (ix(a) + ix(b) + a.w) / 2, (iy(a) + iy(b)) / 2 - 6, '#ffd54a');
      }
      A.shuffle();
    }

    function march() {
      let minX = Infinity, maxX = -Infinity;
      for (const v of inv) {
        if (!v.alive) continue;
        const x = ix(v);
        if (x < minX) minX = x;
        if (x + v.w > maxX) maxX = x + v.w;
      }
      if ((dir > 0 && maxX + MARCH_PX > W - EDGE) || (dir < 0 && minX - MARCH_PX < EDGE)) { fy += DROP_PX; dir = -dir; }
      else fx += dir * MARCH_PX;
      frameIdx ^= 1;
      A.step();
      // Invaders bulldoze bunkers they overlap.
      for (const b of bunkers) {
        for (const v of inv) {
          if (!v.alive) continue;
          const x = ix(v), y = iy(v);
          if (y + BODY_H < b.y || y > b.y + B_ROWS * CELL_H || x + v.w < b.x || x > b.x + B_COLS * CELL_W) continue;
          for (let i = 0; i < b.cells.length; i++) {
            const cx = b.x + (i % B_COLS) * CELL_W, cy = b.y + ((i / B_COLS) | 0) * CELL_H;
            if (cx + CELL_W > x && cx < x + v.w && cy + CELL_H > y && cy < y + BODY_H) b.cells[i] = 0;
          }
        }
      }
    }

    function stepInterval() {
      return (0.05 + 0.5 * (aliveCount / inv.length)) / (1 + 0.15 * (level - 1));
    }

    function enemyFire() {
      let col = -1;
      if (Math.random() < 0.4) {
        let best = Infinity;
        const px = player.x + player.w / 2;
        for (const v of inv) if (v.alive) { const d = Math.abs(ix(v) + v.w / 2 - px); if (d < best) { best = d; col = v.col; } }
      } else {
        let n = 0;
        for (const v of inv) if (v.alive && Math.random() < 1 / ++n) col = v.col;
      }
      let s = null;
      for (const v of inv) if (v.alive && v.col === col && (!s || v.row > s.row)) s = v;
      if (!s) return;
      const x = ix(s) + s.w / 2, y = iy(s) + BODY_H;
      const vy = 210 + 30 * level;
      const spread = s.m.replyAll ? [-70, 0, 70] : [0];
      for (const vx of spread) {
        const e = take(eShots);
        if (!e) break;
        e.on = true; e.x = x; e.y = y; e.vx = vx; e.vy = vy;
      }
      A.enemyShoot();
    }

    function bunkerHit(x, y) {
      for (const b of bunkers) {
        if (x < b.x || x >= b.x + B_COLS * CELL_W || y < b.y || y >= b.y + B_ROWS * CELL_H) continue;
        const i = (((y - b.y) / CELL_H) | 0) * B_COLS + (((x - b.x) / CELL_W) | 0);
        if (b.cells[i]) { b.cells[i]--; return true; }
      }
      return false;
    }

    function kill(v) {
      v.alive = false;
      aliveCount--;
      saved += v.m.mins / 60;
      destroyed.push(v.m);
      const x = ix(v), y = iy(v);
      explode(x + v.w / 2, y + BODY_H / 2, v.m.color, 12);
      popup('+' + CI.fmtDur(v.m.mins), x + v.w / 2, y, '#7dffb3');
      A.boom();
      if (o.danger) showToast('Declining "' + v.m.title + '"… ✓ ' + (3 + (CI.hash(v.m.title) % 38)) + ' attendees notified');
      updHud();
      if (saved >= target - 1e-9 || aliveCount === 0) end(true);
    }

    function hitPlayer() {
      player.lives--;
      player.invuln = 1.6;
      explode(player.x + player.w / 2, player.y + 10, '#3ddc84', 20);
      A.hit();
      for (const e of eShots) e.on = false;
      updHud();
      if (player.lives <= 0) end(false, 'You ran out of PTO days. The meetings have won.');
    }

    function end(win, reason) {
      if (phase === 'over') return;
      phase = 'over';
      overT = 1.5;
      ufo.on = false;
      A.ufoStop();
      win ? A.win() : A.lose();
      result = {
        win, reason: reason || '', saved, target, level, danger: !!o.danger,
        destroyed: destroyed.slice(), survivors: aliveCount,
      };
    }

    function updateFx(dt) {
      for (const p of parts) {
        if (!p.on) continue;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; p.life -= dt;
        if (p.life <= 0) p.on = false;
      }
      for (const p of pops) {
        if (!p.on) continue;
        p.y -= 28 * dt; p.t -= dt;
        if (p.t <= 0) p.on = false;
      }
    }

    function update(dt) {
      updateFx(dt);
      if (phase === 'assemble') {
        assembleT += dt;
        if (assembleT >= assembleEnd) {
          phase = 'play';
          if (o.onAssembled) o.onAssembled();
        }
        return;
      }
      if (phase === 'over') {
        overT -= dt;
        if (overT <= 0) finish();
        return;
      }
      elapsed += dt;

      // Player
      const mv = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
      player.x = clamp(player.x + mv * PLAYER_SPEED * dt, 8, W - player.w - 8);
      player.cd -= dt;
      if (player.invuln > 0) player.invuln -= dt;
      if (keys[' '] && player.cd <= 0) {
        const s = take(pShots);
        if (s) { s.on = true; s.x = player.x + player.w / 2; s.y = player.y - 4; player.cd = FIRE_CD; A.shoot(); }
      }

      // Formation
      stepT -= dt;
      if (stepT <= 0) { stepT = stepInterval(); march(); }
      for (const v of inv) {
        const t = v.tw;
        if (!t) continue;
        t.t = Math.min(1, t.t + dt / 0.45);
        const e = ease(t.t);
        v.cx = t.x0 + (t.x1 - t.x0) * e;
        v.cy = t.y0 + (t.y1 - t.y0) * e;
        if (t.t >= 1) v.tw = null;
      }
      let lowest = 0;
      for (const v of inv) if (v.alive) lowest = Math.max(lowest, iy(v) + BODY_H);
      if (lowest >= player.y - 2) { end(false, 'The meetings reached your desk. Your week is fully booked.'); return; }

      fireT -= dt;
      if (fireT <= 0) { fireT = rand(0.6, 1.4) / (1 + 0.25 * (level - 1)) / (1 + elapsed / 90); enemyFire(); }
      shuffleT -= dt;
      if (shuffleT <= 0) { shuffleT = rand(4, 7) / (1 + 0.1 * (level - 1)); shuffle(); }

      // ALL-HANDS mystery ship
      if (ufo.on) {
        ufo.x += ufo.vx * dt;
        if (ufo.x > W + 10 || ufo.x < -ufo.w - 10) { ufo.on = false; A.ufoStop(); ufoT = rand(15, 25); }
      } else if ((ufoT -= dt) <= 0) {
        ufo.on = true;
        const d = Math.random() < 0.5 ? 1 : -1;
        ufo.x = d > 0 ? -ufo.w : W;
        ufo.vx = 150 * d;
        A.ufoStart();
      }

      // Player shots
      for (const s of pShots) {
        if (!s.on) continue;
        s.y -= SHOT_SPEED * dt;
        if (s.y < -12) { s.on = false; continue; }
        if (bunkerHit(s.x, s.y) || bunkerHit(s.x, s.y + 6)) { s.on = false; continue; }
        if (ufo.on && s.x >= ufo.x && s.x <= ufo.x + ufo.w && s.y <= ufo.y + ufo.h && s.y + 12 >= ufo.y) {
          s.on = false; ufo.on = false; ufoT = rand(15, 25);
          A.ufoStop(); A.bonus();
          explode(ufo.x + ufo.w / 2, ufo.y + 14, '#ff5252', 18);
          popup('+1h ALL-HANDS SKIPPED', ufo.x + ufo.w / 2, ufo.y + 40, '#ff8a80');
          saved += 1;
          destroyed.push({ title: 'ALL-HANDS', mins: 60, bonus: true, when: '' });
          updHud();
          if (saved >= target - 1e-9) { end(true); return; }
          continue;
        }
        for (const v of inv) {
          if (!v.alive) continue;
          const x = ix(v), y = iy(v);
          if (s.x >= x && s.x <= x + v.w && s.y <= y + BODY_H && s.y + 12 >= y) {
            s.on = false;
            kill(v);
            break;
          }
        }
        if (phase !== 'play') return;
        if (!s.on) continue;
        for (const e of eShots) {
          if (e.on && Math.abs(e.x - s.x) < 7 && e.y + 9 >= s.y && e.y <= s.y + 12) { e.on = false; s.on = false; break; }
        }
      }

      // Enemy shots
      for (const e of eShots) {
        if (!e.on) continue;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.y > H + 10 || e.x < -12 || e.x > W + 12) { e.on = false; continue; }
        if (bunkerHit(e.x, e.y + 9)) { e.on = false; continue; }
        if (player.invuln <= 0 && e.x + 6 >= player.x + 4 && e.x - 6 <= player.x + player.w - 4 &&
            e.y + 9 >= player.y + 2 && e.y <= player.y + player.h) {
          hitPlayer();
          if (phase !== 'play') return;
          break;
        }
      }
    }

    // ---------- Rendering ----------
    function render() {
      ctx.clearRect(0, 0, W, H);

      if (phase === 'assemble') {
        for (const v of inv) {
          const t = ease(clamp((assembleT - v.delay) / ASSEMBLE_DUR, 0, 1));
          ctx.drawImage(v.spr[0],
            v.sx + (ix(v) - v.sx) * t, v.sy + (iy(v) - v.sy) * t,
            v.sw + (v.w - v.sw) * t, v.sh + (v.h - v.sh) * t);
        }
        ctx.globalAlpha = clamp((assembleT - assembleEnd + 0.8) / 0.8, 0, 1);
        drawGround();
        ctx.globalAlpha = 1;
        return;
      }

      drawGround();
      for (const v of inv) if (v.alive) ctx.drawImage(v.spr[frameIdx], ix(v), iy(v));
      if (ufo.on) ctx.drawImage(ufoSpr, ufo.x, ufo.y);

      ctx.fillStyle = '#b9ffd6';
      for (const s of pShots) if (s.on) ctx.fillRect(s.x - 1.5, s.y, 3, 12);
      for (const e of eShots) if (e.on) ctx.drawImage(envSpr, e.x - 6, e.y);

      for (const p of parts) {
        if (!p.on) continue;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      if (pops[0].on || pops[1].on || pops[2].on || pops[3].on || pops[4].on || pops[5].on || pops[6].on || pops[7].on) {
        ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        for (const p of pops) {
          if (!p.on) continue;
          ctx.globalAlpha = Math.min(1, p.t * 2);
          ctx.fillStyle = p.c;
          ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'start';
      }
    }

    function drawGround() {
      for (let pass = 2; pass >= 1; pass--) {
        ctx.fillStyle = pass === 2 ? '#3ddc84' : '#1f8a50';
        for (const b of bunkers) {
          for (let i = 0; i < b.cells.length; i++) {
            if (b.cells[i] === pass) ctx.fillRect(b.x + (i % B_COLS) * CELL_W, b.y + ((i / B_COLS) | 0) * CELL_H, CELL_W, CELL_H);
          }
        }
      }
      for (const b of bunkers) ctx.drawImage(b.lbl, b.x + (B_COLS * CELL_W) / 2 - 48, b.y + B_ROWS * CELL_H + 3);
      if (!(player.invuln > 0 && ((player.invuln * 10) | 0) & 1)) ctx.drawImage(player.spr, player.x, player.y - 10);
      ctx.fillStyle = '#3ddc8455';
      ctx.fillRect(0, H - 16, W, 2);
    }

    // ---------- Loop ----------
    function setLowQ() {
      lowQ = true;
      for (const p of parts) p.on = false;
      root.classList.add('ci-lowq');
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;

      ema = ema * 0.95 + dt * 1000 * 0.05;
      warm += dt;
      if (!lowQ && !paused && phase === 'play' && warm > 3 && ema > 22) setLowQ();
      if (perfOn && (perfT -= dt) <= 0) {
        perfT = 0.5;
        perfEl.textContent = Math.round(1000 / ema) + ' fps · ' + ema.toFixed(1) + ' ms' + (lowQ ? ' · low-power mode' : '') +
          (scale < 1 ? ' · half-res' : '');
      }

      if (!paused) {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 5 && running) { update(STEP); acc -= STEP; n++; }
        if (n === 5) acc = 0;
      }
      if (!running) return;
      if (lowQ && (skipFrame = !skipFrame)) return; // ~30 fps rendering in low-power mode
      render();
    }

    function setPaused(v) {
      if (phase !== 'play' && v) return;
      paused = v;
      pauseEl.classList.toggle('on', paused);
      if (paused) A.ufoStop();
      else { if (ufo.on) A.ufoStart(); last = performance.now(); }
      for (const k in keys) keys[k] = false;
    }

    function onKey(e) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
      const down = e.type === 'keydown';
      if (k === ' ' || k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'd') keys[k] = down;
      if (down && !e.repeat) {
        if (k === 'p') setPaused(!paused);
        else if (k === 'f') { perfOn = !perfOn; perfEl.classList.toggle('on', perfOn); perfT = 0; }
      }
    }
    const onBlur = () => { for (const k in keys) keys[k] = false; };

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('blur', onBlur);
      if (CI.onKey === onKey) CI.onKey = null;
      A.ufoStop();
      canvas.remove(); hud.remove(); toast.remove(); pauseEl.remove(); perfEl.remove();
      canvas.width = canvas.height = 0; // release the backing store right away
    }

    function finish() {
      const r = result;
      stop();
      if (o.onEnd) o.onEnd(r);
    }

    addEventListener('resize', resize);
    addEventListener('blur', onBlur);
    CI.onKey = onKey;
    raf = requestAnimationFrame(frame);

    return { stop, pause: setPaused };
  };
})();
