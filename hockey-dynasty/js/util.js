// Shared helpers. Every module hangs off the global HD namespace so the game
// runs from a plain file:// double-click with no build step or module loader.
var HD = HD || {};

HD.rand = function () { return Math.random(); };
HD.randInt = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
HD.randFloat = function (a, b) { return a + Math.random() * (b - a); };
HD.chance = function (p) { return Math.random() < p; };
HD.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
HD.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
HD.round = function (v, d) { var m = Math.pow(10, d || 0); return Math.round(v * m) / m; };

HD.gauss = function (mean, sd) {
  var u = 1 - Math.random(), v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

HD.poisson = function (lambda) {
  var L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
};

HD.shuffle = function (arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};

HD.weightedPick = function (items, weightFn) {
  var total = 0, ws = [];
  for (var i = 0; i < items.length; i++) { var w = Math.max(0, weightFn(items[i])); ws.push(w); total += w; }
  if (total <= 0) return null;
  var r = Math.random() * total;
  for (var j = 0; j < items.length; j++) { r -= ws[j]; if (r <= 0) return items[j]; }
  return items[items.length - 1];
};

HD.sum = function (arr, fn) { var s = 0; for (var i = 0; i < arr.length; i++) s += fn ? fn(arr[i]) : arr[i]; return s; };
HD.avg = function (arr, fn) { return arr.length ? HD.sum(arr, fn) / arr.length : 0; };

HD.sortBy = function (arr, fn, desc) {
  return arr.slice().sort(function (a, b) { var x = fn(a), y = fn(b); return desc ? y - x : x - y; });
};

HD.hash = function (str) {
  var h = 2166136261;
  str = String(str);
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

HD.money = function (n, precise) {
  var neg = n < 0; n = Math.abs(n);
  var s;
  if (n >= 1e9) s = '$' + (n / 1e9).toFixed(2) + 'B';
  else if (n >= 1e6) s = '$' + (n / 1e6).toFixed(precise ? 2 : 1) + 'M';
  else if (n >= 1e3) s = '$' + (n / 1e3).toFixed(0) + 'K';
  else s = '$' + Math.round(n);
  return neg ? '-' + s : s;
};

HD.signed = function (n) { n = Math.round(n); return (n > 0 ? '+' : '') + n; };

HD.esc = function (s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

// Fill {placeholders} in event / news templates.
HD.fmt = function (tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
};
