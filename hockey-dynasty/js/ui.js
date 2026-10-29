// UI core: helpers, portraits, layout shell, modals, event window, character sheet.
var HD = HD || {};
HD.UI = { tab: 'office', sub: {}, modal: null, sheetMsg: null, trade: { team: null, give: [], get: [] }, newsFilter: 'all', rosterSort: 'slot', faPos: 'all', setup: null };

// ---------- Small render helpers ----------
var U = HD.UI;
U.e = HD.esc;
U.ovrCls = function (v) { return v >= 85 ? 's' : v >= 78 ? 'a' : v >= 70 ? 'b' : v >= 62 ? 'c' : 'd'; };
U.ovr = function (v) { return '<span class="ovr ' + U.ovrCls(v) + '">' + v + '</span>'; };
U.op = function (fromId, toId) {
  toId = toId || HD.G.playerId;
  var v = HD.opinion(fromId, toId), L = HD.opinionLabel(v);
  var tip = HD.opinionBreakdown(fromId, toId).map(function (r) { return HD.signed(r.v) + ' ' + r.l; }).join('\n');
  return '<span class="op ' + L.c + '" title="' + U.e(L.t + '\n' + tip) + '">' + HD.signed(v) + '</span>';
};
U.bar = function (v, max, cls) { return '<div class="bar ' + (cls || '') + '"><i style="width:' + HD.clamp(v / max * 100, 0, 100) + '%"></i></div>'; };
U.meter = function (v, max, cls, label) { return '<div class="meter">' + U.bar(v, max, cls) + '<span class="nowrap">' + (label !== undefined ? label : Math.round(v)) + '</span></div>'; };
U.traitChips = function (p) {
  return p.traits.map(function (t) { var d = HD.TRAITS[t]; return d ? '<span class="chip trait" title="' + U.e(d.desc) + '">' + d.icon + ' ' + d.name + '</span>' : ''; }).join('');
};
U.relChip = function (rel) { return rel ? '<span class="chip rel-' + rel + '">' + rel.charAt(0).toUpperCase() + rel.slice(1) + '</span>' : ''; };
U.plink = function (p, text) { if (!p) return '—'; return '<a data-act="person" data-id="' + p.id + '">' + U.e(text || HD.fullName(p)) + '</a>'; };
U.tlink = function (t, full) { if (!t) return '<span class="dim">Free Agent</span>'; return '<a data-act="team" data-id="' + t.id + '"><span class="teamdot" style="background:' + t.colors[0] + '"></span>' + U.e(full ? HD.teamName(t) : t.name) + '</a>'; };
U.crest = function (t, size) {
  size = size || 40;
  return '<span class="crest" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.36) + 'px;background:linear-gradient(135deg,' + t.colors[0] + ' 55%,' + t.colors[1] + ')">' + t.abbr + '</span>';
};
U.flag = function (p) { var n = HD.NATIONS[p.nation]; return n ? '<span title="' + n.name + '">' + n.flag + '</span>' : ''; };
U.pos = function (p) { return '<span class="pos">' + p.pos + '</span>'; };
U.when = function (n) { return 'S' + String(n.y).slice(2) + ' W' + n.w; };
U.injury = function (p) { return p.injury > 0 ? ' <span class="inj" title="' + U.e(p.injuryDesc || 'Injured') + '">✚' + p.injury + 'w</span>' : ''; };
U.potText = function (p) {
  var mine = p.teamId === HD.me().teamId;
  var noise = HD.scoutNoise() * (mine ? 0.5 : 1);
  if (noise <= 1.5) return String(p.pot);
  var est = p.scoutPot && p.role === 'prospect' ? p.scoutPot : p.pot + Math.round(((HD.hash(p.id + HD.G.season) % 100) / 100 - 0.5) * noise);
  var lo = Math.max(p.ovr, Math.round(est - noise / 2)), hi = Math.min(99, Math.round(est + noise / 2));
  return lo >= hi ? String(lo) : lo + '–' + hi;
};
U.contract = function (p) { if (!p.contract) return '<span class="dim">—</span>'; return HD.money(p.contract.salary) + ' <span class="dim">×' + p.contract.years + '</span>' + (p.contract.next ? ' <span class="tag gold" title="Extension signed: ' + HD.money(p.contract.next.salary) + ' x ' + p.contract.next.years + '">EXT</span>' : ''); };
U.spark = function (arr, w, h) {
  if (!arr || arr.length < 2) return '';
  var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr), rng = mx - mn || 1;
  var pts = arr.map(function (v, i) { return (i / (arr.length - 1) * w).toFixed(1) + ',' + (h - (v - mn) / rng * (h - 2) - 1).toFixed(1); }).join(' ');
  var up = arr[arr.length - 1] >= arr[0];
  return '<svg class="spark" width="' + w + '" height="' + h + '"><polyline fill="none" stroke="' + (up ? '#5fbf77' : '#e0605a') + '" stroke-width="1.5" points="' + pts + '"/></svg>';
};

