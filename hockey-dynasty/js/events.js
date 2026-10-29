// Story events. Each event: setup() -> ctx (plain, saveable data) or null;
// view(ctx) -> { title, text, portraits, options: [{ label, hint, act(ctx) -> outcome text }] }.
var HD = HD || {};

HD.checkChance = function (skill, diff) {
  var me = HD.me();
  var s = me.skills[skill] - (me.stress > 70 ? 2 : 0);
  return HD.clamp(0.55 + (s - diff) * 0.06, 0.05, 0.95);
};
HD.check = function (skill, diff) {
  var p = HD.checkChance(skill, diff);
  HD.gainXp(skill, 8);
  return HD.chance(p);
};
HD.pctText = function (skill, diff) { return HD.SKILLS[skill].icon + ' ' + Math.round(HD.checkChance(skill, diff) * 100) + '% ' + HD.SKILLS[skill].name; };

HD.gainXp = function (skill, n) {
  var me = HD.me();
  me.xp[skill] = (me.xp[skill] || 0) + n;
  var need = 60 + me.skills[skill] * 12;
  if (me.xp[skill] >= need && me.skills[skill] < 20) {
    me.xp[skill] -= need; me.skills[skill]++;
    HD.chronicle('Your ' + HD.SKILLS[skill].name + ' improved to ' + me.skills[skill] + '.');
  }
};

HD.myPlayers = function () { var t = HD.myTeam(); return t ? HD.rosterPlayers(t) : []; };
HD.owner = function () { var t = HD.myTeam(); return t ? HD.G.people[t.ownerId] : null; };
HD.spend = function (amt) { var me = HD.me(); me.wealth -= amt; me.earnings.spent += amt; };
HD.canAfford = function (amt) { return HD.me().wealth >= amt; };
HD.N = function (id) { return HD.fullName(HD.G.people[id]); };

HD.EVENTS = {};
HD.defEvent = function (id, def) { def.id = id; HD.EVENTS[id] = def; };

// ---------------- Scripted ----------------
HD.defEvent('season_goal', {
  scripted: true,
  setup: function () {
    var G = HD.G, t = HD.myTeam(), o = HD.owner();
    var rank = HD.standings().length;
    var strengths = Object.keys(G.teams).map(function (id) { return { id: id, s: HD.teamStrength(G.teams[id]).overall }; }).sort(function (a, b) { return b.s - a.s; });
    var myRank = strengths.map(function (x) { return x.id; }).indexOf(t.id) + 1;
    var lvl = myRank <= 3 ? 3 : myRank <= 7 ? 2 : myRank <= 11 ? 1 : 0;
    if (o.traits.indexOf('ambitious') >= 0) lvl = Math.min(3, lvl + 1);
    if (t.market >= 9 && lvl < 1) lvl = 1;
    return { lvl: lvl, rank: myRank };
  },
  view: function (ctx) {
    var o = HD.owner(), t = HD.myTeam();
    var goals = HD.GOALS;
    var g = goals[ctx.lvl];
    return {
      title: 'The Owner\'s Box',
      portraits: [o.id],
      text: HD.fullName(o) + ' pours two glasses of scotch and looks out over the empty ice at ' + t.arena + '.\n\n"Another season, ' + HD.me().first + '. The scouts rank us around ' + HD.ordinal(ctx.rank) + ' in the league. I\'ve made my money in ' + o.business + ' by setting clear targets, so here\'s yours: <b>' + g.desc + '</b>. Can you deliver?"',
      options: [
        ctx.lvl < 3 && { label: '"I\'ll do better than that."', hint: 'Raise the target to "' + (goals[Math.min(3, ctx.lvl + 1)].desc) + '". Owner +10 now. Failure will hurt more.', act: function () {
          HD.setGoal(Math.min(3, ctx.lvl + 1)); HD.addOpinion(o.id, HD.me().id, 'bold_promise', 'Bold Promise', 10, 12); HD.me().prestige += 2;
          return 'The owner grins and clinks your glass. "That\'s what I like to hear."'; } },
        { label: '"Consider it done."', hint: 'Accept the target.', act: function () { HD.setGoal(ctx.lvl); return 'A firm handshake. The season begins.'; } },
        { label: '"Let\'s be realistic about where this roster is."', hint: HD.pctText('diplomacy', 10) + ' to lower the target. Failure: Owner -10.', act: function () {
          if (ctx.lvl > 0 && HD.check('diplomacy', 10)) { HD.setGoal(ctx.lvl - 1); return 'The owner sighs, but agrees. "Fine. ' + goals[ctx.lvl - 1].desc + '. Don\'t make me regret it."'; }
          HD.setGoal(ctx.lvl); HD.addOpinion(o.id, HD.me().id, 'excuses', 'Making Excuses', -10, 16);
          return '"I didn\'t hire you to make excuses." The target stands.'; } }
      ].filter(Boolean)
    };
  }
});

HD.GOALS = [
  { desc: 'show progress and stay out of the basement', expectPct: 0.42, check: function (r) { return r.rank <= 13; } },
  { desc: 'make the playoffs', expectPct: 0.5, check: function (r) { return r.playoffs; } },
  { desc: 'win at least one playoff round', expectPct: 0.56, check: function (r) { return r.round >= 2; } },
  { desc: 'win the championship', expectPct: 0.62, check: function (r) { return r.champion; } }
];
HD.setGoal = function (lvl) {
  var g = HD.GOALS[lvl];
  HD.G.ownerGoal = { lvl: lvl, desc: g.desc, expectPct: g.expectPct };
  HD.chronicle('Season goal set by ownership: ' + g.desc + '.');
};

HD.defEvent('owner_review', {
  scripted: true,
  setup: function () { return HD.seasonResult(); },
  view: function (ctx) {
    var o = HD.owner(), me = HD.me();
    var goal = HD.G.ownerGoal || { lvl: 1, desc: 'make the playoffs' };
    var met = HD.GOALS[goal.lvl].check(ctx);
    var summary = 'You finished ' + HD.ordinal(ctx.rank) + ' (' + ctx.rec + ')' + (ctx.champion ? ' and WON THE CHAMPIONSHIP.' : ctx.playoffs ? ' and were eliminated in the ' + HD.ROUND_NAMES[ctx.round] + '.' : ', missing the playoffs.');
    return {
      title: 'Season Review',
      portraits: [o.id],
      text: summary + '\n\nThe target was to <b>' + goal.desc + '</b>. ' + (met ? HD.fullName(o) + ' is smiling for once.' : HD.fullName(o) + ' doesn\'t offer you a seat.'),
      options: [{ label: met ? 'Accept their congratulations.' : 'Brace yourself.', hint: met ? 'Owner +25, bonus ' + HD.money(HD.reviewBonus(ctx)) : 'Owner -30', act: function () {
        if (met) {
          HD.addOpinion(o.id, me.id, 'met_goal', 'Delivered On Promise', 25, 40);
          var b = HD.reviewBonus(ctx); me.wealth += b; me.earnings.bonus += b; me.prestige += 5;
          return 'A performance bonus of ' + HD.money(b) + ' lands in your account.';
        }
        HD.addOpinion(o.id, me.id, 'failed_goal', 'Failed Expectations', -30, 40);
        HD.addStress(10);
        if (HD.opinion(o.id, me.id) <= -35 && me.stakes < 50) { HD.queueEvent('fired', {}); return '"Close the door behind you. We need to talk."'; }
        return '"I expect better next year. Much better."';
      } }]
    };
  }
});
HD.reviewBonus = function (ctx) { return Math.round(HD.me().contract.salary * (ctx.champion ? 0.6 : ctx.round >= 2 ? 0.3 : 0.15)); };

HD.seasonResult = function () {
  var G = HD.G, t = HD.myTeam();
  var st = HD.standings();
  var rank = st.indexOf(t) + 1;
  var P = G.playoffs, round = 0, playoffs = false;
  if (P) {
    playoffs = P.seeds.indexOf(t.id) >= 0;
    P.rounds.forEach(function (series, i) { series.forEach(function (s) { if (s.hi === t.id || s.lo === t.id) round = i + 1; }); });
  }
  return { rank: rank, rec: t.record.w + '-' + t.record.l + '-' + t.record.otl, playoffs: playoffs, round: round, champion: P && P.champion === t.id };
};

