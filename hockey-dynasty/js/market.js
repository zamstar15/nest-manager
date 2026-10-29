// Player market: contracts, trades, free agency, draft, development, AI roster logic.
var HD = HD || {};

HD.ROSTER_MIN = 20; HD.ROSTER_MAX = 26;

HD.preferredYears = function (p) {
  if (p.age <= 23) return p.pot - p.ovr > 6 ? 3 : 5;
  if (p.age <= 29) return 5;
  if (p.age <= 32) return 3;
  return 1;
};

HD.teamAppeal = function (team, p) {
  var G = HD.G;
  var pct = HD.teamPct(team);
  if (pct === null) pct = 0.5;
  var a = (team.hype - 50) / 250 + (pct - 0.5) * 0.4 + team.market / 120;
  if (p.traits.indexOf('ambitious') >= 0) a += (pct - 0.5) * 0.4;
  if (p.traits.indexOf('family') >= 0 && p.teamId === team.id) a += 0.15;
  if (p.traits.indexOf('loyal') >= 0 && p.teamId === team.id) a += 0.1;
  a += HD.opinion(p.id, team.gmId) / 400;
  if (p.agentId) a += HD.opinion(p.agentId, team.gmId) / 800;
  if (team.gmId === G.playerId) a += (HD.me().prestige - 30) / 800;
  return a;
};

HD.askingContract = function (p, team) {
  var ask = HD.marketValue(p);
  if (p.traits.indexOf('greedy') >= 0) ask *= 1.18;
  if (p.traits.indexOf('generous') >= 0) ask *= 0.9;
  if (team) ask *= 1 - HD.clamp(HD.teamAppeal(team, p), -0.25, 0.25) * 0.6;
  if (team && team.gmId === HD.G.playerId) ask *= 1 - (HD.me().skills.finance - 8) * 0.008;
  if (!p.teamId && HD.G.phase !== 'freeagency') ask *= 0.85; // unsigned in-season: desperate
  return { salary: Math.max(750000, Math.round(ask / 50000) * 50000), years: HD.preferredYears(p) };
};

HD.offerScore = function (p, team, salary, years) {
  var ask = HD.askingContract(p, team);
  var yearsFit = -Math.abs(years - ask.years) * 0.03;
  return salary / ask.salary + yearsFit;
};

// Direct negotiation with the player's own manager (extensions & in-season FA).
HD.negotiate = function (p, team, salary, years) {
  var me = HD.me();
  if (p.teamId !== team.id) {
    if (salary > HD.capSpace(team)) return { ok: false, msg: 'You don\'t have the cap space for that contract.' };
    if (team.roster.length >= HD.ROSTER_MAX) return { ok: false, msg: 'Your roster is full (' + HD.ROSTER_MAX + ').' };
  }
  var score = HD.offerScore(p, team, salary, years);
  var need = 1 - (me.skills.diplomacy - 8) * 0.008;
  var op = HD.opinion(p.id, me.id);
  if (op < -40 && p.teamId === team.id) return { ok: false, msg: HD.fullName(p) + ' refuses to negotiate with you. ("I\'m testing free agency.")' };
  if (score >= need) return { ok: true };
  if (score < 0.82) {
    HD.addOpinion(p.id, me.id, 'lowball', 'Insulting Offer', -12, 20);
    if (p.agentId) HD.addOpinion(p.agentId, me.id, 'lowball', 'Lowballed A Client', -8, 20);
    return { ok: false, msg: 'Insulted. ' + HD.fullName(p) + '\'s agent hangs up on you.' };
  }
  return { ok: false, msg: HD.fullName(p) + ' turns it down. They want closer to ' + HD.money(HD.askingContract(p, team).salary) + ' x ' + HD.askingContract(p, team).years + ' yrs.' };
};

HD.signPlayer = function (p, team, salary, years) {
  var G = HD.G;
  G.freeAgents = G.freeAgents.filter(function (id) { return id !== p.id; });
  if (p.teamId && p.teamId !== team.id) {
    var old = G.teams[p.teamId];
    old.roster = old.roster.filter(function (id) { return id !== p.id; });
  }
  if (team.roster.indexOf(p.id) < 0) team.roster.push(p.id);
  p.teamId = team.id; p.slot = 'X';
  p.contract = { salary: salary, years: years };
  p.role = 'player'; p.joined = G.absWeek;
  delete G.faOffers[p.id];
  HD.addLog(p, 'Signed with the ' + HD.teamName(team) + ': ' + HD.money(salary) + ' x ' + years + ' yrs.');
};

