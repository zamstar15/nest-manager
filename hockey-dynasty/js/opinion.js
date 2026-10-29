// CK3-style opinion system: base trait compatibility + relations + timed modifiers
// + live situational factors (performance, ice time, money).
var HD = HD || {};

HD.relation = function (a, b) { var p = HD.G.people[a]; return p && p.relations[b] || null; };

HD.setRelation = function (a, b, type) {
  var pa = HD.G.people[a], pb = HD.G.people[b];
  if (!pa || !pb) return;
  var mirror = { child: 'parent', parent: 'child', mentor: 'protege', protege: 'mentor' };
  if (!type) { delete pa.relations[b]; delete pb.relations[a]; return; }
  pa.relations[b] = type;
  pb.relations[a] = mirror[type] || type;
};

// value: opinion delta. weeks: duration (-1 = permanent). Temporary modifiers fade linearly.
// opts.stack: add onto an existing modifier with the same key (capped at opts.max).
HD.addOpinion = function (fromId, toId, key, label, value, weeks, opts) {
  var from = HD.G.people[fromId];
  if (!from || fromId === toId) return;
  opts = opts || {};
  if (weeks === undefined) weeks = 26;
  // Loyal people hold grudges less, fickle people swing harder.
  if (value < 0 && from.traits.indexOf('loyal') >= 0 && HD.relation(fromId, toId) === 'friend') value = Math.round(value * 0.6);
  if (from.traits.indexOf('fickle') >= 0) value = Math.round(value * 1.3);
  var list = from.opinions[toId] = from.opinions[toId] || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].k === key) {
      if (opts.stack) {
        var max = opts.max || 60;
        list[i].v = HD.clamp(list[i].v + value, -max, max);
      } else list[i].v = value;
      list[i].l = label; list[i].w = weeks; list[i].w0 = weeks;
      return;
    }
  }
  list.push({ k: key, l: label, v: value, w: weeks, w0: weeks });
};

HD.removeOpinion = function (fromId, toId, key) {
  var from = HD.G.people[fromId];
  if (!from || !from.opinions[toId]) return;
  from.opinions[toId] = from.opinions[toId].filter(function (m) { return m.k !== key; });
};

HD.modValue = function (m) { return m.w < 0 ? m.v : Math.round(m.v * Math.max(0.15, m.w / m.w0)); };

HD.decayOpinions = function () {
  var people = HD.G.people;
  for (var id in people) {
    var ops = people[id].opinions;
    for (var to in ops) {
      var list = ops[to];
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].w > 0) { list[i].w--; if (list[i].w === 0) list.splice(i, 1); }
      }
      if (!list.length) delete ops[to];
    }
  }
};

HD.traitCompat = function (a, b) {
  var out = [];
  a.traits.forEach(function (t) {
    var def = HD.TRAITS[t];
    if (!def || def.hockey) return;
    if (b.traits.indexOf(t) >= 0) out.push({ l: 'Both ' + def.name, v: 8 });
    else if (def.opp && b.traits.indexOf(def.opp) >= 0) out.push({ l: def.name + ' vs ' + HD.TRAITS[def.opp].name, v: -8 });
  });
  if (a.traits.indexOf('honest') >= 0 && b.traits.indexOf('deceitful') >= 0) out.push({ l: 'Distrusts Schemers', v: -6 });
  if (a.traits.indexOf('gregarious') >= 0) out.push({ l: 'Gregarious', v: 5 });
  if (a.traits.indexOf('arrogant') >= 0) out.push({ l: 'Arrogant', v: -5 });
  return out;
};

// Full breakdown of what `fromId` thinks of `toId`.
HD.opinionBreakdown = function (fromId, toId) {
  var G = HD.G, from = G.people[fromId], to = G.people[toId];
  var rows = [];
  if (!from || !to) return rows;
  rows = rows.concat(HD.traitCompat(from, to));
  var rel = HD.relation(fromId, toId);
  var relVals = { friend: 35, rival: -40, spouse: 30, child: 20, parent: 20, mentor: 20, protege: 20, lover: 40 };
  if (rel && relVals[rel]) rows.push({ l: rel.charAt(0).toUpperCase() + rel.slice(1), v: relVals[rel] });

  if (to.id === G.playerId) rows = rows.concat(HD.situationalOpinion(from, to));

  var mods = from.opinions[toId] || [];
  mods.forEach(function (m) { rows.push({ l: m.l, v: HD.modValue(m), w: m.w }); });
  return rows.filter(function (r) { return r.v !== 0; });
};

HD.opinion = function (fromId, toId) {
  var rows = HD.opinionBreakdown(fromId, toId);
  return HD.clamp(Math.round(HD.sum(rows, function (r) { return r.v; })), -100, 100);
};

