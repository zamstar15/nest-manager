// On-ice simulation: deployment, team strength, games, schedule and playoffs.
var HD = HD || {};

HD.CAL = {
  PRESEASON: [1, 2], REG_START: 3, REG_END: 22, DEADLINE: 16,
  PLAYOFF_START: 23, PLAYOFF_END: 25, AWARDS: 26, DRAFT: 27, RESIGN: 28, FA_START: 29, FA_END: 32, YEAR_WEEKS: 32
};

HD.phaseOf = function (w) {
  var C = HD.CAL;
  if (w < C.REG_START) return 'preseason';
  if (w <= C.REG_END) return 'regular';
  if (w <= C.PLAYOFF_END) return 'playoffs';
  if (w === C.AWARDS) return 'awards';
  if (w === C.DRAFT) return 'draft';
  if (w === C.RESIGN) return 'resign';
  return 'freeagency';
};
HD.PHASE_NAMES = { preseason: 'Training Camp', regular: 'Regular Season', playoffs: 'Playoffs', awards: 'Awards & Reviews', draft: 'Entry Draft', resign: 'Contract Deadline', freeagency: 'Free Agency' };

HD.isForward = function (p) { return p.pos === 'C' || p.pos === 'LW' || p.pos === 'RW'; };
HD.groupOf = function (p) { return p.pos === 'G' ? 'G' : p.pos === 'D' ? 'D' : 'F'; };
HD.rosterPlayers = function (team) { return team.roster.map(function (id) { return HD.G.people[id]; }).filter(Boolean); };

HD.SLOT_RANK = { F1: 1, F2: 2, F3: 3, F4: 4, D1: 1, D2: 2, D3: 3, G1: 1, G2: 2, X: 6 };
HD.slotRank = function (p) { return HD.SLOT_RANK[p.slot] || 6; };
HD.expectedSlotRank = function (p, team) {
  if (p.injury > 0) return HD.slotRank(p);
  var g = HD.groupOf(p);
  var peers = HD.rosterPlayers(team).filter(function (x) { return HD.groupOf(x) === g && x.injury <= 0; });
  peers.sort(function (a, b) { return b.ovr - a.ovr; });
  var idx = peers.indexOf(p);
  var per = g === 'F' ? 3 : g === 'D' ? 2 : 1;
  var max = g === 'F' ? 4 : g === 'D' ? 3 : 2;
  var r = Math.floor(idx / per) + 1;
  return r > max ? 6 : r;
};

HD.autoLines = function (team) {
  var players = HD.rosterPlayers(team);
  ['F', 'D', 'G'].forEach(function (g) {
    var pool = players.filter(function (p) { return HD.groupOf(p) === g; });
    pool.sort(function (a, b) { return (b.injury > 0 ? -100 : b.ovr) - (a.injury > 0 ? -100 : a.ovr); });
    var slots = g === 'F' ? ['F1', 'F1', 'F1', 'F2', 'F2', 'F2', 'F3', 'F3', 'F3', 'F4', 'F4', 'F4'] : g === 'D' ? ['D1', 'D1', 'D2', 'D2', 'D3', 'D3'] : ['G1', 'G2'];
    pool.forEach(function (p, i) { p.slot = (p.injury > 0 || i >= slots.length) ? 'X' : slots[i]; });
  });
};

// Fill holes left by injuries without reshuffling a manager's chosen lines.
HD.patchLines = function (team) {
  var players = HD.rosterPlayers(team);
  players.forEach(function (p) { if (p.injury > 0 && p.slot !== 'X') { p.formerSlot = p.slot; p.slot = 'X'; } });
  HD.SLOTS.forEach(function (s) {
    if (s === 'X') return;
    var g = s.charAt(0);
    var filled = players.filter(function (p) { return p.slot === s; }).length;
    while (filled < HD.SLOT_CAP[s]) {
      var cand = players.filter(function (p) { return p.slot === 'X' && p.injury <= 0 && HD.groupOf(p) === g; });
      if (!cand.length && g !== 'G') cand = players.filter(function (p) { return p.slot === 'X' && p.injury <= 0 && p.pos !== 'G'; });
      if (!cand.length) break;
      cand.sort(function (a, b) { return b.ovr - a.ovr; });
      cand[0].slot = s; filled++;
    }
  });
};

