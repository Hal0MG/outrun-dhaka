// The route pyramid: start in Dhanmondi, fork left/right at the end of every
// stage, escape Dhaka at sunrise through one of five exits.
//
// Section helper S(len, curvature, elevationChange, extras). Positive k = right.
// Extras: L/R/far side types, elev (road height above terrain), lanes, and for
// set pieces: env (what is built around you), surface (what you drive on),
// closed (no traffic), gap (nothing to drive on: you are airborne), jump.

const S = (len, k = 0, dy = 0, extra = {}) => ({ len, k, dy, ...extra });

export const PYRAMID = [
  ['dhanmondi'],
  ['shahbag', 'manikmia'],
  ['oldDhaka', 'kawranBazar', 'hatirjheel'],
  ['sadarghat', 'motijheel', 'gulshan', 'mirpur'],
  ['padma', 'highway', 'purbachal', 'airport', 'savar'],
];

// hour ranges per pyramid level (continuous axis, 24+ = after midnight)




const CITY_FACADES = ['apt_cream', 'apt_pink', 'apt_mint', 'apt_yellow', 'apt_white', 'apt_blue', 'apt_tile', 'apt_tile2', 'apt_raw'];
const OLD_FACADES = ['old_ochre', 'old_blue', 'old_pink', 'brick', 'apt_raw', 'old_ochre'];
const CBD_FACADES = ['office', 'glass_blue', 'glass_green', 'apt_white', 'apt_tile2', 'office'];
const POSH_FACADES = ['glass_blue', 'glass_green', 'apt_white', 'apt_blue', 'office', 'apt_white'];

const STREET_LIFE = { p_lungi: 3, p_shirt: 3, p_saree: 2, p_kameez: 2, p_panjabi: 1, p_vendor: 1, teastall: 1.2, fuchka: 0.8, crowd0: 0.6, crowd1: 0.5, dog: 0.5, police: 0.15, fruitvan: 0.4 };

// ------------------------------------------------------------------ set pieces
const IN = { L: 'interior', R: 'interior', closed: true, noDeck: true, roof: true };

// METRO DASH: the road is closed for metro works, so you take the stairs,
// tap in with your bumper, drive the rails and jump into a clothing store
const METRO_DASH = () => [
  S(70, 0, 0, { lanes: 2, laneEase: 0.7, env: 'closure', closed: true, closeLead: 100, L: 'city', R: 'city', wallX: 0.4 }),
  S(64, 0, 0, { ...IN, lanes: 2, elev: 6.5, surface: 'stairs', env: 'station' }),
  S(92, 0, 0, { ...IN, lanes: 3, laneEase: 0.25, elev: 6.5, surface: 'tiles', env: 'station', gateAt: 38 }),
  S(46, 0, 0, { ...IN, lanes: 2, laneEase: 0.3, elev: 12, surface: 'stairs', env: 'station' }),
  S(110, 0, 0, { ...IN, lanes: 3, laneEase: 0.25, elev: 12, surface: 'tiles', env: 'platform' }),
  S(30, 0, 0, { lanes: 2, laneEase: 0.5, elev: 11.2, surface: 'rail', env: 'viaduct', closed: true, L: 'elevated', R: 'elevated' }),
  S(320, 0.0016, 0, { lanes: 2, elev: 11.2, surface: 'rail', env: 'viaduct', closed: true, L: 'elevated', R: 'elevated' }),
  S(330, -0.0018, 0, { lanes: 2, elev: 11.2, surface: 'rail', env: 'viaduct', closed: true, L: 'elevated', R: 'elevated' }),
  S(70, 0, 0, { lanes: 2, elev: 11.2, surface: 'rail', env: 'construction', closed: true, L: 'elevated', R: 'elevated', jump: { len: 100, h: 7.5, kind: 'store', slow: 0.38 } }),
  S(84, 0, 0, { lanes: 2, elev: 13, surface: 'none', env: 'gap', gap: true, closed: true, L: 'gapCity', R: 'gapCity', noDeck: true }),
  S(150, 0, 0, { ...IN, lanes: 3, laneEase: 0.15, elev: 13, surface: 'store', env: 'store', jump: { len: 92, h: 3.5, kind: 'storeOut', slow: 0.4 } }),
  S(80, 0, 0, { lanes: 3, elev: 0, surface: 'none', env: 'gap', gap: true, closed: true, L: 'gapCity', R: 'gapCity', noDeck: true }),
  S(110, 0, 0, { lanes: 4, laneEase: 0.6, elev: 0, closed: true, L: 'city', R: 'median' }),
];

// MALL CRAWL: through the doors, up the spiral, into the cinema, out of the screen
const R_SPIRAL = 26;
const MALL_CRAWL = () => [
  S(90, 0, 0, { lanes: 3, laneEase: 0.6, env: 'mallFront', closed: true, closeLead: 130, L: 'city', R: 'city' }),
  S(110, 0, 0, { ...IN, noDeck: false, lanes: 3, surface: 'mall', env: 'mallFloor' }),
  S(Math.round(Math.PI * 2 * R_SPIRAL * 2.25), 1 / R_SPIRAL, 0, { ...IN, lanes: 2, laneEase: 0.2, hardK: true, elev: 18, surface: 'mall', env: 'spiral', cf: 0.22 }),
  S(60, 0, 0, { ...IN, lanes: 3, laneEase: 0.4, elev: 18, surface: 'carpet', env: 'cinemaLobby' }),
  S(100, 0, 0, { ...IN, lanes: 3, elev: 16, surface: 'carpet', env: 'cinema', jump: { len: 130, h: 7, kind: 'cinemaOut', slow: 0.33, roll: 1 } }),
  S(120, 0, 0, { lanes: 3, elev: 9, surface: 'none', env: 'gap', gap: true, closed: true, L: 'gapCity', R: 'gapCity', noDeck: true }),
  S(260, 0, 0, { lanes: 4, laneEase: 0.4, elev: 0, L: 'elevated', R: 'elevated', closed: true }),
];

