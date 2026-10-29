// Headless soak test: plays N seasons with random event choices and reports
// balance stats. Usage: node tools/sim-test.js [seasons]
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = { console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date };
vm.createContext(ctx);
['util', 'data', 'world', 'opinion', 'sim', 'economy', 'market', 'ai', 'events', 'interactions', 'game'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
});
var HD = ctx.HD;
var seasons = +process.argv[2] || 4;
HD.newGame({ teamId: 'HAM', background: 'analyst', first: 'Test', last: 'Pilot', married: true, traits: ['ambitious'] });

var goals = 0, games = 0, evCount = {}, fired = 0;
function resolveEvents() {
  var guard = 0;
  while (HD.G.pendingEvents.length && guard++ < 20) {
    var ev = HD.G.pendingEvents.shift();
    var v = HD.EVENTS[ev.id].view(ev.ctx);
    var opts = v.options.filter(function (o) { return !o.disabled; });
    var o = opts[Math.floor(Math.random() * opts.length)];
    evCount[ev.id] = (evCount[ev.id] || 0) + 1;
    if (ev.id === 'fired') fired++;
    o.act(ev.ctx);
  }
}
// Exercise interactions & UI-ish actions every so often
function poke() {
  var me = HD.me(); if (!me.teamId) return;
  var ids = Object.keys(HD.G.people);
  for (var i = 0; i < 3; i++) {
    var p = HD.G.people[ids[Math.floor(Math.random() * ids.length)]];
    HD.interactions(p).forEach(function (it) { if (!it.disabled && it.act && Math.random() < 0.15) { if (it.cd) HD.setCd(p, it.cd[0]); it.act(); } });
  }
}

// Every rostered player must belong to exactly one team; free agents to none.
var violations = 0;
function checkInvariants(where) {
  var seen = {};
  Object.keys(HD.G.teams).forEach(function (t) {
    HD.G.teams[t].roster.forEach(function (id) {
      var p = HD.G.people[id];
      if (!p || p.teamId !== t || seen[id] || p.retired) {
        if (violations++ < 5) console.log('ROSTER INVARIANT @' + where, HD.G.season, HD.G.week, t, id, p && p.teamId, seen[id], p && p.retired, p && JSON.stringify(p.log.slice(0, 3)));
      }
      seen[id] = t;
    });
  });
  HD.G.freeAgents.forEach(function (id) {
    var p = HD.G.people[id];
    if (!p || p.teamId || seen[id] || p.retired) { if (violations++ < 5) console.log('FA INVARIANT @' + where, id, p && p.teamId, seen[id], p && JSON.stringify(p.log.slice(0, 3))); }
  });
}

var startWealth = HD.me().wealth;
var total = seasons * HD.CAL.YEAR_WEEKS;
for (var w = 0; w < total; w++) {
  resolveEvents();
  checkInvariants('events');
  poke();
  checkInvariants('poke');
  var r = HD.advanceWeek();
  if (!r) { resolveEvents(); r = HD.advanceWeek(); }
  checkInvariants('week');
  if (HD.G.gameOver) { console.log('GAME OVER:', HD.G.gameOver.reason); break; }
  if (r && r.phase === 'regular') HD.G.schedule.filter(function (g) { return g.wk === r.week; }).forEach(function (g) { goals += g.hs + g.as; games++; });
  if (r && r.week === HD.CAL.AWARDS) {
    var st = HD.standings();
    var h = HD.G.league.history[0];
    console.log('\n=== Season ' + h.season + ' === champion:', h.champion, '| MVP:', HD.fullName(HD.G.people[h.mvp]), '| cap', HD.money(HD.G.league.cap, true));
    console.log('Top: ' + st.slice(0, 4).map(function (t) { return t.id + ' ' + HD.points(t); }).join(', ') + ' | Bottom: ' + st.slice(-3).map(function (t) { return t.id + ' ' + HD.points(t); }).join(', '));
    st.forEach(function (t) {
      var L = t.finance.last;
      if (['TOR', 'HAM', 'HFD', 'NYH'].indexOf(t.id) >= 0) console.log('  ' + t.id + ' rev ' + HD.money(HD.seasonRevenue(L)) + ' profit ' + HD.money(t.finance.history[t.finance.history.length-1].profit) + ' bal ' + HD.money(t.finance.balance) + ' payroll ' + HD.money(HD.payroll(t)) + ' hype ' + Math.round(t.hype) + ' att ' + t.lastAttendance + ' value ' + HD.money(HD.teamValue(t)) + ' roster ' + t.roster.length);
    });
    var me = HD.me();
    console.log('  ME team', me.teamId, 'wealth', HD.money(me.wealth), 'net', HD.money(HD.netWorth(me)), 'prestige', Math.round(me.prestige), 'stress', Math.round(me.stress), 'owner op', me.teamId ? HD.opinion(HD.myTeam().ownerId, me.id) : '-');
  }
}
var me = HD.me();
console.log('\nGoals/game:', (goals / Math.max(1, games)).toFixed(2), 'games', games);
console.log('Events fired:', JSON.stringify(evCount));
console.log('Fired count:', fired, 'People:', Object.keys(HD.G.people).length, 'FA pool:', HD.G.freeAgents.length);
console.log('Save size KB:', Math.round(JSON.stringify(HD.G).length / 1024));
var rosterSizes = Object.keys(HD.G.teams).map(function (id) { return HD.G.teams[id].roster.length; });
console.log('Roster sizes:', rosterSizes.join(','));
console.log('Over cap:', Object.keys(HD.G.teams).filter(function (id) { return HD.capSpace(HD.G.teams[id]) < 0; }).map(function (id) { return id + ' ' + HD.money(HD.capSpace(HD.G.teams[id])); }).join(', ') || 'none');
console.log('News sample:'); HD.G.news.slice(0, 12).forEach(function (n) { console.log('  -', n.t); });
