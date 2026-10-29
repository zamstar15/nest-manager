// Static world data: names, franchises, traits, purchasables, companies.
var HD = HD || {};

HD.NATIONS = {
  CAN: { name: 'Canada', flag: '🇨🇦', w: 40,
    first: ['Connor', 'Tyler', 'Brayden', 'Logan', 'Ryan', 'Cole', 'Mitch', 'Jordan', 'Nathan', 'Dylan', 'Mark', 'Jamie', 'Evan', 'Scott', 'Brent', 'Shane', 'Dale', 'Wade', 'Kyle', 'Cody', 'Jean-Luc', 'Mathieu', 'Alexis', 'Félix', 'Patrice'],
    last: ['MacDonald', 'Tremblay', 'Gagnon', 'Campbell', 'Murray', 'Fraser', 'Sinclair', 'Côté', 'Bouchard', 'Pelletier', 'Crawford', 'Bellamy', 'McKenzie', 'Stewart', 'Robertson', 'Lavoie', 'Girard', 'Ouellet', 'Brassard', 'Hamilton', 'Duncan', 'Reid', 'Morrison', 'Harper', 'Lalonde'] },
  USA: { name: 'USA', flag: '🇺🇸', w: 25,
    first: ['Jack', 'Matt', 'Brady', 'Chris', 'Patrick', 'Zach', 'Trevor', 'Austin', 'Brock', 'Cam', 'Quinn', 'Nick', 'Joey', 'Danny', 'Tommy', 'Seth', 'Blake', 'Hunter', 'Mason', 'Riley'],
    last: ['Miller', 'Johnson', 'Sullivan', 'O\'Brien', 'Kowalski', 'Hayes', 'Fitzgerald', 'Lyndon', 'Connelly', 'Boyle', 'Walsh', 'Dempsey', 'Callahan', 'Brennan', 'Keller', 'Whitman', 'Gallagher', 'Rourke', 'Tierney', 'Ashby'] },
  SWE: { name: 'Sweden', flag: '🇸🇪', w: 10,
    first: ['Erik', 'Henrik', 'Oskar', 'Viktor', 'Elias', 'Gustav', 'Rasmus', 'Nils', 'Lucas', 'Filip', 'Adam', 'Isak'],
    last: ['Lindqvist', 'Karlsson', 'Andersson', 'Bergström', 'Nyström', 'Sandell', 'Fröberg', 'Holmqvist', 'Ekdahl', 'Dahlqvist', 'Wikström', 'Johansson'] },
  FIN: { name: 'Finland', flag: '🇫🇮', w: 7,
    first: ['Mikko', 'Teemu', 'Aleksander', 'Sami', 'Jesse', 'Kaapo', 'Juuso', 'Patrik', 'Eetu', 'Antti'],
    last: ['Virtanen', 'Korhonen', 'Lahti', 'Mäkinen', 'Rautio', 'Heikkilä', 'Ahonen', 'Saarela', 'Kivelä', 'Lehtonen'] },
  RUS: { name: 'Russia', flag: '🇷🇺', w: 8,
    first: ['Alexei', 'Dmitri', 'Nikita', 'Ivan', 'Artemi', 'Sergei', 'Vladislav', 'Kirill', 'Pavel', 'Andrei'],
    last: ['Volkov', 'Morozov', 'Kuznetsov', 'Petrov', 'Sokolov', 'Orlov', 'Belov', 'Pankratov', 'Zaitsev', 'Gromov'] },
  CZE: { name: 'Czechia', flag: '🇨🇿', w: 5,
    first: ['Jakub', 'Tomáš', 'Ondřej', 'David', 'Martin', 'Lukáš', 'Radek', 'Jiří'],
    last: ['Novák', 'Dvořák', 'Procházka', 'Kučera', 'Veselý', 'Horák', 'Svoboda', 'Marek'] },
  GER: { name: 'Germany', flag: '🇩🇪', w: 3,
    first: ['Leon', 'Moritz', 'Tim', 'Lukas', 'Dominik', 'Tobias'],
    last: ['Brandt', 'Hoffmann', 'Krüger', 'Wagner', 'Schäfer', 'Müller'] },
  SUI: { name: 'Switzerland', flag: '🇨🇭', w: 2,
    first: ['Nico', 'Roman', 'Timo', 'Kevin', 'Pius'],
    last: ['Brunner', 'Keller', 'Meier', 'Steiner', 'Gerber'] }
};