// FUTURE PARK: through the turnstiles, past the rides, onto the roller coaster
const COASTER = { lanes: 1.6, surface: 'coaster', env: 'coaster', closed: true, L: 'none', R: 'none', noDeck: true };
const FUTURE_PARK = () => [
  S(80, 0, 0, { lanes: 3, laneEase: 0.6, env: 'parkGate', closed: true, closeLead: 130, L: 'city', R: 'city' }),
  S(320, 0.0022, 0, {
    lanes: 3, surface: 'plaza', env: 'park', closed: true, L: 'open', R: 'open',
    rides: [{ s: 60, type: 'wheel', side: 1, dist: 36, r: 22 }, { s: 140, type: 'carousel', side: -1, dist: 22 }, { s: 220, type: 'ship', side: 1, dist: 24 }, { s: 290, type: 'tower', side: -1, dist: 30 }],
  }),
  S(110, 0, 0, { ...COASTER, laneEase: 0.4, elev: 22, lift: true }),
  S(70, 0, 0, { ...COASTER, elev: 4, crests: [{ s: 1, jump: { len: 36, h: 2.6, kind: 'coaster', slow: 0.6 } }] }),
  S(90, 0.012, 0, { ...COASTER, elev: 13 }),
  S(80, -0.014, 0, { ...COASTER, elev: 3, crests: [{ s: 1, jump: { len: 30, h: 2.2, kind: 'coaster' } }] }),
  S(90, 0, 0, { ...COASTER, elev: 9, endRamp: { len: 82, h: 5, kind: 'coasterOut', slow: 0.42 } }),
  S(76, 0, 0, { lanes: 4, laneEase: 0.3, elev: 0, surface: 'none', env: 'gap', gap: true, closed: true, L: 'open', R: 'open', noDeck: true }),
  S(120, 0, 0, { lanes: 5, laneEase: 0.5, elev: 0, closed: true, L: 'kash', R: 'median' }),
];