HD.extendPlayer = function (p, salary, years) {
  p.contract.next = { salary: salary, years: years };
  HD.addLog(p, 'Signed an extension: ' + HD.money(salary) + ' x ' + years + ' yrs.');
};

HD.releasePlayer = function (p) {
  var G = HD.G, team = G.teams[p.teamId];
  var cost = p.contract ? p.contract.salary * p.contract.years * 0.5 : 0;
  team.finance.balance -= cost; team.finance.season.other += cost;
  team.roster = team.roster.filter(function (id) { return id !== p.id; });
  p.teamId = null; p.contract = null; p.slot = 'X';
  G.freeAgents.push(p.id);
  HD.addLog(p, 'Bought out and released by the ' + HD.teamName(team) + '.');
  return cost;
};

// ---------- Trades ----------
HD.tradeValue = function (p) {
  var ageF = p.age <= 22 ? 1.25 : p.age <= 27 ? 1.1 : p.age <= 30 ? 1 : p.age <= 33 ? 0.75 : 0.45;
  var v = Math.pow(Math.max(0, p.ovr - 52), 2) * ageF;
  v += Math.max(0, p.pot - p.ovr) * (p.age <= 23 ? 18 : 6);
  if (p.contract) v -= (p.contract.salary - HD.marketValue(p)) / 25000 * Math.min(p.contract.years, 3);
  if (p.injury > 3) v *= 0.8;
  return Math.max(5, Math.round(v));
};

HD.evaluateTrade = function (myTeam, other, give, get) {
  var G = HD.G, me = HD.me();
  if (!give.length && !get.length) return { ok: false, msg: 'Nothing on the table.' };
  if (G.week > HD.CAL.DEADLINE && G.week <= HD.CAL.PLAYOFF_END) return { ok: false, msg: 'The trade deadline has passed.' };
  var gp = give.map(HD.person), tp = get.map(HD.person);
  var payIn = HD.sum(tp, function (p) { return p.contract ? p.contract.salary : 0; });
  var payOut = HD.sum(gp, function (p) { return p.contract ? p.contract.salary : 0; });
  if (HD.payroll(myTeam) - payOut + payIn > G.league.cap) return { ok: false, msg: 'This puts you over the salary cap.' };
  if (HD.payroll(other) - payIn + payOut > G.league.cap) return { ok: false, msg: 'This puts them over the salary cap.' };
  var myN = myTeam.roster.length - give.length + get.length, theirN = other.roster.length - get.length + give.length;
  if (myN < HD.ROSTER_MIN || myN > HD.ROSTER_MAX) return { ok: false, msg: 'Your roster would have ' + myN + ' players (must be ' + HD.ROSTER_MIN + '–' + HD.ROSTER_MAX + ').' };
  if (theirN < HD.ROSTER_MIN || theirN > HD.ROSTER_MAX) return { ok: false, msg: 'Their roster would have ' + theirN + ' players.' };
  var gm = G.people[other.gmId];
  var vGive = HD.sum(gp, HD.tradeValue), vGet = HD.sum(tp, HD.tradeValue);
  var op = HD.opinion(gm.id, me.id);
  var need = 1.08 - op / 350 - (me.skills.diplomacy - 8) * 0.01;
  if (gm.traits.indexOf('greedy') >= 0) need += 0.05;
  if (HD.relation(gm.id, me.id) === 'rival') need += 0.15;
  // Their core guys carry a premium
  tp.forEach(function (p) { if (p.traits.indexOf('leader') >= 0) need += 0.05; });
  var ratio = vGive / Math.max(1, vGet);
  if (op <= -50) return { ok: false, ratio: ratio, msg: HD.fullName(gm) + ' won\'t even take your call.' };
  if (ratio >= need) return { ok: true, ratio: ratio, msg: HD.fullName(gm) + ' accepts.' };
  var gap = ratio / need;
  return { ok: false, ratio: ratio, msg: gap > 0.85 ? HD.fullName(gm) + ': "Close. Sweeten it a little."' : HD.fullName(gm) + ': "You\'re going to have to do a lot better than that."' };
};

