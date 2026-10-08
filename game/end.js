// End-of-game report: what got "destroyed". In Danger Mode it plays along, then confesses.
(function () {
  const CI = window.__CI;
  if (!CI) return;
  const h = CI.h;

  CI.showEnd = function (res, actions) {
    const list = res.destroyed;
    const attendees = list.reduce((s, m) => s + 3 + (CI.hash(m.title) % 38), 0);
    const rowDelay = (i) => Math.min(i, 20) * 0.06;
    const stampDelay = rowDelay(list.length) + 0.9;

    const rows = list.map((m, i) =>
      h('tr', { style: 'animation-delay:' + rowDelay(i) + 's' },
        h('td', { class: 'ci-status' }, res.danger ? h('span', { class: 'ci-declined' }, 'DECLINED ✓') : 'DESTROYED'),
        h('td', null, m.title, m.decoy ? h('em', null, ' (filler)') : null, m.bonus ? h('em', null, ' (bonus)') : null),
        h('td', { class: 'ci-when' }, m.when || ''),
        h('td', { class: 'ci-dur' }, CI.fmtDur(m.mins))));

    const again = h('button', { class: 'ci-btn', onclick: () => go('again') }, res.win ? 'Next wave (harder)' : 'Try again');
    const quit = h('button', { class: 'ci-btn ci-btn-alt', onclick: () => go('quit') }, 'Return to Calendar');

    const box = h('div', { class: 'ci-end-box' },
      h('h2', { class: res.win ? 'ci-win' : 'ci-lose' }, res.win ? 'VICTORY' : 'DEFEAT'),
      h('p', { class: 'ci-end-sub' },
        res.win ? ['You reclaimed ', h('b', null, CI.fmtH(res.saved)), ' of your week.'] : res.reason,
        h('br'), 'Saved ' + CI.fmtH(res.saved) + ' of a ' + CI.fmtH(res.target) + ' target · ' + res.survivors + ' meetings survived'),
      res.danger ? h('p', { class: 'ci-danger-note' }, list.length + ' meetings declined · ' + attendees + ' attendees notified · 0 apologies sent') : null,
      list.length
        ? h('div', { class: 'ci-table-wrap' }, h('table', null, h('tbody', null, rows)))
        : h('p', { class: 'ci-none' }, 'No meetings were harmed.'),
      res.danger
        ? h('div', { class: 'ci-stamp', style: 'animation-delay:' + stampDelay + 's' }, 'JUST KIDDING', h('small', null, 'Nothing on your calendar was changed.'))
        : h('p', { class: 'ci-safe' }, 'Nothing on your real calendar was changed.'),
      h('div', { class: 'ci-end-btns' }, again, quit));

    const layer = h('div', { class: 'ci-layer ci-end' }, box);
    CI.root.appendChild(layer);
    again.focus();

    let done = false;
    function go(what) {
      if (done) return;
      done = true;
      layer.remove();
      CI.onKey = null;
      actions[what]();
    }

    CI.onKey = (e) => {
      if (e.type !== 'keydown') return;
      const k = e.key.toLowerCase();
      if (k === 'r') go('again');
      else if (k.startsWith('arrow')) (document.activeElement === again ? quit : again).focus();
      else if (k === 'enter' || k === ' ') go(document.activeElement === quit ? 'quit' : 'again');
    };
  };
})();