HD.chemistry = function (team) {
  var ids = team.roster, score = 0;
  for (var i = 0; i < ids.length; i++) {
    var rel = HD.G.people[ids[i]].relations;
    for (var j = i + 1; j < ids.length; j++) {
      var r = rel[ids[j]];
      if (r === 'friend') score += 1; else if (r === 'rival') score -= 1.5;
    }
  }
  var leaders = HD.rosterPlayers(team).filter(function (p) { return p.traits.indexOf('leader') >= 0 && p.slot !== 'X'; }).length;
  return HD.clamp(score + leaders * 1.5, -8, 8);
};

HD.teamStrength = function (team, playoff) {
  var players = HD.rosterPlayers(team);
  var bySlot = {};
  players.forEach(function (p) { (bySlot[p.slot] = bySlot[p.slot] || []).push(p); });
  var eff = function (p, k) {
    var v = p[k] + p.form * 0.4 + (p.morale - 60) * 0.06;
    if (playoff && p.traits.indexOf('clutch') >= 0) v += 4;
    return v;
  };
  var line = function (slot, k, n) {
    var arr = (bySlot[slot] || []).slice(0, n);
    var s = 0; for (var i = 0; i < n; i++) s += arr[i] ? eff(arr[i], k) : 40;
    return s / n;
  };
  var fw = { F1: 0.38, F2: 0.30, F3: 0.20, F4: 0.12 }, dw = { D1: 0.42, D2: 0.35, D3: 0.23 };
  var fOff = 0, fDef = 0, dOff = 0, dDef = 0, phys = 0;
  for (var s in fw) { fOff += fw[s] * line(s, 'off', 3); fDef += fw[s] * line(s, 'def', 3); phys += fw[s] * line(s, 'phys', 3) * 0.6; }
  for (var d in dw) { dOff += dw[d] * line(d, 'off', 2); dDef += dw[d] * line(d, 'def', 2); phys += dw[d] * line(d, 'phys', 2) * 0.4; }
  var g1 = (bySlot.G1 || [])[0], g2 = (bySlot.G2 || [])[0];
  var gk = g1 ? eff(g1, 'gk') : 45;
  var coach = HD.G.people[team.coachId];
  var gm = HD.G.people[team.gmId];
  var bonus = (coach ? (coach.skills.tactics - 10) * 0.35 : 0) + (gm && gm.skills ? (gm.skills.tactics - 8) * 0.15 : 0);
  bonus += HD.chemistry(team) * 0.3 + (team.facilities.training - 2) * 0.4;
  if (gm && gm.id === HD.G.playerId && gm.stress > 70) bonus -= 1.5;
  var off = fOff * 0.78 + dOff * 0.22 + bonus;
  var def = fDef * 0.35 + dDef * 0.65 + bonus;
  if (team.tactic === 'offensive') { off += 2.5; def -= 2.5; }
  if (team.tactic === 'defensive') { off -= 2; def += 2.5; }
  if (team.tactic === 'physical') { off += 0.5; def += 0.5; }
  return { off: off, def: def, gk: gk, phys: phys, g1: g1, g2: g2, overall: (off + def) / 2 * 0.75 + gk * 0.25 };
};

// League-average strength, cached per week, so goal rates stay realistic as talent drifts.
HD.leagueNorm = function () {
  var G = HD.G;
  if (HD._norm && HD._norm.w === G.absWeek && HD._norm.g === G) return HD._norm;
  var ids = Object.keys(G.teams);
  var ss = ids.map(function (id) { return HD.teamStrength(G.teams[id]); });
  HD._norm = { w: G.absWeek, g: G, off: HD.avg(ss, function (s) { return s.off; }), def: HD.avg(ss, function (s) { return s.def; }), gk: HD.avg(ss, function (s) { return s.gk; }) };
  return HD._norm;
};