// ---------- Procedural portraits ----------
U.SKIN = ['#f3d7c0', '#eac0a0', '#d6a47e', '#b8825c', '#8f5f40', '#6b442c'];
U.HAIR = ['#24180f', '#3d2818', '#5c3c22', '#8a6034', '#c9a15d', '#e2c98f', '#151515', '#7a3b1f'];
// Deterministic appearance shared by 2D portraits and 3D office characters.
U.looks = function (p) {
  var h = HD.hash(p.id + p.first);
  var r = function (n) { var v = h % n; h = Math.floor(h / n) + 7919 * (v + 1); return v; };
  var skin = U.SKIN[r(U.SKIN.length)];
  var hair = U.HAIR[r(U.HAIR.length)];
  if (p.age >= 70) hair = '#e8e8e8'; else if (p.age >= 55) hair = '#a7a7a7'; else if (p.age >= 46 && r(2)) hair = '#7d7368';
  var style = r(5), beard = p.gender === 'm' && p.age >= 20 && r(3) === 0;
  var team = p.teamId && HD.G.teams[p.teamId];
  return {
    skin: skin, hair: hair, style: style, beard: beard, female: p.gender === 'f', team: team,
    c1: team ? team.colors[0] : (p.role === 'journalist' ? '#3b3f46' : p.role === 'agent' ? '#2b2f38' : p.role === 'owner' ? '#1b1b1b' : '#384050'),
    c2: team ? team.colors[1] : '#8a8f99',
    suit: p.role === 'owner' || p.role === 'gm' || p.role === 'manager' || p.role === 'agent' || p.role === 'commissioner' || p.role === 'coach'
  };
};
U.portrait = function (p, size) {
  size = size || 40;
  if (!p) return '<svg class="portrait" width="' + size + '" height="' + size + '"></svg>';
  var L = U.looks(p);
  var skin = L.skin, hair = L.hair, style = L.style, beard = L.beard, f = L.female, team = L.team, c1 = L.c1, c2 = L.c2, suit = L.suit;
  var bg1 = team ? team.colors[0] : '#2a3140';
  var s = '<svg xmlns="http://www.w3.org/2000/svg" class="portrait' + (size >= 80 ? ' lg' : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 100 100">';
  s += '<defs><linearGradient id="bg' + p.id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + bg1 + '" stop-opacity=".55"/><stop offset="1" stop-color="#0b0e13"/></linearGradient></defs>';
  s += '<rect width="100" height="100" fill="url(#bg' + p.id + ')"/>';
  // Long hair behind head
  if (f || style === 3) s += '<path d="M24 46 Q22 80 30 88 L70 88 Q78 80 76 46 Z" fill="' + hair + '"/>';
  // Body
  if (suit) {
    s += '<path d="M10 100 Q14 74 50 72 Q86 74 90 100 Z" fill="' + (p.role === 'coach' ? c1 : '#1d2330') + '"/>';
    s += '<path d="M42 73 L50 92 L58 73 Z" fill="#e9e9e9"/><path d="M48 76 L50 92 L52 76 Z" fill="' + c2 + '"/>';
  } else {
    s += '<path d="M8 100 Q12 72 50 70 Q88 72 92 100 Z" fill="' + c1 + '"/>';
    s += '<path d="M36 72 Q50 82 64 72 L62 70 Q50 76 38 70 Z" fill="' + c2 + '"/>';
    if (p.role === 'player' || p.role === 'prospect') s += '<path d="M8 92 L92 92 L92 96 L8 96 Z" fill="' + c2 + '" opacity=".8"/>';
  }
  s += '<rect x="43" y="58" width="14" height="14" fill="' + skin + '"/>';
  s += '<ellipse cx="50" cy="44" rx="' + (f ? 17 : 18) + '" ry="22" fill="' + skin + '"/>';
  s += '<ellipse cx="31.5" cy="46" rx="3" ry="5" fill="' + skin + '"/><ellipse cx="68.5" cy="46" rx="3" ry="5" fill="' + skin + '"/>';
  // Hair on top
  var top = [
    'M31 40 Q32 20 50 20 Q68 20 69 40 Q62 28 50 29 Q38 28 31 40 Z',
    'M31 42 Q30 18 52 19 Q70 21 69 40 Q60 26 44 30 Q36 33 31 42 Z',
    p.age >= 40 ? 'M33 34 Q38 24 50 24 Q62 24 67 34 Q60 30 50 30 Q40 30 33 34 Z' : 'M32 38 Q34 22 50 22 Q66 22 68 38 Q58 30 50 30 Q42 30 32 38 Z',
    'M30 46 Q28 18 50 18 Q72 18 70 46 Q66 28 50 28 Q34 28 30 46 Z',
    'M32 36 Q36 23 50 23 Q64 23 68 36 Q60 31 50 31 Q40 31 32 36 Z'
  ][style];
  s += '<path d="' + top + '" fill="' + hair + '"/>';
  // Face
  s += '<ellipse cx="43" cy="45" rx="2.2" ry="2.4" fill="#1b1410"/><ellipse cx="57" cy="45" rx="2.2" ry="2.4" fill="#1b1410"/>';
  s += '<path d="M38.5 40 L47 39.5 M53 39.5 L61.5 40" stroke="' + hair + '" stroke-width="2" stroke-linecap="round"/>';
  s += '<path d="M50 47 L48 54 L51 54.5" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.3"/>';
  var mood = p.id === HD.G.playerId ? 0 : HD.opinion(p.id, HD.G.playerId);
  var mouth = mood > 25 ? 'M43 59 Q50 64 57 59' : mood < -25 ? 'M43 61 Q50 57 57 61' : 'M44 60 L56 60';
  s += '<path d="' + mouth + '" fill="none" stroke="#5b2e26" stroke-width="1.8" stroke-linecap="round"/>';
  if (beard) s += '<path d="M33 50 Q34 68 50 68 Q66 68 67 50 Q64 62 50 63 Q36 62 33 50 Z" fill="' + hair + '" opacity=".85"/>';
  if (p.injury > 0) s += '<rect x="56" y="30" width="12" height="4" rx="1" fill="#f4f4f4" transform="rotate(-20 62 32)"/>';
  if (!p.alive) s += '<rect width="100" height="100" fill="#000" opacity=".55"/>';
  s += '</svg>';
  return s;
};

// ---------- Shell ----------
HD.UI.render = function () {
  var app = document.getElementById('app');
  if (!HD.G) { app.innerHTML = HD.UI.startScreen(); return; }
  if (HD.G.gameOver) { app.innerHTML = HD.UI.gameOverScreen(); U.renderModal(); return; }
  var me = HD.me(), t = HD.myTeam(), G = HD.G;
  var pending = G.pendingEvents.length;
  var phase = HD.phaseOf(G.week);
  var html = '<div class="topbar">';
  html += '<div class="brand">HOCKEY DYNASTY<small>' + HD.seasonLabel(G.season) + ' · Week ' + G.week + ' · ' + HD.PHASE_NAMES[phase] + '</small></div>';
  if (t) {
    var rank = HD.standings().indexOf(t) + 1;
    html += '<div class="row" style="gap:8px">' + U.crest(t, 34) + '<div class="stat"><span class="k">' + U.e(t.name) + '</span><span class="v">' + t.record.w + '-' + t.record.l + '-' + t.record.otl + ' <span class="dim">(' + HD.ordinal(rank) + ')</span></span></div></div>';
    var ownOp = HD.opinion(t.ownerId, me.id);
    html += '<div class="stat" title="Owner\'s opinion of you. Below -60 in-season, you are fired."><span class="k">Job Security</span><span class="v">' + U.op(t.ownerId) + (me.stakes >= 50 ? ' <span class="tag gold">Owner</span>' : '') + '</span></div>';
    html += '<div class="stat"><span class="k">Team Funds</span><span class="v ' + (t.finance.balance < 0 ? 'bad' : '') + '">' + HD.money(t.finance.balance) + '</span></div>';
    html += '<div class="stat"><span class="k">Cap Space</span><span class="v">' + HD.money(HD.capSpace(t)) + '</span></div>';
  } else html += '<div class="stat"><span class="k">Status</span><span class="v warn">Unemployed</span></div>';
  html += '<div class="stat"><span class="k">Your Wealth</span><span class="v ' + (me.wealth < 0 ? 'bad' : 'gold') + '">' + HD.money(me.wealth) + '</span></div>';
  html += '<div class="stat" title="Prestige raises everyone\'s opinion of you and attracts free agents."><span class="k">Prestige</span><span class="v">★ ' + Math.round(me.prestige) + '</span></div>';
  html += '<div class="stat" title="High stress hurts your skills and health."><span class="k">Stress</span><span class="v">' + U.meter(me.stress, 100, me.stress > 70 ? 'bad' : me.stress > 45 ? 'warn' : 'good') + '</span></div>';
  html += '<div class="grow"></div>';
  html += '<button class="small" data-act="menu" title="Save / load / new game">☰</button>';
  html += pending ? '<button class="primary advance" data-act="openEvent">⚑ Decision Pending (' + pending + ')</button>' : '<button class="primary advance" data-act="advance" title="Space">Continue ▶</button>';
  html += '</div><div class="body"><nav class="nav">';
  var tabs = [['office', '🏢', 'Office'], ['home', '🏠', 'Overview'], ['roster', '🏒', 'Roster'], ['people', '👥', 'Relations'], ['league', '🏆', 'League'], ['market', '🔁', 'Transactions'], ['finance', '🏦', 'Club Finances'], ['personal', '💼', 'Your Life'], ['chronicle', '📜', 'Chronicle']];
  tabs.forEach(function (tb) {
    var badge = '';
    if (tb[0] === 'market' && phase === 'freeagency') badge = '<span class="badge">FA</span>';
    if (tb[0] === 'market' && phase === 'draft') badge = '<span class="badge">Draft</span>';
    html += '<a data-act="tab" data-tab="' + tb[0] + '" class="' + (U.tab === tb[0] ? 'on' : '') + '"><span class="ico">' + tb[1] + '</span><span class="lbl">' + tb[2] + '</span>' + badge + '</a>';
  });
  if (U.tab === 'office' && !HD.Office.supported()) U.tab = 'home';
  var office = U.tab === 'office';
  html += '</nav><main class="main' + (office ? ' office-main' : '') + '">' + (office ? U.officeHtml() : (HD.VIEWS[U.tab] || HD.VIEWS.home)()) + '</main></div>';
  var scroll = window.scrollY;
  app.innerHTML = html;
  window.scrollTo(0, office ? 0 : scroll);
  if (office) HD.Office.mount(document.getElementById('office-host'));
  U.renderModal();
};

U.goTab = function (tab) { U.tab = tab; U.close(); window.scrollTo(0, 0); };
U.officeHtml = function () {
  var G = HD.G, n = G.pendingEvents.length;
  var spots = [['openEvent', '📥', 'Inbox' + (n ? ' (' + n + ')' : '')], ['home', '🖥️', 'Computer'], ['roster', '📋', 'Whiteboard'], ['people', '📌', 'Relations'], ['league', '📺', 'TV'], ['market', '☎️', 'Phone'], ['finance', '🏦', 'Safe'], ['personal', '💻', 'Laptop'], ['chronicle', '📜', 'Chronicle']];
  var h = '<div class="office-host" id="office-host"><div class="office-tip"></div><div class="office-bubble" data-act="openEvent"></div>';
  h += '<div class="office-hud"><div class="office-title">Your Office <span>Click anything in the room</span></div><div class="office-spots">';
  spots.forEach(function (s) { h += s[0] === 'openEvent' ? '<button class="small' + (n ? ' primary' : '') + '" data-act="openEvent"' + (n ? '' : ' disabled') + '>' + s[1] + ' ' + s[2] + '</button>' : '<button class="small" data-act="tab" data-tab="' + s[0] + '">' + s[1] + ' ' + s[2] + '</button>'; });
  return h + '</div></div></div>';
};

U.renderModal = function () {
  var root = document.getElementById('modal-root');
  if (!U.modal) { root.innerHTML = ''; return; }
  var m = U.modal;
  var inner = typeof m.render === 'function' ? m.render() : m.html;
  root.innerHTML = '<div class="modal-bg" data-act="' + (m.locked ? '' : 'closeModalBg') + '"><div class="modal ' + (m.cls || '') + '">' + inner + '</div></div>';
};
U.open = function (m) { U.modal = m; U.renderModal(); };
U.close = function () { U.modal = null; U.sheetMsg = null; HD.UI.render(); };
U.toast = function (msg) {
  var d = document.createElement('div'); d.className = 'toast'; d.innerHTML = msg;
  document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3200);
};
U.head = function (title, sub) { return '<div class="modal-head"><div><h2>' + title + '</h2>' + (sub ? '<div class="muted">' + sub + '</div>' : '') + '</div><button class="x" data-act="closeModal">×</button></div>'; };