HD.FEMALE_FIRST = ['Emma', 'Olivia', 'Sophie', 'Chloé', 'Hannah', 'Megan', 'Lauren', 'Isabelle', 'Natalie', 'Rachel', 'Grace', 'Amélie', 'Sarah', 'Julia', 'Claire', 'Maya', 'Ingrid', 'Anna', 'Katarina', 'Elena', 'Marie', 'Holly', 'Jenna', 'Tess'];
HD.GENERIC_LAST = ['Hartley', 'Vance', 'Marlowe', 'Whitfield', 'Thorne', 'Ashford', 'Delaney', 'Kincaid', 'Prescott', 'Sterling', 'Holloway', 'Blackwood', 'Carrow', 'Pemberton', 'Lockhart', 'Faraday', 'Winslow', 'Rockwell', 'Langley', 'Ellsworth'];

// market: 1-10 drives gate, sponsors and owner expectations. rich: owner deep pockets.
HD.FRANCHISES = [
  { id: 'TOR', city: 'Toronto', name: 'Northmen', market: 10, colors: ['#0b2a5b', '#e8edf5'], arena: 'Lakeshore Gardens' },
  { id: 'MTL', city: 'Montréal', name: 'Voyageurs', market: 9, colors: ['#9c1b26', '#1d3a8a'], arena: 'Le Colisée' },
  { id: 'NYH', city: 'New York', name: 'Harbor Kings', market: 10, colors: ['#121212', '#d4a017'], arena: 'Hudson Arena' },
  { id: 'CHI', city: 'Chicago', name: 'Steelhawks', market: 9, colors: ['#5a0f12', '#c7c7c7'], arena: 'Lakefront Center' },
  { id: 'BOS', city: 'Boston', name: 'Ironsides', market: 8, colors: ['#3b2a10', '#f2b705'], arena: 'Commonwealth Arena' },
  { id: 'DET', city: 'Detroit', name: 'Motormen', market: 7, colors: ['#b5121b', '#f4f4f4'], arena: 'Assembly Hall' },
  { id: 'VAN', city: 'Vancouver', name: 'Orcas', market: 7, colors: ['#00264d', '#2aa876'], arena: 'Pacific Coliseum' },
  { id: 'SEA', city: 'Seattle', name: 'Rainmen', market: 7, colors: ['#0b3d4f', '#8fd3e8'], arena: 'Sound Pavilion' },
  { id: 'CGY', city: 'Calgary', name: 'Stampede', market: 6, colors: ['#c8102e', '#f1be48'], arena: 'Saddle Dome' },
  { id: 'MIN', city: 'Minneapolis', name: 'Lumberjacks', market: 6, colors: ['#154734', '#a6192e'], arena: 'Northwoods Center' },
  { id: 'DEN', city: 'Denver', name: 'Summit', market: 6, colors: ['#3d1e5c', '#7ab2dc'], arena: 'Mile High Ice' },
  { id: 'PIT', city: 'Pittsburgh', name: 'Foundry', market: 6, colors: ['#1a1a1a', '#e87722'], arena: 'Three Rivers Arena' },
  { id: 'WPG', city: 'Winnipeg', name: 'Frost', market: 4, colors: ['#041e42', '#a2aaad'], arena: 'Prairie Fieldhouse' },
  { id: 'QUE', city: 'Québec', name: 'Lynx', market: 4, colors: ['#1f5aa6', '#ffffff'], arena: 'Centre Laurentien' },
  { id: 'HAM', city: 'Hamilton', name: 'Forge', market: 4, colors: ['#4a4a4a', '#ff5a1f'], arena: 'Steeltown Coliseum' },
  { id: 'HFD', city: 'Hartford', name: 'Mariners', market: 3, colors: ['#00594f', '#d9d9d6'], arena: 'Capitol Ice Palace' }
];

