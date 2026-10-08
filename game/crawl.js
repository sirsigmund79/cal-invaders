// Opening crawl + title screen. All motion is CSS transform/opacity animation, so it runs
// on the compositor and leaves the main thread idle.
(function () {
  const CI = window.__CI;
  if (!CI) return;
  const h = CI.h;

  CI.crawl = function (data, onDone) {
    const root = CI.root, A = CI.audio;
    const n = data.meetings.length;
    const villain = data.meetings.find((m) => !m.decoy) || data.meetings[0];
    const total = CI.fmtH(data.totalH), target = CI.fmtH(data.targetH);

    const opening = data.real
      ? ['It is a period of calendar war. ', h('b', null, n + ' meetings'), ', totalling ', h('b', null, total),
         ', have seized control of the week, striking without warning from recurring invites scattered across the galaxy.']
      : ['Even an empty calendar is not safe. ', h('b', null, n + ' phantom meetings'), ', totalling ', h('b', null, total),
         ', have materialized from the void of "quick questions" and "got a sec?" messages.'];

    const crawlText = h('div', { class: 'ci-crawl' },
      h('p', { class: 'ci-ep' }, 'EPISODE 9:00 AM'),
      h('p', { class: 'ci-ep-title' }, 'RETURN OF THE STANDUP'),
      h('p', null, opening),
      h('p', null, 'Led by the dreaded ', h('b', null, villain.title), ', a ', CI.fmtDur(villain.mins),
        ' monstrosity, the MEETING EMPIRE plans to occupy every last free block, leaving no time for actual work.'),
      h('p', null, 'Armed with a lone FOCUS TIME starfighter and three precious PTO days, one weary employee must reclaim ',
        h('b', null, target), ' before the invites reach their desk....'));

    const layer = h('div', { class: 'ci-layer ci-crawl-layer' },
      h('div', { class: 'ci-intro' }, 'In a conference room far,', h('br'), 'far away....'),
      h('div', { class: 'ci-logo' }, 'CAL', h('br'), 'INVADERS'),
      h('div', { class: 'ci-crawl-wrap' }, crawlText),
      h('div', { class: 'ci-hint' }, 'Press any key for sound  ·  Space to skip  ·  Esc to quit'));
    root.appendChild(layer);

    // Crawl distance depends on how tall the text ended up.
    crawlText.style.setProperty('--ci-dist', -Math.round(crawlText.offsetHeight + innerHeight * 1.6) + 'px');
    crawlText.addEventListener('animationend', toTitle);
    layer.addEventListener('click', toTitle);
    CI.later(() => A.fanfare(), 4600);
    CI.later(toTitle, 48000);

    CI.onKey = (e) => {
      if (e.type === 'keydown' && (e.key === ' ' || e.key === 'Enter')) toTitle();
    };

    let titled = false;
    function toTitle() {
      if (titled || !CI.root) return;
      titled = true;
      layer.remove();
      showTitle();
    }

    function showTitle() {
      const potato = h('input', { type: 'checkbox' });
      const choose = (mode) => {
        title.remove();
        CI.onKey = null;
        onDone({ danger: mode === 'danger', lowRes: potato.checked });
      };
      const normal = h('button', { class: 'ci-mode', onclick: () => choose('normal') },
        'NORMAL', h('small', null, 'Just a game. Blast meetings, save hours.'));
      const danger = h('button', { class: 'ci-mode ci-danger', onclick: () => choose('danger') },
        '⚠ DANGER MODE', h('small', null, 'Connected to your LIVE calendar. Destroyed meetings will be DECLINED and organizers NOTIFIED.'));
      const btns = [normal, danger];

      const title = h('div', { class: 'ci-layer ci-title' },
        h('div', { class: 'ci-title-logo' }, 'CAL INVADERS'),
        h('p', { class: 'ci-title-sub' }, 'Reclaim ', h('b', null, target), ' from ', n, ' meetings',
          data.real ? '' : ' (no meetings found on screen, so the Empire sent fakes)'),
        h('div', { class: 'ci-modes' }, normal, danger),
        h('label', { class: 'ci-potato' }, potato, ' Potato mode (half-resolution rendering for slow laptops)'),
        h('p', { class: 'ci-keys' }, '← → / A D move  ·  Space fire  ·  P pause  ·  M mute  ·  F perf meter  ·  Esc quit'));
      root.appendChild(title);
      normal.focus();

      CI.onKey = (e) => {
        if (e.type !== 'keydown') return;
        const k = e.key.toLowerCase();
        if (k === 'n' || k === '1') choose('normal');
        else if (k === 'd' || k === '2') choose('danger');
        else if (k.startsWith('arrow')) (document.activeElement === normal ? danger : normal).focus();
        else if (k === 'enter' || k === ' ') {
          const b = btns.indexOf(document.activeElement);
          choose(b === 1 ? 'danger' : 'normal');
        }
      };
    }
  };
})();