HD.defEvent('my_contract', {
  scripted: true,
  setup: function () {
    var o = HD.owner(), me = HD.me();
    var op = HD.opinion(o.id, me.id);
    if (op < -25) return { fire: true };
    var raise = HD.clamp(1 + op / 150 + me.prestige / 400, 0.95, 1.8);
    return { salary: Math.round(me.contract.salary * raise / 50000) * 50000, years: op > 40 ? 5 : 3, op: op };
  },
  view: function (ctx) {
    var o = HD.owner(), me = HD.me();
    if (ctx.fire) return { title: 'Contract Expiring', portraits: [o.id], text: HD.fullName(o) + ' will not be renewing your contract.', options: [{ label: 'Clean out your office.', act: function () { HD.getFired('Your contract was not renewed.'); return 'You are now a free agent GM.'; } }] };
    return {
      title: 'Contract Renewal',
      portraits: [o.id],
      text: 'Your contract is up. ' + HD.fullName(o) + ' slides an offer across the desk: <b>' + HD.money(ctx.salary) + '/yr for ' + ctx.years + ' years</b> (currently ' + HD.money(me.contract.salary) + ').',
      options: [
        { label: 'Sign it.', hint: 'Owner +5', act: function () { me.contract = { salary: ctx.salary, years: ctx.years }; HD.addOpinion(o.id, me.id, 're_signed', 'Committed To Us', 5, 20); return 'Ink dries. You\'re locked in.'; } },
        { label: 'Push for 25% more.', hint: HD.pctText('diplomacy', 11) + '. Failure: you sign the original and Owner -10.', act: function () {
          if (HD.check('diplomacy', 11) || HD.check('finance', 13)) { me.contract = { salary: Math.round(ctx.salary * 1.25 / 50000) * 50000, years: ctx.years }; return 'They grumble, but meet your number: ' + HD.money(me.contract.salary) + '/yr.'; }
          me.contract = { salary: ctx.salary, years: ctx.years }; HD.addOpinion(o.id, me.id, 'greedy_gm', 'Greedy Demands', -10, 26); return '"Take it or leave it." You take it.'; } },
        { label: 'Walk away and test the market.', hint: 'Leave the team. You will be unemployed until someone hires you.', act: function () { HD.getFired('You walked away from the ' + HD.myTeam().name + '.', true); return 'You leave the building one last time.'; } }
      ]
    };
  }
});

// ---------------- Random ----------------
HD.defEvent('extension_demand', {
  weight: function () { return HD.extensionCandidate() ? 10 : 0; },
  setup: function () { var p = HD.extensionCandidate(); if (!p) return null; p.extAsked = HD.G.season; return { p: p.id }; },
  view: function (ctx) {
    var p = HD.person(ctx.p), t = HD.myTeam(), me = HD.me();
    var ask = HD.askingContract(p, t);
    var disc = Math.round(ask.salary * 0.85 / 50000) * 50000;
    return {
      title: 'Contract Talk', portraits: [p.id, p.agentId],
      text: HD.fullName(p) + ' (' + p.pos + ', ' + p.ovr + ' OVR) is in the final year of their deal. Their agent, ' + HD.N(p.agentId) + ', calls: "My client wants to know where they stand. We\'re thinking ' + HD.money(ask.salary) + ' over ' + ask.years + ' years."',
      options: [
        { label: 'Agree to ' + HD.money(ask.salary) + ' x ' + ask.years, hint: 'Extension starts next season. ' + HD.fullName(p) + ' +15', act: function () { HD.extendPlayer(p, ask.salary, ask.years); HD.addOpinion(p.id, me.id, 'extended', 'Extended Me', 15, 40); HD.addOpinion(p.agentId, me.id, 'fair_deal', 'Fair Dealer', 8, 26); return HD.fullName(p) + ' is staying in ' + t.city + '.'; } },
        { label: 'Ask for a hometown discount: ' + HD.money(disc), hint: HD.pctText('diplomacy', p.traits.indexOf('greedy') >= 0 ? 14 : 10) + '. Failure: -10', act: function () {
          if (HD.check('diplomacy', p.traits.indexOf('greedy') >= 0 ? 14 : 10) || p.traits.indexOf('generous') >= 0) { HD.extendPlayer(p, disc, ask.years); HD.addOpinion(p.id, me.id, 'extended', 'Extended Me', 8, 30); return 'They take less to stay. The locker room notices the sacrifice.'; }
          HD.addOpinion(p.id, me.id, 'lowball', 'Lowballed Me', -10, 26); return '"We\'ll see what the market says in July," the agent replies coldly.'; } },
        { label: '"Let\'s revisit after the season."', hint: HD.fullName(p) + ' -8, morale -5', act: function () { HD.addOpinion(p.id, me.id, 'stalled', 'Stalled Talks', -8, 20); p.morale -= 5; return 'The agent is noncommittal.'; } }
      ]
    };
  }
});
HD.extensionCandidate = function () {
  var G = HD.G;
  return HD.sortBy(HD.myPlayers().filter(function (p) { return p.contract && p.contract.years === 1 && !p.contract.next && p.ovr >= 74 && p.extAsked !== G.season; }), function (p) { return p.ovr; }, true)[0];
};

HD.defEvent('party_scandal', {
  weight: function () { return HD.G.flags.partyScandal ? 30 : 0; },
  setup: function () { var id = HD.G.flags.partyScandal; HD.G.flags.partyScandal = null; var p = HD.person(id); return p && p.teamId === HD.me().teamId ? { p: id } : null; },
  view: function (ctx) {
    var p = HD.person(ctx.p), o = HD.owner(), me = HD.me();
    return {
      title: 'Nightlife', portraits: [p.id],
      text: 'Photos of ' + HD.fullName(p) + ' stumbling out of a club at 4am are all over social media. Practice is at 10. The press is waiting for your comment.',
      options: [
        { label: 'Suspend them for a week.', hint: HD.fullName(p) + ' -20, misses a week. Owner +8.', act: function () { p.injury = Math.max(p.injury, 1); p.injuryDesc = 'team suspension'; HD.addOpinion(p.id, me.id, 'suspended', 'Suspended Me', -20, 30); HD.addOpinion(o.id, me.id, 'discipline', 'Runs A Tight Ship', 8, 20); return 'Message sent to the room.'; } },
        { label: 'Make it go away quietly.', hint: HD.pctText('intrigue', 9) + '. Failure is a scandal.', act: function () {
          if (HD.check('intrigue', 9)) { HD.addOpinion(p.id, me.id, 'covered', 'Protected Me', 20, 40); return 'A few calls, a few favours. The story dies by lunch.'; }
          me.prestige -= 6; HD.addOpinion(o.id, me.id, 'coverup', 'Botched Cover-Up', -15, 30);
          HD.G.journalists.forEach(function (j) { HD.addOpinion(j, me.id, 'coverup', 'Tried To Bury A Story', -10, 26); });
          HD.news('REPORT: ' + HD.myTeam().name + ' front office tried to suppress ' + HD.fullName(p) + ' story.', 'scandal', me.teamId, true);
          return 'It leaks that you tried to bury it. Now it\'s a story about you.'; } },
        { label: 'Defend them publicly. "Kids will be kids."', hint: HD.fullName(p) + ' +15, Owner -5', act: function () { HD.addOpinion(p.id, me.id, 'defended', 'Defended Me', 15, 30); HD.addOpinion(o.id, me.id, 'soft', 'Too Soft', -5, 16); return 'The room appreciates it. The owner less so.'; } }
      ]
    };
  }
});

HD.defEvent('rival_trashtalk', {
  weight: function () { return HD.myRivalGm() ? 5 : 0; },
  cooldown: 10,
  setup: function () { var r = HD.myRivalGm(); return r ? { r: r } : null; },
  view: function (ctx) {
    var r = HD.person(ctx.r), me = HD.me(), rt = HD.team(r.teamId);
    var comm = HD.person(HD.G.commissionerId);
    return {
      title: 'War of Words', portraits: [r.id],
      text: 'Asked about you on the radio, ' + HD.fullName(r) + ' of the ' + (rt ? rt.name : 'league') + ' laughs: "' + HD.pick(['I\'ve seen better rosters built by my nephew on a video game.', 'Some people are just lucky. Luck runs out.', 'They\'re a nice person. I\'d hire them to run my parking lot.']) + '"',
      options: [
        { label: 'Fire back on air.', hint: 'Prestige ±, fan hype +3, deepens the feud. Commissioner may fine you.', act: function () {
          var t = HD.myTeam(); t.hype = HD.clamp(t.hype + 3, 0, 100);
          HD.addOpinion(r.id, me.id, 'public_feud', 'Public Feud', -15, 52, { stack: true, max: 40 });
          var mine = HD.teamPct(t) || 0.5, theirs = rt ? (HD.teamPct(rt) || 0.5) : 0.5;
          me.prestige += mine >= theirs ? 4 : -2;
          if (HD.chance(0.35)) { HD.spend(25000); HD.addOpinion(comm.id, me.id, 'fined', 'Conduct Detrimental', -10, 26); HD.news('League fines ' + HD.fullName(me) + ' $25K for comments about ' + HD.fullName(r) + '.', 'scandal', me.teamId); return 'The fans eat it up. The commissioner fines you $25K.'; }
          return '"Check the standings, ' + r.last + '." The clip goes viral.'; } },
        { label: 'Take the high road.', hint: 'Diplomacy XP. Press +5.', act: function () { HD.gainXp('diplomacy', 20); HD.G.journalists.forEach(function (j) { HD.addOpinion(j, me.id, 'classy', 'Classy Response', 5, 20); }); return '"I wish them well." The press notes your restraint.'; } },
        { label: 'Leak something embarrassing about them.', hint: HD.pctText('intrigue', 11) + '. Success puts their job in danger. Failure: Prestige -8.', act: function () {
          if (HD.check('intrigue', 11)) { if (rt) rt.gmHeat = (rt.gmHeat || 0) + 0.35; HD.news('REPORT: ' + HD.fullName(r) + ' under scrutiny after leaked internal emails mock their own owner.', 'scandal', r.teamId, true); return 'Your source delivers. Their owner is reportedly furious.'; }
          me.prestige -= 8; HD.addOpinion(r.id, me.id, 'leaker', 'Leaked About Me', -30, 104); return 'The leak is traced back to your office. Embarrassing.'; } }
      ]
    };
  }
});
HD.myRivalGm = function () {
  var me = HD.me();
  for (var id in me.relations) { var r = HD.person(id); if (me.relations[id] === 'rival' && r && r.role === 'gm' && r.teamId) return id; }
  return null;
};