HD.executeTrade = function (teamA, teamB, fromA, fromB) {
  var G = HD.G;
  fromA.forEach(function (id) { HD.movePlayer(G.people[id], teamA, teamB); });
  fromB.forEach(function (id) { HD.movePlayer(G.people[id], teamB, teamA); });
  HD.autoLines(teamA.gmId === G.playerId ? teamB : teamA);
  if (teamA.gmId !== G.playerId) HD.autoLines(teamA);
  if (teamB.gmId !== G.playerId) HD.autoLines(teamB);
  var names = function (ids) { return ids.map(function (id) { return HD.fullName(G.people[id]); }).join(', ') || 'future considerations'; };
  HD.news('TRADE: ' + teamA.name + ' send ' + names(fromA) + ' to the ' + teamB.name + ' for ' + names(fromB) + '.', 'trade', teamA.id, true);
};

HD.movePlayer = function (p, from, to) {
  var G = HD.G, me = HD.me();
  from.roster = from.roster.filter(function (id) { return id !== p.id; });
  to.roster.push(p.id);
  p.teamId = to.id; p.slot = 'X'; p.joined = G.absWeek;
  if (p.contract) p.contract.next = null;
  HD.addLog(p, 'Traded from the ' + HD.teamName(from) + ' to the ' + HD.teamName(to) + '.');
  // Friends left behind feel it
  from.roster.forEach(function (id) {
    if (HD.relation(id, p.id) === 'friend' && from.gmId === me.id) HD.addOpinion(id, me.id, 'traded_friend', 'Traded My Friend', -12, 16);
  });
  if (from.gmId === me.id) {
    if (p.traits.indexOf('family') >= 0 || p.traits.indexOf('loyal') >= 0) HD.addOpinion(p.id, me.id, 'traded_me', 'Traded Me Away', -30, 52);
    else HD.addOpinion(p.id, me.id, 'traded_me', 'Traded Me Away', -10, 26);
  }
  if (to.gmId === me.id) HD.addOpinion(p.id, me.id, 'wanted_me', 'Traded For Me', 10, 20);
};

HD.aiTrades = function () {
  var G = HD.G;
  if (G.week > HD.CAL.DEADLINE || G.phase === 'playoffs') return;
  if (!HD.chance(G.week === HD.CAL.DEADLINE ? 0.8 : 0.18)) return;
  var ids = Object.keys(G.teams).filter(function (id) { return G.teams[id].gmId !== G.playerId; });
  var A = G.teams[HD.pick(ids)], B = G.teams[HD.pick(ids)];
  if (A === B) return;
  if (HD.relation(A.gmId, B.gmId) === 'rival' && HD.chance(0.8)) return;
  var pa = HD.pick(A.roster), pA = G.people[pa];
  var va = HD.tradeValue(pA);
  var cand = B.roster.map(HD.person).filter(function (p) {
    var v = HD.tradeValue(p);
    return HD.groupOf(p) === HD.groupOf(pA) || (A.roster.length > 21 && B.roster.length > 21) ? v > va * 0.85 && v < va * 1.15 : false;
  });
  if (!cand.length) return;
  var pB = HD.pick(cand);
  var payA = HD.payroll(A) - (pA.contract ? pA.contract.salary : 0) + (pB.contract ? pB.contract.salary : 0);
  var payB = HD.payroll(B) - (pB.contract ? pB.contract.salary : 0) + (pA.contract ? pA.contract.salary : 0);
  if (payA > G.league.cap || payB > G.league.cap) return;
  HD.executeTrade(A, B, [pA.id], [pB.id]);
};

// ---------- AI roster upkeep ----------
HD.groupCounts = function (team) {
  var c = { F: 0, D: 0, G: 0 };
  HD.rosterPlayers(team).forEach(function (p) { c[HD.groupOf(p)]++; });
  return c;
};