// Personality traits work like CK3: shared traits breed sympathy, opposites friction.
HD.TRAITS = {
  ambitious:   { name: 'Ambitious',   icon: '🔥', opp: 'content',   desc: 'Wants more: more ice time, more money, more power.' },
  content:     { name: 'Content',     icon: '🍵', opp: 'ambitious', desc: 'Happy with their lot. Rarely makes demands.' },
  greedy:      { name: 'Greedy',      icon: '💰', opp: 'generous',  desc: 'Money talks. Loves gifts, demands big contracts.' },
  generous:    { name: 'Generous',    icon: '🎁', opp: 'greedy',    desc: 'Gives freely. Will take a hometown discount.' },
  loyal:       { name: 'Loyal',       icon: '🛡️', opp: 'fickle',    desc: 'Sticks by friends and team. Opinion drops slowly.' },
  fickle:      { name: 'Fickle',      icon: '🎲', opp: 'loyal',     desc: 'Changes allegiance like socks.' },
  hotheaded:   { name: 'Hot-headed',  icon: '😤', opp: 'calm',      desc: 'Quick to anger. Takes penalties, picks fights.' },
  calm:        { name: 'Calm',        icon: '🧘', opp: 'hotheaded', desc: 'Unflappable under pressure.' },
  arrogant:    { name: 'Arrogant',    icon: '👑', opp: 'humble',    desc: 'Thinks very highly of themselves.' },
  humble:      { name: 'Humble',      icon: '🙏', opp: 'arrogant',  desc: 'Team first, always.' },
  gregarious:  { name: 'Gregarious',  icon: '🍻', opp: 'shy',       desc: 'Life of the party. Easy to befriend.' },
  shy:         { name: 'Shy',         icon: '🫥', opp: 'gregarious', desc: 'Keeps to themselves. Hard to read.' },
  diligent:    { name: 'Diligent',    icon: '📋', opp: 'lazy',      desc: 'First on the ice, last off. Develops faster.' },
  lazy:        { name: 'Lazy',        icon: '🛋️', opp: 'diligent',  desc: 'Coasts. Develops slowly.' },
  honest:      { name: 'Honest',      icon: '⚖️', opp: 'deceitful', desc: 'Says what they mean. Hates schemers.' },
  deceitful:   { name: 'Deceitful',   icon: '🐍', opp: 'honest',    desc: 'Tells you what you want to hear.' },
  // Hockey-specific traits (no opposite)
  leader:      { name: 'Leader',      icon: '©️', desc: 'Captain material. Lifts team morale.', hockey: true },
  clutch:      { name: 'Clutch',      icon: '⏱️', desc: 'Rises in the playoffs.', hockey: true },
  injury_prone:{ name: 'Glass',       icon: '🩹', desc: 'Injury prone.', hockey: true },
  party_animal:{ name: 'Party Animal',icon: '🎉', desc: 'Nightlife magnet. Scandal risk.', hockey: true },
  family:      { name: 'Family First',icon: '👨‍👧', desc: 'Values stability. Hates being traded.', hockey: true },
  media_darling:{ name: 'Media Darling', icon: '📸', desc: 'Fans and press adore them.', hockey: true },
  enforcer:    { name: 'Enforcer',    icon: '🥊', desc: 'Protects teammates. Physical.', hockey: true },
  sniper:      { name: 'Sniper',      icon: '🎯', desc: 'Lethal shot.', hockey: true },
  playmaker:   { name: 'Playmaker',   icon: '🧠', desc: 'Sees the ice like few others.', hockey: true },
  prodigy:     { name: 'Prodigy',     icon: '⭐', desc: 'Rare talent. Grows fast.', hockey: true }
};
HD.PERSONALITY_TRAITS = ['ambitious', 'content', 'greedy', 'generous', 'loyal', 'fickle', 'hotheaded', 'calm', 'arrogant', 'humble', 'gregarious', 'shy', 'diligent', 'lazy', 'honest', 'deceitful'];
HD.PLAYER_TRAITS = ['leader', 'clutch', 'injury_prone', 'party_animal', 'family', 'media_darling', 'enforcer', 'sniper', 'playmaker'];

HD.SKILLS = {
  diplomacy: { name: 'Diplomacy', icon: '🤝', desc: 'Relationships, negotiations, owner and agent opinion.' },
  tactics:   { name: 'Tactics',   icon: '📐', desc: 'Team performance on the ice.' },
  finance:   { name: 'Finance',   icon: '📈', desc: 'Revenue, investment returns, contract bargaining.' },
  scouting:  { name: 'Scouting',  icon: '🔭', desc: 'See true potential; better draft picks.' },
  intrigue:  { name: 'Intrigue',  icon: '🕵️', desc: 'Leaks, rumours, and back-room deals.' }
};