HD.defEvent('locker_feud', {
  weight: function () { return HD.teamFeud() ? 6 : 0; },
  cooldown: 8,
  setup: function () { var f = HD.teamFeud(); return f ? { a: f[0], b: f[1] } : null; },
  view: function (ctx) {
    var a = HD.person(ctx.a), b = HD.person(ctx.b), me = HD.me();
    return {
      title: 'Trouble in the Room', portraits: [a.id, b.id],
      text: HD.fullName(a) + ' and ' + HD.fullName(b) + ' got into it at practice. Sticks were dropped. The coach wants you to handle it.',
      options: [
        { label: 'Side with ' + a.first + '.', hint: a.last + ' +15, ' + b.last + ' -20', act: function () { HD.addOpinion(a.id, me.id, 'sided', 'Took My Side', 15, 26); HD.addOpinion(b.id, me.id, 'sided_against', 'Took Their Side', -20, 26); return b.first + ' storms out.'; } },
        { label: 'Side with ' + b.first + '.', hint: b.last + ' +15, ' + a.last + ' -20', act: function () { HD.addOpinion(b.id, me.id, 'sided', 'Took My Side', 15, 26); HD.addOpinion(a.id, me.id, 'sided_against', 'Took Their Side', -20, 26); return a.first + ' storms out.'; } },
        { label: 'Lock them in a room until they sort it out.', hint: HD.pctText('diplomacy', 10) + '. Success ends the feud.', act: function () {
          if (HD.check('diplomacy', 10)) { HD.setRelation(a.id, b.id, null); HD.addOpinion(a.id, me.id, 'mediated', 'Mediated Fairly', 5, 20); HD.addOpinion(b.id, me.id, 'mediated', 'Mediated Fairly', 5, 20); return 'An hour later they emerge... laughing. Hockey players.'; }
          a.morale -= 8; b.morale -= 8; return 'It gets worse. Now neither of them trusts you.'; } }
      ]
    };
  }
});
HD.teamFeud = function () {
  var ps = HD.myPlayers();
  for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) if (HD.relation(ps[i].id, ps[j].id) === 'rival') return [ps[i].id, ps[j].id];
  return null;
};

HD.defEvent('exclusive_interview', {
  weight: function () { return 4; }, cooldown: 8,
  setup: function () { return { j: HD.pick(HD.G.journalists) }; },
  view: function (ctx) {
    var j = HD.person(ctx.j), me = HD.me();
    return {
      title: 'The Sit-Down', portraits: [j.id],
      text: HD.fullName(j) + ' of ' + j.outlet + ' wants an exclusive long-form interview. "The real story of the ' + HD.myTeam().name + '. Your words."',
      options: [
        { label: 'Give them the exclusive.', hint: HD.fullName(j) + ' +20, other press -5, hype +2', act: function () { HD.addOpinion(j.id, me.id, 'exclusive', 'Gave Me An Exclusive', 20, 52); HD.G.journalists.forEach(function (o) { if (o !== j.id) HD.addOpinion(o, me.id, 'snubbed', 'Snubbed Us', -5, 16); }); HD.myTeam().hype += 2; me.prestige += 2; return 'The piece is a hit.'; } },
        { label: 'Use the interview to plant a story about a rival.', hint: HD.pctText('intrigue', 9) + '. Rival GM loses face.', act: function () {
          var r = HD.myRivalGm();
          if (r && HD.check('intrigue', 9)) { var rt = HD.team(HD.person(r).teamId); if (rt) rt.gmHeat = (rt.gmHeat || 0) + 0.25; HD.addOpinion(j.id, me.id, 'scoop', 'Gave Me A Scoop', 10, 26); return 'The rival story leads the sports page.'; }
          HD.addOpinion(j.id, me.id, 'used_me', 'Tried To Use Me', -10, 26); return HD.fullName(j) + ' sees through it.'; } },
        { label: 'Politely decline.', hint: HD.fullName(j) + ' -5', act: function () { HD.addOpinion(j.id, me.id, 'declined', 'Declined Interview', -5, 12); return 'Maybe next time.'; } }
      ]
    };
  }
});

HD.defEvent('sponsor_patch', {
  weight: function () { return HD.G.flags.patchDeal ? 0 : 3; },
  setup: function () { HD.G.flags.patchDeal = HD.G.season; return {}; },
  view: function () {
    var t = HD.myTeam(), o = HD.owner(), me = HD.me();
    var amt = Math.round((3 + t.market * 0.6) * 1e6);
    return {
      title: 'Jersey Patch', portraits: [o.id],
      text: 'BetNorth Gaming wants their logo on the ' + t.name + ' jersey. ' + HD.money(amt) + ' up front. Some of the players have... complicated feelings about betting companies.',
      options: [
        { label: 'Take the money.', hint: 'Team +' + HD.money(amt) + ', Owner +10, Honest players -8, hype -2', act: function () { t.finance.balance += amt; t.finance.season.sponsors += amt; HD.addOpinion(o.id, me.id, 'patch', 'Landed Sponsor', 10, 30); HD.myPlayers().forEach(function (p) { if (p.traits.indexOf('honest') >= 0) HD.addOpinion(p.id, me.id, 'betting', 'Took Betting Money', -8, 26); }); t.hype -= 2; return 'The patch goes on.'; } },
        { label: 'Negotiate harder.', hint: HD.pctText('finance', 11) + ' for +50%. Failure: they walk.', act: function () {
          if (HD.check('finance', 11)) { var a2 = Math.round(amt * 1.5); t.finance.balance += a2; t.finance.season.sponsors += a2; HD.addOpinion(o.id, me.id, 'patch', 'Landed Big Sponsor', 15, 30); return 'They cave: ' + HD.money(a2) + '.'; }
          return 'BetNorth signs with a rival instead.'; } },
        { label: 'Decline. Not on our sweater.', hint: 'Honest people approve. Owner -5', act: function () { HD.addOpinion(o.id, me.id, 'no_patch', 'Turned Down Money', -5, 16); HD.myPlayers().forEach(function (p) { if (p.traits.indexOf('honest') >= 0) HD.addOpinion(p.id, me.id, 'principled', 'Principled', 6, 26); }); return 'The jersey stays clean.'; } }
      ]
    };
  }
});

HD.defEvent('charity_gala', {
  weight: function () { return 3; }, cooldown: 14,
  setup: function () { return { cause: HD.pick(['children\'s hospital', 'youth hockey in underserved neighbourhoods', 'concussion research', 'the food bank', 'mental health in sport']) }; },
  view: function (ctx) {
    var me = HD.me(), t = HD.myTeam();
    var opts = [];
    opts.push({ label: 'Donate $1M personally.', hint: 'Prestige +12, hype +6, Owner +5, press +6', disabled: !HD.canAfford(1e6), act: function () { HD.spend(1e6); me.prestige += 12; t.hype += 6; HD.addOpinion(t.ownerId, me.id, 'charity', 'Generous Public Image', 5, 26); HD.G.journalists.forEach(function (j) { HD.addOpinion(j, me.id, 'charity', 'Charitable', 6, 26); }); HD.news(HD.fullName(me) + ' donates $1M to ' + ctx.cause + '.', 'social', t.id, true); return 'A standing ovation. The cheque photo runs everywhere.'; } });
    opts.push({ label: 'Donate $150K.', hint: 'Prestige +3, hype +2', disabled: !HD.canAfford(150000), act: function () { HD.spend(150000); me.prestige += 3; t.hype += 2; return 'A generous gift, quietly appreciated.'; } });
    opts.push({ label: 'Attend and work the room.', hint: 'Diplomacy XP, meet an owner', act: function () { HD.gainXp('diplomacy', 25); var oth = HD.team(HD.pick(Object.keys(HD.G.teams))); HD.addOpinion(oth.ownerId, me.id, 'gala', 'Met At Gala', 10, 30); return 'You spend the night charming ' + HD.N(oth.ownerId) + ', owner of the ' + oth.name + '.'; } });
    opts.push({ label: 'Skip it.', hint: '', act: function () { return 'You watch film instead.'; } });
    return { title: 'Charity Gala', portraits: [], text: 'The annual gala for ' + ctx.cause + ' is this Saturday. Every power broker in ' + t.city + ' will be there.', options: opts };
  }
});

