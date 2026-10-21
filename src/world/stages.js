// Dhaka's districts: each one's road (sections), look (facades, trees, street
// life, lamps, tint) and landmarks. A district is raced on its own as a lap
// circuit, or all fifteen are strung together as the Run.
//
// Section helper S(len, curvature, elevationChange, extras). Positive k = right.
// Extras: L/R/far side types, elev (road height above terrain), lanes.

const S = (len, k = 0, dy = 0, extra = {}) => ({ len, k, dy, ...extra });


const CITY_FACADES = ['apt_cream', 'apt_pink', 'apt_mint', 'apt_yellow', 'apt_white', 'apt_blue', 'apt_tile', 'apt_tile2', 'apt_raw'];
const OLD_FACADES = ['old_ochre', 'old_blue', 'old_pink', 'brick', 'apt_raw', 'old_ochre'];
const CBD_FACADES = ['office', 'glass_blue', 'glass_green', 'apt_white', 'apt_tile2', 'office'];
const POSH_FACADES = ['glass_blue', 'glass_green', 'apt_white', 'apt_blue', 'office', 'apt_white'];

const STREET_LIFE = { p_lungi: 3, p_shirt: 3, p_saree: 2, p_kameez: 2, p_panjabi: 1, p_vendor: 1, teastall: 1.2, fuchka: 0.8, crowd0: 0.6, crowd1: 0.5, dog: 0.5, police: 0.15, fruitvan: 0.4 };

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
    tint: { color: '#ffb070', amount: 0.08 },
    skyline: 'midrise', fairyP: 0.15,
    landmarks: [
      { type: 'satmasjid', s: 170, side: 1, dist: 52, clear: [90, 260] },
      { type: 'sarobar', s: 1260, side: -1, dist: 28 },
      { type: 'floodlights', s: 2660, side: -1, dist: 18, clear: [2560, 2780], opts: { w: 60, d: 90 } },
    ],
    footbridges: [880, 2100, 3350],
    zebras: [500, 1700, 2400, 3100],
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
    tint: { color: '#ff7a8a', amount: 0.12 },
    skyline: 'midrise',
    alpana: [[0, 3100]],
    landmarks: [
      { type: 'curzonHall', s: 240, side: -1, dist: 28, clear: [170, 330] },
      { type: 'shaheedMinar', s: 840, side: -1, dist: 16, clear: [780, 920] },
    ],
    banners: [{ s: 120, lines: ['শুভ নববর্ষ ১৪৩৩', 'SHUBHO NOBOBORSHO'] }, { s: 1850, lines: ['মঙ্গল শোভাযাত্রা', 'CHARUKOLA · DHAKA UNIVERSITY'], c1: '#1d5fa8', c2: '#0d2f5c' }],
    zebras: [600, 1300, 2000, 2700],
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
    tint: { color: '#ff86b0', amount: 0.1 },
    skyline: 'midrise', bonus: 6,
    landmarks: [
      { type: 'ganabhaban', s: 420, side: -1, dist: 72, clear: [330, 520] },
      { type: 'sangsad', s: 1480, side: 1, dist: 200, clear: [1240, 1720] },
      { type: 'novoTheatre', s: 2140, side: 1, dist: 66, clear: [2070, 2210] },
    ],
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
    tint: { color: '#ff8a3a', amount: 0.22, fogMul: 1.35 },
    skyline: 'dense', fairyP: 0.35, markFade: 0.9, roadTint: '#e8dccc',
    landmarks: [
      { type: 'starMosque', s: 900, side: 1, dist: 7.5, clear: [860, 940] },
    ],
  },

  kawranBazar: {
    id: 'kawranBazar', name: 'Kawran Bazar', short: 'KAWRAN BZR', bn: 'কারওয়ান বাজার', sub: 'Farmgate · Karwan Bazar Metro · Tejgaon', level: 2,
    lanes: 4, L: 'city', R: 'median', far: 'city', metro: true, medianW: 3.2,
    sections: [
      S(260, 0), S(360, -0.0022), S(300, 0.0018), S(380, 0),
      S(520, 0), S(520, 0), S(516, 0),
      S(300, 0.0025), S(300, -0.002), S(340, 0), S(300, 0.0015),
    ],
    facades: CBD_FACADES.concat(['apt_tile', 'apt_cream']), shops: ['shop_a', 'shop_b', 'shop_mall'], heights: [15, 36], backHeights: [24, 60], towerP: 0.15,
    trees: { mango0: 1, palm0: 1 },
    life: { ...STREET_LIFE, crowd0: 1.2, crowd1: 1, crowd2: 0.8, p_vendor: 1.5 },
    lifeDensity: 0.12,
    billboards: ['gfun', 'teletalk', 'swapno', 'jfp', 'walto', 'pathaw', 'chanachur', 'coaching', 'metro', 'ononto', 'kolija'],
    bbP: 0.28, lampColor: '#f2f4ff',
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
  },

  hatirjheel: {
    id: 'hatirjheel', name: 'Hatirjheel', short: 'HATIRJHEEL', bn: 'হাতিরঝিল', sub: 'Panthapath · Boshundhora City · Police Plaza', level: 2,
    lanes: 4, L: 'lake', R: 'lake', lakeW: 220,
    sections: [
      S(200, 0, 0, { L: 'city', R: 'city' }),
      S(370, 0, 0, { L: 'city', R: 'city' }), S(370, 0), S(368, 0),
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
    tint: { color: '#ff3bd8', amount: 0.16 },
    skyline: 'lake', waterDeep: '#120a2a', waterLights: '#ff5ad8', bonus: 16,
    landmarks: [
      { type: 'fountain', s: 2600, side: -1, dist: 70 },
    ],
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
    tint: { color: '#3a8a8a', amount: 0.15, fogMul: 1.25 },
    skyline: 'river', weather: { mist: 0.6, wet: 0.3 },
    waterDeep: '#0d1d1c', waterLights: '#ffb060', farWater: true,
    landmarks: [
      { type: 'ahsanManzil', s: 1350, side: 1, dist: 48, clear: [1300, 1400] },
      { type: 'cableBridge', s: 2600, side: -1 },
    ],
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
    tint: { color: '#3a6aaa', amount: 0.12 },
    skyline: 'modern', weather: { rain: 0.9, wet: 1, storm: true }, bonus: 6,
    puddles: [[200, 3000]],
    landmarks: [
      { type: 'baitulMukarram', s: 420, side: 1, dist: 74 },
      { type: 'shaplaChattar', s: 1250, side: -1, dist: 21, clear: [1215, 1285] },
      { type: 'tower', s: 1750, side: 1, dist: 66, opts: { facade: 'office', h: 112, w: 28, d: 28, sign: 'বাংলাদেশ ব্যাংক', crown: [2.6, 2.2, 1.2] } },
      { type: 'kamalapur', s: 2520, side: -1, dist: 36, clear: [2440, 2600] },
    ],
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
    tint: { color: '#40c8ff', amount: 0.1 },
    skyline: 'modern', weather: { wet: 0.5 },
    landmarks: [
      { type: 'embassy', s: 1200, side: -1, dist: 12, clear: [1160, 1240] },
      { type: 'tower', s: 1900, side: 1, dist: 70, opts: { facade: 'glass_blue', h: 96, w: 28, d: 28, sign: 'GULSHAN 2', signLatin: true, crown: [0.4, 2.2, 2.8] } },
      { type: 'embassy', s: 2700, side: -1, dist: 12, clear: [2660, 2740] },
    ],
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
    tint: { color: '#40ff8a', amount: 0.08 },
    skyline: 'stadium',
    landmarks: [
      { type: 'stadium', s: 1850, side: -1, dist: 120, clear: [1700, 2000] },
    ],
    metroStations: [700],
    zebras: [500, 1300, 2300],
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
    tint: { color: '#ff6a4a', amount: 0.08 },
    skyline: 'river', weather: { mist: 0.5 }, waterDeep: '#1b2a3a', farWater: true,
    landmarks: [{ type: 'tollPlaza', s: 1350 }],
    banners: [{ s: 1600, lines: ['পদ্মা সেতু', 'PADMA MULTIPURPOSE BRIDGE'], c1: '#0f7a43', c2: '#04301a' }],
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
    tint: { color: '#ffa060', amount: 0.08 },
    skyline: 'rural', weather: { mist: 0.7 },
    landmarks: [
      { type: 'highwayHotel', s: 900, side: -1, dist: 24 },
      { type: 'highwayHotel', s: 3000, side: -1, dist: 24 },
    ],
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
    tint: { color: '#ffb28a', amount: 0.06 },
    skyline: 'rural', bonus: 14,
    landmarks: [
      { type: 'kurilLoops', s: 180, side: 1, dist: 72 },
      { type: 'jfp', s: 740, side: -1, dist: 70, clear: [560, 960] },
    ],
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
    tint: { color: '#ffa0a0', amount: 0.06 },
    skyline: 'modern',
    landmarks: [{ type: 'airport', s: 1650, side: 1, dist: 175 }],
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
    tint: { color: '#ff8a6a', amount: 0.06 },
    skyline: 'rural', weather: { mist: 0.4 },
    landmarks: [
      { type: 'gabtoli', s: 140, side: -1, dist: 26, clear: [60, 220] },
      { type: 'smritiSoudho', s: 3640, side: -1, dist: 64 },
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

// the next stage along the route (as a pair: the world's track plumbing expects two branches)
export function childrenOf(id) {
  const i = ROUTE.indexOf(id);
  if (i < 0 || i >= ROUTE.length - 1) return null;
  return [ROUTE[i + 1], ROUTE[i + 1]];
}



// ------------------------------------------------------------------ the Run: a knockout across the city
// Everyone starts in Dhanmondi. Entering these districts is a knockout gate:
// anyone below the cut-off is out, so the back of the field is thinned at every gate.
export const RUN_FIELD = 48;
export const KNOCKOUTS = { shahbag: 46, kawranBazar: 39, gulshan: 32, sadarghat: 28, mirpur: 26, purbachal: 23 };

// ------------------------------------------------------------------ district circuits
// A district raced as laps: its own sections scaled to about LAP_LEN, long
// plain straights given a bend and a crest, laid down CIRCUIT_LAPS times end
// to end (every lap has the same corners in the same order). Landmarks and
// street furniture are scaled and repeated with the lap.
export const CIRCUIT_LAPS = 3;
const LAP_LEN = 3200;
const WATER = ['lake', 'river', 'bridge'];

export function circuitId(id) { return id + '@circuit'; }

export function circuitStage(id) {
  const key = circuitId(id);
  if (STAGES[key]) return STAGES[key];
  const base = STAGES[id];
  const total = base.sections.reduce((a, s) => a + s.len, 0);
  const f = LAP_LEN / total;
  let flip = 1, hill = 1;
  const lap = [];
  base.sections.forEach((s0, i) => {
    const s = { ...s0, len: Math.round(s0.len * f) };
    const water = WATER.includes(s.L || base.L) || WATER.includes(s.R || base.R);
    const ends = i === 0 || i === base.sections.length - 1;
    if (!s.dy && !ends && !water && s.elev == null && !base.flat) { s.dy = 10 * hill; hill = -hill; }
    if (!ends && !water && s.len >= 200) {
      // a bend and then the bend back, so the road weaves instead of swinging round: heading never strays more than
      // about 70 degrees from the road's line, and a lap (or three laid end to end) cannot loop into itself
      const K = Math.min(0.0042, Math.abs(s.k || 0) || 0.0034) * flip;
      flip = -flip;
      const h1 = Math.round(s.len / 2);
      lap.push({ ...s, len: h1, k: K, dy: (s.dy || 0) / 2 }, { ...s, len: s.len - h1, k: -K, dy: (s.dy || 0) / 2 });
    } else {
      if (!s.k && !ends && !water && s.len > 90) { s.k = 0.0036 * flip; flip = -flip; }
      lap.push(s);
    }
  });
  // close the lap's hills so every lap starts at the same height
  const rise = lap.reduce((a, s) => a + (s.dy || 0), 0);
  if (rise) lap[lap.length - 1].dy = (lap[lap.length - 1].dy || 0) - rise;
  const lapLen = lap.reduce((a, s) => a + s.len, 0);
  const at = (s, i) => s * f + i * lapLen;
  const every = (list, fn) => Array.from({ length: CIRCUIT_LAPS }, (_, i) => (list || []).map((v) => fn(v, i))).flat();
  const [h0, h1] = LEVEL_TIME[base.level];
  STAGES[key] = {
    ...base,
    id: key, circuit: true, district: id, laps: CIRCUIT_LAPS, lapLen, final: true, hour: (h0 + h1) / 2,
    sections: every(lap, (s) => ({ ...s })),
    landmarks: every(base.landmarks, (l, i) => ({ ...l, s: at(l.s, i), clear: l.clear && [at(l.clear[0], i), at(l.clear[1], i)] })),
    footbridges: every(base.footbridges, at),
    zebras: every(base.zebras, at),
    metroStations: every(base.metroStations, at),
    banners: every(base.banners, (b, i) => ({ ...b, s: at(b.s, i) })),
    alpana: every(base.alpana, ([a, b], i) => [at(a, i), at(b, i)]),
    puddles: every(base.puddles, ([a, b], i) => [at(a, i), at(b, i)]),
  };
  return STAGES[key];
}

// ------------------------------------------------------------------ the map
// Where each district sits on the title map (0..1 across, 0..1 down), roughly
// true to Dhaka with the far exits pulled in to fit.
export const MAP_POS = {
  mirpur: [0.30, 0.18], airport: [0.55, 0.08], gulshan: [0.60, 0.28], purbachal: [0.86, 0.20],
  savar: [0.07, 0.22], manikmia: [0.36, 0.38], kawranBazar: [0.47, 0.42], hatirjheel: [0.60, 0.43],
  dhanmondi: [0.33, 0.52], shahbag: [0.46, 0.55], motijheel: [0.63, 0.60], oldDhaka: [0.50, 0.70],
  sadarghat: [0.47, 0.80], highway: [0.88, 0.76], padma: [0.30, 0.95],
};
