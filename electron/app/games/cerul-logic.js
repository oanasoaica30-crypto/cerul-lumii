/* Cerul Lumii — motorul jocului (logică pură, deterministă dat fiind rng/now). Fără DOM.
   window.CerulLogic (browser) / module.exports (Node). API: briefs/DONE_CERUL_LOGIC.md
   Constantele vin din window.CerulTune (secțiuni: time, start, demand, price, share, AIRCRAFT, planes, …), citite LENEȘ;
   datele din window.CerulData (aeroporturi, evenimente, realizări, sfaturi), cu un set de rezervă mic. */
(function () {
"use strict";
const G = typeof window !== "undefined" ? window : globalThis;
const ISNODE = typeof module !== "undefined" && module.exports && typeof require === "function";
const MIN_DAY = 1440;

/* ======================= TUNE: CerulTune (imbricat) → K (plat) ======================= */
const DEF_PLANES = [
  { id: "t72", n: "Turbo 72", seats: 70, range: 1800, speed: 520, price: 3000000, ckm: 4, crewH: 400, maint: 5000, feeMult: 0.6, pilot: 6000, minSize: 1, lease: 33000 },
  { id: "a320", n: "Aero 320", seats: 180, range: 5000, speed: 840, price: 9000000, ckm: 11, crewH: 900, maint: 14000, feeMult: 1.0, pilot: 12000, minSize: 1, lease: 99000 },
  { id: "s350", n: "Skyliner 350", seats: 320, range: 14500, speed: 900, price: 24000000, ckm: 18, crewH: 1600, maint: 36000, feeMult: 1.8, pilot: 20000, minSize: 2, lease: 264000 },
  { id: "c40", n: "Colibri 40", seats: 40, range: 1100, speed: 460, price: 1200000, ckm: 1.8, crewH: 160, maint: 1400, feeMult: 0.35, pilot: 3000, minSize: 1, lease: 20000 },
  { id: "r100", n: "Regio 100", seats: 100, range: 3000, speed: 780, price: 5500000, ckm: 4.8, crewH: 500, maint: 7000, feeMult: 0.7, pilot: 8000, minSize: 1, lease: 85000 },
  { id: "c230", n: "Cometa 230", seats: 230, range: 8500, speed: 860, price: 15000000, ckm: 12, crewH: 1200, maint: 22000, feeMult: 1.3, pilot: 16000, minSize: 2, lease: 225000 },
];
const PLANE_IDS = DEF_PLANES.map(p => p.id);                       // index = ty (stabil: 0–2 vechi, 3–5 noi)
const DEF_ORDER = [3, 0, 4, 1, 5, 2];                               // de la mic la mare
const SP_BAL = { inghet: "frz", spargator: "brk", rapid: "fast", vip: "vip", boom: "boom", combust: "fuel", spion: "spy", reclama: "ad", asigurare: "ins", slot: "slot", cadou: "gift" };
const SP_DATA = { freeze: "frz", breaker: "brk", fastbuild: "fast", vip: "vip", boom: "boom", fuel: "fuel", spy: "spy", ads: "ad", insurance: "ins", slot: "slot", giftplane: "gift" };
const SPECIALS = ["frz", "brk", "fast", "vip", "boom", "fuel", "spy", "ad", "ins", "slot", "gift"];
const SP_TO_DATA = {}; for (const k in SP_DATA) SP_TO_DATA[SP_DATA[k]] = k;
function normSpecial(id) { if (typeof id !== "string") return null; if (SPECIALS.indexOf(id) >= 0) return id; return SP_DATA[id] || SP_BAL[id] || null; }
const RES_KEYS = ["aprobare", "infra", "echipaj", "combustibil", "joker"];
function normCardType(t) { if (typeof t === "number") return t; const i = RES_KEYS.indexOf(t); return i >= 0 ? i : (t != null && t !== "" && !isNaN(+t) ? +t : -1); }
function normPlaneType(t) {
  if (typeof t === "number") return t | 0; if (typeof t !== "string") return -1;
  const m = { t72: 0, turbo72: 0, a320: 1, aero320: 1, s350: 2, sky350: 2, c40: 3, colibri40: 3, r100: 4, regio100: 4, c230: 5, cometa230: 5 }; if (m[t] !== undefined) return m[t];
  const f = t.toLowerCase().replace(/[^a-z0-9]/g, ""); if (m[f] !== undefined) return m[f];
  return isNaN(+t) ? -1 : +t;
}
let TUc = null, TUsrc, TUreq = null;
function TU() {
  let src = G.CerulTune || null;
  if (!src && ISNODE) {
    if (TUreq === null) { try { TUreq = require("./cerul-tune.js") || false; } catch (e) { TUreq = false; } }
    src = TUreq || null;
  }
  if (TUc && TUsrc === src) return TUc;
  const T = src || {};
  const g = (sec, key, def) => { const s = T[sec]; return s && s[key] !== undefined && s[key] !== null ? s[key] : def; };
  const AC = Array.isArray(T.AIRCRAFT) ? T.AIRCRAFT : [];
  const PLANES = DEF_PLANES.map((d, i) => { const a = AC[i] || {}; const v = (k, dk) => a[k] !== undefined ? a[k] : d[dk || k];
    return { ty: i, id: d.id, n: a.name || d.n, role: a.role || "", seats: v("seats"), range: v("range"), speed: v("speed"), price: v("price"), ckm: v("fuelPerKm", "ckm"),
      crewH: v("crewPerH", "crewH"), maint: v("maintDay", "maint"), feeMult: v("feeMult"), pilot: v("pilotDay", "pilot"), minSize: v("minSize"), lease: v("leaseDay", "lease") }; });
  const odds = g("cards", "odds", null);
  const oddsArr = odds && typeof odds === "object" && !Array.isArray(odds) ? [odds.aprobare, odds.infra, odds.echipaj, odds.combustibil, odds.joker, odds.special].map(x => +x || 0) : [0.22, 0.22, 0.22, 0.22, 0.06, 0.06];
  const spc = g("cards", "special", null), SPC = { frz: 6, brk: 4, fast: 4, vip: 3, boom: 4, fuel: 3, spy: 3, ad: 4, ins: 3, slot: 2, gift: 1 }, LIM = { frz: 3, brk: 2 };
  if (spc) for (const k in spc) { const id = normSpecial(k); if (!id) continue; if (spc[k].count !== undefined) SPC[id] = spc[k].count; if (spc[k].maxHeld !== undefined) LIM[id] = spc[k].maxHeld; }
  const K = {
    PLANES, ORDER: (Array.isArray(T.planeOrder) && T.planeOrder.length === PLANES.length ? T.planeOrder : DEF_ORDER).slice(), SPECIALS: SPC, LIMITS: LIM, cardOdds: oddsArr,
    startHour: g("time", "startHour", 6), setupResolveSec: g("time", "setupVoteTimeoutMs", 30000) / 1000, noLimitMaxDays: g("time", "noLimitMaxDays", 400),
    durDefault: g("time", "durationDefault", 120), dayDefault: g("time", "dayRealMinDefault", 1), draftEstPick: g("time", "draftEstSecPerPick", 4),
    botEveryMs: g("net", "botDecideMs", 1000), botMax: g("net", "botMaxActions", 3),
    startCash: g("start", "cash", 20000000), startCards: g("start", "resourceCards", 4), offerN: g("start", "permitOffer", 3), repStart: g("start", "stars", 3),
    freePlaneType: g("start", "freePlaneType", 0), baseSize: g("start", "baseSize", 2), baseMinDistKm: g("start", "baseMinDistKm", 3500), baseTol: g("start", "baseDemandTolerance", 0.3),
    gatesOn: g("gates", "on", true), gatesBySize: g("gates", "bySize", [0, 3, 6, 10]), gatesPerPlayer: g("gates", "perPlayerAbove2", 0.25), gateMaxWait: g("gates", "maxWaitMin", 180), gateBusy: g("gates", "busyFrac", 0.8),
    sameContinent: g("start", "sameContinent", true), startMaxYield: g("start", "maxYield", 1.0),
    yieldReg: g("price", "yieldByRegion", null), interPrem: g("price", "intercontPrem", 1), interBizPrem: g("price", "intercontBizPrem", 1), yieldCostExp: g("price", "yieldCostExp", 0), baseDistBands: g("start", "baseDistBands", null), basePopMin: g("start", "basePopMin", 1.5), baseContW: g("start", "baseContW", null),
    chShare: g("chain", "share", 0.3), chStop: g("chain", "stopMin", 30), chVsDirect: g("chain", "vsDirect", 0.35), chVsOwn: g("chain", "vsOwnDirect", 0.5), chDetour: g("chain", "maxDetour", 1.6),
    starterOn: g("start", "starterRoute", true), starterTries: g("start", "starterTries", 10), starterProfitTol: g("start", "starterProfitTol", 0.15), starterProfitTarget: g("start", "starterProfitTarget", 30000), starterBands: g("start", "starterBands", [[500, 1000, 90], [450, 1200, 70], [350, 1500, 45], [250, 2000, 30]]),
    starterDistTol: g("start", "starterDistTol", 0.15), starterDemTol: g("start", "starterDemTol", 0.2), starterTurboDem: g("start", "starterTurboDem", 90), starterPilot: g("start", "starterPilot", true),
    chFreqExp: g("chain", "freqExp", 0.35), chFreqMax: g("chain", "freqMax", 1.5), capAdd4p: g("slots", "capAdd4p", 0),
    demK: g("demand", "k", 1000), popExp: g("demand", "popExp", 0.5), demExp: g("demand", "distExp", 0.45), minDistKm: g("demand", "minDistKm", 250),
    demCap: g("demand", "cap", 1600), demMin: g("demand", "floor", 30), sizeMult: g("demand", "sizeMult", [0, 0.75, 1, 1.2]), intercontMult: g("demand", "intercontMult", 1.1),
    priceElast: g("demand", "priceElast", 1.3), priceElastAfaceri: g("demand", "priceElastAfaceri", 0.8), priceMultMax: g("demand", "priceMultMax", 2), priceKnee: g("demand", "priceKneeMult", 1.4), priceElastHigh: g("demand", "priceElastHigh", 2.6), priceMultMin: g("demand", "priceMultMin", 0.02),
    ramp0: g("demand", "rampStart", 0.5), rampDays: g("demand", "rampDays", 7), queueLife: g("demand", "queueLifeMin", 1440), queueCapDays: g("demand", "queueCapDays", 1.5),
    dailyNoise: g("demand", "dailyNoise", 0.1), dayCurve: g("demand", "dayCurve", null), transitShare: g("demand", "transitShare", 0.25), hubTransit: g("demand", "transitHubMult", 1.5),
    transitMaxDistRatio: g("demand", "transitMaxDistRatio", 1.6), transitMaxPairs: g("demand", "transitMaxPairs", 40), daysPerMonth: g("demand", "daysPerMonth", 10),
    seasonTbl: g("demand", "season", null), seasonDamp: g("demand", "seasonDamp", 0.6),
    pBase: g("price", "base", 90), pKm: g("price", "perKm", 0.3), pLongKm: g("price", "longKm", 4000), pKmLong: g("price", "perKmLong", 0.2), pRound: g("price", "round", 5),
    cheapMult: g("price", "cheapMult", 0.75), premiumMult: g("price", "premiumMult", 1.4), priceMinMult: g("price", "minMult", 0.1), priceMaxMult: g("price", "maxMult", 10),
    priceMinAbs: g("price", "minAbs", 1), recLoad: g("price", "recMarginLoad", 0.85), recMaxMult: g("price", "recMaxMult", 0),
    freqWMin: g("share", "freqWMin", 0.6), spillFrac: g("share", "spillFrac", 0.7), spillCapMult: g("share", "spillCapMult", 1.15), noPlaneAttr: g("share", "noPlaneAttr", 0.3), elast: g("share", "eps", 1.8), starW: g("share", "starsK", 0.15), freqExp: g("share", "freqExp", 0.35), freqMin: g("share", "freqMin", 0.25),
    flightExtra: g("planes", "flightExtraMin", 30), turnMin: g("planes", "turnaroundMin", 45), pilotMaxWait: g("planes", "maxWaitPilotMin", 360), pilotMinWait: g("planes", "pilotMinWaitMin", 60),
    pilotMargin: g("planes", "pilotMargin", 0.15), pilotMinLoad: g("planes", "pilotMinLoad", 0), pilotSmartMaxMin: g("planes", "pilotSmartMaxMin", 75), pilotHardMaxMin: g("planes", "pilotHardMaxMin", 1440), coordOn: g("planes", "coordinate", true), depDay: g("planes", "depPerDay", 0.004), depMin: g("planes", "depFloor", 0.25), sellMult: g("planes", "sellMult", 0.9),
    maintAge: g("planes", "maintAgePerDay", 0.003), fuelStart: g("planes", "fuelIndexStart", 1), fuelMin: g("planes", "fuelIndexMin", 0.7), fuelMax: g("planes", "fuelIndexMax", 1.8),
    fuelVol: g("planes", "fuelIndexDrift", 0.04), fuelRevert: g("planes", "fuelIndexRevert", 0.1), landFee: g("planes", "landingFeeBySize", [0, 1500, 3000, 6000]),
    hubFeeMult: g("planes", "hubFeeMult", 0.5), maxPlanes: g("planes", "maxPlanesPerCompany", 40), reassignMin: g("planes", "reassignMin", 60),
    leaseReturnDays: g("lease", "returnFeeDays", 3), buyCredit: g("lease", "buyoutCredit", 0.5), buyMinFrac: g("lease", "buyoutMinFrac", 0.1), ownMult: g("lease", "ownMult", 1.15), maxLeased: g("lease", "maxLeased", 6),
    usedN: g("used", "count", [4, 6]), usedDays: g("used", "refreshDays", 7), usedAge: g("used", "ageDays", [40, 160]), usedDisc: g("used", "priceMult", 0.92), usedW: g("used", "typeWeights", [0.28, 0.24, 0.08, 0.16, 0.16, 0.08]),
    breakBase: g("breakdown", "base", 0.003), breakAge: g("breakdown", "perAgeDay", 0.00008), breakMax: g("breakdown", "max", 0.08), delayRange: g("breakdown", "delayMin", [120, 360]),
    repairMult: g("breakdown", "repairCostMult", 0.01), delayRep: g("breakdown", "starsHit", 0.1),
    repMin: g("rep", "min", 1), repMax: g("rep", "max", 5), repFlight: g("rep", "perFlight", 0.002), repEmpty: g("rep", "emptyFlight", -0.003), gougeMult: g("rep", "priceGougeMult", 2.5),
    gouge: g("rep", "priceGouge", -0.01), pioneerRep: g("rep", "pioneer", 0.2), repRevert: g("rep", "dailyRevert", 0.01), repFrozen: g("rep", "frozenStrandedPerDay", -0.05),
    overheadDay: g("company", "overheadDay", 20000), overheadMinFrac: g("company", "overheadMinFrac", 1), overheadFullRoutes: g("company", "overheadFullRoutes", 1), overheadRoute: g("company", "overheadPerRoute", 3000), overheadPlane: g("company", "overheadPerPlane", 1000), taxFree: g("company", "profitTaxFree", 0), taxRate: g("company", "profitTaxRate", 0), taxRel: g("company", "profitTaxRelMult", 0),
    maxPermits: g("permits", "maxOpen", 3), discardPenalty: g("permits", "discardPenalty", 250000), classKm: g("permits", "classKm", [1500, 4000, 8000]),
    classNames: g("permits", "classNames", ["scurt", "mediu", "lung", "intercontinental"]), cardCost: g("permits", "cardCost", [[2, 3], [4, 5], [6, 7], [7, 8]]),
    permitBig: g("permits", "bigAirportAdd", 1), permitSmall: g("permits", "smallAirportSub", 1), maxSameType: g("permits", "maxSameType", 3), offerMix: g("permits", "offerMix", [0.4, 0.35, 0.18, 0.07]),
    maxDistKm: g("permits", "maxDistKm", 14500), distMinPermit: 200, permitRangeOn: g("permits", "byFleetRange", false), permitRangeMin: g("permits", "rangeMinKm", 3300), permitRangeMargin: g("permits", "rangeMargin", 0.1),
    thinBand: g("permits", "thinBandKm", [3000, 5000]), thinDem: g("permits", "thinDemand", 100), thinW: g("permits", "thinWeight", 1), maxRoutes: g("permits", "maxRoutes", 40),
    pioneerDemand: g("build", "pioneerDemand", 0.2), pioneerDays: g("build", "pioneerDays", 10), pioneerAttr: g("build", "pioneerAttr", 1.2), pioAttrTier: g("build", "pioneerAttrByTier", null),routeBuildFee: g("build", "routeBuildFee", 0),
    slotCap: g("slots", "capBySize", [0, 99, 3, 2]), slotPrice: g("slots", "priceBySize", [0, 400000, 1200000, 3000000]), baseIsFree: g("slots", "baseIsFree", true),
    expansionAdd: g("slots", "expansionEventAdd", 1), hubPrice: g("hub", "priceBySize", [0, 4000000, 8000000, 14000000]), maxHubs: g("hub", "maxHubs", 3),
    ghiseuN: g("cards", "ghiseuGive", 5), cardPrice: g("cards", "buyPrice", 350000), cardMult: g("cards", "buyMult", 1.6), cardHalfMin: g("cards", "heatHalfLifeMin", 720), buyMaxPerDay: g("cards", "buyMaxPerDay", 6),
    specialReturnDays: g("cards", "specialReturnDays", 10),
    freezeSec: g("specials", "freezeRealMs", 30000) / 1000, freezeCdDays: g("specials", "freezeCooldownDays", 2), breakerSec: g("specials", "breakerPromptMs", 5000) / 1000,
    rapidLess: g("specials", "rapidCardsLess", 1), boomMult: g("specials", "boomMult", 2), boomDays: g("specials", "boomDays", 3), fuelCardMult: g("specials", "fuelContractMult", 0.7),
    fuelDays: g("specials", "fuelContractDays", 5), spyDays: g("specials", "spyDays", 1), adStars: g("specials", "adStars", 1), adDays: g("specials", "adDays", 7), giftType: g("specials", "giftPlaneType", 0),
    draftPicks: g("draft", "picksEach", 3), draftExtra: g("draft", "extra", 4), draftPickSec: g("draft", "pickMs", 10000) / 1000, botPickSec: g("draft", "botPickMs", 1200) / 1000,
    draftRevealSec: g("draft", "revealMs", 5000) / 1000, draftIntroSec: g("draft", "introMs", 2000) / 1000, draftSettleSec: g("draft", "settleMs", 2500) / 1000,
    consFee: g("consultant", "feeDay", 25000), consHire: g("consultant", "hireFee", 0), consTipDays: g("consultant", "tipEveryDays", [1, 2]), consWhisper: g("consultant", "whisperChance", 0.35),
    bankFrac: g("bank", "limitFrac", 0.5), bankMinLimit: g("bank", "minLimit", 3000000), bankTerms: g("bank", "terms", [10, 20, 30]), bankRates: g("bank", "ratePerDay", { 10: 0.004, 20: 0.005, 30: 0.006 }),
    bankMin: g("bank", "minAmount", 500000), csStart: g("bank", "scoreStart", 100), csLate: g("bank", "scoreLateDay", -10), csNeg: g("bank", "scoreNegDay", -5), csRepaid: g("bank", "scoreRepaid", 5),
    csLimitK: g("bank", "scoreLimitK", 0.006), csRateK: g("bank", "scoreRateK", 0.00003), earlyRepayFee: g("bank", "earlyRepayFee", 0),
    negDays: g("bankrupt", "graceDays", 5), debtOverLimit: g("bankrupt", "debtOverLimitMult", 1.25),
    loanMinDays: g("loans", "minDays", 2), loanMaxDays: g("loans", "maxDays", 30),
    negoSec: g("nego", "maxRealMs", 120000) / 1000, negoPerDay: g("nego", "perPlayerPerDay", 1), pactMaxDays: g("nego", "pactMaxDays", 20), negoBotSec: 20, negoEndSec: 3,
    shareMax: g("shares", "maxOthers", 49), shareFee: g("shares", "fee", 0.02), shareMinValue: g("shares", "minValue", 1000000),
    evChance: g("events", "chancePerDay", 0.4), evMaxActive: g("events", "maxActive", 3), evFirstDay: g("events", "firstDay", 3),
    crisisDay: g("crisis", "startDay", 60), crisisFuel: g("crisis", "fuelPerDay", 0.015), crisisTax: g("crisis", "taxPerDay", 0.005), crisisTaxMax: g("crisis", "taxMax", 0.35),
    crisisOverhead: g("crisis", "overheadPerDay", 0.02), crisisEvAdd: g("crisis", "eventChanceAdd", 0.005),
    valRouteDays: g("value", "routeDays", 8), valRouteAvg: g("value", "routeAvgDays", 7), valRouteCard: g("value", "routeMinFromCards", 150000), valSlot: g("value", "slotMult", 0.8),
    valHub: g("value", "hubMult", 0.7), valCardDays: g("value", "cardDays", 1), valCardMin: g("value", "cardMin", 100000), valCardMax: g("value", "cardMax", 500000),
    valJoker: g("value", "jokerMult", 3), valSpecial: g("value", "specialMult", 5), valSet5: g("value", "setOf5Bonus", 1000000), valPermitPenalty: g("value", "openPermitPenalty", 300000),
    valLeased: g("value", "leasedValue", 0),
    pauseMaxSec: 180,
    bonusDays: g("start", "bonusDays", 10), bonusFee: g("start", "bonusFeeMult", 0.5), bonusLease: g("start", "bonusLeaseMult", 0.5), leaseRampFrom: g("lease", "rampFromDay", 0), leaseRampTo: g("lease", "rampToDay", 0),
    recMinLoad: g("price", "recMinLoad", 0.55), estFill: g("price", "estFillLoad", 0.62), recWeakLoad: g("price", "recWeakLoad", 0.4), estLoadCap: g("price", "estLoadCap", 0.92),
    INV: (() => { const iv = T.invest || {}, o = (k, d) => Object.assign({}, d, iv[k] || {});
      return { valueMult: iv.valueMult !== undefined ? iv.valueMult : 0.5, decay: iv.decay !== undefined ? iv.decay : 0.02,
        base: o("base", { price: [8000000, 16000000, 30000000], demand: 0.1, slots: 1, fee: 0.15 }),
        term: o("term", { price: 15000000, max: 3, minSize: 3, share: 0.2, stars: 0.15 }),
        eco: o("eco", { price: [3000000, 8000000, 16000000, 1500000, 5000000, 11000000], fuel: 0.2 }),
        mnt: o("mnt", { price: 8000000, maint: 0.25, breakdown: 0.6, dep: 0.4 }) }; })(),
  };
  K.normalPriceFn = typeof T.normalPrice === "function" ? T.normalPrice : null;
  TUc = K; TUsrc = src; return K;
}

/* ======================= DATE: CerulData (leneș) + rezervă ======================= */
const FB_AP = [
  ["LHR", "Londra", 51.47, -0.45, "EU", "eu-w", 3, 14, 0, ["afaceri", "capitală"]], ["CDG", "Paris", 49.01, 2.55, "EU", "eu-w", 3, 12, 1, ["afaceri", "cultură"]],
  ["FRA", "Frankfurt", 50.03, 8.57, "EU", "eu-w", 3, 5.6, 1, ["afaceri"]], ["MAD", "Madrid", 40.47, -3.56, "EU", "eu-s", 3, 6.7, 1, ["cultură"]],
  ["FCO", "Roma", 41.80, 12.25, "EU", "eu-s", 2, 4.3, 1, ["cultură"]], ["OTP", "București", 44.57, 26.08, "EU", "eu-e", 2, 2.3, 2, ["afaceri"]],
  ["CLJ", "Cluj-Napoca", 46.78, 23.69, "EU", "eu-e", 1, 0.42, 2, []], ["AMS", "Amsterdam", 52.31, 4.76, "EU", "eu-w", 2, 2.5, 1, ["afaceri"]],
  ["IST", "Istanbul", 41.26, 28.74, "EU", "eu-e", 3, 15, 3, ["cultură"]], ["ATH", "Atena", 37.94, 23.94, "EU", "eu-s", 2, 3.6, 2, ["plajă"]],
  ["ZRH", "Zürich", 47.46, 8.55, "EU", "eu-w", 2, 1.4, 1, ["schi", "afaceri"]],
  ["DXB", "Dubai", 25.25, 55.36, "AS", "me", 3, 3.5, 4, ["afaceri", "plajă"]], ["DEL", "Delhi", 28.56, 77.10, "AS", "as-s", 3, 30, 5, []],
  ["BKK", "Bangkok", 13.69, 100.75, "AS", "as-se", 2, 10, 7, ["plajă"]], ["PEK", "Beijing", 40.08, 116.58, "AS", "as-e", 3, 21, 8, ["afaceri"]],
  ["NRT", "Tokyo", 35.77, 140.39, "AS", "as-e", 3, 37, 9, ["afaceri"]], ["SIN", "Singapore", 1.36, 103.99, "AS", "as-se", 2, 5.7, 8, ["afaceri"]],
  ["ICN", "Seul", 37.46, 126.44, "AS", "as-e", 2, 25, 9, []], ["HKG", "Hong Kong", 22.31, 113.91, "AS", "as-e", 2, 7.4, 8, ["afaceri"]],
  ["CAI", "Cairo", 30.12, 31.41, "AF", "af-n", 2, 20, 2, ["cultură"]], ["JNB", "Johannesburg", -26.14, 28.24, "AF", "af-s", 2, 5.6, 2, []],
  ["NBO", "Nairobi", -1.32, 36.93, "AF", "af-e", 2, 4.4, 3, []], ["LOS", "Lagos", 6.58, 3.32, "AF", "af-w", 2, 15, 1, []],
  ["CMN", "Casablanca", 33.37, -7.59, "AF", "af-n", 2, 3.7, 0, ["plajă"]], ["CPT", "Cape Town", -33.96, 18.60, "AF", "af-s", 1, 4.6, 2, ["plajă"]],
  ["JFK", "New York", 40.64, -73.78, "NA", "na-e", 3, 19, -5, ["afaceri"]], ["LAX", "Los Angeles", 33.94, -118.41, "NA", "na-w", 3, 13, -8, ["plajă"]],
  ["ORD", "Chicago", 41.98, -87.90, "NA", "na-c", 2, 9.5, -6, ["afaceri"]], ["MEX", "Ciudad de México", 19.44, -99.07, "NA", "na-c", 2, 21, -6, []],
  ["YYZ", "Toronto", 43.68, -79.63, "NA", "na-e", 2, 6.2, -5, []], ["MIA", "Miami", 25.79, -80.29, "NA", "na-e", 2, 6.1, -5, ["plajă"]],
  ["DEN", "Denver", 39.86, -104.67, "NA", "na-w", 1, 2.9, -7, ["schi"]],
  ["GRU", "São Paulo", -23.43, -46.47, "SA", "sa-s", 3, 22, -3, ["afaceri"]], ["EZE", "Buenos Aires", -34.82, -58.54, "SA", "sa-s", 2, 15, -3, []],
  ["BOG", "Bogotá", 4.70, -74.15, "SA", "sa-n", 2, 11, -5, []], ["LIM", "Lima", -12.02, -77.11, "SA", "sa-n", 2, 10, -5, []],
  ["SCL", "Santiago", -33.39, -70.79, "SA", "sa-s", 1, 6.8, -4, ["schi"]],
  ["SYD", "Sydney", -33.94, 151.18, "OC", "oc", 3, 5.3, 10, ["plajă"]], ["MEL", "Melbourne", -37.67, 144.84, "OC", "oc", 2, 5.1, 10, []],
  ["AKL", "Auckland", -37.01, 174.79, "OC", "oc", 2, 1.7, 12, []], ["BNE", "Brisbane", -27.38, 153.12, "OC", "oc", 1, 2.5, 10, ["plajă"]],
].map(a => ({ id: a[0], n: a[1], lat: a[2], lon: a[3], cont: a[4], reg: a[5], size: a[6], pop: a[7], tz: a[8], tags: a[9] }));
const FB_EVENTS = [
  { id: "cenusa", n: "Nor de cenușă vulcanică", neg: true, w: 4, days: 1, scope: { type: "cont" }, fx: { closed: true }, d: "Spațiul aerian din {loc} e închis o zi." },
  { id: "greva", n: "Grevă la aeroport", neg: true, w: 6, days: 1, mins: [360, 720], scope: { type: "airport", minSize: 2 }, fx: { hold: true }, chip: "Grevă la {loc}", ef: "avioanele de acolo nu pot decola", d: "Grevă la {loc}: 1–2 ore nu decolează nimic de acolo." },
  { id: "vacanta", n: "Sezonul vacanțelor", neg: false, w: 6, days: 7, scope: { type: "tag", tag: "plajă" }, fx: { demand: 1.5 }, d: "Toată lumea vrea la plajă!" },
  { id: "cupa", n: "Campionatul Mondial", neg: false, w: 3, days: 5, scope: { type: "airport", minSize: 3 }, fx: { demand: 2 }, d: "{loc} găzduiește Campionatul Mondial!" },
  { id: "petrol", n: "Criză a petrolului", neg: true, w: 4, days: 7, crisis: true, scope: { type: "global" }, fx: { fuel: 1.4 }, d: "Combustibilul e cu 40% mai scump." },
  { id: "petrolIeftin", n: "Petrol ieftin", neg: false, w: 4, days: 5, scope: { type: "global" }, fx: { fuel: 0.75 }, d: "Combustibil mai ieftin." },
  { id: "recenzie", n: "Recenzie dezastruoasă", neg: true, w: 5, days: 5, scope: { type: "company", pick: "random" }, fx: { stars: -1 }, d: "{p} a primit o recenzie proastă." },
  { id: "boomTurism", n: "Boom turistic", neg: false, w: 4, days: 7, scope: { type: "cont" }, fx: { demand: 1.3 }, d: "Boom turistic în {loc}." },
  { id: "extindere", n: "Extinderea aeroportului", neg: false, w: 3, days: 0, scope: { type: "airport", minSize: 2 }, fx: { slots: 1 }, d: "{loc} are un slot în plus." },
  { id: "subventie", n: "Subvenție", neg: false, w: 3, days: 0, scope: { type: "company", pick: "last" }, fx: { cash: 1500000 }, d: "{p} primește o subvenție." },
  { id: "taxaVerde", n: "Taxa verde", neg: true, w: 3, days: 5, scope: { type: "global" }, fx: { tax: 0.1 }, d: "Taxă pe profit 10%." },
  { id: "ziuaAviatiei", n: "Ziua Aviației", neg: false, w: 3, days: 0, scope: { type: "global" }, fx: { cards: 2 }, d: "Fiecare companie primește 2 cărți." },
];
const FB_TIPS = {
  idlePlane: "Avionul {t} de la {x} stă degeaba. Pune-l pe o rută!", emptySeats: "Pe {r} zbori cu locuri goale ({pct}).",
  smallPlane: "Pe {r} rămân pasageri la poartă: pune un avion mai mare.", priceHigh: "Prețul pe {r} e prea mare: recomand {a}.",
  priceLow: "Pe {r} poți cere mai mult: {a}.", unprofitable: "Ruta {r} pierde bani.", fuelUp: "Combustibilul s-a scumpit ({pct}).", fuelDown: "Combustibilul s-a ieftinit ({pct}).",
  cashLow: "Ai bani pe minus! Ai {n} zile să revii.", loanRisk: "Datoriile cresc: {a}.", buildReady: "Poți construi acum ruta {r}.",
  permitNext: "Strânge cărțile pentru {r} (îți lipsesc {n}).", noPilot: "Ai {n} avioane care așteaptă la {x}.", ghiseu: "Ai multe cărți de același fel: mergi la Ghișeu.",
  hubSuggest: "Ai {n} rute prin {x}: un hub ar ajuta.", newRoute: "Ai bani: o rută nouă ar aduce profit.", generic: "Totul merge bine. Continuă așa!",
  tooManyPlanes: "Prea multe avioane pe {r}: doar {pct} plin. Mută {n} pe altă rută.",
  priceAway: "Prețul de pe {r} ({a}) alungă pasagerii: peste Premium cererea scade brusc. Încearcă {b}.",
};
const FB_COMPANIES = ["Aripi Carpatine", "Zbor Albastru", "Vultur Air", "Orizont Express", "Nor Alb", "Cocor Airlines", "Stea Polară", "Briza Air", "Șoim Jet", "Lebăda Airways"];
let Dc = null, Dsrc, Dreq = null;
function D() {
  let src = G.CerulData && Array.isArray(G.CerulData.AIRPORTS) && G.CerulData.AIRPORTS.length ? G.CerulData : null;
  if (!src && ISNODE) {
    if (Dreq === null) { try { const m = require("./cerul-data.js"); Dreq = m && Array.isArray(m.AIRPORTS) && m.AIRPORTS.length ? m : false; } catch (e) { Dreq = false; } }
    src = Dreq || null;
  }
  if (Dc && Dsrc === src) return Dc;
  const s = src || {}, d = { src };
  d.AIRPORTS = (src ? s.AIRPORTS : FB_AP).map(a => ({ id: a.id, n: a.n || a.id, lat: +a.lat, lon: +a.lon, cont: a.cont || "EU", reg: a.reg || null,
    size: Math.max(1, Math.min(3, (a.size | 0) || 1)), pop: +a.pop || 0.5, tz: +a.tz || 0, tags: Array.isArray(a.tags) ? a.tags : [] }));
  d.AP = {}; d.AIRPORTS.forEach(a => { d.AP[a.id] = a; });
  d.EVENTS = Array.isArray(s.EVENTS) && s.EVENTS.length ? s.EVENTS : FB_EVENTS;
  d.EV = {}; d.EVENTS.forEach(e => { d.EV[e.id] = e; });
  d.tip = typeof s.tip === "function" ? s.tip : null;
  d.checkAch = typeof s.checkAch === "function" ? s.checkAch : null;
  d.newStats = typeof s.newStats === "function" ? s.newStats : null;
  d.seasonMult = typeof s.seasonMult === "function" ? s.seasonMult : null;
  d.AVATARS = Array.isArray(s.AVATARS) && s.AVATARS.length ? s.AVATARS : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ id: i, g: i < 5 ? "m" : "f" }));
  d.COMPANIES = Array.isArray(s.COMPANY_NAMES) && s.COMPANY_NAMES.length ? s.COMPANY_NAMES : FB_COMPANIES;
  d.REGIONS = s.REGIONS || {}; d.CONTINENTS = s.CONTINENTS || {}; d.TAGS = s.TAGS || {};
  d.DK = {};
  Dc = d; Dsrc = src; return d;
}
const AP = id => D().AP[id];

/* ======================= utilitare ======================= */
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const r2 = x => Math.round(x * 100) / 100;
const r3 = x => Math.round(x * 1000) / 1000;
const CARD_NAMES = { 0: "Aprobare", 1: "Infrastructură", 2: "Echipaj", 3: "Combustibil", 4: "Joker",
  frz: "Îngheață timpul", brk: "Spărgător de gheață", fast: "Construcție rapidă", vip: "Permis VIP", boom: "Boom de pasageri",
  fuel: "Contract de combustibil", spy: "Spion", ad: "Campanie de reclamă", ins: "Asigurare", slot: "Slot suplimentar", gift: "Avion cadou" };
const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const isSpecial = c => typeof c === "string" && SPECIALS.indexOf(c) >= 0;
const E = err => ({ ok: false, err });
const OK = { ok: true };
function mulberry(seed) {
  let a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rngFrom(st) {
  return function () { st.seed = (st.seed + 0x6D2B79F5) >>> 0; let t = st.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rint = (R, a, b) => a + Math.floor(R() * (b - a + 1));
const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
function shuffle(R, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function dist(a, b) {
  const d = D(); if (a === b) return 0; const k = a < b ? a + b : b + a; const c = d.DK[k]; if (c !== undefined) return c;
  const A = d.AP[a], B = d.AP[b]; if (!A || !B) return 0;
  const rad = Math.PI / 180, dLat = (B.lat - A.lat) * rad, dLon = (B.lon - A.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * rad) * Math.cos(B.lat * rad) * Math.sin(dLon / 2) ** 2;
  const v = Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))));
  d.DK[k] = v; return v;
}
const ridOf = (a, b) => a < b ? a + "-" + b : b + "-" + a;
const ridEnds = rid => String(rid).split("-");
const otherEnd = (rid, ap) => { const e = ridEnds(rid); return ap === e[0] ? e[1] : e[0]; };
/* prețul normal: distanța × randamentul pieței (a, b opționale). Fără capete → doar distanța (compatibil cu apelurile vechi). */
function normalPrice(d, a, b) {
  const K = TU(); let v = 0;
  if (K.normalPriceFn) { try { v = K.normalPriceFn(d); } catch (e) { v = 0; } }
  if (!(v > 0)) v = K.pBase + K.pKm * Math.min(d, K.pLongKm) + K.pKmLong * Math.max(0, d - K.pLongKm);
  if (a && b) v *= yieldMult(a, b);
  return Math.max(K.priceMinAbs, Math.round(v / K.pRound) * K.pRound);
}
/* randamentul pieței: per regiune (piețe sărace ~0,7 … bogate ~1,45); ruta = media geometrică a capetelor
   × prima intercontinentală (× în plus dacă un capăt e „afaceri”) */
