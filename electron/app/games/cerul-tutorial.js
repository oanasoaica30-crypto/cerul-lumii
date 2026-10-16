/* Cerul Lumii — MECIUL DE ANTRENAMENT (tutorial complet, înainte de partida reală).
   Rulează 100% local, pe dispozitivul jucătorului: propria stare CerulLogic (newGame cu sămânță fixă), 1 bot local (CerulBot),
   ceas virtual accelerat care merge DOAR când scenariul permite. Se montează interfața REALĂ (CerulUI.mount) pe un ctx fals,
   iar deasupra stă antrenorul: avatar + balon + spot pe elementul exact; pașii avansează doar când jucătorul face acțiunea.
   NIMIC nu pleacă în rețea: singura legătură cu partida reală e callback-ul onStep/onExit (setup trimite acțiunea `tut`).
   API: window.CerulTutorial = { start(opts) -> api, active(), stop(), STEPS_N, steps() }
     opts: { profile:{name, co, av, color}, ctx (ctx-ul real, doar pentru sfx/fx), onStep(step, of), onExit(finished) } */
(function () {
"use strict";
const W = typeof window !== "undefined" ? window : null, D = typeof document !== "undefined" ? document : null;
if (!W || !D) return;
const ME = "p1", BOT = "p2", BOT_NAME = "Mara", BOT_CO = "Mara Air";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const thou = n => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function eur(n) { n = +n || 0; const a = Math.abs(n), s = n < 0 ? "−" : ""; if (a >= 1e6) return s + (Math.round(a / 1e5) / 10).toString().replace(".", ",") + " M €"; if (a >= 1e4) return s + Math.round(a / 1e3) + " k €"; return s + thou(a) + " €"; }
const reduced = () => { try { return W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const Lg = () => W.CerulLogic, Dt = () => W.CerulData, Ar = () => W.CerulArt;
const ACC = { hold: 0, run: 3, fast: 9, scene: 1.5 };
/* reluare după reîncărcarea paginii: lumea de antrenament se salvează LOCAL, per jucător (același id ca în core / ghid) */
const SAVE_V = 3;
function devId() {
  try {
    if (W.__SALON_ME) return String(W.__SALON_ME);
    const t = localStorage.getItem("salon-id") || "";
    if (localStorage.getItem("salon-test") === "1") { let tb = ""; try { tb = sessionStorage.getItem("salon-tab") || ""; } catch (e) { /* ignorat */ } return t + "-" + tb; }
    return t || "anon";
  } catch (e) { return "anon"; }
}
const saveKey = () => "cerul-tutsave:" + devId();
function loadSave(gk) {
  try { const o = JSON.parse(localStorage.getItem(saveKey()) || "null"); if (!o || o.v !== SAVE_V || !o.st || Date.now() - (+o.t || 0) > 12 * 3600e3) return null; if (gk != null && o.gk != null && String(o.gk) !== String(gk)) return null; return o; } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(saveKey()); } catch (e) { /* ignorat */ } }

/* ----------------------------------------------------------------- CSS */
function css() {
  if (D.getElementById("css-cerul-tut")) return;
  const s = D.createElement("style"); s.id = "css-cerul-tut";
  s.textContent = `
.ct-host{position:fixed;inset:0;z-index:58;background:#081628}
.ct-host .cl-root{position:absolute!important}
.ct-host .cl-endbar{display:none!important}
.ct-coach{position:fixed;inset:0;z-index:70;pointer-events:none;font:15px/1.45 var(--body,system-ui,sans-serif);color:#eef4ff}
.ct-hole{position:fixed;border-radius:12px;box-shadow:0 0 0 3px #ffd35c,0 0 0 9999px rgba(4,10,22,.42);transition:all .25s ease;display:none;pointer-events:none}
.ct-hole.on{display:block;animation:ctpulse 1.4s ease-in-out infinite}
@keyframes ctpulse{0%,100%{box-shadow:0 0 0 3px #ffd35c,0 0 0 9999px rgba(4,10,22,.42)}50%{box-shadow:0 0 0 6px #ffd35caa,0 0 0 9999px rgba(4,10,22,.42)}}
.ct-bub{position:fixed;pointer-events:auto;width:min(400px,calc(100vw - 20px));background:linear-gradient(180deg,#183559,#0f2440);border:2px solid #ffd35c;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.55);padding:12px 14px 12px}
.ct-bub.pop{animation:ctpop .28s ease-out}
@keyframes ctpop{from{transform:scale(.94);opacity:.4}to{transform:none;opacity:1}}
.ct-bub .ar{position:absolute;width:16px;height:16px;background:#183559;border-left:2px solid #ffd35c;border-top:2px solid #ffd35c;transform:rotate(45deg);display:none}
.ct-bub .hd{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.ct-bub .cs{flex:0 0 auto;width:46px;height:46px;border-radius:50%;overflow:hidden;background:#0b1a2e;display:grid;place-items:center;font-size:30px}
.ct-bub .cs svg{width:46px;height:46px}
.ct-bub small{display:block;color:#9fc0e8;font-size:12px;letter-spacing:.02em}
.ct-bub b.t{font-size:17px;color:#ffd35c}
.ct-bub p{margin:6px 0}
.ct-bub .do{margin:8px 0 2px;padding:7px 10px;border-radius:10px;background:rgba(255,211,92,.12);color:#ffe7a8;font-weight:600}
.ct-bub .wait{margin:8px 0 2px;padding:7px 10px;border-radius:10px;background:rgba(95,211,220,.12);color:#bdf1f5}
.ct-bub .bt{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;margin-top:10px}
.ct-bub button{font:600 14px var(--body,system-ui,sans-serif);border-radius:10px;border:1px solid #4d6f99;background:#1d3a60;color:#eef4ff;padding:8px 12px;cursor:pointer;min-height:38px}
.ct-bub button.pri{background:#ffd35c;border-color:#ffd35c;color:#1a1300}
.ct-bub button.lnk{background:none;border-color:transparent;color:#9fc0e8;text-decoration:underline;padding:8px 6px}
.ct-bub button:focus-visible{outline:3px solid #fff;outline-offset:2px}
.ct-bub .prog{flex:1 1 100%;height:6px;border-radius:4px;background:#0b1a2e;overflow:hidden}
.ct-bub .prog i{display:block;height:100%;background:linear-gradient(90deg,#5fd3dc,#ffd35c);border-radius:4px}
.ct-bub table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}
.ct-bub td{padding:2px 4px;border-bottom:1px solid #2a4a72}
.ct-bub td.n{text-align:right;white-space:nowrap}
.ct-bub .ok{color:#7be07b}.ct-bub .bad{color:#ff8a7a}
.ct-chip{position:fixed;left:50%;transform:translateX(-50%);top:6px;pointer-events:auto;background:rgba(15,36,64,.92);border:1px solid #ffd35c;color:#ffe7a8;border-radius:999px;padding:4px 6px 4px 12px;font:600 13px var(--body,system-ui,sans-serif);display:flex;gap:8px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.4);white-space:nowrap}
.ct-chip button{font:600 12px var(--body,system-ui,sans-serif);border-radius:999px;border:1px solid #ff9f8f;background:#4a1f26;color:#ffd9d2;padding:4px 10px;cursor:pointer}
.ct-conf{position:fixed;inset:0;display:grid;place-items:center;background:rgba(4,10,22,.6);pointer-events:auto;z-index:2}
.ct-conf>div{background:#132c4b;border:2px solid #ffd35c;border-radius:16px;padding:18px;max-width:min(420px,calc(100vw - 32px))}
.ct-conf h3{margin:0 0 8px;color:#ffd35c}
.ct-conf .bt{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
.ct-conf button{font:600 14px var(--body,system-ui,sans-serif);border-radius:10px;border:1px solid #4d6f99;background:#1d3a60;color:#eef4ff;padding:9px 14px;cursor:pointer}
.ct-conf button.pri{background:#ffd35c;color:#1a1300;border-color:#ffd35c}
@media (max-width:700px){.ct-bub{font-size:14px;padding:10px 12px}.ct-bub .cs{width:38px;height:38px}.ct-bub .cs svg{width:38px;height:38px}.ct-chip{top:auto;bottom:6px;font-size:12px}}
@media (prefers-reduced-motion:reduce){.ct-hole.on,.ct-bub.pop{animation:none}.ct-hole{transition:none}}`;
  D.head.appendChild(s);
}
function coachFace(size) {
  const A = Ar();
  if (A && typeof A.consultant === "function") { try { const r = A.consultant(size, "happy"); if (r) return r; } catch (e) { /* rezervă */ } }
  return "🧑‍✈️";
}

/* ----------------------------------------------------------------- lumea de antrenament */
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ptype = ty => { const L = Lg(); try { return (L.TYPES() || [])[ty] || {}; } catch (e) { return {}; } };
const typeOrder = () => { const L = Lg(), n = (L.TYPES() || []).length; const o = L.PLANE_ORDER || (W.CerulTune && W.CerulTune.planeOrder) || null; return Array.isArray(o) && o.length === n ? o : [...Array(n).keys()].sort((a, b) => (ptype(a).seats || 0) - (ptype(b).seats || 0)); };
const apN = id => { try { const a = Lg().airport(id); return (a && a.n) || id; } catch (e) { return id; } };
const dist = (a, b) => { try { return Lg().dist(a, b); } catch (e) { return 0; } };

/* ----------------------------------------------------------------- PAȘII */
/* E = motorul: {st, V, acts(name)->[acțiuni reușite în pas], U (starea UI), mk (memoria pasului), phone, landings, world helpers} */
const has = (E, n, f) => E.acts.some(a => a.a === n && (!f || f(a)));
const myPlanes = E => E.st.pl.filter(p => p.s === ME);
const STEPS = [
  { id: "intro", info: true, title: "Bun venit la antrenament!", tut: ["company"],
    text: E => `Acesta e un <b>meci de antrenament</b> doar pe dispozitivul tău: <b>${esc(E.st.c[ME].co)}</b> contra botului <b>${BOT_CO}</b>. Ceilalți jucători nu văd nimic din ce faci aici, iar tu nu-i vezi pe ei.<br>Ceasul stă pe loc cât îți explic și pornește doar când e nevoie. Sus ai compania ta, banii, valoarea și creditul.${E.starter.length ? `<br>🎁 Ai primit <b>gratis o rută de start</b> (${E.starter.map(r => Lg().ridEnds(r).map(apN).join(" – ")).join(", ")}) și un avion pe ea, ca să faci bani din prima. Tu strângi cărți pentru rutele următoare.` : ""}` },
  { id: "permits", title: "Permisele de rută", tut: ["sel:.cl-modal [data-okeep]:not([disabled])", "sel:.cl-modal [data-osel]", "sel:[data-offer]", "btn-draw", "permits"],
    text: E => E.st.c[ME].of ? "Un <b>permis</b> îți dă voie să construiești o rută între două orașe. Ți s-au oferit 3. Bifează una <b>scurtă</b> (cere mai puține cărți), apoi apasă <b>„Păstrează”</b>." : "Apasă <b>„＋ Trage permis”</b>.",
    done: E => has(E, "keepPermits"), bravo: "Ai primul permis. Fiecare permis cere câteva <b>cărți de resurse</b> (aprobare, infrastructură, echipaj, combustibil). Jokerul ține locul oricărei cărți. <br>⚠️ Cartea <b>„Combust.”</b> e doar o carte pentru permise — n-are legătură cu combustibilul avioanelor." },
  { id: "ghiseu", title: "Cărți la Ghișeu", text2: 1,
    tut: E => { const M = E.U.modal; if (!M || M.kind !== "ghiseu") return ["sel:.cl-pane [data-k=ghiseu]", "btn-ghiseu", "sel:.cl-root:not(.phone) [data-k=ghiseu]", "sel:.cl-cardsx [data-k=ghiseu]", "sel:[data-k=ghiseu]", "cards"]; const g = (M.data && M.data.give) || {}, n = Object.keys(g).reduce((a, k) => a + (+g[k] || 0), 0);
      return n < 5 ? [`sel:.cl-modal [data-give="${E.mk.giveK}"]`, "sel:.cl-modal .cl-mcard"] : !(M.data && M.data.get) ? [`sel:.cl-modal [data-get="${E.mk.getK}"]`, "sel:.cl-modal [data-get]"] : ["sel:.cl-modal [data-gok]:not([disabled])", "sel:.cl-modal .cl-mcard"]; },
    enter: E => E.prepGhiseu(),
    text: E => E.U.modal && E.U.modal.kind === "ghiseu" ? `Apasă de 5 ori pe <b>${esc((E.mk.extraN || "").replace(/^5 × /, ""))}</b> (cărțile pe care le dai), apoi alege <b>${esc(E.mk.missN || "")}</b> și apasă <b>„Schimbă 5 → 1”</b>. Sau <b>„💶 Cumpără o carte”</b> — dar aceea e la întâmplare.` : `Permisului <b>${esc(E.mk.pn || "")}</b> îi lipsește o carte de <b>${esc(E.mk.missN || "?")}</b>. Deschide <b>🃏 Ghișeu</b>: acolo dai <b>5 cărți</b> pe <b>una la alegere</b> (ai ${esc(E.mk.extraN || "")} în plus) sau cumperi o carte cu bani.`,
    done: E => (has(E, "ghiseu") || has(E, "buyCard")) && E.permitOk(), wait: E => (has(E, "ghiseu") || has(E, "buyCard")) && !E.permitOk() ? "Tot lipsește o carte — mai schimbă sau mai cumpără una." : "",
    bravo: "Ai toate cărțile. Ghișeul te salvează când îți lipsește o singură carte." },
  { id: "build", title: "Construiește ruta", tut: ["btn-build", "permits"],
    text: E => E.phone ? "Deschide <b>🃏 Cărți</b> de jos și apasă <b>„→ Construiește”</b> la permis. Plătești cărțile și sloturile de aeroport." : "Apasă <b>„→ Construiește”</b> la permis. Plătești cărțile și un slot în fiecare aeroport.",
    done: E => has(E, "build"), bravo: "Prima ta rută e gata! Primul care deschide o rută e „pionier” și primește stele de reputație." },
  { id: "airport", title: "Panoul aeroportului", tut: E => E.U.popKind === "ap" ? ["sel:.cl-pop.ap", "map"] : [`ap:${E.st.c[ME].base}`, "map"],
    text: E => `Fiecare rută îți ocupă un <b>slot</b> în ambele aeroporturi, iar sloturile sunt limitate: ${E.slotTxt()}. Cine ia primul slotul, îl are. <b>Click pe baza ta, ${esc(apN(E.st.c[ME].base))}</b> (cercul evidențiat pe hartă) ca să deschizi panoul aeroportului.`,
    done: E => E.U.popKind === "ap",
    bravo: E => `Panoul aeroportului arată: <b>starea</b> (prea multe avioane / echilibrat / avioane libere), <b>o sugestie cu cifre</b> (de ex. „+1 avion pe X–Y ≈ +40.000 €/zi”), avioanele tale la sol, pasagerii care așteaptă și rutele posibile de aici. Jos, la <b>„Sloturi, porți, hub, terminal”</b>: ${E.gateTxt()} Un <b>hub</b> nu e hangar — e un centru de tranzit (taxe −50%, pasageri de legătură, +1 slot).` },
  { id: "sizes", title: "Ce avion se potrivește?", tut: ["tab-shop"],
    text: E => E.sizesHTML() + E.rangeTxt() + "Deschide fila <b>🛒 Avioane</b> ca să le vezi în magazin.",
    done: E => E.U.tab === "shop" || E.U.ptab === "shop", bravo: "Regula de aur: <b>avion mic pe rută scurtă și subțire</b>, avion mare doar unde sunt mulți pasageri. Un avion pe jumătate gol pierde bani." },
  { id: "buy", title: "Cumpără avionul potrivit", tut: E => [`sel:[data-buy="${E.fitTy()}"]:not([disabled])`, "shop-new", "tab-shop"],
    text: E => `<b>Cumpără</b> = plătești tot acum, avionul e al tău și intră în valoarea companiei. Pentru ruta ta cel mai mic avion care ajunge e <b>${esc(ptype(E.fitTy()).n || "")}</b> — cumpără-l (butonul evidențiat).`,
    done: E => has(E, "buyPlane", a => !a.lease), bravo: "Avion nou în flotă! Mai ai și Turbo 72-ul gratuit de la început." },
  { id: "lease", title: "Leasing", tut: E => E.mk.leased ? ["sel:[data-mconfirm]", "sel:[data-buyout]:not([disabled])", `sel:[data-pmenu="${(E.leasedPlane() || {}).id}"]`, "tab-fleet"] : [`sel:[data-lease="${E.fitTy()}"]:not([disabled])`, "sel:[data-lease]:not([disabled])", "tab-shop"],
    text: E => E.mk.leased ? (E.leaseInfo() ? `Avionul din leasing <b>${esc(E.leaseInfo())}</b>. Nu vrei să aștepți? Îl poți <b>răscumpăra</b> oricând: în <b>✈️ Flotă</b>, la el, deschide meniul <b>„⋯”</b> și apasă <b>„🔑 Răscumpără”</b>.` : "Avionul din leasing e în flotă: plătești doar chiria zilnică. Îl poți returna din meniul „⋯” al avionului.")
      : `<b>Leasing</b> = 0 € acum, plătești o chirie pe zi. Bun când n-ai bani mulți. ${E.rampTxt()} Ia un avion în leasing (butonul evidențiat).`,
    done: E => { if (has(E, "buyPlane", a => !!a.lease) || has(E, "lease")) E.mk.leased = 1; if (E.mk.leased && E.mk.cb == null) E.mk.cb = E.canBuyout(); return E.mk.leased && (!E.mk.cb || has(E, "buyout")); },
    bravo: E => (has(E, "buyout") ? "Ai răscumpărat avionul: acum e al tău și contează la valoarea companiei." : "Ai un avion în leasing. Chiria se plătește seara, la decontare.") + ` Chiar dacă nu-l răscumperi, un avion din leasing devine <b>automat al tău</b> când chiria plătită ajunge la ~${E.ownPct()}% din prețul lui nou. Un avion în leasing nu adaugă nimic la valoarea companiei până nu e al tău.` },
  { id: "assign", title: "Pune avionul pe rută", tut: ["sel:.cl-modal [data-massign]:not([disabled])", "sel:.cl-modal [data-msel]:not([disabled])", "assign", "tab-fleet"],
    text: E => E.U.modal && /assign|putplane/.test(E.U.modal.kind || "") ? "Alege ruta (vezi estimarea de profit pe zi), apoi apasă <b>„Atribuie”</b>. Lista arată doar avioanele <b>libere</b>." : "În <b>✈️ Flotă</b>, la un avion liber, apasă <b>„Atribuie rută”</b>.",
    done: E => has(E, "assign"), bravo: "Avionul face acum naveta pe ruta ta. Pasagerii se adună la poartă." },
  { id: "price", title: "Prețul biletului", tut: ["price-presets", "route-popup", "sel:.cl-rt[data-route]", "tab-routes"],
    text: E => E.U.popKind === "route" ? `Sus vezi <b>„Ruta asta: ±X €/zi (net)”</b> — profitul pe zi după toate costurile. <b>Ieftin</b> (×${E.pm("cheapMult", 0.75)}) = avion plin, bani puțini pe bilet. <b>Premium</b> (×${E.pm("premiumMult", 1.4)}) = mai puțini pasageri, mai mult pe bilet. Peste Premium cererea se prăbușește (oamenii aleg trenul). <b>Recomandat</b> e prețul care îți umple avioanele. Alege unul.` : "Deschide ruta (fila <b>🛣️ Rute</b> sau click pe ea pe hartă) și alege un preț.",
    done: E => has(E, "price"), bravo: "Prețul contează: dacă adversarul e mai ieftin pe aceeași rută, îți fură pasagerii. Pe piețele bogate (Europa de Vest, America de Nord) și pe rutele intercontinentale biletele sunt mai scumpe." },
  { id: "undo", title: "↩ Anulează", tut: E => E.undoInfo() ? ["sel:[data-tkey=undo] .tb button", "sel:[data-tkey=undo]"] : E.U.popKind === "route" ? ["price-presets", "route-popup"] : ["sel:.cl-rt[data-route]", "tab-routes"],
    text: E => E.undoInfo() ? "Acum apasă <b>„↩ Anulează”</b> în mesajul din colț: prețul revine exact cum era." : `Te-ai răzgândit? Cumpărarea unui avion, leasingul, mutarea pe rută, prețul, slotul sau construcția se pot <b>anula în ${E.undoSec()} secunde</b>. Încearcă: pune alt preț pe rută (de ex. <b>Premium</b>)…`,
    done: E => has(E, "undo"),
    bravo: "Anulat! Anularea nu mai merge după ce avionul a decolat, după o altă acțiune a ta sau dacă un rival a atins aceeași rută." },
  { id: "depart", title: "Decolează!", tut: ["btn-depart", "plane", "tab-fleet"],
    clock: E => E.boarded() ? "hold" : "run",
    text: E => E.boarded() ? "Avionul are pasageri la poartă. Apasă <b>„🛫 Decolează”</b>. Cu cât aștepți, cu atât se umple mai bine — dar nu la nesfârșit." : "",
    wait: E => E.boarded() ? "" : "Ceasul merge repede: avionul ajunge la poartă și se îmbarcă pasagerii…",
    done: E => has(E, "depart"), bravo: "Decolare! Banii pe bilete îi primești la aterizare." },
  { id: "pilot", title: "Pilot automat",
    tut: E => { const M = E.U.modal; if (!M || M.kind !== "pilotmin") return ["pilot", "plane", "tab-fleet"]; E.pminWatch(M);
      return (E.mk.red && E.mk.green) || M.data.be == null ? ["sel:.cl-modal [data-pminok]:not([disabled])"] : ["sel:.cl-modal [data-pmin]"]; },
    text: E => { const M = E.U.modal; if (!M || M.kind !== "pilotmin") return "Nu vrei să apeși mereu „Decolează”? Angajează un <b>👨‍✈️ pilot</b> (costă puțin pe zi): decolează singur. Apasă butonul de pilot la un avion de pe rută.";
      const be = M.data.be; if (be == null) return "Alege de la câți pasageri pleacă pilotul, apoi apasă <b>„Angajează”</b>.";
      return !E.mk.red ? `Linia roșie e <b>pragul de profit</b>: ${be} pasageri. Trage cursorul <b>sub</b> ea și uită-te la „un zbor”: devine <b>roșu</b> (pierdere).`
        : !E.mk.green ? "Vezi? Sub prag, fiecare zbor pierde bani. Acum trage cursorul <b>peste</b> linia roșie: profitul devine <b>verde</b>."
        : "Perfect. Pilotul pleacă de la minimul ales, dar mai așteaptă puțin dacă vin repede alți pasageri. Apasă <b>„Angajează · min N”</b>."; },
    done: E => has(E, "pilot", a => a.on !== false) && (E.mk.red && E.mk.green || !E.U.modal || E.U.modal.kind !== "pilotmin"),
    bravo: "Pilotul zboară singur, de la minimul tău de pasageri. Îl schimbi oricând din meniul „⋯” al avionului.<br>Dacă pui <b>mai multe avioane cu pilot pe aceeași rută</b>, ele stau <b>la rând</b>: cel de la poartă ia pasagerii și pleacă la minimul lui, apoi se îmbarcă următorul. Ruta îți arată de câte avioane e nevoie, de ex. „3 avioane · ideal 2”." },
  { id: "land", title: "Primul zbor și profitul", tut: ["cash"], clock: () => "fast",
    text: "Urmărește <b>banii</b> aici sus: la fiecare aterizare încasezi biletele, minus combustibil, echipaj și taxe de aeroport.",
    wait: E => E.landings > E.mk.l0 ? "" : "Avionul e în drum… (ceasul merge repede)",
    enter: E => { E.mk.l0 = E.landings; },
    done: E => E.landings > E.mk.l0,
    bravo: E => E.fuelLine() + (E.lastLand != null && E.lastLand < 0 ? `Primul zbor a aterizat pe pierdere (${eur(E.lastLand)}). Încearcă alt preț, așteaptă să se umple avionul sau folosește un avion mai potrivit.`
      : E.lastLand != null && E.lastLand < 15000 ? `Primul zbor a aterizat: profit <b>${eur(E.lastLand)}</b> — mic, pentru că avionul a plecat destul de gol. Cu pilotul pornit, pleacă abia când e mai plin.`
      : `Primul zbor a aterizat${E.lastLand ? ` cu un profit de <b>${eur(E.lastLand)}</b>` : ""}! Asta e rețeta: rute, avioane potrivite, pasageri.`) + "<br>Atenție: <b>profitul zborurilor</b> nu e tot. Seara se scad și costurile fixe (întreținere, leasing, piloți, sediu). Cifra care contează e <b>„€/zi (net)”</b>." },
  { id: "planecard", title: "Cardul avionului", tut: E => E.U.popKind === "plane" ? ["sel:.cl-pop", "map"] : [E.flyPid() != null ? `pl:${E.flyPid()}` : "", "sel:[data-appl]", "map"].filter(Boolean),
    clock: E => E.flyPid() != null ? "hold" : "run",
    text: E => E.flyPid() != null ? "Am oprit ceasul. <b>Click pe avionul tău</b> evidențiat pe hartă (avioanele de la sol nu se desenează — vezi doar un „✈ N” lângă aeroport)." : "",
    wait: E => E.flyPid() != null ? "" : "Aștept să decoleze un avion…",
    done: E => E.U.popKind === "plane",
    bravo: "Cardul avionului: <b>profitul pe acest zbor</b>, pasagerii la bord, de unde → unde, ora sosirii și profitul pe zi. De aici: <b>Prelungește escala</b>, <b>Schimbă ruta</b> sau <b>minimul pilotului</b>. Mouse-ul peste un avion arată „tip · nume · pasageri”." },
  { id: "fleet", title: "Flota: filtre și acțiuni în bloc", tut: ["sel:.cl-modal [data-bminok]:not([disabled])", "sel:[data-bulk=pilotOn]:not([disabled])", "sel:[data-bulk=pmin]:not([disabled])", "sel:[data-fall]", "tab-fleet"],
    text: E => E.U.tab === "fleet" || E.U.ptab === "fleet" ? "Sus ai <b>filtre</b>: pe minus · fără rută · sub prag · în leasing · în zbor · la sol. Bifezi avioanele (sau <b>„Selectează toate”</b>) și dai o comandă tuturor deodată: pilot, minim, mutare pe rută, preț. Încearcă: selectează toate, apoi <b>„👨‍✈️ Pilot pornit”</b>." : "Deschide fila <b>✈️ Flotă</b>.",
    done: E => has(E, "bulk") || E.acts.filter(a => a.a === "pilot" || a.a === "pilotMin").length >= 2,
    bravo: "Cu un singur clic ai dat comanda la toată flota. Cu 20 de avioane, filtrul „pe minus” îți arată imediat ce trebuie reparat." },
  { id: "rival", title: "Concurența și războiul prețurilor",
    tut: E => E.U.popKind === "route" ? ["price-presets", "route-popup"] : [`sel:.cl-rt[data-route="${E.mk.rid}"]`, "sel:.cl-rt[data-route]", "tab-routes"],
    enter: E => E.prepRival(),
    text: E => E.mk.rid ? `<b>Mara</b> a intrat pe ruta ta <b>${esc(E.mk.rn)}</b> cu un preț mai mic! Pasagerii se împart după <b>preț</b>, <b>stele</b> și <b>câte avioane</b> are fiecare pe rută. Cota ta a scăzut la <b>${E.share()}%</b> (ai primit și un mesaj „rival pe ruta ta” cu butoane rapide [Schimbă prețul] [+1 avion]). Deschide ruta și răspunde cu un preț (Ieftin = îi iei pasagerii, dar câștigi mai puțin pe bilet).` : "Când un rival intră pe ruta ta, pasagerii se împart după preț, stele și numărul de avioane.",
    done: E => !E.mk.rid || has(E, "price"), bravo: E => `Acum ai <b>${E.share()}%</b> din pasageri. Un război al prețurilor îi costă pe amândoi: uneori e mai bine să mergi pe altă rută.` },
  { id: "chain", title: "Rută cu escală", tut: E => E.U.modal && E.U.modal.data && E.U.modal.data.via != null ? ["sel:.cl-modal [data-massign]:not([disabled])", "sel:.cl-modal [data-passign]:not([disabled])"] : [...(E.mk.good ? [`sel:.cl-modal [data-via="${E.mk.good.via}"]:not([disabled])`, `sel:.cl-modal [data-mchain="${E.mk.good.via}"]:not([disabled])`] : []), "sel:.cl-modal [data-massign]:not([disabled])", ...(E.mk.pid != null ? [`sel:[data-assign="${E.mk.pid}"]`] : []), "assign", "tab-fleet"],
    enter: E => E.prepChain(),
    text: E => E.chainHTML(),
    done: E => { const ok = has(E, "assign", a => a.via != null); if (ok && !E.mk.badSet) { E.mk.badSet = 1; E.placeBad(); } return ok; },
    wait: E => E.mk.noChain ? "Nu am găsit o escală potrivită în zona ta — treci mai departe." : "",
    bravo: E => { const a = E.acts.filter(x => x.a === "assign" && x.via != null).pop(), good = a && E.mk.good && [String(a.rid), String(a.via)].indexOf(String(E.mk.good.via)) >= 0; return good ? "Ai ales escala bună: drumul e aproape drept, deci apar pasageri noi „prin” orașul din mijloc." : "Ai ales escala cu ocol mare: pasagerii nu vor să facă un drum atât de lung, așa că avionul zboară mai gol. Poți reatribui oricând."; } },
  { id: "expand", info: true, title: "Ținta: piețe mai bogate", tut: ["map"],
    text: E => `Ai pornit${E.st.c[ME].base ? " din <b>" + esc(apN(E.st.c[ME].base)) + "</b>" : ""}, pe o piață mai ieftină. Biletele valorează mai mult în piețele bogate (<b>America de Nord</b>, <b>Europa de Vest</b>) și pe rutele <b>intercontinentale</b>. Strategia: faci bani aproape de casă, apoi te extinzi spre piețele bogate, cu avioane cu rază mare.` },
  { id: "bank", title: "Banca", tut: ["sel:.cs-root [data-act=take]:not([disabled])", "sel:.cl-modal [data-bok]", "sel:.cl-pane [data-k=bank]", "btn-bank"],
    text: E => `<b>🏦 Bancă</b>: iei credit când ai nevoie de bani pentru avioane sau rute. Limita: ${Math.round(E.tn(["bank", "limitFrac"], 0.4) * 100)}% din valoarea companiei (după scorul de credit). Termene: <b>${(E.tn(["bank", "terms"], [10, 20, 30, 60]) || []).join(" / ")} zile</b> — la 60 de zile rata pe zi e mică, dar dobânda totală e mare. Rata se plătește în fiecare seară; rambursarea mai devreme e gratuită. Ia acum un credit.`,
    done: E => has(E, "bank"), bravo: "Ai bani în plus. Atenție: creditul scade din valoarea finală până îl rambursezi." },
  { id: "nego", title: "Negocierea",
    tut: E => { const ng = E.st.ng; if (E.st.phase !== "nego" || !ng) return ["sel:.cs-root [data-act=go]:not([disabled])", "sel:.cl-pane [data-k=nego]", "btn-nego", "sel:[role=menu] [data-k=nego]", "sel:[data-k=nego]", "sel:[data-k=menu]"];
      if (ng.res || (ng.last && ng.last.by === BOT)) return ["sel:.cs-root [data-act=close]"];
      return ["sel:.cs-root [data-ok]", "sel:.cs-root [data-act=send]:not([disabled])", "sel:.cs-root [data-add=m]"]; },
    clock: E => E.st.phase === "nego" ? "scene" : "hold",
    text: E => E.st.phase === "nego" ? (E.st.ng && (E.st.ng.res || (E.st.ng.last && E.st.ng.last.by === BOT)) ? `Mara ți-a răspuns${E.st.ng.res === "acc" || (E.st.ng.last && E.st.ng.last.k === "acc") ? " — a <b>acceptat</b>! Schimbul s-a făcut pe loc" : ""}. Apasă <b>„🚪 Pleacă”</b> ca să închizi biroul.` : "Ești în birou cu <b>Mara</b>. Jos pui pe masă ce dai sau ce ceri: bani, cărți, permise, rute, sloturi, avioane, un pact sau un împrumut. Pune de exemplu <b>💶 Bani</b>, apoi <b>„📨 Trimite oferta”</b> — botul îți răspunde.") : E.mk.opened ? "" : "Apasă <b>🤝 Negociază</b>, alege-o pe <b>Mara</b> și cheam-o la birou. Cât negociați, timpul jocului e oprit pentru toți.",
    wait: E => E.mk.opened && E.st.phase !== "nego" ? "" : "",
    done: E => { if (has(E, "negoOpen")) E.mk.opened = 1; return E.mk.opened && E.st.phase === "play"; },
    bravo: "Negocierea s-a încheiat. Cu oamenii reali poți face schimburi, pacte de neagresiune și <b>împrumuturi între jucători</b> — când alegi suma vezi un indiciu de <b>risc mic / mediu / mare</b> (datoriile celui care împrumută față de valoarea lui). La 3–4 jucători poți <b>invita un al treilea</b> la masă din birou; ceilalți devin <b>spectatori</b>: văd biroul, dar nu pot pune nimic pe masă. Timpul stă pe loc pentru toți cât durează negocierea." },
  { id: "invest", title: "Hub, terminal și investiții", tut: ["sel:.cl-pane [data-hub]:not([disabled])", "sel:.cl-pane [data-inv]:not([disabled])", "sel:.cl-root.phone [data-mtab=invest]:not(.on)", "sel:.cl-root.phone [data-tut=tab-reports]", "tab-invest", "sel:[data-mtab=invest]:not(.on)"],
    text: "<b>🏗️ Investiții</b>: baza extinsă (mai multe sloturi și pasageri), <b>terminal propriu</b> pe un aeroport mare, <b>flotă eco</b> (combustibil mai ieftin pentru un tip de avion), centru de mentenanță. Un <b>hub</b> înseamnă taxe de aterizare −50% acolo, mai mulți pasageri în tranzit și un slot în plus. Deschide fila <b>🏗️</b> și cumpără, de exemplu, un <b>hub</b> la baza ta.",
    enter: E => { const c = E.st.c[ME]; if (c.cash < 9e6) c.cash = 9e6; },
    done: E => has(E, "invest") || has(E, "hub"), bravo: "Investițiile cresc profitul și contează la valoarea finală." },
  { id: "draft", title: "Seara: draftul de cărți", tut: ["sel:.cs-dc.can", "clock"],
    clock: E => E.st.phase === "play" ? "fast" : null,
    text: E => E.st.phase === "draft" ? (E.myTurn() ? "E rândul tău! <b>Alege o carte</b> de pe masă (cu fața în jos)." : "Alege botul… vine imediat rândul tău.") : "Când se umple inelul ceasului, ziua se termină. Urmează <b>draftul</b>: pe rând, fiecare alege cărți. Cel mai mic ca valoare alege primul.",
    wait: E => E.st.phase === "play" ? "Ziua trece repede…" : "",
    done: E => E.st.phase === "play" && E.st.day > 1, bravo: "Ai luat cărți pentru permisele următoare. Ordinea la draft: cine valorează mai puțin alege primul." },
  { id: "settle", info: true, clickAdvance: true, title: "Decontarea, raportul și ziarul", tut: ["sel:.cl-rep", "tab-reports", "cash"],
    clock: E => E.st.phase === "play" ? "hold" : "scene",
    text: E => "La finalul zilei se face <b>decontarea</b>: încasări minus costuri fixe, rate la bancă, leasing, piloți. Dimineața primești <b>raportul zilei</b> (cea mai bună și cea mai proastă rută, cât ai crescut, locul în clasament) și <b>Gazeta Cerului</b>, cu un titlu amuzant din ce s-a întâmplat ieri. Fila <b>📊 Rapoarte</b> îți arată profitul pe zile și pe rute." + E.taxTxt() + E.chainResult() },
  { id: "event", title: "Evenimente", tut: E => E.U.modal && E.U.modal.kind === "ev" ? ["sel:.cl-modal"] : ["sel:.cl-ev[data-evi]", "map"],
    enter: E => E.fireEvent(),
    text: E => `Din când în când apare un <b>eveniment</b>: sezon de vacanțe, grevă, furtună, preț la combustibil — mai ales în regiunile unde zboară jucătorii. ${E.mk.ev ? `Acum: <b>${esc(E.mk.ev)}</b>. ` : ""}Banda de pe hartă îți arată ce e activ. <b>Apasă pe eveniment</b> ca să vezi ce face și „Ce poți face”.`,
    done: E => !!(E.U.modal && E.U.modal.kind === "ev"),
    bravo: "Cardul evenimentului îți spune cât durează, pe cine atinge și <b>ce poți face</b>. Cartea specială <b>Asigurare</b> te apără de un eveniment rău. Câte evenimente apar se votează la început (puține / normale / multe)." },
  { id: "freeze", title: "❄️ Îngheață timpul", tut: ["sel:.cl-modal [data-tok]:not([disabled])", "sel:.cl-modal [data-tsel]:not(.on)", "sel:[data-play]:not([disabled])", "specials"],
    enter: E => E.prepFreeze(),
    text: "Ai primit o <b>carte specială</b>. <b>❄️ Îngheață timpul</b> oprește compania unui adversar câteva zeci de secunde: avioanele lui nu decolează. Folosește-o pe Mara.",
    done: E => has(E, "play", a => E.spec(a.card) === "frz"), bravo: "Mara e înghețată! Cărțile speciale se iau la draft: zbor rapid, reclamă, spion, slot, avion cadou…" },
  { id: "breaker", title: "🔥 Spărgătorul de gheață", tut: ["sel:[data-use='1']:not([disabled])", "specials"],
    enter: E => E.prepBreaker(),
    text: "Acum <b>Mara te-a înghețat</b> pe tine! Dar ai un <b>🔥 Spărgător de gheață</b>: ai câteva secunde să-l folosești și scapi imediat. Apasă-l.",
    done: E => has(E, "breaker") || !E.st.c[ME].fz, bravo: "Te-ai dezghețat! Spărgătorul se folosește doar când cineva te îngheață." },
  { id: "pause", title: "Pauza", tut: ["sel:.cl-pz [data-k=pause]", "sel:[role=menu] [data-k=pause]", "sel:[data-k=menu]"],
    text: E => E.mk.on ? "Jocul e pe pauză pentru toți: poți doar să te uiți (și să negociezi). Apasă <b>„▶️ Continuă”</b>." : "Ai nevoie de o pauză? Din meniul <b>⋯</b> alegi <b>„⏸ Pauză pentru toți”</b>. Încearcă.",
    done: E => { if (has(E, "pause", a => a.on)) E.mk.on = 1; return E.mk.on && has(E, "pause", a => !a.on); }, bravo: "Pauza oprește ceasul pentru toată lumea — folosește-o cu grijă, ceilalți așteaptă." },
  { id: "social", title: "Reacții, setări, scurtături", tut: ["sel:[data-ua=rxsend]:not([disabled])", "sel:[data-ua=rx]", "sel:[role=menu] [data-ua=rx]", "sel:[data-k=menu]"],
    text: E => `Butonul <b>😀</b> trimite o <b>reacție</b> pe care o văd toți, ca un balon lângă numele tău. Lângă el, <b>⚙ Setări</b>: volum muzică / efecte / anunțuri, grafică, text mai mare (se păstrează pe dispozitivul tău).${E.phone ? "" : " Pe PC ai și <b>scurtături</b>: Spațiu = pauză, F flotă, R rute, B bancă, G ghid, Esc închide, ? = lista."} Trimite acum o reacție.`,
    done: E => has(E, "react"), bravo: "Mara ți-a văzut reacția 🙂 Mesajele mici din colț (aterizare pe pierdere, rival pe rută, bani pe minus, „↩ Anulează”) dispar singure; dă click pe ele pentru detalii." },
  { id: "bankrupt", info: true, title: "Falimentul", tut: ["cash", "debt"],
    text: E => `Dacă banii ajung <b>pe minus</b>, ai ${E.tn(["bankrupt", "graceDays"], 5)} zile să revii (credit, vânzare de avioane). Dacă nu reușești — sau datoria trece mult de limita băncii — compania dă <b>faliment</b> și iese din joc. Ultima companie rămasă câștigă pe loc.<br>La faliment se plătesc <b>întâi jucătorii</b> care i-au împrumutat bani, apoi banca. La evaluarea finală se scad <b>întâi datoriile la bancă</b>, apoi <b>împrumuturile luate de la alți jucători</b>.` },
  { id: "final", title: "Valoarea finală", tut: ["value"], clock: E => E.st.phase === "end" ? "hold" : "fast",
    text: E => E.st.phase === "end" ? "" : "La final câștigă <b>cea mai mare valoare</b>: bani + avioane + rute + sloturi + huburi + investiții (își pierd din valoare în timp) + cărți rămase + acțiuni − datorii. <b>Valoarea de sus e exact cea finală</b> — o vezi live toată partida. Hai să terminăm minimeciul!",
    wait: E => E.st.phase === "end" ? "" : "Derulăm repede până la final…",
    done: E => E.st.phase === "end", bravo: E => E.podiumHTML() },
];

const CHAPTERS = [["Începutul", ["intro", "permits", "ghiseu", "build", "airport"]], ["Avioanele", ["sizes", "buy", "lease", "assign", "price", "undo", "depart", "pilot", "land", "planecard", "fleet"]],
  ["Rute și rivali", ["rival", "chain", "expand"]], ["Banii", ["bank", "nego", "invest"]], ["Seara", ["draft", "settle"]], ["Neprevăzutul", ["event", "freeze", "breaker", "pause", "social"]], ["Finalul", ["bankrupt", "final"]]];
const chapterOf = id => { const i = CHAPTERS.findIndex(c => c[1].indexOf(id) >= 0); return i < 0 ? null : { i: i + 1, n: CHAPTERS.length, name: CHAPTERS[i][0] }; };
/* ----------------------------------------------------------------- motorul */
let cur = null;
function start(opts) {
  opts = opts || {};
  const L = Lg(); if (!L || !W.CerulUI) return null;
  if (cur) cur.stop(false, true);
  css();
  const prof = opts.profile || {};
  const realCtx = opts.ctx || {};
  let vt = Date.now(), lastReal = Date.now();
  const seed = 20261016;
  const R0 = mulberry(seed);
  const myName = String(prof.name || "Pilot").slice(0, 16), myCo = String(prof.co || myName + " Air").slice(0, 22);
  const seats = [{ seat: ME, name: myName, g: prof.g || null }, { seat: BOT, name: BOT_NAME, bot: true, g: "f" }];
  let st = L.newGame(R0, vt, seats, { dur: 60, day: 1, speed: 1 });
  st.sp = 1; // viteza de test a partidei reale nu se aplică antrenamentului
  const myCol = clamp(prof.color | 0, 0, 5), myAv = clamp(prof.av | 0, 0, 9);
  const b = st.c[BOT]; b.name = BOT_NAME; b.co = BOT_CO; if (b.col === myCol) b.col = (myCol + 2) % 6; if (b.av === myAv) b.av = myAv >= 5 ? 6 + (myAv % 4 === 0 ? 1 : 0) : 7;
  L.apply(st, ME, { a: "prof", av: myAv, name: myName, co: myCo, color: myCol }, vt);
  st.c[ME].ready = 1;
  try { L._internal.startGame(st, vt, L.rngFrom(st)); } catch (e) { console.warn("[tutorial] startGame", e); return null; }
  st.maxDay = 2;
  const gk = realCtx.state && realCtx.state.seed != null ? realCtx.state.seed : null;
  const sv = opts.fresh ? null : loadSave(gk);
  if (sv) { st = sv.st; vt = +sv.vt || vt; }
  const rng = () => L.rngFrom(st);

  /* --- ctx fals + ajutoare: totul local --- */
  const timers = new Set(), ivs = new Set(), offs = [];
  let host = null, coach = null, ui = null, alive = true;
  const part = { q: [], n: sv ? (+sv.pn || 0) : 0 };
  const fake = {
    me: ME, get state() { return st; }, players: [ME, BOT], names: { [ME]: myName, [BOT]: BOT_NAME },
    nameOf: s => s === ME ? myName : BOT_NAME, seatInfo: s => ({ name: s === ME ? myName : BOT_NAME, bot: s === BOT }),
    ended: false, isBot: false, sfx: realCtx.sfx, fx: realCtx.fx, toast: () => {}, status() {}, commit() {}, setPart() {}, restart() {},
    timeout: (f, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) f(); }, ms); timers.add(id); return id; },
    interval: (f, ms) => { const id = setInterval(() => { if (alive) f(); }, ms); ivs.add(id); return id; },
    on: (t, ty, f, o) => { t.addEventListener(ty, f, o); offs.push(() => t.removeEventListener(ty, f, o)); },
  };
  const helpers = {
    get Logic() { return W.CerulLogic; }, get Data() { return W.CerulData; }, get Tune() { return W.CerulTune; }, get Bot() { return W.CerulBot; },
    get Art() { return W.CerulArt; }, get Map() { return W.CerulMap; }, get Scenes() { return W.CerulScenes; }, get Guide() { return W.CerulGuide; }, get UI() { return W.CerulUI; },
    send: a => send(a), now: () => vt, pending: () => [], acked: () => true, lastErr: () => (st.err && st.err[ME]) || null,
    me: ME, isHost: () => true, speed: 1, auto: true, practice: true, ctx: () => fake,
    leave: () => askExit(), restart: () => askExit(), resetTable: () => askExit(), onTutorial: () => {},
  };

  /* --- acțiuni: coada mea locală, aplicată imediat de CerulLogic.step --- */
  const E = { st, V: null, acts: [], U: {}, mk: {}, phone: false, landings: 0, lastLand: null };
  function send(a) {
    if (!alive || !a || typeof a !== "object") return 0;
    let x = a; if (x.a == null && x.t != null) { x = Object.assign({}, x, { a: x.t }); delete x.t; }
    const n = ++part.n; part.q.push({ n, a: JSON.parse(JSON.stringify(x)) }); while (part.q.length > 20) part.q.shift();
    pump(true);
    const er = st.err && st.err[ME];
    const ok = !(er && er.n === n);
    if (ok) { E.acts.push(x); if (stepIdx >= 0) setTimeout(() => evalStep(), 30); }
    return n;
  }
  function botFn(s0, seat, now, R) {
    const B = W.CerulBot; if (!B || !B.decide) return [];
    let r = []; try { r = B.decide(s0, seat, now, R) || []; } catch (e) { r = []; }
    // în antrenament botul nu deschide negocieri, nu îngheață și nu cumpără acțiuni pe cont propriu (scenariul controlează)
    return (Array.isArray(r) ? r : [r]).filter(a => a && !/^(negoOpen|nego_open|shares|pause|resign)$/.test(a.a || a.t || "") && !((a.a || a.t) === "play" && /frz|freeze|ingh/i.test(String(a.card))));
  }
  let lastRender = 0, botOn = false, dirty = false;
  function pump(force) {
    const prev = st;
    let ns = null;
    try { ns = L.step(st, { [ME]: part }, vt, undefined, botOn || st.phase === "draft" || st.phase === "nego" ? botFn : null, "local"); } catch (e) { console.warn("[tutorial] step", e); }
    if (ns) { trackLandings(prev, ns); st = ns; E.st = st; }
    if (ns) dirty = true;
    if (ui && (force || (dirty && Date.now() - lastRender > 220))) { lastRender = Date.now(); dirty = false; try { ui.render(fake); } catch (e) { console.warn("[tutorial] render", e); } }
  }
  function trackLandings(a, b2) {
    const pa = {}; a.pl.forEach(p => { if (p.s === ME) pa[p.id] = p; });
    b2.pl.forEach(p => { const o = pa[p.id]; if (o && o.m === 2 && p.m !== 2 && p.rid) { E.landings++; E.lastLandP = { ty: p.ty, a: o.fr || o.ap, b: p.ap }; try { const ra = a.c[ME].r[p.rid] || o.rid && a.c[ME].r[o.rid], rb = b2.c[ME].r[p.rid] || b2.c[ME].r[o.rid]; const d = rb && ra ? rb.pr - ra.pr : null; if (d != null) E.lastLand = Math.round(d); } catch (e) { /* ignorat */ } } });
  }

  /* --- montarea interfeței reale --- */
  host = D.createElement("div"); host.className = "ct-host"; host.setAttribute("aria-label", "Meci de antrenament");
  D.body.appendChild(host);
  W.__CERUL_PRACTICE = true;
  // harta antrenamentului: păstrez api-ul ca să pot arăta pe hartă un aeroport / un avion în zbor (spot „virtual”)
  let mapApi = null, mapEl = null; const MM = W.CerulMap, mapCreate0 = MM && MM.create;
  if (mapCreate0) MM.create = function (el) { const a = mapCreate0.apply(this, arguments); try { if (el && host.contains(el)) { mapApi = a; mapEl = el; } } catch (e) { /* ignorat */ } return a; };
  const unwrapMap = () => { if (mapCreate0 && MM.create !== mapCreate0) MM.create = mapCreate0; };
  try { ui = W.CerulUI.mount(host, fake, helpers); } catch (e) { console.warn("[tutorial] CerulUI.mount", e); unwrapMap(); host.remove(); W.__CERUL_PRACTICE = false; return null; }
  // butoanele care ar atinge partida reală / salonul sunt prinse aici
  const BLOCK = { salon: 1, newgame: 1, resettable: 1, rematch: 1, lobby: 1, table: 1, rules: 1, resign: 1 };
  host.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-k]");
    if (t && BLOCK[t.dataset.k]) { e.stopPropagation(); e.preventDefault(); if (t.dataset.k === "resign") flash("În antrenament nu abandonăm 🙂"); else askExit(); return; }
    setTimeout(evalStep, 120);
  }, true);

  /* --- antrenorul --- */
  coach = D.createElement("div"); coach.className = "ct-coach";
  coach.innerHTML = `<div class="ct-hole"></div><div class="ct-bub" role="dialog" aria-live="polite" aria-label="Antrenor"><span class="ar"></span><div class="in"></div></div>`;
  host.appendChild(coach);
  const hole = coach.querySelector(".ct-hole"), bub = coach.querySelector(".ct-bub"), arw = bub.querySelector(".ar"), inner = bub.querySelector(".in"), chipL = { set textContent(v) { host.setAttribute("aria-label", "Meci de antrenament · " + v); } };
  let stepIdx = -1, mode = "step", target = null, lastHTML = "", lastR = "", conf = null;
  const N = STEPS.length;
  function flash(msg) { try { ui && ui.toast && ui.toast(msg, "", "🎓"); } catch (e) { /* ignorat */ } }
  const tx = (v) => typeof v === "function" ? v(E) : (v || "");

  /* --- ajutoarele lumii (pregătesc situațiile pentru fiecare pas) --- */
  E.starter = Object.keys(st.c[ME].r);
  if (sv) { E.starter = sv.starter || E.starter; E.landings = +sv.landings || 0; E.lastLand = sv.lastLand == null ? null : sv.lastLand; E.lastLandP = sv.lastLandP || null; E.goodR = sv.goodR || null; E.badR = sv.badR || null; E.cr = sv.cr || null; }
  let lastSave = 0;
  function save(force) {
    if (!alive || stepIdx < 0) return; const now = Date.now(); if (!force && now - lastSave < 2000) return; lastSave = now;
    try { localStorage.setItem(saveKey(), JSON.stringify({ v: SAVE_V, t: now, gk, step: stepIdx, mode, st, vt, mk: E.mk, pn: part.n, starter: E.starter, landings: E.landings, lastLand: E.lastLand, lastLandP: E.lastLandP || null, goodR: E.goodR || null, badR: E.badR || null, cr: E.cr || null })); } catch (e) { /* plin / blocat: fără reluare */ }
  }
  // spot „virtual” pe hartă: ap:<id> = aeroport, pl:<id> = avionul meu în zbor
  const VT = {};
  function vtarget(kind, id) {
    const key = kind + ":" + id; if (VT[key]) return VT[key];
    const z = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    return (VT[key] = { _virt: 1, contains: () => false, closest: () => null, scrollIntoView() { /* nimic */ },
      getBoundingClientRect() {
        let p = null; try { p = mapApi && mapApi.anchor(kind === "ap" ? "airport" : "plane", kind === "ap" ? id : (isNaN(+id) ? id : +id)); } catch (e) { p = null; }
        const r = mapEl && mapEl.getBoundingClientRect(); if (!p || !r || !p.visible) return z;
        const s = kind === "ap" ? 30 : 36, x = r.left + p.x - s / 2, y = r.top + p.y - s / 2; return { left: x, top: y, width: s, height: s, right: x + s, bottom: y + s };
      } });
  }
  function virtOk(t) {
    const r = t.getBoundingClientRect(); if (r.width < 2) return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
    try { const top = D.elementFromPoint(cx, cy); return !top || coach.contains(top) || (mapEl && mapEl.contains(top)); } catch (e) { return true; }
  }
  E.myRoute = () => { const ks = Object.keys(st.c[ME].r), nw = ks.filter(k => E.starter.indexOf(k) < 0); return nw[0] || ks[0]; };
  E.permitOk = () => { const c = st.c[ME]; return c.pm.some(p => L.permitNeed(c, p, false).ok); };
  E.prepGhiseu = () => {
    const c = st.c[ME]; if (!c.pm.length) return;
    const p = c.pm.slice().sort((x, y) => x.d - y.d)[0], k = p.k.slice();
    let mx = 0; for (let i = 1; i < 4; i++) if (k[i] > k[mx]) mx = i;
    let ex = 0; for (let i = 1; i < 4; i++) if (k[i] < k[ex]) ex = i; if (ex === mx) ex = (mx + 1) % 4;
    const h = k.slice(); h[mx] = Math.max(0, h[mx] - 1); h[ex] += 5; h.push(0); c.h = h.slice(0, 5);
    const NM = (L.CARD_NAMES || ["aprobare", "infrastructură", "echipaj", "combustibil"]);
    E.mk.getK = ["apr", "inf", "ech", "comb"][mx]; E.mk.giveK = ["apr", "inf", "ech", "comb"][ex]; E.mk.pn = apN(p.a) + " – " + apN(p.b); E.mk.missN = NM[mx] || "?"; E.mk.extraN = "5 × " + (NM[ex] || "");
    if (c.cash < 6e6) c.cash = 6e6;
  };
  E.sizesHTML = () => {
    const r = E.myRoute(); const [a, b2] = r ? L.ridEnds(r) : [null, null]; const d = r ? dist(a, b2) : 0;
    const rows = typeOrder().map(ty => { const t = ptype(ty); const ok = d && t.range >= d; return `<tr><td>${esc(t.n)}</td><td class="n">${t.seats} loc.</td><td class="n">${thou(t.range)} km</td><td class="n ${ok ? "ok" : "bad"}">${d ? (ok ? "✓ ajunge" : "✗ prea departe") : ""}</td></tr>`; }).join("");
    return `<p>Ruta ta <b>${esc(apN(a))} – ${esc(apN(b2))}</b> are <b>${thou(d)} km</b>. Fiecare avion are <b>locuri</b>, <b>autonomie</b> (cât de departe zboară) și un cost pe km.</p><table>${rows}</table>`;
  };
  E.fitTy = () => { const r = E.myRoute(); const d = r ? dist(...L.ridEnds(r)) : 0; return typeOrder().find(ty => (ptype(ty).range || 0) >= d) ?? 0; };
  E.tn = (path, def) => { try { let o = W.CerulTune; for (const k of path) { if (!o || typeof o !== "object") return def; o = o[k]; } return o == null ? def : o; } catch (e) { return def; } };
  let vCache = null, vKey = "";
  E.view = () => { const k = st.mv + "|" + st.day + "|" + Math.round(vt / 500) + "|" + (st.pl.length); if (vCache && k === vKey && vCache.__st === st) return vCache; try { vCache = L.view(st, ME, vt) || {}; } catch (e) { vCache = {}; } vCache.__st = st; vKey = k; return vCache; };
  E.pm = (k, d) => String(E.tn(["price", k], d)).replace(".", ",");
  E.slotTxt = () => { const c = E.tn(["slots", "capBySize"], [0, 99, 3, 2]); return `aeroport mic ${c[1] >= 50 ? "fără limită" : c[1]}, mediu <b>${c[2]}</b>, mare doar <b>${c[3]}</b> companii (+${E.tn(["slots", "capAdd4p"], 1)} la 4 jucători)`; };
  E.gateTxt = () => { const g = E.tn(["gates", "bySize"], [0, 3, 6, 10]); return `<b>porțile</b> sunt comune tuturor companiilor (mic ${g[1]}, mediu ${g[2]}, mare ${g[3]} avioane deodată, mai multe la 3–4 jucători); dacă sunt pline, avionul așteaptă cel mult ${Math.round(E.tn(["gates", "maxWaitMin"], 180) / 60)} h.`; };
  E.rangeTxt = () => { const r = E.view().permitRange; if (!r || !r.km) return ""; return `<p>📏 <b>Permisele noi</b> ajung doar cât zboară cel mai lung avion al tău (+${Math.round(E.tn(["permits", "rangeMargin"], 0.1) * 100)}%): acum <b>până la ${thou(r.km)} km</b>. Cumperi sau iei în leasing un avion cu rază mai mare → primești permise mai lungi.</p>`; };
  E.rampTxt = () => { const r = E.view().leaseRamp, f = v => Math.round((+v || 0) * 100) + "%"; if (!r) return ""; return `La început chiria e redusă: azi <b>${f(r.today)}</b>, apoi crește treptat și e <b>100% din ziua ${r.fullFrom}</b>.`; };
  E.ownPct = () => Math.round(E.tn(["lease", "ownMult"], 1.15) * 100);
  E.undoSec = () => E.tn(["undo", "sec"], 8);
  E.undoInfo = () => E.view().undo || null;
  E.flyPid = () => { const f = id => myPlanes(E).find(p => p.id === id && p.m === 2); if (E.mk.fly != null && f(E.mk.fly)) return E.mk.fly; const p = myPlanes(E).filter(p => p.m === 2).sort((a, b2) => (a.ch ? 1 : 0) - (b2.ch ? 1 : 0))[0]; E.mk.fly = p ? p.id : null; return E.mk.fly; };
  E.taxTxt = () => { const t = E.view().tax; if (!t) return ""; return `<br>💰 <b>Impozitul pe profit</b> îl plătesc doar liderii care fug departe: ${Math.round((+t.rate || 0.4) * 100)}% din profitul zilei peste <b>${eur(t.free)}</b> (azi). Tu nu ești încă acolo.`; };
  E.leasedPlane = () => myPlanes(E).find(p => p.ls);
  E.leaseInfo = () => { const p = E.leasedPlane(); if (!p) return ""; try { const v = (L.view(st, ME, vt).planes || []).find(x => x.id === p.id) || {}; const n = v.daysToOwn != null ? v.daysToOwn : null; return n != null ? `devine al tău după ~${n} zile de plăți` : ""; } catch (e) { return ""; } };
  E.canBuyout = () => { const p = E.leasedPlane(); if (!p) return false; try { const v = (L.view(st, ME, vt).planes || []).find(x => x.id === p.id); return !!(v && v.buyoutPrice != null && st.c[ME].cash >= v.buyoutPrice); } catch (e) { return false; } };
  E.fuelLine = () => {
    const x = E.lastLandP; if (!x) return "";
    const d = dist(x.a, x.b), ck = ptype(x.ty).ckm || 0, idx = Math.round(((st.fi || 1) * (st.cf || 1)) * 100) / 100;
    if (!d || !ck) return "";
    return `<p>⛽ <b>Combustibilul nu se termină</b> — se plătește singur la fiecare zbor: ${thou(d)} km × ${String(ck).replace(".", ",")} €/km × indicele petrolului ${idx.toFixed(2).replace(".", ",")} ≈ <b>${eur(d * ck * idx)}</b>. Mai ieftin cu investiția <b>Flotă eco</b>; evenimentele cu petrolul îl urcă sau îl coboară.</p>`;
  };
  E.pminWatch = M => { const n = +M.data.n, be = M.data.be; if (be == null || !(n > 0)) return; if (n < be) E.mk.red = 1; else if (E.mk.red) E.mk.green = 1; };
  E.boarded = () => myPlanes(E).some(p => p.rid && p.m === 1 && (p.px >= Math.max(6, (ptype(p.ty).seats || 70) * 0.35)));
  E.myTurn = () => { const dr = st.dr; return !!(dr && !dr.rv && dr.ord[dr.i] === ME); };
  E.spec = id => { try { return L.normSpecial(id) || id; } catch (e) { return id; } };
  E.fireEvent = () => {
    const Dd = Dt(); const evs = (Dd && Dd.EVENTS) || [];
    const def = evs.find(e => e.mood === "bun" && e.scope && /global|company/.test(e.scope.type)) || evs.find(e => e.mood === "bun") || evs[0];
    if (!def) return;
    try { const n0 = st.ev.length; L._internal.triggerEvent(st, def, rng()); if (st.ev.length > n0) { st.mv++; E.mk.ev = def.n; } } catch (e) { console.warn("[tutorial] event", e); }
  };
  E.prepFreeze = () => { const c = st.c[ME]; c.sx.frz = (c.sx.frz || 0) + 1; c.fzCd = 0; st.pacts = st.pacts.filter(p => !(p.a === ME || p.b === ME)); if (st.c[BOT].fz) try { L._internal.endFreeze(st, BOT); } catch (e) { st.c[BOT].fz = null; } st.pz = null; st.run = 1; st.at = vt; st.mv++; };
  E.prepBreaker = () => {
    try { if (st.c[BOT].fz) L._internal.endFreeze(st, BOT); } catch (e) { st.c[BOT].fz = null; }
    const c = st.c[ME], o = st.c[BOT]; c.sx.brk = (c.sx.brk || 0) + 1; o.sx.frz = (o.sx.frz || 0) + 1; o.fzCd = 0; st.pz = null; st.run = 1; st.at = vt;
    const r = L.apply(st, BOT, { a: "play", card: "frz", target: ME }, vt, rng()); if (!r || !r.ok) console.warn("[tutorial] freeze bot", r);
    st.mv++;
  };
  E.prepChain = () => {
    const c = st.c[ME], r1 = E.myRoute(); if (!r1 || typeof L.chainOptions !== "function") { E.mk.noChain = 1; return; }
    const [x, y] = L.ridEnds(r1), aps = (Dt() && Dt().AIRPORTS) || [];
    // avionul pentru escală: un Turbo 72 cadou, liber, la bază
    const ids0 = myPlanes(E).map(p => p.id);
    c.sx.gift = (c.sx.gift || 0) + 1; const gr = L.apply(st, ME, { a: "play", card: "gift" }, vt, rng()); if (!gr || !gr.ok) console.warn("[tutorial] gift", gr);
    const free = myPlanes(E).filter(p => p.rid == null).sort((a, b2) => (ids0.indexOf(a.id) < 0 ? -1 : 0) - (ids0.indexOf(b2.id) < 0 ? -1 : 0) || (ptype(b2.ty).range || 0) - (ptype(a.ty).range || 0));
    const pl = free[0]; const rg = pl ? (ptype(pl.ty).range || 1800) : 1800; if (pl) E.mk.pid = pl.id;
    let best = null;
    for (const [gMax, bMin] of [[1.2, 1.8], [1.3, 1.6], [1.45, 1.45]]) { if (best) break;
    for (const [A, B] of [[x, y], [y, x]]) {
      const dAB = dist(A, B); let good = null, bad = null;
      for (const ap of aps) {
        if (ap.id === A || ap.id === B || (ap.size || 1) < 2) continue;
        const dBC = dist(B, ap.id), dAC = dist(A, ap.id); if (dBC < 250 || dBC > rg * 0.9 || dAC < 250 || dAB > rg) continue;
        const ratio = (dAB + dBC) / dAC, pop = ap.pop || 1;
        if (ratio <= gMax && (!good || pop > good.pop)) good = { id: ap.id, pop, ratio };
        if (ratio >= Math.max(bMin, E.tn(["chain", "maxDetour"], 1.6)) && (!bad || pop < bad.pop)) bad = { id: ap.id, pop, ratio };
      }
      if (good && bad && good.id !== bad.id) { best = { A, B, good, bad }; break; }
    } }
    if (!best) { E.mk.noChain = 1; return; }
    if (pl && !pl.m && !pl.rid) pl.ap = best.A; // avionul liber așteaptă deja în A (fără zbor gol până acolo), ca să apuce zboruri azi
    const build = (u, v) => { const pm = c.pm; st.nid = (st.nid || 0) + 1; c.pm = [{ id: st.nid, a: u, b: v, d: dist(u, v), k: [0, 0, 0, 0] }]; if (c.cash < 8e6) c.cash = 8e6; const r = L.apply(st, ME, { a: "build", permitId: st.nid }, vt, rng()); c.pm = pm; return r && r.ok ? L.ridOf(u, v) : null; };
    const rG = build(best.B, best.good.id), rB = build(best.B, best.bad.id);
    if (!rG || !rB) { E.mk.noChain = 1; return; }
    const est = (via, o) => { try { return L.estimate(st, ME, Object.assign({ rid: r1, via }, o)) || {}; } catch (e) { return {}; } };
    const eg = est(rG, { pid: pl && pl.id });
    // exemplul prost: un avion prea mare pe o etapă subțire, cu ocol mare → pierdere reală (alegem tipul cu cea mai mare pierdere estimată)
    let eb = null, bTy = 0;
    for (const ty of typeOrder()) { const e = est(rB, { type: ty }); if (e && e.ok !== false && e.profitDay != null && (!eb || e.profitDay < eb.profitDay)) { eb = e; bTy = ty; } }
    eb = eb || {}; E.mk.badTy = bTy;
    E.mk.r1 = r1;
    E.mk.good = { via: rG, a: best.A, b: best.B, c: best.good.id, p: eg.profitDay, through: eg.through };
    E.mk.bad = { via: rB, a: best.A, b: best.B, c: best.bad.id, p: eb.profitDay, through: eb.through };
    E.goodR = E.mk.good; E.badR = E.mk.bad;
    st.mv++;
  };
  E.share = () => { const r = E.mk.rid; if (!r) return 0; try { const v = (L.view(st, ME, vt).routes || []).find(x => x.rid === r); return v ? Math.round(((v.share.ab + v.share.ba) / 2) * 100) : 0; } catch (e) { return 0; } };
  E.prepRival = () => {
    const r = E.myRoute(); if (!r) return; const [a, b2] = L.ridEnds(r), o = st.c[BOT];
    if (!o.r[r]) {
      const pm = o.pm; st.nid = (st.nid || 0) + 1; o.pm = [{ id: st.nid, a, b: b2, d: dist(a, b2), k: [0, 0, 0, 0] }]; if (o.cash < 8e6) o.cash = 8e6;
      const res = L.apply(st, BOT, { a: "build", permitId: st.nid }, vt, rng()); o.pm = pm; if (!res || !res.ok) { console.warn("[tutorial] rival", res); return; }
      o.sx.gift = (o.sx.gift || 0) + 1; L.apply(st, BOT, { a: "play", card: "gift" }, vt, rng());
      const pl = st.pl.filter(p => p.s === BOT && p.rid == null).pop(); if (pl) L.apply(st, BOT, { a: "assign", pid: pl.id, rid: r }, vt, rng());
      const nrm = typeof L.routeNormal === "function" ? L.routeNormal(r) : L.normalPrice(dist(a, b2), a, b2); L.apply(st, BOT, { a: "price", rid: r, p: Math.round(nrm * 0.7), dir: "both" }, vt, rng());
    }
    E.mk.rid = r; E.mk.rn = apN(a) + " – " + apN(b2); st.mv++;
  };
  E.placeBad = () => {
    const g = E.mk.bad; if (!g) return; const c = st.c[ME];
    const ids0 = myPlanes(E).map(p => p.id), ty = E.mk.badTy | 0, pr = ptype(ty).price || 0;
    c.cash += pr; // avionul exemplului e din partea antrenorului (banii tăi rămân la fel)
    const rb = L.apply(st, ME, { a: "buyPlane", type: ty }, vt, rng());
    let pl = rb && rb.ok ? myPlanes(E).find(p => ids0.indexOf(p.id) < 0) : null;
    if (!pl) { c.cash -= pr; c.sx.gift = (c.sx.gift || 0) + 1; L.apply(st, ME, { a: "play", card: "gift" }, vt, rng()); pl = myPlanes(E).filter(p => p.rid == null && ids0.indexOf(p.id) < 0).pop(); }
    if (!pl) return;
    if (!pl.m && !pl.rid && g.a) pl.ap = g.a;
    const r = L.apply(st, ME, { a: "assign", pid: pl.id, rid: E.mk.r1, via: g.via }, vt, rng()); E.mk.badPid = r && r.ok ? pl.id : null;
    if (E.mk.badPid != null) { L.apply(st, ME, { a: "pilot", pid: pl.id, on: true }, vt, rng()); L.apply(st, ME, { a: "pilotMin", pid: pl.id, n: Math.max(1, Math.round((ptype(pl.ty).seats || 70) * 0.06)) }, vt, rng()); }
    // avionul tău de pe escala bună zboară și el cu pilot (pleacă când merită)
    const gp = myPlanes(E).find(p => p.id === E.mk.pid); if (gp && !gp.pil) L.apply(st, ME, { a: "pilot", pid: gp.id, on: true }, vt, rng());
    if (gp && gp.pm == null) L.apply(st, ME, { a: "pilotMin", pid: gp.id, n: Math.max(1, Math.round((ptype(gp.ty).seats || 70) * 0.4)) }, vt, rng());
    E.goodR.pid = E.mk.pid; E.badR.pid = E.mk.badPid; E.badR.ty = pl.ty; E.cr = { day: st.day, g: 0, b: 0 };
    if (st.ud) delete st.ud[ME];
    st.mv++;
  };
  // rezultatul REAL al zborurilor de pe cele două escale, în ziua în care au fost puse (profitul zborurilor: bilete − combustibil, echipaj, taxe)
  E.trackChain = () => {
    const cr = E.cr; if (!cr || st.day !== cr.day || !E.goodR || !E.badR) return;
    const pv = E.view().planes || [], f = id => { const p = pv.find(x => x.id === id); return p && p.profitToday != null ? +p.profitToday : null; };
    const g = f(E.goodR.pid), b2 = f(E.badR.pid); if (g != null) cr.g = g; if (b2 != null) cr.b = b2;
  };
  E.chainResult = () => {
    const g = E.goodR || {}, b2 = E.badR || {}, cr = E.cr; if (!g.via || !b2.via || !cr) return "";
    const v = x => `<b class="${x >= 0 ? "ok" : "bad"}">${x >= 0 ? "+" : ""}${eur(x)}</b>`;
    return `<br>🔀 <b>Escalele de ieri, rezultat real</b> (profitul zborurilor): escala bună prin <b>${esc(apN(g.b))}</b> → ${esc(apN(g.c))}: ${v(cr.g)} · escala proastă prin <b>${esc(apN(b2.b))}</b> → ${esc(apN(b2.c))} (${esc(ptype(b2.ty).n || "")}): ${v(cr.b)}.${cr.b < 0 ? " Avionul mare a zburat aproape gol pe ruta subțire: <b>pierdere</b> la fiecare zbor." : ""}`;
  };
  E.chainHTML = () => {
    if (E.mk.noChain) return "O <b>rută cu escală</b> leagă două rute ale tale care au un oraș comun: avionul zboară A → B → C și înapoi.";
    const g = E.mk.good, b2 = E.mk.bad, f = (v, th) => v == null ? "?" : `<span class="${v >= 0 && v >= (E.mk.bad.p || 0) ? "ok" : "bad"}">${v >= 0 ? "+" : ""}${eur(v)}/zi</span>${th != null ? `<br><small>+${Math.round(th)} pasageri/zi prin escală</small>` : ""}`;
    const modal = E.U.modal && /assign/.test(E.U.modal.kind || "");
    return `<p>O <b>rută cu escală</b> zboară <b>A → B → C</b> și înapoi pe <b>două rute ale tale</b> cu un oraș comun B. Ți-am construit încă două rute din <b>${esc(apN(g.b))}</b> și ți-am dat un avion liber. Fiecare etapă trebuie să fie în raza avionului; aterizarea în B costă taxă și timp. Pasagerii A → C vin în plus dacă drumul e aproape drept, prețul tău total e bun și nimeni nu zboară A–C direct. Un <b>hub</b> în B (nu e un hangar!) nu e obligatoriu, dar scade taxele acolo și aduce mai mulți pasageri în tranzit.</p>
<table><tr><td>✅ ${esc(apN(g.a))} → ${esc(apN(g.b))} → ${esc(apN(g.c))}<br><small>aproape în linie dreaptă</small></td><td class="n">${f(g.p, g.through)}</td></tr>
<tr><td>❌ ${esc(apN(b2.a))} → ${esc(apN(b2.b))} → ${esc(apN(b2.c))}<br><small>ocol mare (fără pasageri direcți A → C) și un ${esc(ptype(E.mk.badTy | 0).n || "avion")} prea mare pentru ruta asta subțire</small></td><td class="n">${f(b2.p, b2.through)}</td></tr></table>
${modal ? "Alege varianta bună din „🔀 Cu escală” și atribuie avionul. Pe cea proastă pun eu un avion în plus (cadou de la antrenor), ca să comparăm mâine rezultatul real." : "În <b>✈️ Flotă</b>, la avionul liber, apasă <b>„Atribuie rută”</b> și alege „🔀 Cu escală”."}`;
  };
  E.podiumHTML = () => {
    let fv = []; try { fv = (L.finalValuation(st) || []).slice().sort((a, b2) => b2.total - a.total); } catch (e) { fv = []; }
    const rows = fv.map((r, i) => `<tr><td>${["🥇", "🥈", "🥉"][i] || i + 1} ${esc(st.c[r.seat] ? st.c[r.seat].co : r.seat)}${r.seat === ME ? " <small>(tu)</small>" : ""}</td><td class="n">${eur(r.total)}</td></tr>`).join("");
    const win = fv[0] && fv[0].seat === ME;
    return `${win ? "Ai câștigat minimeciul! 🎉" : "Mara a câștigat minimeciul — în partida reală e altă poveste!"}<table>${rows}</table>Pe ecran vezi podiumul, calculul valorii și fila <b>📈 Evoluția valorii</b> (graficul fiecărei companii, zi de zi). În partida reală, la început votați și <b>banii de start</b> și <b>câte evenimente</b> apar. Acțiunile cumpărate la alte companii nu „fură” valoare: plătești cât valorează. Acum știi tot ce-ți trebuie.`;
  };

  /* --- pașii --- */
  function enter(j, rs) {
    stepIdx = j; mode = rs && rs.mode === "bravo" ? "bravo" : "step"; E.mk = (rs && rs.mk) || {}; E.acts = []; target = null; lastR = ""; lastHTML = "";
    st.mv++;
    const s = STEPS[j];
    try { const U = (ui && ui._ui) || {}; if (U.popKind && s.id !== "price" && s.id !== "undo") D.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); } catch (e) { /* ignorat */ }
    if (s.id !== "breaker" && st.c[ME].fz) { try { L._internal.endFreeze(st, ME); } catch (e) { st.c[ME].fz = null; } }
    if (s.enter && !rs) { try { s.enter(E); } catch (e) { console.warn("[tutorial] enter " + s.id, e); } }
    if (st.ud && !rs) delete st.ud[ME]; // pregătirile antrenorului nu se „anulează”
    pump(true);
    try { opts.onStep && opts.onStep(j + 1, N); } catch (e) { /* ignorat */ }
    save(true);
    evalStep();
  }
  function evalStep() {
    if (!alive || stepIdx < 0) return;
    E.U = (ui && ui._ui) || {}; E.phone = !!(ui && ui.el && ui.el.classList.contains("phone"));
    const s = STEPS[stepIdx];
    if (mode === "step" && !s.info && s.done) { let d = false; try { d = s.done(E); } catch (e) { d = false; } if (d) { mode = "bravo"; target = null; setTimeout(() => save(true), 0); if (s.id === "breaker" && st.c[ME].fz) { try { L._internal.endFreeze(st, ME); } catch (e) { /* ignorat */ } } } }
    draw();
  }
  function clockMode() {
    const s = STEPS[stepIdx] || {};
    if (st.phase === "end") return "hold";
    if (st.phase === "draft") return E.myTurn() ? "hold" : "scene";
    if (st.phase === "nego") return "scene";
    if (mode === "bravo" || conf) return "hold";
    let m = s.clock ? s.clock(E) : "hold"; if (!m) m = "hold";
    // nu lăsa ziua 1 să se termine înainte de pasul draftului
    const di = STEPS.findIndex(x => x.id === "draft");
    if (m !== "hold" && stepIdx < di && st.phase === "play") { try { const ci = L.clockInfo(st, vt); if (ci.dayFrac > 0.82) m = "hold"; } catch (e) { /* ignorat */ } }
    return m;
  }
  let lastUR = 0;
  function tick() {
    if (!alive) return;
    const now = Date.now(), dt = Math.min(250, now - lastReal); lastReal = now;
    const m = clockMode(); botOn = m !== "hold";
    if (m !== "hold") vt += dt * (ACC[m] || 1);
    pump(false);
    try { E.trackChain && E.trackChain(); } catch (e) { /* ignorat */ }
    // mesajul „↩ Anulează” dispare după 8 s reale; cât ceasul stă pe loc, îl readuc (interfața îl redesenează la render)
    if (STEPS[stepIdx] && STEPS[stepIdx].id === "undo" && mode === "step" && now - lastUR > 900 && E.undoInfo() && !host.querySelector('[data-tkey="undo"]')) { lastUR = now; try { ui.render(fake); } catch (e) { /* ignorat */ } }
    evalStep();
    save(false);
  }

  /* --- desen: balon + spot --- */
  function visible(el) {
    if (!el || coach.contains(el)) return false;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0 || cs.display === "none") return false;
    try { const cx = clamp(r.left + r.width / 2, 1, innerWidth - 2), cy = clamp(r.top + r.height / 2, 1, innerHeight - 2); const top = D.elementFromPoint(cx, cy); if (top && !el.contains(top) && !top.contains(el) && !coach.contains(top)) { const m = top.closest(".cl-modal, .cl-scene > *, .cg-ov, .cs-root"); if (m && !m.contains(el)) return false; } } catch (e) { /* ignorat */ }
    return true;
  }
  function findOne(list) {
    for (const k of list || []) {
      if (/^(ap|pl):/.test(k)) { const t = vtarget(k.slice(0, 2), k.slice(3)); if (virtOk(t)) return t; continue; }
      const sel = k.indexOf("sel:") === 0 ? k.slice(4) : `[data-tut="${k}"]`;
      let els; try { els = host.querySelectorAll(sel); } catch (e) { continue; }
      for (const el of els) if (visible(el)) return el;
      for (const el of els) { // în afara ecranului (listă derulabilă)? îl aduc în vedere
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || coach.contains(el)) continue;
        if (r.bottom < 0 || r.top > innerHeight) { try { el.scrollIntoView({ block: "center" }); } catch (e) { /* ignorat */ } if (visible(el)) return el; }
      }
    }
    return null;
  }
  function blockMsg(s) {
    if (s.id !== "draft" && st.phase === "draft") return E.myTurn() ? "Draftul de seară: alege o carte de pe masă, apoi continuăm." : "Draftul de seară — alege botul, apoi tu.";
    if (s.id !== "nego" && st.phase === "nego") return "Negociere în curs — închide-o și continuăm.";
    if (s.id !== "pause" && st.pz) return "Jocul e pe pauză. Apasă „▶️ Continuă” ca să mergem mai departe.";
    if (s.id !== "breaker" && st.c[ME].fz) return "Ești înghețat câteva clipe ❄️…";
    return "";
  }
  function draw() {
    const s = STEPS[stepIdx]; if (!s) return;
    chipL.textContent = `🎓 Antrenament · pasul ${stepIdx + 1}/${N}`;
    const pct = Math.round((stepIdx + (mode === "bravo" ? 1 : 0)) / N * 100);
    const last = stepIdx === N - 1;
    let h;
    if (mode === "bravo") {
      h = `<div class="hd"><span class="cs">${coachFace(46)}</span><div><small>Pasul ${stepIdx + 1} din ${N} · gata</small><b class="t">${last ? "Finalul minimeciului 🏆" : "Bravo! 🎉"}</b></div></div>
<p>${tx(s.bravo) || "Ai reușit!"}</p><div class="bt"><span class="prog"><i style="width:${pct}%"></i></span>${last ? `<button class="pri" data-c="finish">Sunt gata de joc ✈️</button>` : `<button class="lnk" data-c="exit">Ies din tutorial</button><button class="pri" data-c="cont">Continuă →</button>`}</div>`;
    } else {
      const blk = blockMsg(s), wt = !blk && s.wait ? tx(s.wait) : "";
      const body = tx(s.text);
      h = `<div class="hd"><span class="cs">${coachFace(46)}</span><div><small>${(c => c ? `Capitolul ${c.i}/${c.n} · ${esc(c.name)} · ` : "")(chapterOf(s.id))}pasul ${stepIdx + 1} din ${N}</small><b class="t">${esc(s.title)}</b></div></div>
${blk ? `<p class="wait">⏳ ${esc(blk)}</p>` : `${body ? (body.indexOf("<p>") === 0 ? body : `<p>${body}</p>`) : ""}${wt ? `<p class="wait">⏳ ${esc(wt)}</p>` : !s.info && !wt && body ? `<div class="do">👉 Apasă tu ce e evidențiat — continui când văd că ai făcut pasul.</div>` : ""}`}
<div class="bt"><span class="prog"><i style="width:${pct}%"></i></span><button class="lnk" data-c="exit">Ies din tutorial</button>${s.info && !blk ? `<button class="pri" data-c="next">Am înțeles →</button>` : ""}${!s.info && (E.mk.noChain || (s.id === "chain" && !blk && E.mk.good && Date.now() - (E.mk.t0 || (E.mk.t0 = Date.now())) > 60000)) ? `<button data-c="next">Sari peste</button>` : ""}</div>`;
    }
    if (h !== lastHTML) {
      const fresh = inner.dataset.k !== mode + stepIdx;
      inner.innerHTML = h; lastHTML = h; inner.dataset.k = mode + stepIdx; lastR = "";
      if (fresh) { bub.classList.remove("pop"); void bub.offsetWidth; if (!reduced()) bub.classList.add("pop"); }
    }
    const confirmOpen = E.U.modal && E.U.modal.kind === "confirm";
    const nt = mode === "step" && !blockMsg(s) ? findOne((confirmOpen ? ["sel:.cl-modal [data-mconfirm]"] : []).concat(typeof s.tut === "function" ? s.tut(E) : s.tut)) : (mode === "step" && st.phase === "draft" ? findOne(["sel:.cs-dc.can"]) : null);
    let closeHint = false;
    if (!nt && mode === "step" && !s.info && !blockMsg(s) && st.phase === "play") {
      const cx = findOne(["sel:.cs-dlg .cs-x2[data-act=x]", "sel:.cs-dlg [data-act=x]", "sel:.cl-modal .cl-x[data-mclose]"]);
      if (cx) { closeHint = true; if (cx !== target) { target = cx; lastR = ""; } }
    }
    const missEl = inner.querySelector(".do"); if (missEl) { if (closeHint) { if (!missEl.dataset.o) missEl.dataset.o = missEl.innerHTML; missEl.innerHTML = "👉 Închide fereastra deschisă (✕) ca să continuăm."; } else if (missEl.dataset.o) { missEl.innerHTML = missEl.dataset.o; delete missEl.dataset.o; } }
    if (closeHint) { place(); return; }
    if (nt !== target) { target = nt; lastR = ""; if (nt) { try { nt.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { /* ignorat */ } } }
    place();
  }
  const inter = (a, c) => Math.max(0, Math.min(a.r, c.r) - Math.max(a.l, c.l)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.t, c.t));
  function place() {
    const vw = innerWidth, vh = innerHeight, bw = bub.offsetWidth, bh = bub.offsetHeight, m = 10;
    if (!target) {
      const key = ["c", bw, bh, vw, vh].join(","); if (key === lastR) return; lastR = key;
      hole.classList.remove("on"); arw.style.display = "none";
      bub.style.left = Math.round((vw - bw) / 2) + "px"; bub.style.top = Math.round(vw < 700 ? Math.min(64, vh - bh - 64) : vh - bh - 22) + "px"; return;
    }
    const r = target.getBoundingClientRect(), pad = 6;
    const hx = Math.max(2, r.left - pad), hy = Math.max(2, r.top - pad), hw = Math.min(vw - 4 - hx, r.width + pad * 2), hh = Math.min(vh - 4 - hy, r.height + pad * 2);
    const key = [hx, hy, hw, hh, bw, bh, vw, vh].map(Math.round).join(","); if (key === lastR) return; lastR = key;
    Object.assign(hole.style, { left: hx + "px", top: hy + "px", width: hw + "px", height: hh + "px" }); hole.classList.add("on");
    const H = { l: hx, t: hy, r: hx + hw, b: hy + hh }, cx = hx + hw / 2, cy = hy + hh / 2, g = 14;
    let C = null; try { const box = target.closest(".cl-mcard, .cl-pop, .cs-cards"); if (box) { const q = box.getBoundingClientRect(); C = { l: q.left - 4, t: q.top - 4, r: q.right + 4, b: q.bottom + 4 }; } } catch (e) { /* ignorat */ }
    const around = R => { const rx = (R.l + R.r) / 2, ry = (R.t + R.b) / 2; return [["b", cx - bw / 2, R.b + g], ["t", cx - bw / 2, R.t - bh - g], ["r", R.r + g, cy - bh / 2], ["l", R.l - bw - g, cy - bh / 2], ["b", rx - bw / 2, R.b + g], ["t", rx - bw / 2, R.t - bh - g], ["r", R.r + g, ry - bh / 2], ["l", R.l - bw - g, ry - bh / 2]]; };
    const raw = (C ? around(C) : []).concat(around(H), [["in", m, vh - bh - m], ["in", vw - bw - m, vh - bh - m], ["in", vw - bw - m, m + 36], ["in", m, m + 36]]);
    const cand = raw.map(([side, x, y]) => { x = clamp(x, m, Math.max(m, vw - bw - m)); y = clamp(y, m, Math.max(m, vh - bh - m)); const B = { l: x, t: y, r: x + bw, b: y + bh }; return { x, y, ov: inter(H, B), oc: C ? inter(C, B) : 0 }; });
    const best = cand.find(c => c.ov === 0 && c.oc === 0) || cand.filter(c => c.ov === 0).sort((a, c) => a.oc - c.oc)[0] || cand.slice().sort((a, c) => a.ov - c.ov)[0];
    bub.style.left = Math.round(best.x) + "px"; bub.style.top = Math.round(best.y) + "px";
    const B = { l: best.x, t: best.y, r: best.x + bw, b: best.y + bh };
    const side = best.ov > 0 ? "" : B.t >= H.b - 1 && cx > B.l + 14 && cx < B.r - 14 ? "b" : B.b <= H.t + 1 && cx > B.l + 14 && cx < B.r - 14 ? "t" : B.l >= H.r - 1 && cy > B.t + 14 && cy < B.b - 14 ? "r" : B.r <= H.l + 1 && cy > B.t + 14 && cy < B.b - 14 ? "l" : "";
    if (!side) arw.style.display = "none";
    else {
      arw.style.display = "block";
      if (side === "b" || side === "t") { arw.style.left = clamp(cx - best.x - 8, 14, bw - 30) + "px"; arw.style.top = side === "b" ? "-9px" : (bh - 9) + "px"; arw.style.transform = side === "b" ? "rotate(45deg)" : "rotate(225deg)"; }
      else { arw.style.top = clamp(cy - best.y - 8, 14, bh - 30) + "px"; arw.style.left = side === "r" ? "-9px" : (bw - 9) + "px"; arw.style.transform = side === "r" ? "rotate(-45deg)" : "rotate(135deg)"; }
    }
  }

  /* --- ieșirea --- */
  function askExit() {
    if (conf) return;
    conf = D.createElement("div"); conf.className = "ct-conf";
    conf.innerHTML = `<div role="dialog" aria-label="Ieși din tutorial"><h3>Ieși din tutorial?</h3><p>Meciul de antrenament se oprește și ești marcat <b>gata</b> pentru partida reală. Îl poți relua din „📖 Ghid” oricând.</p><div class="bt"><button data-c="stay">Rămân</button><button class="pri" data-c="bye">Ies — sunt gata</button></div></div>`;
    coach.appendChild(conf);
    try { conf.querySelector(".pri").focus(); } catch (e) { /* ignorat */ }
  }
  coach.addEventListener("click", e => {
    const t = e.target.closest("[data-c]"); if (!t) return;
    e.stopPropagation();
    const c = t.dataset.c;
    if (c === "exit") askExit();
    else if (c === "stay") { conf && conf.remove(); conf = null; }
    else if (c === "bye") stop(false);
    else if (c === "finish") stop(true);
    else if (c === "next" || c === "cont") { if (stepIdx + 1 < N) enter(stepIdx + 1); else stop(true); }
  });
  // pași informativi cu „clickAdvance”: trec și când apeși chiar elementul arătat
  host.addEventListener("click", e => { const s = STEPS[stepIdx]; if (s && s.info && s.clickAdvance && mode === "step" && !blockMsg(s) && target && target.contains(e.target)) setTimeout(() => { if (STEPS[stepIdx] === s) enter(stepIdx + 1); }, 500); });
  const onKey = e => { if (e.key === "Escape" && conf) { conf.remove(); conf = null; } };
  D.addEventListener("keydown", onKey);
  const onRs = () => { lastR = ""; };
  W.addEventListener("resize", onRs);

  let raf = 0;
  const loop = () => { if (!alive) return; place(); raf = requestAnimationFrame(loop); };
  const iv = setInterval(tick, 100);
  // partida reală a pornit fără mine (nu ar trebui) → închid antrenamentul
  const guard = setInterval(() => { const rs = realCtx && realCtx.state; if (rs && rs.phase && rs.phase !== "setup" && rs.phase !== "boot") stop(false, true); }, 1000);

  function stop(finished, silent) {
    if (!alive) return; alive = false;
    clearInterval(iv); clearInterval(guard); cancelAnimationFrame(raf);
    timers.forEach(clearTimeout); ivs.forEach(clearInterval); offs.forEach(f => { try { f(); } catch (e) { /* ignorat */ } });
    D.removeEventListener("keydown", onKey); W.removeEventListener("resize", onRs);
    try { ui && ui.destroy(); } catch (e) { /* ignorat */ }
    host.remove(); W.__CERUL_PRACTICE = false; unwrapMap(); clearSave();
    if (!D.querySelector(".cl-root")) D.documentElement.classList.remove("cl-on"); else D.documentElement.classList.add("cl-on");
    if (cur === api) cur = null;
    try { const G = W.CerulGuide; if (G && G.practiceDone) G.practiceDone(!!finished); } catch (e) { /* ignorat */ }
    if (!silent) try { opts.onExit && opts.onExit(!!finished); } catch (e) { /* ignorat */ }
  }
  const api = {
    stop: (f, s) => stop(f, s), get step() { return stepIdx + 1; }, of: N, get id() { return STEPS[stepIdx] && STEPS[stepIdx].id; }, get mode() { return mode; },
    next: () => { if (stepIdx + 1 < N) enter(stepIdx + 1); else stop(true); }, go: j => enter(clamp(j, 0, N - 1)),
    _st: () => st, _ui: () => ui, _E: E, get target() { return target; },
  };
  cur = api;
  raf = requestAnimationFrame(loop);
  if (sv && STEPS[sv.step]) enter(clamp(sv.step | 0, 0, N - 1), { mk: sv.mk, mode: sv.mode });
  else enter(clamp(opts.startIdx | 0, 0, N - 1));
  return api;
}
// după reîncărcare: dacă există un antrenament salvat și setup-ul arată „🎓 Continuă tutorialul”, îl reiau singur (o dată pe pagină)
(function autoResume() {
  if (W.__CERUL_TUT_AR) return; W.__CERUL_TUT_AR = 1;
  let n = 0;
  const iv = setInterval(() => {
    n++; if (cur || n > 240) { clearInterval(iv); return; }
    if (!loadSave()) { if (n > 40) clearInterval(iv); return; }
    const b = D.querySelector("[data-tut-go]");
    if (b && b.offsetParent !== null && /Continuă/.test(b.textContent || "")) { clearInterval(iv); try { b.click(); } catch (e) { /* ignorat */ } }
  }, 500);
})();

W.CerulTutorial = { start, active: () => !!cur, current: () => cur, stop: () => { if (cur) cur.stop(false); }, STEPS_N: STEPS.length, steps: () => STEPS.map(s => ({ id: s.id, title: s.title, info: !!s.info })) };
})();