HD.BACKGROUNDS = [
  { id: 'explayer', name: 'Former Star Player', desc: 'Twelve seasons in the league. Players respect you; owners wonder if you can run a business.',
    skills: { diplomacy: 6, tactics: 9, finance: 3, scouting: 6, intrigue: 3 }, prestige: 60, wealth: 3500000, trait: 'leader' },
  { id: 'analyst', name: 'Analytics Wunderkind', desc: 'Ivy league, spreadsheets, a cap model nobody else understands.',
    skills: { diplomacy: 4, tactics: 7, finance: 9, scouting: 8, intrigue: 4 }, prestige: 15, wealth: 900000, trait: 'diligent' },
  { id: 'scout', name: 'Lifer Scout', desc: 'Twenty years in rinks from Kamloops to Kladno. You know talent.',
    skills: { diplomacy: 6, tactics: 6, finance: 4, scouting: 11, intrigue: 5 }, prestige: 25, wealth: 450000, trait: 'humble' },
  { id: 'agent', name: 'Former Super-Agent', desc: 'You got rich squeezing GMs. Now you are one. Everyone owes you a favour or hates you.',
    skills: { diplomacy: 9, tactics: 3, finance: 7, scouting: 5, intrigue: 9 }, prestige: 35, wealth: 6000000, trait: 'deceitful' }
];

HD.LIFESTYLE_FOCUS = {
  diplomacy: 'Glad-handing: dinners, golf, charity events.',
  tactics: 'Film room: breaking down systems late into the night.',
  finance: 'Boardroom: cap models, revenue projections, markets.',
  scouting: 'Road trips: junior rinks and European leagues.',
  intrigue: 'Back channels: who knows what, who owes whom.'
};

// Personal purchases. upkeep is per in-game week.
HD.ASSETS = [
  { id: 'house_suburb', cat: 'Home', name: 'Suburban Family Home', cost: 1200000, upkeep: 2500, prestige: 5, stress: -3, desc: 'A real yard. The kids can play road hockey.' },
  { id: 'house_lake', cat: 'Home', name: 'Lakeside Estate', cost: 4500000, upkeep: 9000, prestige: 15, stress: -6, desc: 'Boathouse, private rink in winter. Players love visiting.' },
  { id: 'house_mansion', cat: 'Home', name: 'Hilltop Mansion', cost: 14000000, upkeep: 25000, prestige: 35, stress: -8, desc: 'The kind of place owners host galas in.' },
  { id: 'car_truck', cat: 'Vehicle', name: 'Lifted Pickup', cost: 75000, upkeep: 200, prestige: 1, stress: -1, desc: 'Hauls gear, fits in at the rink.' },
  { id: 'car_lux', cat: 'Vehicle', name: 'German Luxury Sedan', cost: 160000, upkeep: 500, prestige: 4, stress: -1, desc: 'Executive presence.' },
  { id: 'car_super', cat: 'Vehicle', name: 'Italian Supercar', cost: 480000, upkeep: 1500, prestige: 9, stress: -2, desc: 'Players will talk. So will the press.' },
  { id: 'cabin', cat: 'Retreat', name: 'Muskoka Cottage', cost: 2200000, upkeep: 3500, prestige: 6, stress: -10, desc: 'A place to escape the noise. Big stress relief.' },
  { id: 'yacht', cat: 'Retreat', name: 'Motor Yacht', cost: 7500000, upkeep: 20000, prestige: 20, stress: -6, desc: 'Off-season summers on the water with power brokers.' },
  { id: 'jet', cat: 'Retreat', name: 'Private Jet Share', cost: 18000000, upkeep: 40000, prestige: 30, stress: -4, desc: 'Scouting trips at your convenience. +1 Scouting.', skill: 'scouting' },
  { id: 'art', cat: 'Collection', name: 'Hockey Memorabilia Collection', cost: 900000, upkeep: 300, prestige: 8, stress: -2, desc: 'Original 1972 Summit Series jerseys. A conversation piece.' }
];