function apYield(ap) { const a = AP(ap), t = TU().yieldReg; return (a && t && t[a.reg]) || 1; }
function yieldMult(a, b) {
  const K = TU(), A = AP(a), B = AP(b); if (!A || !B) return 1;
  let y = Math.sqrt(apYield(a) * apYield(b));
  if (A.cont !== B.cont) { y *= K.interPrem; if ((A.tags || []).indexOf("afaceri") >= 0 || (B.tags || []).indexOf("afaceri") >= 0) y *= K.interBizPrem; }
  return Math.round(y * 100) / 100;
}
const routeNormal = rid => { const [a, b] = ridEnds(rid); return normalPrice(dist(a, b), a, b); };
let YT = null, YTsrc = null;
function yieldTable() { const K = TU(); if (YT && YTsrc === K) return YT; YT = {}; for (const a of D().AIRPORTS) { const y = apYield(a.id); YT[a.id] = { y, tier: tierOf(y).k, n: tierOf(y).n }; } YTsrc = K; return YT; }
function regionView(st) {
  const d = D(), bases = st.ps.map(x => st.c[x].base).filter(Boolean), ys = bases.map(apYield), y = ys.length ? Math.round(ys.reduce((u, v) => u + v, 0) / ys.length * 100) / 100 : 1;
  return { cont: st.reg, n: (d.CONTINENTS && d.CONTINENTS[st.reg] && d.CONTINENTS[st.reg].n) || st.reg, yieldMult: y, tier: tierOf(y).k, tierN: tierOf(y).n };
}
function tierOf(y) { return y >= 1.35 ? { k: 3, n: "Piață foarte bogată" } : y >= 1.15 ? { k: 2, n: "Piață bogată" } : y >= 0.92 ? { k: 1, n: "Piață medie" } : { k: 0, n: "Piață modestă" }; }
const planeT = ty => TU().PLANES[ty] || TU().PLANES[0];
const flightMin = (ty, d) => Math.round(d / planeT(ty).speed * 60 + TU().flightExtra);
const rate = st => MIN_DAY / (st.dl * 60000) * (st.sp || 1);               // minute de joc / ms real
const gmFromSec = (st, sec) => sec * 1000 * MIN_DAY / (st.dl * 60000);       // secunde reale de RULARE → minute de joc
const wallMs = (st, sec) => sec * 1000 / (st.sp || 1);                      // secunde reale → ms (accelerat în teste)
const active = st => st.ps.filter(s => !st.c[s].out);
const humans = st => st.ps.filter(s => !st.c[s].bot);
const dayEnd = st => st.day * MIN_DAY;
const dayOf = (st, gt) => Math.floor((gt === undefined ? st.gt : gt) / MIN_DAY) + 1;
function logp(st, k, o) { st.lid = (st.lid || 0) + 1; const e = { id: st.lid, k, day: st.day }; if (o) for (const x in o) if (o[x] !== undefined) e[x] = o[x]; st.log.push(e); if (st.log.length > 14) st.log.splice(0, st.log.length - 14); }
function newId(st) { st.nid = (st.nid || 0) + 1; return st.nid; }
const handTotal = h => h.reduce((a, b) => a + b, 0);
function addUniq(arr, v) { if (arr.indexOf(v) < 0) arr.push(v); }

/* ======================= timp ======================= */
/* zile de joc pentru o durată reală: fiecare zi = dl minute de rulare + un draft estimat (intro + 3·N alegeri + dezvăluire + decontare) */
function draftEstSec(n) { const K = TU(); return K.draftIntroSec + K.draftPicks * n * K.draftEstPick + K.draftRevealSec + K.draftSettleSec; }
function maxDays(dur, dl, n) { if (!dur) return 0; return Math.max(1, Math.round(dur * 60 / (dl * 60 + draftEstSec(n || 2)))); }
function gameTimeAt(st, now) {
  if (!st || !st.run) return st ? st.gt : 0;
  return Math.min(st.gt + Math.max(0, now - st.at) * rate(st), dayEnd(st));
}
function monthOf(st, day) { return ((st.m0 || 0) + Math.floor(((day || st.day) - 1) / TU().daysPerMonth)) % 12; }
function hourOf(gt) { return ((TU().startHour * 60 + (gt % MIN_DAY)) / 60) % 24; }   // ora „UTC” a jocului
function clockInfo(st, now) {
  const gt = gameTimeAt(st, now), tod = gt - (st.day - 1) * MIN_DAY;
  const m = Math.floor(TU().startHour * 60 + clamp(tod, 0, MIN_DAY - 1e-6)) % MIN_DAY;
  const why = st.phase === "setup" ? "setup" : st.phase === "end" ? "end" : st.phase === "draft" ? "draft" : st.phase === "nego" ? "nego" : st.pz ? "pause" : null;
  let left = null, daysLeft = null;
  if (st.maxDay) { left = Math.round(Math.max(0, st.maxDay * MIN_DAY - gt) / rate(st) + Math.max(0, st.maxDay - st.day) * wallMs(st, draftEstSec(active(st).length))); daysLeft = Math.max(0, st.maxDay - st.day + 1); }
  const mo = monthOf(st), hh = Math.floor(m / 60), mm = m % 60;
  return { day: st.day, hh, mm, dayFrac: clamp(tod / MIN_DAY, 0, 1), paused: !st.run, why, left, daysLeft, maxDay: st.maxDay, month: mo, monthName: MONTHS[mo],
    night: hh < 6 || hh >= 21, gt, dayLenMs: Math.round(MIN_DAY / rate(st)), dayLeftMs: Math.round(Math.max(0, dayEnd(st) - gt) / rate(st)) };
}
function syncTime(st, now, R) { if (st.run) { const tg = gameTimeAt(st, now); if (tg > st.gt) advance(st, tg, R); st.at = now; } }
function stopClock(st, now, R) { syncTime(st, now, R); st.run = 0; st.at = now; }
function startClock(st, now) { if (st.phase === "play" && !st.pz) { st.run = 1; st.at = now; } }

/* ======================= cărți ======================= */
function drawCard(st, R, normalOnly) {
  const o = TU().cardOdds, x = R(); let acc = 0;
  for (let i = 0; i < 5; i++) { acc += o[i]; if (x < acc) return i; }
  if (normalOnly) return Math.floor(R() * 4);
  const tot = SPECIALS.reduce((s, id) => s + (st.pool[id] || 0), 0);
  if (tot <= 0) return Math.floor(R() * 4);
  let y = R() * tot;
  for (const id of SPECIALS) { y -= st.pool[id] || 0; if (y < 0) { st.pool[id]--; return id; } }
  for (const id of SPECIALS) if (st.pool[id] > 0) { st.pool[id]--; return id; }
  return Math.floor(R() * 4);
}
function giveCard(st, seat, card) { // peste limită → Joker, iar speciala revine în pachet
  const c = st.c[seat];
  if (isSpecial(card)) {
    const lim = TU().LIMITS[card];
    if (lim !== undefined && lim !== null && (c.sx[card] || 0) >= lim) { st.pool[card] = (st.pool[card] || 0) + 1; c.h[4]++; return 4; }
    c.sx[card] = (c.sx[card] || 0) + 1; return card;
  }
  c.h[card]++; return card;
}
function spendSpecial(st, seat, id) { const c = st.c[seat]; c.sx[id]--; if (!c.sx[id]) delete c.sx[id]; st.ret.push([id, st.day + TU().specialReturnDays]); c.st.specials++; }

/* ======================= investiții / start de companie ======================= */
const IV0 = { b: 0, t: [], e: [], m: 0, sp: 0 };
const NT = () => TU().PLANES.length;
const allTypes = () => TU().PLANES.map((p, i) => i);
const validTy = ty => ty >= 0 && ty < NT() && (ty | 0) === ty;
const ivOf = c => (c && c.iv) || IV0;
// valoarea investițiilor: 100% la cumpărare, scade treptat (−decay/zi) până la valueMult
function invValue(st, c) {
  const I = TU().INV, iv = ivOf(c), l = iv.l || [], dec = I.decay !== undefined ? I.decay : 0.02;
  let v = 0, tracked = 0;
  for (const x of l) { tracked += x[0]; v += x[0] * Math.max(I.valueMult, 1 - Math.max(0, (st.day || 1) - x[1]) * dec); }
  v += Math.max(0, (iv.sp || 0) - tracked) * I.valueMult;
  return Math.round(v);
}
const bonusOn = st => st.phase !== "setup" && st.day <= TU().bonusDays;
function baseSlotAdd(st, ap) { let n = 0; for (const s of st.ps) { const c = st.c[s]; if (c.base === ap && !c.out && c.iv && c.iv.b) n += c.iv.b * (TU().INV.base.slots || 0); } return n; }
function invDemMult(st, s, o, x) { const c = st.c[s], L = ivOf(c).b; return L && (o === c.base || x === c.base) ? 1 + TU().INV.base.demand * L : 1; }
function invAttrMult(st, s, rid) { const t = ivOf(st.c[s]).t; if (!t.length) return 1; let m = 1; for (const ap of ridEnds(rid)) if (t.indexOf(ap) >= 0) m *= 1 + TU().INV.term.share; return m; }

/* ======================= aeroporturi / sloturi / rețea ======================= */
function evSlotAdd(st, ap) { let n = 0; for (const ev of st.ev) { const def = evDef(ev.id); if (def && def.fx && def.fx.slots && evHitsAp(ev, ap)) n += def.fx.slots; } return n; }
function slotCap(st, ap) { const a = AP(ap), K = TU(); const base = K.slotCap[a.size]; return (base === undefined ? 99 : base) + (a.size >= 2 && st.ps.length >= 4 ? K.capAdd4p || 0 : 0) + (st.cap[ap] || 0) + evSlotAdd(st, ap) + baseSlotAdd(st, ap); }
function slotUsed(st, ap) { const l = st.sl[ap] || [], x = st.sx[ap] || []; return l.filter(s => x.indexOf(s) < 0 && st.c[s] && !st.c[s].out).length; }
const hasSlot = (st, s, ap) => (st.sl[ap] || []).indexOf(s) >= 0;
function addSlot(st, s, ap, extra) {
  st.sl[ap] = st.sl[ap] || []; if (st.sl[ap].indexOf(s) < 0) st.sl[ap].push(s);
  if (extra) { st.sx[ap] = st.sx[ap] || []; addUniq(st.sx[ap], s); }
  const c = st.c[s]; if (c && c.st.airports && c.st.airports.length < 200) addUniq(c.st.airports, ap);
}
function remSlot(st, s, ap) {
  if (st.sl[ap]) { st.sl[ap] = st.sl[ap].filter(x => x !== s); if (!st.sl[ap].length) delete st.sl[ap]; }
  if (st.sx[ap]) { st.sx[ap] = st.sx[ap].filter(x => x !== s); if (!st.sx[ap].length) delete st.sx[ap]; }
}
const slotFree = (st, ap) => slotUsed(st, ap) < slotCap(st, ap);
const slotPrice = ap => Math.round((TU().slotPrice[AP(ap).size] || 0) * (TU().yieldCostExp ? Math.pow(apYield(ap), TU().yieldCostExp) : 1) / 10000) * 10000; // piețele bogate: sloturi mai scumpe
function network(st, s) {
  const c = st.c[s], set = new Set(); if (c.base) set.add(c.base);
  c.hubs.forEach(h => set.add(h));
  for (const rid in c.r) ridEnds(rid).forEach(x => set.add(x));
  for (const ap in st.sl) if (st.sl[ap].indexOf(s) >= 0) set.add(ap);
  return set;
}
function slotNeeded(st, s, ap, exceptRid) {
  const c = st.c[s]; if (c.base === ap || c.hubs.indexOf(ap) >= 0) return true;
  for (const rid in c.r) if (rid !== exceptRid && ridEnds(rid).indexOf(ap) >= 0) return true;
  return false;
}

/* ======================= evenimente: lovituri ======================= */
function evDef(id) { return D().EV[id] || FB_EVENTS.find(e => e.id === id) || null; }
function evHitsAp(ev, ap) {
  const a = AP(ap); if (!a) return false;
  switch (ev.tt) {
    case "global": return true;
    case "airport": return Array.isArray(ev.tg) && ev.tg.indexOf(ap) >= 0;
    case "region": return a.reg === ev.tg;
    case "cont": return a.cont === ev.tg;
    case "tag": return (a.tags || []).indexOf(ev.tg) >= 0;
    default: return false;
  }
}
const exempt = (ev, s) => !!s && (ev.ex || []).indexOf(s) >= 0;
function evCompanyHit(ev, s) { return ev.tt === "global" || (ev.tt === "company" && ev.tg === s); }
function evMult(st, key, s, worseIfAbove) { // multiplicator fx[key] pentru o companie (scope global/companie)
  let m = 1;
  for (const ev of st.ev) { const def = evDef(ev.id); const v = def && def.fx && def.fx[key]; if (typeof v !== "number") continue;
    if (!evCompanyHit(ev, s)) continue; const bad = worseIfAbove ? v > 1 : v < 1; if (bad && exempt(ev, s)) continue; m *= v; }
  return m;
}
function evApMult(st, key, ap, s, worseIfAbove) { // multiplicator pe aeroport (scope aeroport/regiune/continent/etichetă)
  let m = 1;
  for (const ev of st.ev) { const def = evDef(ev.id); const v = def && def.fx && def.fx[key]; if (typeof v !== "number") continue;
    if (ev.tt === "company") continue; if (!evHitsAp(ev, ap)) continue;
    const bad = worseIfAbove ? v > 1 : v < 1; if (bad && exempt(ev, s)) continue; m *= v; }
  return m;
}
function isClosed(st, ap, s) {
  for (const ev of st.ev) { const def = evDef(ev.id); if (def && def.fx && def.fx.closed && evHitsAp(ev, ap) && !exempt(ev, s)) return true; }
  return false;
}
function apHold(st, ap, s) { // evenimente pe ore cu fx.hold (grevă, ceață): nimic nu decolează de acolo până la ev.ue
  let t = 0; for (const ev of st.ev) { const def = evDef(ev.id); if (def && def.fx && def.fx.hold && ev.ue && evHitsAp(ev, ap) && !exempt(ev, s)) t = Math.max(t, ev.ue); } return t;
}
function apDelay(st, ap, s) {
  let n = 0; for (const ev of st.ev) { const def = evDef(ev.id); if (def && def.fx && def.fx.delay && evHitsAp(ev, ap) && !exempt(ev, s)) n += def.fx.delay; } return n;
}
function evStars(st, s) { let n = 0; for (const ev of st.ev) { const def = evDef(ev.id); const v = def && def.fx && def.fx.stars; if (!v || !evCompanyHit(ev, s)) continue; if (v < 0 && exempt(ev, s)) continue; n += v; } return n; }
function evTax(st, s) { let n = 0; for (const ev of st.ev) { const def = evDef(ev.id); const v = def && def.fx && def.fx.tax; if (!v || !evCompanyHit(ev, s) || exempt(ev, s)) continue; n += v; } return n; }

/* ======================= cerere / cote ======================= */
function seasonOf(st, ap) {
  const K = TU(), d = D(), a = AP(ap), mo = monthOf(st);
  let m = 1;
  if (d.seasonMult) { try { const v = d.seasonMult(a.id, mo); if (typeof v === "number" && v > 0) m = v; } catch (e) { m = 1; } }
  else if (K.seasonTbl) { const mm = a.lat < -15 ? (mo + 6) % 12 : mo; for (const t of a.tags || []) { const arr = K.seasonTbl[t]; if (arr && arr[mm]) m *= arr[mm]; } }
  return 1 + K.seasonDamp * (m - 1);
}
function rawDemand(st, o, x) { // pasageri/zi pe direcția o→x, înainte de preț, rampă și evenimente
  const K = TU(), A = AP(o), B = AP(x); if (!A || !B) return 0;
  const d = Math.max(K.minDistKm, dist(o, x));
  let v = K.demK * Math.pow(A.pop * B.pop, K.popExp) / Math.pow(d, K.demExp);
  v = clamp(v, K.demMin, K.demCap);
  v *= Math.sqrt((K.sizeMult[A.size] || 1) * (K.sizeMult[B.size] || 1));
  if (A.cont !== B.cont) v *= K.intercontMult;
  if (st) v *= seasonOf(st, o) * seasonOf(st, x);
  return v;
}
function routeRamp(st, rid) { const K = TU(), r = st.rt[rid]; if (!r) return K.ramp0; return K.ramp0 + (1 - K.ramp0) * clamp((st.gt - r.t0) / MIN_DAY / K.rampDays, 0, 1); }
function dayCurveAt(st, ap, gt) { const K = TU(); if (!Array.isArray(K.dayCurve) || K.dayCurve.length !== 24) return 1; const a = AP(ap); const h = Math.floor(((hourOf(gt) + (a ? a.tz : 0)) % 24 + 24) % 24); return K.dayCurve[h] || 1; }
function demEvMult(st, o, x, s) { // multiplicatorii de eveniment ai cererii pe (o,x) pentru compania s
  let m = 1;
  for (const ev of st.ev) { const def = evDef(ev.id); const v = def && def.fx && def.fx.demand; if (typeof v !== "number") continue;
    let hit = false;
    if (ev.tt === "global") hit = true; else if (ev.tt === "company") hit = ev.tg === s; else hit = evHitsAp(ev, o) || evHitsAp(ev, x);
    if (!hit || (v < 1 && exempt(ev, s))) continue; m *= v; }
  return m;
}
function stars(st, s) { const c = st.c[s], K = TU(); let v = c.rep + evStars(st, s); if (c.fx.some(f => f.k === "ad" && f.u > st.gt)) v += K.adStars; v += ivOf(c).t.length * K.INV.term.stars; return clamp(v, K.repMin, K.repMax); }
function planesOn(st, s, rid) { return st.pl.filter(p => p.s === s && (p.rid === rid || (p.ch && p.ch.indexOf(rid) >= 0))); }
/* ---- rută cu escală: p.ch = [rid1, rid2], cu aeroport comun B (mijlocul) ---- */
function chainMid(r1, r2) { const e1 = ridEnds(r1), e2 = ridEnds(r2); const com = e1.filter(x => e2.indexOf(x) >= 0); return com.length === 1 && r1 !== r2 ? com[0] : null; }
function chainPts(r1, r2) { const B = chainMid(r1, r2); if (!B) return null; return { a: otherEnd(r1, B), b: B, c: otherEnd(r2, B) }; }
/* pasageri A–C în plus (pe zi, [A→C, C→A]) pentru n avioane cu escală ale companiei s pe (r1, r2) */
function chainExtra(st, s, r1, r2, n, prices) {
  const K = TU(), c = st.c[s], P = chainPts(r1, r2); if (!P || !c || !n) return [0, 0];
  const { a: A, b: B, c: C } = P, dAC = Math.max(1, dist(A, C)), det = (dist(A, B) + dist(B, C)) / dAC;
  if (det >= K.chDetour) return [0, 0];
  const tf = Math.sqrt(clamp((K.chDetour - det) / Math.max(0.05, K.chDetour - 1), 0, 1));
  const ridAC = ridOf(A, C); let comp = 1;
  if (st.ps.some(x => x !== s && !st.c[x].out && st.c[x].r[ridAC])) comp *= K.chVsDirect;
  if (c.r[ridAC]) comp *= K.chVsOwn;
  const hm = c.hubs.indexOf(B) >= 0 ? K.hubTransit : 1, nf = Math.min(K.chFreqMax, Math.pow(n, K.chFreqExp));
  const ramp = Math.min(st.rt[r1] ? routeRamp(st, r1) : K.ramp0, st.rt[r2] ? routeRamp(st, r2) : K.ramp0);
  const cr1 = c.r[r1], cr2 = c.r[r2], nrm = normalPrice(dAC, A, C), out = [0, 0];
  for (let di = 0; di < 2; di++) {
    const o = di ? C : A, x = di ? A : C;
    // prețul plătit = suma prețurilor celor două etape în direcția respectivă
    const legP = (rid, from) => { const cr = c.r[rid]; if (prices && prices[rid]) return prices[rid][ridEnds(rid)[0] === from ? 0 : 1]; return cr ? (ridEnds(rid)[0] === from ? cr.pa : cr.pb) : routeNormal(rid); };
    const pSum = di ? legP(r2, C) + legP(r1, B) : legP(r1, A) + legP(r2, B);
    if (!cr1 || !cr2) { if (!prices) continue; }
    out[di] = K.chShare * rawDemand(st, o, x) * priceResp(st, o, x, pSum, nrm) * tf * comp * hm * nf * ramp * demEvMult(st, o, x, s);
  }
  return out;
}
function chainCycleMin(ty, r1, r2) { const K = TU(), d1 = dist.apply(null, ridEnds(r1)), d2 = dist.apply(null, ridEnds(r2)); return 2 * (flightMin(ty, d1) + flightMin(ty, d2)) + 4 * K.turnMin + 2 * K.chStop; }
function chainCheck(ty, r1, r2) {
  const P = chainPts(r1, r2); if (!P) return "Rutele trebuie să aibă un singur aeroport comun.";
  const pt = planeT(ty);
  for (const rid of [r1, r2]) { const [x, y] = ridEnds(rid), d = dist(x, y);
    if (pt.range < d) return "Autonomia avionului (" + fmtKm(pt.range) + ") e prea mică pentru etapa " + AP(x).n + "–" + AP(y).n + " (" + fmtKm(d) + ").";
    if ((pt.minSize || 1) > Math.min(AP(x).size, AP(y).size)) return pt.n + " nu poate ateriza pe aeroporturi mici."; }
  return "";
}
const fmtKm = n => Math.round(n).toLocaleString("ro-RO") + " km";
// frecvența: avioanele de pe rută, ponderate cu mărimea (un Colibri contează 0,63, de la 100 de locuri în sus 1) — ca să nu câștigi cota
// doar cu roiuri de avioane mici; o rută FĂRĂ avion are atractivitate mică (nu „fură” pasagerii pe care nu-i poate duce)
const freqW = ty => clamp(Math.sqrt(planeT(ty).seats / 100), TU().freqWMin, 1);
function freqF(st, s, rid) { const K = TU(), pl = planesOn(st, s, rid); if (!pl.length) return Math.pow(K.freqMin, K.freqExp) * K.noPlaneAttr;
  return Math.pow(Math.max(K.freqMin, pl.reduce((u, p) => u + freqW(p.ty), 0)), K.freqExp); }
function epsNow(st) { let e = TU().elast; for (const ev of st.ev) { const def = evDef(ev.id); if (def && def.fx && def.fx.elastic) e *= def.fx.elastic; } return e; }
// avantajul pionierului (atractivitate) pe nivelul pieței: piețele bogate atrag rivali, deci primul venit ține mai mult din cotă
function pioAttr(rid) { const K = TU(), t = K.pioAttrTier; if (!Array.isArray(t) || t.length < 4) return K.pioneerAttr; const [a, b] = ridEnds(rid); return t[tierOf(yieldMult(a, b)).k] || K.pioneerAttr; }
function attract(st, s, rid, dir, price) {
  const K = TU(), c = st.c[s], cr = c.r[rid], r = st.rt[rid];
  const p = price !== undefined ? price : (dir === "ba" ? cr.pb : cr.pa);
  const nrm = routeNormal(rid);
  let A = Math.pow(Math.max(0.02, p / nrm), -epsNow(st)) * freqF(st, s, rid) * (1 + K.starW * (stars(st, s) - 3));
  if (r && r.pio === s && r.pu > st.gt) A *= pioAttr(rid);
  return Math.max(0, A * invAttrMult(st, s, rid));
}
const isFrozen = (st, s) => !!(st.c[s] && st.c[s].fz);
function servers(st, rid) { return st.ps.filter(s => !st.c[s].out && st.c[s].r[rid]); }
function priceResp(st, o, x, pAvg, nrm) {
  const K = TU(), A = AP(o), B = AP(x);
  const el = ((A.tags || []).indexOf("afaceri") >= 0 || (B.tags || []).indexOf("afaceri") >= 0) ? K.priceElastAfaceri : K.priceElast;
  const m = Math.max(0.01, pAvg / nrm), kn = K.priceKnee || 0;
  // peste prag (Premium) cererea cade brusc pe orice rută: alternative (tren, autocar) sau nu mai zboară deloc
  const f = kn > 0 && m > kn ? Math.pow(kn, -el) * Math.pow(m / kn, -Math.max(el, K.priceElastHigh || el)) : Math.pow(m, -el);
  return clamp(f, K.priceMultMin, K.priceMultMax);
}
/* piața unei direcții: total și cererea fiecărei companii (fără tranzit). override = {s, A, p} pentru simulări de preț */
function marketDir(st, rid, di, override) {
  const K = TU(), [a, b] = ridEnds(rid), [o, x] = di ? [b, a] : [a, b], dir = di ? "ba" : "ab";
  const sv = servers(st, rid); if (override && sv.indexOf(override.s) < 0) sv.push(override.s);
  const r = st.rt[rid], nrm = normalPrice(dist(a, b), a, b);
  const As = sv.map(s => isFrozen(st, s) ? 0 : (override && override.s === s ? override.A : attract(st, s, rid, dir)));
  const ps = sv.map(s => override && override.s === s ? override.p : (di ? st.c[s].r[rid].pb : st.c[s].r[rid].pa));
  const sum = As.reduce((u, v) => u + v, 0);
  const pAvg = sum > 0 ? As.reduce((u, v, i) => u + v * ps[i], 0) / sum : (ps.reduce((u, v) => u + v, 0) / Math.max(1, ps.length));
  let base = rawDemand(st, o, x) * (r ? routeRamp(st, rid) : K.ramp0) * (r && r.nz ? r.nz[di] : 1);
  if (r && r.pu > st.gt) base *= 1 + K.pioneerDemand;
  const tot = base * priceResp(st, o, x, pAvg, nrm);
  let attacker = null;
  for (const s of sv) { const fz = st.c[s].fz; if (fz && fz.by && sv.indexOf(fz.by) >= 0 && !isFrozen(st, fz.by)) attacker = fz.by; }
  const out = {};
  sv.forEach((s, i) => {
    const sh = attacker ? (s === attacker ? 1 : 0) : (sum > 0 ? As[i] / sum : 0);
    let v = tot * sh * demEvMult(st, o, x, s) * invDemMult(st, s, o, x);
    if (st.c[s].fx.some(f => f.k === "boom" && f.rid === rid && f.u > st.gt)) v *= K.boomMult;
    if (isFrozen(st, s)) v = 0;
    out[s] = { d: v, sh: sum > 0 ? As[i] / sum : 0 };
  });
  // capacitate: cererea pe care o companie n-o poate duce (preț de dumping cu un avion mic, rută fără avion) trece parțial la rivali
  if (sv.length > 1 && !attacker && TU().spillFrac > 0) {
    const K2 = TU(), d = dist(a, b), cap = {}; let ex = 0;
    for (const s of sv) { if (override && override.s === s) { cap[s] = Infinity; continue; }
      cap[s] = isFrozen(st, s) ? 0 : planesOn(st, s, rid).reduce((u, p) => u + planeT(p.ty).seats * (p.ch && p.ch.length === 2 ? MIN_DAY / chainCycleMin(p.ty, p.ch[0], p.ch[1]) : legsPerDay(p.ty, d)), 0) * K2.spillCapMult;
      ex += Math.max(0, out[s].d - cap[s]); }
    if (ex > 0) {
      const room = s => Math.max(0, cap[s] - out[s].d), rec = sv.filter(s => room(s) > 0 && !isFrozen(st, s));
      const wsum = rec.reduce((u, s) => u + As[sv.indexOf(s)], 0);
      if (wsum > 0) {
        const give = ex * K2.spillFrac; let given = 0;
        const rooms = rec.map(s => room(s)); rec.forEach((s, i) => { const g = Math.min(rooms[i], give * As[sv.indexOf(s)] / wsum); out[s].d += g; given += g; });
        const f = given / ex; for (const s of sv) { const over = Math.max(0, out[s].d - cap[s]); if (over > 0 && rec.indexOf(s) < 0) out[s].d -= over * f; }
      }
    }
  }
  return { tot, out, o, x };
}
function computeRates(st) { // {r:{s:{rid:[ab,ba]}}, sh:{s:{rid:[ab,ba]}}} pasageri/zi
  const K = TU(), out = {}, share = {};
  for (const s of st.ps) { out[s] = {}; share[s] = {}; }
  for (const rid in st.rt) {
    for (let di = 0; di < 2; di++) {
      const m = marketDir(st, rid, di);
      for (const s in m.out) { (out[s][rid] = out[s][rid] || [0, 0])[di] = m.out[s].d; (share[s][rid] = share[s][rid] || [0, 0])[di] = m.out[s].sh; }
    }
  }
  for (const s of st.ps) { // tranzit A–H–X
    const c = st.c[s]; if (c.out || isFrozen(st, s)) continue;
    const by = {}; for (const rid in c.r) for (const ap of ridEnds(rid)) (by[ap] = by[ap] || []).push(rid);
    let pairs = 0;
    for (const H in by) {
      const L = by[H]; if (L.length < 2) continue;
      const hm = c.hubs.indexOf(H) >= 0 ? K.hubTransit : 1;
      for (let i = 0; i < L.length && pairs < K.transitMaxPairs; i++) for (let j = 0; j < L.length && pairs < K.transitMaxPairs; j++) {
        if (i === j) continue;
        const r1 = L[i], r2 = L[j], A = otherEnd(r1, H), X = otherEnd(r2, H); if (A === X || c.r[ridOf(A, X)]) continue;
        if (dist(A, H) + dist(H, X) > K.transitMaxDistRatio * Math.max(1, dist(A, X))) continue;
        pairs++;
        const d1 = ridEnds(r1)[0] === A ? 0 : 1, d2 = ridEnds(r2)[0] === H ? 0 : 1;
        const s1 = (share[s][r1] || [0, 0])[d1], s2 = (share[s][r2] || [0, 0])[d2];
        if (!s1 || !s2 || !out[s][r1] || !out[s][r2]) continue;
        const ex = K.transitShare * rawDemand(st, A, X) * s1 * s2 * hm * Math.min(routeRamp(st, r1), routeRamp(st, r2));
        out[s][r1][d1] += ex; out[s][r2][d2] += ex;
      }
    }
    addChainRates(st, s, out[s]);
  }
  return { r: out, sh: share };
}
const dirIdx = (rid, from) => ridEnds(rid)[0] === from ? 0 : 1;
function chainGroups(st, s) { const g = {}; for (const p of st.pl) if (p.s === s && p.ch && p.ch.length === 2) { const k = p.ch.slice().sort().join("|"); (g[k] = g[k] || { r: p.ch.slice().sort(), n: 0 }).n++; } return g; }
function addChainRates(st, s, o) {
  const c = st.c[s], g = chainGroups(st, s);
  for (const k in g) {
    const [r1, r2] = g[k].r; if (!c.r[r1] || !c.r[r2] || !o[r1] || !o[r2]) continue;
    const P = chainPts(r1, r2); if (!P) continue;
    const ex = chainExtra(st, s, r1, r2, g[k].n);
    o[r1][dirIdx(r1, P.a)] += ex[0]; o[r2][dirIdx(r2, P.b)] += ex[0];
    o[r2][dirIdx(r2, P.c)] += ex[1]; o[r1][dirIdx(r1, P.b)] += ex[1];
  }
}

/* ======================= costuri ======================= */
function fuelMult(st, s) {
  let m = (st.fi || 1) * (st.cf || 1) * evMult(st, "fuel", s, true);
  if (s && st.c[s] && st.c[s].fx.some(f => f.k === "fuel" && f.u > st.gt)) m *= TU().fuelCardMult;
  return m;
}
function landingFee(st, s, ap, ty) {
  const K = TU(), a = AP(ap), c = st.c[s]; let f = (K.landFee[a.size] || 0) * (planeT(ty).feeMult || 1) * evApMult(st, "fee", ap, s, true);
  if (c.hubs.indexOf(ap) >= 0) f *= K.hubFeeMult;
  const L = ivOf(c).b; if (L && ap === c.base) f *= Math.max(0, 1 - K.INV.base.fee * L);
  if (bonusOn(st)) f *= K.bonusFee;
  return f;
}
function flightCost(st, s, ty, from, to) {
  const pt = planeT(ty), d = dist(from, to);
  const eco = ivOf(st.c[s]).e[ty] ? 1 - TU().INV.eco.fuel : 1;
  return Math.round(d * pt.ckm * fuelMult(st, s) * eco + landingFee(st, s, to, ty) + pt.crewH * flightMin(ty, d) / 60 * evMult(st, "crew", s, true));
}
function planeAge(st, p) { return p.ag + Math.max(0, st.day - p.bd); }
function planeValue(st, p) {
  const K = TU(); if (p.ls) return K.valLeased || 0;
  const dep = K.depDay * (ivOf(st.c[p.s]).m ? 1 - K.INV.mnt.dep : 1);
  const v = Math.round(planeT(p.ty).price * Math.max(K.depMin, 1 - dep * planeAge(st, p)));
  return p.pp ? Math.min(v, p.pp) : v; // second-hand / răscumpărat: cel mult cât s-a plătit (fără câștig instant de valoare)
}
function crisisDays(st) { return !st.maxDay ? Math.max(0, st.day - TU().crisisDay) : 0; }
/* leasing cu opțiune de cumpărare: p.lpd = chiria plătită; răscumpărare = valoare − 50% din chiria plătită (min 10% din valoare);
   devine automat al tău când chiria plătită ajunge la prețul nou × ownMult */
/* chiria de leasing: ×bonusLease (0,5) în „Startul de companie”, apoi crește treptat (zilele rampFrom…rampTo) până la 100% — fără salt peste noapte */
function leaseMult(st, day) {
  const K = TU(), d = day === undefined ? st.day : day; if (st.phase === "setup") return 1;
  const a = K.leaseRampFrom, b = K.leaseRampTo, lo = K.bonusLease;
  if (!(b > a)) return d <= K.bonusDays ? lo : 1;
  if (d < a) return lo; if (d >= b) return 1;
  return r2(lo + (1 - lo) * (d - a + 1) / (b - a + 1));
}
const leaseDayOf = (st, p) => planeT(p.ty).lease * leaseMult(st);
function ownedValue(st, p) { const K = TU(), dep = K.depDay * (ivOf(st.c[p.s]).m ? 1 - K.INV.mnt.dep : 1); return Math.round(planeT(p.ty).price * Math.max(K.depMin, 1 - dep * planeAge(st, p))); }
function buyoutPrice(st, p) { const K = TU(), v = ownedValue(st, p); return Math.round(Math.max(v * K.buyMinFrac, v - K.buyCredit * (p.lpd || 0)) / 1000) * 1000; }
function leaseInfo(st, p) { const K = TU(), need = planeT(p.ty).price * K.ownMult, paid = Math.round(p.lpd || 0), rate = leaseDayOf(st, p);
  // zilele rămase țin cont de sfârșitul „Startului de companie” (chirie ×0,5 până atunci, apoi întreagă) → numărătoarea nu sare
  const K2 = TU(), full = planeT(p.ty).lease, left = Math.max(0, need - paid);
  let days = Math.ceil(left / Math.max(1, full));
  if (leaseMult(st) < 1) { let rem = left, d = st.day; days = 0; while (rem > 0 && leaseMult(st, d) < 1 && days < 400) { rem -= full * leaseMult(st, d); d++; days++; }
    if (rem > 0) days += Math.ceil(rem / Math.max(1, full)); }
  return { leasePaid: paid, leaseTarget: Math.round(need), buyoutPrice: buyoutPrice(st, p), daysToOwn: Math.max(0, days), leaseDayNow: Math.round(rate), leaseDayFull: full }; }
function leaseAccrue(st, s) {
  const K = TU(), c = st.c[s];
  for (const p of st.pl) if (p.s === s && p.ls) {
    p.lpd = Math.round((p.lpd || 0) + leaseDayOf(st, p));
    if (p.lpd >= planeT(p.ty).price * K.ownMult) { p.ls = 0; delete p.lpd; c.st.planesBought++; logp(st, "leaseOwned", { s, x: p.id, t: planeT(p.ty).id }); }
  }
}
function dailyCosts(st, s) {
  const K = TU(), c = st.c[s]; let m = 0, ls = 0, pil = 0, n = 0;
  const mm = evMult(st, "maint", s, true) * (ivOf(c).m ? 1 - K.INV.mnt.maint : 1), cm = evMult(st, "crew", s, true), lm = leaseMult(st);
  for (const p of st.pl) if (p.s === s) { n++; const pt = planeT(p.ty); m += pt.maint * (1 + K.maintAge * planeAge(st, p)) * mm; if (p.ls) ls += pt.lease * lm; if (p.pil) pil += pt.pilot * cm; }
  const cons = c.cons ? K.consFee : 0;
  const nr = Object.keys(c.r).length, hq = K.overheadDay * clamp(nr / Math.max(1, K.overheadFullRoutes), K.overheadMinFrac, 1); // sediul crește cu compania
  const ovh = (hq + K.overheadRoute * nr + K.overheadPlane * n) * (1 + K.crisisOverhead * crisisDays(st));
  return { maint: Math.round(m), lease: Math.round(ls), pilots: Math.round(pil), cons: Math.round(cons), overhead: Math.round(ovh), total: Math.round(m + ls + pil + cons + ovh) };
}
function planeFixed(st, s, p) { // costul fix pe zi al unui avion (mentenanță + leasing + pilot + regia per avion)
  const K = TU(), c = st.c[s], pt = planeT(p.ty), mm = evMult(st, "maint", s, true) * (ivOf(c).m ? 1 - K.INV.mnt.maint : 1);
  return Math.round(pt.maint * (1 + K.maintAge * planeAge(st, p)) * mm + K.overheadPlane + (p.ls ? pt.lease * leaseMult(st) : 0) + (p.pil ? pt.pilot * evMult(st, "crew", s, true) : 0));
}

