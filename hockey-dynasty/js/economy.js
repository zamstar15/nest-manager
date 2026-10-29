// League & personal economy. All annual figures are paid out over CAL.YEAR_WEEKS weeks.
var HD = HD || {};

HD.capacity = function (t) { return 15500 + t.facilities.arena * 1200; };
HD.fairPrice = function (t) { return Math.round(48 + t.market * 7 + t.hype * 0.35); };

HD.attendance = function (t, price) {
  price = price === undefined ? t.ticketPrice : price;
  var fair = HD.fairPrice(t);
  var f = 0.48 + t.hype / 160 + t.market / 45 - (price - fair) / (fair * 1.4);
  return Math.round(HD.capacity(t) * HD.clamp(f, 0.25, 1));
};

HD.homeGateRevenue = function (t, mult) {
  var att = HD.attendance(t);
  var tickets = att * t.ticketPrice * (mult || 1);
  var conc = att * (20 + t.facilities.arena * 4) * (0.7 + t.hype / 200);
  return { att: att, tickets: tickets, concessions: conc };
};

HD.playoffGate = function (homeId) {
  var t = HD.G.teams[homeId];
  var r = HD.homeGateRevenue(t, 1.7);
  t.finance.season.playoffs += r.tickets + r.concessions;
  t.finance.balance += r.tickets + r.concessions;
};

HD.payroll = function (t) {
  return HD.sum(t.roster, function (id) { var p = HD.G.people[id]; return p.contract ? p.contract.salary : 0; });
};
HD.capSpace = function (t) { return HD.G.league.cap - HD.payroll(t); };

HD.annualSponsors = function (t) { return (8e6 + t.market * 3.6e6) * (0.55 + t.hype / 120); };
HD.annualOps = function (t) { return 38e6 + t.market * 3e6; }; // arena ops, travel, admin, hockey ops

HD.weeklyFinances = function (results) {
  var G = HD.G, W = HD.CAL.YEAR_WEEKS;
  var homeGames = {};
  results.forEach(function (r) { homeGames[r.h] = (homeGames[r.h] || 0) + 1; });
  Object.keys(G.teams).forEach(function (id) {
    var t = G.teams[id], L = t.finance.season;
    var inc = 0, exp = 0;
    var hg = homeGames[id] || 0;
    if (hg) {
      var gate = HD.homeGateRevenue(t);
      L.tickets += gate.tickets * hg; L.concessions += gate.concessions * hg;
      inc += (gate.tickets + gate.concessions) * hg;
      t.lastAttendance = gate.att;
    }
    var spons = HD.annualSponsors(t) / W; L.sponsors += spons; inc += spons;
    var tv = G.league.tvDeal * 30 / W; L.tv += tv; inc += tv;
    var pay = HD.payroll(t) / W; L.payroll += pay; exp += pay;
    var staff = (HD.annualOps(t) + HD.staffSalaries(t)) / W; L.staff += staff; exp += staff;
    var fac = HD.sum(Object.keys(t.facilities), function (k) { return HD.FACILITY_UPKEEP[t.facilities[k]]; });
    L.facilities += fac; exp += fac;
    t.finance.balance += inc - exp;
    t.finance.lastWeek = { inc: inc, exp: exp };
  });
};

HD.staffSalaries = function (t) {
  var c = HD.G.people[t.coachId], g = HD.G.people[t.gmId];
  return (c && c.contract ? c.contract.salary : 0) + (g && g.contract ? g.contract.salary : 0);
};

HD.seasonProfit = function (t) {
  var L = t.finance.season;
  return L.tickets + L.concessions + L.sponsors + L.tv + L.playoffs - L.payroll - L.staff - L.facilities - L.other;
};
HD.seasonRevenue = function (L) { return L.tickets + L.concessions + L.sponsors + L.tv + L.playoffs; };

HD.teamValue = function (t) {
  var rev = t.finance.last ? HD.seasonRevenue(t.finance.last) : 90e6 + t.market * 9e6;
  return Math.round((rev * 1.6 + t.market * 18e6 + t.hype * 0.8e6 + t.titles.length * 12e6 + HD.sum(Object.keys(t.facilities), function (k) { return t.facilities[k]; }) * 6e6) / 1e6) * 1e6;
};

