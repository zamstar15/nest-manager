// Game state, calendar, weekly tick, season rollover, save/load.
var HD = HD || {};

HD.SAVE_KEY = 'hockey_dynasty_save_v1';

HD.newGame = function (setup) {
  HD.G = {
    version: 1, nextId: 1, season: 2026, week: 1, absWeek: 1, phase: 'preseason',
    people: {}, teams: {}, news: [], chronicleLog: [], pendingEvents: [], eventCd: {}, flags: {},
    faOffers: {}, marketMood: 0, lastReport: null
  };
  HD.generateWorld(setup);
  HD.makeSchedule();
  HD.coachPool();
  HD.makeDraftClass();
  HD.chronicle('You were named General Manager of the ' + HD.teamName(HD.myTeam()) + '.');
  HD.news(HD.teamName(HD.myTeam()) + ' hire ' + HD.fullName(HD.me()) + ' as General Manager.', 'staff', HD.me().teamId, true);
  HD.queueEvent('season_goal');
  return HD.G;
};

HD.news = function (text, type, teamId, major) {
  var G = HD.G;
  G.news.unshift({ y: G.season, w: G.week, t: text, k: type || 'league', team: teamId || null, major: !!major });
  if (G.news.length > 250) G.news.length = 250;
};

HD.chronicle = function (text) {
  var G = HD.G;
  G.chronicleLog.unshift({ y: G.season, w: G.week, t: text });
  if (G.chronicleLog.length > 400) G.chronicleLog.length = 400;
};

HD.seasonLabel = function (y) { return y + '–' + String(y + 1).slice(2); };

HD.canAdvance = function () { return HD.G.pendingEvents.length === 0 && !HD.G.gameOver; };