HD.defEvent('anniversary', {
  weight: function () { return HD.me().spouseId ? 2 : 0; }, cooldown: 30,
  setup: function () { return {}; },
  view: function () {
    var me = HD.me(), sp = HD.person(me.spouseId);
    return {
      title: 'Anniversary', portraits: [sp.id],
      text: 'It\'s your anniversary. ' + sp.first + ' has noticed how many nights you\'ve spent at the rink.',
      options: [
        { label: 'Surprise trip to Paris. ($40K)', hint: sp.first + ' +20, stress -15', disabled: !HD.canAfford(40000), act: function () { HD.spend(40000); HD.addOpinion(sp.id, me.id, 'paris', 'Romantic Getaway', 20, 40); me.stress = Math.max(0, me.stress - 15); return 'A perfect weekend. You almost forget about hockey. Almost.'; } },
        { label: 'Nice dinner downtown. ($2K)', hint: sp.first + ' +8', act: function () { HD.spend(2000); HD.addOpinion(sp.id, me.id, 'dinner', 'Anniversary Dinner', 8, 20); return 'A lovely evening.'; } },
        { label: 'Work late. They\'ll understand.', hint: sp.first + ' -20', act: function () { HD.addOpinion(sp.id, me.id, 'forgot', 'Forgot Anniversary', -20, 40); return 'They do not understand.'; } }
      ]
    };
  }
});

HD.defEvent('health_scare', {
  weight: function () { return HD.me().stress >= 70 ? 12 : 0; }, cooldown: 8,
  setup: function () { return {}; },
  view: function () {
    var me = HD.me();
    return {
      title: 'Chest Pains', portraits: [],
      text: 'At 2am, staring at line combinations, you feel a tightness in your chest. The doctor says it\'s stress. "You need to slow down."',
      options: [
        { label: 'Take a week off.', hint: 'Stress -30, Owner -5', act: function () { me.stress = Math.max(0, me.stress - 30); HD.addOpinion(HD.owner().id, me.id, 'absent', 'Took Time Off', -5, 10); return 'You sleep for two days straight.'; } },
        { label: 'See a specialist. ($20K)', hint: 'Stress -15, health +10', act: function () { HD.spend(20000); me.stress = Math.max(0, me.stress - 15); me.health = Math.min(100, me.health + 10); return 'Breathing exercises. Weirdly, they help.'; } },
        { label: 'Push through.', hint: 'Health -12', act: function () { me.health -= 12; HD.gainXp('tactics', 15); return 'You pop an antacid and get back to the film.'; } }
      ]
    };
  }
});

HD.defEvent('homesick_rookie', {
  weight: function () { return HD.myPlayers().some(function (p) { return p.age <= 21 && p.morale < 60; }) ? 4 : 0; }, cooldown: 12,
  setup: function () { var p = HD.myPlayers().filter(function (p) { return p.age <= 21; }).sort(function (a, b) { return a.morale - b.morale; })[0]; return p ? { p: p.id } : null; },
  view: function (ctx) {
    var p = HD.person(ctx.p), me = HD.me();
    var vet = HD.sortBy(HD.myPlayers().filter(function (v) { return v.age >= 29 && !Object.keys(v.relations).some(function (k) { return v.relations[k] === 'mentor'; }); }), function (v) { return v.ovr + (v.traits.indexOf('leader') >= 0 ? 10 : 0); }, true)[0];
    var opts = [
      { label: 'Fly their family in for a week. ($15K)', hint: p.last + ' +15, morale +15', act: function () { HD.spend(15000); HD.addOpinion(p.id, me.id, 'family_visit', 'Brought My Family', 15, 40); p.morale += 15; return 'Mom brings homemade perogies for the whole team.'; } }
    ];
    if (vet) opts.push({ label: 'Ask ' + HD.fullName(vet) + ' to take them under their wing.', hint: 'Mentorship: faster development. ' + vet.last + ' & ' + p.last + ' become close.', act: function () { HD.setRelation(vet.id, p.id, 'mentor'); p.morale += 10; return vet.first + ' invites the kid to live in their basement for the season.'; } });
    opts.push({ label: '"This is the big leagues. Toughen up."', hint: 'Morale -10, diligent players respond', act: function () { if (p.traits.indexOf('diligent') >= 0) { p.form += 3; return 'They take it to heart and work harder.'; } p.morale -= 10; HD.addOpinion(p.id, me.id, 'harsh', 'Harsh With Me', -10, 20); return 'They nod, eyes down.'; } });
    return { title: 'Long Way From Home', portraits: [p.id].concat(vet ? [vet.id] : []), text: HD.fullName(p) + ', ' + p.age + ', from ' + HD.NATIONS[p.nation].name + ', has been struggling. Teammates say they eat alone and call home every night.', options: opts };
  }
});

HD.defEvent('fan_protest', {
  weight: function () { var t = HD.myTeam(); return t && t.record.streak <= -4 && HD.G.phase === 'regular' ? 15 : 0; }, cooldown: 6,
  setup: function () { return {}; },
  view: function () {
    var t = HD.myTeam(), me = HD.me();
    return {
      title: 'Paper Bags', portraits: [],
      text: 'After ' + (-t.record.streak) + ' straight losses, fans at ' + t.arena + ' are wearing paper bags. A banner reads "FIRE ' + me.last.toUpperCase() + '".',
      options: [
        { label: 'Hold a town hall with season ticket holders.', hint: HD.pctText('diplomacy', 9), act: function () { if (HD.check('diplomacy', 9)) { t.hype += 6; me.prestige += 1; return 'You win the room. "Trust the process" trends — sincerely, for once.'; } t.hype -= 3; HD.addStress(5); return 'Someone throws a hot dog at you.'; } },
        { label: 'Cut ticket prices 15%.', hint: 'Hype +6, lower gate revenue', act: function () { t.ticketPrice = Math.round(t.ticketPrice * 0.85); t.hype += 6; return 'Fans appreciate the gesture.'; } },
        { label: 'Ignore it.', hint: 'Hype -4, Owner -5, stress +5', act: function () { t.hype -= 4; HD.addOpinion(t.ownerId, me.id, 'fans_angry', 'Fans Are Angry', -5, 12); HD.addStress(5); return 'The bags multiply.'; } }
      ]
    };
  }
});

HD.defEvent('coach_extension', {
  weight: function () { var c = HD.person(HD.myTeam().coachId); return c && c.contract && c.contract.years === 1 && !c.asked ? 5 : 0; },
  setup: function () { var c = HD.person(HD.myTeam().coachId); c.asked = true; return { c: c.id }; },
  view: function (ctx) {
    var c = HD.person(ctx.c), me = HD.me();
    var sal = Math.round(c.contract.salary * 1.2 / 50000) * 50000;
    return {
      title: 'Behind the Bench', portraits: [c.id],
      text: 'Head coach ' + HD.fullName(c) + ' (Tactics ' + c.skills.tactics + ') wants an extension: ' + HD.money(sal) + '/yr for 3 years. "I need to know you believe in me."',
      options: [
        { label: 'Extend them.', hint: 'Coach +20. Team pays the salary.', act: function () { c.contract = { salary: sal, years: 4 }; HD.addOpinion(c.id, me.id, 'extended', 'Believed In Me', 20, 52); return 'Your coach is locked in.'; } },
        { label: 'Not yet.', hint: 'Coach -15. They may leave at season\'s end.', act: function () { HD.addOpinion(c.id, me.id, 'no_ext', 'Didn\'t Believe In Me', -15, 40); return 'A long pause. "Understood."'; } }
      ]
    };
  }
});

HD.defEvent('shady_booster', {
  weight: function () { return 2; }, cooldown: 30,
  setup: function () { return { name: HD.pick(HD.GENERIC_LAST) }; },
  view: function (ctx) {
    var me = HD.me(), comm = HD.person(HD.G.commissionerId);
    return {
      title: 'An Envelope', portraits: [],
      text: 'A booster named Mr. ' + ctx.name + ' slides an envelope across the table at a steakhouse. "$200,000. All I want is a heads-up on roster moves before they hit the wire. Harmless."',
      options: [
        { label: 'Take the envelope.', hint: '+$200K. Intrigue XP. Risk of exposure.', act: function () { me.wealth += 200000; HD.gainXp('intrigue', 25); HD.G.flags.bribeRisk = (HD.G.flags.bribeRisk || 0) + 1; return 'It feels heavier than it should.'; } },
        { label: 'Refuse.', hint: 'Honest people approve.', act: function () { HD.gainXp('diplomacy', 5); return '"Pity," Mr. ' + ctx.name + ' says, picking up the cheque.'; } },
        { label: 'Report it to the league.', hint: 'Commissioner +15, Prestige +2', act: function () { HD.addOpinion(comm.id, me.id, 'reported', 'Reported Corruption', 15, 52); me.prestige += 2; return 'The commissioner\'s office thanks you for your integrity.'; } }
      ]
    };
  }
});

