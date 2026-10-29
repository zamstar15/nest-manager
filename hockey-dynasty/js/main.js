// Input handling and boot.
(function () {
  var U = HD.UI;
  var rerender = function () { HD.UI.render(); };
  var saveAndRender = function () { HD.save(); HD.UI.render(); };

  var A = U.actions = {
    tab: function (d) { U.tab = d.tab; U.close(); window.scrollTo(0, 0); },
    sub: function (d) { U.sub[d.page] = d.sub; rerender(); },
    person: function (d) { U.showPerson(d.id); },
    team: function (d) { U.showTeam(d.id); },
    closeModal: function () { U.close(); if (U.afterClose) { var f = U.afterClose; U.afterClose = null; f(); } },
    closeModalBg: function (d, el, ev) { if (ev.target === el) A.closeModal(); },
    menu: function () { U.showMenu(); },
    save: function () { U.toast(HD.save() ? 'Game saved.' : 'Could not save (storage full or blocked).'); },
    exportSave: function () {
      var blob = new Blob([JSON.stringify(HD.G)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'hockey-dynasty-' + HD.G.season + '-w' + HD.G.week + '.json'; a.click();
    },
    newGame: function () { if (!HD.G || HD.G.gameOver || confirm('Abandon this career and start over?')) { HD.deleteSave(); HD.G = null; U.modal = null; U.tab = 'office'; rerender(); } },
    loadGame: function () { if (HD.load()) { U.tab = 'office'; rerender(); if (HD.G.pendingEvents.length && U.tab !== 'office') U.showEvent(); } else U.toast('Save could not be loaded.'); },
    retire: function () { if (confirm('Retire from hockey for good?')) { HD.endCareer('You retired from hockey.'); saveAndRender(); } },

    // Start screen
    pickBg: function (d) { U.setup.background = d.id; rerender(); },
    pickTeam: function (d) { U.setup.teamId = d.id; rerender(); },
    pickTrait: function (d) {
      var S = U.setup, i = S.traits.indexOf(d.id);
      if (i >= 0) S.traits.splice(i, 1);
      else {
        var opp = HD.TRAITS[d.id].opp;
        S.traits = S.traits.filter(function (t) { return t !== opp; });
        S.traits.push(d.id);
        if (S.traits.length > 2) S.traits.shift();
      }
      rerender();
    },
    startGame: function () {
      HD.newGame(U.setup);
      HD.save();
      U.tab = 'office';
      rerender();
      if (U.tab !== 'office') U.showEvent();
    },

    // Calendar
    advance: function () {
      if (!HD.canAdvance()) { U.showEvent(); return; }
      var r = HD.advanceWeek();
      HD.save();
      rerender();
      if (HD.G.gameOver) return;
      var hasReport = r && (r.games.length || r.series.length || r.news.some(function (n) { return n.major || n.team === HD.me().teamId; }));
      // In the office, visitors walk in and the phone rings instead of popping dialogs straight away
      var inOffice = U.tab === 'office';
      if (hasReport) { U.showReport(r); if (HD.G.pendingEvents.length && !inOffice) U.afterClose = U.showEvent; }
      else if (HD.G.pendingEvents.length && !inOffice) U.showEvent();
    },
    openEvent: function () { if (HD.G.pendingEvents.length) U.showEvent(); },
    eventOpt: function (d) { U.chooseEventOption(+d.i); },
    eventDone: function () {
      if (HD.G.pendingEvents.length && U.tab !== 'office') U.showEvent();
      else { U.close(); }
    },

    // People
    interact: function (d) { U.doInteraction(d.id, d.i); },
    confirmRelease: function (d) {
      var p = HD.person(d.id), cost = HD.releasePlayer(p);
      HD.myPlayers().forEach(function (x) { if (HD.relation(x.id, p.id) === 'friend') HD.addOpinion(x.id, HD.me().id, 'cut_friend', 'Released My Friend', -10, 20); });
      HD.patchLines(HD.myTeam());
      HD.chronicle('You bought out ' + HD.fullName(p) + ' for ' + HD.money(cost) + '.');
      U.close(); HD.save(); U.toast(HD.fullName(p) + ' released.');
    },
    hireCoach: function (d) {
      var t = HD.myTeam(), old = HD.person(t.coachId), me = HD.me();
      HD.addOpinion(old.id, me.id, 'fired_me', 'Fired Me', -50, -1);
      HD.myPlayers().forEach(function (p) { if (HD.opinion(p.id, old.id) > 20 || p.traits.indexOf('loyal') >= 0) HD.addOpinion(p.id, me.id, 'fired_coach', 'Fired Our Coach', -6, 16); });
      var c = HD.replaceCoach(t, 'fired', d.id);
      HD.addOpinion(c.id, me.id, 'hired_me', 'Hired Me', 20, 52);
      HD.chronicle('You fired coach ' + HD.fullName(old) + ' and hired ' + HD.fullName(c) + '.');
      U.close(); HD.save();
    },

    // Roster
    autoLines: function () { HD.autoLines(HD.myTeam()); saveAndRender(); },
    newsFilter: function (d) { U.newsFilter = d.f; rerender(); },

    // Market
    faPos: function (d) { U.faPos = d.p; rerender(); },
    offer: function (d) { U.showContract(d.id); },
    submitContract: function () { U.submitContract(); },
    tradeWith: function (d) { U.trade = { team: d.id, give: [], get: [] }; U.tab = 'market'; U.sub.market = 'trade'; U.close(); },
    toggleTrade: function (d) {
      var list = d.side === 'give' ? U.trade.give : U.trade.get;
      var i = list.indexOf(d.id);
      if (i >= 0) list.splice(i, 1); else list.push(d.id);
      U.trade.msg = null; rerender();
    },
    clearTrade: function () { U.trade.give = []; U.trade.get = []; U.trade.msg = null; rerender(); },
    proposeTrade: function () {
      var T = U.trade, my = HD.myTeam(), other = HD.team(T.team), me = HD.me();
      var gm = HD.person(other.gmId);
      var res = HD.evaluateTrade(my, other, T.give, T.get);
      T.msg = res.msg; T.ok = res.ok;
      if (res.ok) {
        HD.executeTrade(my, other, T.give.slice(), T.get.slice());
        HD.addOpinion(gm.id, me.id, 'traded', 'Did Business With Us', 6, 26);
        HD.chronicle('Trade with the ' + other.name + ': sent ' + T.give.map(HD.N).join(', ') + ' for ' + T.get.map(HD.N).join(', ') + '.');
        HD.patchLines(my);
        T.give = []; T.get = [];
      } else HD.addOpinion(gm.id, me.id, 'pestering', 'Pestering Me', -1, 4, { stack: true, max: 12 });
      saveAndRender();
    },
    boardAdd: function (d) { HD.G.draft.board.push(d.id); saveAndRender(); },
    boardRemove: function (d) { var b = HD.G.draft.board; b.splice(b.indexOf(d.id), 1); saveAndRender(); },
    boardUp: function (d) { var b = HD.G.draft.board, i = b.indexOf(d.id); if (i > 0) { b[i] = b[i - 1]; b[i - 1] = d.id; } saveAndRender(); },

    // Finance
    price: function (d) { var t = HD.myTeam(); t.ticketPrice = HD.clamp(t.ticketPrice + (+d.d), 20, 400); saveAndRender(); },
    upgrade: function (d) {
      var t = HD.myTeam(), me = HD.me(), lvl = t.facilities[d.k], cost = HD.FACILITY_COST[lvl + 1];
      var o = HD.person(t.ownerId);
      if (d.src === 'me') {
        if (me.wealth < cost) return;
        HD.spend(cost);
        HD.addOpinion(o.id, me.id, 'personal_invest', 'Invested Own Money In Club', 20, 104, { stack: true, max: 40 });
        me.prestige += Math.round(cost / 2e6);
        HD.news(HD.fullName(me) + ' personally funds a ' + HD.money(cost) + ' upgrade to ' + t.name + ' facilities.', 'money', t.id, true);
      } else {
        if (t.finance.balance < cost) return;
        t.finance.balance -= cost; t.finance.season.capex += cost;
        if (o.traits.indexOf('greedy') >= 0) HD.addOpinion(o.id, me.id, 'spending', 'Spending My Money', -6, 20);
        else HD.addOpinion(o.id, me.id, 'investing', 'Investing In The Future', 4, 20);
      }
      t.facilities[d.k]++;
      HD.chronicle('Upgraded ' + HD.FACILITIES[d.k].name + ' to level ' + t.facilities[d.k] + '.');
      if (d.k === 'scouting' && HD.G.draft && !HD.G.draft.done) HD.refreshScouting();
      saveAndRender();
    },
    buyStake: function () {
      var t = HD.myTeam(), me = HD.me(), o = HD.person(t.ownerId);
      var price = Math.round(HD.teamValue(t) * 0.025 * (t.forSale ? 0.85 : 1.1));
      if (me.wealth < price) return;
      HD.spend(price); o.wealth += price;
      me.stakes = Math.round((me.stakes + 2.5) * 10) / 10;
      HD.chronicle('You bought 2.5% of the ' + t.name + ' for ' + HD.money(price) + '. You now own ' + me.stakes + '%.');
      if (me.stakes >= 50) { t.forSale = false; HD.chronicle('You now control the ' + HD.teamName(t) + '!'); HD.news(HD.fullName(me) + ' takes controlling interest in the ' + HD.teamName(t) + '.', 'money', t.id, true); }
      saveAndRender();
    },
    sellStake: function () {
      var t = HD.myTeam(), me = HD.me();
      var v = HD.teamValue(t) * 0.025 * 0.95;
      me.stakes = Math.max(0, Math.round((me.stakes - 2.5) * 10) / 10); me.wealth += v; me.earnings.invest += 0;
      HD.chronicle('You sold 2.5% of the ' + t.name + ' for ' + HD.money(v) + '.');
      saveAndRender();
    },
    buyControl: function () {
      var t = HD.myTeam(), me = HD.me(), o = HD.person(t.ownerId);
      var cost = Math.round(HD.teamValue(t) * (51 - me.stakes) / 100 * 0.85);
      if (me.wealth < cost || !confirm('Buy controlling interest for ' + HD.money(cost) + '?')) return;
      HD.spend(cost); o.wealth += cost;
      me.stakes = 51; t.forSale = false;
      me.prestige += 25;
      HD.chronicle('👑 You bought controlling interest in the ' + HD.teamName(t) + ' for ' + HD.money(cost) + '. You answer to no one.');
      HD.news(HD.fullName(me) + ' buys the ' + HD.teamName(t) + ', becoming the league\'s first owner-GM.', 'money', t.id, true);
      saveAndRender();
    },

    // Personal
    buyAsset: function (d) {
      var a = HD.assetDef(d.id), me = HD.me();
      if (me.wealth < a.cost) return;
      HD.spend(a.cost); me.assets.push(a.id); me.prestige += a.prestige;
      if (a.skill) me.skills[a.skill] = Math.min(20, me.skills[a.skill] + 1);
      if (me.spouseId && a.cat === 'Home') HD.addOpinion(me.spouseId, me.id, 'new_home', 'Beautiful New Home', 15, 52);
      if (a.cost >= 2e6) HD.news(HD.fullName(me) + ' spotted closing on a ' + a.name.toLowerCase() + '.', 'social', me.teamId);
      HD.chronicle('Bought: ' + a.name + ' (' + HD.money(a.cost) + ').');
      saveAndRender();
    },
    sellAsset: function (d) {
      var a = HD.assetDef(d.id), me = HD.me();
      me.assets.splice(me.assets.indexOf(a.id), 1); me.wealth += a.cost * 0.7; me.prestige = Math.max(0, me.prestige - a.prestige);
      if (a.skill) me.skills[a.skill] = Math.max(1, me.skills[a.skill] - 1);
      HD.chronicle('Sold: ' + a.name + '.');
      saveAndRender();
    },
    buyBiz: function (d) {
      var b = HD.BUSINESSES.filter(function (x) { return x.id === d.id; })[0], me = HD.me();
      if (me.wealth < b.cost) return;
      HD.spend(b.cost); me.businesses.push({ id: b.id, value: b.cost, total: 0 }); me.prestige += b.prestige;
      HD.chronicle('Invested in a ' + b.name + ' (' + HD.money(b.cost) + ').');
      saveAndRender();
    },
    sellBiz: function (d) {
      var me = HD.me(), own = me.businesses.filter(function (x) { return x.id === d.id; })[0];
      me.wealth += own.value * 0.9; me.businesses.splice(me.businesses.indexOf(own), 1);
      HD.chronicle('Sold your stake in the business for ' + HD.money(own.value * 0.9) + '.');
      saveAndRender();
    },
    buyStock: function (d) {
      var me = HD.me(), s = HD.G.stocks.filter(function (x) { return x.id === d.id; })[0];
      var amt = +((U.stockAmt || {})[d.id] || 10000);
      if (me.wealth < amt) return U.toast('Not enough cash.');
      var sh = Math.floor(amt / s.price);
      var h = me.stocks[d.id] = me.stocks[d.id] || { shares: 0, cost: 0 };
      h.shares += sh; h.cost += sh * s.price; me.wealth -= sh * s.price;
      saveAndRender();
    },
    sellStock: function (d) {
      var me = HD.me(), s = HD.G.stocks.filter(function (x) { return x.id === d.id; })[0], h = me.stocks[d.id];
      var amt = +((U.stockAmt || {})[d.id] || 10000);
      var sh = Math.min(h.shares, Math.ceil(amt / s.price));
      A._sellShares(me, s, h, sh);
    },
    sellAllStock: function (d) {
      var me = HD.me(), s = HD.G.stocks.filter(function (x) { return x.id === d.id; })[0], h = me.stocks[d.id];
      A._sellShares(me, s, h, h.shares);
    },
    _sellShares: function (me, s, h, sh) {
      var basis = h.cost * sh / h.shares;
      me.wealth += sh * s.price; me.earnings.invest += sh * s.price - basis;
      h.shares -= sh; h.cost -= basis;
      if (h.shares <= 0) delete me.stocks[s.id];
      saveAndRender();
    }
  };

  // Change handlers (selects, inputs)
  var C = {
    slot: function (el) { var p = HD.person(el.dataset.id); p.slot = el.value; HD.save(); rerender(); },
    tactic: function (el) { HD.myTeam().tactic = el.value; saveAndRender(); },
    focus: function (el) { HD.me().focus = el.value; saveAndRender(); },
    tradeTeam: function (el) { U.trade = { team: el.value, give: U.trade.give, get: [] }; rerender(); },
    cSalary: function (el) { U.contractState.salary = +el.value; U.renderModal(); },
    cYears: function (el) { U.contractState.years = +el.value; U.renderModal(); },
    stockAmt: function (el) { U.stockAmt = U.stockAmt || {}; U.stockAmt[el.dataset.id] = el.value; },
    setFirst: function (el) { U.setup.first = el.value.trim() || 'Alex'; },
    setLast: function (el) { U.setup.last = el.value.trim() || 'Mercer'; },
    setGender: function (el) { U.setup.gender = el.value; },
    setNation: function (el) { U.setup.nation = el.value; },
    setMarried: function (el) { U.setup.married = el.checked; },
    importSave: function (el) {
      var f = el.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { try { HD.G = JSON.parse(r.result); HD.save(); U.modal = null; rerender(); U.toast('Save imported.'); } catch (e) { U.toast('That file is not a valid save.'); } };
      r.readAsText(f);
    }
  };

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || !el.dataset.act) return;
    var fn = A[el.dataset.act];
    if (!fn) return;
    if (el.dataset.act !== 'closeModalBg') ev.stopPropagation();
    fn(el.dataset, el, ev);
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target.closest('[data-change]');
    if (el && C[el.dataset.change]) C[el.dataset.change](el);
  });
  // Live slider feedback without losing focus on the range input
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.dataset && el.dataset.change === 'cSalary') { U.contractState.salary = +el.value; var b = el.nextElementSibling; if (b) b.textContent = HD.money(+el.value, true); }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA') return;
    if (ev.key === 'Escape' && U.modal && !U.modal.locked) A.closeModal();
    if ((ev.key === ' ' || ev.key === 'Enter') && HD.G && !U.modal) { ev.preventDefault(); A.advance(); }
  });

  // Weekly report modal
  U.showReport = function (r) {
    U.open({ cls: '', render: function () {
      var G = HD.G, t = HD.myTeam();
      var h = U.head('Week ' + r.week + ' Report', HD.seasonLabel(r.season) + ' · ' + HD.PHASE_NAMES[r.phase]);
      h += '<div class="modal-body">';
      if (r.games.length && t) {
        var w = r.games.filter(function (g) { return !HD.lostGame(g, t.id); }).length;
        h += '<h4>Your games · ' + w + '-' + (r.games.length - w) + '</h4>' + r.games.map(function (g) { return U.gameLine(g, t.id); }).join('');
      }
      r.series.forEach(function (s) {
        var won = t && s.winner === t.id;
        h += '<div class="result ' + (won ? '' : 'bad') + '">' + (won ? 'Series won! ' : 'Eliminated. ') + U.e(G.teams[s.winner].name) + ' ' + Math.max(s.wh, s.wl) + '–' + Math.min(s.wh, s.wl) + ' ' + U.e(G.teams[s.loser].name) + '</div>';
        h += s.games.map(function (g) { return U.gameLine(g, t.id); }).join('');
      });
      var news = r.news.filter(function (n) { return n.major || (t && n.team === t.id); });
      if (news.length) h += '<h4 style="margin-top:14px">Headlines</h4><div class="feed">' + news.map(function (n) { return '<div class="news k-' + n.k + (n.major ? ' major' : '') + '">' + U.e(n.t) + '</div>'; }).join('') + '</div>';
      h += '</div><div class="modal-foot"><button class="primary" data-act="closeModal">' + (G.pendingEvents.length ? 'Continue to decisions ▸' : 'Continue') + '</button></div>';
      return h;
    } });
  };

  // Boot
  if (HD.hasSave() && HD.load()) { /* resume straight into the game */ }
  HD.UI.render();
  if (HD.G && HD.G.pendingEvents.length && U.tab !== 'office') U.showEvent();
})();