// Owners react to the books: bailouts, cost-cutting demands, selling the club.
HD.ownerFinanceCheck = function () {
  var G = HD.G;
  Object.keys(G.teams).forEach(function (id) {
    var t = G.teams[id], o = G.people[t.ownerId];
    if (t.finance.balance < -35e6) {
      if (o.wealth > 400e6 && !HD.chance(o.traits.indexOf('greedy') >= 0 ? 0.6 : 0.15)) {
        var amt = 40e6;
        o.wealth -= amt; t.finance.balance += amt;
        HD.news(o.first + ' ' + o.last + ' injects ' + HD.money(amt) + ' of personal money to keep the ' + t.name + ' solvent.', 'money', t.id);
        if (t.id === HD.me().teamId) HD.addOpinion(o.id, G.playerId, 'bailout', 'Had To Bail Out The Team', -20, 30);
      } else if (!t.forSale) {
        t.forSale = true;
        HD.news('BREAKING: ' + HD.fullName(o) + ' has quietly put the ' + HD.teamName(t) + ' up for sale.', 'money', t.id, true);
      }
    }
    if (!t.forSale && o.age > 76 && HD.chance(0.01)) {
      t.forSale = true;
      HD.news('Ageing owner ' + HD.fullName(o) + ' is exploring a sale of the ' + t.name + '.', 'money', t.id);
    }
  });
};

// A for-sale team eventually finds a buyer if the player doesn't step in.
HD.processTeamSales = function () {
  var G = HD.G, me = HD.me();
  Object.keys(G.teams).forEach(function (id) {
    var t = G.teams[id];
    if (!t.forSale || !HD.chance(0.05)) return;
    if (t.id === me.teamId && me.stakes >= 50) return;
    var old = G.people[t.ownerId];
    var buyer = HD.makeOwner(t);
    buyer.wealth += HD.teamValue(t);
    old.teamId = null; old.role = 'former owner';
    t.ownerId = buyer.id; t.forSale = false;
    t.finance.balance = Math.max(t.finance.balance, 0) + HD.randInt(10, 40) * 1e6;
    HD.news(HD.fullName(buyer) + ', who made a fortune in ' + buyer.business + ', completes purchase of the ' + HD.teamName(t) + ' for ' + HD.money(HD.teamValue(t)) + '.', 'money', t.id, true);
    if (t.id === me.teamId) {
      HD.addOpinion(buyer.id, me.id, 'inherited', 'Inherited GM', -5, 20);
      HD.chronicle('New owner ' + HD.fullName(buyer) + ' bought the ' + t.name + '. Your job security starts from scratch.');
      me.stakes = 0;
      if (t.stakes) t.stakes = {};
    }
  });
};

// ---------- Personal finances ----------
HD.weeklyPersonal = function () {
  var G = HD.G, me = HD.me(), W = HD.CAL.YEAR_WEEKS;
  if (me.contract && me.teamId) {
    var sal = me.contract.salary / W;
    me.wealth += sal; me.earnings.salary += sal;
  }
  var upkeep = HD.sum(me.assets, function (a) { var d = HD.assetDef(a); return d ? d.upkeep : 0; });
  if (me.spouseId) upkeep += 3000 + (me.childIds || []).length * 1500;
  me.wealth -= upkeep; me.earnings.spent += upkeep;
  var team = HD.myTeam();
  me.businesses.forEach(function (b) {
    var d = HD.BUSINESSES.filter(function (x) { return x.id === b.id; })[0];
    var factor = 1 + HD.gauss(0, d.vol);
    if (d.hype && team) factor *= 0.5 + team.hype / 80;
    var inc = Math.round(b.value * d.yield * factor * (1 + (me.skills.finance - 8) * 0.02));
    b.lastIncome = inc; b.total = (b.total || 0) + inc;
    me.wealth += inc; me.earnings.invest += inc;
    var drift = d.id === 'realty' && team ? (team.hype - 50) / 40000 : 0;
    if (d.id === 'gear') drift = HD.gauss(0.0005, 0.02);
    b.value = Math.max(d.cost * 0.2, Math.round(b.value * (1 + drift + HD.gauss(0.0004, 0.004))));
  });
  if (me.wealth < 0) {
    HD.addStress(3);
    if (!G.flags.broke) { G.flags.broke = true; HD.chronicle('You are in personal debt. Creditors are calling, and the press will smell it soon.'); }
  } else G.flags.broke = false;
};

HD.assetDef = function (id) { return HD.ASSETS.filter(function (a) { return a.id === id; })[0]; };