HD.defEvent('bribe_exposed', {
  weight: function () { return (HD.G.flags.bribeRisk || 0) * 2; },
  setup: function () { HD.G.flags.bribeRisk = 0; return {}; },
  view: function () {
    var me = HD.me(), j = HD.person(HD.pick(HD.G.journalists));
    return {
      title: 'The Story Breaks', portraits: [j.id],
      text: HD.fullName(j) + ' calls for comment. They have bank records showing payments from a betting-linked booster to you.',
      options: [
        { label: 'Deny everything.', hint: HD.pctText('intrigue', 12), act: function () { if (HD.check('intrigue', 12)) return 'You discredit the source. The story fizzles.'; me.prestige -= 20; HD.addOpinion(HD.owner().id, me.id, 'scandal', 'Betting Scandal', -40, 52); HD.spend(500000); HD.news('SCANDAL: ' + HD.fullName(me) + ' fined $500K by the league over booster payments.', 'scandal', me.teamId, true); return 'Your denial makes it worse. The league fines you $500K.'; } },
        { label: 'Come clean.', hint: 'Prestige -10, fined $250K, Owner -20', act: function () { me.prestige -= 10; HD.spend(250000); HD.addOpinion(HD.owner().id, me.id, 'scandal', 'Betting Scandal', -20, 52); return 'An apology. A fine. A lesson.'; } }
      ]
    };
  }
});

HD.defEvent('ai_trade_offer', {
  weight: function () { return HD.G.week <= HD.CAL.DEADLINE && HD.G.phase !== 'playoffs' ? 6 : 0; }, cooldown: 3,
  setup: function () { return HD.buildAiOffer(); },
  view: function (ctx) {
    var gm = HD.person(ctx.gm), t = HD.team(ctx.t);
    var desc = function (ids) { return ids.map(function (id) { var p = HD.person(id); return '<b>' + HD.fullName(p) + '</b> (' + p.pos + ', ' + p.age + 'y, ' + p.ovr + ' OVR, ' + HD.money(p.contract.salary) + ')'; }).join(' + '); };
    return {
      title: 'Phone Call: ' + t.name, portraits: [gm.id, ctx.want[0]],
      text: HD.fullName(gm) + ' calls. "I like ' + HD.N(ctx.want[0]) + '. I\'ll give you ' + desc(ctx.give) + ' for ' + desc(ctx.want) + '. Offer\'s good until I hang up."',
      options: [
        { label: 'Accept the trade.', hint: 'Execute immediately.', act: function () {
          var ok = ctx.want.every(function (id) { return HD.person(id).teamId === HD.me().teamId; }) && ctx.give.every(function (id) { return HD.person(id).teamId === t.id; });
          if (!ok) return 'The deal has fallen apart — rosters changed.';
          var me = HD.myTeam();
          var pay = HD.payroll(me) - HD.sum(ctx.want, function (id) { return HD.person(id).contract.salary; }) + HD.sum(ctx.give, function (id) { return HD.person(id).contract.salary; });
          if (pay > HD.G.league.cap) return 'You can\'t fit it under the cap. The deal dies.';
          HD.executeTrade(me, t, ctx.want, ctx.give);
          HD.addOpinion(gm.id, HD.me().id, 'traded', 'Did Business With Us', 10, 30);
          return 'Done. Welcome to ' + me.city + ', ' + HD.N(ctx.give[0]) + '.'; } },
        { label: 'Decline.', hint: '', act: function () { return '"Your loss."'; } }
      ]
    };
  }
});
HD.buildAiOffer = function () {
  var G = HD.G, my = HD.myTeam();
  var others = Object.keys(G.teams).filter(function (id) { return id !== my.id; });
  var t = G.teams[HD.pick(others)];
  var mine = HD.sortBy(HD.myPlayers(), HD.tradeValue, true).slice(2, 14);
  if (!mine.length) return null;
  var want = HD.pick(mine);
  var v = HD.tradeValue(want);
  var gm = G.people[t.gmId];
  var mult = 0.95 + HD.opinion(gm.id, G.playerId) / 400;
  var theirs = HD.rosterPlayers(t).filter(function (p) { var tv = HD.tradeValue(p); return tv > v * mult * 0.85 && tv < v * mult * 1.2; });
  if (!theirs.length) return null;
  var give = HD.pick(theirs);
  return { t: t.id, gm: gm.id, want: [want.id], give: [give.id] };
};

HD.defEvent('tampering', {
  weight: function () { return HD.tamperTarget() ? 3 : 0; }, cooldown: 12,
  setup: function () { var p = HD.tamperTarget(); return p ? { p: p.id } : null; },
  view: function (ctx) {
    var p = HD.person(ctx.p), me = HD.me(), t = HD.team(p.teamId);
    return {
      title: 'A Whisper', portraits: [p.id, p.agentId],
      text: 'Word is ' + HD.fullName(p) + ' (' + p.ovr + ' OVR) is miserable with the ' + t.name + ' and their contract expires this summer. Their agent ' + HD.N(p.agentId) + ' is "open to conversations." That would be tampering.',
      options: [
        { label: 'Have a quiet dinner with the agent.', hint: HD.pctText('intrigue', 10) + '. Success: they favour you in free agency. Failure: league fine.', act: function () {
          if (HD.check('intrigue', 10)) { HD.addOpinion(p.id, me.id, 'courted', 'Courted Me', 25, 40); HD.addOpinion(p.agentId, me.id, 'courted', 'Smart Operator', 10, 40); return 'Nothing was said. Everything was understood.'; }
          var team = HD.myTeam(); team.finance.balance -= 2e6; me.prestige -= 6; HD.addOpinion(t.gmId, me.id, 'tamper', 'Tampered With My Player', -35, 104);
          HD.news('League fines the ' + team.name + ' $2M for tampering with ' + HD.fullName(p) + '.', 'scandal', team.id, true); return 'A photo of the dinner surfaces. The league fines the team $2M.'; } },
        { label: 'Stay clean.', hint: '', act: function () { return 'You\'ll compete for them fairly in July.'; } }
      ]
    };
  }
});
HD.tamperTarget = function () {
  var G = HD.G, me = HD.me();
  if (G.phase !== 'regular') return null;
  var cands = [];
  Object.keys(G.teams).forEach(function (id) { if (id === me.teamId) return; HD.rosterPlayers(G.teams[id]).forEach(function (p) { if (p.contract && p.contract.years === 1 && !p.contract.next && p.ovr >= 78 && p.morale < 55) cands.push(p); }); });
  return cands.length ? HD.pick(cands) : null;
};

HD.defEvent('owner_internship', {
  weight: function () { return 2; }, cooldown: 52,
  setup: function () { return { name: HD.pick(['Chad', 'Preston', 'Madison', 'Tripp', 'Brooke', 'Sterling']) }; },
  view: function (ctx) {
    var o = HD.owner(), me = HD.me();
    return {
      title: 'Family Business', portraits: [o.id],
      text: HD.fullName(o) + '\'s kid, ' + ctx.name + ', "loves hockey analytics." The owner wonders if there might be a role in hockey operations.',
      options: [
        { label: 'Create a job for them.', hint: 'Owner +15, team -$200K/yr, scouting staff grumble', act: function () { HD.addOpinion(o.id, me.id, 'hired_kid', 'Hired My Kid', 15, 52); HD.myTeam().finance.balance -= 200000; return ctx.name + ' starts Monday. They bring a ring light.'; } },
        { label: 'Gently explain it\'s not a fit.', hint: HD.pctText('diplomacy', 11) + '. Failure: Owner -10', act: function () { if (HD.check('diplomacy', 11)) return 'The owner laughs. "Honestly? Thank you."'; HD.addOpinion(o.id, me.id, 'snub_kid', 'Snubbed My Kid', -10, 30); return 'An icy silence.'; } }
      ]
    };
  }
});

