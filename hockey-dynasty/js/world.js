// World generation: people, rosters, franchises.
var HD = HD || {};

HD.newId = function () { return 'p' + (HD.G.nextId++); };

HD.person = function (id) { return HD.G.people[id]; };
HD.team = function (id) { return HD.G.teams[id]; };
HD.me = function () { return HD.G.people[HD.G.playerId]; };
HD.myTeam = function () { return HD.G.teams[HD.me().teamId]; };
HD.fullName = function (p) { return p ? p.first + ' ' + p.last : '—'; };
HD.teamName = function (t) { return t ? t.city + ' ' + t.name : 'Free Agent'; };

HD.pickNation = function () {
  var keys = Object.keys(HD.NATIONS);
  return HD.weightedPick(keys, function (k) { return HD.NATIONS[k].w; });
};

HD.rollTraits = function (n, extraPool) {
  var traits = [];
  var pool = HD.shuffle(HD.PERSONALITY_TRAITS.slice());
  for (var i = 0; i < pool.length && traits.length < n; i++) {
    var t = pool[i], opp = HD.TRAITS[t].opp;
    if (traits.indexOf(opp) === -1) traits.push(t);
  }
  if (extraPool && HD.chance(0.55)) traits.push(HD.pick(extraPool));
  if (extraPool && HD.chance(0.15)) {
    var t2 = HD.pick(extraPool);
    if (traits.indexOf(t2) === -1) traits.push(t2);
  }
  return traits;
};

HD.makePerson = function (opts) {
  var nation = opts.nation || HD.pickNation();
  var gender = opts.gender || 'm';
  var n = HD.NATIONS[nation];
  // Avoid two living people sharing a full name
  var first, last, tries = 0;
  HD.G.usedNames = HD.G.usedNames || {};
  do {
    first = opts.first || (gender === 'f' ? HD.pick(HD.FEMALE_FIRST) : HD.pick(n.first));
    last = opts.last || (opts.genericName ? HD.pick(HD.GENERIC_LAST) : HD.pick(n.last));
  } while (HD.G.usedNames[first + ' ' + last] && tries++ < 12);
  HD.G.usedNames[first + ' ' + last] = 1;
  var p = {
    id: HD.newId(),
    first: first,
    last: last,
    gender: gender, nation: nation,
    age: opts.age || HD.randInt(25, 55),
    role: opts.role, teamId: opts.teamId || null,
    traits: opts.traits || HD.rollTraits(HD.randInt(2, 3)),
    alive: true, retired: false,
    wealth: opts.wealth || 0, prestige: opts.prestige || 0,
    opinions: {}, relations: {}, log: [],
    lastTalk: -99
  };
  HD.G.people[p.id] = p;
  return p;
};

HD.addLog = function (p, text) {
  p.log.unshift({ y: HD.G.season, w: HD.G.week, t: text });
  if (p.log.length > 40) p.log.length = 40;
};

// ---------- Hockey players ----------
HD.calcOvr = function (p) {
  if (p.pos === 'G') return Math.round(p.gk);
  if (p.pos === 'D') return Math.round(p.def * 0.55 + p.off * 0.25 + p.phys * 0.2);
  return Math.round(p.off * 0.55 + p.def * 0.25 + p.phys * 0.2);
};

HD.marketValue = function (p) {
  // Fair annual salary for a player's quality, age and upside.
  var o = p.ovr;
  var base = 750000 + 14500 * Math.pow(Math.max(0, o - 60), 2);
  if (p.age <= 23) base *= 1 + Math.max(0, p.pot - o) * 0.012;
  if (p.age >= 33) base *= Math.max(0.45, 1 - (p.age - 32) * 0.1);
  base *= HD.G && HD.G.league ? HD.G.league.cap / 82000000 : 1;
  return Math.round(base / 50000) * 50000;
};