HD.updateStocks = function () {
  var G = HD.G;
  var leagueHype = HD.avg(Object.keys(G.teams), function (id) { return G.teams[id].hype; });
  G.stocks.forEach(function (s) {
    var c = HD.COMPANIES.filter(function (x) { return x.id === s.id; })[0];
    var drift = c.drift + G.marketMood;
    if (c.sector === 'media') drift += (leagueHype - 55) / 6000;
    s.price = Math.max(0.5, s.price * Math.exp(drift + HD.gauss(0, c.vol)));
    s.hist.push(HD.round(s.price, 2));
    if (s.hist.length > 64) s.hist.shift();
  });
  // Macro mood swings
  if (HD.chance(0.04)) {
    G.marketMood = HD.pick([-0.012, -0.006, 0.004, 0.008]);
    HD.news(G.marketMood < 0 ? 'Markets slide as recession fears grip investors.' : 'Markets rally on strong economic data.', 'money');
  } else G.marketMood *= 0.85;
  if (HD.chance(0.05)) {
    var s = HD.pick(G.stocks), c2 = HD.COMPANIES.filter(function (x) { return x.id === s.id; })[0];
    var up = HD.chance(0.55), mag = HD.randFloat(0.08, 0.25);
    s.price *= up ? 1 + mag : 1 - mag;
    var stories = up ? ['posts blowout quarterly earnings', 'lands a major new contract', 'announces surprise buyback', 'is rumoured as a takeover target']
                     : ['misses earnings badly', 'faces a regulatory probe', 'CEO resigns amid scandal', 'issues profit warning'];
    HD.news(c2.name + ' (' + c2.id + ') ' + HD.pick(stories) + ' — shares ' + (up ? 'jump ' : 'drop ') + Math.round(mag * 100) + '%.', 'money');
  }
  if (G.week % 8 === 0) {
    var me = HD.me();
    HD.COMPANIES.forEach(function (c) {
      if (!c.dividend || !me.stocks[c.id]) return;
      var st = G.stocks.filter(function (x) { return x.id === c.id; })[0];
      var div = me.stocks[c.id].shares * st.price * c.dividend;
      me.wealth += div; me.earnings.invest += div;
    });
  }
};

HD.portfolioValue = function (me) {
  var v = 0;
  HD.G.stocks.forEach(function (s) { if (me.stocks[s.id]) v += me.stocks[s.id].shares * s.price; });
  return v;
};
HD.netWorth = function (me) {
  var v = me.wealth + HD.portfolioValue(me);
  me.assets.forEach(function (a) { var d = HD.assetDef(a); if (d) v += d.cost * 0.7; });
  me.businesses.forEach(function (b) { v += b.value; });
  var t = HD.myTeam();
  if (t && me.stakes) v += HD.teamValue(t) * me.stakes / 100;
  return v;
};

HD.addStress = function (n) {
  var me = HD.me();
  if (n > 0 && me.traits.indexOf('calm') >= 0) n *= 0.6;
  if (n > 0 && me.traits.indexOf('hotheaded') >= 0) n *= 1.25;
  me.stress = HD.clamp(me.stress + n, 0, 100);
};

// Season rollover for the books: owner profit share, cap growth, ledger archive.
HD.closeBooks = function () {
  var G = HD.G, me = HD.me();
  var revs = [];
  Object.keys(G.teams).forEach(function (id) {
    var t = G.teams[id];
    // Clubs under the payroll floor pay the shortfall to the players' pool
    var short = G.league.floor - HD.payroll(t);
    if (short > 0) {
      t.finance.balance -= short; t.finance.season.other += short;
      if (t.id === me.teamId) HD.chronicle('Your payroll was under the league floor. The club paid a ' + HD.money(short) + ' shortfall to the players\' pool.');
    }
    var profit = HD.seasonProfit(t);
    t.finance.history.push({ season: G.season, rev: HD.seasonRevenue(t.finance.season), profit: profit, payroll: t.finance.season.payroll });
    if (t.finance.history.length > 12) t.finance.history.shift();
    t.finance.last = t.finance.season;
    t.finance.season = HD.blankLedger();
    revs.push(HD.seasonRevenue(t.finance.last));
    // Owners skim profits
    if (t.finance.balance > 30e6) {
      var skim = (t.finance.balance - 30e6) * 0.5;
      t.finance.balance -= skim;
      G.people[t.ownerId].wealth += skim;
      if (t.id === me.teamId && me.stakes > 0) {
        var div = skim * me.stakes / 100;
        me.wealth += div; me.earnings.invest += div;
        HD.chronicle('Shareholder dividend from the ' + t.name + ': ' + HD.money(div) + '.');
      }
    }
  });
  var avgRev = HD.avg(revs);
  var newCap = Math.round(avgRev * 0.52 / 1e5) * 1e5;
  var old = G.league.cap;
  G.league.cap = HD.clamp(newCap, old * 0.97, old * 1.06);
  G.league.floor = Math.round(G.league.cap * 0.73);
  G.league.tvDeal *= 1.02;
  HD.news('The league sets next season\'s salary cap at ' + HD.money(G.league.cap, true) + ' (' + (G.league.cap >= old ? '+' : '') + ((G.league.cap / old - 1) * 100).toFixed(1) + '%).', 'league', null, true);
};