/* ======================= valoare companie ======================= */
function bankDebt(st, s) { return Math.round(st.c[s].bl.reduce((a, l) => a + l.p, 0)); }
function avgP7(cr) { const p7 = cr.p7; return p7.length ? p7.reduce((a, b) => a + b, 0) / p7.length : 0; }
function cardValue(st, s) {
  const K = TU(); let sum = 0, n = 0;
  const add = c => { for (const rid in c.r) { if (c.r[rid].p7.length) { sum += avgP7(c.r[rid]); n++; } } };
  if (s && st.c[s]) add(st.c[s]); if (!n) for (const x of st.ps) if (!st.c[x].out) add(st.c[x]);
  return Math.round(clamp((n ? sum / n : 0) * K.valCardDays, K.valCardMin, K.valCardMax));
}
function valueParts(st, s) {
  const K = TU(), c = st.c[s];
  if (c.out) return { cash: 0, debt: 0, loans: 0, planes: 0, routes: 0, slots: 0, hubs: 0, cards: 0, inv: 0, base: 0 };
  let loans = 0; for (const l of st.ln) { if (l.l === s && !st.c[l.b].out) loans += l.rep; if (l.b === s) loans -= l.rep; }
  let planes = 0; for (const p of st.pl) if (p.s === s) planes += planeValue(st, p);
  let routes = 0; for (const rid in c.r) { const cr = c.r[rid]; routes += Math.max(K.valRouteDays * Math.max(0, avgP7(cr)), K.valRouteCard * (cr.nc || 0)); }
  let slots = 0; for (const ap in st.sl) if (st.sl[ap].indexOf(s) >= 0 && !(K.baseIsFree && ap === c.base)) slots += K.valSlot * slotPrice(ap);
  let hubs = 0; for (const h of c.hubs) hubs += K.valHub * (K.hubPrice[AP(h).size] || 0);
  const cv = cardValue(st, s); let cards = 0;
  for (let i = 0; i < 4; i++) cards += c.h[i] * cv + Math.floor(c.h[i] / 5) * K.valSet5;
  cards += c.h[4] * cv * K.valJoker;
  for (const id in c.sx) cards += c.sx[id] * cv * K.valSpecial;
  cards -= c.pm.length * K.valPermitPenalty;
  const debt = bankDebt(st, s), inv = invValue(st, c);
  const base = Math.round(c.cash - debt + loans + planes + routes + slots + hubs + cards + inv);
  return { cash: Math.round(c.cash), debt: -debt, loans: Math.round(loans), planes: Math.round(planes), routes: Math.round(routes), slots: Math.round(slots), hubs: Math.round(hubs), cards: Math.round(cards), inv, base };
}
function baseValue(st, s) { return valueParts(st, s).base; }
function ownPct(st, s) { const h = st.sh[s] || {}; let o = 0; for (const k in h) o += h[k]; return 100 - o; }
function companyValue(st, s) {
  const c = st.c[s]; if (!c || c.out) return 0;
  const b = baseValue(st, s), x = shRaised(st, s), ob = b - x; // banii din acțiuni vândute rămân ai companiei (nu se diluează)
  let v = ob > 0 ? ob * ownPct(st, s) / 100 + x : b;
  for (const iss in st.sh) { const n = (st.sh[iss] || {})[s] || 0; if (n && !st.c[iss].out) v += Math.max(0, opBase(st, iss)) * n / 100; }
  return Math.round(v);
}
const sharePrice = (st, iss) => Math.max(1, Math.round(Math.max(TU().shareMinValue, opBase(st, iss)) / 100));

/* ======================= permise ======================= */
function distClass(d) { const k = TU().classKm; return d < k[0] ? 0 : d < k[1] ? 1 : d < k[2] ? 2 : 3; }
const clsName = d => TU().classNames[distClass(d)] || "mediu";
function permitCost(R, a, b) {
  const K = TU(), d = dist(a, b), cl = distClass(d), rg = K.cardCost[cl] || [4, 5];
  let n = rint(R, rg[0], rg[1]);
  const A = AP(a), B = AP(b);
  if (A.size === 3 && B.size === 3) n = Math.min(rg[1] + 1, n + K.permitBig);
  if (A.size === 1 || B.size === 1) n = Math.max(2, rg[0] - 1, n - K.permitSmall);
  const k = [0, 0, 0, 0], order = shuffle(R, [0, 1, 2, 3]);
  const nt = Math.min(4, Math.max(n >= 2 ? 2 : 1, Math.ceil(n / K.maxSameType)));
  for (let i = 0; i < n; i++) {
    let t = order[i < nt ? i : Math.floor(R() * nt)];
    if (k[t] >= K.maxSameType) { t = order.find(x => k[x] < K.maxSameType); if (t === undefined) t = order[0]; }
    k[t]++;
  }
  return k;
}
const maxRange = () => Math.min(TU().maxDistKm, Math.max.apply(null, TU().PLANES.map(p => p.range)));
/* permisele noi: distanța maximă = autonomia celui mai „lung” avion propriu/în leasing (+ marjă), dar cel puțin permitRangeMin (companie nouă).
   Cumperi un avion cu autonomie mai mare → primești permise mai lungi. → {km, ty (tipul care o dă, −1 = minimul de start), name, min} */
function permitRange(st, s) {
  const K = TU(); let best = -1, r = 0;
  for (const p of st.pl) if (p.s === s && planeT(p.ty).range > r) { r = planeT(p.ty).range; best = p.ty; }
  const byFleet = Math.round(r * (1 + K.permitRangeMargin) / 100) * 100, km = Math.min(maxRange(), Math.max(K.permitRangeMin, byFleet));
  if (!K.permitRangeOn) return { km: maxRange(), ty: -1, name: "", min: K.permitRangeMin };
  return { km, ty: byFleet >= K.permitRangeMin ? best : -1, name: byFleet >= K.permitRangeMin && best >= 0 ? planeT(best).n : "", min: K.permitRangeMin };
}
function feasiblePair(a, b) { const d = dist(a, b), A = AP(a), B = AP(b); return TU().PLANES.some(p => p.range >= d && A.size >= (p.minSize || 1) && B.size >= (p.minSize || 1)); }
function ownsPair(st, s, a, b) { const c = st.c[s], rid = ridOf(a, b); if (c.r[rid]) return true; if (c.pm.some(p => ridOf(p.a, p.b) === rid)) return true; if (c.of && c.of.some(p => ridOf(p.a, p.b) === rid)) return true; return false; }
function genPermits(st, s, R, n) {
  const K = TU(), net = Array.from(network(st, s)), aps = D().AIRPORTS, mr = Math.min(maxRange(), permitRange(st, s).km);
  const cls = [[], [], [], []];
  for (const a of net) for (const x of aps) {
    if (x.id === a) continue; const d = dist(a, x.id); if (d > mr || d < K.distMinPermit) continue;
    if (ownsPair(st, s, a, x.id) || !feasiblePair(a, x.id)) continue;
    let w = Math.sqrt(AP(a).pop * x.pop) + 0.2;
    if (d >= K.thinBand[0] && d < K.thinBand[1] && rawDemand(st, a, x.id) < K.thinDem) w *= K.thinW; // 3.000–5.000 km cu < 100 pas./zi: niciun tip nu câștigă bine → oferite rar
    cls[distClass(d)].push([a, x.id, w]);
  }
  const res = [], used = new Set();
  const wpick = arr => { let tot = 0; for (const e of arr) if (!used.has(ridOf(e[0], e[1]))) tot += e[2]; if (tot <= 0) return null; let y = R() * tot, last = null; for (const e of arr) { if (used.has(ridOf(e[0], e[1]))) continue; last = e; y -= e[2]; if (y <= 0) return e; } return last; };
  for (let i = 0; i < n; i++) {
    const mix = K.offerMix.map((w, ci) => cls[ci].some(e => !used.has(ridOf(e[0], e[1]))) ? w : 0);
    const tot = mix.reduce((u, v) => u + v, 0); if (tot <= 0) break;
    let ci = 0, y = R() * tot; for (ci = 0; ci < 4; ci++) { y -= mix[ci]; if (y <= 0) break; } ci = Math.min(ci, 3);
    if (!mix[ci]) ci = mix.findIndex(w => w > 0);
    if (i === 0 && mix[0] > 0 && !Object.keys(st.c[s].r).filter(r => !st.c[s].r[r].st0).length) ci = 0; // primul permis al unei companii noi: scurt (merge cu avionul de start)
    const e = wpick(cls[ci]); if (!e) break;
    used.add(ridOf(e[0], e[1]));
    res.push({ id: newId(st), a: e[0], b: e[1], d: dist(e[0], e[1]), k: permitCost(R, e[0], e[1]) });
  }
  return res;
}
function permitNeed(c, p, fast) {
  const k = p.k.slice();
  if (fast) for (let n = 0; n < TU().rapidLess; n++) { let mi = 0; for (let i = 1; i < 4; i++) if (k[i] > k[mi]) mi = i; if (k[mi] > 0) k[mi]--; }
  const miss = [0, 0, 0, 0]; let jok = 0;
  for (let i = 0; i < 4; i++) { miss[i] = Math.max(0, k[i] - c.h[i]); jok += miss[i]; }
  return { k, miss, jok, ok: jok <= c.h[4], total: k.reduce((u, v) => u + v, 0) };
}
function autoPay(c, k) { const pay = [0, 0, 0, 0, 0]; for (let i = 0; i < 4; i++) { pay[i] = Math.min(c.h[i], k[i]); pay[4] += k[i] - pay[i]; } return pay; }
function slotNeeds(st, s, a, b) {
  const res = [];
  for (const ap of [a, b]) { if (hasSlot(st, s, ap)) continue; const ok = slotFree(st, ap); res.push({ ap, price: slotPrice(ap), ok, why: ok ? "" : "Aeroport plin (toate sloturile sunt ocupate)" }); }
  return res;
}

/* ======================= avioane ======================= */
function newPlane(st, s, ty, ag, ls, at) {
  const p = { id: newId(st), s, ty, ag: ag || 0, bd: st.day, ls: ls ? 1 : 0, pil: 0, rid: null, ap: at, fr: at, m: 0, t0: st.gt, ta: 0, px: 0, rv: 0, go: 0, ud: 0, dly: 0, bk: 0 };
  st.pl.push(p); trackFleet(st, s);
  return p;
}
function trackFleet(st, s) {
  const c = st.c[s]; if (!c) return; const mine = st.pl.filter(x => x.s === s);
  c.st.planesMax = Math.max(c.st.planesMax || 0, mine.length);
  c.st.s350 = Math.max(c.st.s350 || 0, mine.filter(x => x.ty === 2).length);
  c.st.pilotsMax = Math.max(c.st.pilotsMax || 0, mine.filter(x => x.pil).length);
}
function genUsed(st, R) {
  const K = TU(), n = rint(R, K.usedN[0], K.usedN[1]), out = [];
  for (let i = 0; i < n; i++) {
    const nt = K.PLANES.length, w = allTypes().map(t => Math.max(0, +K.usedW[t] || 0)); let y = R() * w.reduce((a, b) => a + b, 0), ty = 0; for (ty = 0; ty < nt - 1; ty++) { y -= w[ty]; if (y <= 0) break; }
    const ag = rint(R, K.usedAge[0], K.usedAge[1]);
    out.push({ id: newId(st), ty, ag, pr: Math.round(planeT(ty).price * Math.max(K.depMin, 1 - K.depDay * ag) * K.usedDisc / 1000) * 1000 });
  }
  st.um = out; st.umd = st.day;
}
function deboard(st, p) { // pasagerii revin în coadă
  if (p.m === 1 && p.rid && p.px) { const cr = st.c[p.s].r[p.rid]; if (cr) { if (p.ap === ridEnds(p.rid)[0]) cr.qa += p.px; else cr.qb += p.px; } }
  p.px = 0; p.rv = 0;
}
function canServe(ty, rid) { const [a, b] = ridEnds(rid), pt = planeT(ty), ms = pt.minSize || 1; return !!(AP(a) && AP(b)) && pt.range >= dist(a, b) && AP(a).size >= ms && AP(b).size >= ms; }
function startFerryOrBoard(st, p) {
  const [a, b] = ridEnds(p.rid);
  if (p.ap === a || p.ap === b) { p.m = 1; p.t0 = r2(st.gt); p.px = 0; p.rv = 0; p.go = 0; p.bk = 0; p.man = 0; return; }
  const to = dist(p.ap, a) <= dist(p.ap, b) ? a : b;
  p.m = 3; p.fr = p.ap; p.ap = to; p.t0 = r2(st.gt); p.ta = r2(st.gt + Math.max(TU().reassignMin, flightMin(p.ty, dist(p.fr, to)))); p.px = 0; p.rv = 0; p.go = 0;
}
function readyAt(st, p) { return Math.max(p.t0 + TU().turnMin + (p.ch && p.ap === chainMid(p.ch[0], p.ch[1]) ? TU().chStop : 0) + apDelay(st, p.ap, p.s), p.dly || 0, apHold(st, p.ap, p.s)); }
function canDepartNow(st, p) {
  if (p.m !== 1 || !p.rid || st.c[p.s].fz) return false;
  if (st.gt < readyAt(st, p) - 1e-9) return false;
  return !isClosed(st, p.ap, p.s) && !isClosed(st, otherEnd(p.rid, p.ap), p.s);
}
function depart(st, p, R) {
  const K = TU(), c = st.c[p.s];
  if (!p.bk) { // pană posibilă (o singură aruncare pe îmbarcare)
    p.bk = 1;
    const ch = Math.min(K.breakMax, K.breakBase + K.breakAge * planeAge(st, p)) * evMult(st, "breakdown", p.s, true) * (ivOf(c).m ? 1 - K.INV.mnt.breakdown : 1);
    if (R() < ch) {
      p.dly = r2(st.gt + rint(R, K.delayRange[0], K.delayRange[1])); c.rep = clamp(c.rep - K.delayRep, K.repMin, K.repMax);
      const rep = Math.round(planeT(p.ty).price * K.repairMult); c.cash -= rep; c.today.cost += rep; c.st.breakdowns++; p.go = 1; st.mv++; return false;
    }
  }
  const to = otherEnd(p.rid, p.ap), d = dist(p.ap, to), seats = planeT(p.ty).seats, ld = p.px / seats;
  const cr = c.r[p.rid];
  if (cr) {
    cr.lf = cr.lf === undefined ? r3(ld) : r3(cr.lf * 0.7 + ld * 0.3); cr.f = (cr.f || 0) + 1;
    if ((p.ap === ridEnds(p.rid)[0] ? cr.pa : cr.pb) > K.gougeMult * normalPrice(d, p.ap, to)) c.rep += K.gouge;
  }
  if (ld >= 0.5) c.rep += K.repFlight; else if (ld < 0.25) c.rep += K.repEmpty;
  c.rep = clamp(c.rep, K.repMin, K.repMax);
  if (p.px > 0) c.st.flights++;
  if (p.px >= seats) c.st.fullFlights++; else if (ld < 0.2) c.st.emptyFlights++;
  if (p.man) c.st.manualDeparts++;
  p.m = 2; p.fr = p.ap; p.ap = to; p.t0 = r2(st.gt); p.ta = r2(st.gt + flightMin(p.ty, d)); p.go = 0; p.man = 0; if (p.pmT !== undefined) delete p.pmT; if (p.sub) delete p.sub; if (p.fs !== undefined) delete p.fs; if (p.qh) delete p.qh;
  st.mv++;
  return true;
}
function arrive(st, p) {
  const c = st.c[p.s], cost = flightCost(st, p.s, p.ty, p.fr, p.ap), rev = Math.round(p.rv);
  c.cash += rev - cost; c.today.rev += rev; c.today.cost += cost; p.pt = Math.round((p.pt || 0) + rev - cost); // profitul de azi al avionului (zboruri)
  if (p.m === 2) {
    const cr = (p.rid0 && c.r[p.rid0]) || (p.rid && c.r[p.rid]) || null;
    if (cr) cr.pr += rev - cost;
    c.st.pax += p.px; c.st.revenue += rev; c.st.profit += rev - cost; c.st.km = (c.st.km || 0) + dist(p.fr, p.ap);
    c.st.bestFlight = Math.max(c.st.bestFlight, rev - cost);
    p.lp = rev - cost;
  } else c.st.profit -= cost;
  c.st.maxCash = Math.max(c.st.maxCash, Math.round(c.cash));
  p.px = 0; p.rv = 0; p.t0 = r2(st.gt); delete p.rid0;
  if (p.ud) { p.ud = 0; p.rid = null; delete p.ch; }
  if (p.ch) { // escală: la mijloc schimbă etapa
    const B = chainMid(p.ch[0], p.ch[1]);
    if (!B || !c.r[p.ch[0]] || !c.r[p.ch[1]] || p.ch.indexOf(p.rid) < 0) delete p.ch;
    else if (p.ap === B && p.m !== 3) p.rid = p.rid === p.ch[0] ? p.ch[1] : p.ch[0];
  }
  if (p.rid && c.r[p.rid]) startFerryOrBoard(st, p); else { p.rid = null; p.m = 0; delete p.ch; }
  st.mv++;
}

/* ======================= simulare ======================= */
function advance(st, target, R) {
  const K = TU(), tau = Math.max(60, K.queueLife);
  let rates = computeRates(st), lastRates = st.gt, guard = 0;
  while (st.gt < target - 1e-9 && guard++ < 200000) {
    const t0 = st.gt; let nx = Math.min(target, t0 + 10);
    for (const p of st.pl) if ((p.m === 2 || p.m === 3) && !st.c[p.s].fz && p.ta > t0 + 1e-9 && p.ta < nx) nx = p.ta;
    for (const s of st.ps) { const fz = st.c[s].fz; if (fz && fz.e > t0 + 1e-9 && fz.e < nx) nx = fz.e; }
    const dt = nx - t0;
    if (st.gt - lastRates >= 60) { rates = computeRates(st); lastRates = st.gt; }
    const e = Math.exp(-dt / tau), mid = t0 + dt / 2;
    for (const s of st.ps) {
      const c = st.c[s]; if (c.out) continue; const rr = rates.r[s] || {};
      for (const rid in c.r) {
        const cr = c.r[rid], rt = rr[rid] || [0, 0], [a, b] = ridEnds(rid);
        const ra = rt[0] * dayCurveAt(st, a, mid) / MIN_DAY * tau, rb = rt[1] * dayCurveAt(st, b, mid) / MIN_DAY * tau;
        cr.qa = Math.min(ra + (cr.qa - ra) * e, Math.max(cr.qa, rt[0] * K.queueCapDays));
        cr.qb = Math.min(rb + (cr.qb - rb) * e, Math.max(cr.qb, rt[1] * K.queueCapDays));
      }
    }
    st.gt = nx;
    for (const s of st.ps) { const fz = st.c[s].fz; if (fz && st.gt >= fz.e - 1e-9) { endFreeze(st, s); rates = computeRates(st); lastRates = st.gt; } }
    for (const p of st.pl.slice()) if ((p.m === 2 || p.m === 3) && !st.c[p.s].fz && p.ta <= st.gt + 1e-9) arrive(st, p);
    if (st.ev.some(e => e.ue && e.ue <= st.gt + 1e-9)) { st.ev = st.ev.filter(e => !(e.ue && e.ue <= st.gt + 1e-9)); rates = computeRates(st); lastRates = st.gt; } // evenimente pe ore
    for (const s of st.ps) { const c = st.c[s]; if (c.fx.length && c.fx.some(f => f.u <= st.gt)) { c.fx = c.fx.filter(f => f.u > st.gt); rates = computeRates(st); lastRates = st.gt; } }
    const front = coordFront(st);
    for (const p of st.pl) {
      if (p.m !== 1 || !p.rid) continue;
      const c = st.c[p.s]; if (c.out || c.fz) continue;
      const cr = c.r[p.rid]; if (!cr) { p.rid = null; p.m = 0; delete p.ch; continue; }
      if (p.pil && !p.go) { const fid = front[p.s + "|" + p.rid + "|" + p.ap]; // același traseu și sens: avionul de la poartă ia coada, ceilalți așteaptă la rând
        if (fid !== undefined && fid !== p.id) { if (!p.qh) { p.qh = 1; st.mv++; } continue; }
        if (p.qh) { delete p.qh; p.fs = r2(st.gt); } }
      const atA = p.ap === ridEnds(p.rid)[0], seats = planeT(p.ty).seats, space = seats - p.px;
      if (space > 0) {
        const q = atA ? cr.qa : cr.qb, take = Math.min(space, Math.floor(q + 1e-6));
        if (take > 0) { p.px += take; p.rv += take * (atA ? cr.pa : cr.pb); if (atA) cr.qa -= take; else cr.qb -= take; }
      }
      if (!canDepartNow(st, p)) continue;
      if (p.go) { tryDepart(st, p, R); continue; }
      if (p.pil && p.pm) { if (pilotDecide(st, p, cr, atA, seats, rates)) tryDepart(st, p, R); }
      else if (p.pil) {
        const waited = st.gt - Math.max(p.t0, p.fs || 0) - apDelay(st, p.ap, p.s), price = atA ? cr.pa : cr.pb;
        const be = flightCost(st, p.s, p.ty, p.ap, otherEnd(p.rid, p.ap)) / Math.max(1, seats * price);
        if (p.px >= seats || (waited >= K.pilotMinWait && p.px / seats >= Math.max(be + K.pilotMargin, K.pilotMinLoad)) || waited >= K.pilotMaxWait) tryDepart(st, p, R);
      }
    }
  }
  for (const s of st.ps) { const c = st.c[s]; for (const rid in c.r) { const cr = c.r[rid]; cr.qa = r2(cr.qa); cr.qb = r2(cr.qb); } } // stare compactă
}
/* pilot cu minim setat de jucător (p.pm pasageri): pleacă plin; după ce atinge minimul mai așteaptă doar cât timp fiecare minut
   aduce (statistic) mai mult decât costă (productivitatea avionului), cel mult pilotSmartMaxMin; sub minim: după pilotMaxWait pleacă
   doar dacă acoperă costul zborului, altfel așteaptă („sub prag”, p.sub=1) — plafon absolut pilotHardMaxMin */
/* ======================= porți (poziții la sol) — comune tuturor companiilor ======================= */
// ocupă o poartă la X: avion la sol la X (în hangar / îmbarcare) sau în zbor spre X. Avioanele unei companii la propria bază NU ocupă.
function gateTotal(st, ap) { const K = TU(), a = AP(ap); if (!a) return 99; const b = K.gatesBySize[a.size] || 99; return Math.round(b * (1 + K.gatesPerPlayer * Math.max(0, st.ps.length - 2))); }
function gateUsers(st, ap) { return st.pl.filter(q => q.ap === ap && st.c[q.s] && !st.c[q.s].out && st.c[q.s].base !== ap); }
function gateInfo(st, ap) { const u = gateUsers(st, ap), by = {}; u.forEach(q => { by[q.s] = (by[q.s] || 0) + 1; }); return { used: u.length, total: gateTotal(st, ap), byCompany: by }; }
// poate decola acum spre destinație? (primul venit, primul servit; schimb A↔B permis; după gateMaxWait pleacă oricum spre o poziție la distanță)
function gateOk(st, p, to) {
  const K = TU(); if (!K.gatesOn || st.c[p.s].base === to) return true;
  const used = gateUsers(st, to).length, total = gateTotal(st, to);
  const myT = p.wgT !== undefined ? p.wgT : st.gt;
  const ahead = st.pl.filter(q => q !== p && q.m === 1 && q.wg === to && q.wgT !== undefined && (q.wgT < myT || (q.wgT === myT && q.id < p.id))).length;
  if (used + ahead < total) return true;
  if (st.pl.some(q => q.m === 1 && q.ap === to && q.wg === p.ap)) return true;           // schimb: un avion de acolo așteaptă poarta mea
  return p.wgT !== undefined && st.gt - p.wgT >= K.gateMaxWait;                            // siguranță: niciodată blocaj total
}
function tryDepart(st, p, R) {
  const to = otherEnd(p.rid, p.ap);
  if (!gateOk(st, p, to)) { if (p.wg !== to || p.wgT === undefined) { p.wg = to; p.wgT = r2(st.gt); st.mv++; } return false; }
  if (p.wg !== undefined) { delete p.wg; delete p.wgT; }
  return depart(st, p, R);
}
/* avioane pe aceeași rută și același sens, la același aeroport (cu pilot): doar „cel de la poartă” (sosit primul) se îmbarcă și pleacă;
   ceilalți stau la rând (p.qh) și încep îmbarcarea când pleacă el (p.fs = de când e primul). Dacă primul stă de ≥ maxWait (ex. „sub prag”), rândul se deblochează. */
function coordFront(st) {
  const K = TU(), f = {}, fp = {};
  if (K.coordOn === false) return f;
  for (const p of st.pl) {
    if (p.m !== 1 || !p.rid || !p.pil || p.go) continue;
    const k = p.s + "|" + p.rid + "|" + p.ap, q = fp[k];
    if (!q || p.t0 < q.t0 - 1e-9 || (Math.abs(p.t0 - q.t0) < 1e-9 && p.id < q.id)) fp[k] = p;
  }
  for (const k in fp) { const p = fp[k]; if (st.gt - Math.max(p.t0, p.fs || 0) < K.pilotMaxWait) f[k] = p.id; }
  return f;
}
function queuePos(st, p) { // câte avioane proprii sunt înaintea lui la rând (0 = e la poartă / nu stă la rând)
  if (!p.qh || p.m !== 1) return 0;
  return st.pl.filter(q => q !== p && q.s === p.s && q.m === 1 && q.rid === p.rid && q.ap === p.ap && q.pil && !q.go && (q.t0 < p.t0 || (q.t0 === p.t0 && q.id < p.id))).length;
}
function pilotDecide(st, p, cr, atA, seats, rates) {
  const K = TU(), waited = st.gt - Math.max(p.t0, p.fs || 0) - apDelay(st, p.ap, p.s);
  if (p.px >= seats) return true;
  const to = otherEnd(p.rid, p.ap), price = atA ? cr.pa : cr.pb, fc = flightCost(st, p.s, p.ty, p.ap, to);
  if (p.px >= Math.min(p.pm, seats)) {
    p.sub = 0; if (p.pmT === undefined || p.pmT > st.gt) p.pmT = st.gt;
    if (st.gt - p.pmT >= K.pilotSmartMaxMin) return true;
    const rr = ((rates && rates.r[p.s]) || {})[p.rid] || [0, 0], di = atA ? 0 : 1;
    const peers = st.pl.filter(q => q.s === p.s && q.rid === p.rid && q.m === 1 && q.ap === p.ap).length || 1;
    const lam = rr[di] * dayCurveAt(st, p.ap, st.gt) / MIN_DAY / peers;           // pasageri/minut pentru acest avion
    const cyc = flightMin(p.ty, dist(p.ap, to)) + K.turnMin;
    const prodPerMin = Math.max(0, p.px * price - fc) / cyc;                         // cât „produce” avionul pe minut dacă pleacă acum
    return !(lam * price > prodPerMin && lam > 0);                                  // așteaptă cât timp merită
  }
  if (waited >= K.pilotHardMaxMin) { p.sub = 0; return true; }
  if (waited >= K.pilotMaxWait) { if (p.px * price >= fc) { p.sub = 0; return true; } p.sub = 1; }
  return false;
}
function flightProfit(st, s, pid, n) {
  const p = myPlane(st, s, pid); if (!p || !p.rid) return null; const c = st.c[s], cr = c.r[p.rid]; if (!cr) return null;
  const from = p.m === 2 ? p.fr : p.ap; const [a] = ridEnds(p.rid); if (ridEnds(p.rid).indexOf(from) < 0) return null;
  const to = otherEnd(p.rid, from), price = from === a ? cr.pa : cr.pb;
  return Math.round(Math.max(0, n | 0) * price - flightCost(st, s, p.ty, from, to));
}
function pilotView(st, s, p) {
  const K = TU(), seats = planeT(p.ty).seats, out = { pilotMin: p.pm || Math.ceil(seats * K.pilotMinLoad), pilotMinSet: !!p.pm, beN: null, sub: !!(p.pil && p.sub) };
  const c = st.c[s], cr = p.rid && c.r[p.rid]; if (cr) { const from = p.m === 2 ? p.fr : p.ap, ends = ridEnds(p.rid);
    if (ends.indexOf(from) >= 0) { const price = from === ends[0] ? cr.pa : cr.pb; out.beN = Math.min(seats + 1, Math.ceil(flightCost(st, s, p.ty, from, otherEnd(p.rid, from)) / Math.max(1, price))); } }
  return out;
}
function endFreeze(st, s) {
  const c = st.c[s], fz = c.fz; if (!fz) return;
  const F = Math.max(0, Math.min(st.gt, fz.e) - fz.s);
  for (const p of st.pl) if (p.s === s) {
    if (p.m === 2 || p.m === 3) { p.t0 = r2(p.t0 + F); p.ta = r2(p.ta + F); }
    if (p.dly > fz.s) p.dly = r2(p.dly + F);
  }
  c.fz = null; st.mv++;
}

/* ======================= joc nou / setup ======================= */
function newStats() {
  const d = D(); let s = null;
  if (d.newStats) { try { s = d.newStats(); } catch (e) { s = null; } }
  const base = { flights: 0, pax: 0, revenue: 0, profit: 0, bestFlight: 0, fullFlights: 0, emptyFlights: 0, manualDeparts: 0, routes: 0, routesMax: 0, pioneer: 0,
    longestRoute: 0, conts: [], airports: [], hubs: 0, slots: 0, planesBought: 0, usedBought: 0, leased: 0, planesSold: 0, planesMax: 0, s350: 0, pilotsMax: 0,
    maxCash: 0, maxValue: 0, daysNegative: 0, bankLoans: 0, bankBorrowed: 0, loansGiven: 0, loansTaken: 0, deals: 0, pacts: 0, freezes: 0, frozen: 0, breakers: 0,
    specials: 0, specialsDrafted: 0, picks: 0, cardsBuilt: 0, ghiseu: 0, cardsBought: 0, sharesBought: 0, breakdowns: 0, insured: 0, consultantTips: 0, rankFirstDays: 0,
    km: 0, negos: 0, events: 0 };
  return Object.assign(base, s || {});
}
function newCompany(s, info, i) {
  const K = TU();
  return { s, name: (info && info.name) || ("Jucător " + (i + 1)), co: "", col: -1, av: -1, g: (info && info.g) || "m", bot: info && info.bot ? 1 : 0,
    prof: 0, ready: 0, vote: null, cash: 0, base: null, hubs: [], h: [0, 0, 0, 0, 0], sx: {}, pm: [], of: null, r: {}, rep: K.repStart, cs: K.csStart,
    bl: [], neg: 0, out: 0, cons: 0, tipAt: 0, tips: [], bc: 0, fzCd: 0, fx: [], fz: null, ngd: 0, ngn: 0, today: { rev: 0, cost: 0 }, hist: [], lsd: null, st: newStats() };
}
function botProfile(st, s, R) {
  const c = st.c[s], d = D();
  const avs = d.AVATARS.filter(a => (a.g || (a.id < 5 ? "m" : "f")) === (c.g || "m")).map(a => a.id);
  const usedAv = st.ps.map(x => st.c[x].av), freeAv = avs.filter(a => usedAv.indexOf(a) < 0);
  c.av = freeAv.length ? pick(R, freeAv) : pick(R, avs.length ? avs : [0]);
  const a0 = d.AVATARS.find(x => x.id === c.av); if (a0 && a0.g) c.g = a0.g;
  const usedCo = st.ps.map(x => st.c[x].co), cos = d.COMPANIES.filter(n => usedCo.indexOf(n) < 0);
  c.co = cos.length ? pick(R, cos) : c.name + " Air";
  const usedCol = st.ps.map(x => st.c[x].col), cols = [0, 1, 2, 3, 4, 5].filter(x => usedCol.indexOf(x) < 0);
  c.col = cols.length ? pick(R, cols) : 0; c.prof = 1; c.ready = 1;
}
function newGame(rng, now, seats, opts) {
  opts = opts || {}; const K = TU();
  const R = rng || Math.random;
  const st = { g: "cerul", v: 2, phase: "setup", sp: opts.speed || G.__CERUL_SPEED || 1, seed: Math.floor(R() * 4294967296) >>> 0,
    ps: seats.map(x => x.seat), host: null, hb: now, mv: 1, nid: 0,
    gt: 0, at: now, run: 0, dl: opts.day || K.dayDefault || 1, dur: opts.dur !== undefined ? opts.dur : K.durDefault, maxDay: 0, m0: 0, day: 1,
    pz: null, su: { at: 0, t0: now }, c: {}, rt: {}, pl: [], sl: {}, sx: {}, cap: {}, pool: Object.assign({}, K.SPECIALS), ret: [],
    um: [], umd: 0, fi: K.fuelStart, cf: 1, ev: [], evn: 0, dr: null, ng: null, ngn: 0, ln: [], pacts: [], sh: {}, ack: {}, err: {}, bk: {}, log: [], lid: 0, res: null, lastNg: null };
  seats.forEach((x, i) => { st.c[x.seat] = newCompany(x.seat, x, i); st.ack[x.seat] = 0; });
  if (opts.money || opts.ev) st.opt = { money: OPT_MONEY.indexOf(opts.money) >= 0 ? opts.money : "normal", ev: OPT_EV.indexOf(opts.ev) >= 0 ? opts.ev : "normal" };
  const R2 = rngFrom(st);
  for (const s of st.ps) if (st.c[s].bot) botProfile(st, s, R2);
  if (opts.auto) { for (const s of st.ps) { if (!st.c[s].prof) botProfile(st, s, R2); st.c[s].ready = 1; } startGame(st, now, R2); }
  return st;
}
function resolveVotes(st, force) {
  const hs = humans(st), vs = hs.map(s => st.c[s].vote).filter(Boolean);
  if (!vs.length) return force || !hs.length ? { dur: st.dur, day: st.dl } : null;
  const vo = (v, k) => v[k] || "normal"; // voturi vechi fără sumă/evenimente = „normal”
  if (vs.length === hs.length && vs.every(v => v.dur === vs[0].dur && v.day === vs[0].day && vo(v, "money") === vo(vs[0], "money") && vo(v, "ev") === vo(vs[0], "ev"))) return { dur: vs[0].dur, day: vs[0].day, money: vo(vs[0], "money"), ev: vo(vs[0], "ev") };
  if (!force) return null;
  const maj = key => { const cnt = {}, g = v => key === "money" || key === "ev" ? vo(v, key) : v[key]; vs.forEach(v => { cnt[g(v)] = (cnt[g(v)] || 0) + 1; }); let best = g(vs[0]), bn = 0; for (const v of vs) if (cnt[g(v)] > bn) { bn = cnt[g(v)]; best = g(v); } return best; };
  return { dur: maj("dur"), day: maj("day"), money: maj("money"), ev: maj("ev") };
}
/* bazele: TOATE pe același continent (ales aleator per joc), orașe mari diferite la ~400–1500 km una de alta
   (relaxat treptat dacă nu se poate), cu populații cât mai apropiate (corectitudine). Rezervă: algoritmul vechi. */
function pickBasesSame(st, R) {
  const K = TU(), aps = D().AIRPORTS, n = st.ps.length, W = K.baseContW || { EU: 3, AS: 3, NA: 3, SA: 1, AF: 1, OC: 1 };
  const byCont = {};
  for (const a of aps) if (a.size >= 2 && a.pop >= (K.basePopMin || 1.5) && apYield(a.id) <= K.startMaxYield) (byCont[a.cont] = byCont[a.cont] || []).push(a);
  const bands = K.baseDistBands || [[400, 1500], [300, 1900], [250, 2600]];
  for (const [lo, hi] of bands) {
    const conts = Object.keys(byCont).filter(ct => byCont[ct].length >= n);
    const order = []; const pool = conts.slice();
    while (pool.length) { const tot = pool.reduce((u, ct) => u + (W[ct] || 1), 0); let y = R() * tot, i = 0; for (i = 0; i < pool.length - 1; i++) { y -= W[pool[i]] || 1; if (y <= 0) break; } order.push(pool.splice(i, 1)[0]); }
    for (const ct of order) {
      const cand = byCont[ct], sets = [];
      for (let t = 0; t < 300 && sets.length < 40; t++) {
        const sh = shuffle(R, cand.slice()), set = [];
        for (const a of sh) { if (set.length >= n) break; if (set.every(b => { const d = dist(a.id, b.id); return d >= lo && d <= hi; })) set.push(a); }
        if (set.length < n) continue;
        const pops = set.map(a => a.pop * (K.sizeMultBase ? K.sizeMultBase[a.size] : (a.size === 3 ? 1.2 : 1))), ratio = Math.max.apply(null, pops) / Math.min.apply(null, pops);
        sets.push({ ids: set.map(a => a.id), ratio });
      }
      if (!sets.length) continue;
      const best = Math.min.apply(null, sets.map(x => x.ratio));
      const good = sets.filter(x => x.ratio <= Math.max(1.6, best * 1.25));
      return { ids: shuffle(R, pick(R, good).ids.slice()), cont: ct };
    }
  }
  return null;
}
function pickBases(st, R) {
  const K = TU();
  if (K.sameContinent !== false) { const r = pickBasesSame(st, R); if (r) { st.reg = r.cont; return r.ids; } }
  const aps = D().AIRPORTS, n = st.ps.length;
  const byCont = {};
  for (const a of aps) if (a.size === K.baseSize) (byCont[a.cont] = byCont[a.cont] || []).push(a);
  const all = [].concat.apply([], Object.values(byCont)).map(a => a.pop).sort((x, y) => x - y);
  const med = all.length ? all[Math.floor(all.length / 2)] : 3;
  const conts = shuffle(R, Object.keys(byCont)), bases = [];
  for (const minD of [K.baseMinDistKm, 2000, 0]) {
    for (const ct of conts) {
      if (bases.length >= n) break; if (bases.some(b => AP(b).cont === ct)) continue;
      const cand = byCont[ct].filter(a => bases.every(b => dist(a.id, b) >= minD));
      if (!cand.length) continue;
      const tol = cand.filter(a => Math.abs(a.pop - med) <= K.baseTol * med);
      bases.push(pick(R, tol.length ? tol : cand.slice().sort((x, y) => Math.abs(x.pop - med) - Math.abs(y.pop - med)).slice(0, 3)).id);
    }
    if (bases.length >= n) break;
  }
  const pool = shuffle(R, aps.filter(a => a.size >= 2).map(a => a.id));
  for (const id of pool) { if (bases.length >= n) break; if (bases.indexOf(id) < 0 && bases.every(b => dist(id, b) >= 1500)) bases.push(id); }
  for (const id of pool) { if (bases.length >= n) break; if (bases.indexOf(id) < 0) bases.push(id); }
  return shuffle(R, bases);
}
/* rută de start: fiecare jucător primește gratuit o rută construită bază → aeroport apropiat, cu avionul gratuit pe ea (pilot pornit).
   Corectitudine: distanțe la ±15% și cereri la ±20% față de medie, destinații diferite dacă se poate, același tip de avion pentru toți. */