HD.makePlayer = function (pos, target, age, opts) {
  opts = opts || {};
  var p = HD.makePerson({ role: 'player', age: age, traits: HD.rollTraits(HD.randInt(1, 2), HD.PLAYER_TRAITS), nation: opts.nation });
  p.pos = pos;
  var t = target;
  if (pos === 'G') {
    p.gk = HD.clamp(HD.gauss(t, 2.5), 40, 99); p.off = 20; p.def = 60; p.phys = HD.randInt(50, 80);
  } else if (pos === 'D') {
    p.def = HD.clamp(HD.gauss(t + 3, 4), 35, 99);
    p.off = HD.clamp(HD.gauss(t - 6, 6), 30, 99);
    p.phys = HD.clamp(HD.gauss(t, 7), 35, 99);
  } else {
    p.off = HD.clamp(HD.gauss(t + 3, 4), 35, 99);
    p.def = HD.clamp(HD.gauss(t - 7, 6), 30, 99);
    p.phys = HD.clamp(HD.gauss(t - 2, 8), 35, 99);
  }
  if (p.traits.indexOf('enforcer') >= 0) p.phys = HD.clamp(p.phys + 10, 0, 99);
  if (p.traits.indexOf('sniper') >= 0) p.off = HD.clamp(p.off + 3, 0, 99);
  ['off', 'def', 'phys', 'gk'].forEach(function (k) { if (p[k] !== undefined) p[k] = Math.round(p[k]); });
  p.ovr = HD.calcOvr(p);
  var upside = age <= 20 ? HD.randInt(5, 22) : age <= 23 ? HD.randInt(2, 14) : age <= 26 ? HD.randInt(0, 6) : 0;
  if (p.traits.indexOf('prodigy') >= 0) upside += 8;
  if (opts.prodigy && p.traits.indexOf('prodigy') < 0) { p.traits.push('prodigy'); upside += 8; }
  p.pot = HD.clamp(p.ovr + upside, p.ovr, 99);
  p.morale = HD.randInt(55, 80);
  p.form = 0;
  p.injury = 0;
  p.slot = 'X';
  p.stats = HD.blankStats();
  p.career = HD.blankStats();
  p.seasons = [];
  p.contract = { salary: HD.marketValue(p), years: HD.randInt(1, 5) };
  p.wealth = p.contract.salary * HD.randInt(1, Math.max(1, age - 18)) * 0.3;
  return p;
};

HD.blankStats = function () { return { gp: 0, g: 0, a: 0, pim: 0, pm: 0, w: 0, l: 0, sa: 0, ga: 0, so: 0 }; };

HD.makeStaff = function (role, level, teamId) {
  var p = HD.makePerson({ role: role, teamId: teamId, age: HD.randInt(38, 66) });
  var s = function () { return HD.clamp(Math.round(HD.gauss(level, 2.5)), 1, 20); };
  p.skills = { diplomacy: s(), tactics: s(), finance: s(), scouting: s(), intrigue: s() };
  if (role === 'coach') { p.skills.tactics = HD.clamp(p.skills.tactics + 3, 1, 20); p.contract = { salary: 1000000 + level * 150000, years: HD.randInt(1, 4) }; }
  if (role === 'gm') p.contract = { salary: 1200000 + level * 120000, years: HD.randInt(1, 4) };
  p.wealth = HD.randInt(2, 15) * 1000000;
  return p;
};

HD.makeOwner = function (team) {
  var p = HD.makePerson({ role: 'owner', teamId: team.id, age: HD.randInt(45, 78), genericName: HD.chance(0.6), gender: HD.chance(0.2) ? 'f' : 'm' });
  p.wealth = Math.round(HD.randFloat(0.4, 6) * 1e9 * (0.6 + team.market / 15));
  p.patience = HD.randInt(30, 80);
  if (p.traits.indexOf('ambitious') >= 0) p.patience -= 15;
  if (p.traits.indexOf('content') >= 0) p.patience += 15;
  p.business = HD.pick(['oil & gas', 'real estate', 'tech', 'shipping', 'grocery chains', 'telecom', 'pharmaceuticals', 'private equity', 'construction', 'a family brewery empire']);
  return p;
};

HD.makeTeamRoster = function (team, quality) {
  var plan = [['C', 5], ['LW', 4], ['RW', 4], ['D', 8], ['G', 2]];
  plan.forEach(function (pp) {
    for (var i = 0; i < pp[1]; i++) {
      var depth = pp[0] === 'G' ? (i === 0 ? 5 : -5) : (pp[0] === 'D' ? 8 - i * 2.2 : 10 - i * 3.5);
      var age = HD.clamp(Math.round(HD.gauss(27, 4)), 19, 38);
      var pl = HD.makePlayer(pp[0], quality + depth + HD.randInt(-3, 3), age);
      pl.teamId = team.id;
      team.roster.push(pl.id);
    }
  });
};