HD.advanceWeek = function () {
  var G = HD.G;
  if (!HD.canAdvance()) return null;
  var me = HD.me(), myT = HD.myTeam();
  var phase = HD.phaseOf(G.week);
  G.phase = phase;
  var report = { season: G.season, week: G.week, phase: phase, games: [], series: [], notes: [] };
  var results = [];
  var newsMark = G.news.length ? G.news[0] : null;

  if (myT && (phase === 'regular' || phase === 'playoffs')) HD.emergencyFill(myT);
  if (phase === 'regular') {
    results = HD.playWeek(G.week);
    if (G.week === HD.CAL.DEADLINE) { HD.news('The trade deadline has passed. Rosters are frozen until the playoffs end.', 'league', null, true); if (myT) HD.checkOwnerDemand(); }
  } else if (phase === 'playoffs') {
    if (!G.playoffs || G.week === HD.CAL.PLAYOFF_START) HD.startPlayoffs();
    var P = G.playoffs;
    var roundName = HD.ROUND_NAMES[P.round];
    var cur = P.series.slice();
    HD.playPlayoffRound();
    cur.forEach(function (s) {
      var w = G.teams[s.winner], l = G.teams[s.loser];
      HD.news(roundName + ': ' + w.name + ' defeat the ' + l.name + ' ' + Math.max(s.wh, s.wl) + '–' + Math.min(s.wh, s.wl) + '.', 'playoffs', w.id, true);
      if (myT && (s.hi === myT.id || s.lo === myT.id)) report.series.push(s);
    });
    if (P.champion) HD.crownChampion();
  } else if (phase === 'awards') {
    HD.seasonAwards();
    if (myT) HD.queueEvent('owner_review');
    HD.aiGmReviews();
    HD.closeBooks();
  } else if (phase === 'draft') {
    HD.runDraft();
  } else if (phase === 'resign') {
    if (myT && me.contract && me.contract.years <= 1) HD.queueEvent('my_contract');
    HD.expireContracts();
    HD.fillGmVacancies();
    Object.keys(G.teams).forEach(function (id) { if (G.teams[id].coachId && G.people[G.teams[id].coachId].contract && G.people[G.teams[id].coachId].contract.years <= 1) HD.coachContractEnd(G.teams[id]); });
  } else if (phase === 'freeagency') {
    HD.aiFreeAgencyBids();
    var final = G.week === HD.CAL.FA_END;
    HD.resolveFreeAgency(final);
    if (final) Object.keys(G.teams).forEach(function (id) { var t = G.teams[id]; if (t.gmId !== G.playerId) { HD.aiManageRoster(t, false); HD.meetFloor(t); } });
  }

  // Weekly world tick
  HD.weeklyFinances(results);
  HD.healInjuries();
  HD.updateMorale();
  HD.decayOpinions();
  HD.lifeEvents();
  if (G.week % 4 === 0) HD.mortality();
  if (phase === 'regular') { HD.pressCoverage(); HD.aiStaffChanges(); HD.aiTrades(); HD.leagueStorylines(); HD.milestones(results); }
  if (phase === 'regular' || phase === 'preseason') Object.keys(G.teams).forEach(function (id) {
    var t = G.teams[id];
    var healthy = HD.groupCounts({ roster: t.roster.filter(function (pid) { return G.people[pid].injury <= 0; }) });
    if (healthy.G < 2 || healthy.D < 6 || healthy.F < 12 || t.roster.length < HD.ROSTER_MIN) {
      if (t.gmId === G.playerId) HD.emergencyFill(t); else HD.aiManageRoster(t, false);
    }
  });
  HD.evolveNpcRelations();
  HD.updateStocks();
  HD.processTip();
  HD.weeklyPersonal();
  HD.ownerFinanceCheck();
  HD.processTeamSales();
  if (myT) HD.weeklyManager(results, report);
  Object.keys(G.teams).forEach(function (id) { var t = G.teams[id]; t.hype = HD.clamp(t.hype + (45 + t.market * 3 - t.hype) * 0.03, 0, 100); });
  if (!myT || !me.teamId) HD.unemployedWeek();

  // My games for the report
  results.forEach(function (r) {
    if (myT && (r.h === myT.id || r.a === myT.id)) report.games.push(r);
  });
  if (myT) myT.lastGameLoss = report.games.length && HD.lostGame(report.games[report.games.length - 1], myT.id);

  // Collect this week's news
  report.news = [];
  for (var i = 0; i < G.news.length && G.news[i] !== newsMark; i++) report.news.push(G.news[i]);

  // Advance calendar
  G.week++;
  G.absWeek++;
  if (G.week > HD.CAL.YEAR_WEEKS) HD.newSeason();
  G.phase = HD.phaseOf(G.week);
  if (G.phase === 'regular' || G.phase === 'preseason' || G.phase === 'freeagency' || G.phase === 'awards') HD.rollRandomEvents();
  if (me.teamId && G.week === HD.CAL.REG_START) HD.news('Opening night! The ' + HD.seasonLabel(G.season) + ' season is underway.', 'league', null, true);
  G.lastReport = report;
  return report;
};

HD.lostGame = function (r, tid) { return r.h === tid ? r.hs < r.as : r.as < r.hs; };

