/* Cerul Lumii — boții (agent BOT). window.CerulBot (browser) + module.exports (Node). API: briefs/DONE_CERUL_BOT.md
   decide(st, seat, nowMs, rng) -> [acțiuni] (≤3). Pur: nu modifică st. Folosește doar informații pe care le-ar vedea un om
   (CerulLogic.view pentru locul botului = datele proprii + informația publică despre adversari).
   Fiecare acțiune propusă e verificată pe o copie a stării (CerulLogic.apply) → zero acțiuni invalide trimise. */
(function () {
"use strict";
const G = typeof window !== "undefined" ? window : globalThis;
const ISNODE = typeof module !== "undefined" && module.exports && typeof require === "function";
let Lreq = null;
function LG() {
  if (G.CerulLogic) return G.CerulLogic;
  if (ISNODE) { if (Lreq === null) { try { Lreq = require("./cerul-logic.js"); } catch (e) { Lreq = false; } } return Lreq || null; }
  return null;
}
const MIN_DAY = 1440;
const THIN = 32;   // pasageri/zi/direcție sub care o pereche nu merită construită (un Turbo nu își acoperă costurile)
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sum = a => a.reduce((x, y) => x + y, 0);

/* ======================= personalități ======================= */
const PERSONALITIES = {
  // low-cost: prețuri mici, avioane second-hand / leasing, fără piloți (Decolează manual), îndatorare mai mare, agresiv cu ❄️
  lowcost: { name: "lowcost", priceMult: 0.89, pilots: false, preferUsed: 1, lease: true, sizeBias: -0.15, resFrac: 0.04, resMin: 800000,
    debtFrac: 0.42, frzAggro: 1.2, hubRoutes: 99, shares: 2, buyCards: 3, negoMargin: 0.04, adPlay: 0.6, maxPlanes: 30,
    compPrice: 0.89, inv: { base: 0.9, term: 0.7, eco: 1.3, mnt: 1.2 } },
  // premium: prețuri mari, avioane noi și mari, piloți, reclamă, hub, prudent la bancă
  premium: { name: "premium", priceMult: 1.02, pilots: "big", preferUsed: 0.25, lease: true, sizeBias: 0.1, resFrac: 0.05, resMin: 1200000,
    debtFrac: 0.33, frzAggro: 0.8, hubRoutes: 4, shares: 2, buyCards: 3, negoMargin: 0.08, adPlay: 1, maxPlanes: 30,
    // FIX1: premium rămânea cu prea puține avioane și bani blocați în rezervă în 3–4p → finanțe ca „echilibrat”, piloți doar pe
    // avioanele mari, preț recomandat pe rutele disputate; aromă: avioane noi, mai mari, reclamă, hub devreme, terminale, rute „afaceri”
    compPrice: 1.0, compAvoid: 0.25, bizBonus: 1.2, inv: { base: 1.2, term: 1.5, eco: 0.9, mnt: 1 } },
  // echilibrat
  balanced: { name: "balanced", priceMult: 1.0, pilots: "big", preferUsed: 0.5, lease: true, sizeBias: 0, resFrac: 0.05, resMin: 1200000,
    debtFrac: 0.33, frzAggro: 1, hubRoutes: 5, shares: 2, buyCards: 3, negoMargin: 0.06, adPlay: 0.8, maxPlanes: 30,
    compPrice: 1.0, inv: { base: 1, term: 1, eco: 1, mnt: 1 } },
};
const PNAMES = ["lowcost", "premium", "balanced"];
const OVR = {};
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function personality(st, seat) {
  const c = st && st.c && st.c[seat];
  if (c && c.pers && PERSONALITIES[c.pers]) return c.pers;
  if (OVR[seat] && PERSONALITIES[OVR[seat]]) return OVR[seat];
  const key = seat + "|" + (c ? (c.co || "") + (c.av | 0) : "");
  return PNAMES[hashStr(key) % 3];
}
function setPersonality(seat, name) { if (name && PERSONALITIES[name]) OVR[seat] = name; else delete OVR[seat]; }

/* ======================= memorie per loc (cooldown-uri, anti-spam) ======================= */
const MEM = {};
function memOf(st, seat) {
  const c = st.c[seat];
  const key = seat + "|" + (c.base || "-") + "|" + (c.co || "") + "|" + st.ps.join(",");
  let m = MEM[key];
  if (!m || (m.day > (st.day || 1)) || (m.phaseSetup && st.phase !== "setup" && m.gt > (st.gt || 0) + 1)) m = null;
  if (!m) {
    m = MEM[key] = { cd: {}, errAt: 0, last: [], day: st.day || 1, gt: st.gt || 0, perm: {}, idle: {}, nego: {}, lastNegoDay: -9, frozenBy: null, stats: { acts: 0, dropped: 0 } };
    // nu lăsa memoria să crească la nesfârșit (multe partide în simulări)
    const keys = Object.keys(MEM); if (keys.length > 64) for (const k of keys.slice(0, keys.length - 64)) delete MEM[k];
  }
  m.day = st.day || 1; m.gt = st.gt || 0;
  return m;
}

/* ======================= utilitare ======================= */
function ends(rid) { return rid.split("-"); }
function otherEnd(rid, ap) { const e = ends(rid); return e[0] === ap ? e[1] : e[0]; }

function decide(st, seat, now, rng) {
  try { return decideInner(st, seat, now, rng || Math.random); }
  catch (e) { if (G.__CERUL_BOT_DEBUG) console.error("CerulBot", e); return []; }
}

function decideInner(st, seat, now, R) {
  const L = LG(); if (!L || !st || !st.c || !st.c[seat]) return [];
  const c = st.c[seat];
  if (c.out || st.phase === "end" || st.phase === "boot") return [];
  const mem = memOf(st, seat);
  const gt = st.gt || 0;
  // feedback: o acțiune a botului a fost respinsă → pune cooldown lung pe ultimele chei
  const er = st.err && st.err[seat];
  if (er && er.n === -1 && er.at && er.at > mem.errAt) { mem.errAt = er.at; for (const k of mem.last) mem.cd[k] = gt + 720; mem.stats.dropped++; }
  let cands = [];
  if (st.phase === "setup") cands = setupCands(st, seat, c, mem);
  else if (st.phase === "draft") cands = draftCands(st, seat, now, R, L);
  else if (st.phase === "nego") cands = negoCands(st, seat, now, R, L, mem);
  else if (st.phase === "play") {
    if (st.pz) return [];
    if (c.fz) cands = frozenCands(st, seat, now, L, mem);
    else cands = playCands(st, seat, now, R, L, mem);
  }
  return validate(st, seat, now, L, mem, cands, gt);
}

/* verifică fiecare candidat pe o copie (aplicat în ordine) → doar acțiuni valide, ≤3 */
function validate(st, seat, now, L, mem, cands, gt) {
  const out = [], keys = [], pids = {};
  if (!cands.length) { mem.last = []; return out; }
  let work = null; const dryR = L.mulberry ? L.mulberry((gt * 7919 + 17) >>> 0) : Math.random;
  for (const cd of cands) {
    if (out.length >= 3) break;
    if (!cd || !cd.a) continue;
    const k = cd.k || JSON.stringify(cd.a);
    if ((mem.cd[k] || -1) > gt) continue;
    // o singură acțiune per avion într-un lot (decolarea poate avea rezultat aleator: pană → copia ar putea diferi de realitate)
    if (cd.a.pid !== undefined && pids[cd.a.pid]) continue;
    let r;
    if (!work && cd.chk) {
      // acțiune simplă: verificare exactă și ieftină pe starea originală (fără copie)
      let okk = false; try { okk = !!cd.chk(st, L); } catch (e) { okk = false; }
      r = { ok: okk };
    } else {
      if (!work) {
        work = JSON.parse(JSON.stringify(st));
        // acțiunile deja acceptate prin verificarea ieftină trebuie aplicate și pe copie (pot schimba valoarea / limita băncii)
        for (const a0 of out) { try { L.apply(work, seat, a0, now, dryR); } catch (e) {} }
      }
      try { r = L.apply(work, seat, cd.a, now, dryR); } catch (e) { r = { ok: false }; }
    }
    if (r && r.ok) { if (cd.a.pid !== undefined) pids[cd.a.pid] = 1; out.push(cd.a); keys.push(k); mem.cd[k] = gt + (cd.cd === undefined ? 30 : cd.cd); if (work && work.phase !== st.phase) break; }
    else mem.cd[k] = gt + (cd.fail === undefined ? 180 : cd.fail);
  }
  mem.last = keys; mem.stats.acts += out.length;
  return out;
}

/* ======================= setup ======================= */
function setupCands(st, seat, c, mem) {
  const out = [];
  if (!c.prof) {
    const used = st.ps.filter(x => x !== seat && st.c[x].prof).map(x => st.c[x].col);
    const col = [0, 1, 2, 3, 4, 5].find(x => used.indexOf(x) < 0);
    const g = c.g === "f" ? "f" : "m";
    const avs = g === "f" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    const usedAv = st.ps.map(x => st.c[x].av);
    const av = avs.find(a => usedAv.indexOf(a) < 0);
    const names = ["Aripi Carpatine", "Zbor Albastru", "Vultur Air", "Orizont Express", "Nor Alb", "Cocor Airlines", "Stea Polară", "Briza Air"];
    const usedCo = st.ps.map(x => st.c[x].co);
    out.push({ k: "prof", a: { a: "prof", av: av === undefined ? avs[0] : av, name: c.name || "Bot", co: names.find(n => usedCo.indexOf(n) < 0) || (c.name + " Air"), color: col === undefined ? 0 : col }, cd: 5 });
  }
  // votul: urmează majoritatea oamenilor
  const hs = st.ps.filter(x => !st.c[x].bot && st.c[x].vote);
  if (hs.length) {
    const maj = key => { const cnt = {}; let best = st.c[hs[0]].vote[key], bn = 0; for (const h of hs) { const v = st.c[h].vote[key]; cnt[v] = (cnt[v] || 0) + 1; if (cnt[v] > bn) { bn = cnt[v]; best = v; } } return best; };
    const v = { dur: maj("dur"), day: maj("day") };
    if (!c.vote || c.vote.dur !== v.dur || c.vote.day !== v.day) out.push({ k: "vote" + v.dur + "/" + v.day, a: { a: "vote", dur: v.dur, day: v.day }, cd: 0, fail: 5 });
  }
  if ((c.prof || out.length) && !c.ready) out.push({ k: "ready", a: { a: "ready", on: true }, cd: 0, fail: 5 });
  return out;
}

/* ======================= draft ======================= */
function draftCands(st, seat, now, R, L) {
  const dr = st.dr; if (!dr || dr.rv || dr.ord[dr.i] !== seat) return [];
  const free = []; dr.tk.forEach((x, i) => { if (x === null) free.push(i); });
  if (!free.length) return [];
  let i = free[Math.floor(R() * free.length)];
  // consultantul a șoptit o carte: o iau dacă e încă pe masă (doar informația mea)
  const w = dr.wh && dr.wh[seat];
  if (w !== undefined && w !== null && dr.tk[w] === null) i = w;
  return [{ k: "pick" + dr.i, a: { a: "pick", i }, cd: 0, fail: 0, chk: () => true }];
}

/* ======================= înghețat ======================= */
function frozenCands(st, seat, now, L, mem) {
  const c = st.c[seat], fz = c.fz; mem.frozenBy = fz.by || mem.frozenBy; mem.frozenDay = st.day;
  if (!fz.pu || !(c.sx && c.sx.brk)) return [];
  const gtn = L.gameTimeAt ? L.gameTimeAt(st, now) : st.gt;
  if (gtn > fz.pu) return [];
  // merită dacă am avioane în aer / la îmbarcare (aproape mereu)
  const mine = st.pl.filter(p => p.s === seat && p.m > 0).length;
  return [{ k: "brk" + fz.s, a: { a: "breaker", use: mine > 0 }, cd: 0, fail: 0 }];
}

/* ======================= negociere ======================= */
function cardVal(c, i, need) { if (i === 4) return 420000; return (need && need[i] > c.h[i]) ? 330000 : 160000; }
const SXV = { frz: 900000, brk: 600000, gift: 2800000, fast: 600000, vip: 550000, boom: 500000, fuel: 450000, spy: 300000, ad: 450000, ins: 400000, slot: 500000 };
function itemsValue(st, seat, it, receiving, L, view) {
  if (!it) return 0; const c = st.c[seat]; let v = 0;
  const need = [0, 0, 0, 0]; for (const p of c.pm) for (let i = 0; i < 4; i++) need[i] += p.k[i];
  if (it.cash) v += it.cash;
  if (it.cards) for (let i = 0; i < 5; i++) v += (it.cards[i] | 0) * cardVal(c, i, need);
  if (it.sx) for (const id in it.sx) v += (it.sx[id] | 0) * (SXV[id] || 400000);
  if (it.permits) v += it.permits.length * 350000;
  if (it.routes) for (const rid of it.routes) {
    if (!receiving && c.r[rid]) { const p7 = c.r[rid].p7 || []; const avg = p7.length ? sum(p7) / p7.length : 0; v += 1600000 + 10 * Math.max(0, avg) + 400000; }
    else { const [a, b] = ends(rid); let dem = 200; try { dem = L.rawDemand(st, a, b); } catch (e) {} v += 1400000 + dem * L.normalPrice(L.dist(a, b), a, b) * 0.6; }
  }
  if (it.slots) for (const ap of it.slots) { const A = L.airport(ap); v += A ? [150000, 600000, 1500000][A.size - 1] * 0.6 : 200000; }
  if (it.planes) for (const pid of it.planes) {
    const p = st.pl.find(x => x.id === pid);
    if (p) { try { v += L.planeValue(st, p) * (receiving ? 0.95 : 1.05); } catch (e) { v += 2e6; } }
  }
  return v;
}
function pactValue(st, seat, other, view) {
  // pactul: dacă sunt lider sau am mai fost înghețat de el → bun pentru mine; dacă el e liderul și am ❄️ → mai puțin bun
  const me = view.co || {}; const op = (view.opp || []).find(o => o.seat === other) || {};
  let v = 0;
  if (me.rank === 1) v += 250000;
  if (op.rank === 1 && (st.c[seat].sx.frz || 0) > 0) v -= 300000;
  return v;
}
function loanSelfValue(st, seat, L, lend, borrowView) {
  // lend: {amt, rep, days} văzut ca împrumut DAT de mine
  return 0;
}
function negoCands(st, seat, now, R, L, mem) {
  const ng = st.ng; if (!ng || (ng.a !== seat && ng.b !== seat) || ng.res) return [];
  const other = ng.a === seat ? ng.b : ng.a, c = st.c[seat];
  const P = PERSONALITIES[personality(st, seat)];
  const view = lightView(st, seat, now, L, mem);
  const nm = mem.nego[ng.id] = mem.nego[ng.id] || { t0: now, countered: 0, said: 0, offered: 0 };
  const out = [];
  const off = ng.off;
  const myCash = c.cash, value = Math.max(1, (view.co && view.co.value) || 1);
  const reserve = Math.max(P.resMin, value * P.resFrac);
  if (off && off.by !== seat) {
    nm.said = 1;
    // ei îmi dau off.give, cer off.get
    let recv = itemsValue(st, seat, off.give, true, L, view), give = itemsValue(st, seat, off.get, false, L, view);
    const pact = (off.give.pact | 0) || (off.get.pact | 0); if (pact) recv += pactValue(st, seat, other, view);
    let ok = true;
    // împrumut pe care EU îl dau (ei îl cer: off.get.loan) sau îl primesc (off.give.loan)
    if (off.get && off.get.loan) {
      const l = off.get.loan, rate = (l.rep - l.amt) / Math.max(1, l.amt) / Math.max(1, l.days);
      const op = (view.opp || []).find(o => o.seat === other) || {};
      const risk = op.rank && op.rank >= (view.opp || []).length + 1 ? 0.12 : 0.05;
      const spare = myCash - reserve * 2;
      if (l.amt > spare * 0.6 || rate < 0.004 || l.rep < l.amt * (1 + risk)) ok = false;
      else recv += l.rep * (1 - risk * 0.5) - l.amt; // riscul e deja cerut în dobânda minimă (rep ≥ amt·(1+risk))
      if (!ok && !nm.countered && spare > 1e6) {
        const amt = Math.max(500000, Math.min(Math.round(l.amt / 100000) * 100000, Math.floor(spare * 0.5 / 100000) * 100000));
        const days = clamp(l.days | 0 || 10, 2, 20), rep = Math.round(amt * (1 + 0.008 * days + risk) / 1000) * 1000;
        nm.countered = 1; // contraofertă: împrumut mai mic / dobândă mai mare (înlocuiește oferta lor)
        out.push({ k: "ncnt" + ng.id, a: { a: "negoOffer", give: { loan: { amt, rep, days } }, get: {} }, cd: 0, fail: 0 });
        out.push({ k: "nref" + ng.id + "|" + off.at, a: { a: "negoRefuse" }, cd: 0, fail: 0 });
        return out;
      }
    }
    if (off.give && off.give.loan) {
      const l = off.give.loan; const need = myCash < reserve;
      recv += l.amt - l.rep + (need ? l.amt * 0.08 : -l.amt * 0.02);
      if (st.maxDay && st.day + (l.days | 0) > st.maxDay + 1) recv += 0; // datoria se decontează oricum la final
    }
    const margin = Math.max(60000, give * P.negoMargin);
    if (ok && recv - give >= margin) out.push({ k: "nacc" + ng.id + "|" + off.at, a: { a: "negoAccept" }, cd: 0, fail: 0 });
    else out.push({ k: "nref" + ng.id + "|" + off.at, a: { a: "negoRefuse" }, cd: 0, fail: 0 });
    return out;
  }
  if (off && off.by === seat) {
    // aștept răspunsul; după 40 s (timp real) închid
    if (now - off.at > 40000 / (st.sp || 1)) out.push({ k: "nclose" + ng.id, a: { a: "negoClose" }, cd: 0, fail: 0 });
    return out;
  }
  // nu e nicio ofertă pe masă
  if (ng.a === seat) {
    // am deschis eu: fie fac oferta pregătită, fie închid
    if (mem.negoPlan && mem.negoPlan.id === ng.id && !nm.offered && !(ng.last && ng.last.by === other)) {
      nm.offered = 1;
      out.push({ k: "noff" + ng.id, a: { a: "negoOffer", give: mem.negoPlan.give || {}, get: mem.negoPlan.get || {} }, cd: 0, fail: 0 });
    }
    out.push({ k: "nclose" + ng.id, a: { a: "negoClose" }, cd: 0, fail: 0 });
    return out.slice(0, 1);
  }
  // a deschis celălalt și încă nu a oferit nimic: salut o dată; dacă am contraoferit și s-a refuzat → închid
  if (nm.countered && ng.last && ng.last.by === other) { out.push({ k: "nclose" + ng.id, a: { a: "negoClose" }, cd: 0, fail: 0 }); return out; }
  if (!nm.said) { nm.said = 1; out.push({ k: "nsay" + ng.id, a: { a: "negoSay", k: "👋" }, cd: 0, fail: 0 }); }
  if (st.c[other].bot && now - nm.t0 > 15000 / (st.sp || 1)) out.push({ k: "nclose" + ng.id, a: { a: "negoClose" }, cd: 0, fail: 0 });
  return out;
}

/* computeRates e global și scump: cache comun pentru toți boții, reîmprospătat la 30 min de joc sau când se schimbă rutele */
let RC = null;
function ratesCached(st, L) {
  const gid = st.ps.join(",") + "|" + st.ps.map(s => st.c[s].base).join(",") + "|" + (st.m0 || 0);
  let nr = 0; for (const s of st.ps) { const c = st.c[s]; if (!c.out) for (const k in c.r) nr++; }
  if (RC && RC.gid === gid && RC.nr === nr && st.gt >= RC.gt && st.gt - RC.gt < 30) return RC.v;
  RC = { gid, nr, gt: st.gt, v: L.computeRates(st) };
  return RC.v;
}
/* ======================= vedere ușoară (doar datele mele + public) =======================
   CerulLogic.view() calculează recommend() pentru fiecare rută (scump); botul are nevoie de el doar pentru o rută pe apel. */
function lightView(st, seat, now, L, mem) {
  const T = L.tune(), c = st.c[seat], gt = st.gt, PL = T.PLANES;
  const V = { co: null, routes: [], planes: [], permits: [], offer: null };
  const act = st.ps.filter(x => !st.c[x].out);
  const vals = {}; for (const x of act) vals[x] = L.companyValue(st, x);
  const ranks = {}; act.slice().sort((x, y) => vals[y] - vals[x]).forEach((x, i) => { ranks[x] = i + 1; });
  const bi = L.bankInfo(st, seat);
  let fm = st.fi || 1;
  V.co = { value: vals[seat], daily: L.dailyCosts(st, seat), debt: bi.debt, rank: ranks[seat], fuelMult: fm };
  V.bank = { limit: bi.limit, loans: c.bl.map(l => ({ id: l.id, p: Math.round(l.p), r: l.r, inst: Math.round(l.p / Math.max(1, l.d) + l.p * l.r) })) };
  V.clock = { dayFrac: clamp((gt - (st.day - 1) * MIN_DAY) / MIN_DAY, 0, 1) };
  const rates = ratesCached(st, L), rr = rates.r[seat] || {};
  const rids = Object.keys(c.r);
  // recommend() doar pentru o rută pe apel (round-robin) + rutele încă neprețuite de bot
  mem.rr = ((mem.rr || 0) + 1) % Math.max(1, rids.length);
  mem.priced = mem.priced || {};
  const myPl = st.pl.filter(p => p.s === seat);
  for (let i = 0; i < rids.length; i++) {
    const rid = rids[i], cr = c.r[rid], [a, b] = ends(rid), d = L.dist(a, b), rt = st.rt[rid] || { t0: gt };
    const pls = myPl.filter(p => p.rid === rid);
    const doRec = i === mem.rr || (!mem.priced[rid] && pls.length);
    const ramp = clamp((T.ramp0 || 0.5) + (1 - (T.ramp0 || 0.5)) * ((gt - rt.t0) / MIN_DAY) / (T.rampDays || 7), 0, 1);
    const x = rr[rid] || [0, 0];
    V.routes.push({ rid, a, b, d, pa: cr.pa, pb: cr.pb, normal: L.normalPrice(d, a, b), rec: doRec ? safeRec(L, st, seat, rid, "ab") : null, recBa: doRec ? safeRec(L, st, seat, rid, "ba") : null,
      dem: { ab: x[0], ba: x[1] }, sh: { ab: ((rates.sh && rates.sh[seat] || {})[rid] || [0, 0])[0], ba: ((rates.sh && rates.sh[seat] || {})[rid] || [0, 0])[1] }, q: { ab: Math.floor(cr.qa), ba: Math.floor(cr.qb) }, planes: pls.map(p => p.id), comp: st.ps.filter(s => s !== seat && !st.c[s].out && st.c[s].r[rid]).length,
      today: Math.round(cr.pr), p7: sum(cr.p7 || []), lf: cr.lf === undefined ? null : cr.lf, closed: L.isClosed(st, a, seat) || L.isClosed(st, b, seat), ramp,
      boom: c.fx.some(f => f.k === "boom" && f.rid === rid && f.u > gt) });
  }
  for (const p of myPl) {
    const pt = PL[p.ty];
    const readyAt = p.m === 1 ? Math.max(p.t0 + (T.turnMin || 45), p.dly || 0) : 0;
    V.planes.push({ id: p.id, ty: p.ty, seats: pt.seats, rid: p.rid, m: p.m, px: p.px, load: p.px / pt.seats, ready: p.m === 1 && gt >= readyAt, ap: p.ap,
      canDepart: p.m === 1 && !c.fz && !L.isClosed(st, p.ap, seat), pil: p.pil, go: p.go, ls: p.ls, t0: p.t0,
      cost: p.rid && p.m === 1 ? L.flightCost(st, seat, p.ty, p.ap, otherEnd(p.rid, p.ap)) : 0 });
  }
  const slotInfo = ap => {
    if (L.slotCap && L.slotUsed) return { slots: L.slotUsed(st, ap), cap: L.slotCap(st, ap), mine: (st.sl[ap] || []).indexOf(seat) >= 0 };
    const A = L.airport(ap); const sc = T.slotCap || [0, 99, 3, 2]; const cap = (sc.length > 3 ? sc[A.size] : sc[A.size - 1]) + ((st.cap || {})[ap] || 0);
    const l = st.sl[ap] || [], x = (st.sx || {})[ap] || []; const used = l.filter(s => x.indexOf(s) < 0 && st.c[s] && !st.c[s].out).length;
    return { slots: used, cap, mine: l.indexOf(seat) >= 0 }; };
  V.map = { airports: {} }; for (const ap in st.sl) V.map.airports[ap] = slotInfo(ap);
  for (const p of c.pm) {
    const nd = L.permitNeed(c, p, false), nf = L.permitNeed(c, p, true), sn = L.slotNeeds(st, seat, p.a, p.b), cost = sum(sn.map(x => x.price));
    const okB = nd.ok && sn.every(x => x.ok); // fără verificarea banilor (botul se poate împrumuta)
    V.permits.push({ id: p.id, a: p.a, b: p.b, d: p.d, k: p.k, miss: nd.miss, jok: nd.jok, canBuild: okB, canFast: !!c.sx.fast && nf.ok, slots: sn, cost, dem: Math.round(L.rawDemand(st, p.a, p.b)) });
  }
  V.offer = c.of ? c.of.map(p => Object.assign({}, p, { dem: Math.round(L.rawDemand(st, p.a, p.b)) })) : null;
  V.canDraw = !c.of && c.pm.length < (T.maxPermits || 3);
  V.legal = L.legal(st, seat, now);
  V.opp = st.ps.filter(x => x !== seat).map(x => { const o = st.c[x], pl = st.pl.filter(p => p.s === x);
    return { seat: x, rank: ranks[x] || null, out: o.out, frozen: !!o.fz, routes: Object.keys(o.r), planes: pl.length, inAir: pl.filter(p => p.m === 2 || p.m === 3).length }; });
  V.shares = act.map(x => { const h = st.sh[x] || {}; const held = sum(Object.keys(h).map(k => h[k])); return { co: x, price: L.sharePrice(st, x), own: h[seat] || 0, held, free: (T.shareMax || 49) - held, mine: x === seat }; });
  const spy = c.fx.find(f => f.k === "spy" && f.u > gt);
  V.spy = spy && st.c[spy.s] && st.c[spy.s].r[spy.rid] ? { rid: spy.rid, pa: st.c[spy.s].r[spy.rid].pa, pb: st.c[spy.s].r[spy.rid].pb } : null;
  V.fx = c.fx.filter(f => f.u > gt);
  V.shop = { used: st.um.slice() };
  V.cards = { buyPrice: V.legal.cardPrice };
  V.pacts = st.pacts.filter(p => p.a === seat || p.b === seat).map(p => ({ with: p.a === seat ? p.b : p.a, u: p.u }));
  return V;
}

function safeRec(L, st, seat, rid, dir) { try { return L.recommend(st, seat, rid, dir); } catch (e) { if (G.__CERUL_BOT_DEBUG) console.error("CerulBot rec", e); return null; } }
/* ======================= joc ======================= */
function legsPerDay(L, T, ty, d) { const fm = L.flightMin ? L.flightMin(ty, d) : Math.round(d / T.PLANES[ty].speed * 60 + 30); return MIN_DAY / (2 * (fm + (T.turnMin || 45))); }

function playCands(st, seat, now, R, L, mem) {
  const c = st.c[seat], T = L.tune(), PN = personality(st, seat), P = PERSONALITIES[PN];
  const V = lightView(st, seat, now, L, mem);
  if (!V.co) return [];
  const gt = st.gt, day = st.day, maxDay = st.maxDay || 0;
  const daysLeft = maxDay ? maxDay - day + (1 - (V.clock ? V.clock.dayFrac : 0)) : 999;
  const PL = T.PLANES;
  const out = [];
  const cash = c.cash, value = Math.max(1, V.co.value || 1);
  const daily = (V.co.daily && V.co.daily.total) || 0;
  const inst = sum((V.bank && V.bank.loans || []).map(l => l.inst || 0));
  const reserve = Math.max(P.resMin, daily * 1.5 + inst * (P.resInst || 1.5) + value * P.resFrac);
  let spend = cash - reserve;
  const debt = V.co.debt || 0;
  const bankLimit = (V.bank && V.bank.limit) || 0;
  const maxDebt = Math.max(0, value * P.debtFrac);
  // marjă 5% sub limita băncii (limita depinde de valoarea companiei, care se poate mișca puțin între decizie și aplicare)
  const bankCap = Math.floor(bankLimit * 0.95 / 10000) * 10000;
  const bankAmt = x => Math.max(T.bankMin || 10000, Math.min(bankCap, Math.round(x / 10000) * 10000));
  const canBorrow = amt => bankCap >= Math.max(T.bankMin || 10000, amt) && debt + amt <= maxDebt && daysLeft > 4;
  // termen lung (rate zilnice mici): datoria rămasă se decontează oricum la final; termenele scurte sufocau lichiditatea
  const term = daysLeft > 6 ? 30 : daysLeft > 3 ? 20 : 10;
  const routes = V.routes || [], planes = V.planes || [];
  const myRoutes = {}; routes.forEach(r => { myRoutes[r.rid] = r; });
  const mr = Math.max.apply(null, PL.map(p => p.range));

  /* ---- 0) urgență: numerar negativ / sub rezervă ---- */
  if (cash < reserve * 0.35) {
    const needAmt = Math.round((reserve * 1.2 - cash) / 100000) * 100000 + 100000;
    if (bankCap >= (T.bankMin || 10000)) {
      const amt = bankAmt(needAmt);
      out.push({ k: "bankE" + day, a: { a: "bank", amount: amt, days: term === 10 && daysLeft > 10 ? 20 : term }, cd: 240 });
    }
    if (cash < 0) {
      // vinde avioane inactive sau returnează leasingul cel mai slab
      const idle = planes.filter(p => p.m === 0 && !p.rid);
      for (const p of idle) out.push({ k: "sellE" + p.id, a: { a: "sellPlane", pid: p.id }, cd: 600 });
      const leased = planes.filter(p => p.ls && p.m !== 2 && p.m !== 3).sort((a, b) => rProfit(myRoutes[a.rid]) - rProfit(myRoutes[b.rid]));
      if (leased.length && c.neg >= 2) out.push({ k: "sellL" + leased[0].id, a: { a: "sellPlane", pid: leased[0].id }, cd: 600 });
      if (c.neg >= 3 || bankLimit < (T.bankMin || 10000)) {
        const owned = planes.filter(p => !p.ls && p.m !== 2 && p.m !== 3).sort((a, b) => rProfit(myRoutes[a.rid]) - rProfit(myRoutes[b.rid]));
        if (owned.length > 2 && c.neg >= 3) out.push({ k: "sellO" + owned[0].id, a: { a: "sellPlane", pid: owned[0].id }, cd: 600 });
      }
      // cere împrumut unui adversar (rar)
      const cn = (V.legal && V.legal.canNego) || [];
      if (cn.length && mem.lastNegoDay < day - 2) {
        const opp = (V.opp || []).filter(o => cn.indexOf(o.seat) >= 0 && !o.frozen).sort((a, b) => (a.rank || 9) - (b.rank || 9))[0];
        if (opp) {
          const amt = Math.min(6e6, Math.max(1e6, Math.round((-cash + reserve) / 100000) * 100000));
          mem.lastNegoDay = day;
          out.push({ k: "nopen" + day, a: { a: "negoOpen", with: opp.seat, loan: { amt, rep: Math.round(amt * 1.09 / 1000) * 1000, days: 10 } }, cd: 1440 });
        }
      }
    }
  }

  /* ---- 1) permise oferite ---- */
  if (V.offer && V.offer.length) {
    const room = Math.max(1, (T.maxPermits || 3) - c.pm.length);
    const sc = V.offer.map(p => ({ p, s: permitScore(st, seat, c, p, L, V, PL, daysLeft) })).sort((a, b) => b.s - a.s);
    const keep = [sc[0].p.id];
    for (let i = 1; i < sc.length && keep.length < room; i++) if (sc[i].s > 0.6 * sc[0].s && sc[i].s > 0) keep.push(sc[i].p.id);
    out.push({ k: "keep" + sc.map(x => x.p.id).join(","), a: { a: "keepPermits", ids: keep }, cd: 60 });
  }

  /* ---- 2) construcții ---- */
  const builds = (V.permits || []).slice().sort((a, b) => (b.dem || 0) - (a.dem || 0));
  for (const p of builds) {
    if ((p.dem || 0) < THIN && daysLeft >= 3) continue;
    if (p.canBuild) {
      if (cash - p.cost >= Math.min(reserve * 0.4, 1e6) || daysLeft < 3) out.push({ k: "build" + p.id, a: { a: "build", permitId: p.id }, cd: 60 });
      else if (canBorrow(p.cost + reserve * 0.5 - cash)) out.push({ k: "bankB" + p.id, a: { a: "bank", amount: bankAmt(Math.round((p.cost + reserve - cash) / 100000) * 100000 + 200000), days: term }, cd: 240 });
    } else if (p.canFast && !(p.slots || []).some(x => !x.ok) && cash - p.cost >= Math.min(reserve * 0.4, 1e6)) {
      out.push({ k: "fast" + p.id, a: { a: "build", permitId: p.id, fast: true }, cd: 60 });
    } else if ((p.slots || []).some(x => !x.ok) && c.sx.slot) {
      const ap = p.slots.find(x => !x.ok).ap;
      out.push({ k: "pslot" + ap, a: { a: "play", card: "slot", ap }, cd: 120 });
    }
  }

  /* ---- 3) avioane inactive → rută ---- */
  const capOf = (rid, extra) => {
    const r = myRoutes[rid]; let cap = 0;
    for (const p of planes) if (p.rid === rid) cap += PL[p.ty].seats * legsPerDay(L, T, p.ty, r.d);
    if (extra) cap += PL[extra].seats * legsPerDay(L, T, extra, r.d);
    return cap * (P.capUse || 1);
  };
  const potOf = r => potential(st, L, r, P);
  const gapOf = r => Math.max(potOf(r).ab, potOf(r).ba) - capOf(r.rid);
  const idle = planes.filter(p => p.m === 0 && !p.rid);
  for (const p of idle) {
    const fit = routes.filter(r => canFly(L, PL, p.ty, r) && !r.closed);
    if (!fit.length) {
      mem.idle[p.id] = mem.idle[p.id] || day;
      if (day - mem.idle[p.id] >= 2 || p.ls) out.push({ k: "sellI" + p.id, a: { a: "sellPlane", pid: p.id }, cd: 600 });
      continue;
    }
    fit.sort((a, b) => (b.planes.length ? 0 : 1) - (a.planes.length ? 0 : 1) || gapOf(b) * b.normal - gapOf(a) * a.normal);
    out.push({ k: "asg" + p.id + fit[0].rid, a: { a: "assign", pid: p.id, rid: fit[0].rid }, cd: 30, chk: chkAssign(seat, p.id, fit[0].rid) });
  }

  /* ---- 4) Decolează manual / piloți ---- */
  for (const p of planes) {
    if (p.m !== 1 || !p.rid) continue;
    if (wantPilot(P, p.ty, PL) && !p.pil && cash > reserve * 0.5) { out.push({ k: "pil" + p.id, a: { a: "pilot", pid: p.id, on: true }, cd: 600, chk: chkPilot(seat, p.id) }); continue; }
    if (p.pil || p.go || !p.ready || !p.canDepart) continue;
    const pp = st.pl.find(x => x.id === p.id); const waited = pp ? gt - pp.t0 : 0;
    const r = myRoutes[p.rid]; const price = r ? (p.ap === r.a ? r.pa : r.pb) : 1;
    const be = (p.cost || 0) / Math.max(1, p.seats * price);
    const qn = r ? (p.ap === r.a ? r.q.ab : r.q.ba) : 0;
    // FIX1: nu mai pleacă pe jumătate gol (ca pilotul automat: ≥ break-even + 15 pp și măcar ~50% plin, apoi praguri mai mici)
    if (p.load >= 0.98 || (waited >= 60 && p.load >= Math.max(be + 0.15, 0.5) && qn < 3) || (waited >= 150 && p.load >= Math.max(be + 0.08, 0.4)) ||
        (waited >= 240 && p.load >= be + 0.03) || waited >= 360)
      out.push({ k: "dep" + p.id + "|" + (pp ? pp.t0 : 0), a: { a: "depart", pid: p.id }, cd: 60, chk: chkDepart(seat, p.id) });
  }

  /* ---- 5) cărți speciale ---- */
  specialCands(st, seat, c, V, L, T, P, R, mem, out, routes, planes, myRoutes, capOf, potOf, daysLeft, mr);

  /* ---- 6) prețuri ---- */
  for (const r of routes) {
    const nrm = r.normal;
    const hasPl = r.planes.length > 0;
    for (const dir of ["ab", "ba"]) {
      const rec = dir === "ab" ? r.rec : r.recBa; if (!rec && hasPl) continue;
      const pm = r.comp > 0 && P.compPrice !== undefined ? P.compPrice : P.priceMult;
      let target = hasPl ? rec.rec * pm : nrm * pm;
      // dacă rămân mulți pasageri la poartă, urcă puțin; dacă zboară gol, coboară
      const q = dir === "ab" ? r.q.ab : r.q.ba;
      if (hasPl && r.lf !== null && r.lf !== undefined) { if (r.lf < 0.45) target *= 0.92; else if (r.lf > 0.97 && q > 40) target *= 1.06; }
      if (V.spy && V.spy.rid === r.rid && PN === "lowcost") target = Math.min(target, (dir === "ab" ? V.spy.pa : V.spy.pb) * 0.95);
      target = Math.round(clamp(target, nrm * 0.5, nrm * 2.6) / 5) * 5 || 1;
      const cur = dir === "ab" ? r.pa : r.pb;
      const k = "pr" + r.rid + dir;
      mem.priced[r.rid] = 1;
      if (Math.abs(target - cur) / Math.max(1, cur) > 0.07) out.push({ k, a: { a: "price", rid: r.rid, dir, p: target }, cd: 300, chk: chkPrice(seat, r.rid, target) });
    }
  }

  /* ---- 7) avioane noi: cea mai bună opțiune pe care o pot finanța (numerar / credit / leasing) ---- */
  const nPl = planes.length, leasedN = planes.filter(p => p.ls).length;
  let saving = false;
  // mod de redresare: mult mai puține avioane decât rute (după vânzări de urgență) → leasing imediat ce pot plăti câteva zile de chirie
  const rescue = nPl * 2 < routes.filter(r => !r.closed).length && daysLeft > 4;
  if (nPl < P.maxPlanes && daysLeft > 2) {
    const opts = [], save = [];
    const borrowable = daysLeft > 4 ? Math.max(0, Math.min(bankCap, maxDebt - debt)) : 0;
    for (const r of routes) {
      if (r.closed) continue;
      const pot = potOf(r), cap = capOf(r.rid), gap = Math.max(pot.ab, pot.ba) - cap;
      const noPlane = !r.planes.length;
      if (gap <= (P.gapMin === undefined ? 25 : P.gapMin) && !noPlane) continue;
      for (let ty = 0; ty < PL.length; ty++) {
        const pt = PL[ty]; if (!canFly(L, PL, ty, r)) continue;
        const lg = legsPerDay(L, T, ty, r.d), seatsDay = pt.seats * lg;
        const carryAB = Math.min(seatsDay, Math.max(0, pot.ab - cap)), carryBA = Math.min(seatsDay, Math.max(0, pot.ba - cap));
        const price = r.normal * P.priceMult * (gap > seatsDay * 1.5 ? 1.15 : 1);
        let fc = 0; try { fc = L.flightCost(st, seat, ty, r.a, r.b); } catch (e) { fc = r.d * pt.ckm + 1000; }
        const legs = Math.min(lg, Math.max(carryAB, carryBA) / pt.seats + 0.5);
        const prof = (carryAB + carryBA) * price - 2 * legs * fc - pt.maint * 1.1 - (wantPilot(P, ty, PL) ? pilotFee(T, pt) : 0);
        if (prof <= pt.maint * 0.2) continue;
        let sc = prof - pt.price * 0.012 + P.sizeBias * prof * (sizeRank(PL, ty) - 0.5) + (noPlane ? 50000 : 0);
        // finanțare
        const used = (V.shop && V.shop.used || []).filter(u => u.ty === ty && u.ag <= (P.preferUsed >= 1 ? 1300 : 800)).sort((x, y) => x.pr - y.pr)[0];
        const useUsed = used && (P.preferUsed >= 1 || (P.preferUsed > 0 && (used.id % 2 === 0)));
        const cost = useUsed ? used.pr : pt.price;
        let how = null;
        if (spend >= cost) how = useUsed ? "used" : "new";
        else if (spend + borrowable >= cost + 200000 && prof > cost * 0.008) how = "bank";
        else if (P.lease && leasedN < 6 && prof - pt.lease > pt.lease * 0.35 && daysLeft > 3 &&
          (P.leaseCash ? cash > Math.max(P.resMin * 0.5, pt.lease * P.leaseCash) : cash > reserve * 0.6 || (rescue && cash > Math.max(300000, pt.lease * 3)))) { how = "lease"; sc = prof - pt.lease; }
        if (!how) { if (isBig(PL, ty)) save.push({ sc, prof, ty, r, cost }); continue; }
        opts.push({ sc, prof, ty, r, how, used, cost });
      }
    }
    opts.sort((x, y) => y.sc - x.sc);
    // economisește pentru un avion mare (Aero / Skyliner pe rute lungi) dacă e clar mai bun decât ce pot cumpăra acum
    // și îl pot strânge în câteva zile: atunci nu mai construiesc rute și nu cumpăr avioane mici pe rute deja servite.
    save.sort((x, y) => y.sc - x.sc);
    const sv = save[0], best = opts[0];
    const netDay = sum(routes.map(r => r.p7 || 0)) / 7 - daily;
    const reach = spend + borrowable + Math.max(0, netDay) * 5;
    if (sv && daysLeft > 12 && sv.sc > Math.max(150000, best ? best.sc * 1.4 : 0) && reach >= sv.cost) {
      saving = true;
      if (best && best.r.planes.length) opts.length = 0;
    }
    if (G.__CERUL_BOT_TRACE) G.__CERUL_BOT_TRACE(seat, PN, { day, cash, spend, reserve, borrowable, debt, maxDebt, saving, nOpts: opts.length, best: opts[0] && { ty: opts[0].ty, how: opts[0].how, sc: opts[0].sc | 0, rid: opts[0].r.rid }, sv: sv && { ty: sv.ty, sc: sv.sc | 0, cost: sv.cost, rid: sv.r.rid }, reach, gaps: routes.map(r => (gapOf(r) | 0)).join(",") });
    // FIX1: verifică opțiunea aleasă cu CerulLogic.estimate (cota reală cu n+1 avioane): profit/zi > 0 la cumpărare,
    // > chiria × 1,15 la leasing; altfel încearcă următoarea (max. 4 estimări pe apel)
    let o = null;
    if (L.estimate) {
      let tries = 0;
      for (const x of opts) {
        if (tries++ >= 4) break;
        let e = null; try { e = L.estimate(st, seat, { type: x.ty, rid: x.r.rid }); } catch (er) { e = null; }
        if (!e || !e.ok) continue;
        const need = x.how === "lease" ? PL[x.ty].lease * 1.15 : Math.max(5000, PL[x.ty].price * 0.004);
        if (e.profitDay >= need) { o = x; break; } // estimate() nu include chiria pentru un tip nou
      }
    } else o = opts[0];
    if (o) {
      if (o.how === "new") out.push({ k: "buyN" + o.ty + "|" + day + "|" + nPl, a: { a: "buyPlane", type: o.ty }, cd: 60 });
      else if (o.how === "used") out.push({ k: "buyU" + o.used.id, a: { a: "buyPlane", used: o.used.id }, cd: 600 });
      else if (o.how === "bank") out.push({ k: "bankP" + day + "|" + nPl, a: { a: "bank", amount: bankAmt(Math.round((o.cost - spend) / 100000) * 100000 + 300000), days: term }, cd: 180 });
      else out.push({ k: "lease" + o.ty + "|" + day + "|" + nPl, a: { a: "buyPlane", type: o.ty, lease: true }, cd: 120 });
    }
  }

  // rute fără avion (≥ 2) sau economisesc pentru un avion mare → nu mai construiesc rute noi (banii merg în avioane)
  const unserved = routes.filter(r => !r.closed && !r.planes.length).length;
  if ((saving || unserved >= 3) && daysLeft > 3) {
    for (let i = out.length - 1; i >= 0; i--) { const a = out[i].a; if (a && (a.a === "build" || (a.a === "bank" && /^bankB/.test(out[i].k)))) out.splice(i, 1); }
  }

  /* ---- 8) rebalansare: avion pe rută slabă → rută cu cerere neacoperită ---- */
  if ((mem.cd.rebal || -1) <= gt) {
    for (const r of routes) {
      if (r.planes.length < 2 || r.lf === null || r.lf === undefined || r.lf > 0.5) continue;
      const cand = planes.filter(p => p.rid === r.rid && p.m === 1 && p.px < p.seats * 0.3);
      if (!cand.length) continue;
      const p = cand[0];
      const tgt = routes.filter(x => x.rid !== r.rid && canFly(L, PL, p.ty, x) && !x.closed).map(x => ({ x, g: gapOf(x) })).filter(o => o.g > PL[p.ty].seats * 2).sort((a, b) => b.g - a.g)[0];
      if (tgt) { out.push({ k: "rebal" + p.id + "|" + day, a: { a: "assign", pid: p.id, rid: tgt.x.rid }, cd: 1440, chk: chkAssign(seat, p.id, tgt.x.rid) }); mem.cd.rebal = gt + 240; break; }
    }
  }

  /* ---- 8b) avion mare pe rută „slabă” (recomandarea nu atinge 55%) → mută-l unde aduce clar mai mult;
          leasing care pierde bani → returnează-l ---- */
  if (L.estimate && (mem.cd.weak || -1) <= gt && daysLeft > 3) {
    mem.cd.weak = gt + 120;
    const est = (pid, rid) => { try { const e = L.estimate(st, seat, { pid, rid }); return e && e.ok ? e.profitDay : -Infinity; } catch (er) { return -Infinity; } };
    const weakR = routes.filter(r => (r.rec && r.rec.weak && (r.rec.estLoad || 0) < 0.42) || (r.recBa && r.recBa.weak && (r.recBa.estLoad || 0) < 0.42));
    let moved = false;
    for (const r of weakR) {
      const p = planes.filter(x => x.rid === r.rid && x.m === 1 && isBig(PL, x.ty)).sort((a, b) => PL[b.ty].seats - PL[a.ty].seats)[0];
      if (!p) continue;
      const cur = est(p.id, r.rid);
      const cands = routes.filter(x => x.rid !== r.rid && !x.closed && canFly(L, PL, p.ty, x)).map(x => ({ x, g: gapOf(x) })).sort((a, b) => b.g - a.g).slice(0, 6);
      let best = null; for (const c0 of cands) { const v = est(p.id, c0.x.rid); if (!best || v > best.v) best = { rid: c0.x.rid, v }; }
      if (best && best.v > cur + 20000 && best.v > Math.abs(cur) * 0.25 + cur) {
        out.push({ k: "wmov" + p.id + "|" + day, a: { a: "assign", pid: p.id, rid: best.rid }, cd: 1440, chk: chkAssign(seat, p.id, best.rid) }); moved = true; break;
      }
    }
    if (!moved) {
      mem.lsI = ((mem.lsI || 0) + 1);
      const ls = planes.filter(x => x.ls && x.rid && x.m === 1);
      const p = ls.length ? ls[mem.lsI % ls.length] : null;
      const r = p && myRoutes[p.rid];
      if (p && r && st.rt[r.rid] && gt - (st.rt[r.rid].t0 || 0) > 3 * MIN_DAY && est(p.id, r.rid) < -PL[p.ty].lease * 0.1) {
        mem.lsBad = mem.lsBad || {}; mem.lsBad[p.id] = (mem.lsBad[p.id] || 0) + 1;
        if (mem.lsBad[p.id] >= 3) out.push({ k: "lret" + p.id, a: { a: "sellPlane", pid: p.id }, cd: 1440 });
      } else if (p && mem.lsBad) mem.lsBad[p.id] = 0;
    }
  }

  /* ---- 9) permise: trage / aruncă ---- */
  for (const p of (V.permits || [])) {
    mem.perm[p.id] = mem.perm[p.id] || day;
    const blocked = (p.slots || []).some(x => !x.ok) && !c.sx.slot;
    const totalMiss = sum(p.miss || []) - Math.min(c.h[4], p.jok || 0);
    const stale = day - mem.perm[p.id] >= 8 && totalMiss >= 4;
    const thin = (p.dem || 0) < THIN && day - mem.perm[p.id] >= 2 && daysLeft > 4;
    const endDiscard = maxDay && daysLeft < 1.2 && !p.canBuild && (T.valPermitPenalty || 0) > 0; // −penalitate mai mică decât permisul deschis la final
    if (blocked && day - mem.perm[p.id] >= 1 || stale || endDiscard || thin) out.push({ k: "disc" + p.id, a: { a: "discardPermit", id: p.id }, cd: 600 });
  }
  if (V.canDraw && !V.offer && daysLeft > 2.5 && c.pm.length < 3) out.push({ k: "draw" + day + "|" + c.pm.length, a: { a: "drawPermits" }, cd: 120 });

  /* ---- 10) cărți: ghișeu / cumpărare ---- */
  cardCands(st, seat, c, V, L, T, P, out, spend, daysLeft);

  /* ---- 11) bancă: rambursare ---- */
  if (V.bank && V.bank.loans && V.bank.loans.length && !best7(out)) {
    const loans = V.bank.loans.slice().sort((a, b) => b.r - a.r);
    for (const l of loans) if (cash - reserve * 2.5 > l.p && daysLeft > 1) { out.push({ k: "repay" + l.id, a: { a: "repay", id: l.id, amount: l.p }, cd: 240 }); break; }
  }

  /* ---- 12) hub ---- */
  if (P.hubRoutes < 99 && c.hubs.length < 1 && daysLeft > 15) {
    const cnt = {}; for (const r of routes) for (const ap of [r.a, r.b]) cnt[ap] = (cnt[ap] || 0) + 1;
    for (const ap in cnt) {
      if (cnt[ap] < P.hubRoutes) continue;
      const A = L.airport(ap); const hp = (T.hubPrice && T.hubPrice.length > 3 ? T.hubPrice[A.size] : (T.hubPrice || [4e6, 8e6, 14e6])[A.size - 1]) || 8e6;
      if (spend > hp * 2) { out.push({ k: "hub" + ap, a: { a: "hub", ap }, cd: 1440 }); break; }
    }
  }

  /* ---- 12b) investiții de joc târziu (Extinde baza / Terminal / Flotă eco / Mentenanță) ---- */
  if (L.invInfo && (V.legal && V.legal.invest) && daysLeft > 6) {
    const iv = investCand(st, seat, c, L, T, P, routes, planes, myRoutes, daysLeft, spend, out, mem);
    if (iv) out.push(iv);
  }

  /* ---- 13) bursa ---- */
  if (P.shares && V.shares) {
    const mine = V.shares.find(s => s.mine);
    if (mine && mine.held > 0 && spend > mine.price * 1.02 * Math.min(5, mine.held) * 3) out.push({ k: "shB" + day, a: { a: "shares", co: seat, n: Math.min(5, mine.held), buy: true }, cd: 720 });
    if (P.shares >= 2 && daysLeft > 12 && spend > 15e6 && !hasBuy(out)) {
      const opps = V.shares.filter(s => !s.mine && s.free > 0 && s.own < 15).sort((a, b) => b.price - a.price);
      const t = opps[0];
      if (t && t.price * 5 * 1.02 < spend * 0.3) out.push({ k: "shO" + t.co + day, a: { a: "shares", co: t.co, n: 5, buy: true }, cd: 1440 });
    }
  }

  /* ---- 14) pact cu cine m-a înghețat ---- */
  if (mem.frozenBy && mem.frozenDay >= day - 1 && st.c[mem.frozenBy] && !st.c[mem.frozenBy].out) {
    const cn = (V.legal && V.legal.canNego) || [];
    if (cn.indexOf(mem.frozenBy) >= 0 && mem.lastNegoDay < day - 3 && !(V.pacts || []).some(p => p.with === mem.frozenBy) && R() < 0.3) {
      mem.lastNegoDay = day;
      mem.negoPlan = { id: (st.ngn || 0) + 1, give: { cash: 200000 }, get: { pact: 5 } };
      out.push({ k: "npact" + day, a: { a: "negoOpen", with: mem.frozenBy }, cd: 1440 });
    }
    mem.frozenBy = null;
  }
  return out;
}
/* investiții: câștig estimat/zi × zilele rămase − partea pierdută la evaluare (1 − valueMult) × preț; doar din banii „în plus”
   (nu concurează cu avioanele/rutele din aceeași tură; rezerva rămâne neatinsă) */
function investCand(st, seat, c, L, T, P, routes, planes, myRoutes, daysLeft, spend, out, mem) {
  let info; try { info = L.invInfo(st, seat); } catch (e) { return null; }
  if (!info) return null;
  const PL = T.PLANES, I = T.INV || {}, vm = info.valueMult === undefined ? 0.5 : info.valueMult;
  const W = P.inv || {}, fm = (L.fuelMult ? L.fuelMult(st, seat) : st.fi || 1);
  const busy = out.some(o => o.a && (o.a.a === "buyPlane" || o.a.a === "build" || (o.a.a === "bank" && /^bank[PB]/.test(o.k))));
  const effDays = Math.max(0, daysLeft - 1);
  const opts = [];
  const flown = p => { const r = myRoutes[p.rid]; if (!r) return null; return { r, rt: legsPerDay(L, T, p.ty, r.d) * 0.7 }; };
  // Flotă eco: −x% combustibil pentru un tip
  for (const e of info.eco || []) {
    if (!e.ok) continue;
    let g = 0; for (const p of planes) { if (p.ty !== e.ty) continue; const f = flown(p); if (f) g += 2 * f.rt * f.r.d * PL[p.ty].ckm * fm; }
    g *= e.fuel || 0.2;
    opts.push({ k: "eco", a: { a: "invest", k: "eco", ty: e.ty }, g: g * (W.eco || 1), price: e.price });
  }
  // Centru de mentenanță
  if (info.mnt && info.mnt.ok) {
    let m = 0, dv = 0;
    for (const p of planes) { const pt = PL[p.ty]; m += pt.maint * 1.15; if (!p.ls) dv += pt.price * (T.depDay || 0.004); }
    const g = m * (info.mnt.maint || 0.25) + dv * (info.mnt.dep || 0.4) + planes.length * 6000 * (info.mnt.breakdown || 0.6) * 0.5;
    opts.push({ k: "mnt", a: { a: "invest", k: "mnt" }, g: g * (W.mnt || 1), price: info.mnt.price });
  }
  // Extinde baza: +cerere pe rutele bazei, −taxe la bază
  if (info.base && info.base.ok && c.base) {
    let g = 0;
    for (const r of routes) { if (r.a !== c.base && r.b !== c.base) continue; g += Math.max(0, (r.p7 || 0) / 7) * 2 * (info.base.demand || 0.1) * 0.6; }
    const A = L.airport(c.base), lf = (T.landFee && T.landFee[A ? A.size : 2]) || 3000;
    for (const p of planes) { const f = flown(p); if (f && (f.r.a === c.base || f.r.b === c.base)) g += f.rt * lf * (PL[p.ty].feeMult || 1) * (info.base.fee || 0.15); }
    opts.push({ k: "base", a: { a: "invest", k: "base" }, g: g * (W.base || 1), price: info.base.price });
  }
  // Terminal propriu pe un aeroport mare unde am slot
  if (info.term && info.term.ok && (info.term.cand || []).length) {
    let tot = 0; for (const r of routes) tot += Math.max(0, (r.p7 || 0) / 7);
    let best = null;
    for (const ap of info.term.cand) {
      let g = 0;
      for (const r of routes) { if (r.a !== ap && r.b !== ap) continue; const pr = Math.max(0, (r.p7 || 0) / 7); g += pr * (r.comp > 0 ? 0.5 : 0.12) * (info.term.share || 0.2); }
      g += tot * 0.06 * (info.term.stars || 0.15);
      if (!best || g > best.g) best = { ap, g };
    }
    if (best) opts.push({ k: "term" + best.ap, a: { a: "invest", k: "term", ap: best.ap }, g: best.g * (W.term || 1), price: info.term.price });
  }
  if (G.__CERUL_BOT_ITRACE) G.__CERUL_BOT_ITRACE(seat, st.day, spend, daysLeft, opts.map(o => o.k + ":" + Math.round(o.g / 1000) + "k/d@" + Math.round(o.price / 1e6) + "M"));
  let pick = null;
  for (const o of opts) {
    if (!o.price || o.price > spend) continue;
    if (busy && spend < o.price * 2) continue;
    o.net = o.g * effDays - (1 - vm) * o.price;
    // bani care stau degeaba (≥ 4× prețul peste rezervă): acceptă și o investiție aproape neutră pentru valoare
    if (o.net < (spend > o.price * 4 && daysLeft > 10 ? -0.15 : 0.1) * o.price) continue;
    if (!pick || o.net / o.price > pick.net / pick.price) pick = o;
  }
  if (!pick) return null;
  return { k: "inv" + pick.k + "|" + st.day, a: pick.a, cd: 720 };
}
/* verificări exacte pentru acțiunile simple (oglindesc CerulLogic.apply); folosite doar înaintea oricărei acțiuni complexe */
function opsOk(st, seat) { const c = st.c[seat]; return (st.phase === "play" || st.phase === "nego") && !c.out && !c.fz; }
function chkPrice(seat, rid, p) {
  return (st, L) => { if (!opsOk(st, seat) || !st.c[seat].r[rid]) return false; const T = L.tune(), e = ends(rid), nrm = L.normalPrice(L.dist(e[0], e[1]), e[0], e[1]);
    const lo = Math.max(T.priceMinAbs || 1, Math.round(nrm * (T.priceMinMult || 0.1))), hi = Math.round(nrm * (T.priceMaxMult || 10)); return p >= lo && p <= hi; };
}
function chkPlane(seat, pid, f) { return (st, L) => { if (!opsOk(st, seat)) return false; const p = st.pl.find(x => x.id === pid && x.s === seat); return !!p && f(p, st, L); }; }
const chkPilot = (seat, pid) => chkPlane(seat, pid, () => true);
const chkDepart = (seat, pid) => chkPlane(seat, pid, (p, st, L) => p.m === 1 && !!p.rid && !L.isClosed(st, p.ap, seat) && !L.isClosed(st, otherEnd(p.rid, p.ap), seat));
const chkAssign = (seat, pid, rid) => chkPlane(seat, pid, (p, st, L) => !!st.c[seat].r[rid] && !(p.rid === rid && !p.ud) && (L.canServe ? L.canServe(p.ty, rid) : true));
function canFly(L, PL, ty, r) { if (L.canServe) { try { return L.canServe(ty, r.rid); } catch (e) {} } return PL[ty].range >= r.d; }
function pilotFee(T, pt) { return pt.pilot || T.pilotSalary || 1500; }
function wantPilot(P, ty, PL) { return P.pilots === true || (P.pilots === "big" && isBig(PL, ty)); }
/* generic peste N tipuri de avion: rangul de mărime (0 = cel mai mic … 1 = cel mai mare, după locuri) și „avion mare” (≥ 120 locuri) */
let SRc = null, SRk = null;
function sizeRank(PL, ty) {
  if (SRk !== PL) { const idx = PL.map((p, i) => i).sort((a, b) => PL[a].seats - PL[b].seats || PL[a].range - PL[b].range); SRc = []; idx.forEach((t, i) => { SRc[t] = idx.length > 1 ? i / (idx.length - 1) : 0.5; }); SRk = PL; }
  return SRc[ty] === undefined ? 0.5 : SRc[ty];
}
function isBig(PL, ty) { const pt = PL && PL[ty]; return !!pt && pt.seats >= 120; }
function rProfit(r) { return r ? (r.p7 || 0) + (r.today || 0) : -1e9; }
function best7(out) { return out.some(o => o.a.a === "buyPlane" || o.a.a === "build"); }
function hasBuy(out) { return out.some(o => o.a.a === "buyPlane" || (o.a.a === "bank")); }

/* cererea potențială pe direcție (pasageri/zi) la prețul țintă al personalității */
function potential(st, L, r, P) {
  const nrm = r.normal, tgt = nrm * P.priceMult;
  const f = (dem, p, ramp) => {
    let x = dem * Math.pow(Math.max(0.2, p / tgt), 1.8);
    if (!r.planes.length) x *= 2; // fără avion: atractivitate redusă (frecvență)
    return x;
  };
  let ab = f(r.dem.ab, r.pa), ba = f(r.dem.ba, r.pb);
  // rută disputată: încă un avion crește cota (frecvența) → cererea pe care aș transporta-o cu n+1 avioane
  if (P.freqPot && r.comp > 0 && r.planes.length) {
    const n = r.planes.length, k = Math.pow((n + 1) / n, 0.35);
    const up = sh => sh > 0 && sh < 1 ? (k * sh / (k * sh + 1 - sh)) / sh : 1;
    ab *= up(r.sh ? r.sh.ab : 0); ba *= up(r.sh ? r.sh.ba : 0);
  }
  // plafon: cererea totală a perechii (informație publică) + tranzit
  try { const raw = L.rawDemand(st, r.a, r.b) * (r.ramp || 1) * 1.35; ab = Math.min(ab, raw); ba = Math.min(ba, L.rawDemand(st, r.b, r.a) * (r.ramp || 1) * 1.35); } catch (e) {}
  return { ab, ba };
}

function permitScore(st, seat, c, p, L, V, PL, daysLeft) {
  const d = p.d, nrm = L.normalPrice(d, p.a, p.b);
  const dem = p.dem || 100;
  // FIX1: valoarea cererii (€/zi la prețul normal) domină scorul; perechile foarte subțiri (< ~40 pasageri/zi) nu merită un slot
  let s = Math.min(dem, 1500) * nrm / 25;
  if (dem < 40) s -= (40 - dem) * 120;
  const P = PERSONALITIES[personality(st, seat)];
  if (P.compAvoid || P.bizBonus) {
    // premium: preferă rutele „afaceri” (puțin sensibile la preț) și evită rutele deja servite de adversari (informație publică)
    const rid = L.ridOf(p.a, p.b);
    const comp = st.ps.filter(x => x !== seat && !st.c[x].out && st.c[x].r[rid]).length;
    if (comp && P.compAvoid) s *= Math.pow(1 / (comp + 1), P.compAvoid);
    if (P.bizBonus) { const A = L.airport(p.a), B2 = L.airport(p.b); if ((A && (A.tags || []).indexOf("afaceri") >= 0) || (B2 && (B2.tags || []).indexOf("afaceri") >= 0)) s *= P.bizBonus; }
  }
  const k = p.k || [0, 0, 0, 0];
  let miss = 0; for (let i = 0; i < 4; i++) miss += Math.max(0, k[i] - c.h[i]); miss = Math.max(0, miss - c.h[4]);
  s += 600 - miss * 160 - sum(k) * 40;
  // sloturi
  for (const ap of [p.a, p.b]) {
    const a = V.map && V.map.airports && V.map.airports[ap];
    if (a && a.mine) continue;
    const A = L.airport(ap); if (!A) continue;
    if (a && a.slots >= a.cap) s -= 3000;
    s -= [150000, 600000, 1500000][A.size - 1] / 3000;
  }
  if (d > Math.max.apply(null, PL.map(x => x.range))) s -= 5000;
  if (daysLeft < 6) s -= miss * 300;
  return s;
}

function cardCands(st, seat, c, V, L, T, P, out, spend, daysLeft) {
  const pms = V.permits || []; if (!pms.length) return;
  // permisul țintă: cel cu cele mai puține cărți lipsă (după Jokeri)
  const need = [0, 0, 0, 0]; for (const p of c.pm) for (let i = 0; i < 4; i++) need[i] += p.k[i];
  let tgt = null, tgtMiss = 99;
  for (const p of pms) {
    if ((p.slots || []).some(x => !x.ok)) continue;
    const m = Math.max(0, sum(p.miss || []) - c.h[4]);
    if (m > 0 && m < tgtMiss) { tgtMiss = m; tgt = p; }
  }
  if (!tgt) return;
  // ce tip lipsește (primul cu deficit, după Jokeri)
  let jok = c.h[4], want = -1;
  for (let i = 0; i < 4; i++) { const m = tgt.miss[i]; if (m > 0) { if (jok >= m) { jok -= m; continue; } want = i; break; } }
  if (want < 0) return;
  // ghișeu: 5 cărți de surplus → 1 lipsă
  const sur = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) sur[i] = Math.max(0, c.h[i] - need[i]);
  if (sum(sur) >= (T.ghiseuN || 5) && (daysLeft > 2 || tgtMiss <= 1)) {
    const give = [0, 0, 0, 0, 0]; let left = T.ghiseuN || 5;
    const order = [0, 1, 2, 3].sort((a, b) => sur[b] - sur[a]);
    for (const i of order) { const k = Math.min(left, sur[i]); give[i] += k; left -= k; if (!left) break; }
    if (!left) { out.push({ k: "gh" + give.join("") + want, a: { a: "ghiseu", give, get: want }, cd: 30 }); return; }
  }
  // cumpărare (prețul crește ×1.6 în aceeași zi)
  const pr = (V.cards && V.cards.buyPrice) || (V.legal && V.legal.cardPrice) || 350000;
  const worth = 1.6e6 + (tgt.dem || 100) * L.normalPrice(tgt.d, tgt.a, tgt.b) * 0.5;
  if (tgtMiss <= P.buyCards && pr * tgtMiss <= worth * 0.6 && spend > pr + (tgt.cost || 0)) out.push({ k: "bc" + st.day + "|" + c.bc, a: { a: "buyCard", type: want }, cd: 5 });
}

function specialCands(st, seat, c, V, L, T, P, R, mem, out, routes, planes, myRoutes, capOf, potOf, daysLeft, mr) {
  const sx = c.sx || {}; const lp = (V.legal && V.legal.play) || {};
  const late = daysLeft < 2;
  if (sx.gift) out.push({ k: "gift", a: { a: "play", card: "gift" }, cd: 60 });
  if (late) return; // la final, cărțile speciale păstrate valorează mai mult
  // ❄️ Îngheață timpul
  if (sx.frz && Array.isArray(lp.frz) && lp.frz.length && st.day >= 2) {
    const mine = new Set(routes.map(r => r.rid));
    const cands = (V.opp || []).filter(o => lp.frz.indexOf(o.seat) >= 0).map(o => {
      const shared = (o.routes || []).filter(r => mine.has(r)).length;
      return { o, sc: shared * 3 + (o.rank === 1 ? 3 : 0) + (o.inAir || 0) * 0.5 + (o.planes || 0) * 0.1 };
    }).sort((a, b) => b.sc - a.sc);
    const t = cands[0];
    if (t) {
      const me = V.co.rank || 9;
      const want = (t.sc >= 3) || (t.o.rank === 1 && me !== 1) || daysLeft < 6 || (sx.frz >= 2);
      if (want && R() < 0.035 * P.frzAggro) out.push({ k: "frz" + t.o.seat + "|" + st.day, a: { a: "play", card: "frz", target: t.o.seat }, cd: 720 });
    }
  }
  // 🎟️ Permis VIP
  if (sx.vip && lp.vip && c.pm.length < (T.maxPermits || 3) && !V.offer && daysLeft > 5) {
    const pair = vipPair(st, seat, c, V, L, mr);
    if (pair) out.push({ k: "vip" + pair[0] + pair[1], a: { a: "play", card: "vip", a: pair[0], b: pair[1] }, cd: 240 });
  }
  // 📣 reclamă
  const fx = V.fx || [];
  if (sx.ad && !fx.some(f => f.k === "ad") && routes.length >= 2 && (routes.some(r => r.comp > 0) || routes.length >= 3) && R() < P.adPlay) out.push({ k: "ad" + st.day, a: { a: "play", card: "ad" }, cd: 720 });
  // ⛽ contract combustibil
  if (sx.fuel && !fx.some(f => f.k === "fuel") && planes.length >= 3 && ((V.co.fuelMult || 1) > 1.04 || planes.length >= 5)) out.push({ k: "fuel" + st.day, a: { a: "play", card: "fuel" }, cd: 720 });
  // 📈 boom: pe ruta cu cea mai multă capacitate liberă
  if (sx.boom) {
    let best = null;
    for (const r of routes) {
      if (!r.planes.length || r.boom) continue;
      const pot = potOf(r), spare = capOf(r.rid) - Math.max(pot.ab, pot.ba);
      const gain = Math.min(spare, Math.max(pot.ab, pot.ba)) * 2 * r.normal * 2;
      if (!best || gain > best.g) best = { r, g: gain };
    }
    if (best && best.g > 700000) out.push({ k: "boom" + best.r.rid, a: { a: "play", card: "boom", rid: best.r.rid }, cd: 720 });
  }
  // 🔍 spion: pe un adversar cu care împart o rută (doar low-cost îl folosește activ)
  if (sx.spy && Array.isArray(lp.spy) && lp.spy.length && !V.spy && (P.name === "lowcost" || sx.spy >= 2)) {
    // ținta: adversarul cu cele mai multe rute comune (liderul la egalitate), nu primul în ordinea locurilor
    const mine = new Set(routes.map(r => r.rid));
    const tg = (V.opp || []).filter(o => lp.spy.indexOf(o.seat) >= 0).map(o => ({ o, sh: (o.routes || []).filter(x => mine.has(x)) }))
      .filter(x => x.sh.length).sort((a, b) => b.sh.length - a.sh.length || (a.o.rank || 9) - (b.o.rank || 9))[0];
    if (tg) {
      const r = tg.sh.map(x => myRoutes[x]).filter(Boolean).sort((a, b) => (b.p7 || 0) - (a.p7 || 0))[0];
      if (r) out.push({ k: "spy" + tg.o.seat + r.rid, a: { a: "play", card: "spy", target: tg.o.seat, rid: r.rid }, cd: 1440 });
    }
  }
}
function vipPair(st, seat, c, V, L, mr) {
  const net = new Set([c.base].concat(c.hubs || [])); for (const rid in c.r) ends(rid).forEach(x => net.add(x));
  const owned = new Set(Object.keys(c.r)); for (const p of c.pm) owned.add(L.ridOf(p.a, p.b));
  const aps = (L.data && L.data().AIRPORTS) || [];
  let best = null;
  for (const a of net) for (const x of aps) {
    if (x.id === a) continue; const rid = L.ridOf(a, x.id); if (owned.has(rid)) continue;
    const d = L.dist(a, x.id); if (d < 400 || d > Math.min(mr, 5000)) continue;
    const ma = V.map && V.map.airports && V.map.airports[x.id];
    if (ma && !ma.mine && ma.slots >= ma.cap) continue;
    let dem = 0; try { dem = L.rawDemand(st, a, x.id); } catch (e) { continue; }
    const sc = dem * L.normalPrice(d, a, x.id) / (d < 1500 ? 2.5 : 4.5);
    if (!best || sc > best.sc) best = { sc, p: [a, x.id] };
  }
  return best ? best.p : null;
}

/* ======================= respond (opțional pentru gazdă) ======================= */
function respond(st, seat, kind, data, now, rng) {
  try {
    const acts = decide(st, seat, now, rng);
    const want = { breaker: ["breaker"], nego: ["negoAccept", "negoRefuse", "negoOffer", "negoClose", "negoSay"], loan: ["negoAccept", "negoRefuse", "negoOffer"] }[kind] || null;
    const a = acts.find(x => !want || want.indexOf(x.a) >= 0);
    return a || null;
  } catch (e) { return null; }
}

const CerulBot = { decide, respond, personality, setPersonality, PERSONALITIES, _mem: MEM };
G.CerulBot = CerulBot;
if (typeof module !== "undefined" && module.exports) module.exports = CerulBot;
})();