HD.defEvent('win_streak', {
  weight: function () { var t = HD.myTeam(); return t && t.record.streak >= 5 ? 12 : 0; }, cooldown: 8,
  setup: function () { return {}; },
  view: function () {
    var t = HD.myTeam(), me = HD.me();
    return {
      title: 'The City is Buzzing', portraits: [],
      text: 'The ' + t.name + ' have won ' + t.record.streak + ' straight. Ticket resale prices have doubled. Car flags are back in ' + t.city + '.',
      options: [
        { label: 'Raise ticket prices 10%.', hint: 'More revenue per seat. Owner +5', act: function () { t.ticketPrice = Math.round(t.ticketPrice * 1.1); HD.addOpinion(t.ownerId, me.id, 'pricing', 'Smart Pricing', 5, 12); return 'Supply and demand.'; } },
        { label: 'Fan appreciation night. (Team -$400K)', hint: 'Hype +8', act: function () { t.finance.balance -= 400000; t.finance.season.other += 400000; t.hype += 8; return 'Free jerseys for the first 10,000. Delirium.'; } },
        { label: 'Stay humble. Next game.', hint: 'Players +3', act: function () { HD.myPlayers().forEach(function (p) { HD.addOpinion(p.id, me.id, 'humble_gm', 'Keeps Us Focused', 3, 8); }); return 'One game at a time.'; } }
      ]
    };
  }
});

HD.defEvent('endorsement', {
  weight: function () { return HD.me().prestige >= 40 ? 2 : 0; }, cooldown: 26,
  setup: function () { return { brand: HD.pick(['a luxury watch brand', 'a pickup truck dealership', 'a mattress company', 'Maple Leaf Bank', 'an online sportsbook']) }; },
  view: function (ctx) {
    var me = HD.me(), amt = Math.round((150000 + me.prestige * 6000) / 10000) * 10000;
    return {
      title: 'Your Face Here', portraits: [],
      text: ctx.brand.charAt(0).toUpperCase() + ctx.brand.slice(1) + ' wants you in their next ad campaign. ' + HD.money(amt) + '.',
      options: [
        { label: 'Smile for the camera.', hint: '+' + HD.money(amt) + ', prestige +2' + (ctx.brand.indexOf('sportsbook') >= 0 ? ', Owner -5' : ''), act: function () { me.wealth += amt; me.earnings.bonus += amt; me.prestige += 2; if (ctx.brand.indexOf('sportsbook') >= 0) HD.addOpinion(HD.owner().id, me.id, 'betting_ad', 'Betting Ad', -5, 16); return 'The ad is everywhere. Players chirp you mercilessly.'; } },
        { label: 'Decline.', hint: '', act: function () { return 'You have a team to run.'; } }
      ]
    };
  }
});

HD.defEvent('insider_tip', {
  weight: function () { return 2; }, cooldown: 26,
  setup: function () { var friendOwners = Object.keys(HD.G.teams).map(function (id) { return HD.G.teams[id].ownerId; }).filter(function (o) { return HD.opinion(o, HD.G.playerId) > 10; }); if (!friendOwners.length) return null; return { o: HD.pick(friendOwners), s: HD.pick(HD.COMPANIES).id }; },
  view: function (ctx) {
    var o = HD.person(ctx.o), me = HD.me();
    var c = HD.COMPANIES.filter(function (x) { return x.id === ctx.s; })[0];
    return {
      title: 'Between Friends', portraits: [o.id],
      text: 'Over golf, ' + HD.fullName(o) + ' leans in. "Between you and me, ' + c.name + ' (' + c.id + ') is about to announce something big. If I were you..."',
      options: [
        { label: 'Act on it. (Go to the Markets tab to buy)', hint: 'Shares may jump next week. Risk of an insider trading probe.', act: function () { HD.G.flags.tip = { s: ctx.s, w: 2, up: HD.chance(0.8) }; HD.addOpinion(o.id, me.id, 'golf', 'Golf Buddy', 8, 26); return 'You make a mental note.'; } },
        { label: '"I didn\'t hear that."', hint: 'Honest. ' + o.last + ' +3', act: function () { HD.addOpinion(o.id, me.id, 'golf', 'Golf Buddy', 3, 26); return 'You both laugh and play on.'; } }
      ]
    };
  }
});

HD.defEvent('wedding_invite', {
  weight: function () { return HD.G.flags.weddingInvite ? 25 : 0; },
  setup: function () { var id = HD.G.flags.weddingInvite; HD.G.flags.weddingInvite = null; return id && HD.person(id).teamId === HD.me().teamId ? { p: id } : null; },
  view: function (ctx) {
    var p = HD.person(ctx.p), me = HD.me();
    return {
      title: 'Wedding Bells', portraits: [p.id],
      text: HD.fullName(p) + ' is getting married and has invited you to the wedding.',
      options: [
        { label: 'Attend with a generous gift. ($10K)', hint: p.last + ' +20, teammates +3', act: function () { HD.spend(10000); HD.addOpinion(p.id, me.id, 'wedding', 'Came To My Wedding', 20, 52); HD.myPlayers().forEach(function (x) { if (HD.relation(x.id, p.id) === 'friend') HD.addOpinion(x.id, me.id, 'wedding_friend', 'Good To My Friend', 5, 26); }); return 'You dance badly. Everyone loves it.'; } },
        { label: 'Send a gift. ($3K)', hint: p.last + ' +8', act: function () { HD.spend(3000); HD.addOpinion(p.id, me.id, 'wedding', 'Sent A Gift', 8, 26); return 'A nice card and a KitchenAid.'; } },
        { label: 'Decline — scouting trip.', hint: p.last + ' -5, scouting XP', act: function () { HD.addOpinion(p.id, me.id, 'no_wedding', 'Skipped My Wedding', -5, 20); HD.gainXp('scouting', 15); return 'You watch a junior game in a freezing rink instead.'; } }
      ]
    };
  }
});

HD.defEvent('new_owner', {
  weight: function () { return HD.G.flags.newOwner ? 40 : 0; },
  setup: function () { var id = HD.G.flags.newOwner; HD.G.flags.newOwner = null; return { o: id }; },
  view: function (ctx) {
    var o = HD.person(ctx.o), me = HD.me(), t = HD.myTeam();
    return {
      title: 'A New Boss', portraits: [o.id],
      text: HD.fullName(o) + ', the new owner of the ' + t.name + ', calls you into the office. They look at you like an inherited piece of furniture.',
      options: [
        { label: 'Pledge your loyalty.', hint: 'Owner +15', act: function () { HD.addOpinion(o.id, me.id, 'pledge', 'Pledged Loyalty', 15, 52); return '"Good. I value loyalty."'; } },
        { label: 'Ask for a bigger budget.', hint: HD.pctText('diplomacy', 12) + '. Success: team +$15M. Failure: Owner -10', act: function () { if (HD.check('diplomacy', 12)) { t.finance.balance += 15e6; o.wealth -= 15e6; return 'They wire $15M into operations.'; } HD.addOpinion(o.id, me.id, 'demanding', 'Demanding', -10, 26); return '"We\'ll see about that once you prove yourself."'; } }
      ]
    };
  }
});

HD.defEvent('trade_request', {
  weight: function () { return HD.unhappyPlayer() ? 8 : 0; }, cooldown: 5,
  setup: function () { var p = HD.unhappyPlayer(); if (!p) return null; p.requested = HD.G.season; return { p: p.id }; },
  view: function (ctx) {
    var p = HD.person(ctx.p), me = HD.me();
    return {
      title: 'Trade Request', portraits: [p.id, p.agentId],
      text: HD.fullName(p) + ' storms into your office. "I want out. Trade me." (Opinion of you: ' + HD.opinion(p.id, me.id) + ', morale ' + p.morale + ')',
      options: [
        { label: 'Talk it out.', hint: HD.pctText('diplomacy', 10) + '. Success +20 & morale. Failure -10', act: function () { if (HD.check('diplomacy', 10)) { HD.addOpinion(p.id, me.id, 'heart_to_heart', 'Heart To Heart', 20, 26); p.morale += 20; return 'An hour later, they leave with a new attitude.'; } HD.addOpinion(p.id, me.id, 'not_listening', 'Doesn\'t Listen', -10, 20); return 'It goes badly.'; } },
        { label: '"I\'ll see what I can do."', hint: p.last + ' +10. You\'ll want to deal them.', act: function () { HD.addOpinion(p.id, me.id, 'respected', 'Respected My Request', 10, 20); p.morale += 5; return 'They nod. The clock is ticking.'; } },
        { label: '"You\'re under contract. Play."', hint: p.last + ' -15, friends -5', act: function () { HD.addOpinion(p.id, me.id, 'refused', 'Refused My Request', -15, 30); p.morale -= 10; HD.myPlayers().forEach(function (x) { if (HD.relation(x.id, p.id) === 'friend') HD.addOpinion(x.id, me.id, 'harsh_friend', 'Harsh With My Friend', -5, 16); }); return 'The door slams.'; } }
      ]
    };
  }
});
HD.unhappyPlayer = function () {
  var G = HD.G, me = HD.me();
  return HD.myPlayers().filter(function (p) { return p.morale < 32 && HD.opinion(p.id, me.id) < -15 && p.requested !== G.season; })[0];
};