// Local businesses: weekly income = cost * yieldRate * (economy factor) with variance.
HD.BUSINESSES = [
  { id: 'bar', name: 'Sports Bar & Grill', cost: 800000, yield: 0.0028, vol: 0.5, prestige: 2, desc: 'Packed on game nights. Income tracks fan hype.', hype: true },
  { id: 'brewery', name: 'Craft Brewery', cost: 2500000, yield: 0.0024, vol: 0.4, prestige: 3, desc: 'Steady earner. Could land an arena pouring deal.' },
  { id: 'school', name: 'Youth Hockey Academy', cost: 3000000, yield: 0.0012, vol: 0.2, prestige: 8, desc: 'Low profit, high goodwill. Produces a local prospect for your draft list each year.', school: true },
  { id: 'gear', name: 'Equipment Startup', cost: 5000000, yield: 0.0020, vol: 1.6, prestige: 4, desc: 'High risk. Could boom if a star endorses it.' },
  { id: 'realty', name: 'Downtown Condo Block', cost: 9000000, yield: 0.0019, vol: 0.15, prestige: 5, desc: 'Rental income. Appreciates when the team wins (fans want to live downtown).' }
];

HD.COMPANIES = [
  { id: 'PUCK', name: 'Puck Broadcasting Corp', price: 42, vol: 0.035, drift: 0.0015, sector: 'media', desc: 'Holds league TV rights. Tracks league revenue.' },
  { id: 'FRST', name: 'Frostbite Energy', price: 18, vol: 0.06, drift: 0.001, sector: 'consumer', desc: 'Energy drinks. Volatile, sponsor-heavy.' },
  { id: 'ICTK', name: 'IceTech Equipment', price: 65, vol: 0.04, drift: 0.0012, sector: 'equipment', desc: 'Skates, sticks, helmets.' },
  { id: 'NRTH', name: 'Northern Rail & Energy', price: 110, vol: 0.02, drift: 0.0008, sector: 'industrial', desc: 'Blue-chip. Boring and reliable.' },
  { id: 'ZAMB', name: 'Glacier Arena Holdings', price: 30, vol: 0.045, drift: 0.001, sector: 'realestate', desc: 'Owns and builds arenas.' },
  { id: 'BETX', name: 'BetNorth Gaming', price: 24, vol: 0.075, drift: 0.0015, sector: 'gaming', desc: 'Sports betting. Scandal-prone, high growth.' },
  { id: 'MAPL', name: 'Maple Leaf Bank', price: 75, vol: 0.018, drift: 0.0009, sector: 'finance', desc: 'Pays a quarterly dividend.' , dividend: 0.008 }
];

HD.FACILITIES = {
  arena:    { name: 'Arena Amenities', desc: 'Capacity and premium seating. More gate revenue.' },
  training: { name: 'Training Centre', desc: 'Faster player development, better conditioning.' },
  medical:  { name: 'Medical Staff', desc: 'Fewer and shorter injuries.' },
  scouting: { name: 'Scouting Network', desc: 'Better draft prospects and potential reports.' }
};
HD.FACILITY_COST = [0, 0, 8000000, 16000000, 30000000, 50000000]; // cost to reach level i
HD.FACILITY_UPKEEP = [0, 40000, 70000, 110000, 170000, 250000]; // per week at level i

HD.POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];
HD.SLOTS = ['F1', 'F2', 'F3', 'F4', 'D1', 'D2', 'D3', 'G1', 'G2', 'X'];
HD.SLOT_NAMES = { F1: '1st Line', F2: '2nd Line', F3: '3rd Line', F4: '4th Line', D1: '1st Pair', D2: '2nd Pair', D3: '3rd Pair', G1: 'Starter', G2: 'Backup', X: 'Scratched' };
HD.SLOT_CAP = { F1: 3, F2: 3, F3: 3, F4: 3, D1: 2, D2: 2, D3: 2, G1: 1, G2: 1, X: 99 };
HD.TACTICS = {
  balanced:  { name: 'Balanced', desc: 'No strong lean.' },
  offensive: { name: 'Run & Gun', desc: '+offence, -defence. Fans love it.' },
  defensive: { name: 'Trap', desc: '+defence, -offence. Fewer goals both ways.' },
  physical:  { name: 'Heavy', desc: 'Grind them down. More injuries both ways.' }
};

HD.ROLE_NAMES = {
  player: 'Player', coach: 'Head Coach', gm: 'General Manager', owner: 'Owner', journalist: 'Journalist',
  agent: 'Agent', spouse: 'Spouse', child: 'Child', manager: 'General Manager', commissioner: 'Commissioner', prospect: 'Prospect'
};

HD.OUTLETS = ['The Daily Puck', 'Northern Sports Network', 'The Athletic Wire', 'Hockey Night Radio', 'The Crease Podcast', 'Le Journal du Hockey'];
