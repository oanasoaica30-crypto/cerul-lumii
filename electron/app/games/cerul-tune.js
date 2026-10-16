/* Cerul Lumii — toate constantele numerice (echilibru). window.CerulTune (browser) + module.exports (Node).
   Proprietar: agentul BALANCE. Fără DOM, fără dependențe. CerulLogic citește CerulTune.<secțiune>.<cheie> LENEȘ, cu valori implicite
   (vezi TU() în cerul-logic.js; numele sunt stabile, valorile se reglează din simulator: scratch-cerul/balance/).
   Unități: bani în € (întregi), timp de joc în MINUTE de joc (1 zi = 1440), timp real în ms (sufix Ms), distanțe în km.
   Indici de tip avion: 0 = Turbo 72, 1 = Aero 320, 2 = Skyliner 350, 3 = Colibri 40, 4 = Regio 100, 5 = Cometa 230 (ordinea pe mărime: planeOrder).
   Mărimi aeroport: 1 = mic, 2 = mediu, 3 = mare (vectorii „bySize” au index 0 nefolosit). */
(function () {
  "use strict";

  const T = {
    version: 20,

    /* ======================= TIMP & DURATE ======================= */
    time: {
      dayMin: 1440,                    // minute de joc într-o zi de joc
      dayRealMinOptions: [1, 2, 3],    // durata unei zile în minute REALE: „Normal 1 min”, „Relaxat 2 min”, „Lung 3 min”
      dayRealMinDefault: 1,
      durationOptions: [60, 120, 180, 0], // durata partidei în minute reale (0 = „Fără timp”)
      durationDefault: 120,
      startHour: 6,                    // ora afișată la începutul zilei 1 (06:00)
      setupVoteTimeoutMs: 30000,       // după 30 s gazda poate rezolva votul (majoritate / primul)
      noLimitMaxDays: 400,             // „Fără timp”: plafon de siguranță (apoi câștigă valoarea cea mai mare)
    },

    /* ======================= REȚEA / GAZDĂ ======================= */
    net: {
      hostTickMs: 250,                 // bucla gazdei
      minCommitMs: 1200,               // între două commit-uri, minim
      heartbeatMs: 10000,              // commit forțat (heartbeat)
      hostStaleMs: 6000,               // st.hb mai vechi → preia următorul client eligibil
      maxQueue: 30,                    // max acțiuni neconfirmate în part.q
      botDecideMs: 1000,               // cât de des decide un bot
      botMaxActions: 3,                // acțiuni maxime per apel
      maxStateKB: 80,
    },

    /* ======================= START ======================= */
    start: {
      cash: 20000000,                  // 20 M € numerar inițial
      freePlaneType: 0,                // un Turbo 72 gratuit la bază
      resourceCards: 4,                // cărți de resurse la start
      permitOffer: 3,                  // permise oferite (păstrezi ≥ 1)
      stars: 3.0,                      // reputația inițială (1..5)
      baseSize: 2,                     // (rezervă) baza = aeroport MEDIU — doar dacă sameContinent eșuează
      baseMinDistKm: 3500,             // (rezervă) distanța minimă între baze pe continente diferite
      starterRoute: true,              // rută de start GRATUITĂ: bază → aeroport apropiat, cu avionul gratuit pe ea
      starterBands: [[500, 1000, 90], [450, 1200, 70], [350, 1500, 45], [250, 2000, 30]], // [km min, km max, pasageri/zi min], relaxat treptat
      starterDistTol: 0.15,            // distanțele rutelor de start: ±15% față de medie
      starterDemTol: 0.30,             // cererile: ±30% față de medie (echitatea principală e pe profitul estimat, ±15%)
      starterTurboDem: 90,             // cerere ≥ 90/zi la toți → Turbo 72; altfel Colibri 40 (același tip pentru toți)
      starterTries: 20,                // reîncercări bază + rute până când profitul estimat e echitabil
      starterProfitTol: 0.15,          // profitul estimat/zi al rutelor de start: ±15% față de medie
      starterProfitTarget: 35000,      // ținta: ~35 k€/zi (avion cu pilot, înainte de costurile fixe ale companiei)
      starterPilot: true,              // avionul de start pornește cu pilot automat (se poate opri)
      sameContinent: true,
      maxYield: 1.00,                  // bazele doar în piețe modeste/medii (randament ≤ 1,0): fără America de Nord / Europa de Vest             // toți pornesc pe ACELAȘI continent (ales aleator per joc)
      baseDistBands: [[400, 1500], [300, 1900], [250, 2600]], // distanța între baze (km), relaxată treptat
      basePopMin: 1.5,                 // baza = oraș mare (≥ 1,5 M loc., aeroport mediu sau mare)
      baseContW: { EU: 3, AS: 3, NA: 3, SA: 0.6, AF: 0.6, OC: 0.6 },  // ponderea continentelor la tragere
      baseDemandTolerance: 0.30,       // pop-ul bazelor în ±30% față de mediană (dacă se poate)
      bonusDays: 10,                   // „Start de companie”: în zilele 1–10...
      bonusFeeMult: 0.5,               // ...taxele de aterizare ×0,5
      bonusLeaseMult: 0.5,             // ...și chiria de leasing ×0,5
    },

    /* ======================= CERERE ======================= */
    // D (pasageri/zi/DIRECȚIE) = k × (popA·popB)^popExp / max(dist, minDistKm)^distExp, în [floor, cap]
    //   × sizeMult (media geometrică a mărimilor) × intercontMult × sezon × rampă × zgomot × pionier × răspuns la preț × evenimente.
    // pop = milioane de locuitori (CerulData.AIRPORTS).
    demand: {
      k: 132,                          // calibrat în simulator (2 jucători, 60 zile: valoare finală mediană ~150–200 M € la boți)
      popExp: 0.5,
      distExp: 0.20,                   // cerere aproape plată cu distanța: rutele lungi (Skyliner) rămân rentabile
      minDistKm: 250,
      cap: 1600,
      floor: 30,
      sizeMult: [0, 0.75, 1.0, 1.2],
      intercontMult: 1.25,
      priceElast: 1.2,                 // cererea TOTALĂ pe rută × (prețMediu/normal)^-1,2 (fără asta un monopol ar cere 10×)
      priceElastAfaceri: 0.5,          // capăt „afaceri”: clienți puțin sensibili la preț — nișa strategiei premium          // rute cu un capăt „afaceri”: mai puțin sensibile la preț
      priceKneeMult: 1.4,              // peste Premium (1,4× normal) cererea scade brusc: oamenii aleg trenul, autocarul sau nu mai zboară...
      priceElastHigh: 2.6,             // ...elasticitatea peste prag e 2,6 (pe orice rută, și „afaceri”) → supraprețul de monopol nu mai merge
      priceMultMax: 2.0,               // la prețuri mici cererea totală crește cel mult ×2
      priceMultMin: 0.02,
      rampStart: 0.7,                  // rută nouă: 70% → 100% în rampDays
      rampDays: 5,
      queueLifeMin: 1440,              // pasagerii care așteaptă pleacă în ~1 zi (τ)
      queueCapDays: 1.5,               // coada ≤ 1,5 × cererea zilnică a companiei
      dailyNoise: 0.10,                // zgomot zilnic ±10%
      dayCurve: [0.35, 0.25, 0.20, 0.30, 0.80, 1.40, 1.60, 1.50, 1.30, 1.20, 1.20, 1.20,
                 1.25, 1.25, 1.20, 1.20, 1.30, 1.50, 1.60, 1.40, 1.10, 0.90, 0.70, 0.50], // profil orar (ora locală; media = 1)
      transitShare: 0.25,              // tranzit A–H–X: 25% din cererea A–X
      transitHubMult: 1.5,             // prin hub propriu ×1,5
      transitMaxDistRatio: 1.6,        // doar dacă ocolul ≤ 1,6 × distanța directă
      transitMaxPairs: 40,
      daysPerMonth: 10,                // o lună (sezoane) = 10 zile de joc
      season: {                        // rezervă dacă CerulData.seasonMult lipsește (emisfera nordică; sudul +6 luni)
        "plajă":   [0.80, 0.80, 0.90, 1.00, 1.10, 1.30, 1.45, 1.45, 1.20, 1.00, 0.85, 0.95],
        "schi":    [1.45, 1.40, 1.20, 0.90, 0.80, 0.85, 0.90, 0.90, 0.85, 0.90, 1.10, 1.50],
        "afaceri": [1.05, 1.05, 1.05, 1.05, 1.05, 0.95, 0.85, 0.85, 1.05, 1.10, 1.10, 0.95],
        "cultură": [0.90, 0.90, 1.00, 1.10, 1.15, 1.15, 1.10, 1.10, 1.10, 1.05, 0.90, 1.05],
      },
      seasonDamp: 0.6,                 // efectul sezonier se aplică cu ponderea 0,6
    },

    /* ======================= PREȚ BILET ======================= */
    // normal = base + perKm·min(dist, longKm) + perKmLong·max(0, dist−longKm), rotunjit la 5 € (vezi T.normalPrice)
    price: {
      base: 70,                        // 700 km → 225 €, 2500 km → 620 €, 9000 km → 1950 €
      perKm: 0.22,
      longKm: 4000,
      perKmLong: 0.20,
      round: 5,
      cheapMult: 0.75,                 // „Ieftin”
      premiumMult: 1.40,               // „Premium”
      minMult: 0.10,                   // preț permis 0,1× … 10× normal (minim 1 €)
      maxMult: 10,
      minAbs: 1,
      recMarginLoad: 0.85,             // recommend(): ținta de ocupare
      recMinLoad: 0.55,                // recommend(): alege doar prețuri cu ocupare estimată ≥ 55% (dacă există în bandă)
      recWeakLoad: 0.40,               // sub 40% recomandarea e „slabă” (UI nu afișează „~x% plin”)
      estLoadCap: 0.92,
      estFillLoad: 0.62,               // estimate(): cu ≥ 2 avioane pe o rută cu locuri în plus pilotul pleacă la ~60% plin → zboruri = cerere / (capacitate × 0,62); un avion: 0,85
      // randamentul pieței (× prețul normal, deci și benzile Ieftin/Normal/Premium și maximul glisorului), per regiune CerulData
      yieldByRegion: { "eu-w": 1.30, "eu-n": 1.30, "eu-s": 1.10, "eu-e": 0.95, "me": 1.00, "as-c": 0.75, "as-s": 0.70, "as-se": 0.85, "as-e": 1.20,
        "na-e": 1.45, "na-w": 1.40, "na-c": 0.85, "carib": 1.00, "sa-n": 0.80, "sa-s": 0.85, "af-n": 0.75, "af-w": 0.65, "af-e": 0.70, "af-s": 0.85, "oc": 1.25 },
      intercontPrem: 1.35,             // rute intercontinentale (transatlantic, transpacific…): × 1,35
      intercontBizPrem: 1.10,          // ...și × 1,10 în plus dacă un capăt e oraș de „afaceri”
      yieldCostExp: 1.0,               // prețul slotului × randamentul aeroportului (piețele bogate costă mai mult)                // estimate(): ocuparea medie maximă realistă
    },

    /* ======================= COTĂ DE PIAȚĂ ======================= */
    // A = (preț/normal)^-eps · max(freqMin, avioane)^freqExp · (1 + starsK·(stele−3)) · pioneerAttr
    share: {
      eps: 1.8,
      starsK: 0.15,
      freqExp: 0.35,
      freqMin: 0.25,
      freqWMin: 0.6,                   // frecvența ponderată cu mărimea: √(locuri/100), între 0,6 și 1 (roiurile de avioane mici nu „cumpără” cota)
      noPlaneAttr: 0.3,                // rută fără niciun avion: atractivitate ×0,3
      spillFrac: 0.70,                 // cererea pe care o companie n-o poate duce (peste capacitate×1,15) trece 70% la rivalii cu locuri libere
      spillCapMult: 1.15,
    },

    /* ======================= AVIOANE ======================= */
    // fuelPerKm × indice combustibil; crewPerH € pe oră de zbor; maintDay €/zi (+maintAgePerDay·vechime); feeMult × taxa de aterizare;
    // pilotDay salariu pilot €/zi; minSize = cel mai mic aeroport pe care aterizează; leaseDay chirie €/zi (≈ 1,5% din preț).
    AIRCRAFT: [                        // index = ty (STABIL pentru salvările vechi: 0–2 vechi, 3–5 noi); ordinea pe mărime: planeOrder
      { id: 0, key: "turbo72", name: "Turbo 72",     seats: 70,  range: 1800,  speed: 520, price: 3000000,
        fuelPerKm: 3,  crewPerH: 250,  maintDay: 3000,  feeMult: 0.5, pilotDay: 5000,  minSize: 1, leaseDay: 45000,
        role: "Turbopropulsor regional: rute scurte (până la 1.800 km), aeroporturi mici" },
      { id: 1, key: "aero320", name: "Aero 320",     seats: 180, range: 5000,  speed: 840, price: 9000000,
        fuelPerKm: 11, crewPerH: 900,  maintDay: 14000, feeMult: 1.0, pilotDay: 12000, minSize: 1, leaseDay: 140000,
        role: "Calul de povară: rute medii aglomerate (până la 5.000 km)" },
      { id: 2, key: "sky350",  name: "Skyliner 350", seats: 320, range: 14500, speed: 900, price: 24000000,
        fuelPerKm: 15, crewPerH: 1600, maintDay: 36000, feeMult: 1.8, pilotDay: 20000, minSize: 2, leaseDay: 370000,
        role: "Gigant intercontinental: rute foarte lungi și foarte aglomerate" },
      { id: 3, key: "colibri40", name: "Colibri 40", seats: 40,  range: 1100,  speed: 460, price: 1200000,
        fuelPerKm: 1.8, crewPerH: 160, maintDay: 1400, feeMult: 0.35, pilotDay: 3000, minSize: 1, leaseDay: 20000,
        role: "Navetă ieftină: salturi scurte (300–1.100 km), rute cu puțini pasageri" },
      { id: 4, key: "regio100",  name: "Regio 100",  seats: 100, range: 3000,  speed: 780, price: 5500000,
        fuelPerKm: 4.8, crewPerH: 500, maintDay: 7000, feeMult: 0.7, pilotDay: 8000, minSize: 1, leaseDay: 85000,
        role: "Jet regional: rapid, rute scurte și medii (până la 3.000 km) cu cerere moderată" },
      { id: 5, key: "cometa230", name: "Cometa 230", seats: 230, range: 8500,  speed: 860, price: 15000000,
        fuelPerKm: 12, crewPerH: 1200, maintDay: 22000, feeMult: 1.3, pilotDay: 16000, minSize: 2, leaseDay: 225000,
        role: "Lung-curier mediu: rute lungi (până la 8.500 km) fără cererea unui Skyliner" },
    ],
    planeOrder: [3, 0, 4, 1, 5, 2],    // afișare de la mic la mare
    planes: {
      flightExtraMin: 30,              // zbor = dist/viteză + 30 min
      turnaroundMin: 45,               // îmbarcare minimă
      maxWaitPilotMin: 360,            // pilot: pleacă oricum după 6 h
      pilotMinWaitMin: 60,             // pilot: pleacă „la profit” după ≥ 60 min
      pilotMargin: 0.15,               // pilot: ocupare ≥ break-even + 15 pp
      pilotSmartMaxMin: 75,            // minim setat de jucător: după ce e atins mai așteaptă cel mult 75 min dacă vin pasageri
      pilotHardMaxMin: 1440,           // sub prag și sub break-even: pleacă oricum după 24 h (să nu stea la nesfârșit)
      coordinate: true,                // R1: avioane cu pilot pe aceeași rută+sens la același aeroport: cel de la poartă ia coada, ceilalți stau la rând
      pilotMinLoad: 0.6,              // ...și cel puțin 60% (sau după maxWaitPilotMin): pe rutele subțiri zboară mai rar, dar plin
      depPerDay: 0.004,                // amortizare liniară 0,4%/zi...
      depFloor: 0.25,                  // ...până la 25%
      sellMult: 0.90,                  // vânzare: 90% din valoarea amortizată
      maintAgePerDay: 0.003,           // mentenanța +0,3% per zi de vechime
      fuelIndexStart: 1.0,
      fuelIndexMin: 0.70,
      fuelIndexMax: 1.80,
      fuelIndexDrift: 0.04,            // pas zilnic aleator ±4%
      fuelIndexRevert: 0.10,           // revenire 10%/zi către 1,0
      landingFeeBySize: [0, 1500, 3000, 6000],
      hubFeeMult: 0.5,                 // la hubul propriu taxa e la jumătate
      maxPlanesPerCompany: 40,
      reassignMin: 60,
    },
    lease: {
      returnFeeDays: 3,                // returnare: 3 zile de chirie
      maxLeased: 6,
      rampFromDay: 8,                  // R1: după „Startul de companie” chiria nu sare peste noapte: ×0,5 până în ziua 7, apoi 60/70/80/90%...
      rampToDay: 12,                   // ...și 100% din ziua 12
      buyoutCredit: 0.5,               // răscumpărare oricând: valoarea avionului − 50% din chiria deja plătită...
      buyoutMinFrac: 0.10,             // ...dar cel puțin 10% din valoare
      ownMult: 1.15,                   // devine automat al tău când chiria plătită ajunge la prețul nou × 1,15 (~77 zile de chirie întreagă)
    },
    used: {
      count: [4, 6],                   // piața second-hand: 4–6 avioane
      refreshDays: 7,
      ageDays: [40, 160],
      priceMult: 0.80,                 // preț = preț nou × valoare amortizată × 0,80
      typeWeights: [0.28, 0.24, 0.08, 0.16, 0.16, 0.08], // per ty (0..5)
    },
    breakdown: {
      base: 0.003,                     // șansă per plecare (avion nou)
      perAgeDay: 0.00005,              // + per zi de vechime (160 zile → 1,1%)
      max: 0.08,
      delayMin: [120, 360],            // întârziere 2–6 h
      repairCostMult: 0.01,            // reparație: 1% din prețul nou
      starsHit: 0.03,
    },

    /* ======================= INVESTIȚII (joc târziu) ======================= */
    invest: {
      valueMult: 0.5,                  // la evaluare: minim 50% din suma investită
      decay: 0.02,                     // valoarea pornește de la 100% și scade 2%/zi până la minim
      base: { price: [8000000, 16000000, 30000000], demand: 0.10, slots: 1, fee: 0.15 },   // „Extinde baza”, niveluri 1–3 (efect per nivel)
      term: { price: 15000000, max: 3, minSize: 3, share: 0.20, stars: 0.15 },          // „Terminal propriu” pe aeroport mare
      eco:  { price: [3000000, 8000000, 16000000, 1500000, 5000000, 11000000], fuel: 0.20 }, // „Flotă eco” per tip de avion (index = ty)
      mnt:  { price: 8000000, maint: 0.25, breakdown: 0.6, dep: 0.4 },                  // „Centru de mentenanță”
    },

    /* ======================= REPUTAȚIE ======================= */
    rep: {
      min: 1, max: 5,
      perFlight: 0.0004,               // zbor cu ocupare ≥ 50% (valorile sunt PER ZBOR: o flotă face ~100–250 zboruri/zi)
      emptyFlight: -0.0006,            // zbor cu ocupare < 25%
      priceGougeMult: 3.0,             // preț > 3× normal...
      priceGouge: -0.002,              // ...−0,002 stele / zbor
      pioneer: 0.2,
      dailyRevert: 0.06,               // derivă zilnică 6% către 3 stele (echilibru ≈ 3,5–4,5 pentru o flotă sănătoasă)
      frozenStrandedPerDay: -0.05,
    },

    /* ======================= COSTURI FIXE ======================= */
    company: {
      overheadDay: 20000,              // sediu €/zi (plin de la overheadFullRoutes rute)
      overheadMinFrac: 0.15,           // o companie mică (1 rută) plătește doar 15% din sediu...
      overheadFullRoutes: 8,           // ...și crește liniar până la 100% la 8 rute
      overheadPerRoute: 3000,          // + per rută
      overheadPerPlane: 1000,          // + per avion
      profitTaxFree: 10000000,         // impozit pe profit: profitul zilnic peste 10 M € (R1: profiturile de mijloc de joc sunt 10–25 M/zi)...
      profitTaxRelMult: 1.4,           // R1: pragul = max(profitTaxFree, 1,4 × profitul mediu de ieri al rivalilor) → doar liderul fugar plătește
      profitTaxRate: 0.40,            // ...se impozitează cu 30% (frânează fuga liderului; apare la „Taxe” în decontare)
    },

    /* ======================= PERMISE & RUTE ======================= */
    permits: {
      maxOpen: 3,
      discardPenalty: 250000,
      classKm: [1500, 4000, 8000],     // < 1500 scurt, < 4000 mediu, < 8000 lung, restul intercontinental
      classNames: ["scurt", "mediu", "lung", "intercontinental"],
      cardCost: [[2, 3], [4, 5], [6, 7], [7, 8]],
      bigAirportAdd: 1,                // +1 carte dacă ambele capete sunt mari
      smallAirportSub: 1,              // −1 carte dacă un capăt e mic (min 2)
      maxSameType: 3,
      offerMix: [0.40, 0.35, 0.18, 0.07],
      maxDistKm: 14500,
      byFleetRange: true,              // R1: permise noi doar până la autonomia celui mai lung avion propriu/în leasing + 10%...
      rangeMinKm: 3300,                // ...dar cel puțin 3.300 km (companie nouă: Turbo/Regio)
      rangeMargin: 0.10,
      thinBandKm: [3000, 5000],        // rute 3.000–5.000 km cu < 100 pas./zi: niciun tip nu câștigă bine...
      thinDemand: 100,
      thinWeight: 0.2,                 // ...oferite de 5× mai rar
      maxRoutes: 30,                  // rute operate simultan, maxim (ține starea mică)
    },
    build: {
      pioneerDemand: 0.20,             // pionier: +20% cerere 10 zile
      pioneerDays: 12,
      pioneerAttr: 1.20,
      pioneerAttrByTier: [1.25, 1.35, 1.45, 1.55], // R1: atractivitatea pionierului pe nivelul pieței (modestă → foarte bogată)
      routeBuildFee: 0,
    },
    slots: {
      capBySize: [0, 99, 3, 2],        // mic ∞, mediu 3, mare 2 (slotul de BAZĂ și cel de HUB nu ocupă din capacitate)
      capAdd4p: 1,                     // la 4 jucători: +1 slot pe aeroporturile medii și mari
      priceBySize: [0, 400000, 1200000, 3000000],
      baseIsFree: true,
      expansionEventAdd: 1,
    },
    hub: {
      priceBySize: [0, 4000000, 8000000, 14000000],
      maxHubs: 3,
    },
    gates: {                           // porți la sol, comune tuturor companiilor (avion la sol sau în zbor spre aeroport = 1 poartă)
      on: true,
      bySize: [0, 3, 6, 10],           // mic 3, mediu 6, mare 10
      perPlayerAbove2: 0.25,           // +25% per jucător peste 2 (4 jucători: mic 5, mediu 9, mare 15)
      maxWaitMin: 180,                 // după 3 h de așteptare pleacă oricum (poziție la distanță) — niciodată blocaj total
      busyFrac: 0.8,                   // estimate(): gateBusy dacă porțile unui capăt sunt ≥ 80% ocupate
    },
    chain: {                           // „rută cu escală” A→B→C (un avion pe două rute proprii cu aeroport comun B)
      share: 0.30,                     // pasageri A–C în plus = 30% din cererea A–C × factori
      stopMin: 30,                     // escala la B: +30 min la îmbarcare
      vsDirect: 0.35,                  // un rival zboară direct A–C: ×0,35
      vsOwnDirect: 0.5,                // tu zbori direct A–C: ×0,5
      maxDetour: 1.6,                  // (AB+BC)/AC ≥ 1,6 → fără pasageri A–C
      freqExp: 0.35, freqMax: 1.5,     // × min(1,5, nAvioane^0,35)
    },

    /* ======================= CĂRȚI ======================= */
    cards: {
      odds: { aprobare: 0.22, infra: 0.22, echipaj: 0.22, combustibil: 0.22, joker: 0.06, special: 0.06 },
      ghiseuGive: 5,
      buyPrice: 350000,
      buyMult: 1.3,                    // R1: × 1,3 per „căldură” (o cumpărare = +1)...
      heatHalfLifeMin: 720,            // ...care se înjumătățește la 12 ore de joc (fără reset la miezul nopții; la fel pentru orice lungime a zilei)
      buyMaxPerDay: 6,
      special: {
        inghet:    { count: 6, maxHeld: 3 },
        spargator: { count: 4, maxHeld: 2 },
        rapid:     { count: 4 },
        vip:       { count: 3 },
        boom:      { count: 4 },
        combust:   { count: 3 },
        spion:     { count: 3 },
        reclama:   { count: 4 },
        asigurare: { count: 3 },
        slot:      { count: 2 },
        cadou:     { count: 1 },
      },
      specialReturnDays: 10,
    },
    specials: {
      freezeRealMs: 30000,
      freezeCooldownDays: 2,
      breakerPromptMs: 5000,
      rapidCardsLess: 1,
      boomMult: 2.0, boomDays: 3,
      fuelContractMult: 0.70, fuelContractDays: 5,
      spyDays: 1,
      adStars: 1, adDays: 7,
      giftPlaneType: 0,
    },

    /* ======================= DRAFT ======================= */
    draft: {
      picksEach: 3,
      extra: 4,                        // 3×N + 4 cărți
      pickMs: 10000,
      botPickMs: 1200,
      revealMs: 5000,
      introMs: 2000,
      settleMs: 2500,
    },

    /* ======================= CONSULTANT ======================= */
    consultant: {
      feeDay: 25000,
      hireFee: 0,
      tipEveryDays: [1, 2],
      whisperChance: 0.35,
    },

    /* ======================= BANCA ======================= */
    bank: {
      limitFrac: 0.40,                 // limită = 40% din valoarea companiei (× scor) − datoria
      minLimit: 3000000,
      terms: [10, 20, 30, 60],         // 60 zile (R1): finanțare de flotă la mijlocul jocului — rată mică pe zi, dobândă mare în total
      ratePerDay: { 10: 0.004, 20: 0.005, 30: 0.006, 60: 0.007 },
      minAmount: 500000,
      scoreStart: 100,
      scoreLateDay: -10,
      scoreNegDay: -5,
      scoreRepaid: 5,
      scoreLimitK: 0.006,
      scoreRateK: 0.00003,
      earlyRepayFee: 0,
    },
    bankrupt: {
      graceDays: 5,
      debtOverLimitMult: 1.25,
    },
    loans: { minDays: 2, maxDays: 30 },
    nego: { maxRealMs: 120000, perPlayerPerDay: 1, pactMaxDays: 20 },
    shares: { maxOthers: 49, fee: 0.02, minValue: 1000000 },

    /* ======================= EVENIMENTE & CRIZE ======================= */
    events: {
      chancePerDay: 0.40,
      maxActive: 3,
      firstDay: 3,
      farWeight: 0.15,                 // R1: evenimentele locale unde nu operează nimeni au pondere ×0,15
      localPref: 0.9,                  // R1: un eveniment local cade în 90% din cazuri unde operează cineva
    },
    /* ======================= R1 (LOGIC-2): setări de start votate, anulare, reacții, risc împrumut ======================= */
    startOpts: {
      cash: { low: 0.6, normal: 1, high: 1.75 },        // × start.cash (20 M): 12 M / 20 M / 35 M
      events: { few: 0.5, normal: 1, many: 1.7 },       // × events.chancePerDay
    },
    undo: { sec: 8, graceMs: 1500 },   // anulare: 8 s reale (+1,5 s toleranță de rețea la gazdă)
    react: { gapMs: 2500, windowMs: 15000, max: 4 },
    loanRisk: { levels: [0.25, 0.6] }, // (sumă + datorii) / valoare: < 0,25 mic, < 0,6 mediu, altfel mare
    crisis: {                          // „Fără timp”, după ziua 60
      startDay: 60,
      fuelPerDay: 0.03,                // combustibil +3%/zi (cumulativ)
      taxPerDay: 0.01,                 // taxă pe profit +1 pp/zi
      taxMax: 0.35,
      overheadPerDay: 0.05,            // costuri fixe +5%/zi → „Fără timp” se încheie de obicei în ziua ~130–160
      eventChanceAdd: 0.005,
    },

    /* ======================= VALOARE ======================= */
    value: {
      routeDays: 5,                    // rută = 5 × profitul mediu zilnic (ultimele routeAvgDays, ≥ 0)...
      routeAvgDays: 7,
      routeMinFromCards: 150000,       // ...dar cel puțin 150.000 € per carte folosită
      slotMult: 1.00,
      hubMult: 0.70,
      cardDays: 0.3,                   // carte normală = 0,3 zile de profit al unei rute medii, în [cardMin, cardMax]
      cardMin: 30000,
      cardMax: 60000,
      jokerMult: 3,
      specialMult: 5,
      setOf5Bonus: 100000,             // 5 cărți normale de același tip: +100.000 € per set
      openPermitPenalty: 0,             // permisele deschise nu scad valoarea (renunțarea costă discardPenalty)
      leasedValue: 0,
    },
  };

  /* ---------- helperi ---------- */
  T.normalPrice = function (dist) {
    const p = T.price;
    const v = p.base + p.perKm * Math.min(dist, p.longKm) + p.perKmLong * Math.max(0, dist - p.longKm);
    return Math.max(p.minAbs, Math.round(v / p.round) * p.round);
  };
  T.flightMin = function (type, dist) { const a = T.AIRCRAFT[type]; return Math.round(dist / a.speed * 60 + T.planes.flightExtraMin); };
  T.planeValue = function (type, ageDays) { const a = T.AIRCRAFT[type], p = T.planes; return Math.round(a.price * Math.max(p.depFloor, 1 - p.depPerDay * ageDays)); };
  T.cardBuyPrice = function (boughtToday) { return Math.round(T.cards.buyPrice * Math.pow(T.cards.buyMult, boughtToday)); };

  if (typeof window !== "undefined") window.CerulTune = T;
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})();