HD.pickWeighted = function (players, fn) { return HD.weightedPick(players, fn); };

HD.playGame = function (homeId, awayId, playoff) {
  var G = HD.G;
  var H = G.teams[homeId], A = G.teams[awayId];
  var sh = HD.teamStrength(H, playoff), sa = HD.teamStrength(A, playoff);
  // Backup goalie starts some regular-season games
  var hG = (!playoff && sh.g2 && HD.chance(0.22)) ? sh.g2 : sh.g1;
  var aG = (!playoff && sa.g2 && HD.chance(0.22)) ? sa.g2 : sa.g1;
  var gkH = hG ? hG.gk + hG.form * 0.4 : 45, gkA = aG ? aG.gk + aG.form * 0.4 : 45;
  var pace = 1;
  [H, A].forEach(function (t) { if (t.tactic === 'offensive') pace *= 1.05; if (t.tactic === 'defensive') pace *= 0.93; });
  var N = HD.leagueNorm();
  var xgH = 2.65 * Math.exp(((sh.off - N.off) - (sa.def - N.def)) / 25) * Math.exp(-(gkA - N.gk) / 30) * 1.04 * pace;
  var xgA = 2.65 * Math.exp(((sa.off - N.off) - (sh.def - N.def)) / 25) * Math.exp(-(gkH - N.gk) / 30) * pace;
  if (H.tactic === 'physical') xgA *= 1 - (sh.phys - sa.phys) / 400;
  if (A.tactic === 'physical') xgH *= 1 - (sa.phys - sh.phys) / 400;
  var hs = HD.poisson(xgH), as = HD.poisson(xgA), ot = null;
  if (hs === as) {
    var pH = xgH / (xgH + xgA);
    if (playoff || HD.chance(0.6)) { ot = 'OT'; } else { ot = 'SO'; pH = 0.5 + (pH - 0.5) * 0.5; }
    if (HD.chance(pH)) hs++; else as++;
  }
  var res = { h: homeId, a: awayId, hs: hs, as: as, ot: ot, playoff: !!playoff, goals: [], injuries: [] };
  HD.creditGoals(H, hs, res, ot === 'SO' ? (hs > as ? 1 : 0) : 0);
  HD.creditGoals(A, as, res, ot === 'SO' ? (as > hs ? 1 : 0) : 0);
  HD.creditGoalie(hG, hs, as, xgA, ot);
  HD.creditGoalie(aG, as, hs, xgH, ot);
  HD.rosterPlayers(H).concat(HD.rosterPlayers(A)).forEach(function (p) {
    if (p.slot !== 'X' && p.pos !== 'G') p.stats.gp++;
    if (p.slot !== 'X' && (p.traits.indexOf('hotheaded') >= 0 || p.traits.indexOf('enforcer') >= 0) && HD.chance(0.25)) p.stats.pim += HD.pick([2, 2, 5]);
  });
  HD.rollInjuries(H, A, res);
  HD.rollInjuries(A, H, res);
  if (!playoff) HD.applyRecord(H, A, hs, as, ot);
  // Hype & form drift
  var winT = hs > as ? H : A, loseT = hs > as ? A : H;
  winT.hype = HD.clamp(winT.hype + (playoff ? 1.2 : 0.35), 0, 100);
  loseT.hype = HD.clamp(loseT.hype - (playoff ? 0.4 : 0.35), 0, 100);
  if (winT.tactic === 'offensive') winT.hype = HD.clamp(winT.hype + 0.15, 0, 100);
  // Rivalry nights matter more to the fans
  if (H.rivalId === A.id || A.rivalId === H.id) {
    winT.hype = HD.clamp(winT.hype + 0.8, 0, 100); loseT.hype = HD.clamp(loseT.hype - 0.5, 0, 100);
    res.rivalry = true;
    if (Math.abs(hs - as) >= 4 && HD.chance(0.5)) HD.news('RIVALRY: The ' + winT.name + ' humiliate the ' + loseT.name + ' ' + Math.max(hs, as) + '–' + Math.min(hs, as) + '.', 'league', winT.id);
  }
  return res;
};