export const STAGES = {
  // ======================================================================== LEVEL 0
  dhanmondi: {
    id: 'dhanmondi', name: 'Dhanmondi', short: 'DHANMONDI', bn: 'ধানমন্ডি', sub: 'Satmasjid Road · Lake Road · Road 27', level: 0,
    lanes: 4, L: 'city', R: 'median', far: 'city',
    sections: [
      S(220, 0), S(300, 0.0022), S(260, -0.003, 1),
      S(320, 0, 0, { L: 'lake' }), S(360, 0.0036, 0, { L: 'lake' }), S(300, -0.0024, -1, { L: 'lake' }), S(260, 0.001, 0, { L: 'lake' }),
      S(320, -0.0042, 2), S(300, 0.0028, -1, { L: 'park' }), S(260, 0, 0, { L: 'park' }),
      S(360, 0.0048, 0), S(300, -0.002, -1), S(280, 0.0016, 0), S(300, 0, 0),
    ],
    facades: CITY_FACADES, shops: ['shop_a', 'shop_b'], heights: [12, 27], backHeights: [18, 40],
    trees: { krishnachura0: 3, krishnachura1: 3, palm0: 1.5, palm1: 1, mango0: 1.2, betel0: 0.8, radhachura0: 1 },
    lakeTrees: { krishnachura0: 3, krishnachura1: 2, palm1: 1, radhachura0: 1 },
    streetTrees: 0.03, parkTrees: 0.14,
    life: { ...STREET_LIFE, fuchka: 1.5, teastall: 1.6 },
    medianPlants: { bush0: 2, bougain0: 3 },
    billboards: ['band', 'kacchi', 'gfun', 'swapno', 'tea', 'ononto', 'coaching', 'pathaw'],
    lampColor: '#ffad48', lampSpacing: 34, lakeW: 120, boats: 'swan',
    traffic: { density: 20, mix: { rickshaw: 5, cng: 3, car: 3, bus: 1.2, bike: 2, suv: 1, tesla: 3, micro: 1 } },
    peds: 0.8,
    tint: { color: '#ffb070', amount: 0.08 },
    skyline: 'midrise', fairyP: 0.15,
    landmarks: [
      { type: 'satmasjid', s: 170, side: 1, dist: 52, clear: [90, 260] },
      { type: 'sarobar', s: 1260, side: -1, dist: 28 },
      { type: 'floodlights', s: 2660, side: -1, dist: 18, clear: [2560, 2780], opts: { w: 60, d: 90 } },
    ],
    footbridges: [880, 2100, 3350],
    zebras: [500, 1700, 2400, 3100],
    stalls: [[1900, 2280, -1]],
    events: [
      { type: 'teslas', s: 560, n: 6 },
      { type: 'enemies', role: 'police', s: 1500, n: 2, label: 'POLICE BEHIND' },
      { type: 'jam', s: 2950, len: 170 },
    ],
    lines: [{ s: 80, id: 'start' }, { s: 1180, id: 'sarobar' }, { s: 1880, id: 'stalls' }, { s: 2620, id: 'abahani' }],
  },

  // ======================================================================== LEVEL 1
  shahbag: {
    id: 'shahbag', name: 'Shahbag', short: 'SHAHBAG', bn: 'শাহবাগ', sub: 'Nilkhet · TSC · Charukola — Pohela Boishakh', level: 1,
    lanes: 4, L: 'wall', R: 'median', far: 'city',
    sections: [
      S(300, 0), S(320, -0.0026), S(280, 0.002, 0, { L: 'park' }), S(340, 0, 0, { L: 'park' }),
      S(300, 0.004, 1, { L: 'city' }), S(300, -0.0035, -1, { L: 'city' }), S(260, 0, 0),
      S(360, 0.003), S(320, -0.0045, 0, { L: 'city' }), S(280, 0.0015, 0, { L: 'city' }), S(300, 0, 0, { L: 'park' }),
    ],
    facades: ['brick', 'apt_cream', 'apt_pink', 'apt_raw', 'apt_white', 'old_ochre'], wallFacades: ['brick', 'apt_cream'],
    shops: ['shop_a', 'shop_old'], heights: [10, 22], backHeights: [14, 30],
    trees: { krishnachura0: 4, krishnachura1: 4, radhachura0: 2, mango0: 1, banyan0: 1, palm2: 0.5 },
    life: { p_saree: 4, p_kameez: 3, p_panjabi: 3, crowd0: 1.5, crowd1: 1.5, crowd2: 1, mask_owl: 0.5, mask_tiger: 0.5, mask_horse: 0.4, mask_fish: 0.4, flowerstall: 1, bookstall: 0.6, fuchka: 0.6, teastall: 0.5 },
    lifeDensity: 0.12, wallLife: 0.12, wallTrees: 0.14,
    billboards: ['rong', 'band', 'coaching', 'tea', 'kolija', 'safety'],
    lampColor: '#ffb04a', festival: 'boishakh',
    traffic: { density: 20, mix: { rickshaw: 8, cng: 2, car: 2, bus: 1, bike: 2, tesla: 3 } },
    peds: 1.3, pedKind: 'student',
    tint: { color: '#ff7a8a', amount: 0.12 },
    skyline: 'midrise',
    alpana: [[0, 3100]],
    landmarks: [
      { type: 'curzonHall', s: 240, side: -1, dist: 28, clear: [170, 330] },
      { type: 'shaheedMinar', s: 840, side: -1, dist: 16, clear: [780, 920] },
    ],
    banners: [{ s: 120, lines: ['শুভ নববর্ষ ১৪৩৩', 'SHUBHO NOBOBORSHO'] }, { s: 1850, lines: ['মঙ্গল শোভাযাত্রা', 'CHARUKOLA · DHAKA UNIVERSITY'], c1: '#1d5fa8', c2: '#0d2f5c' }],
    zebras: [600, 1300, 2000, 2700],
    stalls: [[2480, 2900, -1]],
    events: [
      { type: 'enemies', role: 'police', s: 1100, n: 3 },
      { type: 'jam', s: 2050, len: 150 },
      { type: 'teslas', s: 2700, n: 7 },
    ],
    lines: [{ s: 60, id: 'boishakh' }, { s: 760, id: 'minar' }, { s: 1800, id: 'masks' }, { s: 2600, id: 'nilkhet' }],
  },

  manikmia: {
    id: 'manikmia', name: 'Manik Mia Avenue', short: 'MANIK MIA', bn: 'মানিক মিয়া এভিনিউ', sub: 'Ganabhaban · Sangsad Bhaban · Bijoy Sarani', level: 1,
    lanes: 5, L: 'park', R: 'median', far: 'park', medianW: 5, medianPalms: 16,
    sections: [
      S(240, 0), S(500, 0.0012), S(400, -0.0018), S(600, 0),
      S(300, 0.003, 0, { L: 'city', far: 'city' }),
      S(260, 0, 0, { elev: 9, L: 'elevated', R: 'elevated' }), S(320, -0.003, 0, { elev: 9, L: 'elevated', R: 'elevated' }),
      S(260, 0, 0, { elev: 0, L: 'city', far: 'city' }), S(400, 0.0025, 0), S(300, -0.0015, 0, { L: 'city', far: 'city' }),
    ],
    facades: CITY_FACADES, shops: ['shop_a', 'shop_b'], heights: [12, 30],
    trees: { palm0: 2, palm1: 2, krishnachura0: 2, mango1: 1.5, banyan0: 0.5, radhachura0: 1 },
    parkTrees: 0.08,
    life: { p_kameez: 2, p_shirt: 2, p_saree: 1, crowd0: 1.6, crowd1: 1.4, crowd2: 1, fuchka: 0.6, p_vendor: 0.5, flag: 0.8 },
    lifeDensity: 0.1,
    billboards: ['ononto', 'gfun', 'metro', 'walto', 'jfp', 'dana'],
    lampColor: '#ffd9a0', lampSpacing: 36,
    traffic: { density: 13, mix: { car: 4, suv: 2, bus: 2, cng: 2, bike: 2, rickshaw: 0.6, micro: 1 } },
    peds: 0.6, pedKind: 'student',
    tint: { color: '#ff86b0', amount: 0.1 },
    skyline: 'midrise', bonus: 6,
    landmarks: [
      { type: 'ganabhaban', s: 420, side: -1, dist: 72, clear: [330, 520] },
      { type: 'sangsad', s: 1480, side: 1, dist: 200, clear: [1240, 1720] },
      { type: 'novoTheatre', s: 2140, side: 1, dist: 66, clear: [2070, 2210] },
    ],
    events: [
      { type: 'boss', id: 'heli', s: 340, fromX: -70 },
      { type: 'kites', s0: 700, s1: 2000 },
    ],
    lines: [{ s: 60, id: 'manikmia' }, { s: 1200, id: 'sangsad' }, { s: 2280, id: 'flyover' }],
  },

  // ======================================================================== LEVEL 2
  oldDhaka: {
    id: 'oldDhaka', name: 'Puran Dhaka', short: 'OLD DHAKA', bn: 'পুরান ঢাকা', sub: 'Chankharpul · Nazira Bazar · Shakhari Bazar — Shakrain', level: 2,
    lanes: 6, twoWay: true, L: 'cityLow', R: 'cityLow', lampR: false, lampL: false, poles: true, wireDensity: 2.6,
    sections: [
      S(220, 0), S(260, 0.004), S(240, -0.005), S(300, 0.0025, 1), S(260, -0.004, -1), S(280, 0.006),
      S(240, -0.003), S(300, 0), S(260, 0.0045), S(280, -0.0055), S(300, 0.002), S(240, 0),
    ],
    facades: OLD_FACADES, shops: ['shop_old', 'shop_a'], heights: [9, 18],
    trees: { banyan0: 1, mango1: 1 },
    life: { p_lungi: 4, p_panjabi: 3, p_vendor: 2, teastall: 1.5, crowd0: 1, crowd1: 1, cow0: 0.6, cow1: 0.5, dog: 0.8, fruitvan: 0.8 },
    billboards: ['kacchi', 'mastan', 'chanachur', 'coil'],
    lampColor: '#ff9a3a', poleSpacing: 30,
    traffic: { density: 24, mix: { rickshaw: 9, cng: 2, horse: 1.4, bike: 2, car: 1, van: 1.5, tesla: 5 } },
    peds: 1.6, cows: true,
    tint: { color: '#ff8a3a', amount: 0.22, fogMul: 1.35 },
    skyline: 'dense', fairyP: 0.35, markFade: 0.9, roadTint: '#e8dccc',
    landmarks: [
      { type: 'starMosque', s: 900, side: 1, dist: 7.5, clear: [860, 940] },
    ],
    stalls: [[600, 1150, -1], [1700, 2250, 1]],
    events: [
      { type: 'kites', s0: 0, s1: 3200 }, { type: 'fireworks', s0: 300, s1: 3200 }, { type: 'firebreathers', s0: 200, s1: 3000 },
      { type: 'teslas', s: 300, n: 8 },
      { type: 'jam', s: 1900, len: 130 },
      { type: 'enemies', role: 'police', s: 2500, n: 2 },
    ],
    lines: [{ s: 60, id: 'oldDhaka' }, { s: 700, id: 'biryani' }, { s: 1400, id: 'horse' }, { s: 2400, id: 'shakrain' }],
  },

  kawranBazar: {
    id: 'kawranBazar', name: 'Kawran Bazar', short: 'KAWRAN BZR', bn: 'কারওয়ান বাজার', sub: 'Farmgate · Karwan Bazar Metro · Tejgaon', level: 2,
    lanes: 4, L: 'city', R: 'median', far: 'city', metro: true, medianW: 3.2,
    sections: [
      S(260, 0), S(360, -0.0022), S(300, 0.0018), S(380, 0),
      ...METRO_DASH(),
      S(300, 0.0025), S(300, -0.002), S(340, 0), S(300, 0.0015),
    ],
    facades: CBD_FACADES.concat(['apt_tile', 'apt_cream']), shops: ['shop_a', 'shop_b', 'shop_mall'], heights: [15, 36], backHeights: [24, 60], towerP: 0.15,
    trees: { mango0: 1, palm0: 1 },
    life: { ...STREET_LIFE, crowd0: 1.2, crowd1: 1, crowd2: 0.8, p_vendor: 1.5 },
    lifeDensity: 0.12,
    billboards: ['gfun', 'teletalk', 'swapno', 'jfp', 'walto', 'pathaw', 'chanachur', 'coaching', 'metro', 'ononto', 'kolija'],
    bbP: 0.28, lampColor: '#f2f4ff',
    traffic: { density: 24, mix: { bus: 4, brtc: 1, car: 3, cng: 3, bike: 2, truck: 1, leguna: 1.5, rickshaw: 1, tesla: 1.5, micro: 1.5 } },
    peds: 0.9,
    tint: { color: '#6a8aff', amount: 0.08 },
    skyline: 'modern', weather: { rain: 0.3, wet: 0.6 }, bonus: 14,
    landmarks: [
      { type: 'cinemaHall', s: 300, side: -1, dist: 10, clear: [270, 340] },
      { type: 'marketTrucks', s: 1150, side: -1, dist: 16, clear: [1110, 1200] },
      { type: 'tower', s: 1000, side: 1, dist: 80, opts: { facade: 'glass_blue', h: 82, w: 30, d: 30, sign: 'সোনারগাঁও', crown: [2.4, 1.8, 0.6] } },
      { type: 'newspaper', s: 3000, side: -1, dist: 28, clear: [2970, 3040] },
      { type: 'tower', s: 3400, side: -1, dist: 80, opts: { facade: 'glass_green', h: 140, w: 34, d: 34, podium: true, sign: 'বসুন্ধরা সিটি', crown: [2.6, 0.5, 1.8] } },
    ],
    metroStations: [800],
    footbridges: [560, 3200],
    zebras: [400, 1100, 3300],
    events: [
      { type: 'enemies', role: 'police', s: 380, n: 2 },
      { type: 'busrace', s: 900 },
      { type: 'title', s: 1250, text: 'METRO DASH', small: '' },
      { type: 'railTrain', s: 1730, lane: 1, ahead: 600, speed: 18 },
      { type: 'railTrain', s: 2090, lane: -1, ahead: 520, speed: 20 },
      { type: 'teslas', s: 2950, n: 6 },
      { type: 'jam', s: 3150, len: 160 },
    ],
    lines: [
      { s: 60, id: 'farmgate' }, { s: 700, id: 'metro' }, { s: 1000, id: 'busrace' }, { s: 1200, id: 'metroClosed' },
      { s: 1385, id: 'metroStairs' }, { s: 1460, id: 'metroGates' }, { s: 1720, id: 'metroTracks' }, { s: 3000, id: 'prothomalu' },
    ],
  },

  hatirjheel: {
    id: 'hatirjheel', name: 'Hatirjheel', short: 'HATIRJHEEL', bn: 'হাতিরঝিল', sub: 'Panthapath · Boshundhora City · Police Plaza', level: 2,
    lanes: 4, L: 'lake', R: 'lake', lakeW: 220,
    sections: [
      S(200, 0, 0, { L: 'city', R: 'city' }),
      ...MALL_CRAWL(),
      S(400, 0.0035), S(300, -0.0035, 0, { L: 'bridge', R: 'bridge', elev: 3.5 }),
      S(400, 0.0045, 0, { elev: 0 }), S(350, -0.004), S(300, 0, 0, { L: 'bridge', R: 'bridge', elev: 3.5 }),
      S(300, 0, 0, { L: 'city', elev: 0 }),
    ],
    facades: POSH_FACADES, heights: [20, 50], backHeights: [30, 80], towerP: 0.25,
    trees: { palm0: 2, palm1: 2, betel1: 1, krishnachura1: 1 },
    lakeTrees: { palm0: 2, palm1: 2, betel1: 1, bougain0: 1 },
    lakeLife: { p_kameez: 2, p_shirt: 2, crowd1: 1, fuchka: 1 },
    railColor: [0.9, 0.9, 0.92], boats: 'taxi',
    billboards: ['hatir', 'gfun', 'swapno'],
    lampColor: '#e8f0ff', lampSpacing: 30,
    traffic: { density: 10, mix: { car: 4, suv: 2, bike: 2, cng: 1, micro: 1 } },
    peds: 0.4,
    tint: { color: '#ff3bd8', amount: 0.16 },
    skyline: 'lake', waterDeep: '#120a2a', waterLights: '#ff5ad8', bonus: 16,
    landmarks: [
      { type: 'fountain', s: 2600, side: -1, dist: 70 },
    ],
    events: [
      { type: 'title', s: 150, text: 'MALL CRAWL', small: '' },
      { type: 'racers', s: 1450, n: 3 },
    ],
    lines: [{ s: 120, id: 'mall' }, { s: 420, id: 'spiral' }, { s: 830, id: 'cinema' }, { s: 1400, id: 'hatirjheel' }, { s: 2550, id: 'fountain' }],
  },

  // ======================================================================== LEVEL 3
  sadarghat: {
    id: 'sadarghat', name: 'Sadarghat', short: 'SADARGHAT', bn: 'সদরঘাট', sub: 'Babubazar · Ahsan Manzil · Buriganga', level: 3,
    lanes: 4, L: 'river', R: 'city',
    sections: [
      S(300, 0), S(360, 0.002), S(300, -0.0028), S(400, 0), S(300, 0.0032), S(340, -0.002), S(300, 0), S(360, 0.0026), S(300, -0.0035), S(300, 0),
    ],
    facades: OLD_FACADES.concat(['apt_raw', 'tin']), shops: ['shop_old', 'shop_a'], heights: [9, 20],
    trees: { banyan0: 1, palm2: 1, mango1: 1 },
    life: { p_lungi: 4, p_vendor: 2, crowd0: 1, crowd1: 1, teastall: 1.2, dog: 0.6, fruitvan: 0.5 },
    launches: true, boats: 'nouka',
    billboards: ['dana', 'coil', 'chanachur'],
    lampColor: '#ff9f40', wireDensity: 1.6,
    traffic: { density: 20, mix: { rickshaw: 4, cng: 2, truck: 2, leguna: 2, bike: 1, van: 1.5, tesla: 3 } },
    peds: 1.1, cows: true,
    tint: { color: '#3a8a8a', amount: 0.15, fogMul: 1.25 },
    skyline: 'river', weather: { mist: 0.6, wet: 0.3 },
    waterDeep: '#0d1d1c', waterLights: '#ffb060', farWater: true,
    landmarks: [
      { type: 'ahsanManzil', s: 1350, side: 1, dist: 48, clear: [1300, 1400] },
      { type: 'cableBridge', s: 2600, side: -1 },
    ],
    stalls: [[400, 950, 1], [2000, 2400, 1]],
    events: [
      { type: 'teslas', s: 300, n: 6 },
      { type: 'enemies', role: 'police', s: 1500, n: 3 },
    ],
    lines: [{ s: 80, id: 'sadarghat' }, { s: 1200, id: 'ahsan' }, { s: 2400, id: 'launch' }],
  },

  motijheel: {
    id: 'motijheel', name: 'Motijheel', short: 'MOTIJHEEL', bn: 'মতিঝিল', sub: 'Gulistan · Shapla Chattar · Kamalapur — Monsoon', level: 3,
    lanes: 4, L: 'city', R: 'median', far: 'city',
    sections: [
      S(300, 0), S(340, 0.0025), S(300, -0.003), S(380, 0), S(300, 0.0038), S(300, -0.0025), S(360, 0), S(300, 0.002), S(300, -0.0042), S(300, 0),
    ],
    facades: CBD_FACADES, shops: ['shop_b', 'shop_a', 'shop_mall'], heights: [18, 45], backHeights: [30, 80], towerP: 0.2,
    trees: { mango0: 1, palm0: 0.5 },
    life: { p_shirt: 4, p_lungi: 2, crowd0: 0.8, p_vendor: 1, teastall: 1, police: 0.3 },
    billboards: ['swapno', 'dana', 'walto', 'teletalk', 'safety'],
    lampColor: '#f4f2ff',
    traffic: { density: 18, mix: { bus: 3, brtc: 1.2, car: 3, cng: 3, rickshaw: 3, tesla: 2 } },
    peds: 0.5,
    tint: { color: '#3a6aaa', amount: 0.12 },
    skyline: 'modern', weather: { rain: 0.9, wet: 1, storm: true }, bonus: 6,
    puddles: [[200, 3000]],
    landmarks: [
      { type: 'baitulMukarram', s: 420, side: 1, dist: 74 },
      { type: 'shaplaChattar', s: 1250, side: -1, dist: 21, clear: [1215, 1285] },
      { type: 'tower', s: 1750, side: 1, dist: 66, opts: { facade: 'office', h: 112, w: 28, d: 28, sign: 'বাংলাদেশ ব্যাংক', crown: [2.6, 2.2, 1.2] } },
      { type: 'kamalapur', s: 2520, side: -1, dist: 36, clear: [2440, 2600] },
    ],
    events: [
      { type: 'boss', id: 'bus', s: 450 },
      { type: 'loadshed', s: 1700, len: 820 },
    ],
    lines: [{ s: 70, id: 'motijheel' }, { s: 1150, id: 'shapla' }, { s: 1720, id: 'loadshed' }, { s: 2420, id: 'kamalapur' }],
  },

  gulshan: {
    id: 'gulshan', name: 'Gulshan · Banani', short: 'GULSHAN', bn: 'গুলশান · বনানী', sub: 'Mohakhali Flyover · Banani 11 · Gulshan 2', level: 3,
    lanes: 4, L: 'city', R: 'median', far: 'city', latinSigns: 0.55,
    sections: [
      S(260, 0, 0, { elev: 8, L: 'elevated', R: 'elevated' }), S(300, 0.0025, 0, { elev: 8, L: 'elevated', R: 'elevated' }),
      S(260, 0, 0, { elev: 0 }), S(340, -0.003), S(300, 0.0035, 0, { L: 'lake' }), S(300, 0, 0, { L: 'lake' }),
      S(360, -0.0028), S(300, 0.002), S(300, 0), S(340, -0.0035),
    ],
    facades: POSH_FACADES, shops: ['shop_mall', 'shop_b'], heights: [18, 40], backHeights: [30, 70], towerP: 0.2,
    trees: { palm0: 1, palm1: 1, mango0: 1, krishnachura0: 1, betel0: 1 },
    lakeTrees: { palm0: 2, mango0: 1, bougain0: 1 },
    life: { p_shirt: 3, p_kameez: 2, police: 0.6, crowd1: 0.4, dog: 0.3 },
    lifeDensity: 0.05, lakeW: 160,
    billboards: ['swapno', 'dana', 'walto', 'gfun', 'pathaw', 'jfp'],
    lampColor: '#f2f6ff', lampSpacing: 30,
    traffic: { density: 16, mix: { suv: 4, car: 4, bike: 3, cng: 1, bus: 0.5, micro: 1.5 } },
    peds: 0.4,
    tint: { color: '#40c8ff', amount: 0.1 },
    skyline: 'modern', weather: { wet: 0.5 },
    landmarks: [
      { type: 'embassy', s: 1200, side: -1, dist: 12, clear: [1160, 1240] },
      { type: 'tower', s: 1900, side: 1, dist: 70, opts: { facade: 'glass_blue', h: 96, w: 28, d: 28, sign: 'GULSHAN 2', signLatin: true, crown: [0.4, 2.2, 2.8] } },
      { type: 'embassy', s: 2700, side: -1, dist: 12, clear: [2660, 2740] },
    ],
    events: [
      { type: 'enemies', role: 'rab', s: 700, n: 3, label: 'RAB BEHIND' },
      { type: 'vip', s: 1700 },
      { type: 'racers', s: 2300, n: 2 },
    ],
    lines: [{ s: 60, id: 'gulshan' }, { s: 1000, id: 'cha400' }, { s: 1680, id: 'vip' }],
  },

  mirpur: {
    id: 'mirpur', name: 'Mirpur', short: 'MIRPUR', bn: 'মিরপুর', sub: 'Mirpur 10 · Sher-e-Bangla Stadium · Benarasi Palli', level: 3,
    lanes: 4, L: 'city', R: 'median', far: 'city', metro: true, medianW: 3.2,
    sections: [
      S(300, 0), S(340, -0.0022), S(300, 0.003), S(380, 0), S(300, -0.0035), S(300, 0.0025), S(360, 0), S(300, -0.003), S(300, 0.002), S(300, 0),
    ],
    facades: CITY_FACADES, shops: ['shop_a', 'shop_b'], heights: [12, 30],
    trees: { mango0: 1, krishnachura0: 1, palm0: 1 },
    life: { p_shirt: 3, p_lungi: 2, crowd0: 1.5, crowd1: 1.5, crowd2: 1.2, flag: 1.5, sareeshop: 0.8, teastall: 1, fuchka: 0.6 },
    lifeDensity: 0.12,
    billboards: ['bpl', 'gfun', 'pathaw', 'walto', 'chanachur', 'metro'],
    lampColor: '#ffd28a',
    traffic: { density: 22, mix: { bus: 3, cng: 3, car: 2, rickshaw: 3, bike: 3, leguna: 1, tesla: 4 } },
    peds: 1.2,
    tint: { color: '#40ff8a', amount: 0.08 },
    skyline: 'stadium',
    landmarks: [
      { type: 'stadium', s: 1850, side: -1, dist: 120, clear: [1700, 2000] },
    ],
    metroStations: [700],
    zebras: [500, 1300, 2300],
    stalls: [[2500, 2950, -1]],
    events: [
      { type: 'fireworks', s0: 1300, s1: 2600 }, { type: 'crowd', s0: 1400, s1: 2400 },
      { type: 'teslas', s: 400, n: 8 },
      { type: 'enemies', role: 'police', s: 900, n: 2 },
      { type: 'jam', s: 2150, len: 160 },
    ],
    lines: [{ s: 60, id: 'mirpur' }, { s: 1500, id: 'stadium' }, { s: 2700, id: 'benarasi' }],
  },

  // ======================================================================== LEVEL 4 (exits)
  padma: {
    id: 'padma', name: 'Padma Bridge', short: 'PADMA', bn: 'পদ্মা সেতু', sub: 'Mawa Expressway · Toll Plaza · Padma', level: 4, final: true,
    lanes: 4, L: 'field', R: 'median', far: 'field', medianW: 4, fieldLamps: true,
    sections: [
      S(300, 0), S(400, 0.0015), S(300, -0.002), S(400, 0), S(260, 0),
      S(320, 0.001, 0, { elev: 7 }),
      S(1500, 0, 0, { L: 'bridge', R: 'bridge', elev: 14 }),
      S(300, 0, 0, { L: 'bridge', R: 'bridge', elev: 14 }),
    ],
    facades: ['apt_raw', 'tin'], heights: [4, 8],
    trees: { palm0: 2, betel0: 2, banana0: 2, mango1: 1, bamboo0: 1 },
    fieldTrees: 0.05, hutP: 0.2,
    lampColor: '#ffe6c0', bridgeTruss: true, boats: 'fishing', pillarSpacing: 40,
    traffic: { density: 12, mix: { bus: 3, truck: 3, car: 3, suv: 2 } },
    peds: 0,
    tint: { color: '#ff6a4a', amount: 0.08 },
    skyline: 'river', weather: { mist: 0.5 }, waterDeep: '#1b2a3a', farWater: true,
    landmarks: [{ type: 'tollPlaza', s: 1350 }],
    banners: [{ s: 1600, lines: ['পদ্মা সেতু', 'PADMA MULTIPURPOSE BRIDGE'], c1: '#0f7a43', c2: '#04301a' }],
    events: [{ type: 'racers', s: 400, n: 3 }, { type: 'enemies', role: 'police', s: 2000, n: 2 }],
    lines: [{ s: 80, id: 'mawa' }, { s: 1250, id: 'toll' }, { s: 1700, id: 'padma' }, { s: 2700, id: 'flag' }],
    ending: 'padma',
  },

  highway: {
    id: 'highway', name: 'Dhaka–Chattogram Highway', short: 'CTG HWY', bn: 'ঢাকা-চট্টগ্রাম মহাসড়ক', sub: 'Kanchpur · Meghna Bridge · Comilla', level: 4, final: true,
    lanes: 3, L: 'field', R: 'median', far: 'field', medianW: 3, fieldLamps: false, kilns: true,
    sections: [
      S(300, 0), S(400, 0.0018), S(300, -0.0024), S(400, 0), S(300, 0.0028),
      S(260, 0, 0, { elev: 6, L: 'bridge', R: 'bridge' }), S(600, 0, 0, { elev: 10, L: 'bridge', R: 'bridge' }),
      S(260, 0, 0, { elev: 0, L: 'field', R: 'median' }), S(400, -0.002), S(400, 0.0015),
    ],
    facades: ['apt_raw', 'tin', 'apt_cream'], heights: [5, 12],
    trees: { palm0: 2, palm1: 1, betel0: 2, banana0: 2, bamboo0: 2, mango0: 1 },
    fieldTrees: 0.07, hutP: 0.35, fieldLife: { p_lungi: 2, cow0: 1, cow1: 1, teastall: 1 },
    lampColor: '#ffcf8a', boats: 'nouka',
    traffic: { density: 16, mix: { truck: 6, bus: 3, car: 2, suv: 1, micro: 1 } },
    peds: 0.3, cows: true,
    tint: { color: '#ffa060', amount: 0.08 },
    skyline: 'rural', weather: { mist: 0.7 },
    landmarks: [
      { type: 'highwayHotel', s: 900, side: -1, dist: 24 },
      { type: 'highwayHotel', s: 3000, side: -1, dist: 24 },
    ],
    events: [{ type: 'busrace', s: 600 }, { type: 'enemies', role: 'police', s: 1300, n: 3, label: 'POLICE BEHIND' }],
    lines: [{ s: 80, id: 'highway' }, { s: 850, id: 'rosmalai' }, { s: 2000, id: 'meghna' }],
    ending: 'highway',
  },

  purbachal: {
    id: 'purbachal', name: '300 Feet', short: '300 FEET', bn: '৩০০ ফিট', sub: 'Kuril Flyover · Jomuna Future Park · Purbachal', level: 4, final: true,
    lanes: 5, L: 'kash', R: 'median', far: 'kash', medianW: 7, medianPalms: 22, fieldLamps: true,
    sections: [
      S(240, 0, 0, { elev: 8, L: 'elevated', R: 'elevated' }), S(300, -0.004, 0, { elev: 8, L: 'elevated', R: 'elevated' }),
      S(260, 0, 0, { elev: 0, L: 'city', far: 'city' }),
      S(240, 0.0016), S(260, -0.0016), S(240, 0.0014),
      S(500, 0.0012), S(600, 0, 0, { L: 'field' }), S(500, 0.001),
    ],
    facades: CITY_FACADES, heights: [10, 30],
    trees: { palm0: 1, betel0: 1, banana0: 1, mango0: 1 },
    lampColor: '#ffe0b0', lampSpacing: 40,
    traffic: { density: 10, mix: { car: 4, suv: 3, bike: 3, cng: 1 } },
    peds: 0.3,
    tint: { color: '#ffb28a', amount: 0.06 },
    skyline: 'rural', bonus: 14,
    landmarks: [
      { type: 'kurilLoops', s: 180, side: 1, dist: 72 },
      { type: 'jfp', s: 740, side: -1, dist: 70, clear: [560, 960] },
      { type: 'futurePark', s: 740, side: -1, dist: 110 },
    ],
    events: [
      { type: 'racers', s: 2050, n: 4 },
    ],
    lines: [{ s: 80, id: 'kuril' }, { s: 780, id: 'jfp' }, { s: 2100, id: 'racers' }, { s: 2700, id: 'kash' }],
    ending: 'purbachal',
  },

  airport: {
    id: 'airport', name: 'Airport Road', short: 'AIRPORT', bn: 'এয়ারপোর্ট রোড', sub: 'Elevated Expressway · Shahjalal Airport · Uttara', level: 4, final: true,
    lanes: 4, L: 'city', R: 'median', far: 'city',
    sections: [
      S(260, 0), S(300, 0.002, 0, { elev: 12, L: 'elevated', R: 'elevated' }), S(500, -0.0015, 0, { elev: 14, L: 'elevated', R: 'elevated' }),
      S(500, 0, 0, { elev: 14, L: 'elevated', R: 'elevated' }), S(400, 0.002, 0, { elev: 14, L: 'elevated', R: 'elevated' }),
      S(300, 0, 0, { elev: 0 }), S(400, -0.002, 0, { L: 'kash', far: 'kash' }), S(400, 0, 0, { L: 'kash', far: 'kash' }),
    ],
    facades: CITY_FACADES.concat(['glass_green']), shops: ['shop_a', 'shop_b'], heights: [12, 32],
    trees: { palm0: 1, mango0: 1, krishnachura0: 1 },
    lampColor: '#fff0d0',
    billboards: ['dana', 'swapno', 'walto'],
    traffic: { density: 13, mix: { car: 4, suv: 3, bus: 2, cng: 1, micro: 1 } },
    peds: 0.3,
    tint: { color: '#ffa0a0', amount: 0.06 },
    skyline: 'modern',
    landmarks: [{ type: 'airport', s: 1650, side: 1, dist: 175 }],
    events: [{ type: 'planes', s0: 600, s1: 2800 }, { type: 'enemies', role: 'rab', s: 800, n: 2 }],
    lines: [{ s: 80, id: 'expressway' }, { s: 1300, id: 'plane' }, { s: 2400, id: 'uttara' }],
    ending: 'airport',
  },

  savar: {
    id: 'savar', name: 'Savar', short: 'SAVAR', bn: 'সাভার', sub: 'Gabtoli · Aminbazar · Jatiyo Smriti Soudho', level: 4, final: true,
    lanes: 4, L: 'city', R: 'median', far: 'city', kilns: true,
    sections: [
      S(300, 0), S(260, 0, 0, { elev: 5, L: 'bridge', R: 'bridge' }), S(300, 0.001, 0, { elev: 5, L: 'bridge', R: 'bridge' }),
      S(260, 0, 0, { elev: 0, L: 'field', R: 'median', far: 'field' }), S(500, -0.002, 0, { L: 'field', far: 'field' }),
      S(400, 0.0025, 0, { L: 'field', far: 'field' }), S(500, 0, 0, { L: 'field', far: 'field' }),
      S(400, -0.0015, 0, { L: 'field', far: 'field' }), S(500, 0, 0, { L: 'park', far: 'park' }),
    ],
    facades: CITY_FACADES, shops: ['shop_a'], heights: [8, 20],
    trees: { palm0: 2, betel0: 1, banana0: 2, mango0: 1, bamboo0: 1, krishnachura0: 1 },
    fieldTrees: 0.06, hutP: 0.3, fieldLife: { p_lungi: 2, cow0: 1, cow1: 1 },
    lampColor: '#ffd8a0', boats: 'nouka',
    traffic: { density: 16, mix: { bus: 5, truck: 3, cng: 2, car: 2, tesla: 2 } },
    peds: 0.4, cows: true,
    tint: { color: '#ff8a6a', amount: 0.06 },
    skyline: 'rural', weather: { mist: 0.4 },
    landmarks: [
      { type: 'gabtoli', s: 140, side: -1, dist: 26, clear: [60, 220] },
      { type: 'smritiSoudho', s: 3640, side: -1, dist: 64 },
    ],
    events: [{ type: 'teslas', s: 300, n: 5 }, { type: 'enemies', role: 'police', s: 1300, n: 3 }],
    lines: [{ s: 60, id: 'gabtoli' }, { s: 500, id: 'turag' }, { s: 1800, id: 'kilns' }, { s: 3000, id: 'smriti' }],
    ending: 'savar',
  },
};