HD.aiManageRoster = function (team, offseason) {
  var G = HD.G;
  if (team.gmId === G.playerId) return;
  // Call up ready prospects
  (team.prospects || []).slice().forEach(function (pid) {
    var p = G.people[pid];
    var worst = HD.rosterPlayers(team).filter(function (x) { return HD.groupOf(x) === HD.groupOf(p); });
    worst.sort(function (a, b) { return a.ovr - b.ovr; });
    if (p.age >= 20 && worst.length && p.ovr > worst[0].ovr + 2 && team.roster.length < HD.ROSTER_MAX && HD.capSpace(team) > 900000) HD.callUp(team, p);
  });
  var need = { F: 13, D: 7, G: 2 };
  var counts = HD.groupCounts(team);
  var tries = 0;
  while (tries++ < 6 && team.roster.length < 23) {
    var g = counts.G < need.G ? 'G' : counts.D < need.D ? 'D' : counts.F < need.F ? 'F' : HD.pick(['F', 'D']);
    var pool = G.freeAgents.map(HD.person).filter(function (p) { return HD.groupOf(p) === g; });
    pool.sort(function (a, b) { return b.ovr - a.ovr; });
    var signed = false;
    for (var i = 0; i < pool.length && i < 6; i++) {
      var ask = HD.askingContract(pool[i], team);
      if (ask.salary <= HD.capSpace(team)) {
        if (offseason) { HD.faOffer(pool[i], team, ask.salary, ask.years); }
        else HD.signPlayer(pool[i], team, ask.salary, ask.years);
        counts[g]++; signed = true; break;
      }
    }
    if (!signed) break;
  }
  while (team.roster.length > HD.ROSTER_MAX) {
    var worstP = HD.sortBy(HD.rosterPlayers(team), function (p) { return HD.tradeValue(p); })[0];
    HD.releasePlayer(worstP);
  }
  HD.autoLines(team);
};

// League rules: a club must be able to dress a full lineup. If the player's GM
// can't, the league forces cheap call-ups so games can still be played.
HD.emergencyFill = function (team) {
  var G = HD.G, added = [];
  var healthy = function () { return HD.groupCounts({ roster: team.roster.filter(function (id) { return G.people[id].injury <= 0; }) }); };
  var need = function (c) { return c.G < 2 ? 'G' : c.D < 6 ? 'D' : c.F < 12 ? 'F' : team.roster.length < HD.ROSTER_MIN ? HD.pick(['F', 'D']) : null; };
  var g, guard = 0;
  while ((g = need(healthy())) && guard++ < 12 && team.roster.length < HD.ROSTER_MAX) {
    var prospect = (team.prospects || []).map(HD.person).filter(function (p) { return HD.groupOf(p) === g; }).sort(function (a, b) { return b.ovr - a.ovr; })[0];
    if (prospect) { HD.callUp(team, prospect); added.push(prospect); continue; }
    var fa = G.freeAgents.map(HD.person).filter(function (p) { return HD.groupOf(p) === g; }).sort(function (a, b) { return a.ovr - b.ovr; })[Math.floor(Math.random() * 3)];
    if (!fa) fa = HD.makePlayer(g === 'F' ? HD.pick(['C', 'LW', 'RW']) : g, HD.randInt(52, 58), HD.randInt(24, 31));
    HD.signPlayer(fa, team, 750000, 1);
    added.push(fa);
  }
  if (added.length && team.gmId === G.playerId) {
    HD.patchLines(team);
    HD.chronicle('League rules forced emergency call-ups to ice a lineup: ' + added.map(HD.fullName).join(', ') + '.');
  }
  return added;
};

HD.callUp = function (team, p) {
  team.prospects = team.prospects.filter(function (id) { return id !== p.id; });
  team.roster.push(p.id);
  p.role = 'player'; p.slot = 'X';
  p.contract = { salary: 925000, years: 3 };
  HD.addLog(p, 'Called up to the ' + HD.teamName(team) + '.');
  if (team.gmId !== HD.G.playerId && p.pot >= 82) HD.news('Top prospect ' + HD.fullName(p) + ' gets the call-up from the ' + team.name + '.', 'roster', team.id);
};

// ---------- Free agency ----------
HD.faOffer = function (p, team, salary, years) {
  var G = HD.G;
  var list = G.faOffers[p.id] = G.faOffers[p.id] || [];
  for (var i = 0; i < list.length; i++) if (list[i].t === team.id) { list[i].s = salary; list[i].y = years; return; }
  list.push({ t: team.id, s: salary, y: years });
};

HD.committedOffers = function (team) {
  var G = HD.G, tot = 0;
  for (var pid in G.faOffers) G.faOffers[pid].forEach(function (o) { if (o.t === team.id) tot += o.s; });
  return tot;
};