HD.defEvent('job_offer', {
  weight: function () { var ph = HD.G.phase; return HD.me().prestige >= 45 && (ph === 'freeagency' || ph === 'preseason' || ph === 'awards') ? 3 : 0; }, cooldown: 30,
  setup: function () {
    var G = HD.G, me = HD.me();
    var cands = Object.keys(G.teams).filter(function (id) { return id !== me.teamId; });
    var t = G.teams[HD.pick(cands)];
    return { t: t.id, salary: Math.round(me.contract.salary * HD.randFloat(1.3, 1.7) / 50000) * 50000 };
  },
  view: function (ctx) {
    var t = HD.team(ctx.t), o = HD.person(t.ownerId), me = HD.me(), my = HD.owner();
    return {
      title: 'Poached?', portraits: [o.id],
      text: HD.fullName(o) + ', owner of the ' + HD.teamName(t) + ', calls your private cell. "I want you running my team. ' + HD.money(ctx.salary) + ' a year, five years. I\'ll fire my GM tomorrow."',
      options: [
        { label: 'Accept. Move to ' + t.city + '.', hint: 'New team, new owner, new expectations.', act: function () { HD.switchTeam(t.id, ctx.salary); return 'You hold the press conference at ' + t.arena + '.'; } },
        { label: 'Use it as leverage with your owner.', hint: HD.pctText('diplomacy', 11) + '. Success: +25% salary. Failure: Owner -15', act: function () { if (HD.check('diplomacy', 11)) { me.contract.salary = Math.round(me.contract.salary * 1.25 / 50000) * 50000; me.contract.years = Math.max(me.contract.years, 3); return HD.fullName(my) + ' matches. Raise to ' + HD.money(me.contract.salary) + '.'; } HD.addOpinion(my.id, me.id, 'disloyal', 'Shopping Yourself', -15, 40); return '"If you want to leave, there\'s the door."'; } },
        { label: 'Decline out of loyalty.', hint: 'Your owner +12 (if they hear about it)', act: function () { HD.addOpinion(my.id, me.id, 'loyal_gm', 'Turned Down Offers', 12, 52); return 'Word gets back to your owner. They\'re touched.'; } }
      ]
    };
  }
});

HD.defEvent('ref_rage', {
  weight: function () { var t = HD.myTeam(); return t && t.lastGameLoss && HD.G.phase !== 'preseason' ? 2 : 0; }, cooldown: 10,
  setup: function () { return {}; },
  view: function () {
    var me = HD.me(), comm = HD.person(HD.G.commissionerId);
    return {
      title: 'Robbed', portraits: [],
      text: 'A blown offside review cost you the game last night. The post-game presser is in five minutes.',
      options: [
        { label: 'Unload on the officials.', hint: 'Fined $50K. Players +5, Commissioner -12', act: function () { HD.spend(50000); HD.myPlayers().forEach(function (p) { HD.addOpinion(p.id, me.id, 'defended_us', 'Stood Up For Us', 5, 10); }); HD.addOpinion(comm.id, me.id, 'ref_rant', 'Criticised Officials', -12, 26); return 'Worth every penny.'; } },
        { label: '"No comment on the officiating."', hint: 'Diplomacy XP', act: function () { HD.gainXp('diplomacy', 8); return 'You bite your tongue until it bleeds.'; } }
      ]
    };
  }
});

HD.defEvent('kid_hockey', {
  weight: function () { return (HD.me().childIds || []).some(function (id) { return HD.person(id).age >= 6 && HD.person(id).age <= 17; }) ? 2 : 0; }, cooldown: 26,
  setup: function () { var kids = HD.me().childIds.filter(function (id) { return HD.person(id).age >= 6 && HD.person(id).age <= 17; }); return { k: HD.pick(kids) }; },
  view: function (ctx) {
    var k = HD.person(ctx.k), me = HD.me();
    return {
      title: 'Hockey Parent', portraits: [k.id],
      text: k.first + ' (' + k.age + ') asks if you\'ll help coach their team this weekend. Everyone at the rink knows who you are.',
      options: [
        { label: 'Lace up and coach.', hint: k.first + ' +20, stress -10, Tactics XP', act: function () { HD.addOpinion(k.id, me.id, 'coached_me', 'Coached My Team', 20, 52); me.stress = Math.max(0, me.stress - 10); HD.gainXp('tactics', 10); return 'You lose 7-2 and it\'s the best day of your month.'; } },
        { label: 'Buy them the best gear. ($5K)', hint: k.first + ' +8', act: function () { HD.spend(5000); HD.addOpinion(k.id, me.id, 'gear', 'Bought Me Gear', 8, 26); return 'They look like a pro.'; } },
        { label: 'Too busy this week.', hint: k.first + ' -12', act: function () { HD.addOpinion(k.id, me.id, 'too_busy', 'Always Too Busy', -12, 40); return 'They don\'t ask again.'; } }
      ]
    };
  }
});

HD.defEvent('foundation_match', {
  weight: function () { return HD.myPlayers().some(function (p) { return p.traits.indexOf('generous') >= 0; }) ? 2 : 0; }, cooldown: 26,
  setup: function () { var ps = HD.myPlayers().filter(function (p) { return p.traits.indexOf('generous') >= 0; }); return ps.length ? { p: HD.pick(ps).id } : null; },
  view: function (ctx) {
    var p = HD.person(ctx.p), me = HD.me();
    return {
      title: 'Matching Gift', portraits: [p.id],
      text: HD.fullName(p) + ' is launching a foundation in ' + HD.myTeam().city + ' and asks if you\'d personally match their $100K donation.',
      options: [
        { label: 'Match it. ($100K)', hint: p.last + ' +20, prestige +3', disabled: !HD.canAfford(100000), act: function () { HD.spend(100000); HD.addOpinion(p.id, me.id, 'matched', 'Matched My Gift', 20, 52); me.prestige += 3; return 'Big cheque, bigger smiles.'; } },
        { label: 'Decline.', hint: p.last + ' -5', act: function () { HD.addOpinion(p.id, me.id, 'no_match', 'Wouldn\'t Help', -5, 20); return '"No worries," they say. It sounds like worries.'; } }
      ]
    };
  }
});

HD.defEvent('owners_summit', {
  weight: function () { return HD.G.phase === 'freeagency' || HD.G.phase === 'awards' ? 4 : 0; }, cooldown: 30,
  setup: function () { return {}; },
  view: function () {
    var me = HD.me(), comm = HD.person(HD.G.commissionerId), t = HD.myTeam();
    return {
      title: 'Board of Governors', portraits: [comm.id],
      text: 'At the league meetings in Palm Beach, Commissioner ' + HD.fullName(comm) + ' asks GMs for input on revenue sharing. Small-market clubs are bleeding; big-market owners don\'t want to subsidize them.',
      options: [
        { label: 'Push for more revenue sharing.', hint: HD.pctText('diplomacy', 11) + '. Small-market owners +, big-market owners -. TV pool grows.', act: function () { if (HD.check('diplomacy', 11)) { HD.G.league.tvDeal *= 1.08; Object.keys(HD.G.teams).forEach(function (id) { var tt = HD.G.teams[id]; HD.addOpinion(tt.ownerId, me.id, 'rev_share', tt.market <= 5 ? 'Champion Of Small Markets' : 'Wants My Money', tt.market <= 5 ? 12 : -8, 52); }); return 'The motion passes. Hartford\'s owner buys you a drink.'; } return 'The motion dies in committee.'; } },
        { label: 'Argue for a higher salary cap.', hint: HD.pctText('diplomacy', 12) + '. Cap +3%. Players & agents love you.', act: function () { if (HD.check('diplomacy', 12)) { HD.G.league.cap = Math.round(HD.G.league.cap * 1.03); HD.G.agents.forEach(function (a) { HD.addOpinion(a, me.id, 'cap_up', 'Raised The Cap', 10, 52); }); return 'Cap goes up. Agents send you fruit baskets.'; } return 'Owners laugh you out of the room.'; } },
        { label: 'Keep your head down and network.', hint: 'Diplomacy & Intrigue XP', act: function () { HD.gainXp('diplomacy', 15); HD.gainXp('intrigue', 15); return 'You learn who\'s sleeping with whose cap consultant.'; } }
      ]
    };
  }
});

HD.defEvent('legend_visit', {
  weight: function () { return HD.G.phase === 'regular' ? 1.5 : 0; }, cooldown: 30,
  setup: function () { return { n: HD.pick(['"Big Mike" Tremblay', 'Sven "The Wall" Lindqvist', 'Bobby Callahan', 'Dmitri Volkov Sr.']) }; },
  view: function (ctx) {
    var me = HD.me();
    return {
      title: 'A Legend Visits', portraits: [],
      text: 'Hall-of-Famer ' + ctx.n + ' is in town and offers to speak to the team before tonight\'s game.',
      options: [
        { label: 'Invite them in. ($25K appearance fee)', hint: 'All players morale +8', act: function () { HD.myTeam().finance.balance -= 25000; HD.myPlayers().forEach(function (p) { p.morale = Math.min(100, p.morale + 8); }); return 'The room is silent, then roaring.'; } },
        { label: 'Thanks, but we have our routine.', hint: '', act: function () { return 'Superstition wins.'; } }
      ]
    };
  }
});

