// Page views. Each returns an HTML string for the main panel.
var HD = HD || {};
HD.VIEWS = {};
(function () {
  var U = HD.UI, e = HD.esc;

  function subtabs(page, list) {
    var cur = U.sub[page] || list[0][0];
    return '<div class="tabs">' + list.map(function (t) { return '<a data-act="sub" data-page="' + page + '" data-sub="' + t[0] + '" class="' + (cur === t[0] ? 'on' : '') + '">' + t[1] + '</a>'; }).join('') + '</div>';
  }
  function cur(page, def) { return U.sub[page] || def; }
  function personRow(p, extra) {
    var me = HD.me();
    var rel = HD.relation(me.id, p.id);
    var t = p.teamId && HD.G.teams[p.teamId];
    return '<tr class="clickable" data-act="person" data-id="' + p.id + '"><td><div class="namecell">' + U.portrait(p, 34) + '<div><div>' + e(HD.fullName(p)) + ' ' + U.flag(p) + '</div><div class="help">' + e(HD.ROLE_NAMES[p.role] || p.role) + (t ? ' · ' + e(t.name) : '') + (p.outlet ? ' · ' + e(p.outlet) : '') + '</div></div></div></td>' +
      '<td>' + p.traits.map(function (tr) { var d = HD.TRAITS[tr]; return d ? '<span title="' + e(d.name + ': ' + d.desc) + '">' + d.icon + '</span>' : ''; }).join(' ') + '</td>' +
      '<td>' + U.relChip(rel) + '</td><td class="num">' + (extra || '') + '</td><td class="num">' + U.op(p.id) + '</td></tr>';
  }
  function peopleTable(list, extraFn, extraHead) {
    if (!list.length) return '<div class="empty">Nobody here.</div>';
    return '<div class="tbl-wrap"><table><tr><th>Name</th><th>Traits</th><th>Relation</th><th class="num">' + (extraHead || '') + '</th><th class="num">Opinion</th></tr>' + list.map(function (p) { return personRow(p, extraFn ? extraFn(p) : ''); }).join('') + '</table></div>';
  }
  function newsList(items, limit) {
    var me = HD.me();
    if (!items.length) return '<div class="empty">No news yet.</div>';
    return '<div class="feed">' + items.slice(0, limit || 60).map(function (n) {
      return '<div class="news k-' + n.k + (n.major ? ' major' : '') + (n.team && n.team === me.teamId ? ' mine' : '') + '"><span class="when">' + U.when(n) + '</span>' + e(n.t) + '</div>';
    }).join('') + '</div>';
  }
  function gameLine(r, tid) {
    var G = HD.G;
    var home = r.h === tid, opp = G.teams[home ? r.a : r.h];
    var my = home ? r.hs : r.as, them = home ? r.as : r.hs;
    var won = my > them;
    var scorers = (r.goals || []).filter(function (g) { return g.t === tid; }).map(function (g) { return HD.N(g.s).split(' ').slice(-1)[0]; });
    var counts = {}; scorers.forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
    var sc = Object.keys(counts).map(function (k) { return k + (counts[k] > 1 ? ' (' + counts[k] + ')' : ''); }).join(', ');
    return '<div class="game-line"><span>' + (home ? 'vs ' : '@ ') + U.tlink(opp) + '</span><span class="help">' + e(sc) + '</span><span class="score"><span class="' + (won ? 'w' : 'l') + '">' + (won ? 'W' : r.ot ? 'OTL' : 'L') + '</span> ' + my + '–' + them + (r.ot ? ' <span class="dim" style="font-size:12px">' + r.ot + '</span>' : '') + '</span></div>';
  }
  U.gameLine = gameLine;

  // ================= HOME =================
  HD.VIEWS.home = function () {
    var G = HD.G, me = HD.me(), t = HD.myTeam();
    var phase = HD.phaseOf(G.week);
    var h = '<div class="page-title"><h1>' + (t ? e(HD.teamName(t)) : 'Between Jobs') + '</h1><span class="muted">' + HD.seasonLabel(G.season) + ' · Week ' + G.week + ' of ' + HD.CAL.YEAR_WEEKS + ' · ' + HD.PHASE_NAMES[phase] + '</span></div>';
    if (!t) {
      h += '<div class="panel gilded"><h3>Unemployed</h3><p>You are out of hockey. Owners around the league know your name — keep advancing the calendar and offers may come. Your investments keep working in the meantime.</p><button class="danger" data-act="retire">Retire for good</button></div>';
      h += '<div class="panel" style="margin-top:14px"><h3>League News</h3>' + newsList(G.news, 30) + '</div>';
      return h;
    }
    var o = G.people[t.ownerId];
    h += '<div class="grid g3">';
    // This week
    h += '<div class="panel gilded"><h3>This Week</h3>';
    var mine = (G.schedule || []).filter(function (g) { return g.wk === G.week && (g.h === t.id || g.a === t.id); });
    var phaseHelp = {
      preseason: 'Training camp. Set your lines, sort out contracts, and get to know your people before opening night (week ' + HD.CAL.REG_START + ').',
      playoffs: 'Playoff hockey. Each week plays a full best-of-seven round.',
      awards: 'The season is over. Awards are handed out and your owner will review your performance.',
      draft: 'Entry Draft week. Set your draft board under Transactions → Draft. Picks happen when you continue.',
      resign: 'Contract deadline. Players in the final year who are not extended will hit free agency when you continue.',
      freeagency: 'Free agency! Make offers under Transactions → Free Agents. Players decide at the end of each week. Ends week ' + HD.CAL.FA_END + '.'
    };
    if (mine.length) h += '<div class="help" style="margin-bottom:6px">' + mine.length + ' games this week' + (G.week === HD.CAL.DEADLINE ? ' · <b class="warn">Trade deadline</b>' : '') + '</div>' + mine.map(function (g) { var home = g.h === t.id, opp = G.teams[home ? g.a : g.h]; return '<div class="game-line"><span>' + (home ? 'vs ' : '@ ') + U.tlink(opp) + '</span><span class="dim">' + opp.record.w + '-' + opp.record.l + '-' + opp.record.otl + '</span></div>'; }).join('');
    else if (phase === 'playoffs' && G.playoffs) {
      var s = G.playoffs.series.filter(function (x) { return x.hi === t.id || x.lo === t.id; })[0];
      h += s ? '<p><b>' + HD.ROUND_NAMES[G.playoffs.round] + '</b> vs ' + U.tlink(G.teams[s.hi === t.id ? s.lo : s.hi], true) + '</p>' : '<p class="muted">You have been eliminated. Watch the rest of the playoffs from your box.</p>';
    } else if (phase === 'playoffs') h += '<p>' + (HD.standings().indexOf(t) < 8 ? 'You\'ve qualified for the playoffs as the <b>' + HD.ordinal(HD.standings().indexOf(t) + 1) + ' seed</b>.' : 'You missed the playoffs.') + '</p>';
    if (phaseHelp[phase]) h += '<p class="help">' + phaseHelp[phase] + '</p>';
    if (G.ownerGoal) h += '<hr><div class="help">Owner\'s target</div><div><b>' + e(G.ownerGoal.desc.charAt(0).toUpperCase() + G.ownerGoal.desc.slice(1)) + '</b></div>';
    h += '</div>';
    // Ownership
    var oop = HD.opinion(o.id, me.id);
    h += '<div class="panel"><h3>Ownership' + (t.forSale ? ' <span class="tag gold">For Sale</span>' : '') + '</h3><div class="row">' + U.portrait(o, 64) + '<div>' + U.plink(o) + '<div class="help">' + e(o.business ? 'Made a fortune in ' + o.business : '') + '</div><div>Opinion ' + U.op(o.id) + '</div></div></div>';
    h += '<div style="margin-top:10px" class="help">Job security</div>' + U.meter(oop + 100, 200, oop < -40 ? 'bad' : oop < 0 ? 'warn' : 'good', oop <= -60 ? '<span class="bad">Danger</span>' : oop < -20 ? '<span class="warn">Shaky</span>' : oop < 30 ? 'Stable' : '<span class="good">Secure</span>');
    if (me.stakes >= 50) h += '<p class="good">You own a controlling stake. Nobody can fire you.</p>';
    h += '<div class="kv" style="margin-top:8px"><span class="k">Your contract</span><span>' + (me.contract ? HD.money(me.contract.salary) + '/yr · ' + me.contract.years + ' yr(s)' : '—') + '</span><span class="k">Club funds</span><span>' + HD.money(t.finance.balance) + '</span><span class="k">Fan hype</span><span>' + U.meter(t.hype, 100, 'ice') + '</span></div>';
    h += '</div>';
    // Last week
    var R = G.lastReport;
    h += '<div class="panel"><h3>Last Week</h3>';
    if (R && R.games.length) h += R.games.map(function (r) { return gameLine(r, t.id); }).join('');
    else if (R && R.series.length) h += R.series.map(function (s) { return '<p>' + U.tlink(G.teams[s.winner]) + ' won ' + Math.max(s.wh, s.wl) + '–' + Math.min(s.wh, s.wl) + ' over ' + U.tlink(G.teams[s.loser]) + '</p>'; }).join('');
    else h += '<div class="empty">No games played.</div>';
    var st = HD.teamStrength(t);
    h += '<hr><div class="kv"><span class="k">Streak</span><span>' + (t.record.streak > 0 ? '<span class="good">W' + t.record.streak + '</span>' : t.record.streak < 0 ? '<span class="bad">L' + (-t.record.streak) + '</span>' : '—') + '</span><span class="k">Goals</span><span>' + t.record.gf + ' for · ' + t.record.ga + ' against</span><span class="k">Team rating</span><span>Off ' + st.off.toFixed(0) + ' · Def ' + st.def.toFixed(0) + ' · G ' + st.gk.toFixed(0) + '</span><span class="k">Chemistry</span><span>' + HD.signed(HD.chemistry(t)) + '</span></div>';
    h += '</div></div>';

    h += '<div class="grid g2" style="margin-top:14px">';
    var f = U.newsFilter;
    var items = G.news.filter(function (n) { return f === 'all' || (f === 'mine' ? n.team === t.id : n.major); });
    h += '<div class="panel"><h3>The Wire <span class="row" style="gap:4px">' + [['all', 'All'], ['mine', 'Your Club'], ['major', 'Headlines']].map(function (x) { return '<button class="small' + (f === x[0] ? ' primary' : '') + '" data-act="newsFilter" data-f="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</span></h3>' + newsList(items, 50) + '</div>';
    // Key people + standings
    h += '<div class="grid" style="align-content:start">';
    var key = [o, G.people[t.coachId], t.captainId && G.people[t.captainId], HD.myRivalGm() && G.people[HD.myRivalGm()], me.spouseId && G.people[me.spouseId]].filter(function (p) { return p && p.alive; });
    h += '<div class="panel"><h3>Key People</h3>' + peopleTable(key) + '</div>';
    var stand = HD.standings();
    h += '<div class="panel"><h3>Standings <a class="help" data-act="tab" data-tab="league">full table →</a></h3><table><tr><th>#</th><th>Team</th><th class="num">GP</th><th class="num">PTS</th></tr>';
    stand.forEach(function (x, i) {
      if (i >= 8 && x.id !== t.id) return;
      h += '<tr class="' + (x.id === t.id ? 'me' : '') + '"><td>' + (i + 1) + '</td><td>' + U.tlink(x) + '</td><td class="num">' + (x.record.w + x.record.l + x.record.otl) + '</td><td class="num">' + HD.points(x) + '</td></tr>';
      if (i === 7) h += '<tr><td colspan="4" class="help center">— playoff line —</td></tr>';
    });
    h += '</table></div></div></div>';
    return h;
  };

  // ================= ROSTER =================
  HD.VIEWS.roster = function () {
    var G = HD.G, me = HD.me(), t = HD.myTeam();
    if (!t) return '<div class="empty">You have no team.</div>';
    var ps = HD.rosterPlayers(t);
    var st = HD.teamStrength(t);
    var h = '<div class="page-title"><h1>Roster</h1><span class="muted">' + ps.length + ' players (' + HD.ROSTER_MIN + '–' + HD.ROSTER_MAX + ') · Payroll ' + HD.money(HD.payroll(t), true) + ' / ' + HD.money(G.league.cap, true) + '</span></div>';
    h += '<div class="panel" style="margin-bottom:14px"><div class="spread"><div class="row"><label>Tactics</label><select data-change="tactic">' + Object.keys(HD.TACTICS).map(function (k) { return '<option value="' + k + '"' + (t.tactic === k ? ' selected' : '') + '>' + HD.TACTICS[k].name + ' — ' + HD.TACTICS[k].desc + '</option>'; }).join('') + '</select>';
    h += '<button data-act="autoLines">⚙ Auto-set lines</button></div>';
    h += '<div class="row"><span>Offence <b>' + st.off.toFixed(1) + '</b></span><span>Defence <b>' + st.def.toFixed(1) + '</b></span><span>Goaltending <b>' + st.gk.toFixed(1) + '</b></span><span>Chemistry <b>' + HD.signed(HD.chemistry(t)) + '</b></span><span>Coach ' + U.plink(G.people[t.coachId]) + ' <span class="dim">(Tac ' + G.people[t.coachId].skills.tactics + ')</span></span></div></div>';
    h += '<p class="help" style="margin:8px 0 0">Players expect ice time that matches their ability. A star on the 4th line will grow resentful; a grinder promoted to the top line will love you. Injured players are scratched automatically.</p></div>';
    var groups = [['Forwards', 'F', ['F1', 'F2', 'F3', 'F4', 'X']], ['Defence', 'D', ['D1', 'D2', 'D3', 'X']], ['Goaltenders', 'G', ['G1', 'G2', 'X']]];
    groups.forEach(function (gr) {
      var list = ps.filter(function (p) { return HD.groupOf(p) === gr[1]; });
      list.sort(function (a, b) { return (HD.SLOT_RANK[a.slot] - HD.SLOT_RANK[b.slot]) || b.ovr - a.ovr; });
      var counts = {}; list.forEach(function (p) { counts[p.slot] = (counts[p.slot] || 0) + 1; });
      var warn = gr[2].filter(function (s) { return s !== 'X' && (counts[s] || 0) !== HD.SLOT_CAP[s]; });
      h += '<div class="panel" style="margin-bottom:14px"><h3>' + gr[0] + (warn.length ? ' <span class="warn help">Unbalanced: ' + warn.map(function (s) { return HD.SLOT_NAMES[s] + ' ' + (counts[s] || 0) + '/' + HD.SLOT_CAP[s]; }).join(', ') + '</span>' : '') + '</h3><div class="tbl-wrap"><table><tr><th>Player</th><th>Pos</th><th class="num">Age</th><th class="num">OVR</th><th class="num">Pot</th><th>Morale</th><th class="num">Opinion</th><th>Deployment</th>' + (gr[1] === 'G' ? '<th class="num">GP</th><th class="num">W-L</th><th class="num">SV%</th>' : '<th class="num">GP</th><th class="num">G</th><th class="num">A</th><th class="num">P</th>') + '<th>Contract</th></tr>';
      list.forEach(function (p) {
        var exp = HD.expectedSlotRank(p, t), rank = HD.slotRank(p);
        var ice = rank - exp >= 2 ? ' <span class="bad" title="Expects a bigger role">▼</span>' : exp - rank >= 1 ? ' <span class="good" title="Thrilled with their role">▲</span>' : '';
        h += '<tr><td><div class="namecell">' + U.portrait(p, 30) + '<div>' + U.plink(p) + (t.captainId === p.id ? ' <span class="tag gold">C</span>' : '') + U.injury(p) + '<div class="help">' + p.traits.map(function (tr) { var d = HD.TRAITS[tr]; return d ? '<span title="' + e(d.name) + '">' + d.icon + '</span>' : ''; }).join(' ') + '</div></div></div></td>';
        h += '<td>' + U.pos(p) + '</td><td class="num">' + p.age + '</td><td class="num">' + U.ovr(p.ovr) + '</td><td class="num dim">' + U.potText(p) + '</td>';
        h += '<td style="min-width:90px">' + U.meter(p.morale, 100, p.morale < 35 ? 'bad' : p.morale < 55 ? 'warn' : 'good') + '</td><td class="num">' + U.op(p.id) + '</td>';
        h += '<td><select data-change="slot" data-id="' + p.id + '"' + (p.injury > 0 ? ' disabled' : '') + '>' + gr[2].map(function (s) { return '<option value="' + s + '"' + (p.slot === s ? ' selected' : '') + '>' + HD.SLOT_NAMES[s] + '</option>'; }).join('') + '</select>' + ice + '</td>';
        var s = p.stats;
        if (gr[1] === 'G') h += '<td class="num">' + s.gp + '</td><td class="num">' + s.w + '-' + s.l + '</td><td class="num">' + (s.sa ? (1 - s.ga / s.sa).toFixed(3) : '—') + '</td>';
        else h += '<td class="num">' + s.gp + '</td><td class="num">' + s.g + '</td><td class="num">' + s.a + '</td><td class="num"><b>' + (s.g + s.a) + '</b></td>';
        h += '<td class="nowrap">' + U.contract(p) + '</td></tr>';
      });
      h += '</table></div></div>';
    });
    var pros = (t.prospects || []).map(HD.person).filter(Boolean);
    h += '<div class="panel"><h3>Prospect Pipeline <span class="help">Develop in junior/minors. Call up for $925K × 3.</span></h3>';
    if (!pros.length) h += '<div class="empty">No prospects. Draft some at the Entry Draft.</div>';
    else {
      h += '<table><tr><th>Prospect</th><th>Pos</th><th class="num">Age</th><th class="num">OVR</th><th class="num">Pot</th><th>Playing for</th><th class="num">Opinion</th><th></th></tr>';
      pros.sort(function (a, b) { return b.pot - a.pot; }).forEach(function (p) {
        h += '<tr><td><div class="namecell">' + U.portrait(p, 30) + U.plink(p) + '</div></td><td>' + U.pos(p) + '</td><td class="num">' + p.age + '</td><td class="num">' + U.ovr(p.ovr) + '</td><td class="num">' + U.potText(p) + '</td><td class="help">' + e(p.junior || '') + '</td><td class="num">' + U.op(p.id) + '</td><td><button class="small" data-act="interact" data-id="' + p.id + '" data-i="callup">Call up</button></td></tr>';
      });
      h += '</table>';
    }
    return h + '</div>';
  };

  // ================= PEOPLE =================
  HD.VIEWS.people = function () {
    var G = HD.G, me = HD.me(), t = HD.myTeam();
    var sub = cur('people', 'org');
    var h = '<div class="page-title"><h1>Relations</h1><span class="muted">Everyone has an opinion of you. Click anyone to see why — and to do something about it.</span></div>';
    h += subtabs('people', [['org', 'Your Organization'], ['family', 'Family'], ['league', 'GMs & Owners'], ['media', 'Press & Agents'], ['friends', 'Friends & Rivals']]);
    var P = function (id) { return G.people[id]; };
    if (sub === 'org') {
      if (!t) return h + '<div class="empty">You have no organization.</div>';
      h += '<div class="panel" style="margin-bottom:14px"><h3>Front Office</h3>' + peopleTable([P(t.ownerId), P(t.coachId)], function (p) { return p.role === 'coach' ? 'Tac ' + p.skills.tactics : HD.money(p.wealth); }, '') + '</div>';
      var ps = HD.rosterPlayers(t).sort(function (a, b) { return HD.opinion(a.id, me.id) - HD.opinion(b.id, me.id); });
      h += '<div class="panel"><h3>Players <span class="help">sorted by opinion, unhappiest first</span></h3>' + peopleTable(ps, function (p) { return U.ovr(p.ovr) + ' <span class="dim">morale ' + p.morale + '</span>'; }, 'OVR / Morale') + '</div>';
    } else if (sub === 'family') {
      var fam = [me.spouseId].concat(me.childIds || []).map(P).filter(Boolean);
      h += '<div class="panel">' + (fam.length ? peopleTable(fam, function (p) { return 'Age ' + p.age; }) : '<div class="empty">Married to the job.</div>') + '</div>';
    } else if (sub === 'league') {
      var gms = Object.keys(G.teams).map(function (id) { return P(G.teams[id].gmId); }).filter(function (p) { return p && p.id !== me.id; });
      var owners = Object.keys(G.teams).map(function (id) { return P(G.teams[id].ownerId); });
      h += '<div class="grid g2"><div class="panel"><h3>General Managers</h3>' + peopleTable(gms, function (p) { return 'Dip ' + p.skills.diplomacy; }, 'Skill') + '</div>';
      h += '<div class="panel"><h3>Owners</h3>' + peopleTable(owners, function (p) { return HD.money(p.wealth); }, 'Fortune') + '</div></div>';
      h += '<div class="panel" style="margin-top:14px"><h3>League Office</h3>' + peopleTable([P(G.commissionerId)]) + '</div>';
    } else if (sub === 'media') {
      h += '<div class="grid g2"><div class="panel"><h3>Press</h3>' + peopleTable(G.journalists.map(P), function (p) { return 'Reach ' + p.reach; }, '') + '</div>';
      h += '<div class="panel"><h3>Player Agents</h3>' + peopleTable(G.agents.map(P), function (p) { return (p.clients || []).filter(function (c) { return P(c) && P(c).teamId === me.teamId; }).length + ' on your team'; }, 'Clients') + '</div></div>';
    } else {
      var rel = Object.keys(me.relations).map(P).filter(Boolean);
      h += '<div class="panel">' + peopleTable(rel) + '</div>';
      h += '<p class="help">Make friends with the Befriend interaction (requires opinion 30+). Rivals hold grudges and scheme against you.</p>';
    }
    return h;
  };

  // ================= LEAGUE =================
  HD.VIEWS.league = function () {
    var G = HD.G, me = HD.me(), t = HD.myTeam();
    var sub = cur('league', 'standings');
    var h = '<div class="page-title"><h1>League</h1><span class="muted">Salary cap ' + HD.money(G.league.cap, true) + ' · Floor ' + HD.money(G.league.floor, true) + '</span></div>';
    h += subtabs('league', [['standings', 'Standings'], ['schedule', 'Schedule'], ['playoffs', 'Playoffs'], ['leaders', 'Leaders'], ['clubs', 'Clubs & Finances'], ['history', 'History']]);
    if (sub === 'standings') {
      h += '<div class="panel tbl-wrap"><table><tr><th>#</th><th>Team</th><th class="num">GP</th><th class="num">W</th><th class="num">L</th><th class="num">OTL</th><th class="num">PTS</th><th class="num">GF</th><th class="num">GA</th><th class="num">DIFF</th><th class="num">STRK</th><th>GM</th><th class="num">Hype</th></tr>';
      HD.standings().forEach(function (x, i) {
        var r = x.record;
        h += '<tr class="clickable ' + (x.id === me.teamId ? 'me' : '') + '" data-act="team" data-id="' + x.id + '"><td>' + (i + 1) + '</td><td>' + U.crest(x, 22) + ' ' + e(HD.teamName(x)) + '</td><td class="num">' + (r.w + r.l + r.otl) + '</td><td class="num">' + r.w + '</td><td class="num">' + r.l + '</td><td class="num">' + r.otl + '</td><td class="num"><b>' + HD.points(x) + '</b></td><td class="num">' + r.gf + '</td><td class="num">' + r.ga + '</td><td class="num ' + (r.gf - r.ga >= 0 ? 'good' : 'bad') + '">' + HD.signed(r.gf - r.ga) + '</td><td class="num">' + (r.streak > 0 ? 'W' + r.streak : r.streak < 0 ? 'L' + (-r.streak) : '—') + '</td><td class="help">' + e(HD.N(x.gmId)) + '</td><td class="num">' + Math.round(x.hype) + '</td></tr>';
        if (i === 7) h += '<tr><td colspan="13" class="help center">— playoff line —</td></tr>';
      });
      h += '</table></div>';
    } else if (sub === 'schedule') {
      if (!t) return h + '<div class="empty">No team.</div>';
      var games = G.schedule.filter(function (g) { return g.h === t.id || g.a === t.id; });
      h += '<div class="panel"><div class="grid g2">';
      [games.filter(function (g) { return g.played; }).reverse(), games.filter(function (g) { return !g.played; })].forEach(function (list, idx) {
        h += '<div><h3>' + (idx ? 'Upcoming' : 'Results') + '</h3>';
        if (!list.length) h += '<div class="empty">None.</div>';
        list.slice(0, 40).forEach(function (g) {
          var home = g.h === t.id, opp = G.teams[home ? g.a : g.h];
          if (g.played) h += gameLine({ h: g.h, a: g.a, hs: g.hs, as: g.as, ot: g.ot }, t.id).replace('class="game-line"', 'class="game-line"><span class="dim">W' + g.wk + '</span');
          else h += '<div class="game-line"><span class="dim">W' + g.wk + '</span><span>' + (home ? 'vs ' : '@ ') + U.tlink(opp) + '</span><span class="dim">' + opp.record.w + '-' + opp.record.l + '-' + opp.record.otl + '</span></div>';
        });
        h += '</div>';
      });
      h += '</div></div>';
    } else if (sub === 'playoffs') {
      var P = G.playoffs;
      if (!P) return h + '<div class="panel empty">The playoffs begin in week ' + HD.CAL.PLAYOFF_START + '. The top 8 teams qualify.</div>';
      h += '<div class="panel">' + (P.champion ? '<h2 class="center">🏆 ' + e(HD.teamName(G.teams[P.champion])) + '</h2>' : '') + '<div class="bracket">';
      for (var r = 0; r < 3; r++) {
        var ser = P.rounds[r] || (r === P.rounds.length ? P.series : null);
        h += '<div><h4>' + HD.ROUND_NAMES[r + 1] + '</h4>';
        if (!ser || !ser.length) h += '<div class="empty">TBD</div>';
        else ser.forEach(function (s) {
          var hiW = s.winner === s.hi, loW = s.winner === s.lo;
          h += '<div class="series"><div class="' + (hiW ? 'win' : '') + '"><span>' + (P.seeds.indexOf(s.hi) + 1) + '. ' + U.tlink(G.teams[s.hi]) + '</span><span>' + s.wh + '</span></div><div class="' + (loW ? 'win' : '') + '"><span>' + (P.seeds.indexOf(s.lo) + 1) + '. ' + U.tlink(G.teams[s.lo]) + '</span><span>' + s.wl + '</span></div></div>';
        });
        h += '</div>';
      }
      h += '</div></div>';
    } else if (sub === 'leaders') {
      var sk = [], gk = [];
      Object.keys(G.teams).forEach(function (id) { HD.rosterPlayers(G.teams[id]).forEach(function (p) { if (p.pos === 'G') { if (p.stats.gp >= 3) gk.push(p); } else sk.push(p); }); });
      var tbl = function (title, list, fn, head) {
        return '<div class="panel"><h3>' + title + '</h3><table><tr><th>Player</th><th>Team</th><th class="num">' + head + '</th></tr>' + list.slice(0, 12).map(function (p) { return '<tr class="' + (p.teamId === me.teamId ? 'me' : '') + '"><td>' + U.plink(p) + ' ' + U.pos(p) + '</td><td>' + U.tlink(G.teams[p.teamId]) + '</td><td class="num"><b>' + fn(p) + '</b></td></tr>'; }).join('') + '</table></div>';
      };
      h += '<div class="grid g2">';
      h += tbl('Points', HD.sortBy(sk, function (p) { return p.stats.g + p.stats.a + p.stats.g * 0.01; }, true), function (p) { return p.stats.g + p.stats.a; }, 'PTS');
      h += tbl('Goals', HD.sortBy(sk, function (p) { return p.stats.g; }, true), function (p) { return p.stats.g; }, 'G');
      h += tbl('Save %', HD.sortBy(gk, function (p) { return p.stats.sa ? 1 - p.stats.ga / p.stats.sa : 0; }, true), function (p) { return (1 - p.stats.ga / Math.max(1, p.stats.sa)).toFixed(3); }, 'SV%');
      h += tbl('Penalty Minutes', HD.sortBy(sk, function (p) { return p.stats.pim; }, true), function (p) { return p.stats.pim; }, 'PIM');
      h += '</div>';
    } else if (sub === 'clubs') {
      h += '<div class="panel tbl-wrap"><table><tr><th>Club</th><th>Owner</th><th class="num">Market</th><th class="num">Value</th><th class="num">Funds</th><th class="num">Last Rev.</th><th class="num">Last Profit</th><th class="num">Payroll</th><th class="num">Attend.</th><th class="num">Titles</th></tr>';
      Object.keys(G.teams).map(function (id) { return G.teams[id]; }).sort(function (a, b) { return HD.teamValue(b) - HD.teamValue(a); }).forEach(function (x) {
        var last = x.finance.history[x.finance.history.length - 1];
        h += '<tr class="clickable ' + (x.id === me.teamId ? 'me' : '') + '" data-act="team" data-id="' + x.id + '"><td>' + U.crest(x, 22) + ' ' + e(x.name) + (x.forSale ? ' <span class="tag gold">For sale</span>' : '') + '</td><td class="help">' + e(HD.N(x.ownerId)) + '</td><td class="num">' + x.market + '</td><td class="num">' + HD.money(HD.teamValue(x)) + '</td><td class="num ' + (x.finance.balance < 0 ? 'bad' : '') + '">' + HD.money(x.finance.balance) + '</td><td class="num">' + (last ? HD.money(last.rev) : '—') + '</td><td class="num ' + (last && last.profit < 0 ? 'bad' : 'good') + '">' + (last ? HD.money(last.profit) : '—') + '</td><td class="num">' + HD.money(HD.payroll(x)) + '</td><td class="num">' + (x.lastAttendance ? (x.lastAttendance / 1000).toFixed(1) + 'K' : '—') + '</td><td class="num">' + x.titles.length + '</td></tr>';
      });
      h += '</table><p class="help">Every club lives on its own books. Small markets bleed money if they spend to the cap; owners who run out of patience — or cash — sell.</p></div>';
    } else {
      h += '<div class="panel tbl-wrap"><table><tr><th>Season</th><th>Champion</th><th>MVP</th><th>Top Scorer</th><th>Top Goalie</th><th>Rookie</th><th>GM of Year</th></tr>';
      if (!G.league.history.length) h += '<tr><td colspan="7" class="empty">History is yet to be written.</td></tr>';
      G.league.history.forEach(function (x) {
        var P = function (id) { return id && G.people[id] ? U.plink(G.people[id]) : '—'; };
        h += '<tr><td>' + HD.seasonLabel(x.season) + '</td><td>' + (x.champion ? '🏆 ' + U.tlink(G.teams[x.champion]) : '—') + '</td><td>' + P(x.mvp) + '</td><td>' + P(x.scorer) + '</td><td>' + P(x.goalie) + '</td><td>' + P(x.rookie) + '</td><td>' + P(x.gm) + '</td></tr>';
      });
      h += '</table></div>';
    }
    return h;
  };

  U.showTeam = function (tid) {
    U.open({ cls: 'wide', render: function () {
      var G = HD.G, t = G.teams[tid], me = HD.me();
      var h = U.head(U.crest(t, 34) + ' ' + e(HD.teamName(t)), e(t.arena) + ' · Market size ' + t.market + '/10' + (t.rivalId ? ' · Rival: ' + e(G.teams[t.rivalId].name) : ''));
      h += '<div class="modal-body"><div class="grid g3">';
      [['Owner', t.ownerId], ['General Manager', t.gmId], ['Head Coach', t.coachId]].forEach(function (x) {
        var p = G.people[x[1]];
        h += '<div class="panel"><div class="help">' + x[0] + '</div><div class="row">' + U.portrait(p, 48) + '<div>' + U.plink(p) + '<div>' + (p.id === me.id ? '<span class="tag gold">You</span>' : U.op(p.id)) + '</div></div></div></div>';
      });
      h += '</div><div class="kv" style="margin:12px 0"><span class="k">Record</span><span>' + t.record.w + '-' + t.record.l + '-' + t.record.otl + ' (' + HD.points(t) + ' pts)</span><span class="k">Value</span><span>' + HD.money(HD.teamValue(t)) + (t.forSale ? ' <span class="tag gold">For sale</span>' : '') + '</span><span class="k">Club funds</span><span>' + HD.money(t.finance.balance) + '</span><span class="k">Payroll</span><span>' + HD.money(HD.payroll(t)) + ' (space ' + HD.money(HD.capSpace(t)) + ')</span><span class="k">Hype</span><span>' + U.meter(t.hype, 100, 'ice') + '</span><span class="k">Titles</span><span>' + (t.titles.length ? t.titles.join(', ') : 'None') + '</span></div>';
      h += '<div class="tbl-wrap"><table><tr><th>Player</th><th>Pos</th><th class="num">Age</th><th class="num">OVR</th><th class="num">P</th><th>Contract</th><th class="num">Opinion</th></tr>';
      HD.sortBy(HD.rosterPlayers(t), function (p) { return p.ovr; }, true).forEach(function (p) {
        h += '<tr class="clickable" data-act="person" data-id="' + p.id + '"><td><div class="namecell">' + U.portrait(p, 26) + e(HD.fullName(p)) + U.injury(p) + '</div></td><td>' + U.pos(p) + '</td><td class="num">' + p.age + '</td><td class="num">' + U.ovr(p.ovr) + '</td><td class="num">' + (p.pos === 'G' ? '—' : p.stats.g + p.stats.a) + '</td><td>' + U.contract(p) + '</td><td class="num">' + U.op(p.id) + '</td></tr>';
      });
      h += '</table></div></div>';
      if (t.id !== me.teamId && me.teamId) h += '<div class="modal-foot"><button class="primary" data-act="tradeWith" data-id="' + t.id + '">🔁 Trade with ' + e(t.name) + '</button></div>';
      return h;
    } });
  };

  // ================= MARKET =================
  HD.VIEWS.market = function () {
    var G = HD.G, me = HD.me(), t = HD.myTeam();
    if (!t) return '<div class="empty">You have no team.</div>';
    var phase = HD.phaseOf(G.week);
    var sub = cur('market', phase === 'draft' ? 'draft' : 'fa');
    var h = '<div class="page-title"><h1>Transactions</h1><span class="muted">Cap space ' + HD.money(HD.capSpace(t), true) + ' · Roster ' + t.roster.length + '/' + HD.ROSTER_MAX + '</span></div>';
    h += subtabs('market', [['fa', 'Free Agents' + (phase === 'freeagency' ? ' (OPEN)' : '')], ['trade', 'Trades'], ['draft', 'Entry Draft']]);
    if (sub === 'fa') {
      var pos = U.faPos;
      var list = G.freeAgents.map(HD.person).filter(function (p) { return p && (pos === 'all' || HD.groupOf(p) === pos); });
      list.sort(function (a, b) { return b.ovr - a.ovr; });
      h += '<div class="panel"><div class="spread"><div class="row">' + [['all', 'All'], ['F', 'Forwards'], ['D', 'Defence'], ['G', 'Goalies']].map(function (x) { return '<button class="small' + (pos === x[0] ? ' primary' : '') + '" data-act="faPos" data-p="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
      h += '<span class="help">' + (phase === 'freeagency' ? 'Free agency is open. Players weigh every offer at week\'s end.' : 'Unsigned players will sign immediately if your offer is good enough. The big market opens in week ' + HD.CAL.FA_START + '.') + '</span></div>';
      h += '<div class="tbl-wrap"><table><tr><th>Player</th><th>Pos</th><th class="num">Age</th><th class="num">OVR</th><th class="num">Pot</th><th class="num">Asking</th><th class="num">Bids</th><th class="num">Opinion</th><th></th></tr>';
      list.slice(0, 80).forEach(function (p) {
        var ask = HD.askingContract(p, t);
        var bids = (G.faOffers[p.id] || []);
        var mineBid = bids.filter(function (o) { return o.t === t.id; })[0];
        h += '<tr><td><div class="namecell">' + U.portrait(p, 28) + '<div>' + U.plink(p) + '<div class="help">' + p.traits.map(function (tr) { var d = HD.TRAITS[tr]; return d ? '<span title="' + e(d.name) + '">' + d.icon + '</span>' : ''; }).join(' ') + (p.formerTeam ? ' ex-' + e(G.teams[p.formerTeam].name) : '') + '</div></div></div></td><td>' + U.pos(p) + '</td><td class="num">' + p.age + '</td><td class="num">' + U.ovr(p.ovr) + '</td><td class="num dim">' + U.potText(p) + '</td><td class="num">' + HD.money(ask.salary) + ' <span class="dim">×' + ask.years + '</span></td><td class="num">' + (bids.length ? bids.length + (mineBid ? ' <span class="tag gold">yours ' + HD.money(mineBid.s) + '</span>' : '') : '—') + '</td><td class="num">' + U.op(p.id) + '</td><td><button class="small primary" data-act="offer" data-id="' + p.id + '">Offer</button></td></tr>';
      });
      h += '</table></div></div>';
    } else if (sub === 'trade') {
      var T = U.trade;
      var others = Object.keys(G.teams).filter(function (id) { return id !== t.id; });
      if (!T.team || T.team === t.id) T.team = others[0];
      var o = G.teams[T.team], gm = G.people[o.gmId];
      var closed = G.week > HD.CAL.DEADLINE && G.week <= HD.CAL.PLAYOFF_END;
      h += '<div class="panel" style="margin-bottom:14px"><div class="spread"><div class="row"><label>Trade partner</label><select data-change="tradeTeam">' + others.map(function (id) { return '<option value="' + id + '"' + (id === T.team ? ' selected' : '') + '>' + e(HD.teamName(G.teams[id])) + '</option>'; }).join('') + '</select></div>';
      h += '<div class="row">' + U.portrait(gm, 40) + '<div>' + U.plink(gm) + ' ' + U.op(gm.id) + '<div class="help">' + U.relChip(HD.relation(me.id, gm.id)) + ' Friendly GMs accept less; rivals demand more.</div></div></div></div>';
      if (closed) h += '<div class="result bad" style="margin-top:10px">The trade deadline has passed. Trading reopens after the playoffs.</div>';
      h += '</div>';
      var col = function (team, sel, side) {
        var s = '<div class="panel"><h3>' + U.crest(team, 26) + ' ' + e(team.name) + ' <span class="help">' + HD.money(HD.capSpace(team)) + ' cap space</span></h3><div class="tbl-wrap"><table><tr><th></th><th>Player</th><th>Pos</th><th class="num">Age</th><th class="num">OVR</th><th>Contract</th><th class="num">Value</th></tr>';
        HD.sortBy(HD.rosterPlayers(team), function (p) { return p.ovr; }, true).forEach(function (p) {
          var on = sel.indexOf(p.id) >= 0;
          s += '<tr class="clickable ' + (on ? 'me' : '') + '" data-act="toggleTrade" data-side="' + side + '" data-id="' + p.id + '"><td>' + (on ? '☑' : '☐') + '</td><td>' + e(HD.fullName(p)) + U.injury(p) + '</td><td>' + U.pos(p) + '</td><td class="num">' + p.age + '</td><td class="num">' + U.ovr(p.ovr) + '</td><td class="nowrap">' + U.contract(p) + '</td><td class="num dim">' + HD.tradeValue(p) + '</td></tr>';
        });
        return s + '</table></div></div>';
      };
      var vg = HD.sum(T.give, function (id) { return HD.tradeValue(HD.person(id)); }), vr = HD.sum(T.get, function (id) { return HD.tradeValue(HD.person(id)); });
      h += '<div class="panel gilded" style="margin-bottom:14px"><div class="spread"><div>You send <b>' + T.give.length + '</b> (value ' + vg + ') · You receive <b>' + T.get.length + '</b> (value ' + vr + ')</div><div class="row"><button data-act="clearTrade">Clear</button><button class="primary" data-act="proposeTrade"' + (closed || (!T.give.length && !T.get.length) ? ' disabled' : '') + '>Propose Trade</button></div></div>' + (T.msg ? '<div class="result ' + (T.ok ? '' : 'bad') + '" style="margin-top:10px">' + e(T.msg) + '</div>' : '') + '</div>';
      h += '<div class="grid g2">' + col(t, T.give, 'give') + col(o, T.get, 'get') + '</div>';
    } else {
      if (!G.draft) return h + '<div class="empty">No draft class yet.</div>';
      var D = G.draft;
      if (D.done) {
        h += '<div class="panel"><h3>' + G.season + ' Draft Results</h3><table><tr><th>#</th><th>Team</th><th>Player</th><th>Pos</th><th class="num">OVR</th><th class="num">Scouted Pot</th></tr>';
        D.picks.forEach(function (pk) { var p = G.people[pk.p]; if (!p) return; h += '<tr class="' + (pk.t === t.id ? 'me' : '') + '"><td>' + pk.n + '</td><td>' + U.tlink(G.teams[pk.t]) + '</td><td>' + U.plink(p) + '</td><td>' + U.pos(p) + '</td><td class="num">' + U.ovr(p.ovr) + '</td><td class="num">' + (p.scoutPot || '—') + '</td></tr>'; });
        return h + '</table></div>';
      }
      var order = HD.standings().reverse().map(function (x) { return x.id; });
      var myPick = order.indexOf(t.id) + 1;
      h += '<div class="panel" style="margin-bottom:14px"><div class="spread"><span>The Entry Draft runs in <b>week ' + HD.CAL.DRAFT + '</b>. Projected pick: <b>#' + myPick + '</b> and <b>#' + (myPick + 16) + '</b> (reverse standings).</span><span class="help">Scouting accuracy: ±' + HD.scoutNoise().toFixed(1) + ' potential (improve with Scouting skill and network)</span></div>';
      h += '<p class="help">Add prospects to your board in order of preference. When your pick comes up, the highest available prospect on your board is selected.</p>';
      if (D.board.length) h += '<div class="row">' + D.board.map(function (id, i) { var p = G.people[id]; return '<span class="chip">' + (i + 1) + '. ' + e(HD.fullName(p)) + ' <a data-act="boardUp" data-id="' + id + '">▲</a> <a data-act="boardRemove" data-id="' + id + '">✕</a></span>'; }).join('') + '</div>';
      h += '</div><div class="panel tbl-wrap"><table><tr><th>Prospect</th><th>Pos</th><th class="num">Age</th><th>Junior Team</th><th class="num">OVR</th><th class="num">Scouted Pot</th><th>Traits</th><th></th></tr>';
      HD.sortBy(D.cls.map(HD.person).filter(Boolean), function (p) { return p.scoutPot; }, true).forEach(function (p) {
        var on = D.board.indexOf(p.id) >= 0;
        h += '<tr class="' + (on ? 'me' : '') + '"><td><div class="namecell">' + U.portrait(p, 28) + U.plink(p) + ' ' + U.flag(p) + '</div></td><td>' + U.pos(p) + '</td><td class="num">' + p.age + '</td><td class="help">' + e(p.junior) + '</td><td class="num">' + U.ovr(p.ovr) + '</td><td class="num"><b>' + p.scoutPot + '</b></td><td>' + U.traitChips(p) + '</td><td>' + (on ? '<span class="tag gold">On board</span>' : '<button class="small" data-act="boardAdd" data-id="' + p.id + '">+ Board</button>') + '</td></tr>';
      });
      h += '</table></div>';
    }
    return h;
  };

  // ================= FINANCE =================
  HD.VIEWS.finance = function () {
    var G = HD.G, me = HD.me(), t = HD.myTeam();
    if (!t) return '<div class="empty">You have no club.</div>';
    var L = t.finance.season, P = t.finance.last;
    var o = G.people[t.ownerId];
    var h = '<div class="page-title"><h1>Club Finances</h1><span class="muted">' + e(HD.teamName(t)) + ' · Value ' + HD.money(HD.teamValue(t)) + '</span></div>';
    h += '<div class="grid g3">';
    // Ledger
    var rows = [['Ticket sales', 'tickets', 1], ['Concessions & merch', 'concessions', 1], ['Sponsorships', 'sponsors', 1], ['TV & media', 'tv', 1], ['Playoff gates', 'playoffs', 1], ['Player payroll', 'payroll', -1], ['Staff & operations', 'staff', -1], ['Facility upkeep', 'facilities', -1], ['Buyouts, fines & other', 'other', -1]];
    h += '<div class="panel span2"><h3>Ledger</h3><table><tr><th></th><th class="num">This season</th><th class="num">Last season</th></tr>';
    rows.forEach(function (r) { h += '<tr><td>' + r[0] + '</td><td class="num ' + (r[2] > 0 ? 'good' : 'bad') + '">' + HD.money(L[r[1]] * r[2]) + '</td><td class="num dim">' + (P ? HD.money(P[r[1]] * r[2]) : '—') + '</td></tr>'; });
    var prof = HD.seasonProfit(t);
    h += '<tr class="me"><td><b>Profit / loss</b></td><td class="num ' + (prof >= 0 ? 'good' : 'bad') + '"><b>' + HD.money(prof) + '</b></td><td class="num">' + (P ? HD.money(HD.seasonRevenue(P) - P.payroll - P.staff - P.facilities - P.other) : '—') + '</td></tr></table>';
    h += '<p class="help">Last week: ' + (t.finance.lastWeek ? HD.money(t.finance.lastWeek.inc) + ' in, ' + HD.money(t.finance.lastWeek.exp) + ' out' : '—') + '. Owners skim half of any funds above $30M at season end.</p></div>';
    // Balance & cap
    h += '<div class="panel gilded"><h3>Position</h3><div class="kv"><span class="k">Club funds</span><span class="' + (t.finance.balance < 0 ? 'bad' : 'good') + '"><b>' + HD.money(t.finance.balance) + '</b></span><span class="k">Payroll</span><span>' + HD.money(HD.payroll(t), true) + '</span><span class="k">Cap</span><span>' + HD.money(G.league.cap, true) + '</span></div>' + U.meter(HD.payroll(t), G.league.cap, HD.payroll(t) > G.league.cap * 0.97 ? 'warn' : '', Math.round(HD.payroll(t) / G.league.cap * 100) + '%');
    h += '<hr><h4>Ticket Pricing</h4><div class="kv"><span class="k">Price</span><span><button class="small" data-act="price" data-d="-5">−</button> <b>$' + t.ticketPrice + '</b> <button class="small" data-act="price" data-d="5">+</button></span><span class="k">Fair price</span><span>$' + HD.fairPrice(t) + '</span><span class="k">Projected crowd</span><span>' + HD.attendance(t).toLocaleString() + ' / ' + HD.capacity(t).toLocaleString() + '</span><span class="k">Gate / game</span><span>' + HD.money(HD.homeGateRevenue(t).tickets + HD.homeGateRevenue(t).concessions) + '</span></div><p class="help">Price above what fans think is fair and the seats empty — which kills hype.</p></div>';
    h += '</div>';
    // Facilities
    h += '<div class="panel" style="margin-top:14px"><h3>Facilities</h3><div class="grid g4">';
    Object.keys(HD.FACILITIES).forEach(function (k) {
      var lvl = t.facilities[k], next = lvl + 1, cost = HD.FACILITY_COST[next];
      h += '<div class="panel" style="background:var(--panel2)"><h4>' + HD.FACILITIES[k].name + '</h4><div class="help" style="min-height:36px">' + HD.FACILITIES[k].desc + '</div><div style="font-size:20px;color:var(--gold2)">' + '★'.repeat(lvl) + '<span class="dim">' + '★'.repeat(5 - lvl) + '</span></div><div class="help">Upkeep ' + HD.money(HD.FACILITY_UPKEEP[lvl]) + '/wk</div>';
      if (lvl < 5) h += '<div class="row" style="margin-top:6px"><button class="small" data-act="upgrade" data-k="' + k + '" data-src="team"' + (t.finance.balance < cost ? ' disabled' : '') + '>Club funds ' + HD.money(cost) + '</button><button class="small" data-act="upgrade" data-k="' + k + '" data-src="me"' + (me.wealth < cost ? ' disabled' : '') + ' title="Owner will be impressed">Pay personally</button></div>';
      else h += '<div class="good help">Maxed out</div>';
      h += '</div>';
    });
    h += '</div></div>';
    // Ownership
    var val = HD.teamValue(t);
    var chunk = 2.5, price = Math.round(val * chunk / 100 * (t.forSale ? 0.85 : 1.1));
    var oop = HD.opinion(o.id, me.id);
    h += '<div class="grid g2" style="margin-top:14px"><div class="panel gilded"><h3>Equity</h3><div class="kv"><span class="k">Franchise value</span><span>' + HD.money(val) + '</span><span class="k">Your stake</span><span><b>' + me.stakes + '%</b> (' + HD.money(val * me.stakes / 100) + ')</span><span class="k">Owner</span><span>' + U.plink(o) + ' ' + U.op(o.id) + '</span></div>';
    h += '<p class="help">Shareholders receive a share of the owner\'s season-end profit draw. At 50% you control the club and can no longer be fired.' + (t.forSale ? ' <b class="gold">The club is for sale — prices are discounted.</b>' : ' The owner must have a positive opinion of you to sell.') + '</p>';
    h += '<div class="row"><button class="primary" data-act="buyStake"' + (me.wealth < price || (!t.forSale && oop < 0) || me.stakes >= 100 ? ' disabled' : '') + '>Buy ' + chunk + '% for ' + HD.money(price) + '</button>';
    if (me.stakes > 0) h += '<button data-act="sellStake">Sell ' + chunk + '% for ' + HD.money(val * chunk / 100 * 0.95) + '</button>';
    if (t.forSale && me.stakes < 51) { var ctl = Math.round(val * (51 - me.stakes) / 100 * 0.85); h += '<button class="primary" data-act="buyControl"' + (me.wealth < ctl ? ' disabled' : '') + '>Buy control (51%) for ' + HD.money(ctl) + '</button>'; }
    h += '</div></div>';
    // Contracts
    h += '<div class="panel"><h3>Biggest Contracts</h3><table><tr><th>Player</th><th class="num">OVR</th><th>Contract</th><th class="num">vs Value</th></tr>';
    HD.sortBy(HD.rosterPlayers(t), function (p) { return p.contract ? p.contract.salary : 0; }, true).slice(0, 10).forEach(function (p) {
      var diff = p.contract.salary - HD.marketValue(p);
      h += '<tr><td>' + U.plink(p) + '</td><td class="num">' + U.ovr(p.ovr) + '</td><td>' + U.contract(p) + '</td><td class="num ' + (diff > 0 ? 'bad' : 'good') + '">' + HD.money(-diff) + '</td></tr>';
    });
    h += '</table></div></div>';
    return h;
  };

  // ================= PERSONAL =================
  HD.VIEWS.personal = function () {
    var G = HD.G, me = HD.me();
    var sub = cur('personal', 'profile');
    var h = '<div class="page-title"><h1>Your Life</h1><span class="muted">Net worth ' + HD.money(HD.netWorth(me)) + '</span></div>';
    h += subtabs('personal', [['profile', 'Profile & Skills'], ['assets', 'Property & Lifestyle'], ['invest', 'Businesses'], ['stocks', 'Stock Market']]);
    if (sub === 'profile') {
      var bg = HD.BACKGROUNDS.filter(function (b) { return b.id === me.background; })[0];
      h += '<div class="grid g3"><div class="panel gilded"><div class="row">' + U.portrait(me, 96) + '<div><h2>' + e(HD.fullName(me)) + '</h2><div class="muted">' + e(bg ? bg.name : '') + ' · Age ' + me.age + ' ' + U.flag(me) + '</div></div></div><div class="traits">' + U.traitChips(me) + '</div>';
      h += '<div class="kv"><span class="k">Prestige</span><span>★ ' + Math.round(me.prestige) + '</span><span class="k">Stress</span><span>' + U.meter(me.stress, 100, me.stress > 70 ? 'bad' : me.stress > 45 ? 'warn' : 'good') + '</span><span class="k">Health</span><span>' + U.meter(me.health, 100, me.health < 40 ? 'bad' : 'good') + '</span><span class="k">Contract</span><span>' + (me.contract ? HD.money(me.contract.salary) + '/yr · ' + me.contract.years + ' yr' : '—') + '</span><span class="k">Career</span><span>' + me.career.wins + '-' + me.career.losses + ' · 🏆 ' + me.career.titles + '</span></div></div>';
      h += '<div class="panel span2"><h3>Skills</h3>';
      Object.keys(HD.SKILLS).forEach(function (k) {
        var need = 60 + me.skills[k] * 12;
        h += '<div class="rating" style="grid-template-columns:120px 1fr 40px"><span title="' + e(HD.SKILLS[k].desc) + '">' + HD.SKILLS[k].icon + ' ' + HD.SKILLS[k].name + '</span><div>' + U.bar(me.skills[k], 20) + '<div style="margin-top:2px">' + U.bar(me.xp[k] || 0, need, 'ice') + '</div></div><b class="right">' + me.skills[k] + '</b></div><div class="help" style="margin:-2px 0 6px 126px">' + e(HD.SKILLS[k].desc) + '</div>';
      });
      h += '<hr><div class="row"><label>Lifestyle focus</label><select data-change="focus">' + Object.keys(HD.LIFESTYLE_FOCUS).map(function (k) { return '<option value="' + k + '"' + (me.focus === k ? ' selected' : '') + '>' + HD.SKILLS[k].name + ' — ' + HD.LIFESTYLE_FOCUS[k] + '</option>'; }).join('') + '</select></div><p class="help">You gain experience in your focus skill every week. Events and interactions train skills too. Stress above 70 penalizes every skill check.</p></div></div>';
      var ernd = me.earnings;
      h += '<div class="panel" style="margin-top:14px"><h3>Career Earnings</h3><div class="grid g4"><div><div class="help">Salary</div><b>' + HD.money(ernd.salary) + '</b></div><div><div class="help">Bonuses & endorsements</div><b>' + HD.money(ernd.bonus) + '</b></div><div><div class="help">Investment income</div><b>' + HD.money(ernd.invest) + '</b></div><div><div class="help">Spent</div><b>' + HD.money(ernd.spent) + '</b></div></div></div>';
    } else if (sub === 'assets') {
      h += '<div class="panel"><h3>Property & Toys <span class="help">Cash ' + HD.money(me.wealth) + '</span></h3><p class="help">Purchases raise your prestige and relieve stress every week, but cost upkeep. Sell for 70% of the price.</p><div class="tbl-wrap"><table><tr><th>Item</th><th>Type</th><th class="num">Price</th><th class="num">Upkeep/wk</th><th class="num">Prestige</th><th class="num">Stress</th><th></th></tr>';
      HD.ASSETS.forEach(function (a) {
        var owned = me.assets.indexOf(a.id) >= 0;
        h += '<tr class="' + (owned ? 'me' : '') + '"><td><b>' + e(a.name) + '</b><div class="help">' + e(a.desc) + '</div></td><td>' + a.cat + '</td><td class="num">' + HD.money(a.cost) + '</td><td class="num">' + HD.money(a.upkeep) + '</td><td class="num good">+' + a.prestige + '</td><td class="num good">' + a.stress + '</td><td>' + (owned ? '<button class="small" data-act="sellAsset" data-id="' + a.id + '">Sell ' + HD.money(a.cost * 0.7) + '</button>' : '<button class="small primary" data-act="buyAsset" data-id="' + a.id + '"' + (me.wealth < a.cost ? ' disabled' : '') + '>Buy</button>') + '</td></tr>';
      });
      h += '</table></div></div>';
    } else if (sub === 'invest') {
      h += '<div class="panel"><h3>Local Businesses <span class="help">Cash ' + HD.money(me.wealth) + '</span></h3><p class="help">Businesses pay weekly income that varies with the economy and your Finance skill. Sell at 90% of current value.</p><div class="tbl-wrap"><table><tr><th>Business</th><th class="num">Cost</th><th class="num">Value</th><th class="num">Last week</th><th class="num">Total earned</th><th></th></tr>';
      HD.BUSINESSES.forEach(function (b) {
        var own = me.businesses.filter(function (x) { return x.id === b.id; })[0];
        h += '<tr class="' + (own ? 'me' : '') + '"><td><b>' + e(b.name) + '</b><div class="help">' + e(b.desc) + '</div></td><td class="num">' + HD.money(b.cost) + '</td><td class="num">' + (own ? HD.money(own.value) : '—') + '</td><td class="num ' + (own && own.lastIncome < 0 ? 'bad' : 'good') + '">' + (own && own.lastIncome !== undefined ? HD.money(own.lastIncome) : '—') + '</td><td class="num">' + (own ? HD.money(own.total || 0) : '—') + '</td><td>' + (own ? '<button class="small" data-act="sellBiz" data-id="' + b.id + '">Sell</button>' : '<button class="small primary" data-act="buyBiz" data-id="' + b.id + '"' + (me.wealth < b.cost ? ' disabled' : '') + '>Buy</button>') + '</td></tr>';
      });
      h += '</table></div></div>';
    } else {
      h += '<div class="panel"><h3>Market <span class="help">Cash ' + HD.money(me.wealth) + ' · Portfolio ' + HD.money(HD.portfolioValue(me)) + '</span></h3><div class="tbl-wrap"><table><tr><th>Company</th><th class="num">Price</th><th>Trend</th><th class="num">Wk</th><th class="num">Shares</th><th class="num">Value</th><th class="num">Gain</th><th>Trade</th></tr>';
      G.stocks.forEach(function (s) {
        var c = HD.COMPANIES.filter(function (x) { return x.id === s.id; })[0];
        var hold = me.stocks[s.id];
        var prev = s.hist[s.hist.length - 2] || s.price, chg = (s.price / prev - 1) * 100;
        var gain = hold ? hold.shares * s.price - hold.cost : 0;
        h += '<tr><td><b>' + c.id + '</b> ' + e(c.name) + '<div class="help">' + e(c.desc) + (c.dividend ? ' Dividend ' + (c.dividend * 100).toFixed(1) + '%/qtr.' : '') + '</div></td><td class="num">$' + s.price.toFixed(2) + '</td><td>' + U.spark(s.hist.slice(-30), 90, 26) + '</td><td class="num ' + (chg >= 0 ? 'good' : 'bad') + '">' + (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%</td><td class="num">' + (hold ? hold.shares.toLocaleString() : '—') + '</td><td class="num">' + (hold ? HD.money(hold.shares * s.price) : '—') + '</td><td class="num ' + (gain >= 0 ? 'good' : 'bad') + '">' + (hold ? HD.money(gain) : '—') + '</td>';
        h += '<td class="nowrap"><select data-change="stockAmt" data-id="' + s.id + '">' + [10000, 50000, 100000, 500000, 1000000, 5000000].map(function (v) { return '<option value="' + v + '"' + ((U.stockAmt || {})[s.id] == v ? ' selected' : '') + '>' + HD.money(v) + '</option>'; }).join('') + '</select> <button class="small primary" data-act="buyStock" data-id="' + s.id + '">Buy</button> <button class="small" data-act="sellStock" data-id="' + s.id + '"' + (hold ? '' : ' disabled') + '>Sell</button> <button class="small" data-act="sellAllStock" data-id="' + s.id + '"' + (hold ? '' : ' disabled') + '>All</button></td></tr>';
      });
      h += '</table></div><p class="help">Prices move weekly with the economy, corporate news — and the league. Puck Broadcasting tracks league-wide fan excitement. Watch the wire for tips.</p></div>';
    }
    return h;
  };

  // ================= CHRONICLE =================
  HD.VIEWS.chronicle = function () {
    var G = HD.G;
    var h = '<div class="page-title"><h1>Chronicle</h1><span class="muted">The story of your career</span></div>';
    h += '<div class="grid g2"><div class="panel"><h3>Your Story</h3><div class="feed" style="max-height:none">' + G.chronicleLog.map(function (c) { return '<div class="news' + (c.t.indexOf('🏆') >= 0 ? ' major' : '') + '"><span class="when">' + U.when(c) + '</span>' + e(c.t) + '</div>'; }).join('') + '</div></div>';
    h += '<div class="panel"><h3>League Headlines</h3>' + newsList(G.news.filter(function (n) { return n.major; }), 120) + '</div></div>';
    return h;
  };

  // ================= START SCREEN =================
  HD.UI.startScreen = function () {
    var S = U.setup = U.setup || { first: 'Alex', last: 'Mercer', gender: 'm', background: 'analyst', teamId: 'HAM', traits: ['ambitious'], married: true, nation: 'CAN' };
    var h = '<div class="start"><div class="hero"><h1>Hockey Dynasty</h1><p>Every owner, player, agent and reporter in the league remembers what you did. Build relationships, manage egos, balance the books, invest your fortune — and bring a championship home.</p></div>';
    if (HD.hasSave()) h += '<div class="center" style="margin-bottom:20px"><button class="primary advance" data-act="loadGame">▶ Continue Saved Career</button></div>';
    h += '<div class="grid g2"><div class="panel gilded"><h3>Who Are You?</h3><div class="row"><input type="text" value="' + e(S.first) + '" data-change="setFirst" placeholder="First name"><input type="text" value="' + e(S.last) + '" data-change="setLast" placeholder="Last name"></div>';
    h += '<div class="row" style="margin-top:8px"><select data-change="setGender"><option value="m"' + (S.gender === 'm' ? ' selected' : '') + '>Man</option><option value="f"' + (S.gender === 'f' ? ' selected' : '') + '>Woman</option></select><select data-change="setNation">' + Object.keys(HD.NATIONS).map(function (k) { return '<option value="' + k + '"' + (S.nation === k ? ' selected' : '') + '>' + HD.NATIONS[k].flag + ' ' + HD.NATIONS[k].name + '</option>'; }).join('') + '</select><label class="row" style="gap:4px"><input type="checkbox" data-change="setMarried"' + (S.married ? ' checked' : '') + '> Married with family</label></div>';
    h += '<h4 style="margin-top:14px">Background</h4><div class="grid">';
    HD.BACKGROUNDS.forEach(function (b) {
      h += '<div class="choice' + (S.background === b.id ? ' on' : '') + '" data-act="pickBg" data-id="' + b.id + '"><b>' + b.name + '</b> <span class="help">' + HD.money(b.wealth) + ' · ★' + b.prestige + ' · ' + HD.TRAITS[b.trait].icon + ' ' + HD.TRAITS[b.trait].name + '</span><div class="help">' + b.desc + '</div><div class="help">' + Object.keys(b.skills).map(function (k) { return HD.SKILLS[k].icon + b.skills[k]; }).join(' &nbsp; ') + '</div></div>';
    });
    h += '</div><h4 style="margin-top:14px">Personality <span class="help">(choose up to 2)</span></h4><div class="traits">';
    HD.PERSONALITY_TRAITS.forEach(function (tr) {
      var on = S.traits.indexOf(tr) >= 0;
      h += '<span class="chip trait' + (on ? ' rel-friend' : '') + '" data-act="pickTrait" data-id="' + tr + '" title="' + e(HD.TRAITS[tr].desc) + '" style="cursor:pointer">' + HD.TRAITS[tr].icon + ' ' + HD.TRAITS[tr].name + '</span>';
    });
    h += '</div><p class="help">People who share your traits like you more; people with opposite traits like you less.</p></div>';
    h += '<div class="panel"><h3>Choose Your Club</h3><div class="teams-grid">';
    HD.FRANCHISES.slice().sort(function (a, b) { return b.market - a.market; }).forEach(function (f) {
      var fake = { abbr: f.id, colors: f.colors };
      var diff = f.market >= 8 ? '<span class="bad">High pressure</span>' : f.market <= 4 ? '<span class="good">Patient fans, thin budget</span>' : '<span class="warn">Balanced</span>';
      h += '<div class="choice' + (S.teamId === f.id ? ' on' : '') + '" data-act="pickTeam" data-id="' + f.id + '"><div class="row" style="gap:8px">' + U.crest(fake, 36) + '<div><b>' + f.city + '</b><div>' + f.name + '</div></div></div><div class="help">Market ' + '●'.repeat(Math.ceil(f.market / 2)) + '<span class="dim">' + '●'.repeat(5 - Math.ceil(f.market / 2)) + '</span> · ' + diff + '</div></div>';
    });
    h += '</div><p class="help">Big markets bring money and impatient owners. Small markets are cheap and forgiving, but every dollar counts.</p></div></div>';
    h += '<div class="center" style="margin-top:20px"><button class="primary advance" data-act="startGame">Begin Your Career ▶</button></div></div>';
    return h;
  };
})();