HD.resolveFreeAgency = function (final) {
  var G = HD.G, me = HD.me();
  var signings = [];
  Object.keys(G.faOffers).forEach(function (pid) {
    var p = G.people[pid];
    if (!p || p.retired || p.teamId) { delete G.faOffers[pid]; return; }
    var offers = G.faOffers[pid].filter(function (o) {
      var t = G.teams[o.t];
      return o.s <= HD.capSpace(t) && t.roster.length < HD.ROSTER_MAX;
    });
    if (!offers.length) { delete G.faOffers[pid]; return; }
    var scored = offers.map(function (o) {
      var t = G.teams[o.t];
      return { o: o, sc: HD.offerScore(p, t, o.s, o.y) + HD.teamAppeal(t, p) * 0.6 };
    }).sort(function (a, b) { return b.sc - a.sc; });
    var best = scored[0];
    var threshold = final ? 0.85 : 1.0 + HD.randFloat(-0.04, 0.06);
    if (best.sc >= threshold || (scored.length > 1 && best.sc >= 0.95)) {
      var t = G.teams[best.o.t];
      HD.signPlayer(p, t, best.o.s, best.o.y);
      signings.push({ p: p, t: t, s: best.o.s, y: best.o.y });
      if (t.gmId === me.id) {
        HD.addOpinion(p.id, me.id, 'signed', 'Signed Me', 10, 26);
        HD.chronicle(HD.fullName(p) + ' (' + p.pos + ', ' + p.ovr + ') signs with you: ' + HD.money(best.o.s) + ' x ' + best.o.y + '.');
      } else if (offers.some(function (o) { return G.teams[o.t].gmId === me.id; })) {
        HD.chronicle(HD.fullName(p) + ' spurned your offer and signed with the ' + t.name + '.');
      }
    }
  });
  signings.sort(function (a, b) { return b.p.ovr - a.p.ovr; });
  signings.slice(0, 6).forEach(function (s) {
    HD.news('FREE AGENCY: ' + HD.fullName(s.p) + ' (' + s.p.pos + ', ' + s.p.ovr + ' OVR) signs with the ' + s.t.name + ' — ' + HD.money(s.s) + ' x ' + s.y + ' yrs.', 'trade', s.t.id, s.p.ovr >= 78);
  });
  if (final) G.faOffers = {};
};

// How much an AI club is willing to spend: richer markets and healthier books spend more.
HD.payrollTarget = function (t) {
  var cap = HD.G.league.cap;
  var tgt = cap * (0.8 + t.market * 0.017);
  if (t.finance.balance < 0) tgt -= cap * 0.1;
  else if (t.finance.balance > 40e6) tgt += cap * 0.04;
  return HD.clamp(tgt, HD.G.league.floor, cap * 0.98);
};

HD.aiFreeAgencyBids = function () {
  var G = HD.G;
  Object.keys(G.teams).forEach(function (id) {
    var t = G.teams[id];
    if (t.gmId === G.playerId) return;
    var counts = HD.groupCounts(t);
    var committed = HD.committedOffers(t);
    var budget = Math.min(HD.capSpace(t) - committed, HD.payrollTarget(t) - HD.payroll(t) - committed);
    var pool = G.freeAgents.map(HD.person).filter(function (p) { return p.ovr >= 58; });
    pool.sort(function (a, b) { return HD.tradeValue(b) - HD.tradeValue(a); });
    var bids = 0, pending = Object.keys(G.faOffers).filter(function (pid) { return G.faOffers[pid].some(function (o) { return o.t === t.id; }); }).length;
    for (var i = 0; i < pool.length && bids < 4; i++) {
      var p = pool[i], g = HD.groupOf(p);
      if ((G.faOffers[p.id] || []).some(function (o) { return o.t === t.id; })) continue;
      var want = (g === 'G' && counts.G < 3) || (g === 'D' && counts.D < 9) || (g === 'F' && counts.F < 15);
      if (!want || t.roster.length + pending + bids >= 25) continue;
      var ask = HD.askingContract(p, t);
      var bid = Math.round(ask.salary * HD.randFloat(0.92, 1.12) / 50000) * 50000;
      if (bid > budget) continue;
      if (HD.chance(0.6)) { HD.faOffer(p, t, bid, ask.years); budget -= bid; bids++; counts[g]++; }
    }
  });
};