HD.defEvent('veteran_slump', {
  weight: function () { return HD.slumpingVet() ? 3 : 0; }, cooldown: 10,
  setup: function () { var p = HD.slumpingVet(); return p ? { p: p.id } : null; },
  view: function (ctx) {
    var p = HD.person(ctx.p), me = HD.me(), c = HD.person(HD.myTeam().coachId);
    return {
      title: 'Ice Cold', portraits: [p.id, c.id],
      text: HD.fullName(p) + ' has ' + p.stats.g + ' goals in ' + p.stats.gp + ' games. Coach ' + c.last + ' wants to bench them. ' + p.first + ' has been in the league ' + (p.age - 19) + ' years.',
      options: [
        { label: 'Scratch them.', hint: 'Sent to press box. ' + p.last + ' -15, Coach +10', act: function () { p.slot = 'X'; HD.patchLines(HD.myTeam()); HD.addOpinion(p.id, me.id, 'benched', 'Benched Me', -15, 20); HD.addOpinion(c.id, me.id, 'backed_coach', 'Backed Me', 10, 20); return 'The veteran watches from the press box.'; } },
        { label: 'Publicly back them.', hint: p.last + ' +12, form +3, Coach -8', act: function () { HD.addOpinion(p.id, me.id, 'backed', 'Believed In Me', 12, 20); p.form += 3; HD.addOpinion(c.id, me.id, 'overruled', 'Overruled Me', -8, 20); return '"' + p.first + ' is a big part of what we do here."'; } }
      ]
    };
  }
});
HD.slumpingVet = function () { return HD.myPlayers().filter(function (p) { return p.age >= 30 && p.pos !== 'G' && p.pos !== 'D' && p.stats.gp >= 15 && p.stats.g <= 1 && p.slot !== 'X'; })[0]; };

HD.defEvent('rival_scheme', {
  weight: function () { var r = HD.myRivalGm(); return r && HD.opinion(r, HD.G.playerId) < -30 ? 3 : 0; }, cooldown: 14,
  setup: function () {
    var r = HD.myRivalGm(), me = HD.me(), o = HD.owner();
    if (!r || !o) return null;
    var rival = HD.person(r);
    // Your rival schemes; your intrigue decides whether you catch it in time
    var caught = HD.chance(HD.checkChance('intrigue', 9));
    if (!caught) HD.addOpinion(o.id, me.id, 'rumours', 'Rumours From ' + rival.last, -10, 20);
    return { r: r, caught: caught };
  },
  view: function (ctx) {
    var r = HD.person(ctx.r), me = HD.me(), o = HD.owner();
    var j = HD.person(HD.G.journalists[0]);
    return {
      title: 'Whispers', portraits: [r.id, o.id],
      text: ctx.caught
        ? 'A friend in ' + HD.teamName(HD.team(r.teamId)) + '\'s front office tips you off: ' + HD.fullName(r) + ' has been calling your owner\'s business partners, suggesting you\'re "in over your head." You caught it before it reached ' + o.first + '.'
        : HD.fullName(o) + ' asks you, a little too casually, whether the rumours are true — that the room has turned on you. The source? Your old rival, ' + HD.fullName(r) + '.',
      options: [
        { label: 'Confront ' + r.first + ' directly.', hint: 'Rival -10. Prestige +2 if you have the better record.', act: function () {
          HD.addOpinion(r.id, me.id, 'confronted', 'Confronted Me', -10, 26);
          var mt = HD.myTeam(), rt = HD.team(r.teamId);
          if ((HD.teamPct(mt) || 0.5) >= (HD.teamPct(rt) || 0.5)) { me.prestige += 2; return '"Look at the standings, ' + r.last + '." They have no answer.'; }
          return 'They just smile. "Results speak, ' + me.last + '."'; } },
        { label: 'Reassure your owner over dinner. ($5K)', hint: HD.pctText('diplomacy', 9) + '. Success: Owner +10.', act: function () {
          HD.spend(5000);
          if (HD.check('diplomacy', 9)) { HD.addOpinion(o.id, me.id, 'reassured', 'Reassured Me', 10, 20); return o.first + ' laughs it off. "Rivals. I\'ve had a few."'; }
          return o.first + ' still seems uneasy.'; } },
        { label: 'Return the favour through ' + HD.fullName(j) + '.', hint: HD.pctText('intrigue', 11) + '. Hurts their job security. Failure: Prestige -6.', act: function () {
          if (HD.check('intrigue', 11)) { var rt = HD.team(r.teamId); if (rt) rt.gmHeat = (rt.gmHeat || 0) + 0.35; HD.news(j.outlet + ': "Front-office turmoil in ' + (rt ? rt.city : '') + ' as GM ' + HD.fullName(r) + '\'s methods questioned."', 'press', r.teamId, true); return 'Two can play this game.'; }
          me.prestige -= 6; return 'The story doesn\'t land, and people notice you tried.'; } }
      ]
    };
  }
});

HD.defEvent('owner_meddle', {
  weight: function () { var G = HD.G; return G.phase === 'regular' && G.week <= HD.CAL.DEADLINE - 5 && !(G.flags.demand && G.flags.demand.season === G.season) ? 3 : 0; }, cooldown: 30,
  setup: function () {
    var t = HD.myTeam();
    var best = HD.sortBy(HD.myPlayers(), function (p) { return p.ovr; }, true)[0];
    var target = HD.clamp(Math.max(80, (best ? best.ovr : 78) - 2), 80, 88);
    return { ovr: target };
  },
  view: function (ctx) {
    var o = HD.owner(), me = HD.me(), G = HD.G;
    return {
      title: 'The Owner Wants a Star', portraits: [o.id],
      text: HD.fullName(o) + ' calls during dinner. "My friends at the club keep asking why we don\'t have a real star. I want a big name — ' + ctx.ovr + '+ overall — brought in before the trade deadline (week ' + HD.CAL.DEADLINE + '). Make it happen."',
      options: [
        { label: '"I\'m already working the phones."', hint: 'Owner +5 now. Deliver by the deadline for +20, or -20 if you don\'t.', act: function () {
          G.flags.demand = { season: G.season, ovr: ctx.ovr, since: G.absWeek };
          HD.addOpinion(o.id, me.id, 'on_it', 'On It', 5, 8);
          return 'You hang up and stare at the trade screen.'; } },
        { label: '"Stars cost assets. Trust the plan."', hint: HD.pctText('diplomacy', 11) + '. Failure: Owner -12.', act: function () {
          if (HD.check('diplomacy', 11)) return '"Fine. But this better work."';
          HD.addOpinion(o.id, me.id, 'stubborn', 'Ignored My Wishes', -12, 26); return 'A long silence, then a dial tone.'; } }
      ]
    };
  }
});

// Resolve the owner's star demand at the trade deadline.
HD.checkOwnerDemand = function () {
  var G = HD.G, d = G.flags.demand, me = HD.me(), o = HD.owner();
  if (!d || d.season !== G.season || d.done || !o) return;
  d.done = true;
  var star = HD.myPlayers().filter(function (p) { return p.ovr >= d.ovr && (p.joined || 0) >= d.since; })[0];
  if (star) { HD.addOpinion(o.id, me.id, 'got_star', 'Landed A Star', 20, 40); HD.chronicle('Your owner is thrilled you landed ' + HD.fullName(star) + '.'); }
  else { HD.addOpinion(o.id, me.id, 'no_star', 'Didn\'t Get Me A Star', -20, 30); HD.chronicle('The deadline passed without the star your owner demanded. They are not pleased.'); }
};

// ---------- Event scheduler ----------
HD.queueEvent = function (id, ctx) {
  if (ctx === undefined) ctx = HD.EVENTS[id].setup();
  if (ctx === null || ctx === undefined) return false;
  HD.G.pendingEvents.push({ id: id, ctx: ctx });
  return true;
};

HD.rollRandomEvents = function () {
  var G = HD.G;
  if (!HD.me().teamId) return;
  var n = HD.chance(0.65) ? 1 : 0;
  if (HD.chance(0.2)) n++;
  // Flag-driven events always fire
  ['party_scandal', 'wedding_invite', 'new_owner'].forEach(function (id) { if (HD.EVENTS[id].weight() > 0) HD.queueEvent(id); });
  for (var i = 0; i < n; i++) {
    var avail = Object.keys(HD.EVENTS).filter(function (id) {
      var e = HD.EVENTS[id];
      if (e.scripted) return false;
      if (G.eventCd[id] && G.eventCd[id] > G.absWeek) return false;
      return e.weight() > 0;
    });
    var id = HD.weightedPick(avail, function (x) { return HD.EVENTS[x].weight(); });
    if (!id) return;
    if (HD.queueEvent(id)) G.eventCd[id] = G.absWeek + (HD.EVENTS[id].cooldown || 4);
  }
};