function pickStarters(st, bases, R) {
  const K = TU(), aps = D().AIRPORTS, n = bases.length; if (!n || n > st.ps.length) return null;
  const [lo, hi, minDem] = K.starterBands[0], maxKm = planeT(K.freePlaneType).range;
  const dem = (a, b) => Math.min(rawDemand(st, a, b), rawDemand(st, b, a));
  // profitul estimat/zi (monopol, preț normal, cu pilot) — bazele se pun temporar ca estimate() să poată rula
  const old = st.ps.map(s => st.c[s].base), ph = st.phase; st.ps.forEach((s, i) => { st.c[s].base = bases[i]; }); st.mv = (st.mv || 0) + 7; st.phase = "play"; // ca în ziua 1 (cu Start de companie)
  const pf = (i, x, ty) => { if (!canServe(ty, ridOf(bases[i], x))) return null; const e = estimate(st, st.ps[i], { type: ty, rid: ridOf(bases[i], x) });
    return e.ok ? e.profitDay - (K.starterPilot ? planeT(ty).pilot : 0) : null; };
  // candidați: același continent, piață modestă/medie, 250 km … raza avionului gratuit
  const cands = bases.map((b, i) => aps.filter(x => x.cont === AP(b).cont && x.id !== b && apYield(x.id) <= K.startMaxYield + 0.1)
    .map(x => ({ ap: x.id, rid: ridOf(b, x.id), d: dist(b, x.id), m: dem(b, x.id), y: yieldMult(b, x.id), rb: bases.indexOf(x.id) >= 0 ? 1 : 0 }))
    .filter(x => x.d >= 250 && x.d <= maxKm && slotCap(st, x.ap) >= 1)
    .map(x => Object.assign(x, { p: [pf(i, x.ap, K.freePlaneType), x.d <= planeT(3).range ? pf(i, x.ap, 3) : null] })));
  st.ps.forEach((s, i) => { st.c[s].base = old[i]; }); st.phase = ph;
  if (cands.some(l => !l.length)) return null;
  const pen = x => Math.max(0, lo - x.d) / lo + Math.max(0, x.d - hi) / hi + 2 * Math.max(0, minDem - x.m) / minDem + 0.5 * x.rb; // în afara ferestrei ideale / spre baza unui rival
  const dev = (arr, f) => { const m = arr.reduce((u, x) => u + f(x), 0) / arr.length; return m > 0 ? Math.max.apply(null, arr.map(x => Math.abs(f(x) - m) / m)) : 9; };
  let best = null;
  for (const [ti, ty] of [[0, K.freePlaneType], [1, 3]]) {
    const cl = cands.map(l => l.filter(x => x.p[ti] !== null && x.p[ti] > 0)); if (cl.some(l => !l.length)) continue;
    for (const x0 of shuffle(R, cl[0].slice())) {
      const pickd = [x0];
      for (let i = 1; i < n; i++) {
        let bi = null, bs = Infinity;
        for (const y of cl[i]) {
          const same = pickd.filter(z => z.ap === y.ap).length; if (same + 1 > slotCap(st, y.ap) || pickd.some(z => z.rid === y.rid)) continue; // niciodată aceeași rută
          const fd = Math.abs(y.d - x0.d) / x0.d, fm = Math.abs(y.m - x0.m) / x0.m, fy = Math.abs(y.y - x0.y) / x0.y, fp = Math.abs(y.p[ti] - x0.p[ti]) / x0.p[ti];
          const sc = (fd <= K.starterDistTol * 0.85 && fm <= K.starterDemTol * 0.85 && fy <= 0.08 && fp <= K.starterProfitTol * 0.85 ? 0 : 5 + fd + fm + fy + 2 * fp) + pen(y) + 0.3 * same;
          if (sc < bs) { bs = sc; bi = y; }
        }
        if (!bi) break; pickd.push(bi);
      }
      if (pickd.length < n) continue;
      const dd = dev(pickd, x => x.d), dm = dev(pickd, x => x.m), dy = dev(pickd, x => x.y), dp = dev(pickd, x => x.p[ti]);
      const shared = n - new Set(pickd.map(x => x.ap)).size, ok = dd <= K.starterDistTol && dm <= K.starterDemTol && dy <= 0.08 && dp <= K.starterProfitTol;
      const mp = pickd.reduce((u, x) => u + x.p[ti], 0) / n;
      const sc = (ok ? 0 : 10 + dd + dm + 2 * dp) + pickd.reduce((u, x) => u + pen(x), 0) / n + 0.3 * shared + 2 * Math.abs(mp - K.starterProfitTarget) / K.starterProfitTarget + 4 * Math.max(0, 0.75 * K.starterProfitTarget - mp) / K.starterProfitTarget + R() * 0.05;
      if (!best || sc < best.sc) best = { sc, pick: pickd, ok, ty };
    }
  }
  if (!best) return null;
  return { dst: best.pick.map(x => x.ap), ty: best.ty, info: best.pick, fair: best.ok, sc: best.sc };
}
function starterRoute(st, s, a, b, p) {
  const K = TU(), c = st.c[s], rid = ridOf(a, b), nrm = normalPrice(dist(a, b), a, b);
  if (!hasSlot(st, s, b)) addSlot(st, s, b, false);
  c.r[rid] = { pa: nrm, pb: nrm, qa: 0, qb: 0, t0: st.gt, pr: 0, py: 0, p7: [], f: 0, nc: 0, st0: 1 };
  if (!st.rt[rid]) st.rt[rid] = { t0: r2(st.gt), pio: null, pu: 0, nz: [1, 1] };
  c.st.routes++; c.st.routesMax = Math.max(c.st.routesMax, 1); c.st.longestRoute = Math.max(c.st.longestRoute, dist(a, b));
  if (p && canServe(p.ty, rid)) { p.rid = rid; p.pil = K.starterPilot ? 1 : 0; startFerryOrBoard(st, p); }
}
function starterSpread(st) { // abaterea maximă a profitului estimat/zi al rutelor de start față de medie
  const ph = st.phase; st.phase = "play"; st.mv++;
  const ps = st.ps.map(s => { const c = st.c[s], rid = Object.keys(c.r).find(r => c.r[r].st0), p = st.pl.find(q => q.s === s && q.rid === rid);
    return rid && p ? estimate(st, s, { pid: p.id, rid }).profitDay : 0; });
  st.phase = ph;
  const m = ps.reduce((u, v) => u + v, 0) / Math.max(1, ps.length); if (m <= 0) return 9;
  return Math.max.apply(null, ps.map(v => Math.abs(v - m) / m));
}
function startGame(st, now, R) {
  const K = TU(), v = resolveVotes(st, true) || { dur: st.dur, day: st.dl };
  st.dur = v.dur; st.dl = v.day; const o0 = optOf(st); st.opt = { money: OPT_MONEY.indexOf(v.money) >= 0 ? v.money : o0.money, ev: OPT_EV.indexOf(v.ev) >= 0 ? v.ev : o0.ev };
  st.maxDay = maxDays(st.dur, st.dl, st.ps.length);
  st.m0 = Math.floor(R() * 12);
  for (const s of st.ps) { const c = st.c[s]; if (!c.prof || c.av < 0 || c.col < 0 || !c.co) { const nm = c.name; botProfile(st, s, R); c.name = nm; } }
  const seen = new Set();
  for (const s of st.ps) { const c = st.c[s]; if (seen.has(c.col)) { const f = [0, 1, 2, 3, 4, 5].find(x => !seen.has(x)); c.col = f === undefined ? 0 : f; } seen.add(c.col); }
  // bazele + rutele de start; se reîncearcă până când și PROFITUL estimat/zi al rutelor de start e echitabil (±starterProfitTol)
  const snap = JSON.stringify(st), mv0 = st.mv || 0, restore = js => { const o = JSON.parse(js); for (const k of Object.keys(st)) delete st[k]; Object.assign(st, o); };
  let best = null; const tries = K.starterOn ? K.starterTries : 1;
  for (let t = 0; t < tries; t++) {
    if (t) restore(snap);
    st.mv = mv0 + 1000 * (t + 1); // chei de cache unice per încercare
    let bases = pickBases(st, R), stc = K.starterOn ? pickStarters(st, bases, R) : null;
    for (let u = 0; u < 8 && stc && !stc.fair; u++) { const b2 = pickBases(st, R), s2 = pickStarters(st, b2, R); if (s2 && (s2.fair || s2.sc < stc.sc)) { bases = b2; stc = s2; } } // rute de start echitabile
    if (st.reg && bases[0] && AP(bases[0])) st.reg = AP(bases[0]).cont;
    st.ps.forEach((s, i) => {
      const c = st.c[s]; c.base = bases[i % bases.length]; c.cash = Math.round(K.startCash * startCashMult(st)); addSlot(st, s, c.base, true); // slotul de bază nu ocupă din capacitatea aeroportului
      const p0 = newPlane(st, s, stc ? stc.ty : K.freePlaneType, 0, 0, c.base);
      if (stc && stc.dst[i]) starterRoute(st, s, c.base, stc.dst[i], p0);
      for (let k = 0; k < K.startCards; k++) c.h[drawCard(st, R, true)]++;
      c.of = genPermits(st, s, R, K.offerN); c.tipAt = MIN_DAY / 2;
      c.st.conts = [AP(c.base).cont]; c.st.maxCash = c.cash; c.ready = 1; c.tut = 0;
    });
    if (!stc) break;
    const sp = starterSpread(st);
    if (!best || sp < best.sp) best = { sp, js: JSON.stringify(st), t };
    if (sp <= K.starterProfitTol) break;
  }
  if (best && best.t !== tries - 1 && starterSpread(st) > best.sp) restore(best.js);
  genUsed(st, R);
  st.fi = K.fuelStart; st.day = 1; st.gt = 0; st.phase = "play"; st.run = 1; st.at = now; st.mv++;
  r1Start(st);
  logp(st, "dayStart", { n: 1 });
}

/* ======================= draft ======================= */
function beginDraft(st, now, R) {
  const K = TU(), act = active(st);
  st.run = 0; st.at = now;
  if (act.length < 2) { settleAccounts(st, now, R); if (st.phase !== "end") nextDay(st, now, R); return; }
  const n = act.length * K.draftPicks + K.draftExtra, cards = [];
  for (let i = 0; i < n; i++) cards.push(drawCard(st, R, false));
  const order = act.slice().sort((x, y) => companyValue(st, x) - companyValue(st, y) || st.ps.indexOf(x) - st.ps.indexOf(y));
  const ord = [];
  for (let r = 0; r < K.draftPicks; r++) { const o = r % 2 ? order.slice().reverse() : order; ord.push.apply(ord, o); }
  const wh = {};
  for (const s of act) if (st.c[s].cons && R() < K.consWhisper) wh[s] = Math.floor(R() * n);
  st.dr = { cards, tk: cards.map(() => null), ord, i: 0, t: now + wallMs(st, K.draftIntroSec + K.draftPickSec), t0: now, rv: 0, end: 0, wh, day: st.day, cv: {} };
  st.phase = "draft"; st.mv++;
}
function draftPick(st, seat, i, now, R) {
  const dr = st.dr, K = TU();
  const got = giveCard(st, seat, dr.cards[i]);
  dr.tk[i] = seat; if (got !== dr.cards[i]) dr.cv[i] = got;
  const c = st.c[seat]; c.st.picks++; if (isSpecial(got)) c.st.specialsDrafted++;
  dr.i++;
  while (dr.i < dr.ord.length && st.c[dr.ord[dr.i]].out) dr.i++;
  if (dr.i >= dr.ord.length) endPicks(st, now, R);
  else dr.t = now + wallMs(st, K.draftPickSec);
  st.mv++;
}
function endPicks(st, now, R) {
  const dr = st.dr, K = TU();
  dr.rv = 1; dr.i = dr.ord.length;
  dr.cards.forEach((c, i) => { if (dr.tk[i] === null && isSpecial(c)) st.pool[c] = (st.pool[c] || 0) + 1; });
  dr.end = now + wallMs(st, K.draftRevealSec + K.draftSettleSec);
  settleAccounts(st, now, R);
}
function finishDraft(st, now, R) { st.dr = null; if (st.phase !== "end") nextDay(st, now, R); }

/* ======================= decontare zilnică ======================= */
/* pragul impozitului pe profit: max(taxFree absolut, taxRel × media profitului de ieri al rivalilor activi) → plătește doar cine fuge de ceilalți */
function taxFreeOf(st, s) {
  const K = TU(), o = active(st).filter(x => x !== s && st.c[x].lpf !== undefined).map(x => Math.max(0, st.c[x].lpf));
  const avg = o.length ? o.reduce((u, v) => u + v, 0) / o.length : 0;
  return Math.round(Math.max(K.taxFree, K.taxRel > 0 ? K.taxRel * avg : 0));
}
function grossLimit(st, s) { const K = TU(), c = st.c[s]; return Math.max(K.bankMinLimit, K.bankFrac * Math.max(0, companyValue(st, s))) * clamp(0.4 + K.csLimitK * c.cs, 0.1, 1.5); }
function settleAccounts(st, now, R) {
  const K = TU(), day = st.day;
  for (const s of active(st)) {
    const c = st.c[s];
    const dc = dailyCosts(st, s); c.cash -= dc.total; c.today.cost += dc.total;
    leaseAccrue(st, s);
    const profit = c.today.rev - c.today.cost;
    const taxR = Math.min(1, evTax(st, s) + Math.min(K.crisisTaxMax, K.crisisTax * crisisDays(st)));
    let tax = profit > 0 && taxR > 0 ? Math.round(profit * taxR) : 0;
    const tf = taxFreeOf(st, s);
    if (K.taxRate > 0 && profit - tax > tf) tax += Math.round((profit - tax - tf) * K.taxRate); // impozit doar pe profitul „fugar” (peste prag și peste ×taxRel media rivalilor)
    c.lpf = Math.round(profit); c.lpt = tax;
    c.cash -= tax; c.today.cost += tax;
    let interest = 0, princ = 0;
    const im = evMult(st, "interest", s, true);
    for (const l of c.bl) { const pp = l.p / l.d, it = l.p * l.r * im; c.cash -= pp + it; interest += it; princ += pp; l.p -= pp; l.d--; }
    const before = c.bl.length; c.bl = c.bl.filter(l => l.d > 0 && l.p > 0.5);
    if (c.bl.length < before) c.cs = clamp(c.cs + K.csRepaid * (before - c.bl.length), 0, 100);
    if (princ > 0 && c.cash < 0) c.cs = clamp(c.cs + K.csLate, 0, 100);
    c.today.cost += Math.round(interest);
    c.lsd = { day, rev: Math.round(c.today.rev), flights: Math.round(c.today.cost - dc.total - tax - interest), maint: dc.maint, lease: dc.lease, pilots: dc.pilots, cons: dc.cons, overhead: dc.overhead, tax, interest: Math.round(interest), principal: Math.round(princ) };
  }
  for (const l of st.ln.slice()) if (l.due <= day) {
    const lb = st.c[l.b], ll = st.c[l.l];
    if (!lb.out) lb.cash -= l.rep; if (!ll.out && !lb.out) ll.cash += l.rep;
    st.ln.splice(st.ln.indexOf(l), 1); logp(st, "loanCollect", { s: l.b, o: l.l, a: l.rep });
  }
  for (const s of active(st)) {
    const c = st.c[s];
    c.cash = Math.round(c.cash);
    c.hist.push([day, Math.round(c.today.rev), Math.round(c.today.cost)]); if (c.hist.length > 14) c.hist.shift();
    c.today = { rev: 0, cost: 0 };
    for (const rid in c.r) { const cr = c.r[rid]; cr.p7.push(Math.round(cr.pr)); if (cr.p7.length > K.valRouteAvg) cr.p7.shift(); cr.py = Math.round(cr.pr); cr.pr = 0; cr.f = 0; cr.qa = r2(cr.qa); cr.qb = r2(cr.qb); }
    for (const p of st.pl) if (p.s === s) { p.py = Math.round((p.pt || 0) - planeFixed(st, s, p)); p.pt = 0; } // profitul net de ieri al fiecărui avion
    c.bc = 0; c.st.maxCash = Math.max(c.st.maxCash, c.cash); c.st.routesMax = Math.max(c.st.routesMax, Object.keys(c.r).length);
    c.rep = r3(clamp(c.rep + (3 - c.rep) * K.repRevert, K.repMin, K.repMax));
    if (c.cash < 0) { c.neg++; c.st.daysNegative++; c.cs = clamp(c.cs + K.csNeg, 0, 100); } else c.neg = 0;
  }
  for (const s of active(st)) { // faliment: încă pe minus după graceDays zile, datorie peste limită sau valoare negativă
    const c = st.c[s];
    if (c.cash < 0 && (c.neg > K.negDays || bankDebt(st, s) > K.debtOverLimit * grossLimit(st, s))) bankrupt(st, s, "bankrupt");
  }
  const al = active(st);
  if (al.length) { const lead = al.map(s => [s, companyValue(st, s)]).sort((a, b) => b[1] - a[1])[0][0]; st.c[lead].st.rankFirstDays++; for (const s of al) st.c[s].st.maxValue = Math.max(st.c[s].st.maxValue, companyValue(st, s)); }
  r1Settle(st, R); // istoric valoare, raport de zi, ziarul de mâine
  let fi = (st.fi || 1) * (1 + (R() * 2 - 1) * K.fuelVol); fi += (1 - fi) * K.fuelRevert;
  st.fi = r3(clamp(fi, K.fuelMin, K.fuelMax));
  if (crisisDays(st) > 0) st.cf = r3((st.cf || 1) * (1 + K.crisisFuel));
  st.ret = st.ret.filter(x => { if (x[1] <= day + 1) { st.pool[x[0]] = (st.pool[x[0]] || 0) + 1; return false; } return true; });
  st.pacts = st.pacts.filter(p => p.u > day && !st.c[p.a].out && !st.c[p.b].out);
  for (const rid in st.rt) { const r = st.rt[rid]; r.nz = [r3(1 + (R() * 2 - 1) * K.dailyNoise), r3(1 + (R() * 2 - 1) * K.dailyNoise)]; }
  const over = (st.maxDay && day >= st.maxDay) || al.length <= (st.ps.length > 1 ? 1 : 0) || (!st.maxDay && day >= K.noLimitMaxDays);
  if (over) endGame(st, now);
  st.mv++;
}
function nextDay(st, now, R) {
  const K = TU(), day = st.day;
  st.day = day + 1; st.gt = Math.max(st.gt, day * MIN_DAY); st.ud = {};
  st.ev = st.ev.filter(e => e.u >= st.day);
  if (st.day - (st.umd || 0) >= K.usedDays) genUsed(st, R);
  rollEvents(st, R);
  st.phase = "play"; st.pz = null; st.run = 1; st.at = now; st.mv++;
  logp(st, "dayStart", { n: st.day });
}
function rollEvents(st, R) {
  const K = TU(), d = D(); if (st.day < K.evFirstDay || st.ev.length >= K.evMaxActive) return;
  const cd = crisisDays(st);
  if (R() >= (K.evChance + K.crisisEvAdd * cd) * evFreqMult(st)) return; // frecvența votată la start
  const month1 = monthOf(st) + 1;
  const evs = d.EVENTS.filter(e => !st.ev.some(x => x.id === e.id) && (!e.months || e.months.indexOf(month1) >= 0) && (!e.minDay || st.day >= e.minDay));
  if (!evs.length) return;
  const sv = servedSet(st), wt = e => (e.w || 1) * (e.crisis && cd > 0 ? 2 : 1) * evRel(e, sv);
  let y = R() * evs.reduce((a, e) => a + wt(e), 0), def = evs[evs.length - 1];
  for (const e of evs) { y -= wt(e); if (y <= 0) { def = e; break; } }
  triggerEvent(st, def, R);
}
function triggerEvent(st, def, R) {
  const d = D(), al = active(st), sc = def.scope || { type: "global" };
  let tt = sc.type || "global", tg = null, loc = "";
  const served = new Set(); for (const s of al) network(st, s).forEach(a => served.add(a));
  const sv = Array.from(served);
  if (tt === "airport") {
    let cand = d.AIRPORTS.filter(a => (!sc.minSize || a.size >= sc.minSize) && (!sc.tag || (a.tags || []).indexOf(sc.tag) >= 0) && (!sc.ids || sc.ids.indexOf(a.id) >= 0));
    if (!cand.length) return;
    const near = shuffle(R, cand.filter(a => served.has(a.id))), far = shuffle(R, cand.filter(a => !served.has(a.id)));
    const nn = sc.n || 1; tg = near.concat(far).slice(0, nn).map(a => a.id);
    if (near.length && R() >= evLocal()) tg = shuffle(R, cand.slice()).slice(0, nn).map(a => a.id); // uneori și în altă parte
    loc = tg.map(x => AP(x).n).join(", ");
  } else if (tt === "region") {
    const regs = (sc.regs || []).filter(r => d.AIRPORTS.some(a => a.reg === r)); if (!regs.length) return;
    const pref = regs.filter(r => sv.some(a => AP(a).reg === r)); tg = pick(R, pref.length && R() < evLocal() ? pref : regs); loc = (d.REGIONS[tg] && d.REGIONS[tg].n) || tg;
  } else if (tt === "cont") {
    const conts = sc.conts && sc.conts.length ? sc.conts : Array.from(new Set(d.AIRPORTS.map(a => a.cont)));
    const pref = conts.filter(c => sv.some(a => AP(a).cont === c)); tg = pick(R, pref.length && R() < evLocal() ? pref : conts); loc = (d.CONTINENTS[tg] && d.CONTINENTS[tg].n) || tg;
  } else if (tt === "tag") { tg = sc.tag || "plajă"; loc = (d.TAGS[tg] && d.TAGS[tg].n) || tg; }
  else if (tt === "company") {
    if (!al.length) return;
    const vals = al.map(s => [s, companyValue(st, s)]).sort((a, b) => b[1] - a[1]);
    tg = sc.pick === "leader" ? vals[0][0] : sc.pick === "last" ? vals[vals.length - 1][0] : pick(R, al); loc = st.c[tg].co;
  } else { tt = "global"; loc = "toată lumea"; }
  st.evn++;
  const mins = Array.isArray(def.mins) ? Math.round(def.mins[0] + R() * (def.mins[1] - def.mins[0])) : +def.mins || 0; // evenimente scurte, în minute de joc
  const days = mins > 0 ? 1 + Math.floor(((st.gt % MIN_DAY) + mins) / MIN_DAY) : def.days !== undefined ? def.days : 1;
  const ev = { id: def.id, k: st.evn, tt, tg, s0: st.day, u: days > 0 ? st.day + days - 1 : st.day - 1, ex: [], loc };
  if (mins > 0) { ev.ue = st.gt + mins; ev.mn = mins; }
  const fx = def.fx || {};
  const hitCo = s => tt === "global" || (tt === "company" && tg === s) || (tt !== "company" && Array.from(network(st, s)).some(a => evHitsAp(ev, a)));
  if (def.neg) for (const s of al) { const c = st.c[s]; if (c.sx.ins && hitCo(s)) { spendSpecial(st, s, "ins"); ev.ex.push(s); c.st.insured++; logp(st, "special", { s, card: "insurance", ev: def.id }); } }
  for (const s of al) {
    if (!hitCo(s) || exempt(ev, s)) continue; const c = st.c[s]; c.st.events++;
    if (tt !== "global" && tt !== "company") continue; // efectele unice doar pentru companiile vizate direct
    if (fx.cash) c.cash += fx.cash;
    if (fx.cashPct && c.cash > 0) c.cash += Math.round(c.cash * fx.cashPct);
    if (fx.cards) for (let i = 0; i < fx.cards; i++) c.h[drawCard(st, R, true)]++;
  }
  if (fx.slots && days <= 0 && tt === "airport") for (const ap of tg) st.cap[ap] = (st.cap[ap] || 0) + fx.slots;
  if (days > 0) st.ev.push(ev);
  logp(st, "event", { ev: def.id, loc, s: tt === "company" ? tg : undefined, ek: ev.k });
  st.mv++;
}
function bankrupt(st, s, why) {
  const c = st.c[s]; if (c.out) return;
  c.out = st.day; c.st.bankrupt = 1;
  // lichidare: din bani + avioane se plătesc ÎNTÂI jucătorii care i-au împrumutat bani (proporțional); banca ia doar ce rămâne
  // compensare întâi: dacă și tu îi datorai lui, datoriile reciproce se anulează una cu alta
  for (const o of st.ps) { if (o === s) continue;
    const mine = st.ln.filter(l => l.b === s && l.l === o), his = st.ln.filter(l => l.l === s && l.b === o);
    let a = mine.reduce((x, l) => x + l.rep, 0), b = his.reduce((x, l) => x + l.rep, 0), m = Math.min(a, b);
    if (m <= 0) continue;
    for (const arr of [mine, his]) { let left = m; for (const l of arr) { const d = Math.min(l.rep, left); l.rep -= d; left -= d; } }
    st.ln = st.ln.filter(l => l.rep > 0); }
  { const owed = st.ln.filter(l => l.b === s && st.c[l.l] && !st.c[l.l].out), tot = owed.reduce((a, l) => a + l.rep, 0);
    if (tot > 0) {
      let planes = 0; for (const p of st.pl) if (p.s === s) planes += planeValue(st, p);
      const pot = Math.max(0, Math.round(c.cash + planes)), f = Math.min(1, pot / tot);
      for (const l of owed) { const a = Math.round(l.rep * f); if (a > 0) { st.c[l.l].cash += a; logp(st, "loanCollect", { s, o: l.l, a }); } }
    } }
  st.pl = st.pl.filter(p => p.s !== s);
  for (const ap of Object.keys(st.sl)) remSlot(st, s, ap);
  for (const rid of Object.keys(c.r)) { delete c.r[rid]; if (!servers(st, rid).length) delete st.rt[rid]; }
  for (const id in c.sx) st.pool[id] = (st.pool[id] || 0) + c.sx[id];
  c.sx = {}; c.pm = []; c.of = null; c.bl = []; c.hubs = []; c.h = [0, 0, 0, 0, 0]; c.cons = 0; c.fz = null; c.fx = []; c.cash = 0;
  st.ln = st.ln.filter(l => l.b !== s); // datoriile CĂTRE el rămân: cine i-a datorat plătește la scadență (banii merg la bancă)
  st.pacts = st.pacts.filter(p => p.a !== s && p.b !== s);
  for (const iss in st.sh) { if (st.sh[iss][s]) delete st.sh[iss][s]; }
  delete st.sh[s];
  for (const o of st.ps) { const fz = st.c[o].fz; if (fz && fz.by === s) fz.by = null; }
  if (st.ng) { ngNorm(st.ng); st.ng.inv = st.ng.inv.filter(x => x.s !== s);
    if (st.ng.ps.indexOf(s) >= 0) {
      if (st.ng.ps.length > 2 && !st.ng.res) { st.ng.ps = st.ng.ps.filter(x => x !== s); if (st.ng.off && st.ng.off.parts.indexOf(s) >= 0) st.ng.off = null; st.ng.a = st.ng.ps[0]; st.ng.b = st.ng.ps[1]; }
      else { st.lastNg = { id: st.ng.id, a: st.ng.a, b: st.ng.b, ps: st.ng.ps.slice(), res: "close" }; st.ng = null; if (st.phase === "nego") st.phase = "play"; }
    } }
  logp(st, why === "resign" ? "resign" : "bankrupt", { s });
  st.mv++;
}
function endGame(st, now) {
  st.phase = "end"; st.run = 0; st.at = now; st.pz = null; st.ng = null;
  if (st.dr && !st.dr.rv) st.dr = null;
  const vals = finalValuation(st), ach = {}, d = D();
  for (const v of vals) {
    const c = st.c[v.seat];
    const ctx = { rank: v.rank, players: st.ps.length, won: v.rank === 1 && !c.out, survived: !c.out, value: v.total, dur: st.dur };
    let ids = [];
    if (d.checkAch) { try { ids = d.checkAch(Object.assign({}, c.st), ctx) || []; } catch (e) { ids = []; } }
    ach[v.seat] = ids;
  }
  const win = vals.length ? vals[0].seat : null;
  st.res = { vals, ach, win, day: st.day, hist: st.vh || null };
  st.mv++;
  logp(st, "gameEnd", { s: win, a: vals.length ? vals[0].total : 0 });
}
function finalValuation(st) {
  const out = [];
  for (const s of st.ps) { // aceiași pași ca valoarea live (valueSteps): totalul = companyValue
    const c = st.c[s], steps = valueSteps(st, s);
    out.push({ seat: s, steps, total: steps.reduce((a, x) => a + x.v, 0), out: c.out || 0 });
  }
  out.sort((x, y) => {
    if (!!x.out !== !!y.out) return x.out ? 1 : -1;
    if (x.out && y.out) return y.out - x.out; // a ieșit mai târziu = mai bine
    return y.total - x.total;
  });
  out.forEach((x, i) => { x.rank = i + 1; });
  return out;
}