HD.creditGoals = function (team, n, res, soBonus) {
  var skaters = HD.rosterPlayers(team).filter(function (p) { return p.slot !== 'X' && p.pos !== 'G'; });
  if (!skaters.length) return;
  var sw = { F1: 1.6, F2: 1.25, F3: 0.85, F4: 0.55, D1: 0.5, D2: 0.38, D3: 0.28 };
  var real = n - soBonus; // shootout winner isn't a real goal
  for (var i = 0; i < real; i++) {
    var scorer = HD.weightedPick(skaters, function (p) {
      var w = Math.pow(p.off / 70, 4) * (sw[p.slot] || 0.3);
      if (p.traits.indexOf('sniper') >= 0) w *= 1.35;
      return w;
    });
    scorer.stats.g++; scorer.form = HD.clamp(scorer.form + 0.6, -10, 10);
    var assists = [];
    var na = HD.chance(0.08) ? 0 : HD.chance(0.3) ? 1 : 2;
    for (var k = 0; k < na; k++) {
      var helper = HD.weightedPick(skaters, function (p) {
        if (p === scorer || assists.indexOf(p) >= 0) return 0;
        var w = Math.pow(p.off / 70, 3) * (sw[p.slot] || 0.3) * (p.slot === scorer.slot ? 2.2 : 1);
        if (p.traits.indexOf('playmaker') >= 0) w *= 1.4;
        return w;
      });
      if (helper) { helper.stats.a++; assists.push(helper); }
    }
    res.goals.push({ t: team.id, s: scorer.id, a: assists.map(function (x) { return x.id; }) });
  }
};

HD.creditGoalie = function (g, gf, ga, xgAgainst, ot) {
  if (!g) return;
  g.stats.gp++;
  var real = ot === 'SO' && ga > gf ? ga - 1 : ga;
  g.stats.ga += real;
  g.stats.sa += Math.max(real + 12, Math.round(HD.gauss(29, 4)));
  if (gf > ga) g.stats.w++; else g.stats.l++;
  if (real === 0) g.stats.so++;
  g.form = HD.clamp(g.form + (real <= 1 ? 0.8 : real >= 4 ? -0.8 : 0), -10, 10);
};

HD.rollInjuries = function (team, opp, res) {
  var base = 0.07;
  if (opp.tactic === 'physical') base *= 1.5;
  if (team.tactic === 'physical') base *= 1.15;
  base *= 1.25 - team.facilities.medical * 0.1;
  if (!HD.chance(base)) return;
  var skaters = HD.rosterPlayers(team).filter(function (p) { return p.slot !== 'X' && p.injury <= 0; });
  if (!skaters.length) return;
  var p = HD.weightedPick(skaters, function (x) { return x.traits.indexOf('injury_prone') >= 0 ? 3 : 1; });
  var weeks = HD.weightedPick([1, 1, 1, 2, 2, 3, 4, 6, 10], function () { return 1; });
  weeks = Math.max(1, Math.round(weeks * (1.3 - team.facilities.medical * 0.1)));
  p.injury = weeks;
  p.injuryDesc = HD.pick(['upper-body injury', 'lower-body injury', 'concussion', 'broken finger', 'sprained MCL', 'high ankle sprain', 'separated shoulder', 'groin strain']);
  res.injuries.push({ p: p.id, t: team.id, w: weeks });
};

HD.applyRecord = function (H, A, hs, as, ot) {
  H.record.gf += hs; H.record.ga += as; A.record.gf += as; A.record.ga += hs;
  var W = hs > as ? H : A, L = hs > as ? A : H;
  W.record.w++;
  if (ot) L.record.otl++; else L.record.l++;
  W.record.streak = W.record.streak > 0 ? W.record.streak + 1 : 1;
  L.record.streak = L.record.streak < 0 ? L.record.streak - 1 : -1;
};