export const ENDINGS = {
  padma: {
    title: 'Padma Bridge', bn: 'পদ্মা সেতু', headline: 'ACROSS THE PADMA',
    lines: [
      'Six kilometres of steel over the Padma, and the sun comes up red on green.',
      'The fishing boats are already out. Somewhere in Faridpur, Khala is frying ilish.',
      'You did not just leave Dhaka. You crossed a river people waited fifty years to cross.',
    ],
  },
  highway: {
    title: 'Dhaka–Chattogram Highway', bn: 'ঢাকা-চট্টগ্রাম মহাসড়ক', headline: 'SOUTH TO THE SEA',
    lines: [
      'Past Meghna Bridge the trucks thin out and the paddy turns gold.',
      'You stop in Comilla for rosmalai. Then you keep driving, because why not.',
      'By lunch you are standing in the sea at Cox’s Bazar, still holding the car keys.',
    ],
  },
  purbachal: {
    title: '300 Feet', bn: '৩০০ ফিট', headline: 'KASH AND OPEN ROAD',
    lines: [
      'Kash flowers on both sides, the road wide enough for a cricket match.',
      'Four hundred other cars had the same idea. Everybody pulls over for cha at Neela Market.',
      'Dhaka is behind you. For once, so is the traffic.',
    ],
  },
  airport: {
    title: 'Hazrat Shahjalal International Airport', bn: 'বিমানবন্দর', headline: 'FLIGHT AT 7:05',
    lines: [
      'You make the 7:05 flight with eleven minutes to spare.',
      'Ammu packed twenty-three kilos of achar, two of shutki, and a prayer.',
      'The plane banks over the city you just outran. It looks small from up here.',
    ],
  },
  savar: {
    title: 'Jatiyo Smriti Soudho', bn: 'জাতীয় স্মৃতিসৌধ', headline: 'SEVEN WALLS AT DAWN',
    lines: [
      'Seven walls rising out of red brick, one sunrise behind them.',
      'The engine ticks as it cools. Tuntuni goes quiet for the first time all night.',
      'Some roads are for racing. Some are for remembering.',
    ],
  },
};