/* ======================= acțiuni ======================= */
function guardOps(st, s, allowFrozen) {
  const c = st.c[s];
  if (st.phase !== "play" && st.phase !== "nego") return E(st.phase === "draft" ? "Acum e draftul de la final de zi." : st.phase === "setup" ? "Jocul n-a început încă." : "Acțiunea nu e posibilă acum.");
  if (c.out) return E("Compania ta a ieșit din joc.");
  if (st.pz && st.phase === "play") return E("Jocul e pe pauză: acum poți doar să privești sau să negociezi.");
  if (st.phase === "nego" && st.ng) return E(negoBusyMsg(st, s)); // timpul e oprit pentru toți: doar se privește
  if (c.fz && !allowFrozen) return E("Compania ta e înghețată! Poți doar să privești (sau să folosești Spărgătorul de gheață).");
  return null;
}
const myPlane = (st, s, pid) => st.pl.find(p => p.id === pid && p.s === s);
const ACT = {};
ACT.prof = (st, s, a) => {
  if (st.phase !== "setup") return E("Profilul se alege înainte de start.");
  const c = st.c[s], av = a.av | 0, col = a.color !== undefined ? a.color | 0 : a.col | 0;
  if (av < 0 || av > 9) return E("Avatar invalid.");
  if (col < 0 || col > 5) return E("Culoare invalidă.");
  if (st.ps.some(x => x !== s && st.c[x].col === col && st.c[x].prof)) return E("Culoarea e deja luată.");
  const name = String(a.name || c.name || "").trim().slice(0, 18), co = String(a.co || "").trim().slice(0, 24);
  if (!name) return E("Scrie un nume."); if (!co) return E("Scrie numele companiei.");
  const av0 = D().AVATARS.find(x => x.id === av);
  c.av = av; c.g = a.g === "m" || a.g === "f" ? a.g : (av0 && av0.g) || (av < 5 ? "m" : "f"); c.name = name; c.co = co; c.col = col; c.prof = 1;
  return OK;
};
ACT.vote = (st, s, a) => {
  if (st.phase !== "setup") return E("Votul s-a încheiat.");
  const dur = a.dur | 0, day = a.day | 0;
  if ([60, 120, 180, 0].indexOf(dur) < 0) return E("Durată invalidă."); if ([1, 2, 3].indexOf(day) < 0) return E("Lungimea zilei e invalidă.");
  const pv = st.c[s].vote || {}, money = a.money !== undefined ? a.money : pv.money || "normal", ev = a.ev !== undefined ? a.ev : pv.ev || "normal";
  if (OPT_MONEY.indexOf(money) < 0) return E("Suma de start e invalidă."); if (OPT_EV.indexOf(ev) < 0) return E("Frecvența evenimentelor e invalidă.");
  st.c[s].vote = { dur, day, money, ev }; return OK;
};
ACT.ready = (st, s, a) => {
  if (st.phase !== "setup") return E("Jocul a început deja.");
  const c = st.c[s]; if (a.on !== false && !c.prof) return E("Alege-ți întâi avatarul, numele și compania.");
  c.ready = a.on === false ? 0 : 1; if (c.ready) c.tut = 0; if (!c.ready) st.su.at = 0; return OK;
};
/* tutorialul de dinainte de joc: {step, of} = „în tutorial (pasul step/of)”; {off:true} / {step:0} = a ieșit (nu e încă „gata”) */
ACT.tut = (st, s, a) => {
  if (st.phase !== "setup") return OK;
  const c = st.c[s]; if (c.bot) return E("Boții nu fac tutorialul.");
  const step = a.off ? 0 : Math.max(0, Math.min(999, a.step | 0)), of = Math.max(1, Math.min(999, (a.of | 0) || 1));
  if (!step) { c.tut = 0; return OK; }
  c.tut = { step: Math.min(step, Math.max(of, step)), of: Math.max(of, step) }; c.ready = 0; st.su.at = 0; return OK;
};
const tutBusy = st => humans(st).filter(x => st.c[x].tut && !st.c[x].out);
ACT.start = (st, s, a, now, R) => {
  if (st.phase !== "setup") return E("Jocul a început deja.");
  const tb = tutBusy(st); if (tb.length) return E("Încă se joacă tutorialul: " + tb.map(x => st.c[x].name).join(", ") + ".");
  if (!st.ps.every(x => st.c[x].ready)) return E("Nu sunt toți gata.");
  startGame(st, now, R); return OK;
};
ACT.pause = (st, s, a, now, R) => {
  if (st.c[s].bot) return E("Botul nu poate pune pauză.");
  if (st.phase !== "play") return E("Pauza e posibilă doar în timpul zilei.");
  if (a.on) { if (st.pz) return E("Jocul e deja pe pauză."); stopClock(st, now, R); st.pz = { s, at: now }; }
  else { if (!st.pz) return E("Jocul nu e pe pauză."); st.pz = null; startClock(st, now); }
  return OK;
};
ACT.resign = (st, s, a, now, R) => {
  if (st.phase === "setup" || st.phase === "end") return E("Nu poți abandona acum.");
  if (st.c[s].out) return E("Ești deja în afara jocului.");
  bankrupt(st, s, "resign");
  if (st.dr && !st.dr.rv) { while (st.dr.i < st.dr.ord.length && st.c[st.dr.ord[st.dr.i]].out) st.dr.i++; if (st.dr.i >= st.dr.ord.length) endPicks(st, now, R); }
  if (st.phase !== "end" && active(st).length <= 1 && st.ps.length > 1) endGame(st, now);
  else if (st.phase === "play") startClock(st, now);
  return OK;
};
ACT.buyPlane = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], K = TU(), mine = st.pl.filter(p => p.s === s);
  if (mine.length >= K.maxPlanes) return E("Ai atins numărul maxim de avioane (" + K.maxPlanes + ").");
  if (a.used !== undefined && a.used !== null && a.used !== false) {
    const u = st.um.find(x => x.id === a.used); if (!u) return E("Avionul second-hand nu mai e pe piață.");
    if (c.cash < u.pr) return E("Nu ai destui bani.");
    c.cash -= u.pr; st.um = st.um.filter(x => x !== u); newPlane(st, s, u.ty, u.ag, 0, c.base).pp = u.pr; c.st.usedBought++; return OK;
  }
  const ty = normPlaneType(a.type); if (!validTy(ty)) return E("Tip de avion invalid.");
  if (a.lease) {
    if (mine.filter(p => p.ls).length >= K.maxLeased) return E("Poți avea cel mult " + K.maxLeased + " avioane în leasing.");
    newPlane(st, s, ty, 0, 1, c.base); c.st.leased++; return OK;
  }
  const pr = planeT(ty).price; if (c.cash < pr) return E("Nu ai destui bani pentru acest avion.");
  c.cash -= pr; newPlane(st, s, ty, 0, 0, c.base); c.st.planesBought++; return OK;
};
ACT.buyout = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const p = myPlane(st, s, a.pid), c = st.c[s]; if (!p) return E("Avion inexistent.");
  if (!p.ls) return E("Avionul e deja al tău.");
  const pr = buyoutPrice(st, p); if (c.cash < pr) return E("Nu ai destui bani pentru răscumpărare (" + pr.toLocaleString("ro-RO") + " €).");
  c.cash -= pr; p.ls = 0; delete p.lpd; p.pp = Math.max(1, pr); c.st.planesBought++; logp(st, "buyout", { s, x: p.id, a: pr }); return OK;
};
ACT.sellPlane = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const p = myPlane(st, s, a.pid), K = TU(); if (!p) return E("Avion inexistent.");
  if (p.m === 2 || p.m === 3) return E("Avionul e în zbor. Îl poți vinde după aterizare.");
  deboard(st, p);
  const c = st.c[s];
  if (p.ls) { const fee = Math.round(planeT(p.ty).lease * K.leaseReturnDays); c.cash -= fee; c.today.cost += fee; }
  else { c.cash += Math.round(planeValue(st, p) * K.sellMult); c.st.planesSold++; }
  st.pl = st.pl.filter(x => x !== p); return OK;
};
ACT.assign = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const p = myPlane(st, s, a.pid); if (!p) return E("Avion inexistent.");
  const c = st.c[s], cr = c.r[a.rid]; if (!cr) return E("Nu operezi această rută.");
  if (a.via) { // rută cu escală
    if (!c.r[a.via]) return E("Nu operezi ruta de legătură.");
    const w = chainCheck(p.ty, a.rid, a.via); if (w) return E(w);
    if (p.ch && p.ch.indexOf(a.rid) >= 0 && p.ch.indexOf(a.via) >= 0 && !p.ud) return E("Avionul zboară deja această rută cu escală.");
    const onLeg = p.rid === a.rid || p.rid === a.via;
    p.ch = [a.rid, a.via];
    if (p.m === 2 || p.m === 3) { if (!onLeg) { if (p.m === 2 && p.rid && !p.rid0) p.rid0 = p.rid; p.rid = a.rid; } p.ud = 0; return OK; }
    if (onLeg && p.m === 1 && !p.ud) return OK; // deja la îmbarcare pe una din etape: continuă
    deboard(st, p); p.rid = a.rid; p.ud = 0; startFerryOrBoard(st, p); return OK;
  }
  const [ra, rb] = ridEnds(a.rid), d = dist(ra, rb), pt = planeT(p.ty);
  if (pt.range < d) return E("Autonomia avionului (" + pt.range + " km) e prea mică pentru " + d + " km.");
  if ((pt.minSize || 1) > Math.min(AP(ra).size, AP(rb).size)) return E(pt.n + " nu poate ateriza pe aeroporturi mici.");
  if (p.rid === a.rid && !p.ud && !p.ch) return E("Avionul e deja pe această rută.");
  if (p.ch) { delete p.ch; if (p.rid === a.rid && !p.ud) return OK; }
  if (p.m === 2 || p.m === 3) { if (p.m === 2 && p.rid && !p.rid0) p.rid0 = p.rid; p.rid = a.rid; p.ud = 0; return OK; }
  deboard(st, p); p.rid = a.rid; p.ud = 0; startFerryOrBoard(st, p); return OK;
};
ACT.unassign = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const p = myPlane(st, s, a.pid); if (!p) return E("Avion inexistent.");
  if (!p.rid) return E("Avionul nu are rută.");
  delete p.ch;
  if (p.m === 3) { p.rid = null; return OK; }
  if (p.m === 2) { if (!p.rid0) p.rid0 = p.rid; p.ud = 1; return OK; }
  deboard(st, p); p.rid = null; p.m = 0; p.go = 0; return OK;
};
ACT.depart = (st, s, a, now, R) => {
  const g = guardOps(st, s); if (g) return g;
  const p = myPlane(st, s, a.pid); if (!p) return E("Avion inexistent.");
  if (p.m !== 1) return E("Avionul nu e la îmbarcare.");
  if (isClosed(st, p.ap, s) || isClosed(st, otherEnd(p.rid, p.ap), s)) return E("Aeroportul e închis. Decolarea nu e posibilă acum.");
  p.man = 1;
  if (st.phase === "play" && st.run) { syncTime(st, now, R); if (p.m === 1 && canDepartNow(st, p)) { if (tryDepart(st, p, R)) return OK; p.go = 1; return OK; } }
  p.go = 1; return OK; // pleacă singur imediat ce e gata (îmbarcare minimă / reluarea timpului)
};
ACT.pilot = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const p = myPlane(st, s, a.pid); if (!p) return E("Avion inexistent.");
  p.pil = a.on ? 1 : 0; trackFleet(st, s); return OK;
};
ACT.pilotMin = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const p = myPlane(st, s, a.pid); if (!p) return E("Avion inexistent.");
  const seats = planeT(p.ty).seats;
  if (a.n === null || a.n === 0 || a.n === false) { delete p.pm; delete p.sub; return OK; } // revine la regula implicită
  const n = Math.round(+a.n); if (!(n >= 1 && n <= seats)) return E("Minimul trebuie să fie între 1 și " + seats + " pasageri.");
  p.pm = n; delete p.pmT; return OK;
};
ACT.price = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], K = TU(), rid = a.rid, cr = c.r[rid]; if (!cr) return E("Nu operezi această rută.");
  const dir = a.dir || "both"; if (["ab", "ba", "both"].indexOf(dir) < 0) return E("Direcție invalidă.");
  const nrm = routeNormal(rid), p = Math.round(+a.p);
  const lo = Math.max(K.priceMinAbs, Math.round(nrm * K.priceMinMult)), hi = Math.round(nrm * K.priceMaxMult);
  if (!(p >= lo) || p > hi) return E("Prețul trebuie să fie între " + lo + " € și " + hi + " €.");
  // pasagerii deja la coadă au venit la prețul vechi: la o scumpire o parte renunță (altfel coada de 1 zi s-ar încasa la noul preț)
  const [ea, eb] = ridEnds(rid);
  if (dir !== "ba" && p > cr.pa) cr.qa *= clamp(priceResp(st, ea, eb, p, nrm) / priceResp(st, ea, eb, cr.pa, nrm), 0, 1);
  if (dir !== "ab" && p > cr.pb) cr.qb *= clamp(priceResp(st, eb, ea, p, nrm) / priceResp(st, eb, ea, cr.pb, nrm), 0, 1);
  if (dir !== "ba") cr.pa = p; if (dir !== "ab") cr.pb = p;
  st.mv++;
  return OK;
};
ACT.drawPermits = (st, s, a, now, R) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], K = TU(); if (c.of) return E("Alege întâi din permisele oferite.");
  if (c.pm.length >= K.maxPermits) return E("Ai deja " + K.maxPermits + " permise deschise.");
  const of = genPermits(st, s, R, K.offerN); if (!of.length) return E("Nu mai există permise disponibile.");
  c.of = of; return OK;
};
ACT.keepPermits = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], K = TU(); if (!c.of) return E("Nu ai permise de ales.");
  const ids = Array.isArray(a.ids) ? a.ids : []; const keep = c.of.filter(p => ids.indexOf(p.id) >= 0);
  if (!keep.length) return E("Păstrează cel puțin un permis.");
  if (c.pm.length + keep.length > K.maxPermits) return E("Poți avea cel mult " + K.maxPermits + " permise deschise.");
  c.pm = c.pm.concat(keep); c.of = null; return OK;
};
ACT.discardPermit = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], p = c.pm.find(x => x.id === a.id); if (!p) return E("Permis inexistent.");
  c.pm = c.pm.filter(x => x !== p); c.cash -= TU().discardPenalty; c.today.cost += TU().discardPenalty; return OK;
};
function doBuild(st, s, a, fast) {
  const K = TU(), c = st.c[s], p = c.pm.find(x => x.id === a.permitId); if (!p) return E("Permis inexistent.");
  const rid = ridOf(p.a, p.b); if (c.r[rid]) return E("Operezi deja această rută.");
  if (Object.keys(c.r).length >= K.maxRoutes) return E("Ai atins numărul maxim de rute (" + K.maxRoutes + ").");
  const nd = permitNeed(c, p, fast);
  let pay;
  if (Array.isArray(a.cards) && a.cards.length === 5) {
    pay = a.cards.map(x => Math.max(0, x | 0));
    for (let i = 0; i < 5; i++) if (pay[i] > c.h[i]) return E("Nu ai cărțile alese.");
    let gap = 0; for (let i = 0; i < 4; i++) { if (pay[i] > nd.k[i]) return E("Ai ales prea multe cărți " + CARD_NAMES[i] + "."); gap += nd.k[i] - pay[i]; }
    if (pay[4] !== gap) return E("Cărțile alese nu acoperă exact costul (Jokerii completează golurile).");
  } else if (a.cards && typeof a.cards === "object" && !Array.isArray(a.cards)) {
    const arr = [0, 0, 0, 0, 0]; for (const k in a.cards) { const t = normCardType(k); if (t >= 0 && t <= 4) arr[t] += Math.max(0, a.cards[k] | 0); }
    return doBuild(st, s, Object.assign({}, a, { cards: arr }), fast);
  } else { if (!nd.ok) return E("Îți lipsesc cărți pentru acest permis."); pay = autoPay(c, nd.k); }
  const sn = slotNeeds(st, s, p.a, p.b);
  for (const x of sn) if (!x.ok) return E("Nu există slot liber la " + AP(x.ap).n + ".");
  const cost = sn.reduce((t2, x) => t2 + x.price, 0) + K.routeBuildFee; if (c.cash < cost) return E("Nu ai destui bani pentru sloturi (" + cost + " €).");
  for (let i = 0; i < 5; i++) c.h[i] -= pay[i];
  c.cash -= cost; for (const x of sn) { addSlot(st, s, x.ap, false); c.st.slots++; }
  c.pm = c.pm.filter(x => x !== p);
  const nrm = normalPrice(p.d, p.a, p.b), ncards = pay.reduce((u, v) => u + v, 0);
  c.r[rid] = { pa: nrm, pb: nrm, qa: 0, qb: 0, t0: st.gt, pr: 0, py: 0, p7: [], f: 0, nc: ncards };
  let pio = false;
  if (!st.rt[rid]) { st.rt[rid] = { t0: r2(st.gt), pio: s, pu: r2(st.gt + K.pioneerDays * MIN_DAY), nz: [1, 1] }; pio = true; c.rep = clamp(c.rep + K.pioneerRep, K.repMin, K.repMax); c.st.pioneer++; }
  c.st.routes++; c.st.cardsBuilt += ncards; c.st.longestRoute = Math.max(c.st.longestRoute, p.d); c.st.routesMax = Math.max(c.st.routesMax, Object.keys(c.r).length);
  for (const ap of [p.a, p.b]) addUniq(c.st.conts, AP(ap).cont);
  logp(st, pio ? "buildPioneer" : "build", { s, x: p.a, y: p.b });
  if (!pio) rivalIn(st, s, rid);
  return OK;
}
ACT.build = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  if (a.fast) { if (!st.c[s].sx.fast) return E("Nu ai Construcție rapidă."); const r = doBuild(st, s, a, true); if (r.ok) spendSpecial(st, s, "fast"); return r; }
  return doBuild(st, s, a, false);
};
ACT.slot = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], ap = a.ap; if (!AP(ap)) return E("Aeroport inexistent.");
  if (hasSlot(st, s, ap)) return E("Ai deja un slot aici."); if (!slotFree(st, ap)) return E("Aeroportul e plin.");
  const pr = slotPrice(ap); if (c.cash < pr) return E("Nu ai destui bani.");
  c.cash -= pr; addSlot(st, s, ap, false); c.st.slots++; return OK;
};
ACT.hub = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const K = TU(), c = st.c[s], ap = a.ap; if (!AP(ap)) return E("Aeroport inexistent.");
  const it = hubItem(st, s, ap, ""); if (!it.ok) return E(it.why + ".");
  const pr = it.price;
  c.cash -= pr; c.hubs.push(ap); addSlot(st, s, ap, true); c.st.hubs++; logp(st, "hub", { s, x: ap }); return OK;
};
/* huburi: preț, efect și motivul pentru care nu se poate (UI: fiecare buton arată prețul și o linie de efect) */
function hubItem(st, s, ap, gw) {
  const K = TU(), c = st.c[s], a = AP(ap); if (!a) return null;
  const price = K.hubPrice[a.size] || 0, routes = Object.keys(c.r).filter(r => ridEnds(r).indexOf(ap) >= 0).length;
  const it = { ap, n: a.n, size: a.size, price, routes, fee: K.hubFeeMult, transit: K.hubTransit, slots: 1, have: c.hubs.indexOf(ap) >= 0 };
  it.why = it.have ? "Ai deja hub aici" : gw || (c.hubs.length >= K.maxHubs ? "Ai deja " + K.maxHubs + " huburi (maxim)" : !hasSlot(st, s, ap) ? "Ai nevoie de un slot aici"
    : c.cash < price ? "Îți lipsesc " + Math.round(price - c.cash).toLocaleString("ro-RO") + " €" : "");
  it.ok = !it.why;
  it.effect = "Taxe de aterizare −" + Math.round((1 - K.hubFeeMult) * 100) + "% aici, pasageri în tranzit ×" + String(K.hubTransit).replace(".", ",") + ", slotul tău nu mai ocupă loc";
  return it;
}
function hubInfo(st, s, ap) {
  const K = TU(), c = st.c[s]; if (!c) return null; const g = guardOps(st, s), gw = g ? g.err : "";
  if (ap) return hubItem(st, s, ap, gw);
  const items = Object.keys(st.sl).filter(x => hasSlot(st, s, x) && c.hubs.indexOf(x) < 0).map(x => hubItem(st, s, x, gw)).filter(Boolean)
    .sort((x, y) => y.routes - x.routes || y.size - x.size || (x.ap < y.ap ? -1 : 1)).slice(0, 12);
  return { have: c.hubs.slice(), max: K.maxHubs, left: Math.max(0, K.maxHubs - c.hubs.length), prices: K.hubPrice.slice(), fee: K.hubFeeMult, transit: K.hubTransit, items };
}
function invInfo(st, s) {
  const K = TU(), I = K.INV, c = st.c[s], iv = ivOf(c), g = guardOps(st, s), gw = g ? g.err : "";
  const why = pr => gw || (pr > c.cash ? "Nu ai destui bani" : "");
  const bmax = I.base.price.length, bpr = iv.b < bmax ? I.base.price[iv.b] : null;
  const base = { lvl: iv.b, max: bmax, price: bpr, demand: I.base.demand, fee: I.base.fee, slots: I.base.slots };
  base.why = bpr === null ? "Nivel maxim atins" : why(bpr); base.ok = !base.why;
  const cand = c.base ? Object.keys(st.sl).filter(ap => hasSlot(st, s, ap) && AP(ap) && AP(ap).size >= (I.term.minSize || 3) && iv.t.indexOf(ap) < 0).sort() : [];
  const term = { have: iv.t.slice(), max: I.term.max, price: I.term.price, cand, share: I.term.share, stars: I.term.stars };
  term.why = iv.t.length >= I.term.max ? "Ai deja " + I.term.max + " terminale" : !cand.length ? "Ai nevoie de un slot pe un aeroport mare" : why(I.term.price); term.ok = !term.why;
  const eco = allTypes().map(ty => { const pr = I.eco.price[ty] || Math.round(planeT(ty).price * 0.6 / 100000) * 100000, o = { ty, name: planeT(ty).n, have: !!iv.e[ty], price: pr, fuel: I.eco.fuel }; o.why = o.have ? "Ai deja Flotă eco" : why(pr); o.ok = !o.why; return o; });
  const mnt = { have: !!iv.m, price: I.mnt.price, maint: I.mnt.maint, breakdown: I.mnt.breakdown, dep: I.mnt.dep };
  mnt.why = mnt.have ? "Ai deja Centrul de mentenanță" : why(I.mnt.price); mnt.ok = !mnt.why;
  return { spent: iv.sp || 0, value: invValue(st, c), valueMult: I.valueMult, base, term, eco, mnt };
}
ACT.invest = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const K = TU(), I = K.INV, c = st.c[s], info = invInfo(st, s);
  const iv = c.iv = c.iv || { b: 0, t: [], e: [], m: 0, sp: 0 };
  const k = a.k || a.kind || a.type;
  let pr = 0, y;
  if (k === "base") { if (!info.base.ok) return E(info.base.why); pr = info.base.price; iv.b++; y = iv.b; }
  else if (k === "term") {
    const ap = a.ap; if (!AP(ap)) return E("Alege un aeroport.");
    if (iv.t.length >= I.term.max) return E("Ai deja " + I.term.max + " terminale.");
    if (iv.t.indexOf(ap) >= 0) return E("Ai deja terminal aici.");
    if (AP(ap).size < (I.term.minSize || 3)) return E("Terminalul propriu se construiește doar pe un aeroport mare.");
    if (!hasSlot(st, s, ap)) return E("Ai nevoie de un slot pe acest aeroport.");
    pr = I.term.price; if (c.cash < pr) return E("Nu ai destui bani."); iv.t.push(ap); y = ap;
  } else if (k === "eco") {
    const ty = normPlaneType(a.ty !== undefined ? a.ty : a.plane); if (!validTy(ty)) return E("Tip de avion invalid.");
    const o = info.eco[ty]; if (!o.ok) return E(o.why); pr = o.price; iv.e[ty] = 1; y = ty;
  } else if (k === "mnt") { if (!info.mnt.ok) return E(info.mnt.why); pr = info.mnt.price; iv.m = 1; }
  else return E("Investiție necunoscută.");
  c.cash -= pr; iv.sp = (iv.sp || 0) + pr; (iv.l = iv.l || []).push([pr, st.day || 1]); c.st.invest = (c.st.invest || 0) + pr;
  logp(st, "invest", { s, x: k, y }); return OK;
};
ACT.ghiseu = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], K = TU(); let give = a.give;
  if (Array.isArray(give) && (give.length !== 5 || give.some(x => typeof x === "string"))) { const arr = [0, 0, 0, 0, 0]; for (const t of give) { const i = normCardType(t); if (i >= 0 && i <= 4) arr[i]++; } give = arr; }
  else if (give && !Array.isArray(give) && typeof give === "object") { const arr = [0, 0, 0, 0, 0]; for (const k in give) { const i = normCardType(k); if (i >= 0 && i <= 4) arr[i] += give[k] | 0; } give = arr; }
  if (!Array.isArray(give)) return E("Alege " + K.ghiseuN + " cărți.");
  give = give.map(x => Math.max(0, x | 0)); const get = normCardType(a.get);
  if (give.reduce((x, y) => x + y, 0) !== K.ghiseuN) return E("Trebuie exact " + K.ghiseuN + " cărți.");
  if (!(get >= 0 && get <= 3)) return E("Poți primi doar o carte normală.");
  if (give[4]) return E("La Ghișeu se dau doar cărți normale (nu Jokeri).");
  for (let i = 0; i < 5; i++) if (give[i] > c.h[i]) return E("Nu ai aceste cărți.");
  for (let i = 0; i < 5; i++) c.h[i] -= give[i]; c.h[get]++; c.st.ghiseu++; return OK;
};
/* prețul cărții la ghișeu: crește cu fiecare cumpărare (×cardMult per „căldură”) și se răcește lin în timp de joc (înjumătățire la cardHalfMin),
   deci nu mai depinde de miezul nopții sau de lungimea zilei. Stare: c.bh (căldura la momentul c.bt, minute de joc). */
const cardHeat = (st, c) => c.bh ? c.bh * Math.pow(0.5, Math.max(0, st.gt - (c.bt || 0)) / Math.max(1, TU().cardHalfMin)) : 0;
const cardPriceNow = (c, st) => Math.round(TU().cardPrice * Math.pow(TU().cardMult, st ? cardHeat(st, c) : c.bc) / 1000) * 1000;
ACT.buyCard = (st, s, a, now, R) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], K = TU(); if (c.bc >= K.buyMaxPerDay) return E("Poți cumpăra cel mult " + K.buyMaxPerDay + " cărți pe zi.");
  const pr = cardPriceNow(c, st); if (c.cash < pr) return E("Nu ai destui bani.");
  const ty = a.type === undefined || a.type === null ? Math.floor(R() * 4) : normCardType(a.type); if (!(ty >= 0 && ty <= 3)) return E("Tip de carte invalid.");
  c.cash -= pr; c.today.cost += pr; c.h[ty]++; c.bc++; c.bh = r3(cardHeat(st, c) + 1); c.bt = r2(st.gt); c.st.cardsBought++; return OK;
};
ACT.consultant = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], K = TU();
  if (a.on && !c.cons) { if (c.cash < K.consHire) return E("Nu ai destui bani."); c.cash -= K.consHire; c.cons = 1; c.tipAt = st.gt + 30; }
  else if (!a.on) c.cons = 0;
  return OK;
};
function bankInfo(st, s) {
  const K = TU(), c = st.c[s], debt = bankDebt(st, s);
  const limit = Math.max(0, Math.floor((grossLimit(st, s) - debt) / 10000) * 10000);
  const extra = (100 - c.cs) * K.csRateK, im = evMult(st, "interest", s, true);
  const rates = {}; for (const t of K.bankTerms) rates[t] = Math.round(((K.bankRates[t] || 0.005) + extra) * im * 1e6) / 1e6;
  return { limit, rates, rate: rates[K.bankTerms[1]] || rates[K.bankTerms[0]], debt, score: c.cs };
}
ACT.bank = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const K = TU(), c = st.c[s], amt = Math.round(+a.amount), days = a.days | 0;
  if (K.bankTerms.indexOf(days) < 0) return E("Termen invalid.");
  const bi = bankInfo(st, s);
  if (!(amt >= K.bankMin)) return E("Suma minimă e " + K.bankMin + " €."); if (amt > bi.limit) return E("Banca îți poate da cel mult " + bi.limit + " €.");
  const r = (K.bankRates[days] || 0.005) + (100 - c.cs) * K.csRateK;
  c.cash += amt; c.bl.push({ id: newId(st), p: amt, p0: amt, d: days, n: days, r: Math.round(r * 1e6) / 1e6 }); c.st.bankLoans++; c.st.bankBorrowed += amt; return OK;
};
ACT.repay = (st, s, a) => {
  const g = guardOps(st, s, true); if (g) return g;
  const c = st.c[s], l = c.bl.find(x => x.id === a.id); if (!l) return E("Credit inexistent.");
  let amt = Math.round(a.amount === undefined || a.amount === null ? Math.ceil(l.p) : +a.amount); amt = Math.min(amt, Math.ceil(l.p));
  if (!(amt > 0)) return E("Sumă invalidă."); if (c.cash < amt) return E("Nu ai destui bani.");
  c.cash -= amt; l.p -= amt; if (l.p <= 0.5) { c.bl = c.bl.filter(x => x !== l); c.cs = clamp(c.cs + TU().csRepaid, 0, 100); } return OK;
};
function canFreeze(st, s, tg) {
  const c = st.c[s], o = st.c[tg];
  if (!o || tg === s) return "Alege altă companie.";
  if (o.out) return "Compania a ieșit din joc.";
  if (st.phase !== "play" || st.pz || !st.run) return "Nu poți îngheța timpul în pauză, draft sau negociere.";
  if (o.fz) return "Compania e deja înghețată.";
  if (st.pacts.some(p => (p.a === s && p.b === tg) || (p.b === s && p.a === tg))) return "Aveți un pact de neagresiune.";
  if (c.fzCd > st.gt) return "Poți îngheța din nou abia peste " + Math.ceil((c.fzCd - st.gt) / 60) + " ore de joc.";
  return null;
}
ACT.play = (st, s, a, now, R) => {
  const g = guardOps(st, s); if (g) return g;
  const c = st.c[s], id = normSpecial(a.card), K = TU();
  if (!id) return E("Carte specială necunoscută."); if (!c.sx[id]) return E("Nu ai această carte.");
  switch (id) {
    case "frz": {
      syncTime(st, now, R);
      const why = canFreeze(st, s, a.target); if (why) return E(why);
      const o = st.c[a.target];
      o.fz = { s: st.gt, e: st.gt + gmFromSec(st, K.freezeSec), by: s, pu: o.sx.brk ? st.gt + gmFromSec(st, K.breakerSec) : 0 };
      o.rep = clamp(o.rep + K.repFrozen, K.repMin, K.repMax);
      c.fzCd = st.gt + K.freezeCdDays * MIN_DAY; c.st.freezes++; o.st.frozen++;
      spendSpecial(st, s, "frz"); logp(st, "freeze", { s, o: a.target }); return OK;
    }
    case "fast": { const r = doBuild(st, s, { permitId: a.permitId, cards: a.cards }, true); if (r.ok) spendSpecial(st, s, "fast"); return r; }
    case "vip": { // aeroporturile: {x, y} (sau {from, to}, {pair:[A,B]}, {ap, ap2}; {a, b} doar dacă numele acțiunii e în cheia t)
      const x = a.x || a.from || (Array.isArray(a.pair) && a.pair[0]) || a.ap || (a.t && AP(a.a) ? a.a : null);
      const y = a.y || a.to || (Array.isArray(a.pair) && a.pair[1]) || a.ap2 || (AP(a.b) ? a.b : null);
      const A = AP(x), B = AP(y); if (!A || !B || x === y) return E("Alege două aeroporturi diferite.");
      const d = dist(x, y); if (d > maxRange() || !feasiblePair(x, y)) return E("Niciun avion nu poate opera această rută."); if (d < K.distMinPermit) return E("Aeroporturile sunt prea apropiate.");
      if (ownsPair(st, s, x, y)) return E("Ai deja această rută sau acest permis.");
      if (c.pm.length >= K.maxPermits) return E("Ai deja " + K.maxPermits + " permise deschise.");
      c.pm.push({ id: newId(st), a: x, b: y, d, k: permitCost(R, x, y) }); spendSpecial(st, s, "vip"); return OK;
    }
    case "boom": { if (!c.r[a.rid]) return E("Alege una dintre rutele tale."); c.fx.push({ k: "boom", rid: a.rid, u: st.gt + K.boomDays * MIN_DAY }); spendSpecial(st, s, "boom"); return OK; }
    case "fuel": { c.fx.push({ k: "fuel", u: st.gt + K.fuelDays * MIN_DAY }); spendSpecial(st, s, "fuel"); return OK; }
    case "spy": {
      let tgt = a.target; if (!tgt && a.rid) tgt = active(st).find(x => x !== s && st.c[x].r[a.rid]);
      const o = st.c[tgt]; if (!o || tgt === s || o.out) return E("Alege un adversar."); if (!o.r[a.rid]) return E("Adversarul nu operează această rută.");
      c.fx.push({ k: "spy", s: tgt, rid: a.rid, u: st.gt + K.spyDays * MIN_DAY }); spendSpecial(st, s, "spy"); return OK;
    }
    case "ad": { c.fx.push({ k: "ad", u: st.gt + K.adDays * MIN_DAY }); spendSpecial(st, s, "ad"); return OK; }
    case "slot": {
      const ap = a.ap; if (!AP(ap)) return E("Alege un aeroport."); if (hasSlot(st, s, ap)) return E("Ai deja slot aici.");
      if (slotFree(st, ap)) return E("Aeroportul mai are sloturi libere: cumpără unul normal."); addSlot(st, s, ap, true); c.st.slots++; spendSpecial(st, s, "slot"); return OK;
    }
    case "gift": { if (st.pl.filter(p => p.s === s).length >= K.maxPlanes) return E("Flota e plină."); newPlane(st, s, K.giftType, 0, 0, c.base); spendSpecial(st, s, "gift"); logp(st, "special", { s, card: "giftplane" }); return OK; }
    case "ins": return E("Asigurarea se folosește automat când te lovește un eveniment negativ.");
    case "brk": return E("Spărgătorul se folosește când ești înghețat.");
  }
  return E("Carte necunoscută.");
};
ACT.breaker = (st, s, a, now, R) => {
  const c = st.c[s]; if (!c.fz) return E("Nu ești înghețat.");
  if (st.phase === "nego" && st.ng) return E(negoBusyMsg(st, s));
  syncTime(st, now, R);
  if (!c.fz) return E("Înghețarea s-a terminat.");
  if (!c.fz.pu || st.gt > c.fz.pu + 1e-6) return E("Prea târziu pentru Spărgător.");
  if (!a.use) { c.fz.pu = 0; return OK; }
  if (!c.sx.brk) return E("Nu ai Spărgător de gheață.");
  const by = c.fz.by;
  spendSpecial(st, s, "brk"); c.st.breakers++; c.fz.e = st.gt; endFreeze(st, s); logp(st, "breaker", { s, o: by }); return OK;
};
ACT.shares = (st, s, a) => {
  const g = guardOps(st, s); if (g) return g;
  const K = TU(), iss = a.co, n = a.n | 0, c = st.c[s];
  if (!st.c[iss] || st.c[iss].out) return E("Companie invalidă."); if (n <= 0) return E("Număr invalid de acțiuni.");
  const pr = sharePrice(st, iss); st.sh[iss] = st.sh[iss] || {};
  const held = st.sh[iss], others = Object.keys(held).reduce((x, k) => x + held[k], 0);
  const buy = a.buy || a.side === "buy" || a.op === "buy", sell = a.sell || a.side === "sell" || a.op === "sell";
  if (buy) {
    const cost = Math.round(n * pr * (1 + K.shareFee));
    if (iss === s) { // răscumpărare de la ceilalți
      if (n > others) return E("Nu sunt atâtea acțiuni la alții."); if (c.cash < cost) return E("Nu ai destui bani.");
      let left = n; for (const h of Object.keys(held).sort((x, y) => held[y] - held[x])) { if (!left) break; const k = Math.min(left, held[h]); held[h] -= k; left -= k; st.c[h].cash += k * pr; if (!held[h]) delete held[h]; }
      c.cash -= cost; st.shc = st.shc || {}; st.shc[s] = Math.max(0, (st.shc[s] || 0) - n * pr); return OK;
    }
    if (others + n > K.shareMax) return E("Cel mult " + K.shareMax + " acțiuni pot fi la alții."); if (c.cash < cost) return E("Nu ai destui bani.");
    c.cash -= cost; st.c[iss].cash += n * pr; st.shc = st.shc || {}; st.shc[iss] = (st.shc[iss] || 0) + n * pr; held[s] = (held[s] || 0) + n; c.st.sharesBought += n; logp(st, "sharesBuy", { s, o: iss, n }); return OK;
  }
  if (sell) {
    if (iss === s) return E("Nu poți vinde propriile acțiuni."); if ((held[s] || 0) < n) return E("Nu ai atâtea acțiuni.");
    const val = Math.round(n * pr * (1 - K.shareFee)); if (st.c[iss].cash < val) return E("Compania nu are bani să le răscumpere.");
    st.c[iss].cash -= val; c.cash += val; held[s] -= n; if (!held[s]) delete held[s]; st.shc = st.shc || {}; st.shc[iss] = Math.max(0, (st.shc[iss] || 0) - val); return OK;
  }
  return E("Alege cumpărare sau vânzare.");
};
ACT.pick = (st, s, a, now, R) => {
  if (st.phase !== "draft" || !st.dr) return E("Nu e draft acum."); const dr = st.dr;
  if (dr.rv) return E("Draftul s-a încheiat."); if (dr.ord[dr.i] !== s) return E("Nu e rândul tău.");
  const i = a.i | 0; if (i < 0 || i >= dr.cards.length || dr.tk[i] !== null) return E("Cartea a fost deja luată.");
  draftPick(st, s, i, now, R); return OK;
};

/* ---- negociere ---- */
function itemsErr(st, from, to, it) {
  if (!it) return null; const K = TU(), c = st.c[from], o = st.c[to];
  if (it.cash) { if (!(it.cash > 0)) return "Sumă invalidă."; if (c.cash < it.cash) return c.name + " nu are atâția bani."; }
  if (it.cards) { if (!Array.isArray(it.cards) || it.cards.length !== 5) return "Cărți invalide."; for (let i = 0; i < 5; i++) if ((it.cards[i] | 0) < 0 || (it.cards[i] | 0) > c.h[i]) return c.name + " nu are cărțile oferite."; }
  if (it.sx) for (const id in it.sx) { const n = it.sx[id] | 0; if (!isSpecial(id) || n < 0 || n > (c.sx[id] || 0)) return c.name + " nu are cartea specială."; const lim = K.LIMITS[id]; if (lim !== undefined && lim !== null && (o.sx[id] || 0) + n > lim) return o.name + " ar depăși limita pentru " + CARD_NAMES[id] + "."; }
  if (it.permits) { for (const id of it.permits) { const p = c.pm.find(x => x.id === id); if (!p) return "Permis inexistent."; if (ownsPair(st, to, p.a, p.b)) return o.name + " are deja această rută sau acest permis."; } if (o.pm.length + it.permits.length > K.maxPermits) return o.name + " ar avea prea multe permise."; }
  if (it.routes) for (const rid of it.routes) {
    if (!c.r[rid]) return "Ruta nu mai e la " + c.name + "."; if (o.r[rid]) return o.name + " operează deja ruta.";
    if (Object.keys(o.r).length + it.routes.length > K.maxRoutes) return o.name + " ar depăși numărul maxim de rute.";
    for (const ap of ridEnds(rid)) if (!hasSlot(st, to, ap) && slotNeeded(st, from, ap, rid) && !slotFree(st, ap)) return "Nu e slot liber la " + AP(ap).n + ".";
  }
  if (it.slots) for (const ap of it.slots) { if (!hasSlot(st, from, ap)) return "Slot inexistent."; if (slotNeeded(st, from, ap)) return "Slotul de la " + AP(ap).n + " e folosit."; if (hasSlot(st, to, ap)) return o.name + " are deja slot acolo."; }
  if (it.planes) for (const pid of it.planes) { const p = myPlane(st, from, pid); if (!p) return "Avion inexistent."; if (p.ls) return "Avioanele în leasing nu se pot ceda."; if (p.m === 2 || p.m === 3) return "Avionul e în zbor."; }
  if (it.pact) { const d = it.pact | 0; if (d < 1 || d > K.pactMaxDays) return "Pactul poate fi de 1–" + K.pactMaxDays + " zile."; }
  if (it.loan) { const L = it.loan; if (!(L.amt > 0) || !(L.rep >= 0) || !((L.days | 0) >= K.loanMinDays && (L.days | 0) <= K.loanMaxDays)) return "Împrumut invalid (" + K.loanMinDays + "–" + K.loanMaxDays + " zile)."; }
  return null;
}
function transfer(st, from, to, it) {
  if (!it) return; const c = st.c[from], o = st.c[to];
  if (it.cash) { c.cash -= it.cash; o.cash += it.cash; }
  if (it.cards) for (let i = 0; i < 5; i++) { const n = it.cards[i] | 0; c.h[i] -= n; o.h[i] += n; }
  if (it.sx) for (const id in it.sx) { const n = it.sx[id] | 0; if (!n) continue; c.sx[id] -= n; if (!c.sx[id]) delete c.sx[id]; o.sx[id] = (o.sx[id] || 0) + n; }
  if (it.permits) for (const id of it.permits) { const p = c.pm.find(x => x.id === id); c.pm = c.pm.filter(x => x !== p); o.pm.push(p); }
  if (it.routes) for (const rid of it.routes) {
    const cr = c.r[rid];
    for (const p of st.pl) if (p.s === from && p.ch && p.ch.indexOf(rid) >= 0 && p.rid !== rid) delete p.ch;
    for (const p of st.pl) if (p.s === from && p.rid === rid) { delete p.ch; if (p.m === 1) { deboard(st, p); p.m = 0; p.rid = null; } else if (p.m === 2) { if (!p.rid0) p.rid0 = rid; p.ud = 1; } else p.rid = null; }
    delete c.r[rid];
    o.r[rid] = { pa: cr.pa, pb: cr.pb, qa: 0, qb: 0, t0: cr.t0, pr: 0, py: 0, p7: cr.p7.slice(), f: 0, nc: cr.nc || 0 };
    for (const ap of ridEnds(rid)) {
      if (!slotNeeded(st, from, ap)) remSlot(st, from, ap);
      if (!hasSlot(st, to, ap)) addSlot(st, to, ap, false);
      addUniq(o.st.conts, AP(ap).cont);
    }
    o.st.routes++; o.st.routesMax = Math.max(o.st.routesMax, Object.keys(o.r).length);
  }
  if (it.slots) for (const ap of it.slots) { remSlot(st, from, ap); addSlot(st, to, ap, false); }
  if (it.planes) for (const pid of it.planes) { const p = myPlane(st, from, pid); deboard(st, p); p.s = to; p.rid = null; delete p.ch; p.m = 0; p.go = 0; p.ud = 0; p.pil = 0; trackFleet(st, to); }
}
/* Negocierea are 2–4 participanți (ng.ps). Ceilalți doar privesc. Un participant poate invita pe cineva (ng.inv),
   care acceptă sau refuză (negoJoin). O ofertă = o listă de transferuri (off.lines: {f, t, it} — „f îi dă lui t obiectele it”);
   părțile ofertei (off.parts) sunt toți cei care dau sau primesc ceva; afacerea se face doar când TOATE părțile au acceptat
   (off.ok). Forma veche {give, get} (2 părți: cine propune ↔ off.to) rămâne valabilă și e convertită în linii. */