HD.weeklyManager = function (results, report) {
  var G = HD.G, me = HD.me(), t = HD.myTeam();
  var w = 0, l = 0;
  results.forEach(function (r) {
    if (r.h !== t.id && r.a !== t.id) return;
    var won = r.h === t.id ? r.hs > r.as : r.as > r.hs;
    if (won) w++; else l++;
  });
  me.career.wins += w; me.career.losses += l;
  me.prestige = Math.max(0, me.prestige + (w - l) * 0.12);
  var relief = HD.sum(me.assets, function (a) { var d = HD.assetDef(a); return d ? d.stress : 0; }) * 0.12;
  var delta = 1.2 + l * 1.1 - w * 0.8 + relief;
  if (me.spouseId && HD.opinion(me.spouseId, me.id) > 30) delta -= 1;
  if (me.wealth < 0) delta += 2;
  if (G.phase === 'freeagency' || G.phase === 'draft') delta -= 2;
  HD.addStress(delta);
  if (me.stress > 85) me.health = Math.max(0, me.health - 1);
  else if (me.stress < 40) me.health = Math.min(100, me.health + 0.5);
  HD.gainXp(me.focus, 6 + (me.traits.indexOf('diligent') >= 0 ? 2 : 0));
  if (me.health <= 0 && !G.gameOver) { HD.endCareer('Your heart gave out behind the bench. Your doctors forbid you from ever working in hockey again.'); return; }
  // Mid-season firing
  var o = G.people[t.ownerId];
  if (G.phase === 'regular' && G.week >= 10 && me.stakes < 50 && HD.opinion(o.id, me.id) <= -60 && !G.pendingEvents.some(function (e) { return e.id === 'fired'; })) HD.queueEvent('fired', { reason: 'mid' });
  me.age = me.age; // birthdays at season rollover
};

HD.processTip = function () {
  var G = HD.G, tip = G.flags.tip;
  if (!tip) return;
  tip.w--;
  if (tip.w > 0) return;
  var s = G.stocks.filter(function (x) { return x.id === tip.s; })[0];
  var c = HD.COMPANIES.filter(function (x) { return x.id === tip.s; })[0];
  var mag = HD.randFloat(0.15, 0.35);
  s.price *= tip.up ? 1 + mag : 1 - mag * 0.6;
  HD.news(c.name + (tip.up ? ' announces a blockbuster acquisition. Shares surge ' : ' deal collapses. Shares fall ') + Math.round((tip.up ? mag : mag * 0.6) * 100) + '%.', 'money', null, true);
  var me = HD.me();
  if (tip.up && me.stocks[tip.s] && HD.chance(0.2 - me.skills.intrigue * 0.006)) {
    var fine = Math.round(me.stocks[tip.s].shares * s.price * 0.4);
    HD.spend(fine); me.prestige -= 10;
    HD.news('Securities regulators fine ' + HD.fullName(me) + ' ' + HD.money(fine) + ' over suspicious ' + c.id + ' trades.', 'scandal', me.teamId, true);
    HD.chronicle('Insider trading probe: fined ' + HD.money(fine) + '.');
  }
  G.flags.tip = null;
};

HD.coachContractEnd = function (t) {
  var G = HD.G, c = G.people[t.coachId];
  if (t.gmId === G.playerId) {
    if (HD.opinion(c.id, G.playerId) < 0 || HD.chance(0.3)) { HD.replaceCoach(t, 'left'); HD.chronicle('Coach ' + HD.fullName(c) + '\'s contract expired and they left. ' + HD.N(t.coachId) + ' was hired.'); return; }
    c.contract = { salary: c.contract.salary, years: 3 }; c.asked = false;
    HD.chronicle('Coach ' + HD.fullName(c) + ' re-signed for 3 years.');
  } else if (HD.teamPct(t) !== null && HD.teamPct(t) < 0.5) HD.replaceCoach(t, 'fired');
  else { c.contract.years = 3; }
};

