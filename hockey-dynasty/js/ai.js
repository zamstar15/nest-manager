// The living world: things that happen whether or not the player is involved.
var HD = HD || {};

HD.updateMorale = function () {
  var G = HD.G, me = HD.me();
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid];
    var pct = HD.teamPct(t); if (pct === null) pct = 0.5;
    HD.rosterPlayers(t).forEach(function (p) {
      var target = 58 + (pct - 0.5) * 35;
      if (t.gmId === me.id) target += HD.opinion(p.id, me.id) * 0.3;
      else target += (HD.expectedSlotRank(p, t) - HD.slotRank(p)) * 4;
      if (p.injury > 0) target -= 8;
      if (p.traits.indexOf('content') >= 0) target += 6;
      p.morale = HD.clamp(Math.round(p.morale + (target - p.morale) * 0.25), 0, 100);
      p.form *= 0.75;
    });
  });
};

HD.healInjuries = function () {
  var G = HD.G;
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid], changed = false;
    HD.rosterPlayers(t).forEach(function (p) {
      if (p.injury > 0) {
        p.injury--;
        if (p.injury === 0) {
          changed = true;
          if (p.formerSlot && t.gmId === G.playerId) { HD.chronicle(HD.fullName(p) + ' is healthy again.'); }
        }
      }
    });
    if (changed && t.gmId !== G.playerId) HD.autoLines(t);
  });
};

// Coach firings in-season, GM firings at season end.
HD.aiStaffChanges = function () {
  var G = HD.G;
  if (G.phase !== 'regular' || G.week < 9) return;
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid];
    if (t.gmId === G.playerId) return;
    var pct = HD.teamPct(t);
    if (pct === null || pct > 0.42 || t.record.streak > -4) return;
    var owner = G.people[t.ownerId];
    if (HD.chance(0.12 + (100 - owner.patience) / 400)) HD.replaceCoach(t, 'fired');
  });
};

HD.coachPool = function () {
  var G = HD.G;
  G.coachPool = (G.coachPool || []).filter(function (id) { var p = G.people[id]; return p && p.alive && !p.teamId; });
  while (G.coachPool.length < 5) {
    var c = HD.makeStaff('coach', HD.randInt(5, 14), null);
    G.coachPool.push(c.id);
  }
  return G.coachPool;
};

HD.replaceCoach = function (t, reason, newId) {
  var G = HD.G;
  var old = G.people[t.coachId];
  var pool = HD.coachPool();
  var nc = newId ? G.people[newId] : G.people[HD.sortBy(pool, function (id) { return G.people[id].skills.tactics + HD.randInt(0, 4); }, true)[0]];
  if (old) {
    old.teamId = null;
    HD.addLog(old, (reason === 'fired' ? 'Fired' : 'Left') + ' as head coach of the ' + HD.teamName(t) + '.');
    G.coachPool.push(old.id);
  }
  G.coachPool = G.coachPool.filter(function (id) { return id !== nc.id; });
  nc.teamId = t.id; nc.role = 'coach';
  nc.contract = { salary: 1000000 + nc.skills.tactics * 150000, years: HD.randInt(2, 4) };
  t.coachId = nc.id;
  HD.addLog(nc, 'Hired as head coach of the ' + HD.teamName(t) + '.');
  if (reason === 'fired') HD.news('The ' + t.name + ' have fired head coach ' + HD.fullName(old) + ' (' + t.record.w + '-' + t.record.l + '-' + t.record.otl + '). ' + HD.fullName(nc) + ' takes over.', 'staff', t.id, true);
  return nc;
};

HD.aiGmReviews = function () {
  var G = HD.G;
  var standings = HD.standings();
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid];
    if (t.gmId === G.playerId) return;
    var rank = standings.indexOf(t);
    var owner = G.people[t.ownerId];
    var expRank = 16 - t.market; // big markets expect more
    var bad = rank - expRank + (t.gmHeat || 0) * 10;
    if ((rank >= 10 || (t.gmHeat || 0) > 0.5) && bad > 2 && HD.chance(0.25 + (100 - owner.patience) / 250)) {
      var old = G.people[t.gmId];
      old.teamId = null; old.unemployed = true;
      G.unemployedGMs = G.unemployedGMs || [];
      G.unemployedGMs.push(old.id);
      HD.addLog(old, 'Fired as GM of the ' + HD.teamName(t) + '.');
      t.gmVacant = true;
      HD.news(HD.fullName(owner) + ' fires ' + t.name + ' GM ' + HD.fullName(old) + ' after a ' + HD.ordinal(rank + 1) + '-place finish.', 'staff', t.id, true);
    }
  });
};