const NG_MAX = 4;
function ngNorm(ng) { // stări vechi (salvate înainte de negocierile cu 3–4 jucători)
  if (!ng) return ng;
  if (!Array.isArray(ng.ps)) ng.ps = [ng.a, ng.b].filter(x => x != null);
  if (!Array.isArray(ng.inv)) ng.inv = [];
  if (!Array.isArray(ng.dec)) ng.dec = [];
  if (!Array.isArray(ng.msgs)) ng.msgs = [];
  const off = ng.off;
  if (off && !Array.isArray(off.lines)) {
    const to = off.to != null ? off.to : (ng.a === off.by ? ng.b : ng.a);
    off.to = to; off.lines = mkLines(off.by, to, off.give, off.get); off.parts = [off.by, to]; off.ok = { [off.by]: 1 };
  }
  if (off && !off.ok) off.ok = { [off.by]: 1 };
  return ng;
}
function mkLines(by, to, give, get) {
  const L = [];
  if (give && Object.keys(give).length) L.push({ f: by, t: to, it: give });
  if (get && Object.keys(get).length) L.push({ f: to, t: by, it: get });
  return L;
}
const ngPs = st => (st.ng ? ngNorm(st.ng).ps : []);
const inNego = (st, s) => st.phase === "nego" && !!st.ng && ngPs(st).indexOf(s) >= 0 && !st.ng.res;
const partner = (st, s) => { const ps = ngPs(st); return ps.find(x => x !== s); };
function nameList(st, seats) {
  const n = seats.map(x => (st.c[x] && st.c[x].name) || x);
  return n.length <= 1 ? (n[0] || "") : n.slice(0, -1).join(", ") + " și " + n[n.length - 1];
}
function negoBusyMsg(st, s) {
  const ps = ngPs(st);
  if (ps.indexOf(s) >= 0) return "Ești în negociere — acțiunile de joc așteaptă până se încheie discuția.";
  return "Negociere în curs între " + nameList(st, ps) + " — poți doar să privești.";
}
function ngMsg(ng, m) { ng.msgs.push(m); if (ng.msgs.length > 16) ng.msgs.shift(); }
/* rulează transferurile unei oferte; întoarce textul erorii sau null */
function runDeal(st, lines) {
  const pacts = {};
  for (const ln of lines) {
    const it = ln.it || {}, f = ln.f, t = ln.t;
    if (!st.c[f] || !st.c[t] || st.c[f].out || st.c[t].out || f === t) return "Parte invalidă în ofertă.";
    const er = itemsErr(st, f, t, it); if (er) return er;
    transfer(st, f, t, it);
    if (it.loan) {
      const l = it.loan; if (st.c[f].cash < l.amt) return st.c[f].name + " nu are banii pentru împrumut.";
      st.c[f].cash -= l.amt; st.c[t].cash += l.amt; st.ln.push({ id: newId(st), l: f, b: t, amt: l.amt, rep: l.rep, due: st.day + l.days }); st.c[f].st.loansGiven++; st.c[t].st.loansTaken++;
    }
    if (it.pact | 0) { const k = [f, t].sort().join("|"); pacts[k] = Math.max(pacts[k] || 0, it.pact | 0); }
  }
  for (const k in pacts) { const [x, y] = k.split("|"); st.pacts.push({ a: x, b: y, u: st.day + pacts[k] }); st.c[x].st.pacts++; st.c[y].st.pacts++; logp(st, "pact", { s: x, o: y, n: pacts[k] }); }
  return null;
}
function dealParts(lines) { const p = []; for (const l of lines) { if (p.indexOf(l.f) < 0) p.push(l.f); if (p.indexOf(l.t) < 0) p.push(l.t); } return p; }
ACT.negoOpen = (st, s, a, now, R) => {
  const K = TU(), c = st.c[s], w = a.with || a.to || a.target, o = st.c[w];
  if (st.phase !== "play") return E(st.phase === "nego" && st.ng ? negoBusyMsg(st, s) : "Negocierea se poate deschide doar în timpul zilei.");
  if (c.out) return E("Ai ieșit din joc."); if (c.fz) return E("Ești înghețat.");
  if (!o || w === s || o.out) return E("Alege un adversar activ.");
  if (c.ngd === st.day && c.ngn >= K.negoPerDay) return E("Ai deschis deja o negociere azi.");
  let off = null;
  if (a.loan && typeof a.loan === "object") {
    const L = { amt: Math.round(a.loan.amt), rep: Math.round(a.loan.rep), days: a.loan.days | 0 };
    const er = itemsErr(st, w, s, { loan: L }); if (er) return E(er);
    off = { by: s, to: w, give: {}, get: { loan: L }, lines: [{ f: w, t: s, it: { loan: L } }], parts: [s, w], ok: { [s]: 1 }, at: now };
  }
  stopClock(st, now, R);
  st.ngn++; if (c.ngd !== st.day) { c.ngd = st.day; c.ngn = 0; } c.ngn++; c.st.negos++;
  st.ng = { id: st.ngn, a: s, b: w, ps: [s, w], inv: [], dec: [], at: now, until: now + wallMs(st, K.negoSec), off, msgs: [], res: null, end: 0, req: a.loan ? 1 : 0, last: null };
  st.phase = "nego"; logp(st, "negoOpen", { s, o: w }); return OK;
};
function cleanItems(it) {
  const o = {}; if (!it || typeof it !== "object") return o;
  if (it.cash > 0) o.cash = Math.round(it.cash);
  if (Array.isArray(it.cards) && it.cards.some(x => x > 0)) o.cards = [0, 1, 2, 3, 4].map(i => Math.max(0, it.cards[i] | 0));
  else if (it.cards && typeof it.cards === "object" && !Array.isArray(it.cards)) { const arr = [0, 0, 0, 0, 0]; for (const k in it.cards) { const t = normCardType(k); if (t >= 0 && t <= 4) arr[t] += Math.max(0, it.cards[k] | 0); } if (arr.some(x => x)) o.cards = arr; }
  if (it.sx && typeof it.sx === "object") { const x = {}; for (const k in it.sx) { const id = normSpecial(k); if (id && (it.sx[k] | 0) > 0) x[id] = (x[id] || 0) + (it.sx[k] | 0); } if (Object.keys(x).length) o.sx = x; }
  for (const k of ["permits", "routes", "slots", "planes"]) if (Array.isArray(it[k]) && it[k].length) o[k] = Array.from(new Set(it[k]));
  if ((it.pact | 0) > 0) o.pact = it.pact | 0;
  if (it.loan && it.loan.amt > 0) o.loan = { amt: Math.round(it.loan.amt), rep: Math.round(it.loan.rep || 0), days: it.loan.days | 0 };
  return o;
}
ACT.negoOffer = (st, s, a, now) => {
  if (!inNego(st, s)) return E(st.phase === "nego" && st.ng ? negoBusyMsg(st, s) : "Nu ești într-o negociere.");
  const ng = st.ng, ps = ng.ps;
  let lines;
  if (Array.isArray(a.lines)) {
    lines = [];
    for (const l of a.lines) {
      if (!l) continue; const f = l.f != null ? l.f : l.from, t = l.t != null ? l.t : l.to;
      if (ps.indexOf(f) < 0 || ps.indexOf(t) < 0 || f === t) return E("Toți cei din ofertă trebuie să fie la masa negocierii.");
      const it = cleanItems(l.it || l.items || l.give); if (Object.keys(it).length) lines.push({ f, t, it });
    }
  } else {
    let to = a.to != null ? a.to : a.with;
    if (to == null) { if (ps.length === 2) to = partner(st, s); else if (ng.off && ng.off.by !== s && ng.off.parts.indexOf(s) >= 0) to = ng.off.by; }
    if (to == null || ps.indexOf(to) < 0 || to === s) return E("Alege cu cine faci oferta.");
    lines = mkLines(s, to, cleanItems(a.give), cleanItems(a.get));
  }
  if (!lines.length) return E("Oferta e goală.");
  const parts = dealParts(lines);
  if (parts.indexOf(s) < 0) return E("Poți propune doar o afacere la care participi și tu.");
  const er = runDeal(clone(st), lines); if (er) return E(er);
  const prev = ng.off, two = parts.length === 2;
  const to = two ? parts.find(x => x !== s) : null;
  const give = {}, get = {};
  if (two) for (const l of lines) Object.assign(l.f === s ? give : get, l.it);
  const counter = !!(prev && prev.by !== s && prev.parts && prev.parts.indexOf(s) >= 0);
  ng.off = { by: s, to, give, get, lines, parts, ok: { [s]: 1 }, at: now, counter };
  return OK;
};
ACT.negoCounter = ACT.negoOffer;
ACT.negoAccept = (st, s, a, now) => {
  if (!inNego(st, s)) return E(st.phase === "nego" && st.ng ? negoBusyMsg(st, s) : "Nu ești într-o negociere."); const ng = st.ng, off = ng.off;
  if (!off) return E("Nu există nicio ofertă."); if (off.by === s) return E("Așteaptă răspunsul celorlalți.");
  if (off.parts.indexOf(s) < 0) return E("Oferta nu te privește — doar părțile ei o pot accepta.");
  if (off.ok[s]) return E("Ai acceptat deja. Se așteaptă și ceilalți.");
  const wait = off.parts.filter(x => x !== s && !off.ok[x]);
  if (wait.length) { // încă nu au acceptat toți: doar marchez
    const er = runDeal(clone(st), off.lines); if (er) return E(er);
    off.ok[s] = 1; ng.last = { by: s, k: "ok", at: now }; ngMsg(ng, { s, k: "✅ Accept", at: now }); return OK;
  }
  const er = runDeal(clone(st), off.lines); if (er) return E(er);
  runDeal(st, off.lines); off.ok[s] = 1;
  for (const x of off.parts) st.c[x].st.deals++;
  ng.res = "acc"; ng.end = now + wallMs(st, TU().negoEndSec); ng.last = { by: s, k: "acc", at: now };
  logp(st, "negoAccept", { s, o: off.by, ps: off.parts.slice() }); return OK;
};
ACT.negoRefuse = (st, s, a, now) => {
  if (!inNego(st, s)) return E(st.phase === "nego" && st.ng ? negoBusyMsg(st, s) : "Nu ești într-o negociere."); const ng = st.ng;
  if (!ng.off || ng.off.by === s || ng.off.parts.indexOf(s) < 0) return E("Nu ai ce refuza.");
  ng.last = { by: s, k: "ref", at: now }; ng.off = null; ngMsg(ng, { s, k: "refuz", at: now }); return OK;
};
ACT.negoSay = (st, s, a, now) => {
  if (!inNego(st, s)) return E(st.phase === "nego" && st.ng ? negoBusyMsg(st, s) : "Nu ești într-o negociere."); const k = String(a.k || a.text || "").slice(0, 60); if (!k) return E("Mesaj gol.");
  ngMsg(st.ng, { s, k, at: now }); return OK;
};
ACT.negoInvite = (st, s, a, now) => {
  if (!inNego(st, s)) return E(st.phase === "nego" && st.ng ? negoBusyMsg(st, s) : "Nu ești într-o negociere.");
  const ng = st.ng, w = a.who != null ? a.who : a.with != null ? a.with : a.to, o = st.c[w];
  if (!o || o.out) return E("Alege un jucător activ.");
  if (ng.ps.indexOf(w) >= 0) return E(o.name + " e deja la masă.");
  if (ng.inv.some(x => x.s === w)) return E(o.name + " are deja invitația.");
  if (ng.dec.indexOf(w) >= 0) return E(o.name + " a refuzat deja invitația.");
  if (ng.ps.length + ng.inv.length >= NG_MAX) return E("La masă pot sta cel mult " + NG_MAX + " jucători.");
  ng.inv.push({ s: w, by: s, at: now }); ngMsg(ng, { s, k: "📨 L-am invitat pe " + o.name, at: now, inv: w });
  logp(st, "negoInvite", { s, o: w }); return OK;
};
ACT.negoJoin = (st, s, a, now) => {
  const ng = st.ng; if (st.phase !== "nego" || !ng) return E("Nu e nicio negociere acum."); ngNorm(ng);
  const i = ng.inv.findIndex(x => x.s === s); if (i < 0) return E("Nu ai nicio invitație.");
  if (ng.res) return E("Negocierea s-a încheiat.");
  const yes = a.yes !== undefined ? !!a.yes : a.ok !== undefined ? !!a.ok : a.accept !== false;
  ng.inv.splice(i, 1);
  if (!yes) { ng.dec.push(s); ngMsg(ng, { s, k: "🙅 Nu, mersi", at: now, dec: 1 }); return OK; }
  if (ng.ps.length >= NG_MAX) return E("Masa e plină.");
  ng.ps.push(s); ngMsg(ng, { s, k: "👋 Am venit la masă", at: now, join: 1 }); logp(st, "negoJoin", { s }); return OK;
};
function ngLeave(st, s, now) { // un participant pleacă; cu < 2 rămași, negocierea se închide
  const ng = st.ng; if (!ng) return;
  ngNorm(ng); ng.ps = ng.ps.filter(x => x !== s); ng.inv = ng.inv.filter(x => x.s !== s);
  if (ng.ps.length < 2) { closeNego(st, now, "close"); return; }
  if (ng.off && ng.off.parts.indexOf(s) >= 0) ng.off = null;
  ng.a = ng.ps[0]; ng.b = ng.ps[1]; ngMsg(ng, { s, k: "🚪 Am plecat de la masă", at: now, left: 1 }); st.mv++;
}
ACT.negoClose = (st, s, a, now) => {
  if (st.phase !== "nego" || !st.ng || ngPs(st).indexOf(s) < 0) return E(st.phase === "nego" && st.ng ? negoBusyMsg(st, s) : "Nu ești într-o negociere.");
  if (!st.ng.res && st.ng.ps.length > 2) { ngLeave(st, s, now); return OK; }
  closeNego(st, now, st.ng.res || "close"); return OK;
};
function closeNego(st, now, res) {
  if (st.ng) st.lastNg = { id: st.ng.id, a: st.ng.a, b: st.ng.b, ps: (st.ng.ps || [st.ng.a, st.ng.b]).slice(), res };
  st.ng = null; if (st.phase === "nego") { st.phase = "play"; startClock(st, now); } st.mv++;
}
const ALIAS = { nego_open: "negoOpen", offer: "negoOffer", accept: "negoAccept", refuse: "negoRefuse", counter: "negoCounter", say: "negoSay", close: "negoClose", invite: "negoInvite", join: "negoJoin", negoAnswer: "negoJoin",
  buy: "buyPlane", sell: "sellPlane", draw: "drawPermits", keep: "keepPermits", discard: "discardPermit", special: "play", useSpecial: "play", loan: "bank" };

function apply(st, seat, act, now, rng) {
  if (!st || !act || typeof act !== "object") return E("Acțiune necunoscută.");
  const known = n => typeof n === "string" && !!(ACT[n] || ALIAS[n]);
  const name = known(act.t) ? act.t : typeof act.a === "string" ? act.a : typeof act.t === "string" ? act.t : null;
  if (!name) return E("Acțiune necunoscută.");
  if (!st.c || !st.c[seat]) return E("Loc inexistent.");
  if (st.phase === "end") return E("Jocul s-a terminat.");
  const fn = ACT[name] || ACT[ALIAS[name]]; if (!fn) return E("Acțiune necunoscută: " + name);
  const R = rng || rngFrom(st);
  let r; const cn = ACT[name] ? name : ALIAS[name], t1 = now === undefined ? st.at : now;
  let u0 = null, objs = []; try { objs = undoObjs(st, seat, cn, act); u0 = undoPre(st, seat, cn, act); } catch (e) { u0 = null; }
  try { r = fn(st, seat, act, t1, R) || OK; } catch (e) { r = E("Eroare internă: " + (e && e.message)); }
  if (r.ok) { st.mv++; undoPost(st, seat, cn, act, u0, t1, objs); }
  return r;
}

/* ======================= step (gazda) ======================= */
function botDue(st, s, now) {
  const c = st.c[s], K = TU(); if (!c.bot || c.out) return false;
  const last = st.bk[s] || 0, every = wallMs(st, K.botEveryMs / 1000);
  if (st.phase === "draft") { const dr = st.dr; if (!dr || dr.rv || dr.ord[dr.i] !== s) return false; return now >= dr.t - wallMs(st, K.draftPickSec) + wallMs(st, K.botPickSec) && now - last >= wallMs(st, 0.3); }
  if (st.phase === "nego") { // botul răspunde doar la ofertele de 2 părți care îl privesc (cele cu 3–4 părți le refuză temporizatorul)
    if (!st.ng || ngPs(st).indexOf(s) < 0 || st.ng.res) return false;
    const off = st.ng.off; if (off && (off.parts.indexOf(s) < 0 || off.parts.length > 2)) return false;
    return now - last >= every; }
  if (st.phase === "play") return !st.pz && now - last >= every;
  return false;
}
function timers(st, now, R) {
  const K = TU(); let ch = false;
  if (st.phase === "setup") {
    const hs = humans(st), allReady = st.ps.every(s => st.c[s].ready) && !tutBusy(st).length;
    if (allReady) {
      if (!st.su.at) { st.su.at = now; ch = true; }
      if (resolveVotes(st, false) || now - st.su.at >= wallMs(st, K.setupResolveSec) || !hs.length) { startGame(st, now, R); ch = true; }
    } else if (st.su.at) { st.su.at = 0; ch = true; }
  } else if (st.phase === "play") {
    if (st.pz && now - st.pz.at >= wallMs(st, K.pauseMaxSec)) { st.pz = null; startClock(st, now); st.mv++; ch = true; }
    if (st.run && st.gt >= dayEnd(st) - 1e-6) {
      if (st.maxDay && st.day >= st.maxDay) { st.run = 0; settleAccounts(st, now, R); if (st.phase !== "end") endGame(st, now); }
      else beginDraft(st, now, R);
      ch = true;
    }
  } else if (st.phase === "draft" && st.dr) {
    const dr = st.dr;
    if (!dr.rv && now >= dr.t) { const free = dr.tk.map((x, i) => x === null ? i : -1).filter(i => i >= 0); if (free.length) draftPick(st, dr.ord[dr.i], pick(R, free), now, R); else endPicks(st, now, R); ch = true; }
    else if (dr.rv && now >= dr.end) { finishDraft(st, now, R); ch = true; }
  } else if (st.phase === "nego" && st.ng) {
    const ng = st.ng;
    if (ng.res && ng.end && now >= ng.end) { closeNego(st, now, ng.res); ch = true; }
    else if (!ng.res && now >= ng.until) { closeNego(st, now, "exp"); ch = true; }
    else {
      ngNorm(ng);
      // boții invitați refuză politicos invitația
      const bi = !ng.res && ng.inv.find(x => st.c[x.s] && st.c[x.s].bot && now - x.at >= wallMs(st, 1.5));
      if (bi) { ng.inv = ng.inv.filter(x => x !== bi); ng.dec.push(bi.s); ngMsg(ng, { s: bi.s, k: "🙅 Nu, mersi", at: now, dec: 1 }); st.mv++; ch = true; }
      if (!ng.res && ng.off) {
        const tgt = ng.off.parts.find(x => x !== ng.off.by && !ng.off.ok[x] && st.c[x].bot);
        if (tgt && now - ng.off.at >= wallMs(st, K.negoBotSec)) { ng.off = null; ng.last = { by: tgt, k: "ref", at: now }; ngMsg(ng, { s: tgt, k: "refuz", at: now }); st.mv++; ch = true; }
      } else if (!ng.res && !ng.off && st.c[ng.a].bot && ng.ps.length === 2 && now - ng.at >= wallMs(st, 30)) { closeNego(st, now, "close"); ch = true; }
    }
  }
  if (st.phase === "play" && st.run) for (const s of active(st)) {
    const c = st.c[s]; if (!c.cons || c.tipAt > st.gt) continue;
    const adv = advice(st, s), top = adv[0];
    if (top) { c.tips.push({ k: top.key, t: top.text, day: st.day, rid: top.vars && top.vars.rid }); if (c.tips.length > 4) c.tips.shift(); c.st.consultantTips++; }
    const rg = K.consTipDays; c.tipAt = st.gt + (rg[0] + R() * (rg[1] - rg[0])) * MIN_DAY; ch = true; st.mv++;
  }
  return ch;
}
function step(st0, parts, now, rng, botFn, hostId) {
  if (!st0 || !st0.c) return null;
  const st = clone(st0); const R = rng || rngFrom(st);
  let ch = false;
  if (st.phase === "end") {
    if (hostId && st.host !== hostId) { st.host = hostId; st.hb = now; return st; }
    if (now - (st.hb || 0) >= 5000) { st.hb = now; return st; }
    return null;
  }
  if (st.phase === "play" && st.run) {
    const tg = gameTimeAt(st, now);
    if (tg > st.gt + 1e-9) { advance(st, tg, R); ch = true; }
    if (st.at !== now) { st.at = now; ch = true; }
  }
  if (parts) for (const s of st.ps) {
    const p = parts[s]; if (!p || !Array.isArray(p.q)) continue;
    for (const it of p.q) {
      if (!it || typeof it.n !== "number" || it.n <= (st.ack[s] || 0)) continue;
      st.ack[s] = it.n; ch = true; st.mv++;
      const r = apply(st, s, it.a, now, R);
      if (!r.ok) st.err[s] = { n: it.n, msg: r.err, at: now };
      if (st.phase === "end") break;
    }
  }
  if (botFn && st.phase !== "end") for (const s of st.ps) {
    if (!botDue(st, s, now)) continue;
    st.bk[s] = now; ch = true;
    let acts = [];
    try { acts = botFn(st, s, now, R) || []; } catch (e) { acts = []; }
    if (!Array.isArray(acts)) acts = [acts];
    for (const a of acts.slice(0, TU().botMax)) { if (!a) continue; const r = apply(st, s, a, now, R); if (!r.ok) st.err[s] = { n: -1, msg: r.err, at: now, a: a.a || a.t }; if (st.phase === "end") break; }
  }
  if (st.phase !== "end" && timers(st, now, R)) ch = true;
  if (hostId && st.host !== hostId) { st.host = hostId; ch = true; st.mv++; }
  if (!ch && now - (st.hb || 0) < 5000) return null;
  st.hb = now;
  return st;
}
function rebase(st0, now) { // nimeni n-a găzduit o vreme: mută termenele reale ca jocul să nu sară înainte
  if (!st0) return st0; const st = clone(st0); const d = now - (st.hb || st.at || now); if (!(d > 0)) { st.at = now; return st; }
  st.at = now;
  if (st.dr) { st.dr.t += d; if (st.dr.end) st.dr.end += d; }
  if (st.ng) { st.ng.until += d; st.ng.at += d; if (st.ng.end) st.ng.end += d; if (st.ng.off) st.ng.off.at += d; if (Array.isArray(st.ng.inv)) for (const x of st.ng.inv) x.at += d; }
  if (st.pz) st.pz.at += d;
  if (st.su && st.su.at) st.su.at += d;
  for (const s in st.bk) st.bk[s] += d;
  st.hb = now; return st;
}

/* ======================= derivate pentru UI ======================= */
function bearing(A, B) {
  const rad = Math.PI / 180, la1 = A.lat * rad, la2 = B.lat * rad, dl = (B.lon - A.lon) * rad;
  const y = Math.sin(dl) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
function planePos(st, p, gt) {
  if (gt === undefined) gt = st.gt;
  const fly = p.m === 2 || p.m === 3;
  const A = AP(fly ? p.fr : p.ap), B = AP(p.ap);
  if (!A || !B) return { lat: 0, lon: 0, heading: 0, prog: 0, phase: "idle" };
  const fz = st.c[p.s] && st.c[p.s].fz;
  if (!fly) { let hd = 0; if (p.m === 1 && p.rid) { const o = AP(otherEnd(p.rid, p.ap)); if (o) hd = bearing(B, o); } return { lat: B.lat, lon: B.lon, heading: Math.round(hd * 10) / 10, prog: 0, phase: fz ? "frozen" : p.m === 1 ? "board" : "idle" }; }
  let eff = gt; if (fz) eff = gt <= fz.e ? Math.min(gt, fz.s) : gt - (fz.e - fz.s);
  const prog = clamp((eff - p.t0) / Math.max(1, p.ta - p.t0), 0, 1);
  const rad = Math.PI / 180, la1 = A.lat * rad, lo1 = A.lon * rad, la2 = B.lat * rad, lo2 = B.lon * rad;
  const v1 = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)], v2 = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
  const om = Math.acos(clamp(v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2], -1, 1));
  let v = v1;
  if (om > 1e-6) { const s1 = Math.sin((1 - prog) * om) / Math.sin(om), s2 = Math.sin(prog * om) / Math.sin(om); v = [v1[0] * s1 + v2[0] * s2, v1[1] * s1 + v2[1] * s2, v1[2] * s1 + v2[2] * s2]; }
  const lat = Math.atan2(v[2], Math.sqrt(v[0] * v[0] + v[1] * v[1])) / rad, lon = Math.atan2(v[1], v[0]) / rad;
  return { lat, lon, heading: Math.round((prog >= 1 ? bearing(A, B) : bearing({ lat, lon }, B)) * 10) / 10, prog, phase: fz ? "frozen" : p.m === 2 ? "fly" : "ferry" };
}
function legsPerDay(ty, d) { return MIN_DAY / (2 * (flightMin(ty, d) + TU().turnMin)); }
// pe rutele subțiri avionul „ales bine” (cu pilot / plecări manuale) așteaptă să se umple: zboară mai rar, dar cel puțin o dată la
// pilotMaxWait. Fracțiunea din zborurile continue: clamp(cerere / (capacitate × 0,85), minim, 1)
function legsFrac(ty, d, dm, capFull, nPl) { const K = TU(), fill = (nPl || 1) >= 2 ? (K.estFill || 0.85) : 0.85, mn = (flightMin(ty, d) + K.turnMin) / (flightMin(ty, d) + Math.max(K.turnMin, K.pilotMaxWait)); return clamp(dm / Math.max(1, capFull * fill), mn, 1); }
const RCACHE = new Map(); // cache pentru view(): recomandări per (stare, oră de joc)
function cacheKey(st) { return st.seed + "|" + st.mv + "|" + st.day + "|" + Math.floor(st.gt / 30) + "|" + st.ps.length; }
function recommend(st, s, rid, dir) {
  const cr = st.c[s] && st.c[s].r[rid];
  const key = "r|" + cacheKey(st) + "|" + s + "|" + rid + "|" + (dir || "ab") + "|" + (cr ? cr.pa + "," + cr.pb + "," + planesOn(st, s, rid).length : "-");
  const hit = RCACHE.get(key); if (hit) return Object.assign({}, hit);
  const res = recommendRaw(st, s, rid, dir);
  if (RCACHE.size > 3000) RCACHE.clear(); RCACHE.set(key, res);
  return Object.assign({}, res);
}
function ratesCached(st) {
  const key = "c|" + cacheKey(st) + "|" + (st.run ? Math.floor(st.gt) : "p");
  const hit = RCACHE.get(key); if (hit) return hit;
  const r = computeRates(st); if (RCACHE.size > 3000) RCACHE.clear(); RCACHE.set(key, r); return r;
}
/* tipul „potrivit” pentru o rută: cel mai mic (în ordinea pe mărime) care o poate zbura și are ~destule locuri pentru cererea brută
   a rutei (un singur avion); altfel cel mai mare care o poate zbura. −1 dacă niciunul. */
function normalPlaneType(st, rid) {
  const K = TU(), [a, b] = ridEnds(rid); if (!AP(a) || !AP(b)) return -1; const d = dist(a, b);
  const ok = K.ORDER.filter(t => canServe(t, rid)); if (!ok.length) return -1;
  const dem = Math.max(rawDemand(st, a, b), rawDemand(st, b, a));
  for (const t of ok) if (planeT(t).seats * legsPerDay(t, d) >= 0.7 * dem) return t;
  return ok[ok.length - 1];
}
function recommendRaw(st, s, rid, dir) {
  const K = TU(), [a, b] = ridEnds(rid), d = dist(a, b), nrm = normalPrice(d, a, b), c = st.c[s];
  const res = { cheap: Math.round(nrm * K.cheapMult), normal: nrm, premium: Math.round(nrm * K.premiumMult), rec: nrm, estLoad: 0, dem: 0, cap: 0, weak: false };
  if (!c || !c.r[rid] || !st.rt[rid]) return res;
  const di = dir === "ba" ? 1 : 0, dname = di ? "ba" : "ab";
  const pls = planesOn(st, s, rid);
  let cap = pls.reduce((acc, p) => acc + planeT(p.ty).seats * legsPerDay(p.ty, d), 0);
  if (!cap) { let ty = normalPlaneType(st, rid); if (ty < 0) ty = 2; cap = planeT(ty).seats * legsPerDay(ty, d); }
  // venitul estimat pe o grilă de prețuri în banda [Ieftin … ~Premium×1.15]; dintre prețurile care aduc ≥ 97% din venitul
  // maxim îl alegem pe cel mai apropiat de Normal (pe rutele cu cerere puțin elastică optimul strict ar fugi la capătul benzii,
  // ex. „Recomandat 960 €” la Normal 385 €).
  { const ty0 = pls.length ? pls[0].ty : Math.max(0, normalPlaneType(st, rid)), mk0 = marketDir(st, rid, di, { s, A: attract(st, s, rid, dname, nrm), p: nrm });
    cap *= legsFrac(ty0, d, (mk0.out[s] || { d: 0 }).d, cap, pls.length); }
  const mLo = Math.max(0.3, K.cheapMult), mHi = Math.max(1.05, K.recMaxMult || K.premiumMult * 1.15);
  const cand = [];
  const tryM = m => {
    const p = Math.max(1, Math.round(nrm * m / K.pRound) * K.pRound);
    const A = attract(st, s, rid, dname, p);
    const mk = marketDir(st, rid, di, { s, A, p });
    const dm = (mk.out[s] || { d: 0 }).d, served = Math.min(dm, cap * K.recLoad);
    cand.push({ m, p, rev: served * p, load: Math.min(1, dm / cap), dm });
  };
  for (let m = mLo; m <= mHi + 1e-9; m += 0.05) tryM(m);
  // doar prețuri cu ocupare sănătoasă (≥ recMinLoad); dacă niciunul din bandă nu ajunge acolo → prețul cu ocuparea maximă, „weak”
  const sane = cand.filter(c => c.load >= K.recMinLoad - 1e-9);
  let pickC;
  if (sane.length) {
    const bestRev = Math.max.apply(null, sane.map(c => c.rev));
    const ok = sane.filter(c => c.rev >= bestRev * 0.97 - 1e-6).sort((x, y) => Math.abs(Math.log(x.m)) - Math.abs(Math.log(y.m)));
    pickC = ok[0] || sane[0];
  } else { pickC = cand.slice().sort((x, y) => y.load - x.load || x.m - y.m)[0]; res.weak = true; }
  res.rec = pickC.p; res.estLoad = r2(clamp(pickC.load, 0, 1)); res.dem = Math.round(pickC.dm); res.cap = Math.round(cap);
  return res;
}
/* ---- estimate(): avertizarea gratuită la alocare / preț (minimă: profit/zi + ocupare) ---- */
function attractN(st, s, rid, dname, price, n) { // atractivitatea cu n avioane pe rută
  const K = TU(), c = st.c[s], r = st.rt[rid], nrm = routeNormal(rid);
  let A = Math.pow(Math.max(0.02, price / nrm), -epsNow(st)) * Math.pow(Math.max(K.freqMin, n), K.freqExp) * (1 + K.starW * (stars(st, s) - 3));
  if (r && r.pio === s && r.pu > st.gt) A *= pioAttr(rid);
  return Math.max(0, A * invAttrMult(st, s, rid));
}
/* costurile fixe pe zi ale avioanelor de pe rută (întreținere, leasing, pilot, regia per avion) — „Profit azi” al rutei e doar
   venit − zboruri; netToday scade și partea din costurile fixe scursă azi, ca să se compare cu estimarea pe zi */