HD.crownChampion = function () {
  var G = HD.G, P = G.playoffs, me = HD.me();
  var t = G.teams[P.champion];
  var final = P.rounds[P.rounds.length - 1][0];
  t.titles.push(G.season);
  t.hype = HD.clamp(t.hype + 15, 0, 100);
  HD.news('🏆 The ' + HD.teamName(t) + ' are CHAMPIONS! They beat the ' + G.teams[final.loser].name + ' ' + Math.max(final.wh, final.wl) + '–' + Math.min(final.wh, final.wl) + ' in the Final.', 'playoffs', t.id, true);
  HD.rosterPlayers(t).forEach(function (p) { p.rings = (p.rings || 0) + 1; HD.addLog(p, 'Won the championship with the ' + HD.teamName(t) + '.'); p.morale = 100; });
  if (t.id === me.teamId) {
    me.career.titles++;
    me.prestige += 30;
    HD.chronicle('🏆 CHAMPIONS! You led the ' + HD.teamName(t) + ' to the title.');
    HD.rosterPlayers(t).forEach(function (p) { HD.addOpinion(p.id, me.id, 'champions', 'Won A Title Together', 30, 104); });
    HD.addOpinion(t.ownerId, me.id, 'champions', 'Brought Home A Title', 40, 104);
    G.people[t.coachId] && HD.addOpinion(t.coachId, me.id, 'champions', 'Won A Title Together', 30, 104);
    var bonus = Math.round(me.contract.salary * 0.5);
    me.wealth += bonus; me.earnings.bonus += bonus;
    HD.chronicle('Championship bonus: ' + HD.money(bonus) + '.');
  }
  // Playoff prestige for every round you won
  P.rounds.forEach(function (series) { series.forEach(function (s) { if (s.winner === me.teamId) me.prestige += 4; }); });
};

HD.seasonAwards = function () {
  var G = HD.G, me = HD.me();
  var skaters = [], goalies = [];
  Object.keys(G.teams).forEach(function (id) { HD.rosterPlayers(G.teams[id]).forEach(function (p) { if (p.pos === 'G') { if (p.stats.gp >= 15) goalies.push(p); } else skaters.push(p); }); });
  var pts = function (p) { return p.stats.g + p.stats.a; };
  var mvp = HD.sortBy(skaters, function (p) { var t = G.teams[p.teamId]; return pts(p) + (HD.teamPct(t) || 0.5) * 30; }, true)[0];
  var scorer = HD.sortBy(skaters, pts, true)[0];
  var sniper = HD.sortBy(skaters, function (p) { return p.stats.g; }, true)[0];
  var vez = HD.sortBy(goalies, function (p) { return p.stats.sa ? 1 - p.stats.ga / p.stats.sa : 0; }, true)[0];
  var rookies = skaters.filter(function (p) { return p.age <= 21; });
  var roy = HD.sortBy(rookies, pts, true)[0];
  var champ = G.playoffs && G.playoffs.champion;
  var entry = { season: G.season, champion: champ, mvp: mvp && mvp.id, scorer: scorer && scorer.id, sniper: sniper && sniper.id, goalie: vez && vez.id, rookie: roy && roy.id, standings: HD.standings().map(function (t) { return t.id; }) };
  // GM of the year: best points improvement relative to preseason strength
  var gmBest = HD.sortBy(Object.keys(G.teams).map(function (id) { return G.teams[id]; }), function (t) { return HD.points(t) + (t.id === champ ? 20 : 0) - t.market; }, true)[0];
  entry.gm = gmBest.gmId;
  G.league.history.unshift(entry);
  var awards = [['MVP', mvp, function (p) { return pts(p) + ' pts'; }], ['Scoring Title', scorer, function (p) { return pts(p) + ' pts'; }], ['Top Goal Scorer', sniper, function (p) { return p.stats.g + ' goals'; }], ['Top Goaltender', vez, function (p) { return (1 - p.stats.ga / Math.max(1, p.stats.sa)).toFixed(3) + ' SV%'; }], ['Rookie of the Year', roy, function (p) { return pts(p) + ' pts'; }]];
  awards.forEach(function (a) {
    if (!a[1]) return;
    HD.news('AWARDS: ' + a[0] + ' — ' + HD.fullName(a[1]) + ' (' + G.teams[a[1].teamId].name + ', ' + a[2](a[1]) + ').', 'league', a[1].teamId, true);
    HD.addLog(a[1], 'Won the ' + a[0] + ' award.');
    a[1].awards = (a[1].awards || []).concat([G.season + ' ' + a[0]]);
    if (a[1].teamId === me.teamId) HD.addOpinion(a[1].id, me.id, 'award', 'Built Around Me', 8, 52);
  });
  if (entry.gm === me.id) { me.prestige += 12; HD.chronicle('You were named GM of the Year!'); HD.news('AWARDS: ' + HD.fullName(me) + ' is GM of the Year.', 'league', me.teamId, true); }
  if (me.teamId) me.career.seasons++;
  var res = me.teamId ? HD.seasonResult() : null;
  if (res && res.playoffs) me.career.playoffs++;
};