// Clubs below the league's payroll floor overpay on short deals to reach it.
HD.meetFloor = function (t) {
  var G = HD.G, guard = 0;
  while (HD.payroll(t) < G.league.floor && t.roster.length < 25 && guard++ < 4) {
    var gap = G.league.floor - HD.payroll(t);
    var pool = G.freeAgents.map(HD.person).filter(function (p) { return HD.askingContract(p, t).salary <= HD.capSpace(t); });
    if (!pool.length) break;
    pool.sort(function (a, b) { return b.ovr - a.ovr; });
    var p = pool[0], ask = HD.askingContract(p, t);
    var sal = Math.round(Math.max(ask.salary, Math.min(gap, ask.salary * 2.5, HD.capSpace(t))) / 50000) * 50000;
    HD.signPlayer(p, t, sal, HD.randInt(1, 2));
  }
};

// Contracts expire at the re-sign deadline.
HD.expireContracts = function () {
  var G = HD.G, me = HD.me();
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid];
    HD.rosterPlayers(t).forEach(function (p) {
      if (!p.contract) return;
      if (p.contract.years > 1) { p.contract.years--; return; }
      if (p.contract.next) { p.contract = { salary: p.contract.next.salary, years: p.contract.next.years }; return; }
      if (t.gmId !== me.id) {
        // AI re-signs players it values
        var ask = HD.askingContract(p, t);
        var keen = HD.payroll(t) < HD.payrollTarget(t) ? 0.85 : 0.6;
        if (p.age < 34 && HD.tradeValue(p) > 100 && HD.chance(keen) && ask.salary < HD.capSpace(t) + p.contract.salary) {
          p.contract = { salary: ask.salary, years: ask.years }; return;
        }
      }
      t.roster = t.roster.filter(function (id) { return id !== p.id; });
      p.teamId = null; p.contract = null; p.slot = 'X';
      p.formerTeam = t.id;
      G.freeAgents.push(p.id);
      HD.addLog(p, 'Became an unrestricted free agent.');
      if (t.gmId === me.id) HD.chronicle(HD.fullName(p) + '\'s contract expired. They are now a free agent.');
    });
  });
};

// ---------- Draft ----------
HD.makeDraftClass = function () {
  var G = HD.G, me = HD.me();
  var cls = [];
  for (var i = 0; i < 40; i++) {
    var pos = HD.pick(['C', 'C', 'LW', 'RW', 'D', 'D', 'G']);
    var p = HD.makePlayer(pos, HD.randInt(44, 60), HD.randInt(18, 19), { prodigy: i < 2 && HD.chance(0.6) });
    p.pot = HD.clamp(p.ovr + HD.randInt(10, 32) + (p.traits.indexOf('prodigy') >= 0 ? 6 : 0), 0, 96);
    p.role = 'prospect'; p.contract = null;
    p.junior = HD.pick(['London Knights', 'Kamloops Blazers', 'Rimouski Océanic', 'Frölunda J20', 'Kärpät U20', 'USNTDP', 'Medicine Hat Tigers', 'Halifax Mooseheads', 'Boston College', 'Michigan Wolverines', 'CSKA Moscow Jr.', 'HC Oceláři Třinec Jr.']);
    cls.push(p.id);
  }
  // Hockey academy produces a local kid with a strong connection to you
  if (me.businesses.some(function (b) { return b.id === 'school'; })) {
    var local = HD.makePlayer(HD.pick(['C', 'D', 'LW']), HD.randInt(50, 58), 18, { nation: me.nation });
    local.pot = HD.randInt(74, 90); local.role = 'prospect'; local.contract = null;
    local.junior = 'Your Youth Academy';
    HD.addOpinion(local.id, me.id, 'academy', 'Came Through Your Academy', 35, -1);
    cls.push(local.id);
  }
  G.draft = { cls: cls, board: [], picks: [], done: false };
  HD.refreshScouting();
};

HD.scoutNoise = function () {
  var me = HD.me(), t = HD.myTeam();
  return Math.max(1, 11 - me.skills.scouting * 0.5 - (t ? t.facilities.scouting : 1) * 1.2);
};

HD.refreshScouting = function () {
  var G = HD.G, sd = HD.scoutNoise();
  G.draft.cls.forEach(function (id) {
    var p = G.people[id];
    p.scoutPot = HD.clamp(Math.round(p.pot + HD.gauss(0, sd)), 40, 99);
  });
};