HD.fillGmVacancies = function () {
  var G = HD.G;
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid];
    if (!t.gmVacant) return;
    var pool = (G.unemployedGMs || []).filter(function (id) { return G.people[id] && G.people[id].teamId === null && G.people[id].formerTeamFired !== tid; });
    var gm = pool.length && HD.chance(0.5) ? G.people[HD.pick(pool)] : HD.makeStaff('gm', HD.randInt(6, 14), null);
    G.unemployedGMs = (G.unemployedGMs || []).filter(function (id) { return id !== gm.id; });
    gm.teamId = t.id; gm.role = 'gm'; gm.unemployed = false;
    gm.contract = { salary: 1200000 + gm.skills.diplomacy * 100000, years: 3 };
    t.gmId = gm.id; t.gmVacant = false;
    HD.addLog(gm, 'Hired as GM of the ' + HD.teamName(t) + '.');
    HD.news('The ' + t.name + ' name ' + HD.fullName(gm) + ' their new General Manager.', 'staff', t.id);
  });
};

HD.ordinal = function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// Off-ice lives of players, owners and staff.
HD.lifeEvents = function () {
  var G = HD.G, me = HD.me();
  var all = [];
  Object.keys(G.teams).forEach(function (tid) { all = all.concat(G.teams[tid].roster); });
  for (var i = 0; i < 3; i++) {
    var p = G.people[HD.pick(all)];
    if (!p || !p.teamId) continue;
    var t = G.teams[p.teamId], mine = t.gmId === me.id;
    var roll = Math.random();
    if (roll < 0.12 && p.age >= 23 && !p.married) {
      p.married = true;
      HD.addLog(p, 'Got married.');
      HD.news(HD.fullName(p) + ' (' + t.name + ') ties the knot in an off-day ceremony.', 'social', t.id);
      if (mine && HD.chance(0.6)) G.flags.weddingInvite = p.id;
    } else if (roll < 0.22 && p.married) {
      HD.addLog(p, 'Became a parent.');
      HD.news(HD.fullName(p) + ' and their partner welcome a baby. The ' + t.name + ' star will miss a game.', 'social', t.id);
      p.morale = HD.clamp(p.morale + 10, 0, 100);
    } else if (roll < 0.34 && p.traits.indexOf('party_animal') >= 0) {
      HD.addLog(p, 'Photographed at a nightclub at 4am before a game.');
      HD.news('Photos surface of ' + HD.fullName(p) + ' partying until 4am before a ' + t.name + ' game.', 'scandal', t.id);
      t.hype = HD.clamp(t.hype - 1, 0, 100);
      if (mine) G.flags.partyScandal = p.id;
    } else if (roll < 0.44 && p.traits.indexOf('media_darling') >= 0) {
      var deal = HD.pick(['IceTech', 'Frostbite Energy', 'a national bank', 'a car brand', 'a cereal company']);
      p.wealth += 500000;
      HD.news(HD.fullName(p) + ' lands an endorsement deal with ' + deal + '.', 'money', t.id);
      t.hype = HD.clamp(t.hype + 1, 0, 100);
    } else if (roll < 0.52) {
      HD.news(HD.fullName(p) + ' spends the off-day visiting a children\'s hospital in ' + t.city + '.', 'social', t.id);
      t.hype = HD.clamp(t.hype + 0.5, 0, 100);
    } else if (roll < 0.57 && p.traits.indexOf('hotheaded') >= 0) {
      HD.news(HD.fullName(p) + ' fined by the league for a post-game outburst at officials.', 'scandal', t.id);
      p.wealth -= 10000;
    }
  }
};