HD.newSeason = function () {
  var G = HD.G, me = HD.me();
  G.season++;
  G.week = 1;
  // Roll stats, age, develop, retire
  var notable = [];
  Object.keys(G.people).forEach(function (id) {
    var p = G.people[id];
    if (!p.alive) return;
    if (p.role === 'undrafted' || (p.retired && p.role !== 'retired')) { HD.removePerson(id); return; }
    p.age++;
    if (p.role === 'player' || p.role === 'prospect') {
      if (p.stats && p.stats.gp > 0) {
        p.seasons.push({ y: G.season - 1, t: p.teamId, gp: p.stats.gp, g: p.stats.g, a: p.stats.a, pim: p.stats.pim, w: p.stats.w, l: p.stats.l, sa: p.stats.sa, ga: p.stats.ga, so: p.stats.so, ovr: p.ovr });
        ['gp', 'g', 'a', 'pim', 'w', 'l', 'sa', 'ga', 'so'].forEach(function (k) { p.career[k] += p.stats[k]; });
      }
      p.stats = HD.blankStats();
      var t = p.teamId ? G.teams[p.teamId] : null;
      var d = HD.developPlayer(p, t);
      if (t && t.gmId === me.id && Math.abs(d) >= 4) HD.chronicle(HD.fullName(p) + (d > 0 ? ' made a big leap (+' : ' declined sharply (') + d + ' OVR, now ' + p.ovr + ').');
      if (p.role === 'player' && HD.shouldRetire(p)) {
        if (p.career.g + p.career.a > 400 || p.ovr >= 80 || (t && t.gmId === me.id)) notable.push(p);
        HD.retirePlayer(p);
      }
    }
    if (p.role === 'spouse' || p.role === 'child') return;
    if ((p.role === 'owner' || p.role === 'coach' || p.role === 'gm' || p.role === 'journalist' || p.role === 'agent') && p.age >= 72 && p.id !== G.playerId && !p.teamId && HD.chance(0.3)) { p.retired = true; }
  });
  notable.forEach(function (p) {
    HD.news(HD.fullName(p) + ' retires after ' + (p.seasons.length) + ' seasons (' + p.career.g + 'G, ' + p.career.a + 'A).', 'league', p.lastTeam, p.career.g + p.career.a > 600);
    if (p.lastTeam === me.teamId) HD.chronicle(HD.fullName(p) + ' retired.');
  });
  // Prospects that never made it
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid];
    t.prospects = (t.prospects || []).filter(function (pid) {
      var p = G.people[pid];
      if (!p) return false;
      if (p.age >= 23) { p.role = 'player'; p.teamId = null; p.contract = null; G.freeAgents.push(pid); return false; }
      return true;
    });
    t.record = { w: 0, l: 0, otl: 0, gf: 0, ga: 0, streak: 0 };
    t.gmHeat = 0;
    t.tradeLog = [];
    HD.aiManageRoster(t, false);
  });
  // Replenish the free-agent pool with Europeans, minor leaguers
  G.freeAgents = G.freeAgents.filter(function (id) { var p = G.people[id]; return p && !p.retired; });
  for (var i = 0; i < 10; i++) {
    var fa = HD.makePlayer(HD.pick(['C', 'LW', 'RW', 'D', 'D', 'G']), HD.randInt(55, 69), HD.randInt(21, 30));
    fa.contract = null; HD.assignAgent(fa); G.freeAgents.push(fa.id);
  }
  // Manager rolls over
  if (me.teamId) {
    if (me.contract) me.contract.years--;
    G.ownerGoal = null;
    HD.queueEvent('season_goal');
  }
  if (me.teamId && me.contract && me.contract.years <= 0) me.contract.years = 1; // safety: renewal handled at deadline
  G.playoffs = null;
  G.draft = null;
  G.faOffers = {};
  HD.makeSchedule();
  HD.makeDraftClass();
  Object.keys(G.teams).forEach(function (id) { HD.autoLines(G.teams[id]); });
  HD.news('Training camps open across the league for the ' + HD.seasonLabel(G.season) + ' season.', 'league', null, true);
  HD.chronicle('— The ' + HD.seasonLabel(G.season) + ' season begins. —');
};

