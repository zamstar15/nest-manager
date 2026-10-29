// Character interactions available from a person's sheet.
var HD = HD || {};

HD.giftCost = function (p) {
  var base = { player: 8000, coach: 10000, gm: 20000, owner: 120000, journalist: 2500, agent: 15000, spouse: 5000, child: 500, commissioner: 60000, prospect: 2000 }[p.role] || 5000;
  if (p.role === 'player' && p.contract) base = Math.max(base, p.contract.salary * 0.004);
  return Math.round(base / 500) * 500;
};

HD.cdReady = function (p, key, weeks) { var G = HD.G; p.cds = p.cds || {}; return !p.cds[key] || G.absWeek - p.cds[key] >= weeks; };
HD.setCd = function (p, key) { p.cds = p.cds || {}; p.cds[key] = HD.G.absWeek; };
HD.cdLeft = function (p, key, weeks) { p.cds = p.cds || {}; return p.cds[key] ? weeks - (HD.G.absWeek - p.cds[key]) : 0; };

HD.interactions = function (p) {
  var G = HD.G, me = HD.me(), team = HD.myTeam();
  if (!p || p.id === me.id || !p.alive) return [];
  var list = [];
  var op = HD.opinion(p.id, me.id);
  var rel = HD.relation(me.id, p.id);
  var mine = team && p.teamId === team.id;
  var add = function (o) { list.push(o); };

  add({ id: 'chat', label: '💬 Have a chat', hint: 'Small opinion gain based on Diplomacy.', cd: ['chat', 4],
    act: function () {
      var gain = 3 + me.skills.diplomacy * 0.55 + HD.randInt(-2, 3);
      if (p.traits.indexOf('shy') >= 0) gain *= 0.5;
      if (p.traits.indexOf('gregarious') >= 0) gain *= 1.4;
      gain = Math.round(gain);
      HD.addOpinion(p.id, me.id, 'chats', 'Pleasant Conversations', gain, 26, { stack: true, max: 25 });
      HD.gainXp('diplomacy', 4);
      var extra = '';
      if (HD.chance(0.2)) {
        var friends = Object.keys(p.relations).filter(function (k) { return p.relations[k] === 'rival'; });
        if (friends.length) extra = ' They let slip that they can\'t stand ' + HD.N(friends[0]) + '.';
      }
      return 'You talk for a while. Opinion +' + gain + '.' + extra;
    } });

  var cost = HD.giftCost(p);
  add({ id: 'gift', label: '🎁 Send a gift (' + HD.money(cost) + ')', hint: 'Greedy people love gifts.', cd: ['gift', 8], disabled: !HD.canAfford(cost) && 'Not enough money',
    act: function () {
      HD.spend(cost);
      var v = p.traits.indexOf('greedy') >= 0 ? 22 : p.traits.indexOf('generous') >= 0 ? 8 : 14;
      HD.addOpinion(p.id, me.id, 'gift', 'Received Gifts', v, 30, { stack: true, max: 35 });
      return HD.pick(['A case of 25-year Scotch.', 'Courtside seats to the basketball game.', 'A custom watch, engraved.', 'A weekend at a lake lodge.']) + ' Opinion +' + v + '.';
    } });

  add({ id: 'dinner', label: '🍽️ Invite to dinner ($3K)', hint: 'Opinion +8, your stress -3. Gregarious people love it.', cd: ['dinner', 6],
    act: function () {
      HD.spend(3000);
      var v = p.traits.indexOf('gregarious') >= 0 ? 14 : p.traits.indexOf('shy') >= 0 ? 4 : 8;
      HD.addOpinion(p.id, me.id, 'dinner', 'Dinner Together', v, 20, { stack: true, max: 20 });
      me.stress = Math.max(0, me.stress - 3);
      return 'Steaks, stories, and a bottle of red. Opinion +' + v + '.';
    } });

  if (!rel || rel === 'rival') {
    if (rel !== 'rival') add({ id: 'befriend', label: '🤝 Befriend', hint: 'Requires opinion 30+. ' + HD.pctText('diplomacy', 9), cd: ['befriend', 12], disabled: op < 30 && 'Opinion must be 30+ (is ' + op + ')',
      act: function () {
        if (HD.check('diplomacy', 9)) { HD.setRelation(me.id, p.id, 'friend'); HD.chronicle('You became friends with ' + HD.fullName(p) + '.'); return 'You are now friends with ' + p.first + '.'; }
        HD.addOpinion(p.id, me.id, 'trying', 'Trying Too Hard', -5, 12); return 'It\'s awkward. Maybe another time.';
      } });
    else add({ id: 'reconcile', label: '🕊️ Bury the hatchet', hint: HD.pctText('diplomacy', 13) + ' to end the rivalry.', cd: ['reconcile', 26],
      act: function () {
        if (HD.check('diplomacy', 13)) { HD.setRelation(me.id, p.id, null); HD.addOpinion(p.id, me.id, 'peace', 'Made Peace', 10, 52); return 'A handshake. The rivalry is over.'; }
        HD.addOpinion(p.id, me.id, 'rebuffed', 'Fake Olive Branch', -10, 26); return 'They laugh in your face.';
      } });
  }
  if (rel === 'friend') add({ id: 'unfriend', label: '💔 End friendship', hint: 'Opinion -30', act: function () { HD.setRelation(me.id, p.id, null); HD.addOpinion(p.id, me.id, 'betrayed', 'Ended Our Friendship', -30, 52); return 'You drift apart.'; } });
  if (!rel && (p.role === 'gm' || p.role === 'owner' || p.role === 'journalist' || p.role === 'agent')) add({ id: 'rival', label: '⚔️ Declare rivalry', hint: 'Make it personal. Some fans love a feud (+hype).', act: function () { HD.setRelation(me.id, p.id, 'rival'); if (team) team.hype = HD.clamp(team.hype + 2, 0, 100); HD.news(HD.fullName(me) + ' and ' + HD.fullName(p) + ' are openly feuding.', 'social', me.teamId); return 'It\'s on.'; } });

  // ----- Own players -----
  if (mine && p.role === 'player') {
    add({ id: 'praise', label: '📣 Praise publicly', hint: 'Opinion +10, morale +8. Arrogant teammates get jealous.', cd: ['praise', 6],
      act: function () {
        HD.addOpinion(p.id, me.id, 'praised', 'Praised Me', 10, 16, { stack: true, max: 20 }); p.morale = Math.min(100, p.morale + 8);
        HD.myPlayers().forEach(function (x) { if (x !== p && x.traits.indexOf('arrogant') >= 0 && x.ovr >= p.ovr) HD.addOpinion(x.id, me.id, 'jealous', 'Praised Someone Else', -4, 10); });
        return '"' + p.first + ' is the heart of this team."';
      } });
    add({ id: 'criticize', label: '🗯️ Criticize publicly', hint: 'Morale -10, opinion -12. Diligent or ambitious players may respond with better form.', cd: ['praise', 6],
      act: function () {
        HD.addOpinion(p.id, me.id, 'criticized', 'Called Me Out', -12, 20, { stack: true, max: 30 }); p.morale = Math.max(0, p.morale - 10);
        if (p.traits.indexOf('diligent') >= 0 || p.traits.indexOf('ambitious') >= 0) { p.form = HD.clamp(p.form + 5, -10, 10); return p.first + ' is fuming — and goes out and plays the best hockey of the season.'; }
        if (p.traits.indexOf('hotheaded') >= 0 && HD.chance(0.5)) { HD.addOpinion(p.id, me.id, 'blowup', 'Public Blow-Up', -10, 20); HD.news(HD.fullName(p) + ' fires back at ' + HD.fullName(me) + ': "Look in the mirror."', 'scandal', team.id); return 'They fire back in the media. Ugly.'; }
        return 'The message is received. Grudgingly.';
      } });
    if (team.captainId !== p.id) add({ id: 'captain', label: '©️ Name captain', hint: 'Big honour. Opinion +20. Other leaders may be jealous. Captain boosts chemistry.',
      act: function () {
        var old = team.captainId && HD.person(team.captainId);
        if (old && old.teamId === team.id) HD.addOpinion(old.id, me.id, 'stripped', 'Stripped The C', -25, 52);
        team.captainId = p.id;
        HD.addOpinion(p.id, me.id, 'captain', 'Named Me Captain', 20, 104);
        HD.myPlayers().forEach(function (x) { if (x !== p && x.traits.indexOf('leader') >= 0 && x !== old) HD.addOpinion(x.id, me.id, 'passed_over', 'Passed Over For Captain', -8, 26); });
        HD.news(HD.fullName(p) + ' named captain of the ' + team.name + '.', 'roster', team.id, true);
        return p.first + ' will wear the C.';
      } });
    if (p.age >= 29 && !Object.keys(p.relations).some(function (k) { return p.relations[k] === 'mentor'; })) {
      var kid = HD.sortBy(HD.myPlayers().filter(function (x) { return x.age <= 23 && HD.groupOf(x) === HD.groupOf(p) && !Object.keys(x.relations).some(function (k) { return x.relations[k] === 'protege'; }); }), function (x) { return x.pot; }, true)[0];
      if (kid) add({ id: 'mentor', label: '🎓 Mentor ' + HD.fullName(kid), hint: 'Faster development for the youngster. Requires veteran opinion of you 0+.', disabled: op < 0 && 'They won\'t do you favours',
        act: function () { HD.setRelation(p.id, kid.id, 'mentor'); HD.addOpinion(kid.id, me.id, 'mentor', 'Found Me A Mentor', 8, 26); return p.first + ' takes ' + kid.first + ' under their wing.'; } });
    }
    add({ id: 'negotiate', label: '✍️ Contract talks', hint: 'Open negotiation.', ui: 'contract' });
    add({ id: 'release', label: '🚪 Buy out & release', hint: 'Costs 50% of remaining salary from team funds.', ui: 'release' });
  }
  if (!p.teamId && p.role === 'player') add({ id: 'sign', label: '✍️ Offer contract', hint: 'Free agent.', ui: 'contract' });
  if (p.role === 'prospect' && mine) add({ id: 'callup', label: '⬆️ Call up to roster', hint: 'Entry-level deal: $925K x 3.', ui: 'callup' });

  // ----- Own staff -----
  if (mine && p.role === 'coach') add({ id: 'fire_coach', label: '🔥 Fire coach', hint: 'Pick a replacement from available coaches.', ui: 'hire_coach' });
  if (mine && p.role === 'owner') {
    add({ id: 'budget', label: '💵 Request budget injection', hint: HD.pctText('diplomacy', 12) + '. Success: +$10M team funds. Always Owner -5.', cd: ['budget', 26],
      act: function () {
        HD.addOpinion(p.id, me.id, 'asked_money', 'Asked For Money', -5, 16);
        if (op >= 10 && HD.check('diplomacy', 12)) { team.finance.balance += 10e6; p.wealth -= 10e6; return 'A wire for $10M hits the operating account.'; }
        return '"Spend what you have more wisely."';
      } });
    add({ id: 'stake', label: '📜 Discuss buying equity', hint: 'See the Finances tab.', ui: 'finance' });
  }
  // ----- Press -----
  if (p.role === 'journalist') {
    add({ id: 'leak', label: '🕵️ Leak a story about your rival', hint: HD.pctText('intrigue', 10) + '. Damages a rival GM\'s job security.', cd: ['leak', 10], disabled: !HD.myRivalGm() && 'You have no rival GM',
      act: function () {
        var r = HD.person(HD.myRivalGm());
        var rt = HD.team(r.teamId);
        if (HD.check('intrigue', 10)) { rt.gmHeat = (rt.gmHeat || 0) + 0.3; HD.addOpinion(p.id, me.id, 'source', 'Good Source', 10, 26); HD.news(p.outlet + ': "Sources: ' + rt.name + ' owner losing patience with ' + HD.fullName(r) + '."', 'press', rt.id); return 'The story runs. ' + r.last + '\'s phone must be ringing.'; }
        me.prestige -= 5; HD.addOpinion(r.id, me.id, 'leaker', 'Leaked About Me', -20, 52); return 'The leak is traced to you. Prestige -5.';
      } });
    add({ id: 'bribe', label: '💸 Buy favourable coverage ($50K)', hint: 'Honest journalists will expose you.', cd: ['bribe', 26], disabled: !HD.canAfford(50000) && 'Not enough money',
      act: function () {
        HD.spend(50000);
        if (p.traits.indexOf('honest') >= 0) { me.prestige -= 10; HD.addOpinion(p.id, me.id, 'bribe_attempt', 'Tried To Bribe Me', -40, 104); HD.news(p.outlet + ' reports that ' + HD.fullName(me) + ' offered money for favourable coverage.', 'scandal', me.teamId, true); return 'They publish your offer. Disaster.'; }
        HD.addOpinion(p.id, me.id, 'payroll', 'On Your Payroll', 35, 40); return 'Coverage of the team is about to get much friendlier.';
      } });
  }
  if (p.role === 'gm' && p.teamId && p.teamId !== me.teamId) add({ id: 'trade', label: '🔁 Discuss a trade', hint: 'Open the trade screen.', ui: 'trade' });
  if (p.role === 'spouse') add({ id: 'date', label: '❤️ Date night ($1K)', hint: 'Spouse +10, stress -6', cd: ['date', 3], act: function () { HD.spend(1000); HD.addOpinion(p.id, me.id, 'date', 'Quality Time', 10, 12, { stack: true, max: 25 }); me.stress = Math.max(0, me.stress - 6); return 'You turn off your phone. Mostly.'; } });

  list.forEach(function (o) {
    if (o.cd && !HD.cdReady(p, o.cd[0], o.cd[1])) o.disabled = 'Available in ' + HD.cdLeft(p, o.cd[0], o.cd[1]) + ' wk';
  });
  return list;
};

HD.runInteraction = function (pid, iid) {
  var p = HD.person(pid);
  var it = HD.interactions(p).filter(function (x) { return x.id === iid; })[0];
  if (!it || it.disabled || !it.act) return null;
  if (it.cd) HD.setCd(p, it.cd[0]);
  return it.act();
};