// ---------- Event window ----------
U.showEvent = function () {
  var G = HD.G;
  if (!G.pendingEvents.length) { U.close(); return; }
  var ev = G.pendingEvents[0];
  var def = HD.EVENTS[ev.id];
  var v = def.view(ev.ctx);
  U.curEvent = { ev: ev, v: v, outcome: null };
  U.open({ cls: 'event', locked: true, render: U.eventHtml });
};
U.eventHtml = function () {
  var ce = U.curEvent, v = ce.v;
  var h = '<div class="modal-head"><h2>' + U.e(v.title) + '</h2></div>';
  var ps = (v.portraits || []).map(HD.person).filter(Boolean);
  if (ps.length) h += '<div class="event-art">' + ps.map(function (p) { return '<div class="center">' + U.portrait(p, 96) + '<div class="help" style="margin-top:4px">' + U.e(HD.fullName(p)) + '<br>' + (p.id === HD.G.playerId ? '' : U.op(p.id)) + '</div></div>'; }).join('') + '</div>';
  h += '<div class="event-text">' + v.text + '</div>';
  if (ce.outcome !== null) {
    h += '<div class="outcome">' + U.e(ce.outcome) + '</div>';
    h += '<div class="event-opts"><button class="primary" data-act="eventDone">' + (HD.G.pendingEvents.length && U.tab !== 'office' ? 'Next ▸' : 'Continue') + '</button></div>';
  } else {
    h += '<div class="event-opts">' + v.options.map(function (o, i) {
      return '<button class="event-opt" data-act="eventOpt" data-i="' + i + '"' + (o.disabled ? ' disabled' : '') + '>' + U.e(o.label) + (o.hint ? '<span class="hint">' + U.e(o.hint) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  return h;
};
U.chooseEventOption = function (i) {
  var ce = U.curEvent, G = HD.G;
  var o = ce.v.options[i];
  if (!o || o.disabled) return;
  G.pendingEvents.shift();
  ce.outcome = o.act(ce.ev.ctx) || '';
  HD.save();
  U.renderModal();
};

// ---------- Character sheet ----------
U.showPerson = function (id) { U.sheetMsg = null; U.open({ cls: '', render: function () { return U.sheetHtml(id); } }); };
U.sheetHtml = function (id) {
  var G = HD.G, p = G.people[id], me = HD.me();
  if (!p) return U.head('Unknown') + '<div class="modal-body">This person is no longer with us.</div>';
  var isMe = p.id === me.id;
  var team = p.teamId && G.teams[p.teamId];
  var role = HD.ROLE_NAMES[p.role] || p.role;
  var h = U.head(U.e(HD.fullName(p)), '');
  h += '<div class="modal-body">';
  if (U.sheetMsg) h += '<div class="result">' + U.e(U.sheetMsg) + '</div>';
  h += '<div class="sheet-head">' + U.portrait(p, 110) + '<div class="info">';
  h += '<div class="muted">' + U.e(role) + (team ? ' · ' + U.tlink(team, true) : '') + (p.outlet ? ' · ' + U.e(p.outlet) : '') + (p.agency ? ' · ' + U.e(p.agency) : '') + '</div>';
  h += '<div class="muted">' + U.flag(p) + ' ' + HD.NATIONS[p.nation].name + ' · Age ' + p.age + (p.alive ? '' : ' · <span class="bad">Deceased</span>') + (p.retired ? ' · Retired' : '') + '</div>';
  h += '<div class="traits">' + U.traitChips(p) + '</div>';
  if (!isMe) {
    var rel = HD.relation(me.id, p.id);
    h += '<div class="row">' + (rel ? U.relChip(rel) : '') + '<span>Opinion of you: ' + U.op(p.id) + ' <b>' + HD.opinionLabel(HD.opinion(p.id, me.id)).t + '</b></span></div>';
  }
  h += '</div></div><hr>';
  h += '<div class="grid g2">';
  // Left column: stats
  h += '<div>';
  if (p.role === 'player' || p.role === 'prospect' || p.role === 'retired') {
    h += '<h4>Ratings</h4>';
    var ks = p.pos === 'G' ? [['gk', 'Goaltending']] : [['off', 'Offence'], ['def', 'Defence'], ['phys', 'Physical']];
    ks.forEach(function (k) { h += '<div class="rating"><span class="muted">' + k[1] + '</span>' + U.bar(p[k[0]], 99, 'ice') + '<span class="right">' + p[k[0]] + '</span></div>'; });
    h += '<div class="kv" style="margin-top:8px"><span class="k">Position</span><span>' + p.pos + '</span><span class="k">Overall</span><span>' + U.ovr(p.ovr) + '</span><span class="k">Potential</span><span>' + U.potText(p) + '</span>';
    if (p.role === 'player') h += '<span class="k">Morale</span><span>' + U.meter(p.morale, 100, p.morale < 35 ? 'bad' : p.morale < 55 ? 'warn' : 'good') + '</span><span class="k">Deployment</span><span>' + (HD.SLOT_NAMES[p.slot] || '—') + U.injury(p) + '</span>';
    h += '<span class="k">Contract</span><span>' + U.contract(p) + '</span>';
    if (p.agentId) h += '<span class="k">Agent</span><span>' + U.plink(G.people[p.agentId]) + ' ' + U.op(p.agentId) + '</span>';
    if (p.junior) h += '<span class="k">Junior</span><span>' + U.e(p.junior) + '</span>';
    if (p.draftPick) h += '<span class="k">Drafted</span><span>#' + p.draftPick + ' (' + p.draftYear + ')</span>';
    if (p.rings) h += '<span class="k">Titles</span><span>🏆 × ' + p.rings + '</span>';
    h += '</div>';
    var st = p.stats || HD.blankStats();
    if (p.pos === 'G') h += '<h4 style="margin-top:12px">Season</h4><div class="kv"><span class="k">GP</span><span>' + st.gp + '</span><span class="k">Record</span><span>' + st.w + '-' + st.l + '</span><span class="k">SV%</span><span>' + (st.sa ? (1 - st.ga / st.sa).toFixed(3) : '—') + '</span><span class="k">GAA</span><span>' + (st.gp ? (st.ga / st.gp).toFixed(2) : '—') + '</span><span class="k">Shutouts</span><span>' + st.so + '</span></div>';
    else h += '<h4 style="margin-top:12px">Season</h4><div class="kv"><span class="k">GP</span><span>' + st.gp + '</span><span class="k">G-A-P</span><span>' + st.g + '-' + st.a + '-' + (st.g + st.a) + '</span><span class="k">PIM</span><span>' + st.pim + '</span><span class="k">Career</span><span>' + (p.career.g + st.g) + 'G ' + (p.career.a + st.a) + 'A in ' + (p.career.gp + st.gp) + ' GP</span></div>';
    if (p.awards && p.awards.length) h += '<div class="help" style="margin-top:6px">🏅 ' + p.awards.map(U.e).join(' · ') + '</div>';
  } else if (p.skills) {
    h += '<h4>Skills</h4>';
    Object.keys(HD.SKILLS).forEach(function (k) { h += '<div class="rating" style="grid-template-columns:105px 1fr 30px"><span class="muted">' + HD.SKILLS[k].icon + ' ' + HD.SKILLS[k].name + '</span>' + U.bar(p.skills[k], 20) + '<span class="right">' + p.skills[k] + '</span></div>'; });
    if (p.contract) h += '<div class="kv" style="margin-top:8px"><span class="k">Contract</span><span>' + U.contract(p) + '</span></div>';
  }
  if (p.role === 'owner') h += '<div class="kv" style="margin-top:8px"><span class="k">Fortune</span><span>' + HD.money(p.wealth) + '</span><span class="k">Made in</span><span>' + U.e(p.business || '—') + '</span><span class="k">Patience</span><span>' + U.meter(p.patience, 100) + '</span></div>';
  if (p.role === 'journalist') h += '<div class="kv" style="margin-top:8px"><span class="k">Reach</span><span>' + U.meter(p.reach, 10, 'ice') + '</span></div>';
  if (p.role === 'agent') h += '<div class="kv" style="margin-top:8px"><span class="k">Clients</span><span>' + (p.clients || []).filter(function (c) { return G.people[c] && !G.people[c].retired; }).length + '</span><span class="k">On your team</span><span>' + (p.clients || []).filter(function (c) { return G.people[c] && G.people[c].teamId === me.teamId; }).map(function (c) { return U.plink(G.people[c]); }).join(', ') + '</span></div>';
  h += '</div>';
  // Right column: opinion breakdown & relations
  h += '<div>';
  if (!isMe) {
    var rows = HD.opinionBreakdown(p.id, me.id);
    h += '<h4>What ' + U.e(p.first) + ' thinks of you</h4><table class="breakdown">';
    rows.forEach(function (r) { h += '<tr><td>' + U.e(r.l) + (r.w > 0 ? ' <span class="dim">(' + r.w + 'w)</span>' : '') + '</td><td class="num ' + (r.v >= 0 ? 'good' : 'bad') + '">' + HD.signed(r.v) + '</td></tr>'; });
    if (!rows.length) h += '<tr><td class="dim">No strong feelings either way.</td><td></td></tr>';
    h += '<tr class="total"><td>Total</td><td class="num">' + HD.signed(HD.opinion(p.id, me.id)) + '</td></tr></table>';
  }
  var rels = Object.keys(p.relations).filter(function (k) { return G.people[k]; });
  if (rels.length) {
    h += '<h4 style="margin-top:12px">Relationships</h4><div class="traits">';
    rels.forEach(function (k) { h += '<span class="chip rel-' + p.relations[k] + '">' + p.relations[k] + ': ' + U.plink(G.people[k]) + '</span>'; });
    h += '</div>';
  }
  if (p.log.length) h += '<h4 style="margin-top:12px">Life</h4><div class="log">' + p.log.map(function (l) { return '<div><span class="dim">' + l.y + ' W' + l.w + '</span> ' + U.e(l.t) + '</div>'; }).join('') + '</div>';
  h += '</div></div>';
  // Interactions
  if (!isMe && p.alive) {
    var acts = HD.interactions(p);
    if (acts.length && me.teamId !== undefined) {
      h += '<hr><h4>Interactions</h4><div class="actions">';
      acts.forEach(function (a) {
        h += '<button data-act="interact" data-id="' + p.id + '" data-i="' + a.id + '"' + (a.disabled ? ' disabled title="' + U.e(a.disabled) + '"' : '') + '>' + U.e(a.label) + '<span class="hint">' + U.e(a.disabled || a.hint || '') + '</span></button>';
      });
      h += '</div>';
    }
  }
  h += '</div>';
  return h;
};

U.doInteraction = function (pid, iid) {
  var p = HD.person(pid);
  var it = HD.interactions(p).filter(function (x) { return x.id === iid; })[0];
  if (!it || it.disabled) return;
  if (it.ui) return U.interactionUi(it.ui, p);
  U.sheetMsg = HD.runInteraction(pid, iid);
  HD.save();
  HD.UI.render();
};

U.interactionUi = function (kind, p) {
  if (kind === 'contract') return U.showContract(p.id);
  if (kind === 'trade') { U.trade = { team: p.teamId, give: [], get: [] }; U.tab = 'market'; U.sub.market = 'trade'; U.close(); return; }
  if (kind === 'finance') { U.tab = 'finance'; U.close(); return; }
  if (kind === 'hire_coach') return U.showHireCoach();
  if (kind === 'release') {
    var cost = p.contract ? p.contract.salary * p.contract.years * 0.5 : 0;
    U.open({ cls: 'narrow', render: function () {
      return U.head('Release ' + U.e(HD.fullName(p)) + '?') + '<div class="modal-body">Buying out the remaining ' + p.contract.years + ' year(s) costs <b>' + HD.money(cost) + '</b> from team funds. ' + U.e(p.first) + ' becomes a free agent. Their friends on the team won\'t like it.</div><div class="modal-foot"><button data-act="closeModal">Cancel</button><button class="danger" data-act="confirmRelease" data-id="' + p.id + '">Release</button></div>';
    } });
    return;
  }
  if (kind === 'callup') {
    var t = HD.myTeam();
    if (t.roster.length >= HD.ROSTER_MAX) return U.toast('Roster is full (' + HD.ROSTER_MAX + ').');
    if (HD.capSpace(t) < 925000) return U.toast('Not enough cap space.');
    HD.callUp(t, p); HD.addOpinion(p.id, HD.me().id, 'called_up', 'Gave Me My Shot', 15, 52);
    U.sheetMsg = HD.fullName(p) + ' has been called up!'; HD.save(); HD.UI.render();
  }
};

U.showHireCoach = function () {
  var pool = HD.coachPool();
  U.open({ cls: 'wide', render: function () {
    var t = HD.myTeam(), cur = HD.person(t.coachId);
    var h = U.head('Hire a Head Coach', 'Firing ' + U.e(HD.fullName(cur)) + ' (Tactics ' + cur.skills.tactics + ') makes them a permanent enemy. Players loyal to them will be upset.') + '<div class="modal-body"><table><tr><th>Coach</th><th>Age</th><th>Traits</th><th class="num">Tactics</th><th class="num">Diplomacy</th><th class="num">Salary</th><th></th></tr>';
    HD.G.coachPool.forEach(function (id) {
      var c = HD.person(id);
      if (!c) return;
      var sal = 1000000 + c.skills.tactics * 150000;
      h += '<tr><td><div class="namecell">' + U.portrait(c, 32) + U.plink(c) + '</div></td><td>' + c.age + '</td><td><div class="traits">' + U.traitChips(c) + '</div></td><td class="num">' + c.skills.tactics + '</td><td class="num">' + c.skills.diplomacy + '</td><td class="num">' + HD.money(sal) + '</td><td><button class="small primary" data-act="hireCoach" data-id="' + id + '">Hire</button></td></tr>';
    });
    return h + '</table></div>';
  } });
};

// ---------- Contract negotiation ----------
U.showContract = function (pid) {
  var p = HD.person(pid), t = HD.myTeam();
  var ask = HD.askingContract(p, t);
  U.contractState = { pid: pid, salary: ask.salary, years: ask.years, msg: null, ok: null };
  U.open({ cls: 'narrow', render: U.contractHtml });
};
U.contractHtml = function () {
  var S = U.contractState, p = HD.person(S.pid), t = HD.myTeam(), G = HD.G;
  var ask = HD.askingContract(p, t);
  var own = p.teamId === t.id;
  var faPhase = G.phase === 'freeagency' && !p.teamId;
  var h = U.head((own ? 'Extension: ' : 'Offer: ') + U.e(HD.fullName(p)), p.pos + ' · ' + p.age + 'y · ' + p.ovr + ' OVR · Pot ' + U.potText(p));
  h += '<div class="modal-body">';
  if (S.msg) h += '<div class="result ' + (S.ok ? '' : 'bad') + '">' + U.e(S.msg) + '</div>';
  if (own && p.contract && p.contract.years > 1) h += '<div class="result bad">Players can only be extended in the final year of their contract (' + p.contract.years + ' years left).</div>';
  if (own && p.contract && p.contract.next) h += '<div class="result">Already extended: ' + HD.money(p.contract.next.salary) + ' x ' + p.contract.next.years + '.</div>';
  h += '<div class="kv"><span class="k">Their ask</span><span><b>' + HD.money(ask.salary) + '</b> × ' + ask.years + ' yrs</span>';
  h += '<span class="k">Market value</span><span>' + HD.money(HD.marketValue(p)) + '</span>';
  h += '<span class="k">Your cap space</span><span>' + HD.money(HD.capSpace(t) - HD.committedOffers(t)) + (faPhase ? ' <span class="dim">(after pending offers)</span>' : '') + '</span>';
  if (p.agentId) h += '<span class="k">Agent</span><span>' + U.e(HD.N(p.agentId)) + ' ' + U.op(p.agentId) + '</span>';
  h += '<span class="k">Opinion of you</span><span>' + U.op(p.id) + '</span>';
  var existing = (G.faOffers[p.id] || []);
  if (faPhase && existing.length) h += '<span class="k">Rival offers</span><span>' + existing.filter(function (o) { return o.t !== t.id; }).length + ' team(s) bidding</span>';
  h += '</div><hr>';
  h += '<div class="row"><label>Salary</label><input type="range" min="750000" max="' + Math.max(16000000, ask.salary * 1.5) + '" step="50000" value="' + S.salary + '" data-change="cSalary" style="flex:1"><b class="nowrap">' + HD.money(S.salary, true) + '</b></div>';
  h += '<div class="row" style="margin-top:8px"><label>Years</label><select data-change="cYears">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (y) { return '<option ' + (y === S.years ? 'selected' : '') + '>' + y + '</option>'; }).join('') + '</select>';
  var score = HD.offerScore(p, t, S.salary, S.years);
  var lbl = score >= 1 ? ['Likely to accept', 'good'] : score >= 0.92 ? ['Borderline', 'warn'] : score >= 0.82 ? ['Unlikely', 'bad'] : ['Insulting', 'bad'];
  h += '<span class="' + lbl[1] + '">' + lbl[0] + '</span></div>';
  if (faPhase) h += '<p class="help">Free agency: offers are considered at the end of each week alongside rival bids. Team appeal (winning, hype, market, your prestige) matters too.</p>';
  h += '</div><div class="modal-foot"><button data-act="closeModal">Close</button><button class="primary" data-act="submitContract"' + ((own && p.contract && (p.contract.years > 1 || p.contract.next)) ? ' disabled' : '') + '>' + (faPhase ? 'Submit Offer' : 'Make Offer') + '</button></div>';
  return h;
};
U.submitContract = function () {
  var S = U.contractState, p = HD.person(S.pid), t = HD.myTeam(), G = HD.G, me = HD.me();
  var faPhase = G.phase === 'freeagency' && !p.teamId;
  if (faPhase) {
    if (S.salary > HD.capSpace(t) - HD.committedOffers(t) + ((G.faOffers[p.id] || []).filter(function (o) { return o.t === t.id; }).map(function (o) { return o.s; })[0] || 0)) { S.msg = 'Not enough cap space (including your other pending offers).'; S.ok = false; return U.renderModal(); }
    HD.faOffer(p, t, S.salary, S.years);
    S.msg = 'Offer submitted. ' + p.first + ' will decide at the end of the week.'; S.ok = true;
    HD.save(); return U.renderModal();
  }
  var res = HD.negotiate(p, t, S.salary, S.years);
  if (res.ok) {
    if (p.teamId === t.id) { HD.extendPlayer(p, S.salary, S.years); HD.addOpinion(p.id, me.id, 'extended', 'Extended Me', 12, 40); S.msg = HD.fullName(p) + ' signs the extension!'; }
    else { HD.signPlayer(p, t, S.salary, S.years); HD.addOpinion(p.id, me.id, 'signed', 'Signed Me', 10, 26); HD.patchLines(t); S.msg = HD.fullName(p) + ' signs with the ' + t.name + '!'; HD.news(HD.fullName(p) + ' signs with the ' + t.name + ' (' + HD.money(S.salary) + ' x ' + S.years + ').', 'trade', t.id); }
    S.ok = true;
  } else { S.msg = res.msg; S.ok = false; }
  HD.save(); HD.UI.render();
};

// ---------- Menu / start / game over ----------
U.showMenu = function () {
  U.open({ cls: 'narrow', render: function () {
    return U.head('Menu') + '<div class="modal-body"><div class="grid"><button data-act="save">💾 Save game</button><button data-act="exportSave">📤 Export save file</button><label class="row"><span>📥 Import save</span><input type="file" accept=".json" data-change="importSave"></label><button class="danger" data-act="newGame">✖ Abandon & start a new career</button></div><p class="help">The game autosaves to this browser every week.</p></div>';
  } });
};

HD.UI.gameOverScreen = function () {
  var me = HD.me(), G = HD.G;
  var h = '<div class="start"><div class="hero"><h1>Career Over</h1><p>' + U.e(G.gameOver.reason) + '</p></div>';
  h += '<div class="grid g3"><div class="panel gilded center">' + U.portrait(me, 120) + '<h2 style="margin-top:8px">' + U.e(HD.fullName(me)) + '</h2><div class="muted">Age ' + me.age + '</div></div>';
  h += '<div class="panel"><h3>Legacy</h3><div class="kv"><span class="k">Seasons</span><span>' + me.career.seasons + '</span><span class="k">Record</span><span>' + me.career.wins + '-' + me.career.losses + '</span><span class="k">Playoff runs</span><span>' + me.career.playoffs + '</span><span class="k">Championships</span><span>🏆 ' + me.career.titles + '</span><span class="k">Prestige</span><span>★ ' + Math.round(me.prestige) + '</span><span class="k">Net worth</span><span>' + HD.money(HD.netWorth(me)) + '</span></div></div>';
  h += '<div class="panel"><h3>Clubs</h3>' + me.career.teams.map(function (id) { return '<div>' + U.tlink(G.teams[id], true) + '</div>'; }).join('') + '</div></div>';
  h += '<div class="center" style="margin-top:20px"><button class="primary" data-act="newGame">Begin a New Career</button></div></div>';
  return h;
};