HD.removePerson = function (id) {
  var G = HD.G, p = G.people[id];
  if (!p) return;
  Object.keys(p.relations).forEach(function (k) { if (G.people[k]) delete G.people[k].relations[id]; });
  delete G.people[id];
};

HD.retirePlayer = function (p) {
  var G = HD.G;
  p.lastTeam = p.teamId;
  if (p.teamId) { var t = G.teams[p.teamId]; t.roster = t.roster.filter(function (id) { return id !== p.id; }); if (t.captainId === p.id) t.captainId = null; }
  G.freeAgents = G.freeAgents.filter(function (id) { return id !== p.id; });
  p.teamId = null; p.contract = null; p.role = 'retired'; p.retired = true;
  p.opinions = {};
  HD.addLog(p, 'Retired from professional hockey.');
  // Respected leaders sometimes move behind the bench
  if (p.traits.indexOf('leader') >= 0 && HD.chance(0.35)) {
    p.role = 'coach'; p.retired = false;
    p.skills = { diplomacy: HD.randInt(6, 13), tactics: HD.randInt(7, 15), finance: HD.randInt(3, 8), scouting: HD.randInt(5, 11), intrigue: HD.randInt(3, 9) };
    HD.coachPool(); G.coachPool.push(p.id);
  }
};

// ---------- Firing, moving teams, unemployment ----------
HD.defEvent('fired', {
  scripted: true,
  setup: function () { return {}; },
  view: function (ctx) {
    var o = HD.owner();
    return {
      title: 'You\'re Fired', portraits: [o.id],
      text: HD.fullName(o) + ' doesn\'t look up from the papers. "I\'m making a change. Security will help you with your things."',
      options: [{ label: 'Hand over your keycard.', act: function () { HD.getFired('Fired by ' + HD.fullName(o) + '.'); return 'The press is waiting in the parking lot.'; } }]
    };
  }
});

HD.getFired = function (reason, voluntary) {
  var G = HD.G, me = HD.me(), t = HD.myTeam();
  if (!t) return;
  HD.chronicle((voluntary ? 'You left the ' : 'You were fired by the ') + HD.teamName(t) + '. ' + reason);
  HD.news((voluntary ? HD.fullName(me) + ' leaves the ' : 'The ' + t.name + ' fire GM ') + (voluntary ? t.name + '.' : HD.fullName(me) + '.'), 'staff', t.id, true);
  if (me.stakes > 0) {
    var val = HD.teamValue(t) * me.stakes / 100;
    me.wealth += val; me.stakes = 0;
    HD.chronicle('Your equity stake was bought back for ' + HD.money(val) + '.');
  }
  me.prestige = Math.max(0, me.prestige - (voluntary ? 0 : 10));
  me.teamId = null; me.contract = null;
  t.gmVacant = true;
  var gm = HD.makeStaff('gm', HD.randInt(7, 13), t.id);
  t.gmId = gm.id; t.gmVacant = false;
  HD.autoLines(t);
  G.unemployedSince = G.absWeek;
  G.pendingEvents = [];
};