// ------------------------------------------------------------------ the single route
// One road through every stage, dusk to dawn, ending on the Padma Bridge.
export const ROUTE = [
  'dhanmondi', 'shahbag', 'manikmia', 'kawranBazar', 'hatirjheel', 'gulshan', 'oldDhaka', 'sadarghat',
  'motijheel', 'mirpur', 'airport', 'purbachal', 'highway', 'savar', 'padma',
];
const H0 = 17.35, H1 = 30.35;
// each district has its own song; consecutive districts never share one
const AREA_MUSIC = ['monsoon', 'baul', 'buriganga', 'monsoon', 'kalbaishakhi', 'buriganga', 'baul', 'kalbaishakhi', 'buriganga', 'monsoon', 'buriganga', 'baul', 'kalbaishakhi', 'baul', 'monsoon'];
ROUTE.forEach((id, i) => {
  const st = STAGES[id];
  st.music = AREA_MUSIC[i];
  st.level = i;
  st.final = i === ROUTE.length - 1;
});
// hour range per leg of the route (continuous axis, 24+ = after midnight)
export const LEVEL_TIME = ROUTE.map((_, i) => [H0 + (i / ROUTE.length) * (H1 - H0), H0 + ((i + 1) / ROUTE.length) * (H1 - H0)]);
export const CHECKPOINT_BONUS = ROUTE.map((_, i) => (i === 0 ? 0 : 40));

// the next stage along the route (kept as a pair for the old fork plumbing)
export function childrenOf(id) {
  const i = ROUTE.indexOf(id);
  if (i < 0 || i >= ROUTE.length - 1) return null;
  return [ROUTE[i + 1], ROUTE[i + 1]];
}

export function columnOf(id) {
  return [Math.max(0, ROUTE.indexOf(id)), 0];
}