// Live factors about the player-manager, recomputed every time they are read.
HD.situationalOpinion = function (from, me) {
  var G = HD.G, rows = [];
  var team = G.teams[me.teamId];
  var prest = HD.clamp(Math.round(me.prestige / 12), -10, 20);
  if (prest && from.role !== 'spouse' && from.role !== 'child') rows.push({ l: 'Prestige', v: prest });
  if (!team) return rows;

  if (from.role === 'owner' && from.teamId === team.id) {
    var gp = team.record.w + team.record.l + team.record.otl;
    if (gp >= 6) {
      var pct = (team.record.w * 2 + team.record.otl) / (gp * 2);
      var exp = G.ownerGoal ? G.ownerGoal.expectPct : 0.5;
      rows.push({ l: 'Team Results', v: HD.clamp(Math.round((pct - exp) * 120), -35, 30) });
    }
    var bal = team.finance.balance;
    var greedy = from.traits.indexOf('greedy') >= 0 ? 1.6 : 1;
    if (bal < 0) rows.push({ l: 'Losing Money', v: Math.round(HD.clamp(bal / 2e6, -25, 0) * greedy) });
    else if (bal > 20e6) rows.push({ l: 'Healthy Books', v: Math.round(HD.clamp(bal / 10e6, 0, 10) * greedy) });
    if (team.hype > 75) rows.push({ l: 'Fan Excitement', v: 6 });
    if (team.hype < 30) rows.push({ l: 'Empty Seats', v: -8 });
    if (me.stakes >= 10) rows.push({ l: 'Fellow Shareholder', v: Math.round(me.stakes / 2) });
  }
  if (from.role === 'player' && from.teamId === team.id) {
    var slotRank = HD.slotRank(from);
    var expected = HD.expectedSlotRank(from, team);
    if (slotRank - expected >= 2) rows.push({ l: 'Unhappy With Ice Time', v: -Math.min(30, (slotRank - expected) * 7) });
    else if (expected - slotRank >= 1) rows.push({ l: 'Given A Bigger Role', v: 8 });
    var tpct = HD.teamPct(team);
    if (tpct !== null) rows.push({ l: 'Winning Culture', v: HD.clamp(Math.round((tpct - 0.5) * 40), -10, 10) });
  }
  if (from.role === 'coach' && from.teamId === team.id) {
    var cpct = HD.teamPct(team);
    if (cpct !== null) rows.push({ l: 'Roster You Built', v: HD.clamp(Math.round((cpct - 0.5) * 30), -10, 10) });
  }
  if (from.role === 'agent') {
    var clients = (from.clients || []).filter(function (c) { var p = G.people[c]; return p && p.teamId === team.id; });
    if (clients.length) rows.push({ l: clients.length + ' Client(s) On Your Team', v: Math.min(12, clients.length * 3) });
  }
  if (from.role === 'spouse') {
    if (me.stress > 60) rows.push({ l: 'You Are Never Home', v: -Math.round((me.stress - 60) / 2) });
  }
  if (from.role === 'journalist') {
    if (me.traits.indexOf('media_darling') >= 0) rows.push({ l: 'Great Quote', v: 10 });
  }
  return rows;
};

HD.teamPct = function (team) {
  var gp = team.record.w + team.record.l + team.record.otl;
  if (gp < 5) return null;
  return (team.record.w * 2 + team.record.otl) / (gp * 2);
};

HD.opinionLabel = function (v) {
  if (v <= -60) return { t: 'Hateful', c: 'op-hate' };
  if (v <= -20) return { t: 'Hostile', c: 'op-hostile' };
  if (v < 0) return { t: 'Cold', c: 'op-cold' };
  if (v < 20) return { t: 'Neutral', c: 'op-neutral' };
  if (v < 50) return { t: 'Friendly', c: 'op-friendly' };
  return { t: 'Devoted', c: 'op-devoted' };
};

// Let NPC-to-NPC relations drift so the world evolves without the player.
HD.evolveNpcRelations = function () {
  var G = HD.G;
  var tids = Object.keys(G.teams);
  for (var i = 0; i < 2; i++) {
    var t = G.teams[HD.pick(tids)];
    var a = HD.pick(t.roster), b = HD.pick(t.roster);
    if (a === b || HD.relation(a, b)) continue;
    var pa = G.people[a], pb = G.people[b];
    var compat = HD.sum(HD.traitCompat(pa, pb), function (r) { return r.v; });
    if (compat > 5 && HD.chance(0.5)) {
      HD.setRelation(a, b, 'friend');
      HD.news(HD.fullName(pa) + ' and ' + HD.fullName(pb) + ' have become inseparable in the ' + t.name + ' room.', 'social', t.id);
    } else if (compat < -5 && HD.chance(0.4)) {
      HD.setRelation(a, b, 'rival');
      HD.news('Sources say ' + HD.fullName(pa) + ' and ' + HD.fullName(pb) + ' had to be separated at ' + t.name + ' practice.', 'social', t.id);
    }
  }
};