HD.switchTeam = function (tid, salary) {
  var G = HD.G, me = HD.me();
  var old = HD.myTeam();
  if (old) {
    if (me.stakes > 0) { var val = HD.teamValue(old) * me.stakes / 100; me.wealth += val; me.stakes = 0; }
    var ng = HD.makeStaff('gm', HD.randInt(7, 13), old.id);
    old.gmId = ng.id;
    HD.autoLines(old);
    HD.addOpinion(old.ownerId, me.id, 'left_us', 'Abandoned Us', -40, -1);
    HD.chronicle('You left the ' + HD.teamName(old) + '.');
  }
  var t = G.teams[tid];
  var prev = G.people[t.gmId];
  if (prev && prev.id !== me.id) { prev.teamId = null; prev.unemployed = true; G.unemployedGMs = (G.unemployedGMs || []).concat([prev.id]); HD.addOpinion(prev.id, me.id, 'took_job', 'Took My Job', -30, -1); }
  t.gmId = me.id; t.gmVacant = false;
  me.teamId = t.id;
  me.contract = { salary: salary, years: 5 };
  if (me.career.teams.indexOf(t.id) < 0) me.career.teams.push(t.id);
  HD.addOpinion(t.ownerId, me.id, 'hired_me', 'Hand-Picked GM', 20, 52);
  HD.chronicle('You became General Manager of the ' + HD.teamName(t) + ' (' + HD.money(salary) + '/yr).');
  HD.news(HD.teamName(t) + ' hire ' + HD.fullName(me) + ' as General Manager.', 'staff', t.id, true);
  if (G.phase === 'regular' || G.phase === 'playoffs') HD.setGoal(1); else if (!G.pendingEvents.some(function (e) { return e.id === 'season_goal'; })) HD.queueEvent('season_goal');
};

HD.defEvent('job_hunt', {
  scripted: true,
  setup: function () {
    var G = HD.G, me = HD.me();
    var teams = Object.keys(G.teams).map(function (id) { return G.teams[id]; });
    teams.sort(function (a, b) { return (HD.teamPct(a) || 0.5) - (HD.teamPct(b) || 0.5); });
    var pool = teams.slice(0, 8).filter(function (t) { return HD.opinion(t.ownerId, me.id) > -30; });
    if (!pool.length) return null;
    var t = HD.pick(pool);
    return { t: t.id, salary: Math.round((900000 + me.prestige * 18000) / 50000) * 50000 };
  },
  view: function (ctx) {
    var t = HD.team(ctx.t), o = HD.person(t.ownerId);
    return {
      title: 'A Second Chance', portraits: [o.id],
      text: HD.fullName(o) + ', owner of the struggling ' + HD.teamName(t) + ', wants to talk. "I\'m cleaning house. ' + HD.money(ctx.salary) + ' a year. Interested?"',
      options: [
        { label: 'Take the job.', hint: 'Back in the game.', act: function () { HD.switchTeam(t.id, ctx.salary); return 'You\'re back.'; } },
        { label: 'Hold out for something better.', hint: '', act: function () { return 'You wait by the phone.'; } }
      ]
    };
  }
});

HD.unemployedWeek = function () {
  var G = HD.G;
  if (HD.chance(0.22) && !G.pendingEvents.length) HD.queueEvent('job_hunt');
};

HD.endCareer = function (reason) {
  var G = HD.G;
  G.gameOver = { reason: reason, season: G.season, week: G.week };
  HD.chronicle('Career over: ' + reason);
};

// ---------- Save / Load ----------
HD.save = function () {
  try { localStorage.setItem(HD.SAVE_KEY, JSON.stringify(HD.G)); return true; } catch (e) { return false; }
};
HD.load = function () {
  try {
    var s = localStorage.getItem(HD.SAVE_KEY);
    if (!s) return false;
    HD.G = JSON.parse(s);
    return true;
  } catch (e) { return false; }
};
HD.hasSave = function () { try { return !!localStorage.getItem(HD.SAVE_KEY); } catch (e) { return false; } };
HD.deleteSave = function () { try { localStorage.removeItem(HD.SAVE_KEY); } catch (e) { /* ignore */ } };