HD.mortality = function () {
  var G = HD.G, me = HD.me();
  Object.keys(G.teams).forEach(function (tid) {
    var t = G.teams[tid], o = G.people[t.ownerId];
    if (o.age < 68 || !HD.chance((o.age - 66) * 0.0007)) return;
    o.alive = false; o.teamId = null;
    var heir = HD.makePerson({ role: 'owner', teamId: t.id, age: HD.randInt(28, 50), last: o.last, nation: o.nation, gender: HD.chance(0.45) ? 'f' : 'm', genericName: false });
    heir.last = o.last; heir.wealth = o.wealth * 0.8; heir.patience = HD.randInt(20, 70); heir.business = o.business;
    HD.setRelation(heir.id, o.id, 'child');
    t.ownerId = heir.id;
    HD.news('Long-time ' + t.name + ' owner ' + HD.fullName(o) + ' has died at ' + o.age + '. Control passes to ' + (heir.gender === 'f' ? 'daughter ' : 'son ') + HD.fullName(heir) + '.', 'league', t.id, true);
    if (t.id === me.teamId) {
      var op = HD.opinion(o.id, me.id);
      HD.addOpinion(heir.id, me.id, 'fathers_man', op > 20 ? 'Parent Trusted You' : 'Parent\'s Hire', op > 20 ? 20 : -10, 52);
      HD.chronicle('Your owner, ' + HD.fullName(o) + ', has died. ' + HD.fullName(heir) + ' now holds your fate.');
      G.flags.newOwner = heir.id;
    }
  });
};

// Journalists write about the player's club, shaping hype and owner mood.
HD.pressCoverage = function () {
  var G = HD.G, me = HD.me(), t = HD.myTeam();
  if (!t || !HD.chance(0.45)) return;
  var j = G.people[HD.pick(G.journalists)];
  var op = HD.opinion(j.id, me.id);
  var pct = HD.teamPct(t);
  var mood = (op / 40) + (pct === null ? 0 : (pct - 0.5) * 6) + t.record.streak * 0.25 + HD.gauss(0, 1);
  var o = G.people[t.ownerId];
  var headline;
  if (mood > 1.2) {
    headline = HD.pick(['"{last} has built something special in {city}"', '"In {last} we trust: the {name} are for real"', '"The smartest GM in hockey? Make the case for {last}"']);
    t.hype = HD.clamp(t.hype + j.reach * 0.25, 0, 100);
    HD.addOpinion(o.id, me.id, 'good_press', 'Glowing Press', 6, 8, { stack: true, max: 15 });
    me.prestige += 0.5;
  } else if (mood < -1.2) {
    headline = HD.pick(['"Is {last} in over their head?"', '"The {name} are rudderless, and it starts at the top"', '"Time for {city} to ask hard questions about {last}"', '"Inside the dysfunction of the {name}"']);
    t.hype = HD.clamp(t.hype - j.reach * 0.25, 0, 100);
    HD.addOpinion(o.id, me.id, 'bad_press', 'Bad Press', -6, 8, { stack: true, max: 20 });
    HD.addStress(2);
  } else return;
  headline = HD.fmt(headline, { last: me.last, city: t.city, name: t.name });
  HD.news(j.outlet + ' (' + HD.fullName(j) + '): ' + headline, 'press', t.id);
};

HD.milestones = function (results) {
  var G = HD.G;
  results.forEach(function (r) {
    r.goals.forEach(function (g) {
      var p = G.people[g.s];
      if (p.stats.g === 50) HD.news(HD.fullName(p) + ' scores goal #50 of the season for the ' + G.teams[g.t].name + '!', 'record', g.t, true);
      var careerG = p.career.g + p.stats.g;
      if (careerG > 0 && careerG % 100 === 0 && !p['mg' + careerG]) { p['mg' + careerG] = true; HD.news(HD.fullName(p) + ' scores career goal #' + careerG + '.', 'record', g.t); }
    });
  });
};

// Commissioner and league-level storylines.
HD.leagueStorylines = function () {
  var G = HD.G;
  if (G.phase !== 'regular' || !HD.chance(0.06)) return;
  var c = G.people[G.commissionerId];
  var stories = [
    'Commissioner ' + HD.fullName(c) + ' floats expansion to Kansas City and Houston. Owners are split on splitting the TV money.',
    'League announces a new streaming partnership; Puck Broadcasting shares move on the news.',
    'Players\' union grumbles about escrow as revenue projections soften.',
    'Commissioner ' + HD.fullName(c) + ' warns teams about "creative" cap accounting.',
    'An outdoor Winter Classic is announced for next season. Host city to be named.',
    'Referee shortage forces the league to fast-track minor-league officials.'
  ];
  HD.news(HD.pick(stories), 'league');
};