HD.runDraft = function () {
  var G = HD.G, me = HD.me();
  if (!G.draft || G.draft.done) return;
  var order = HD.standings().reverse().map(function (t) { return t.id; });
  if (G.playoffs && G.playoffs.champion) {
    order = order.filter(function (id) { return id !== G.playoffs.champion; }).concat([G.playoffs.champion]);
  }
  var avail = G.draft.cls.slice();
  var picks = [];
  for (var round = 1; round <= 2; round++) {
    order.forEach(function (tid) {
      var t = G.teams[tid];
      var pid;
      if (t.gmId === me.id) {
        pid = G.draft.board.filter(function (id) { return avail.indexOf(id) >= 0; })[0];
        if (!pid) pid = HD.sortBy(avail, function (id) { return G.people[id].scoutPot * 2 + G.people[id].ovr; }, true)[0];
      } else {
        var gm = G.people[t.gmId];
        var sd = Math.max(2, 12 - (gm.skills ? gm.skills.scouting : 8) * 0.5 - t.facilities.scouting);
        pid = HD.sortBy(avail, function (id) { var p = G.people[id]; return (p.pot + HD.gauss(0, sd)) * 2 + p.ovr; }, true)[0];
      }
      avail.splice(avail.indexOf(pid), 1);
      var p = G.people[pid];
      p.teamId = tid; p.draftedBy = tid; p.draftYear = G.season; p.draftPick = picks.length + 1;
      t.prospects = t.prospects || [];
      t.prospects.push(pid);
      HD.addLog(p, 'Drafted #' + p.draftPick + ' overall by the ' + HD.teamName(t) + '.');
      picks.push({ n: picks.length + 1, t: tid, p: pid });
    });
  }
  avail.forEach(function (id) { G.people[id].role = 'undrafted'; G.people[id].retired = true; });
  G.draft.picks = picks;
  G.draft.done = true;
  var first = G.people[picks[0].p];
  HD.news('DRAFT: The ' + G.teams[picks[0].t].name + ' select ' + HD.fullName(first) + ' (' + first.pos + ', ' + first.junior + ') first overall.', 'league', picks[0].t, true);
  picks.filter(function (pk) { return G.teams[pk.t].gmId === me.id; }).forEach(function (pk) {
    var p = G.people[pk.p];
    HD.chronicle('You drafted ' + HD.fullName(p) + ' (' + p.pos + ') at #' + pk.n + '. Scouts project potential ~' + p.scoutPot + '.');
    HD.addOpinion(p.id, me.id, 'drafted', 'Drafted Me', 20, 52);
  });
};

// ---------- Aging & development ----------
HD.developPlayer = function (p, team) {
  var a = p.age, d;
  if (a <= 20) d = HD.randFloat(2, 7);
  else if (a <= 23) d = HD.randFloat(1, 5);
  else if (a <= 26) d = HD.randFloat(-0.5, 2.5);
  else if (a <= 29) d = HD.randFloat(-1.5, 1);
  else if (a <= 32) d = HD.randFloat(-3.5, 0);
  else d = HD.randFloat(-6, -1);
  if (p.traits.indexOf('diligent') >= 0) d += 1;
  if (p.traits.indexOf('lazy') >= 0) d -= 1;
  if (p.traits.indexOf('prodigy') >= 0 && a <= 24) d += 1.5;
  if (team) d += (team.facilities.training - 2) * 0.5;
  for (var r in p.relations) if (p.relations[r] === 'protege') d += 1.2;
  if (d > 0 && p.ovr >= p.pot) d = Math.min(d, 0.5);
  if (d > 0) d = Math.min(d, p.pot - p.ovr + 0.5);
  var keys = p.pos === 'G' ? ['gk'] : ['off', 'def', 'phys'];
  keys.forEach(function (k) { p[k] = HD.clamp(Math.round(p[k] + d + HD.gauss(0, 1)), 25, 99); });
  if (p.pos !== 'G' && a >= 30) p.phys = HD.clamp(p.phys - 1, 25, 99);
  var before = p.ovr;
  p.ovr = HD.calcOvr(p);
  if (p.ovr > p.pot) p.pot = p.ovr;
  return p.ovr - before;
};

HD.shouldRetire = function (p) {
  if (p.age >= 40) return true;
  if (p.age >= 35) return HD.chance(0.25 + (p.age - 35) * 0.15 + (p.ovr < 70 ? 0.3 : 0));
  if (p.age >= 31 && p.ovr < 58) return HD.chance(0.5);
  if (!p.teamId && p.age >= 30 && p.ovr < 63) return HD.chance(0.5);
  return false;
};