HD.points = function (t) { return t.record.w * 2 + t.record.otl; };
HD.standings = function () {
  var teams = Object.keys(HD.G.teams).map(function (id) { return HD.G.teams[id]; });
  return teams.sort(function (a, b) {
    return HD.points(b) - HD.points(a) || b.record.w - a.record.w || (b.record.gf - b.record.ga) - (a.record.gf - a.record.ga);
  });
};

HD.makeSchedule = function () {
  var ids = HD.shuffle(Object.keys(HD.G.teams));
  var n = ids.length, rounds = [];
  var arr = ids.slice();
  for (var r = 0; r < n - 1; r++) {
    var games = [];
    for (var i = 0; i < n / 2; i++) {
      var a = arr[i], b = arr[n - 1 - i];
      games.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    arr.splice(1, 0, arr.pop());
  }
  var sched = [];
  var C = HD.CAL, rIdx = 0;
  for (var cycle = 0; cycle < 4; cycle++) {
    var order = HD.shuffle(rounds.slice());
    order.forEach(function (games) {
      var wk = C.REG_START + Math.floor(rIdx / 3);
      games.forEach(function (g) {
        var h = cycle % 2 === 0 ? g[0] : g[1], a = cycle % 2 === 0 ? g[1] : g[0];
        sched.push({ wk: wk, h: h, a: a, played: false });
      });
      rIdx++;
    });
  }
  HD.G.schedule = sched;
};

HD.playWeek = function (week) {
  var G = HD.G, results = [];
  Object.keys(G.teams).forEach(function (id) { HD.patchLines(G.teams[id]); });
  G.schedule.forEach(function (g) {
    if (g.wk !== week || g.played) return;
    var r = HD.playGame(g.h, g.a, false);
    g.played = true; g.hs = r.hs; g.as = r.as; g.ot = r.ot;
    results.push(r);
  });
  return results;
};

// ---------- Playoffs ----------
HD.startPlayoffs = function () {
  var seeds = HD.standings().slice(0, 8).map(function (t) { return t.id; });
  HD.G.playoffs = { round: 1, seeds: seeds, series: HD.pairSeries(seeds), rounds: [], champion: null };
};

HD.pairSeries = function (ids) {
  var out = [];
  for (var i = 0; i < ids.length / 2; i++) out.push({ hi: ids[i], lo: ids[ids.length - 1 - i], wh: 0, wl: 0, games: [] });
  return out;
};

HD.playPlayoffRound = function () {
  var P = HD.G.playoffs;
  var homePattern = [1, 1, 0, 0, 1, 0, 1];
  P.series.forEach(function (s) {
    var g = 0;
    while (s.wh < 4 && s.wl < 4) {
      HD.patchLines(HD.G.teams[s.hi]); HD.patchLines(HD.G.teams[s.lo]);
      var hiHome = homePattern[g];
      var r = hiHome ? HD.playGame(s.hi, s.lo, true) : HD.playGame(s.lo, s.hi, true);
      var hiWon = hiHome ? r.hs > r.as : r.as > r.hs;
      if (hiWon) s.wh++; else s.wl++;
      s.games.push(r);
      HD.playoffGate(r.h);
      g++;
    }
    s.winner = s.wh === 4 ? s.hi : s.lo;
    s.loser = s.wh === 4 ? s.lo : s.hi;
  });
  P.rounds.push(P.series);
  var winners = P.series.map(function (s) { return s.winner; });
  // Re-seed: keep original seeding order
  winners.sort(function (a, b) { return P.seeds.indexOf(a) - P.seeds.indexOf(b); });
  if (winners.length === 1) { P.champion = winners[0]; P.series = []; }
  else { P.round++; P.series = HD.pairSeries(winners); }
};

HD.ROUND_NAMES = ['', 'Quarterfinals', 'Semifinals', 'Championship Final'];
