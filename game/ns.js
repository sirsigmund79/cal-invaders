// Shared namespace + tiny helpers. Every other game file attaches to window.__CI.
(function () {
  if (window.__CI) return;
  const CI = (window.__CI = {});

  // DOM builder that never touches innerHTML (Google pages enforce Trusted Types).
  CI.h = function (tag, props) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const kids = [].concat(arguments[i]);
      for (const c of kids) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
    }
    return e;
  };

  CI.fmtDur = (mins) => (mins < 60 ? Math.round(mins) + 'm' : +(mins / 60).toFixed(2) + 'h');
  CI.fmtH = (h) => +h.toFixed(2) + 'h';
  CI.rand = (a, b) => a + Math.random() * (b - a);
  CI.hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // Timers registered here are cleared on teardown.
  CI.timers = [];
  CI.later = (fn, ms) => { const id = setTimeout(fn, ms); CI.timers.push(id); return id; };
})();