function routeFixed(st, s, rid, cr, gt) {
  const K = TU(), c = st.c[s]; let f = 0;
  const mm = evMult(st, "maint", s, true) * (ivOf(c).m ? 1 - K.INV.mnt.maint : 1), cm = evMult(st, "crew", s, true), lm = leaseMult(st);
  for (const p of planesOn(st, s, rid)) { const pt = planeT(p.ty), w = p.ch && p.ch.length === 2 ? 0.5 : 1;
    f += w * (pt.maint * (1 + K.maintAge * planeAge(st, p)) * mm + K.overheadPlane + (p.ls ? pt.lease * lm : 0) + (p.pil ? pt.pilot * cm : 0)); }
  const frac = c.lsd && c.lsd.day === st.day ? 0 : clamp(((gt === undefined ? st.gt : gt) - (st.day - 1) * MIN_DAY) / MIN_DAY, 0, 1); // zi încheiată (draft) → 0
  return { fixedDay: Math.round(f), netToday: Math.round((cr ? cr.pr : 0) - f * frac), dayFrac: r2(frac) };
}
function estimate(st, s, o) {
  o = o || {}; const c = st && st.c && st.c[s], rid = o.rid;
  const bad = why => ({ profitDay: 0, load: 0, ok: false, why });
  if (!c || !c.base || !rid) return bad("Date lipsă.");
  const [a, b] = ridEnds(rid); if (!AP(a) || !AP(b)) return bad("Rută necunoscută.");
  const p = o.pid !== undefined && o.pid !== null ? myPlane(st, s, o.pid) : null;
  const ty = p ? p.ty : normPlaneType(o.type); if (!validTy(ty)) return bad("Tip de avion invalid.");
  if (o.via) return estimateChain(st, s, o, ty, p);
  const pt = planeT(ty), d = dist(a, b);
  if (pt.range < d) return bad("Autonomie prea mică (" + pt.range + " km).");
  if ((pt.minSize || 1) > Math.min(AP(a).size, AP(b).size)) return bad("Nu aterizează pe aeroporturi mici.");
  const key = "e|" + cacheKey(st) + "|" + s + "|" + rid + "|" + (p ? "p" + p.id + (p.pil ? "P" : "") : "t" + ty) + "|" + (o.dir || "") + "|" + (o.price || "");
  const hit = RCACHE.get(key); if (hit) return Object.assign({}, hit);
  const K = TU(), cr = c.r[rid], nrm = normalPrice(d, a, b);
  const others = planesOn(st, s, rid).filter(x => !p || x.id !== p.id);
  const capOf = t => planeT(t).seats * legsPerDay(t, d);
  const n = others.reduce((u, x) => u + freqW(x.ty), 0) + freqW(ty);
  let capThis = capOf(ty), capDir = others.reduce((u, x) => u + capOf(x.ty), 0) + capThis;
  const dms = [0, 1].map(di => {
    const dname = di ? "ba" : "ab";
    const usePx = o.price > 0 && (!o.dir || o.dir === "both" || o.dir === dname);
    const pr = usePx ? Math.round(o.price) : cr ? (di ? cr.pb : cr.pa) : nrm;
    const mk = marketDir(st, rid, di, { s, A: attractN(st, s, rid, dname, pr, n), p: pr });
    return { dm: (mk.out[s] || { d: 0 }).d, pr };
  });
  const lf = legsFrac(ty, d, Math.max(dms[0].dm, dms[1].dm), capDir, others.length + 1); capThis *= lf; capDir *= lf;
  let rev = 0, served = 0;
  for (const x of dms) { const sv = Math.min(x.dm, capDir * K.estLoadCap); served += sv; rev += sv * x.pr; }
  const load = served / (2 * capDir), share = capThis / capDir;
  const legs = legsPerDay(ty, d) * lf; // dus-întors pe zi
  let cost = legs * (flightCost(st, s, ty, a, b) + flightCost(st, s, ty, b, a));
  const age = p ? planeAge(st, p) : 0;
  cost += pt.maint * (1 + K.maintAge * age) * evMult(st, "maint", s, true) * (ivOf(c).m ? 1 - K.INV.mnt.maint : 1) + K.overheadPlane;
  if (p && p.pil) cost += pt.pilot * evMult(st, "crew", s, true);
  if (p && p.ls) cost += pt.lease * leaseMult(st);
  const res = { profitDay: Math.round(rev * share - cost), load: r2(clamp(load, 0, 1)), ok: true };
  if (p && p.ls && leaseMult(st) < 1) res.profitDayFull = Math.round(res.profitDay - pt.lease * (1 - leaseMult(st))); // R1: cât face după rampa de leasing (chirie întreagă)
  if (K.gatesOn) for (const ap of [a, b]) if (c.base !== ap) { const gi = gateInfo(st, ap); if (gi.used >= K.gateBusy * gi.total) (res.gateBusy = res.gateBusy || []).push(ap); }
  if (RCACHE.size > 3000) RCACHE.clear(); RCACHE.set(key, res);
  return Object.assign({}, res);
}
function estimateChain(st, s, o, ty, p) {
  const c = st.c[s], K = TU(), r1 = o.rid, r2 = o.via, bad = why => ({ profitDay: 0, load: 0, ok: false, why, through: 0 });
  const P = chainPts(r1, r2); if (!P) return bad("Rutele trebuie să aibă un singur aeroport comun.");
  const w = chainCheck(ty, r1, r2); if (w) return bad(w);
  const key = "ec|" + cacheKey(st) + "|" + s + "|" + r1 + "|" + r2 + "|" + (p ? "p" + p.id + (p.pil ? "P" : "") : "t" + ty);
  const hit = RCACHE.get(key); if (hit) return Object.assign({}, hit);
  const pt = planeT(ty), cyc = MIN_DAY / chainCycleMin(ty, r1, r2), capThisLeg = pt.seats * cyc; // locuri/zi pe fiecare etapă și direcție
  // ceilalți: avioanele mele de pe fiecare etapă (fără acesta)
  const thisIn = p && p.ch && p.ch.indexOf(r1) >= 0 && p.ch.indexOf(r2) >= 0;
  const g = chainGroups(st, s), gk = [r1, r2].slice().sort().join("|"), nCh = ((g[gk] && g[gk].n) || 0) + (thisIn ? 0 : 1);
  const ex = (c.r[r1] && c.r[r2]) ? chainExtra(st, s, r1, r2, nCh) : [0, 0];
  const exOld = (c.r[r1] && c.r[r2]) ? chainExtra(st, s, r1, r2, nCh - 1) : [0, 0];
  let rev = 0, served = 0, capSum = 0, thr = 0;
  const legsD = [];
  for (const rid of [r1, r2]) {
    const cr = c.r[rid], [x, y] = ridEnds(rid), d = dist(x, y), nrm = normalPrice(d, x, y);
    const others = planesOn(st, s, rid).filter(q => !p || q.id !== p.id);
    const capOthers = others.reduce((u, q) => u + planeT(q.ty).seats * (q.ch && q.ch.length === 2 ? MIN_DAY / chainCycleMin(q.ty, q.ch[0], q.ch[1]) : legsPerDay(q.ty, d)), 0);
    const capDir = capOthers + capThisLeg, n = others.reduce((u, q) => u + freqW(q.ty), 0) + freqW(ty);
    for (let di = 0; di < 2; di++) {
      const dname = di ? "ba" : "ab", pr = cr ? (di ? cr.pb : cr.pa) : nrm;
      const mk = marketDir(st, rid, di, { s, A: attractN(st, s, rid, dname, pr, n), p: pr });
      const from = di ? y : x, through = (rid === r1 ? (from === P.a ? ex[0] : ex[1]) : (from === P.b ? ex[0] : ex[1]));
      const extraNew = Math.max(0, through - (rid === r1 ? (from === P.a ? exOld[0] : exOld[1]) : (from === P.b ? exOld[0] : exOld[1])));
      legsD.push({ dm: (mk.out[s] || { d: 0 }).d + through, capDir, pr, extraNew });
    }
  }
  // pilotul așteaptă ≥ 60% plin (max 6 h) la fiecare plecare → pe rute subțiri cicluri mai puține, dar mai pline (ca la estimate())
  const cm = chainCycleMin(ty, r1, r2), mnF = cm / (cm + 4 * Math.max(0, K.pilotMaxWait - K.turnMin));
  const lf = clamp(legsD.reduce((u, x) => u + x.dm / Math.max(1, x.capDir * 0.85), 0) / legsD.length, mnF, 1);
  for (const x of legsD) {
    const capT = capThisLeg * lf, capD = x.capDir * lf, sv = Math.min(x.dm, capD * K.estLoadCap);
    // partea acestui avion: proporțională cu locurile, dar pasagerii A–C noi (aduși de el) îi revin lui
    const mine = Math.min(capT * K.estLoadCap, Math.max(0, sv - Math.min(sv, x.extraNew)) * capT / capD + Math.min(sv, x.extraNew));
    served += mine; rev += mine * x.pr; capSum += capT;
  }
  thr = Math.round(ex[0] + ex[1]);
  let cost = cyc * lf * (flightCost(st, s, ty, P.a, P.b) + flightCost(st, s, ty, P.b, P.c) + flightCost(st, s, ty, P.c, P.b) + flightCost(st, s, ty, P.b, P.a));
  const age = p ? planeAge(st, p) : 0;
  cost += pt.maint * (1 + K.maintAge * age) * evMult(st, "maint", s, true) * (ivOf(c).m ? 1 - K.INV.mnt.maint : 1) + K.overheadPlane;
  if (p && p.pil) cost += pt.pilot * evMult(st, "crew", s, true);
  if (p && p.ls) cost += pt.lease * leaseMult(st);
  const res = { profitDay: Math.round(rev - cost), load: Math.round(clamp(served / Math.max(1, capSum), 0, 1) * 100) / 100, ok: true, through: thr };
  if (RCACHE.size > 3000) RCACHE.clear(); RCACHE.set(key, res);
  return Object.assign({}, res);
}
function chainOptions(st, s, o) {
  o = o || {}; const c = st && st.c && st.c[s]; if (!c) return [];
  const p = o.pid !== undefined && o.pid !== null ? myPlane(st, s, o.pid) : null, ty = p ? p.ty : (o.type !== undefined ? normPlaneType(o.type) : -1);
  const rs = Object.keys(c.r).sort(), out = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const P = chainPts(rs[i], rs[j]); if (!P) continue;
    const r1 = ridOf(P.a, P.b) === rs[i] ? rs[i] : rs[j], r2 = r1 === rs[i] ? rs[j] : rs[i];
    const why = validTy(ty) ? chainCheck(ty, r1, r2) : "";
    out.push({ rid: r1, via: r2, a: P.a, b: P.b, c: P.c, d1: dist(P.a, P.b), d2: dist(P.b, P.c), dAC: dist(P.a, P.c), ok: !why, why });
  }
  return out;
}
function betterFit(st, s, o) { // un avion PROPRIU (nu în zbor) clar mai potrivit pe ruta dată → {pid, ty, name} | null
  o = o || {}; const c = st && st.c && st.c[s]; if (!c || !o.rid) return null;
  const cur = estimate(st, s, o); const curP = cur.ok ? cur.profitDay : -Infinity;
  const p0 = o.pid !== undefined && o.pid !== null ? o.pid : null, ty0 = p0 !== null ? (myPlane(st, s, p0) || {}).ty : normPlaneType(o.type);
  let best = null; const seen = {};
  for (const p of st.pl) {
    if (p.s !== s || p.id === p0 || p.m === 2 || p.m === 3 || p.ty === ty0 || p.rid === o.rid) continue;
    const k = p.ty + (p.rid ? "r" : "i"); if (seen[k]) continue; seen[k] = 1; // un candidat per tip (de preferat liber)
    const e = estimate(st, s, { pid: p.id, rid: o.rid }); if (!e.ok) continue;
    if (!best || e.profitDay > best.e.profitDay || (e.profitDay === best.e.profitDay && !p.rid)) best = { p, e };
  }
  if (!best) return null;
  const gain = best.e.profitDay - curP;
  if (!(gain >= 20000 && (curP === -Infinity || gain >= 0.25 * Math.max(Math.abs(curP), 1)))) return null;
  return { pid: best.p.id, ty: best.p.ty, name: planeT(best.p.ty).n };
}
function tipText(key, vars) {
  const d = D(); let t = "";
  if (d.tip) { try { t = d.tip(key, vars, mulberry((vars && vars._h) || 1)); } catch (e) { t = ""; } }
  if (!t) {
    const tpl = FB_TIPS[key] || "";
    t = tpl.replace(/\{(\w+)\}/g, (m, k) => { let v = vars[k]; if (v == null) return m; if (k === "a" && typeof v === "number") v = Math.round(v).toLocaleString("ro-RO") + " €"; else if ((k === "x" || k === "y") && AP(v)) v = AP(v).n; else if (k === "pct" && typeof v === "number") v = Math.round(v) + "%"; else if (k === "t") { const pt = TU().PLANES.find(p => p.id === v); if (pt) v = pt.n; } return String(v); });
  }
  return t;
}
function advice(st, s) {
  const c = st.c[s]; if (!c || c.out || !c.base) return [];
  const K = TU(), out = [], seen = {};
  const say = (key, prio, vars) => { if (seen[key]) return; seen[key] = 1; vars = Object.assign({ _h: st.day * 31 + key.length * 7 + s.length }, vars, { g: c.g }); const text = tipText(key, vars); if (text) out.push({ key, text, prio, vars }); };
  const rn = rid => { const [a, b] = ridEnds(rid); return AP(a).n + " – " + AP(b).n; };
  if (c.cash < 0) say("cashLow", 5, { a: Math.round(c.cash), n: Math.max(0, K.negDays - c.neg + 1) });
  const mine = st.pl.filter(p => p.s === s);
  const idle = mine.find(p => !p.rid && p.m === 0); if (idle) say("idlePlane", 4, { t: planeT(idle.ty).id, x: idle.ap });
  const waiting = mine.filter(p => p.m === 1 && !p.pil && !p.go && st.gt >= readyAt(st, p) + 60);
  if (waiting.length && !c.bot) say("noPilot", 4, { n: waiting.length, x: waiting[0].ap });
  const rates = ratesCached(st), said = {};
  for (const rid in c.r) { // sfaturi pe rută din starea de ACUM: preț, avioane, cerere (nu din istoric vechi)
    const cr = c.r[rid], pls = planesOn(st, s, rid); if (!pls.length || !st.rt[rid]) continue;
    const [a, b] = ridEnds(rid), d = dist(a, b), nrm = routeNormal(rid), pmax = Math.max(cr.pa, cr.pb);
    if (pmax > nrm * (K.priceKnee || 1.4) * 1.15) { // mult peste Premium: cererea cade brusc
      const rec = recommend(st, s, rid, cr.pb > cr.pa ? "ba" : "ab");
      say("priceAway", 4, { r: rn(rid), rid, a: pmax, b: Math.round(rec.rec).toLocaleString("ro-RO") + " €" }); said[rid] = 1; continue;
    }
    if (pls.length >= 2) { // prea multe avioane pentru cerere
      const rr = (rates.r[s] || {})[rid] || [0, 0], dem = Math.max(rr[0], rr[1]);
      const cap = pls.reduce((u, p) => u + planeT(p.ty).seats * (p.ch && p.ch.length === 2 ? MIN_DAY / chainCycleMin(p.ty, p.ch[0], p.ch[1]) : legsPerDay(p.ty, d)), 0);
      const util = dem / Math.max(1, cap);
      if (util < 0.4) {
        const keep = Math.max(1, Math.ceil(pls.length * util / 0.7)), mv = pls.length - keep;
        if (mv >= 1) { say("tooManyPlanes", 4, { r: rn(rid), rid, n: mv, k: pls.length, pct: Math.round(100 * (cr.lf !== undefined ? Math.min(cr.lf, util * 1.6) : util)) }); said[rid] = 1; continue; }
      }
    }
  }
  for (const rid in c.r) { const p7 = c.r[rid].p7; if (p7.length >= 3 && !said[rid]) { const avg = p7.slice(-3).reduce((u, v) => u + v, 0) / 3; if (avg < 0) { say("unprofitable", 4, { r: rn(rid), rid, a: Math.round(-avg) }); break; } } }
  for (const p of c.pm) { const nd = permitNeed(c, p, false), sn = slotNeeds(st, s, p.a, p.b); if (nd.ok && sn.every(x => x.ok) && c.cash >= sn.reduce((u, x) => u + x.price, 0)) { say("buildReady", 4, { r: AP(p.a).n + " – " + AP(p.b).n }); break; } }
  for (const rid in c.r) {
    const cr = c.r[rid], pls = planesOn(st, s, rid); if (said[rid] || cr.lf === undefined || !pls.length || !st.rt[rid]) continue;
    const rec = recommend(st, s, rid, "ab"), share = marketDir(st, rid, 0).out[s];
    if (cr.lf < 0.4) { if (cr.pa > rec.rec * 1.15) say("priceHigh", 3, { r: rn(rid), rid, pct: Math.round((share ? share.sh : 0) * 100), a: rec.rec }); else say("emptySeats", 3, { r: rn(rid), rid, pct: Math.round(cr.lf * 100), t: planeT(pls[0].ty).id }); }
    else if (cr.lf > 0.9 && Math.max(cr.qa, cr.qb) > Math.max.apply(null, pls.map(p => planeT(p.ty).seats))) { // coadă REALĂ acum (pasageri care așteaptă), nu doar avioane pline
      if (cr.pa < rec.rec * 0.9) say("priceLow", 2, { r: rn(rid), rid, a: rec.rec, pct: Math.round(cr.lf * 100) }); else say("smallPlane", 3, { r: rn(rid), rid, t: planeT(pls[0].ty).id, pct: Math.round(cr.lf * 100) }); }
  }
  if (c.pm.length) { const best = c.pm.slice().sort((x, y) => rawDemand(st, y.a, y.b) - rawDemand(st, x.a, x.b))[0]; const nd = permitNeed(c, best, false); if (!nd.ok) say("permitNext", 2, { r: AP(best.a).n + " – " + AP(best.b).n, n: nd.jok - c.h[4] }); }
  const fm = fuelMult(st, s); if (fm > 1.15) say("fuelUp", 2, { pct: Math.round((fm - 1) * 100) }); else if (fm < 0.88) say("fuelDown", 1, { pct: Math.round((1 - fm) * 100) });
  const debt = bankDebt(st, s); if (debt > Math.max(1, companyValue(st, s)) * 0.4) say("loanRisk", 3, { a: debt, n: c.bl.length ? Math.min.apply(null, c.bl.map(l => l.d)) : 0 });
  const big = c.h.slice(0, 4).findIndex(n => n >= 6); if (big >= 0) say("ghiseu", 1, { card: RES_KEYS[big], n: c.h[big] });
  const cnt = {}; for (const rid in c.r) ridEnds(rid).forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
  for (const ap in cnt) if (cnt[ap] >= 3 && c.hubs.indexOf(ap) < 0 && c.hubs.length < K.maxHubs) { say("hubSuggest", 2, { x: ap, n: cnt[ap] }); break; }
  if (c.cash > 15e6 && mine.length < 3) say("newRoute", 2, { r: c.pm.length ? AP(c.pm[0].a).n + " – " + AP(c.pm[0].b).n : AP(c.base).n });
  if (!out.length) say("generic", 0, {});
  out.sort((x, y) => y.prio - x.prio);
  return out;
}
/* sfatul afișat trebuie să fie încă adevărat: se reevaluează la fiecare view; dacă problema nu mai există (preț, avioane sau
   coada s-au schimbat), sfatul vechi nu mai e arătat */
