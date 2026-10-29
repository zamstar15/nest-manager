# Hockey Dynasty

A Crusader Kings–style hockey management RPG. You are the General Manager of a major-league club. Every owner, player, coach, agent and reporter in the league has an opinion of you, and those opinions shift with what you do. The league keeps running around you: players marry, feud and retire, owners die and hand clubs to their heirs, rival GMs scheme, small-market clubs go broke and are sold. The money you earn is yours to spend.

## Play

Open `index.html` in any modern browser. There is no build step or server, and it works from `file://`. The game autosaves to browser storage every week. You can export or import a save file from the ☰ menu.

You run the club from a **3D office**, built with Three.js. Click anything in the room:

| Object | Opens |
|---|---|
| Computer | Club overview |
| Whiteboard | Your lines (drawn live from the roster) |
| Corkboard | Relations: polaroids of key people, with red string to rivals |
| TV | Standings, headlines, and a news ticker |
| Phone | Trades and free agency. It rings when someone calls. |
| Inbox | Decisions waiting |
| Owner's door | Job security. The lamp goes green, amber, red, or gold once you own the club. |
| Safe | Club finances (cash stacks show club funds) |
| Laptop | Your wealth and investments |
| Trophy case | League history |
| Window | Your arena and city |

When a story event happens, the person walks in through the door, sits down and the conversation starts. Calls come in on the phone. The room changes with the season: dusk at camp, snowy game nights during the season, searchlights over the arena as hype rises. It also upgrades as your prestige grows (rug and plants, then a leather couch, a bar cart and an aquarium).

The classic menu screens are still in the left-hand navigation. If a browser can't run WebGL, the game falls back to them automatically.

**Continue ▶** (or Space) advances one week. A season runs 32 weeks:

| Weeks | Phase |
|---|---|
| 1–2 | Training camp. Your owner sets the season's target. |
| 3–22 | Regular season, 60 games (3 per week). Trade deadline at week 16. |
| 23–25 | Playoffs. Top 8 teams, best-of-seven, one round per week. |
| 26 | Awards and owner review. |
| 27 | Entry Draft. Set your draft board under Transactions → Draft. |
| 28 | Contract deadline. Players who aren't extended become free agents. |
| 29–32 | Free agency. Offers are decided at the end of each week against rival bids. |

## Systems

**Opinions & relationships (CK3-style).** Each person's opinion of you adds up from:
- trait compatibility (shared traits help, opposite traits hurt);
- relationships (friend, rival, spouse, mentor);
- timed modifiers that fade ("Traded My Friend −12, 16 wks");
- live factors such as ice time, team results, the club's books and your prestige.

Click anyone to see the full breakdown and interact with them: chat, gifts, dinners, befriending, rivalries, praising or criticizing publicly, naming a captain, setting up mentorships, leaking stories to the press, buying favourable coverage, or asking the owner for money.

**Job security.** Your owner's opinion is your job. Below −60 mid-season you're fired, and missing the season target at review can also cost you the job. Once fired, you wait for offers from other clubs, or retire. Good GMs get poached. Buying 50% of your club makes you unfireable.

**Story events.** More than 30 situations with choices and skill checks: nightclub scandals, locker-room feuds, rival trash talk and schemes, tampering, insider stock tips, betting sponsors, charity galas, owner meddling, new owners, job offers, family moments, health scares from stress. Many have consequences that play out weeks later.

**Hockey.** Line deployment (players expect ice time matching their ability), tactics, chemistry from friendships and rivalries, injuries, morale, form, aging curves, development (training facilities, mentors, diligent or lazy traits), a draft with fuzzy scouting, prospects, awards and league history.

**League economy.** Every club has its own books:
- **Revenue:** gate (attendance depends on hype, market size and your ticket price), concessions, sponsors, TV and playoff gates.
- **Costs:** payroll, operations and facility upkeep.
- **Cap:** the salary cap moves each year with league revenue, and clubs under the floor pay the shortfall.

Small markets that spend to the cap lose money. Owners bail clubs out or sell them. Team values follow revenue, market and success.

**Your money.** Your salary, bonuses, endorsements and dividends go into a personal account you can spend:
- **Property and toys:** homes, cars, a cottage, a yacht and a jet share. They add prestige and relieve stress.
- **Local businesses:** a sports bar, brewery, youth academy (which feeds a local prospect into your draft), an equipment startup or a condo block.
- **Stock market:** seven companies, some tied to the league.
- **Your club:** pay for facility upgrades personally (owners love it) or buy equity, up to controlling interest.
- **People:** gifts, charity and favours.

## Developer notes

Plain ES5 scripts on a global `HD` namespace. Load order is set in `index.html`. Three.js r149 is bundled in `vendor/` (MIT licence) so the game works offline. The office (`js/office3d.js`) is built entirely from primitives and canvas textures, with no model files. It reads game state through `HD.Office.sync()`, which runs on every UI render. The simulation (`util`, `data`, `world`, `opinion`, `sim`, `economy`, `market`, `ai`, `events`, `interactions`, `game`) never touches the DOM. The UI is in `ui.js`, `views.js` and `main.js`.

`node tools/sim-test.js [seasons]` plays seasons headlessly with random choices. It checks roster invariants every week and prints balance stats (goals per game, revenue, profit, payroll, cap, save size).