HD.makeFranchise = function (f) {
  var quality = HD.randInt(65, 71);
  var team = {
    id: f.id, city: f.city, name: f.name, abbr: f.id, colors: f.colors, arena: f.arena, market: f.market,
    roster: [], tactic: 'balanced',
    facilities: { arena: HD.randInt(1, 3), training: HD.randInt(1, 3), medical: HD.randInt(1, 3), scouting: HD.randInt(1, 3) },
    ticketPrice: Math.round(55 + f.market * 7),
    hype: HD.clamp(Math.round(35 + f.market * 3 + (quality - 68) * 3), 10, 95),
    record: { w: 0, l: 0, otl: 0, gf: 0, ga: 0, streak: 0 },
    finance: { balance: 0, season: HD.blankLedger(), last: null, history: [] },
    titles: [], history: [], forSale: false, stakes: {}
  };
  HD.G.teams[team.id] = team;
  var owner = HD.makeOwner(team);
  team.ownerId = owner.id;
  team.finance.balance = Math.round(HD.randFloat(5, 40) * 1e6 * (0.5 + f.market / 10));
  var coach = HD.makeStaff('coach', HD.randInt(6, 13), team.id);
  team.coachId = coach.id;
  var gm = HD.makeStaff('gm', HD.randInt(6, 13), team.id);
  team.gmId = gm.id;
  HD.makeTeamRoster(team, quality);
  // Clubs start between ~80% and ~95% of the cap depending on how much the market can afford
  var target = HD.G.league.cap * (0.78 + f.market * 0.017);
  var pay = HD.payroll(team);
  if (pay > target) HD.rosterPlayers(team).forEach(function (p) { p.contract.salary = Math.max(750000, Math.round(p.contract.salary * target / pay / 50000) * 50000); });
  return team;
};

HD.blankLedger = function () {
  return { tickets: 0, concessions: 0, sponsors: 0, tv: 0, playoffs: 0, payroll: 0, staff: 0, facilities: 0, other: 0, capex: 0 };
};

HD.generateWorld = function (setup) {
  var G = HD.G;
  G.league = { cap: 82000000, floor: 60000000, tvDeal: 1100000, history: [], records: {} };
  HD.FRANCHISES.forEach(function (f) { HD.makeFranchise(f); });

  // Rivalries between franchises (geography / history)
  var pairs = [['TOR', 'MTL'], ['BOS', 'MTL'], ['NYH', 'BOS'], ['CHI', 'DET'], ['CGY', 'VAN'], ['SEA', 'VAN'], ['QUE', 'MTL'], ['HAM', 'TOR'], ['PIT', 'NYH'], ['WPG', 'MIN'], ['DEN', 'MIN'], ['HFD', 'BOS']];
  pairs.forEach(function (p) { G.teams[p[0]].rivalId = G.teams[p[0]].rivalId || p[1]; G.teams[p[1]].rivalId = G.teams[p[1]].rivalId || p[0]; });

  var comm = HD.makePerson({ role: 'commissioner', age: 61, genericName: true });
  comm.skills = { diplomacy: 15, tactics: 5, finance: 14, scouting: 4, intrigue: 13 };
  comm.wealth = 80000000;
  G.commissionerId = comm.id;

  G.journalists = [];
  HD.OUTLETS.forEach(function (o) {
    var j = HD.makePerson({ role: 'journalist', age: HD.randInt(26, 62), gender: HD.chance(0.4) ? 'f' : 'm' });
    j.outlet = o; j.wealth = HD.randInt(1, 4) * 100000;
    j.reach = HD.randInt(3, 10);
    G.journalists.push(j.id);
  });

  G.agents = [];
  for (var a = 0; a < 7; a++) {
    var ag = HD.makePerson({ role: 'agent', age: HD.randInt(32, 64), gender: HD.chance(0.25) ? 'f' : 'm', genericName: HD.chance(0.5) });
    ag.wealth = HD.randInt(5, 60) * 1000000;
    ag.agency = HD.pick(['Apex', 'Blueline', 'Crease', 'Northstar', 'Summit', 'Titan', 'Vanguard', 'Iron Gate']) + ' Sports Management';
    ag.skills = { diplomacy: HD.randInt(8, 16), finance: HD.randInt(8, 16), intrigue: HD.randInt(5, 16), tactics: 3, scouting: HD.randInt(4, 10) };
    G.agents.push(ag.id);
  }

  // Free-agent pool
  G.freeAgents = [];
  for (var i = 0; i < 26; i++) {
    var pos = HD.pick(['C', 'LW', 'RW', 'D', 'D', 'G']);
    var fa = HD.makePlayer(pos, HD.randInt(55, 68), HD.randInt(22, 35));
    fa.contract = null;
    G.freeAgents.push(fa.id);
  }

  // Assign agents to all players
  Object.keys(G.people).forEach(function (id) {
    var p = G.people[id];
    if (p.role === 'player') HD.assignAgent(p);
  });

  // Player's manager
  var bg = HD.BACKGROUNDS.filter(function (b) { return b.id === setup.background; })[0] || HD.BACKGROUNDS[0];
  var team = G.teams[setup.teamId];
  var oldGm = G.people[team.gmId];
  oldGm.teamId = null; oldGm.role = 'gm'; oldGm.unemployed = true;
  G.unemployedGMs = [oldGm.id];
  var me = HD.makePerson({
    role: 'manager', teamId: team.id, first: setup.first || 'Alex', last: setup.last || 'Mercer', gender: setup.gender || 'm',
    age: setup.age || 41, nation: setup.nation || 'CAN',
    traits: [bg.trait].concat(setup.traits || []).filter(function (t, i, arr) { return arr.indexOf(t) === i; }),
    wealth: bg.wealth, prestige: bg.prestige
  });
  me.skills = Object.assign({}, bg.skills);
  me.background = bg.id;
  me.stress = 10; me.health = 100;
  me.xp = { diplomacy: 0, tactics: 0, finance: 0, scouting: 0, intrigue: 0 };
  me.focus = 'diplomacy';
  me.contract = { salary: 1500000 + bg.prestige * 10000, years: 3 };
  me.assets = []; me.businesses = []; me.stocks = {}; me.stakes = 0;
  me.career = { seasons: 0, wins: 0, losses: 0, titles: 0, playoffs: 0, teams: [team.id] };
  me.earnings = { salary: 0, bonus: 0, invest: 0, spent: 0 };
  team.gmId = me.id;
  G.playerId = me.id;

  if (setup.married) {
    var sp = HD.makePerson({ role: 'spouse', gender: me.gender === 'm' ? 'f' : 'm', age: me.age + HD.randInt(-4, 3), nation: me.nation, last: me.last });
    if (sp.gender === 'm') sp.first = HD.pick(HD.NATIONS[sp.nation].first);
    HD.setRelation(me.id, sp.id, 'spouse');
    HD.addOpinion(sp.id, me.id, 'married', 'Married', 40, -1);
    me.spouseId = sp.id;
    var kids = HD.randInt(0, 3);
    me.childIds = [];
    for (var k = 0; k < kids; k++) {
      var kg = HD.chance(0.5) ? 'm' : 'f';
      var kid = HD.makePerson({ role: 'child', gender: kg, age: HD.randInt(3, 16), nation: me.nation, last: me.last, traits: HD.rollTraits(1) });
      HD.setRelation(me.id, kid.id, 'child');
      HD.addOpinion(kid.id, me.id, 'parent', 'Parent', 50, -1);
      me.childIds.push(kid.id);
    }
  }

  // Seed some pre-existing relationships so the world isn't blank
  HD.seedRelationships();

  // Initial stock market
  G.stocks = HD.COMPANIES.map(function (c) { return { id: c.id, price: c.price, hist: [c.price] }; });

  Object.keys(G.teams).forEach(function (tid) { HD.autoLines(G.teams[tid]); });
};