function adviceCached(st, s) {
  const key = "a|" + cacheKey(st) + "|" + s; const hit = RCACHE.get(key); if (hit) return hit;
  const r = advice(st, s); if (RCACHE.size > 3000) RCACHE.clear(); RCACHE.set(key, r); return r;
}
function liveTip(st, s) {
  const c = st.c[s]; const t = c && c.tips && c.tips.length ? c.tips[c.tips.length - 1] : null; if (!t) return null;
  let cur; try { cur = adviceCached(st, s); } catch (e) { return t; }
  const ok = cur.some(x => x.key === t.k && (t.rid === undefined || !x.vars || x.vars.rid === undefined || x.vars.rid === t.rid));
  return ok ? t : null;
}
function legal(st, s, now) {
  const c = st.c[s], K = TU(); if (!c) return { canAct: false };
  const ops = !guardOps(st, s);
  const L = { canAct: ops, phase: st.phase };
  if (st.phase === "setup") L.setup = { prof: true, vote: true, tut: !c.bot, ready: !!c.prof, canStart: st.ps.every(x => st.c[x].ready) && !tutBusy(st).length, usedColors: st.ps.filter(x => x !== s && st.c[x].prof).map(x => st.c[x].col) };
  L.buyPlane = allTypes().map(ty => ops && c.cash >= planeT(ty).price);
  L.canDraw = ops && !c.of && c.pm.length < K.maxPermits;
  L.canBank = ops && bankInfo(st, s).limit >= K.bankMin;
  L.paused = !!(st.pz && st.phase === "play");
  L.canNego = st.phase === "play" && !st.ng && !c.out && !c.fz && !(c.ngd === st.day && c.ngn >= K.negoPerDay) ? active(st).filter(x => x !== s) : [];
  L.canPause = !c.bot && st.phase === "play";
  L.canGhiseu = ops && handTotal(c.h) >= K.ghiseuN;
  L.cardPrice = cardPriceNow(c, st); L.canBuyCard = ops && c.cash >= L.cardPrice && c.bc < K.buyMaxPerDay;
  const play = {};
  for (const id in c.sx) {
    if (!c.sx[id] || !ops) { play[id] = false; continue; }
    switch (id) {
      case "frz": play[id] = active(st).filter(x => x !== s && !canFreeze(st, s, x)); break;
      case "fast": play[id] = c.pm.filter(p => permitNeed(c, p, true).ok).map(p => p.id); break;
      case "boom": play[id] = Object.keys(c.r); break;
      case "spy": play[id] = active(st).filter(x => x !== s && Object.keys(st.c[x].r).length); break;
      case "slot": play[id] = Object.keys(st.sl).filter(ap => !hasSlot(st, s, ap) && !slotFree(st, ap)); break;
      case "vip": play[id] = c.pm.length < K.maxPermits; break;
      case "ins": case "brk": play[id] = false; break;
      default: play[id] = true;
    }
  }
  L.play = play;
  if (c.base && st.phase !== "setup") { const ii = invInfo(st, s); L.invest = ops && (ii.base.ok || ii.term.ok || ii.mnt.ok || ii.eco.some(x => x.ok)); } else L.invest = false;
  L.breaker = st.phase !== "nego" && !!(c.fz && c.fz.pu && gameTimeAt(st, now === undefined ? st.at : now) <= c.fz.pu && c.sx.brk);
  L.pick = !!(st.phase === "draft" && st.dr && !st.dr.rv && st.dr.ord[st.dr.i] === s);
  L.nego = null; L.negoInvite = null; L.negoBusy = null;
  if (st.phase === "nego" && st.ng) {
    const ng = ngNorm(st.ng), off = ng.off, party = !!(off && off.parts.indexOf(s) >= 0 && off.by !== s && !off.ok[s]);
    if (inNego(st, s)) L.nego = { canAccept: party, canRefuse: party, canOffer: true, canLeave: true, canInvite: ng.ps.length + ng.inv.length < NG_MAX ? active(st).filter(x => ng.ps.indexOf(x) < 0 && !ng.inv.some(y => y.s === x) && ng.dec.indexOf(x) < 0) : [] };
    const iv = !ng.res && ng.inv.find(x => x.s === s); if (iv) L.negoInvite = { by: iv.by, id: ng.id };
    if (ng.ps.indexOf(s) < 0) L.negoBusy = negoBusyMsg(st, s);
  }
  return L;
}
function myAssets(st, s) { const c = st.c[s]; return { cash: Math.round(c.cash), cards: c.h.slice(), sx: Object.assign({}, c.sx), permits: c.pm.map(p => ({ id: p.id, a: p.a, b: p.b, d: p.d })), routes: Object.keys(c.r), slots: Object.keys(st.sl).filter(ap => hasSlot(st, s, ap) && !slotNeeded(st, s, ap)), planes: st.pl.filter(p => p.s === s && !p.ls && p.m !== 2 && p.m !== 3).map(p => ({ id: p.id, ty: p.ty, name: planeT(p.ty).n, val: planeValue(st, p) })) }; }
function pubAssets(st, s) { const c = st.c[s]; return { routes: Object.keys(c.r), planes: st.pl.filter(p => p.s === s && !p.ls && p.m !== 2 && p.m !== 3).map(p => ({ id: p.id, ty: p.ty, name: planeT(p.ty).n })), permitsN: c.pm.length, cardsN: handTotal(c.h), sxN: Object.keys(c.sx).reduce((u, k) => u + c.sx[k], 0) }; }
/* ======================= R1 (LOGIC-1): aglomerarea rutei, fișa avionului în zbor, panoul aeroportului ======================= */
// câte avioane suportă ruta: cererea pe sensul cel mai aglomerat / (locuri × curse pe zi × 75%) → {planes, suggested, over}
function routeCrowd(st, s, rid, rates) {
  const pl = planesOn(st, s, rid), rr = (((rates || ratesCached(st)).r || {})[s] || {})[rid] || [0, 0], dm = Math.max(rr[0], rr[1]), d = dist.apply(null, ridEnds(rid));
  let w = 0, cap = 0; for (const p of pl) { const f = p.ch && p.ch.length === 2 ? 0.5 : 1; w += f; cap += f * planeT(p.ty).seats * legsPerDay(p.ty, d); }
  let per = w > 0 ? cap / w : 0; if (!per) { const ty = normalPlaneType(st, rid); per = ty >= 0 ? planeT(ty).seats * legsPerDay(ty, d) : 0; }
  const planes = Math.round(w), suggested = per > 0 ? Math.max(1, Math.round(dm / (per * 0.75))) : 0;
  return { planes, suggested, over: planes - suggested };
}
const clockOf = gt => { const h = hourOf(gt), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm; };
const apName = ap => (AP(ap) && (AP(ap).n || AP(ap).name)) || ap;
function planeLeg(p) { if (p.m === 2 || p.m === 3) return [p.fr, p.ap]; if (p.m === 1 && p.rid) return [p.ap, otherEnd(p.rid, p.ap)]; return [p.ap, p.ap]; }
function planePath(p) { if (p.ch && chainPts(p.ch[0], p.ch[1])) { const P = chainPts(p.ch[0], p.ch[1]); return [P.a, P.b, P.c]; } return p.rid ? ridEnds(p.rid) : null; }
function planeFlightNet(st, s, p) { if (!p.rid && p.m !== 3) return null; const [f, t] = planeLeg(p); if (f === t) return null; return Math.round((p.m === 3 ? 0 : p.rv) - flightCost(st, s, p.ty, f, t)); }
function planeCard(st, s, pid) {
  const p = myPlane(st, s, pid); if (!p) return null;
  const pt = planeT(p.ty), [from, to] = planeLeg(p), path = planePath(p), fly = p.m === 2 || p.m === 3;
  const cost = from !== to ? flightCost(st, s, p.ty, from, to) : 0, rates = ratesCached(st);
  const cur = p.rid ? estimate(st, s, p.ch ? { pid, rid: p.ch[0], via: p.ch[1] } : { pid, rid: p.rid }) : null;
  const curP = cur && cur.ok ? cur.profitDay : 0;
  const opts = p.rid ? chainOptions(st, s, { pid }).filter(o => o.ok && (o.rid === p.rid || o.via === p.rid) && !(p.ch && p.ch.indexOf(o.rid) >= 0 && p.ch.indexOf(o.via) >= 0))
    .map(o => { const e = estimate(st, s, { pid, rid: o.rid, via: o.via }); return { rid: o.rid, via: o.via, a: o.a, b: o.b, c: o.c, ok: e.ok, why: e.why || "", profitDay: e.ok ? e.profitDay : null, gain: e.ok ? e.profitDay - curP : null }; })
    .filter(o => o.ok).sort((x, y) => y.gain - x.gain).slice(0, 6) : [];
  const pv = pilotView(st, s, p);
  return { pid: p.id, name: pt.n, tid: pt.id, ty: p.ty, mode: ["idle", "board", "fly", "ferry"][p.m], rid: p.rid, from, to, px: p.px, seats: pt.seats,
    rev: Math.round(p.m === 3 ? 0 : p.rv), cost: Math.round(cost), net: Math.round((p.m === 3 ? 0 : p.rv) - cost),
    eta: fly ? Math.max(0, Math.ceil(p.ta - st.gt)) : null, etaClock: fly ? clockOf(p.ta) : null,
    chain: p.ch && chainPts(p.ch[0], p.ch[1]) ? Object.assign({ r: p.ch.slice() }, chainPts(p.ch[0], p.ch[1])) : null, path, chainTxt: path ? path.map(apName).join(" → ") : "",
    profitDay: p.py !== undefined ? p.py : (cur && cur.ok ? cur.profitDay : null), profitDayEst: cur && cur.ok ? cur.profitDay : null, profitToday: Math.round(p.pt || 0),
    pilot: { on: !!p.pil, min: pv.pilotMin, minSet: pv.pilotMinSet, beN: pv.beN, sub: pv.sub }, queued: queuePos(st, p),
    chainOpts: opts, routeCrowd: p.rid ? routeCrowd(st, s, p.rid, rates) : null };
}
function airportInfo(st, s, ap) {
  const c = st.c[s]; if (!c || !AP(ap)) return null;
  const rates = ratesCached(st), rr = rates.r[s] || {}, K = TU();
  const ground = st.pl.filter(p => p.s === s && p.ap === ap && (p.m === 0 || p.m === 1)).map(p => ({ pid: p.id, name: planeT(p.ty).n, tid: planeT(p.ty).id, rid: p.rid, to: p.m === 1 && p.rid ? otherEnd(p.rid, ap) : null,
    boarded: p.px, seats: planeT(p.ty).seats, waitMin: p.m === 1 ? Math.max(0, Math.round(st.gt - p.t0)) : null, sub: !!(p.pil && p.sub), waitGate: p.m === 1 && p.wg ? p.wg : null, pil: !!p.pil, queued: queuePos(st, p), mode: p.m === 1 ? "board" : "idle" }));
  const mine = Object.keys(c.r).filter(rid => ridEnds(rid).indexOf(ap) >= 0);
  const crowd = {}; for (const rid of mine) crowd[rid] = routeCrowd(st, s, rid, rates);
  const waiting = mine.map(rid => { const cr = c.r[rid], atA = ridEnds(rid)[0] === ap, di = atA ? 0 : 1;
    return { rid, to: otherEnd(rid, ap), q: Math.floor(atA ? cr.qa : cr.qb), dem: Math.round((rr[rid] || [0, 0])[di]), price: atA ? cr.pa : cr.pb, planes: planesOn(st, s, rid).length }; }).sort((x, y) => y.q - x.q);
  const idleHere = ground.filter(g => !g.rid), queuedHere = ground.filter(g => g.queued > 0), overR = mine.filter(rid => crowd[rid].over > 0);
  const status = overR.length || queuedHere.length >= 2 ? "over" : idleHere.length ? "idle" : "balanced";
  const fmt = n => Math.round(n).toLocaleString("ro-RO").replace(/\s/g, ".");
  const rn = rid => ridEnds(rid).join("–");
  const routes = [];
  for (const rid of mine) { const cr = c.r[rid], fx = routeFixed(st, s, rid, cr, st.gt).fixedDay, avg = cr.p7.length ? cr.p7.reduce((u, v) => u + v, 0) / cr.p7.length : cr.pr;
    routes.push({ kind: "route", rid, a: ridEnds(rid)[0], b: ridEnds(rid)[1], d: dist.apply(null, ridEnds(rid)), planes: planesOn(st, s, rid).length, profitDay: Math.round(avg - fx), routeCrowd: crowd[rid] }); }
  for (const pm of c.pm) { if (pm.a !== ap && pm.b !== ap) continue; const rid = ridOf(pm.a, pm.b); let best = null;
    for (const ty of allTypes()) { if (!canServe(ty, rid)) continue; const e = estimate(st, s, { type: ty, rid }); if (e.ok && (!best || e.profitDay > best.profitDay)) best = { ty, profitDay: e.profitDay }; }
    routes.push({ kind: "permit", id: pm.id, a: pm.a, b: pm.b, d: pm.d, dem: Math.round(rawDemand(st, pm.a, pm.b)), ty: best ? best.ty : -1, profitDay: best ? best.profitDay : null }); }
  const freeTy = (() => { const t = {}; for (const p of st.pl) if (p.s === s) t[p.ty] = (t[p.ty] || 0) + 1; return Object.keys(t).map(Number).sort((x, y) => t[y] - t[x]); })();
  let nch = 0;
  for (const o of chainOptions(st, s)) { if (nch >= 6) break; if (o.a !== ap && o.b !== ap && o.c !== ap) continue;
    const ty = freeTy.find(t => !chainCheck(t, o.rid, o.via)); if (ty === undefined) continue;
    const e = estimate(st, s, { type: ty, rid: o.rid, via: o.via }); if (!e.ok) continue; nch++;
    routes.push({ kind: "chain", rid: o.rid, via: o.via, a: o.a, b: o.b, c: o.c, ty, profitDay: e.profitDay }); }
  // O SINGURĂ sugestie numerică
  let hint = null;
  const bestFor = (pidOrTy, isPid, skip) => { let b = null; for (const rid of Object.keys(c.r)) { if (rid === skip) continue; const e = estimate(st, s, isPid ? { pid: pidOrTy, rid } : { type: pidOrTy, rid }); if (e.ok && (!b || e.profitDay > b.e)) b = { rid, e: e.profitDay }; } return b; };
  if (idleHere.length) { const g = idleHere[0], b = bestFor(g.pid, true); if (b && b.e > 0) hint = { k: "idle", pid: g.pid, rid: b.rid, gain: b.e, txt: "Avion liber aici: pune-l pe " + rn(b.rid) + " ≈ +" + fmt(b.e) + " €/zi" }; }
  if (!hint && (overR.length || queuedHere.length >= 2)) { const rid0 = overR[0] || queuedHere[0].rid, g = ground.find(x => x.rid === rid0 && x.queued > 0) || ground.find(x => x.rid === rid0);
    const n = ground.filter(x => x.rid === rid0).length;
    if (g) { const b = bestFor(g.pid, true, rid0); if (b && b.e > 0) hint = { k: "move", pid: g.pid, rid: b.rid, from: rid0, gain: b.e, txt: (n >= 2 ? n + " avioane stau aici" : "Prea multe avioane pe " + rn(rid0)) + ": mută 1 pe " + rn(b.rid) + " ≈ +" + fmt(b.e) + " €/zi" }; } }
  if (!hint) for (const w of waiting) { const cw = crowd[w.rid]; if (cw.over >= 0) continue; const ty = (planesOn(st, s, w.rid)[0] || {}).ty !== undefined ? planesOn(st, s, w.rid)[0].ty : normalPlaneType(st, w.rid);
    if (ty < 0 || w.q < planeT(ty).seats * 0.6) continue; const e = estimate(st, s, { type: ty, rid: w.rid });
    if (e.ok && e.profitDay > 0) { hint = { k: "addPlane", rid: w.rid, ty, gain: e.profitDay, txt: "+1 avion pe " + rn(w.rid) + " ≈ +" + fmt(e.profitDay) + " €/zi" }; break; } }
  return { ap, gates: gateInfo(st, ap), slot: hasSlot(st, s, ap), hub: c.hubs.indexOf(ap) >= 0, base: c.base === ap, ground, waiting, status,
    statusN: status === "over" ? "Prea multe avioane" : status === "idle" ? "Avioane libere" : "Echilibrat", hint, routes };
}
/* acțiune „bulk”: mai multe acțiuni de flotă/preț dintr-odată (atomic implicit) */
const BULK_OK = ["pilot", "pilotMin", "assign", "unassign", "price", "depart"];
ACT.bulk = (st, s, a, now, R) => {
  const acts = Array.isArray(a.acts) ? a.acts : null; if (!acts || !acts.length) return E("Nicio acțiune.");
  if (acts.length > 80) return E("Prea multe acțiuni deodată (max 80).");
  const nm = x => x && (BULK_OK.indexOf(x.a) >= 0 ? x.a : BULK_OK.indexOf(x.t) >= 0 ? x.t : (x.a || x.t)); // sub-acțiuni cu cheia „a” (standard) sau „t”
  for (const x of acts) if (!x || typeof x !== "object" || BULK_OK.indexOf(nm(x)) < 0) return E("Acțiune nepermisă în grup: " + (nm(x) || "?"));
  if (!a.partial) { // atomic: întâi o probă pe o copie (aceeași secvență de numere aleatoare), apoi pe stare doar dacă toate trec
    const tmp = JSON.parse(JSON.stringify(st)), R2 = mulberry(((st.seed | 0) ^ 0x5bd1e995) >>> 0);
    for (let i = 0; i < acts.length; i++) { const x = acts[i], r = ACT[nm(x)](tmp, s, x, now, R2) || OK; if (!r.ok) return E((i + 1) + "/" + acts.length + ": " + r.err); }
  }
  let done = 0, firstErr = null;
  for (let i = 0; i < acts.length; i++) {
    const x = acts[i], r = ACT[nm(x)](st, s, x, now, R) || OK;
    if (r.ok) { done++; continue; }
    if (!firstErr) firstErr = (i + 1) + "/" + acts.length + ": " + r.err;
  }
  if (!done) return E(firstErr || "Nicio acțiune aplicată.");
  return firstErr ? { ok: true, n: done, warn: firstErr } : { ok: true, n: done };
};
function view(st, s, now) {
  now = now === undefined ? st.at : now;
  const gt = gameTimeAt(st, now), K = TU(), c = (st.c && st.c[s]) || null, d = D();
  const ci = clockInfo(st, now);
  const ranks = {}; active(st).map(x => [x, companyValue(st, x)]).sort((x, y) => y[1] - x[1]).forEach((x, i) => { ranks[x[0]] = i + 1; });
  const V = { me: s, phase: st.phase, gt, clock: ci, paused: !st.run, why: ci.why, host: st.host, day: st.day, setup: null, n: st.ps.length,
    region: st.reg ? regionView(st) : null, yields: yieldTable(), planeOrder: TU().ORDER.slice() };
  if (st.phase === "setup") V.setup = { players: st.ps.map(x => { const o = st.c[x]; return { seat: x, name: o.name, co: o.co, col: o.col, av: o.av, g: o.g, bot: !!o.bot, prof: !!o.prof, ready: !!o.ready, vote: o.vote, tut: o.tut ? { step: o.tut.step, of: o.tut.of } : null }; }),
    tutBusy: tutBusy(st).length > 0, allReadyAt: st.su.at, resolveLeft: st.su.at && !tutBusy(st).length ? Math.max(0, Math.ceil((st.su.at + wallMs(st, K.setupResolveSec) - now) / 1000)) : null, dur: st.dur, dl: st.dl };
  const live = st.phase !== "setup";
  const rates = c && live ? ratesCached(st) : null;
  if (c && live) {
    const debt = bankDebt(st, s), owes = st.ln.filter(l => l.b === s).reduce((a, l) => a + l.rep, 0);
    V.co = { seat: s, name: c.name, co: c.co, col: c.col, av: c.av, g: c.g, cash: Math.round(c.cash), value: companyValue(st, s), debt, owes, stars: Math.round(stars(st, s)), starsF: r2(stars(st, s)), rep: r2(c.rep),
      planes: st.pl.filter(p => p.s === s).length, cs: c.cs, neg: c.neg, negLeft: c.cash < 0 ? Math.max(0, K.negDays - c.neg + 1) : null, out: c.out, cons: c.cons, base: c.base, hubs: c.hubs.slice(),
      tip: liveTip(st, s), tips: c.tips.slice(), fuelIdx: r2((st.fi || 1) * (st.cf || 1)), fuelMult: r2(fuelMult(st, s)), rank: ranks[s] || null,
      today: { rev: Math.round(c.today.rev), cost: Math.round(c.today.cost) }, hist: c.hist.slice(), last: c.lsd, daily: dailyCosts(st, s), stats: c.st, bot: !!c.bot,
      startBonus: bonusOn(st) && st.phase !== "end" ? { left: K.bonusDays - st.day + 1, until: K.bonusDays, cut: r2(1 - K.bonusFee) } : null };
    V.invest = invInfo(st, s);
    V.hubInfo = hubInfo(st, s);
    V.chainOpts = chainOptions(st, s);
    V.permitRange = permitRange(st, s);
    V.leaseRamp = { today: leaseMult(st), tomorrow: leaseMult(st, st.day + 1), fullFrom: K.leaseRampTo > K.leaseRampFrom ? K.leaseRampTo : K.bonusDays + 1, days: [0, 1, 2, 3, 4, 5].map(i => ({ day: st.day + i, mult: leaseMult(st, st.day + i) })).filter(x => x.mult < 1 || x.day === st.day) };
    V.groundByAp = {}; for (const p of st.pl) if (p.s === s && (p.m === 0 || p.m === 1)) V.groundByAp[p.ap] = (V.groundByAp[p.ap] || 0) + 1;
    V.tax = { free: taxFreeOf(st, s), rate: K.taxRate, last: c.lpt || 0 };
    V.frozen = c.fz ? { left: Math.max(0, Math.ceil((c.fz.e - gt) / rate(st) / 1000)), leftMs: Math.max(0, Math.round((c.fz.e - gt) / rate(st))), by: c.fz.by, prompt: !!(c.fz.pu && gt <= c.fz.pu),
      promptLeft: c.fz.pu ? Math.max(0, Math.ceil((c.fz.pu - gt) / rate(st) / 1000)) : 0, canBreak: !!(c.fz.pu && gt <= c.fz.pu && c.sx.brk) } : null;
    V.cards = { h: c.h.slice(), sx: Object.assign({}, c.sx), buyPrice: cardPriceNow(c, st), heat: r2(cardHeat(st, c)), bought: c.bc, buyMax: K.buyMaxPerDay, canGhiseu: handTotal(c.h) >= K.ghiseuN, pool: Object.assign({}, st.pool) };
    V.permits = c.pm.map(p => { const nd = permitNeed(c, p, false), nf = permitNeed(c, p, true), sn = slotNeeds(st, s, p.a, p.b), cost = sn.reduce((a, x) => a + x.price, 0);
      const why = !nd.ok ? "Îți lipsesc cărți" : sn.some(x => !x.ok) ? "Aeroport plin" : c.cash < cost ? "Nu ai bani pentru sloturi" : "";
      return { id: p.id, a: p.a, b: p.b, d: p.d, cls: clsName(p.d), k: p.k.slice(), miss: nd.miss, jok: nd.jok, canBuild: !why && !c.fz && V.phase !== "draft", canFast: !!c.sx.fast && nf.ok && !c.fz, slots: sn, cost, why,
        dem: Math.round(rawDemand(st, p.a, p.b)), normal: normalPrice(p.d, p.a, p.b), yieldMult: yieldMult(p.a, p.b), types: allTypes().filter(t => canServe(t, ridOf(p.a, p.b))) }; });
    V.offer = c.of ? c.of.map(p => Object.assign({}, p, { cls: clsName(p.d), dem: Math.round(rawDemand(st, p.a, p.b)), normal: normalPrice(p.d, p.a, p.b), yieldMult: yieldMult(p.a, p.b), types: allTypes().filter(t => canServe(t, ridOf(p.a, p.b))) })) : null;
    V.canDraw = !c.of && c.pm.length < K.maxPermits;
    V.routes = Object.keys(c.r).map(rid => {
      const cr = c.r[rid], [a, b] = ridEnds(rid), dd = dist(a, b), rr = (rates.r[s] || {})[rid] || [0, 0], sh = (rates.sh[s] || {})[rid] || [0, 0], rt = st.rt[rid];
      return { rid, a, b, d: dd, pa: cr.pa, pb: cr.pb, normal: normalPrice(dd, a, b), yieldMult: yieldMult(a, b), rec: recommend(st, s, rid, "ab"), recBa: recommend(st, s, rid, "ba"), dem: { ab: Math.round(rr[0]), ba: Math.round(rr[1]) },
        share: { ab: r2(sh[0]), ba: r2(sh[1]) }, q: { ab: Math.floor(cr.qa), ba: Math.floor(cr.qb) }, planes: planesOn(st, s, rid).map(p => p.id), comp: servers(st, rid).length - 1,
        today: Math.round(cr.pr), yday: cr.py || 0, p7: cr.p7.reduce((x, y) => x + y, 0), hist: cr.p7.slice(), lf: cr.lf === undefined ? null : r2(cr.lf), pio: !!(rt && rt.pio === s && rt.pu > gt),
        boom: c.fx.some(f => f.k === "boom" && f.rid === rid && f.u > gt), closed: isClosed(st, a, s) || isClosed(st, b, s), ramp: r2(routeRamp(st, rid)), types: allTypes().filter(t => canServe(t, rid)), flights: cr.f || 0, starter: !!cr.st0,
        chains: st.pl.filter(p => p.s === s && p.ch && p.ch.indexOf(rid) >= 0).length, routeCrowd: routeCrowd(st, s, rid, rates), ...routeFixed(st, s, rid, cr, gt) };
    });
    V.planes = st.pl.filter(p => p.s === s).map(p => {
      const pt = planeT(p.ty), pos = planePos(st, p, gt), ra = p.m === 1 ? readyAt(st, p) : null;
      return { id: p.id, ty: p.ty, tid: pt.id, name: pt.n, seats: pt.seats, range: pt.range, age: planeAge(st, p), val: planeValue(st, p), sellVal: p.ls ? -Math.round(pt.lease * K.leaseReturnDays) : Math.round(planeValue(st, p) * K.sellMult),
        rid: p.rid, m: p.m, mode: ["idle", "board", "fly", "ferry"][p.m], ap: p.ap, fr: p.fr, to: p.m === 1 && p.rid ? otherEnd(p.rid, p.ap) : p.ap, px: p.px, cap: pt.seats, load: r2(p.px / pt.seats),
        ready: p.m === 1 && gt >= ra, readyIn: p.m === 1 ? Math.max(0, Math.ceil(ra - gt)) : null, canDepart: p.m === 1 && !c.fz && !isClosed(st, p.ap, s) && (!p.rid || !isClosed(st, otherEnd(p.rid, p.ap), s)),
        pil: p.pil, pilotFee: pt.pilot, ...pilotView(st, s, p), ls: p.ls, ...(p.ls ? leaseInfo(st, p) : { leasePaid: null, buyoutPrice: null, daysToOwn: null }), go: p.go, ud: p.ud, pos, eta: p.m === 2 || p.m === 3 ? Math.max(0, Math.ceil(p.ta - gt)) : null, dly: p.dly > gt ? Math.ceil(p.dly - gt) : 0,
        frozen: !!c.fz, rv: Math.round(p.rv), lp: p.lp === undefined ? null : p.lp, waitGate: p.m === 1 && p.wg ? p.wg : null,
        via: p.ch ? (p.ch[0] === p.rid ? p.ch[1] : p.ch[0]) : null, chain: p.ch && chainPts(p.ch[0], p.ch[1]) ? Object.assign({ r: p.ch.slice() }, chainPts(p.ch[0], p.ch[1])) : null, cost: p.rid && p.m === 1 ? flightCost(st, s, p.ty, p.ap, otherEnd(p.rid, p.ap)) : null,
        legFrom: planeLeg(p)[0], legTo: planeLeg(p)[1], rev: Math.round(p.m === 3 ? 0 : p.rv), flightNet: planeFlightNet(st, s, p), path: planePath(p), profitToday: Math.round(p.pt || 0), profitDay: p.py !== undefined ? p.py : null,
        queued: queuePos(st, p), routeCrowd: p.rid ? ((V.routes.find(r => r.rid === p.rid) || {}).routeCrowd || null) : null };
    });
    V.shop = { order: TU().ORDER.slice(), new: allTypes().map(ty => ({ ty, tid: planeT(ty).id, name: planeT(ty).n, price: planeT(ty).price, ok: c.cash >= planeT(ty).price, seats: planeT(ty).seats, range: planeT(ty).range, speed: planeT(ty).speed, minSize: planeT(ty).minSize, maint: planeT(ty).maint, pilot: planeT(ty).pilot })),
      used: st.um.map(u => Object.assign({}, u, { tid: planeT(u.ty).id, name: planeT(u.ty).n, ok: c.cash >= u.pr })), lease: allTypes().map(ty => ({ ty, tid: planeT(ty).id, name: planeT(ty).n, fee: planeT(ty).lease })),
      maxLeased: K.maxLeased, leased: st.pl.filter(p => p.s === s && p.ls).length, consFee: K.consFee, usedNext: (st.umd || 0) + K.usedDays,
      slotPrice: [0, 1, 2, 3].map(z => K.slotPrice[z] || 0), hubPrice: [0, 1, 2, 3].map(z => K.hubPrice[z] || 0) };
    const bi = bankInfo(st, s);
    V.bank = { limit: bi.limit, rate: bi.rate, rates: bi.rates, score: c.cs, terms: K.bankTerms.slice(), min: K.bankMin, debt,
      loans: c.bl.map(l => ({ id: l.id, p: Math.round(l.p), p0: l.p0, d: l.d, n: l.n, inst: Math.round(l.p / l.d + l.p * l.r), r: l.r })) };
    V.loans = st.ln.filter(l => l.l === s || l.b === s).map(l => Object.assign({}, l, { mine: l.l === s ? "lend" : "borrow", left: l.due - st.day }));
    V.pacts = st.pacts.filter(p => p.a === s || p.b === s).map(p => ({ with: p.a === s ? p.b : p.a, u: p.u, left: p.u - st.day }));
    const spy = c.fx.find(f => f.k === "spy" && f.u > gt);
    V.spy = spy && st.c[spy.s] && st.c[spy.s].r[spy.rid] ? { target: spy.s, rid: spy.rid, pa: st.c[spy.s].r[spy.rid].pa, pb: st.c[spy.s].r[spy.rid].pb, today: Math.round(st.c[spy.s].r[spy.rid].pr), p7: st.c[spy.s].r[spy.rid].p7.reduce((x, y) => x + y, 0), left: Math.ceil((spy.u - gt) / 60) } : null;
    V.fx = c.fx.filter(f => f.u > gt).map(f => ({ k: f.k, rid: f.rid, s: f.s, left: Math.ceil((f.u - gt) / 60) }));
    V.whisper = st.dr && st.dr.wh[s] !== undefined && !st.dr.rv && st.dr.tk[st.dr.wh[s]] === null ? { i: st.dr.wh[s], c: st.dr.cards[st.dr.wh[s]] } : null;
  }
  V.opp = st.ps.filter(x => x !== s).map(x => { const o = st.c[x]; const pl = st.pl.filter(p => p.s === x);
    return { seat: x, name: o.name, co: o.co, col: o.col, av: o.av, g: o.g, bot: !!o.bot, stars: Math.round(stars(st, x)), planes: pl.length, inAir: pl.filter(p => p.m === 2 || p.m === 3).length,
      rank: ranks[x] || null, out: o.out, frozen: !!o.fz, routes: Object.keys(o.r), base: o.base, hubs: o.hubs.slice(), pact: st.pacts.some(p => (p.a === s && p.b === x) || (p.b === s && p.a === x)) }; });
  if (live) {
    const lines = [], planes = [], aps = {};
    for (const x of st.ps) { const o = st.c[x]; if (o.out) continue; for (const rid in o.r) { const [a, b] = ridEnds(rid); lines.push({ rid, a, b, s: x, mine: x === s, col: o.col }); } }
    for (const p of st.pl) { if (p.s !== s && p.m !== 2 && p.m !== 3) continue; const pos = planePos(st, p, gt); planes.push({ id: p.id, s: p.s, ty: p.ty, lat: r3(pos.lat), lon: r3(pos.lon), hd: pos.heading, prog: r3(pos.prog), mode: pos.phase, frz: !!st.c[p.s].fz, mine: p.s === s, fr: p.fr, to: p.ap, col: st.c[p.s].col, t0: p.t0, ta: p.ta }); }
    for (const ap in st.sl) aps[ap] = { slots: slotUsed(st, ap), cap: slotCap(st, ap), mine: hasSlot(st, s, ap), seats: st.sl[ap].slice(), hub: st.ps.filter(x => st.c[x].hubs.indexOf(ap) >= 0), base: st.ps.filter(x => st.c[x].base === ap), gates: gateInfo(st, ap) };
    V.map = { lines, planes, airports: aps, closed: d.AIRPORTS.filter(a => isClosed(st, a.id, null)).map(a => a.id), bases: st.ps.map(x => ({ s: x, ap: st.c[x].base, col: st.c[x].col })) };
    V.events = st.ev.map(e => { const def = evDef(e.id) || {}; return { id: e.id, k: e.k, n: def.n || e.id, icon: def.icon || "", txt: def.d ? String(def.d).replace(/\{loc\}/g, e.loc || "").replace(/\{p\}/g, e.tt === "company" && st.c[e.tg] ? st.c[e.tg].co : "") : (def.txt || ""),
      tt: e.tt, tg: e.tg, loc: e.loc, left: e.u - st.day + 1, leftMin: e.ue ? Math.max(0, Math.round(e.ue - st.gt)) : null, ef: def.ef || "", eff: def.eff || "", fix: def.fix || "", chip: def.chip ? String(def.chip).replace(/\{loc\}/g, e.loc || "").replace(/\{p\}/g, e.tt === "company" && st.c[e.tg] ? st.c[e.tg].co : "") : "", neg: !!def.neg, mood: def.mood || (def.neg ? "rau" : "bun"), ex: (e.ex || []).indexOf(s) >= 0, fx: def.fx || {} }; });
    V.shares = st.ps.filter(x => !st.c[x].out).map(x => { const h = st.sh[x] || {}; const held = Object.keys(h).reduce((a, k) => a + h[k], 0); return { co: x, name: st.c[x].co, price: sharePrice(st, x), own: h[s] || 0, held, free: K.shareMax - held, mine: x === s, ownPct: 100 - held, fee: K.shareFee }; });
  }
  if (st.dr) {
    const dr = st.dr;
    V.draft = { cards: dr.cards.map((cd, i) => { const shown = dr.tk[i] !== null || dr.rv; return { i, c: shown ? cd : null, got: dr.tk[i] !== null && dr.cv && dr.cv[i] !== undefined ? dr.cv[i] : (dr.tk[i] !== null ? cd : null), by: dr.tk[i], whisper: dr.wh[s] === i && !shown ? cd : null }; }),
      ord: dr.ord.slice(), i: dr.i, turn: dr.rv ? null : dr.ord[dr.i], mine: !dr.rv && dr.ord[dr.i] === s, left: Math.max(0, Math.ceil(((dr.rv ? dr.end : dr.t) - now) / 1000)), deadline: dr.rv ? dr.end : dr.t, reveal: !!dr.rv,
      picks: (() => { const o = {}; for (const x of st.ps) o[x] = dr.tk.map((y, i) => y === x ? (dr.cv && dr.cv[i] !== undefined ? dr.cv[i] : dr.cards[i]) : null).filter(y => y !== null); return o; })(),
      whisper: dr.wh[s] !== undefined ? dr.wh[s] : null, day: dr.day, settle: c ? c.lsd : null };
  } else V.draft = null;
  if (st.ng) {
    const ng = ngNorm(st.ng), me = ng.ps.indexOf(s) >= 0, w = me ? ng.ps.find(x => x !== s) : null, iv = ng.inv.find(x => x.s === s);
    const others = {}; if (me) for (const x of ng.ps) if (x !== s) others[x] = pubAssets(st, x);
    V.nego = { id: ng.id, a: ng.a, b: ng.b, ps: ng.ps.slice(), inv: ng.inv.map(x => ({ s: x.s, by: x.by })), dec: ng.dec.slice(), me, spect: !me, invited: iv ? { by: iv.by } : null,
      with: w, off: ng.off, msgs: ng.msgs.slice(), left: Math.max(0, Math.ceil((ng.until - now) / 1000)), deadline: ng.until, res: ng.res, req: !!ng.req, last: ng.last || null,
      busy: me ? null : negoBusyMsg(st, s), max: NG_MAX,
      items: me ? { mine: myAssets(st, s), theirs: others[w] || null, others } : null };
  } else V.nego = null;
  V.lastNego = st.lastNg || null;
  r1View(st, s, now, V);
  V.log = st.log.slice(); V.err = (st.err && st.err[s]) || null; V.ack = (st.ack && st.ack[s]) || 0;
  V.legal = legal(st, s, now);
  V.res = st.res;
  return V;
}
/* ======================= R1 LOGIC-2: anulare, raport de zi, ziar, istoric valoare, reacții, risc împrumut ======================= */
function T1(sec, key, def) { TU(); const o = TUsrc && TUsrc[sec]; return o && o[key] !== undefined && o[key] !== null ? o[key] : def; }
const REACTS = ["👍", "😂", "😮", "😡", "🎉", "😢", "🔥", "👏", "Bravo!", "Hai noroc!", "Ups!", "Nu se poate!", "Ne vedem la bursă!", "Mersi!"];
const OPT_MONEY = ["low", "normal", "high"], OPT_EV = ["few", "normal", "many"];
const optOf = st => (st && st.opt) || { money: "normal", ev: "normal" };
function startCashMult(st) { const t = T1("startOpts", "cash", { low: 0.6, normal: 1, high: 1.75 }); return +t[optOf(st).money] || 1; }
function evFreqMult(st) { const t = T1("startOpts", "events", { few: 0.5, normal: 1, many: 1.7 }); return +t[optOf(st).ev] || 1; }
const fmtN = n => (n < 0 ? "−" : "") + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const fmtS = n => (n > 0 ? "+" : "") + fmtN(n);
const fmtM = n => (Math.round(n / 1e5) / 10).toFixed(1).replace(".", ",") + " M €";
/* ---- valoarea: aceiași pași live și la final (V.co.valueParts == st.res.vals[i].steps) ---- */
function shRaised(st, iss) { return Math.max(0, (st.shc && st.shc[iss]) || 0); } // bani strânși din vânzarea de acțiuni proprii (nu se diluează în acționari)
function opBase(st, iss) { return baseValue(st, iss) - shRaised(st, iss); }
function valueSteps(st, s) {
  const c = st.c[s], steps = [];
  if (!c || c.out) { steps.push({ k: "out", label: "Faliment — compania a ieșit din joc", v: 0 }); return steps; }
  const v = valueParts(st, s);
  steps.push({ k: "cash", label: "Numerar", v: v.cash });
  steps.push({ k: "debt", label: "1) Datorii la bancă rambursate", v: v.debt });
  steps.push({ k: "loans", label: "2) Împrumuturi între jucători decontate", v: v.loans });
  steps.push({ k: "planes", label: "3) Avioane (valoare amortizată)", v: v.planes });
  steps.push({ k: "routes", label: "3) Rute", v: v.routes });
  steps.push({ k: "slots", label: "3) Sloturi și huburi", v: v.slots + v.hubs });
  steps.push({ k: "inv", label: "3) Investiții", v: v.inv || 0 });
  steps.push({ k: "cards", label: "4) Cărți rămase și permise neconstruite", v: v.cards });
  const sum = steps.reduce((a, x) => a + x.v, 0);
  steps.push({ k: "shares", label: "5) Acțiuni (ale altora la tine / ale tale la alții)", v: companyValue(st, s) - sum }); // + rotunjiri → totalul e exact valoarea live
  return steps;
}
/* ---- evenimente: ponderate spre regiunile unde operează jucătorii ---- */
function servedSet(st) { const sv = new Set(); for (const s of active(st)) network(st, s).forEach(a => sv.add(a)); return sv; }
function evRel(e, sv) { // 1 = atinge zona jucătorilor; altfel farWeight
  const sc = e.scope || { type: "global" }, far = T1("events", "farWeight", 0.15), A = Array.from(sv).map(AP).filter(Boolean);
  if (!A.length) return 1;
  const any = f => A.some(f) ? 1 : far;
  switch (sc.type) {
    case "airport": return sc.ids ? any(a => sc.ids.indexOf(a.id) >= 0) : any(a => (!sc.minSize || a.size >= sc.minSize) && (!sc.tag || (a.tags || []).indexOf(sc.tag) >= 0));
    case "region": return any(a => (sc.regs || []).indexOf(a.reg) >= 0);
    case "cont": return sc.conts && sc.conts.length ? any(a => sc.conts.indexOf(a.cont) >= 0) : 1;
    case "tag": return any(a => (a.tags || []).indexOf(sc.tag || "plajă") >= 0);
    default: return 1;
  }
}
const evLocal = () => T1("events", "localPref", 0.9); // șansa ca un eveniment local să cadă unde operează cineva
/* ---- risc împrumut între jucători (doar informativ; limitele nu se schimbă) ---- */
function loanRisk(st, from, to, amount) {
  const c = st && st.c && st.c[to]; if (!c || c.out) return { level: "mare", ratio: 9, value: 0, debt: 0 };
  const v = companyValue(st, to), debt = bankDebt(st, to) + (st.ln || []).filter(l => l.b === to).reduce((a, l) => a + l.rep, 0);
  const ratio = v > 0 ? (Math.max(0, +amount || 0) + debt) / v : 9, th = T1("loanRisk", "levels", [0.25, 0.6]);
  return { level: ratio < th[0] ? "mic" : ratio < th[1] ? "mediu" : "mare", ratio: r2(ratio), value: v, debt: Math.round(debt) };
}
/* ---- rival intrat pe ruta ta ---- */
function shareOf(st, s, rid, ovf) { let mine = 0, tot = 0; for (let di = 0; di < 2; di++) { const m = marketDir(st, rid, di, ovf ? ovf(di) : undefined); tot += m.tot; if (m.out[s]) mine += m.out[s].d; } return tot > 0 ? clamp(mine / tot, 0, 1) : 0; }
function rivalIn(st, who, rid) {
  try {
    const c = st.c[who], keep = c && c.r[rid]; if (!keep) return;
    const vict = servers(st, rid).filter(x => x !== who); if (!vict.length) return;
    delete c.r[rid]; const before = {}; for (const v of vict) before[v] = shareOf(st, v, rid); c.r[rid] = keep;
    const ovf = di => { const p = di ? keep.pb : keep.pa; return { s: who, A: attractN(st, who, rid, di ? "ba" : "ab", p, 1), p }; };
    for (const v of vict) logp(st, "rivalIn", { rid, who, o: v, shareBefore: r2(before[v]), shareAfter: r2(shareOf(st, v, rid, ovf)) });
  } catch (e) { /* informativ: nu blochează construcția */ }
}
/* ---- anulare (undo) ~8 s reale ---- */
const UNDO_K = { buyPlane: 1, assign: 1, unassign: 1, price: 1, slot: 1, build: 1 };
const UNDO_KEEP = { react: 1, undo: 1, pause: 1, negoSay: 1, tut: 1, vote: 1, ready: 1, prof: 1 };
const undoSec = () => T1("undo", "sec", 8);
const BUILD_ST = ["routes", "cardsBuilt", "longestRoute", "routesMax", "pioneer", "slots", "specials", "conts", "airports"];
function qSnap(c, rids) { const o = {}; for (const r of rids) if (r && c.r[r] && !o[r]) o[r] = [c.r[r].qa, c.r[r].qb]; return o; }
function undoObjs(st, s, name, a) {
  const o = [], c = st.c[s]; if (!a || typeof a !== "object") return o;
  if (typeof a.rid === "string") o.push("rt:" + a.rid); if (typeof a.via === "string") o.push("rt:" + a.via);
  if (typeof a.ap === "string") o.push("ap:" + a.ap); if (a.pid !== undefined) o.push("pl:" + a.pid);
  if (a.permitId !== undefined && c) { const p = c.pm.find(x => x.id === a.permitId); if (p) o.push("rt:" + ridOf(p.a, p.b), "ap:" + p.a, "ap:" + p.b); }
  return o;
}
function undoPre(st, s, name, a) {
  const c = st.c[s]; if (!c || !UNDO_K[name] || !a) return null;
  const u = { k: name, cash: c.cash, objs: undoObjs(st, s, name, a) };
  if (name === "buyPlane") { u.pids = st.pl.filter(p => p.s === s).map(p => p.id); u.stt = { planesBought: c.st.planesBought, usedBought: c.st.usedBought, leased: c.st.leased };
    if (a.used !== undefined && a.used !== null && a.used !== false) { const um = st.um.find(x => x.id === a.used); if (um) { u.um = clone(um); u.umi = st.um.indexOf(um); u.umd = st.umd; } } }
  else if (name === "assign" || name === "unassign") { const p = myPlane(st, s, a.pid); if (!p) return null; u.pid = p.id; u.p0 = clone(p); u.rids = [p.rid, a.rid, a.via].concat(p.ch || []).filter(x => typeof x === "string"); u.q0 = qSnap(c, u.rids); }
  else if (name === "price") { const cr = c.r[a.rid]; if (!cr) return null; u.rid = a.rid; u.pa = cr.pa; u.pb = cr.pb; u.rids = [a.rid]; u.q0 = qSnap(c, u.rids); }
  else if (name === "slot") u.ap = a.ap;
  else if (name === "build") { const p = c.pm.find(x => x.id === a.permitId); if (!p) return null;
    u.rid = ridOf(p.a, p.b); u.pmi = c.pm.indexOf(p); u.pm = clone(p); u.h = c.h.slice(); u.rep = c.rep; u.fast = !!a.fast; u.ret = st.ret.length; u.rtHad = !!st.rt[u.rid];
    u.slots = Object.keys(st.sl).filter(ap => hasSlot(st, s, ap)); u.stb = {}; for (const k of BUILD_ST) if (c.st[k] !== undefined) u.stb[k] = clone(c.st[k]); }
  return u;
}
function undoPost(st, s, name, a, u, now, objs) {
  try {
    st.ud = st.ud || {}; const c = st.c[s];
    for (const o in st.ud) if (o !== s && st.ud[o] && (st.ud[o].objs || []).some(k => objs.indexOf(k) >= 0)) delete st.ud[o]; // alt jucător a atins același obiect
    if (!u) { if (!UNDO_KEEP[name]) delete st.ud[s]; return; }
    u.at = now; u.day = st.day; u.cash1 = c.cash;
    if (name === "buyPlane") { const p = st.pl.find(x => x.s === s && u.pids.indexOf(x.id) < 0); if (!p) { delete st.ud[s]; return; }
      u.pid = p.id; u.k2 = u.um ? "used" : p.ls ? "lease" : "buy"; u.what = (u.um ? "Cumpărare second-hand " : p.ls ? "Leasing " : "Cumpărare ") + planeT(p.ty).n; delete u.pids; }
    else if (name === "assign" || name === "unassign") { const p = myPlane(st, s, u.pid); u.t1 = p.t0; u.m1 = p.m; u.q1 = qSnap(c, u.rids); u.what = (name === "assign" ? "Mutare " : "Scoatere de pe rută ") + planeT(p.ty).n; }
    else if (name === "price") { u.f1 = c.r[u.rid].f || 0; u.q1 = qSnap(c, u.rids); const [x, y] = ridEnds(u.rid); u.what = "Preț " + AP(x).n + "–" + AP(y).n; }
    else if (name === "slot") u.what = "Slot " + AP(u.ap).n;
    else if (name === "build") { u.rep1 = c.rep; u.pio = !u.rtHad && !!st.rt[u.rid] && st.rt[u.rid].pio === s; const [x, y] = ridEnds(u.rid); u.what = "Construire " + AP(x).n + "–" + AP(y).n; }
    st.ud[s] = u;
  } catch (e) { if (st.ud) delete st.ud[s]; }
}
function qRestore(c, u) { for (const r in u.q0) { const cr = c.r[r], q1 = u.q1 && u.q1[r]; if (!cr || !q1) continue; cr.qa = Math.max(0, cr.qa + u.q0[r][0] - q1[0]); cr.qb = Math.max(0, cr.qb + u.q0[r][1] - q1[1]); } }
function undoInfo(st, s, now) {
  const u = st.ud && st.ud[s]; if (!u || u.day !== st.day || st.phase !== "play") return null;
  const until = u.at + wallMs(st, undoSec()), left = until - (now === undefined ? st.at : now); if (left <= 0) return null;
  return { k: u.k2 || u.k, what: u.what || "", until, leftMs: Math.round(left), left: Math.ceil(left / 1000) };
}
ACT.undo = (st, s, a, now) => {
  const g = guardOps(st, s); if (g) return g;
  const u = st.ud && st.ud[s]; if (!u) return E("Nu ai nimic de anulat.");
  delete st.ud[s];
  if (u.day !== st.day || now - u.at > wallMs(st, undoSec()) + T1("undo", "graceMs", 1500)) return E("Prea târziu: poți anula doar în primele " + undoSec() + " secunde.");
  const c = st.c[s], dcash = u.cash - u.cash1;
  if (u.k === "buyPlane") {
    const p = st.pl.find(x => x.id === u.pid && x.s === s); if (!p) return E("Avionul nu mai e în flotă.");
    if (p.rid || p.m) return E("Avionul a fost deja folosit.");
    st.pl = st.pl.filter(x => x !== p); c.cash += dcash; Object.assign(c.st, u.stt);
    if (u.um && st.umd === u.umd && !st.um.some(x => x.id === u.um.id)) st.um.splice(Math.min(u.umi, st.um.length), 0, u.um);
  } else if (u.k === "assign" || u.k === "unassign") {
    const p = myPlane(st, s, u.pid); if (!p) return E("Avionul nu mai e în flotă.");
    if (p.t0 !== u.t1 || p.m !== u.m1) return E("Avionul a decolat deja: nu se mai poate anula.");
    deboard(st, p); qRestore(c, u);
    for (const k of Object.keys(p)) delete p[k]; Object.assign(p, u.p0);
  } else if (u.k === "price") {
    const cr = c.r[u.rid]; if (!cr) return E("Nu mai operezi ruta.");
    if ((cr.f || 0) !== u.f1) return E("Un avion a plecat deja cu prețul nou.");
    cr.pa = u.pa; cr.pb = u.pb; qRestore(c, u);
  } else if (u.k === "slot") {
    if (!hasSlot(st, s, u.ap)) return E("Nu mai ai slotul.");
    if (slotNeeded(st, s, u.ap) || ivOf(c).t.indexOf(u.ap) >= 0) return E("Slotul e deja folosit.");
    remSlot(st, s, u.ap); c.cash += dcash; c.st.slots = Math.max(0, (c.st.slots || 0) - 1);
  } else if (u.k === "build") {
    const rid = u.rid; if (!c.r[rid]) return E("Nu mai operezi ruta.");
    if (st.pl.some(p => p.s === s && (p.rid === rid || (p.ch && p.ch.indexOf(rid) >= 0)))) return E("Ruta are deja avioane.");
    if (c.r[rid].f || c.r[rid].pr) return E("Ruta a avut deja zboruri.");
    delete c.r[rid];
    for (const ap of Object.keys(st.sl)) if (hasSlot(st, s, ap) && u.slots.indexOf(ap) < 0 && !slotNeeded(st, s, ap)) remSlot(st, s, ap);
    if (!servers(st, rid).length && (u.pio || !u.rtHad)) delete st.rt[rid];
    else if (u.pio && st.rt[rid]) { st.rt[rid].pio = null; st.rt[rid].pu = 0; }
    const pay = u.h.map((x, i) => x - (c.h[i] || 0)); // cărțile plătite revin
    for (let i = 0; i < 5; i++) c.h[i] = Math.max(0, (c.h[i] || 0) + Math.max(0, pay[i]));
    c.pm.splice(Math.min(u.pmi, c.pm.length), 0, u.pm);
    c.rep = clamp(c.rep - (u.rep1 - u.rep), K1().repMin, K1().repMax); c.cash += dcash; Object.assign(c.st, u.stb);
    if (u.fast) { c.sx.fast = (c.sx.fast || 0) + 1; for (let i = st.ret.length - 1; i >= u.ret; i--) if (st.ret[i][0] === "fast") { st.ret.splice(i, 1); break; } }
  } else return E("Acțiunea nu se poate anula.");
  logp(st, "undo", { s, x: u.k2 || u.k }); st.mv++;
  return OK;
};
const K1 = () => TU();
/* ---- reacții ---- */
ACT.react = (st, s, a, now) => {
  const c = st.c[s]; if (!c) return E("Loc inexistent.");
  let e = a.e; if (typeof e === "number") e = REACTS[e | 0]; if (REACTS.indexOf(e) < 0) return E("Reacție necunoscută.");
  st.rx = st.rx || []; const mine = st.rx.filter(x => x.s === s), t = now === undefined ? st.at : now;
  if (mine.length && t - mine[mine.length - 1].t < wallMs(st, T1("react", "gapMs", 2500) / 1000)) return E("Prea repede: mai așteaptă puțin.");
  if (mine.filter(x => t - x.t < wallMs(st, T1("react", "windowMs", 15000) / 1000)).length >= T1("react", "max", 4)) return E("Prea multe reacții. Mai încolo!");
  st.rxn = (st.rxn || 0) + 1; st.rx.push({ id: st.rxn, s, e, t }); if (st.rx.length > 8) st.rx.splice(0, st.rx.length - 8);
  return OK;
};
/* ---- istoric valoare, raport de zi, deltas, ziar ---- */
function rankMap(st) { const r = {}; active(st).map(x => [x, companyValue(st, x)]).sort((x, y) => y[1] - x[1]).forEach((x, i) => { r[x[0]] = i + 1; }); return r; }
function daySnap(st, s, rk) { const c = st.c[s];
  return { day: st.day, value: c.out ? 0 : companyValue(st, s), cash: c.out ? 0 : Math.round(c.cash), rank: rk[s] || null, pax: c.st.pax || 0, fl: c.st.flights || 0, rev: c.st.revenue || 0,
    routes: Object.keys(c.r).length, planes: st.pl.filter(p => p.s === s).length, stars: r2(stars(st, s)) }; }
function r1Start(st) {
  try { const rk = rankMap(st); st.vh = {}; st.news = null;
    for (const s of st.ps) { const y = daySnap(st, s, rk); y.day = 0; st.c[s].ys = y; st.vh[s] = [y.value]; } } catch (e) { /* opțional */ }
}
function r1Settle(st, R) {
  try {
    const rk = rankMap(st), day = st.day, moves = []; st.vh = st.vh || {};
    for (const s of st.ps) {
      const c = st.c[s], now = daySnap(st, s, rk), y = c.ys || null, h = st.vh[s] = st.vh[s] || [];
      while (h.length < day) h.push(h.length ? h[h.length - 1] : (y ? y.value : now.value)); // salvări vechi: completează
      h[day] = now.value; if (h.length > day + 1) h.length = day + 1;
      now.dpax = y ? now.pax - y.pax : 0; now.dfl = y ? now.fl - y.fl : 0; now.drev = y ? now.rev - y.rev : 0;
      const rs = Object.keys(c.r).map(rid => ({ rid, a: ridEnds(rid)[0], b: ridEnds(rid)[1], v: Math.round(c.r[rid].py || 0) })).sort((p, q) => q.v - p.v);
      const facts = [];
      if (y) {
        const add = (k, lbl, v, d, base) => { if (d) facts.push({ k, v, d, txt: lbl + ": " + fmtN(v) + " (" + fmtS(d) + ")", w: Math.abs(d) / Math.max(1, Math.abs(base)) }); };
        if (y.dpax !== undefined) add("pax", "Pasageri", now.dpax, now.dpax - y.dpax, y.dpax);
        if (y.dfl !== undefined) add("flights", "Zboruri", now.dfl, now.dfl - y.dfl, y.dfl);
        if (y.drev !== undefined) add("rev", "Venituri €", now.drev, now.drev - y.drev, y.drev);
        add("routes", "Rute", now.routes, now.routes - y.routes, y.routes); add("planes", "Avioane", now.planes, now.planes - y.planes, y.planes);
        if (now.stars !== y.stars && Math.abs(now.stars - y.stars) >= 0.05) facts.push({ k: "stars", v: now.stars, d: r2(now.stars - y.stars), txt: "Stele: " + String(now.stars).replace(".", ",") + " (" + (now.stars > y.stars ? "+" : "−") + String(Math.abs(r2(now.stars - y.stars))).replace(".", ",") + ")", w: Math.abs(now.stars - y.stars) });
      }
      facts.sort((p, q) => q.w - p.w); facts.length = Math.min(3, facts.length); facts.forEach(f => { delete f.w; });
      c.dr = { day, value: now.value, cash: now.cash, rank: now.rank, dValue: y ? now.value - y.value : 0, dCash: y ? now.cash - y.cash : 0, dRank: y && y.rank && now.rank ? y.rank - now.rank : 0,
        best: rs.length ? rs[0] : null, worst: rs.length > 1 && rs[rs.length - 1].v < rs[0].v ? rs[rs.length - 1] : null, facts };
      if (!c.out) moves.push({ s, d: c.dr.dValue, v: now.value, pax: now.dpax });
      c.ys = now;
    }
    st.news = makeNews(st, day, moves, R);
  } catch (e) { /* raportul e informativ */ }
}
const FB_NEWS = [{ k: "leader", t: "{co} conduce detașat: {n} în conturi și zâmbete la sediu." }, { k: "quiet", t: "Zi liniștită pe cer: pasagerii au ajuns, bagajele (aproape) toate." }];
function makeNews(st, day, moves, R) {
  const src = D().src, T = (src && Array.isArray(src.NEWS) && src.NEWS.length ? src.NEWS : FB_NEWS), co = s => (st.c[s] && (st.c[s].co || st.c[s].name)) || "?", apn = x => (AP(x) && AP(x).n) || x;
  const lg = st.log.filter(e => e.day === day), cand = [];
  const push = (k, w, vars) => { if (T.some(t => t.k === k)) cand.push({ k, w, vars }); };
  for (const e of lg) {
    if (e.k === "bankrupt" || e.k === "resign") push("bankrupt", 9, { co: co(e.s) });
    else if (e.k === "pact") push("pact", 3, { co: co(e.s), co2: co(e.o), n: e.n });
    else if (e.k === "sharesBuy") push("shares", 3, { co: co(e.s), co2: co(e.o), n: e.n });
    else if (e.k === "rivalIn") push("rival", 6, { co: co(e.who), co2: co(e.o), x: apn(ridEnds(e.rid)[0]), y: apn(ridEnds(e.rid)[1]) });
    else if (e.k === "freeze") push("freeze", 6, { co: co(e.s), co2: co(e.o) });
    else if (e.k === "buildPioneer") push("pioneer", 4, { co: co(e.s), x: apn(e.x), y: apn(e.y) });
    else if (e.k === "event") { const d = evDef(e.ev); if (e.s && st.c[e.s]) push("eventCo", 5, { ev: (d && d.n) || e.ev, co: co(e.s) }); else push("event", 5, { ev: (d && d.n) || e.ev, loc: e.loc || "" }); }
    else if (e.k === "hub") push("hub", 3, { co: co(e.s), x: apn(e.x) });
    else if (e.k === "invest") push("invest", 2, { co: co(e.s) });
    else if (e.k === "negoAccept" && e.o !== undefined) push("deal", 4, { co: co(e.s), co2: co(e.o) });
  }
  if (moves.length) {
    const by = moves.slice().sort((p, q) => q.d - p.d), lead = moves.slice().sort((p, q) => q.v - p.v)[0], px = moves.slice().sort((p, q) => q.pax - p.pax)[0];
    if (by[0].d > 0) push("climb", 3, { co: co(by[0].s), n: fmtM(by[0].d) });
    if (by[by.length - 1].d < 0) push("fall", 3, { co: co(by[by.length - 1].s), n: fmtM(-by[by.length - 1].d) });
    push("leader", 2, { co: co(lead.s), n: fmtM(lead.v) });
    if (px.pax > 0) push("pax", 2, { co: co(px.s), n: fmtN(px.pax) });
  }
  push("quiet", 0.5, {});
  if (!cand.length) return null;
  const last = st.news && st.news.k, pool = cand.filter(c => c.k !== last).length ? cand.filter(c => c.k !== last) : cand;
  const rnd = R || Math.random; let y = rnd() * pool.reduce((a, c) => a + c.w, 0), pk = pool[pool.length - 1];
  for (const c of pool) { y -= c.w; if (y <= 0) { pk = c; break; } }
  const ts = T.filter(t => t.k === pk.k), t = ts[Math.floor(rnd() * ts.length) % ts.length];
  const txt = String(t.t).replace(/\{(\w+)\}/g, (m, k) => pk.vars[k] !== undefined ? pk.vars[k] : "");
  return { day: day + 1, k: pk.k, txt };
}
function deltas(st, s) {
  const c = st.c[s], y = c && c.ys; if (!y || st.phase === "setup" || c.out) return null;
  const rk = rankMap(st)[s] || null;
  return { cash: Math.round(c.cash) - y.cash, value: companyValue(st, s) - y.value, rank: y.rank && rk ? y.rank - rk : 0, day: y.day };
}
const dayReport = (st, s) => (st.c[s] && st.c[s].dr) || null;
function r1View(st, s, now, V) {
  try {
    const c = st.c[s];
    V.undo = c ? undoInfo(st, s, now) : null;
    V.deltas = c ? deltas(st, s) : null;
    V.report = c ? dayReport(st, s) : null;
    V.news = st.news || null; V.valHist = st.vh || null; V.opt = st.phase === "setup" ? null : optOf(st);
    V.reacts = (st.rx || []).slice();
    if (V.co && c) V.co.valueParts = valueSteps(st, s);
  } catch (e) { /* view robust */ }
}
function stateBytes(st) { return JSON.stringify(st).length; }

const CerulLogic = {
  version: 4, gateInfo: (st, ap) => gateInfo(st, ap), airportInfo, planeCard, routeCrowd, permitRange, leaseMult, taxFreeOf, hasAction: n => !!(ACT[n] || ALIAS[n]), get ACTIONS() { return Object.keys(ACT); }, BULK_ACTS: BULK_OK.slice(), cardPrice: (st, s) => st.c[s] ? cardPriceNow(st.c[s], st) : 0, flightProfit, apYield, yieldMult, routeNormal, tierOf, estimate, betterFit, invInfo, hubInfo, chainOptions, normPlaneType, normalPlaneType, PLANE_IDS, get PLANE_ORDER() { return TU().ORDER.slice(); }, maxDays, newGame, step, apply, rebase, gameTimeAt, dayOf, clockInfo, view, recommend, advice, finalValuation, planePos, legal,
  loanRisk, REACTS, dayReport, deltas, undoInfo, valueSteps, START_OPTS: { money: OPT_MONEY.slice(), ev: OPT_EV.slice() },
  companyValue, baseValue, valueParts, normalPrice, demand: (st, rid, dir) => marketDir(st, rid, dir === "ba" ? 1 : 0).tot, rawDemand, dist, airport: AP, stateBytes, rngFrom, mulberry,
  computeRates, bankInfo, permitNeed, slotNeeds, slotCap, slotUsed, flightMin, flightCost, planeValue, dailyCosts, sharePrice, network, isClosed, stars, canServe, cardValue,
  normSpecial, SPECIALS, SPECIAL_DATA_IDS: SP_TO_DATA, RES_KEYS, CARD_NAMES, MONTHS, TYPES: () => TU().PLANES, tune: TU, data: D, MIN_DAY, ridOf, ridEnds, isSpecial,
  _internal: { advance, settleAccounts, nextDay, beginDraft, finishDraft, endPicks, bankrupt, endGame, rollEvents, triggerEvent, genPermits, drawCard, startGame, timers, endFreeze, marketDir, evDef },
};
G.CerulLogic = CerulLogic;
if (typeof module !== "undefined" && module.exports) module.exports = CerulLogic;
})();