HD.assignAgent = function (p) {
  var ag = HD.weightedPick(HD.G.agents, function (id) { return 1 + (p.ovr > 80 ? HD.G.people[id].skills.diplomacy : 5); });
  p.agentId = ag;
  HD.G.people[ag].clients = HD.G.people[ag].clients || [];
  HD.G.people[ag].clients.push(p.id);
};

HD.seedRelationships = function () {
  var G = HD.G;
  var me = HD.me();
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid];
    // Teammate friendships and feuds
    for (var i = 0; i < 4; i++) {
      var a = HD.pick(t.roster), b = HD.pick(t.roster);
      if (a !== b && !HD.relation(a, b)) HD.setRelation(a, b, HD.chance(0.75) ? 'friend' : 'rival');
    }
  });
  // GM rivalries across the league
  var gms = Object.keys(G.teams).map(function (tid) { return G.teams[tid].gmId; }).filter(function (id) { return id !== me.id; });
  for (var r = 0; r < 3; r++) {
    var x = HD.pick(gms), y = HD.pick(gms);
    if (x !== y) HD.setRelation(x, y, HD.chance(0.5) ? 'friend' : 'rival');
  }
  // Background-flavoured starting relationships for the player
  var rivalGm = HD.pick(gms);
  HD.setRelation(me.id, rivalGm, 'rival');
  HD.addOpinion(rivalGm, me.id, 'old_feud', 'Old Feud', -25, -1);
  var friendGm = HD.pick(gms.filter(function (g) { return g !== rivalGm; }));
  HD.setRelation(me.id, friendGm, 'friend');
  var j = HD.pick(G.journalists);
  HD.addOpinion(j, me.id, 'old_source', 'Old Source', 20, -1);
  if (me.background === 'agent') {
    G.agents.forEach(function (ag) { HD.addOpinion(ag, me.id, 'ex_colleague', 'Former Rival Agent', HD.pick([-20, -10, 10, 25]), -1); });
  }
  if (me.background === 'explayer') {
    HD.myTeam().roster.forEach(function (pid) { HD.addOpinion(pid, me.id, 'idol', 'Grew Up Watching You', HD.randInt(5, 20), -1); });
  }
};
