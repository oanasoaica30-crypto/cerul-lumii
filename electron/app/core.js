/* Salonul de Jocuri — core engine.
   Games register with Salon.register(def). See API.md for the contract. */
(function () {
"use strict";
const S = window.Salon = { games: [], byId: {}, version: 1 };
const $ = (sel, root) => (root || document).querySelector(sel);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
const rid = () => Math.random().toString(36).slice(2, 10);
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));

S.register = def => {
  if (!def || !def.id) return;
  if (S.byId[def.id]) return;
  def.mode = def.mode || "turn";
  S.games.push(def); S.byId[def.id] = def;
};

/* ======================= IDENTITY ======================= */
let testMode = store.get("salon-test") === "1";
function baseId() { let t = store.get("salon-id"); if (!t) { t = "u" + rid(); store.set("salon-id", t); } return t; }
function tabId() { try { let t = sessionStorage.getItem("salon-tab"); if (!t) { t = rid(); sessionStorage.setItem("salon-tab", t); } return t; } catch (e) { return rid(); } }
let ME = window.__SALON_ME || (testMode ? baseId() + "-" + tabId() : baseId());
const LOCAL_ID = ME; // id-ul vechi (din browser), folosit la migrarea locurilor
let nick = window.__SALON_NICK || store.get("salon-nick") || "";
if (testMode) { try { nick = sessionStorage.getItem("salon-nick-tab") || nick; } catch (e) {} }
let nickDbT = 0;
function saveNickDb() { if (!db || window.__SALON_NICK) return; const n = (nick || "").trim(); if (!n) return; write("nicks/" + ME, () => db.doc("nicks/" + ME).set({ n, at: Date.now() })); }
function setNick(n) { clearTimeout(nickDbT); nickDbT = setTimeout(() => { saveNickDb(); if (cur) syncSeatName(cur); }, 1200); nick = n; if (window.__SALON_NICK) return; store.set("salon-nick", n); if (testMode) { try { sessionStorage.setItem("salon-nick-tab", n); } catch (e) {} } }

/* ======================= AUDIO ======================= */
let ac = null, master, sfxBus, musicBus, noiseBuf, reverb, delay;
let soundOn = store.get("salon-sound") !== "off";
let musicOn = store.get("salon-music") !== "off";
let musicVol = parseFloat(store.get("salon-musicvol") || "0.55");
function makeImpulse(sec, decay) {
  const len = ac.sampleRate * sec, buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return buf;
}
function audio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = .85;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = soundOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? musicVol * .5 : 0; musicBus.connect(master);
    reverb = ac.createConvolver(); reverb.buffer = makeImpulse(2.6, 2.4);
    const wet = ac.createGain(); wet.gain.value = .32; reverb.connect(wet); wet.connect(master);
    delay = ac.createDelay(1); delay.delayTime.value = .33;
    const fb = ac.createGain(); fb.gain.value = .32; delay.connect(fb); fb.connect(delay);
    const dWet = ac.createGain(); dWet.gain.value = .25; delay.connect(dWet); dWet.connect(musicBus);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function unlock() { if (audio()) { if (musicOn && Music.want && !Music.playing) Music.start(Music.want); } }
document.addEventListener("pointerdown", unlock, true);
document.addEventListener("keydown", unlock, true);
const ready = () => ac && ac.state === "running";
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, vol, dur, attack, release) {
  const a = attack || .006;
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, .0002), t + a);
  if (release) { g.gain.setValueAtTime(Math.max(vol, .0002), t + Math.max(a, dur - release)); }
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
}
function tone(type, f0, f1, dur, vol, delayS, o) {
  if (!ready()) return; o = o || {};
  const t = ac.currentTime + (delayS || 0), osc = ac.createOscillator(), g = ac.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  if (o.detune) osc.detune.value = o.detune;
  env(g, t, vol, dur, o.attack);
  let node = osc;
  if (o.filt) { const f = ac.createBiquadFilter(); f.type = o.ftype || "lowpass"; f.frequency.value = o.filt; f.Q.value = o.q || .7; osc.connect(f); node = f; }
  node.connect(g); g.connect(o.bus || sfxBus); if (o.verb) g.connect(reverb);
  osc.start(t); osc.stop(t + dur + .05);
}
function noise(type, f0, f1, q, dur, vol, delayS, o) {
  if (!ready()) return; o = o || {};
  const t = ac.currentTime + (delayS || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, vol, dur, o.attack || .004);
  s.connect(f); f.connect(g); g.connect(o.bus || sfxBus); if (o.verb) g.connect(reverb);
  s.start(t, Math.random()); s.stop(t + dur + .05);
}
const SFX = {
  click() { tone("square", 1200, 900, .03, .05); },
  tick() { tone("triangle", 1800, 1600, .025, .06); },
  hover() { tone("sine", 2200, 2100, .02, .025); },
  select() { tone("triangle", 660, 880, .08, .12); },
  place() { tone("triangle", 330, 150, .14, .3); noise("lowpass", 1200, 200, 1, .12, .18); },
  move() { noise("bandpass", 900, 500, 1.5, .16, .22); tone("sine", 260, 180, .1, .12); },
  slide() { noise("bandpass", 1600, 700, 2, .28, .16); },
  capture() { tone("square", 520, 120, .18, .14, 0, { filt: 1800 }); noise("lowpass", 2500, 300, 1, .2, .3); },
  flip() { noise("highpass", 3000, 1500, .8, .08, .25); tone("sine", 900, 600, .05, .05); },
  deal() { noise("bandpass", 2600, 1800, 1.2, .07, .3); },
  shuffle() { for (let i = 0; i < 9; i++) noise("bandpass", 2400 + Math.random() * 900, 1500, 1.2, .05, .2, i * .045); },
  dice() { for (let i = 0; i < 7; i++) { tone("square", 700 + Math.random() * 500, 300, .03, .06, i * .06 + Math.random() * .02, { filt: 2500 }); noise("bandpass", 1800, 900, 3, .04, .2, i * .06); } },
  coin() { tone("square", 988, 988, .07, .08, 0, { filt: 4000 }); tone("square", 1319, 1319, .25, .08, .07, { filt: 4000 }); },
  chime() { [784, 988, 1175].forEach((f, i) => tone("sine", f, f, .5, .1, i * .07, { verb: true })); },
  ping() { tone("sine", 1320, 1310, .7, .16, 0, { verb: true }); tone("sine", 1320, 1310, .5, .05, .36); },
  turn() { tone("sine", 880, 880, .18, .12, 0, { verb: true }); tone("sine", 1320, 1320, .35, .12, .12, { verb: true }); },
  error() { tone("square", 220, 180, .14, .08, 0, { filt: 1200 }); tone("square", 180, 150, .18, .08, .1, { filt: 1200 }); },
  pop() { tone("sine", 500, 1200, .07, .2); },
  whoosh() { noise("bandpass", 400, 3000, 1.2, .3, .25); },
  whistle() { tone("sine", 2000, 420, .4, .07); },
  boom(big) { noise("lowpass", big ? 2600 : 1800, 50, .8, big ? 1.6 : 1, big ? 1 : .8, 0, { verb: true }); tone("sine", 110, 30, big ? 1.1 : .7, .9); noise("highpass", 3000, 1500, .5, .12, .3); },
  splash() { noise("bandpass", 3200, 600, 1.3, .55, .45); noise("lowpass", 900, 200, 1, .3, .25, .05); tone("sine", 700, 180, .18, .07); },
  hit() { noise("lowpass", 1500, 200, 1, .12, .5); tone("sine", 160, 60, .12, .4); },
  bounce() { tone("sine", 600, 300, .08, .18); },
  laser() { tone("sawtooth", 1600, 200, .18, .08, 0, { filt: 3000 }); },
  powerup() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone("square", f, f, .08, .06, i * .05, { filt: 3000 })); },
  horn() { tone("sawtooth", 98, 92, 1.3, .2, 0, { filt: 700 }); tone("sawtooth", 147, 140, 1.3, .1, 0, { filt: 700 }); },
  tock() { tone("sine", 1000, 1000, .04, .12); },
  alarm() { for (let i = 0; i < 3; i++) tone("square", 880, 880, .12, .07, i * .2, { filt: 2500 }); },
  write() { for (let i = 0; i < 4; i++) noise("bandpass", 4000 + Math.random() * 2000, 3000, 4, .04, .08, i * .05); },
  buzz() { tone("sawtooth", 110, 100, .35, .12, 0, { filt: 900 }); },
  correct() { tone("triangle", 659, 659, .12, .18); tone("triangle", 988, 988, .3, .18, .1, { verb: true }); },
  wrong() { tone("triangle", 330, 300, .16, .16); tone("triangle", 247, 220, .35, .16, .14); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, i === 3 ? 1.1 : .2, .22, i * .15, { verb: true }));
          [262, 330, 392, 523].forEach((f, i) => tone("sine", f, f, i === 3 ? 1.1 : .2, .12, i * .15)); noise("highpass", 6000, 6000, .5, 1.2, .06, .5); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone("triangle", f, f * .97, i === 3 ? 1.1 : .3, .18, i * .25, { verb: true })); },
  start() { tone("sawtooth", 196, 196, .25, .1, 0, { filt: 1400 }); tone("sawtooth", 262, 262, .25, .1, .2, { filt: 1400 }); tone("sawtooth", 392, 392, .6, .12, .4, { filt: 1800, verb: true }); },
};
S.sfx = SFX;

/* ======================= MUSIC (generative) ======================= */
// chords: semitone offsets from root; arp: chord-tone index per 16th or null
const STY = {
  calm:   { bpm: 76, root: 50, swing: .08, chords: [[0,4,7,11],[-3,0,4,7],[5,9,12,16],[7,11,14,17]],
            arp: [0,null,2,null,1,null,3,null,2,null,null,1,3,null,2,null], arpW: "triangle", arpO: 24, arpV: .05,
            pad: { w: "sine", v: .035 }, bass: { pat: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], w: "sine", v: .13 },
            k: [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0], s: [], h: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], kv: .2, sv: 0, hv: .018 },
  folk:   { bpm: 112, root: 50, chords: [[0,3,7],[5,8,12],[7,11,14],[0,3,7]],
            arp: [2,1,0,1,2,1,0,1,2,1,0,1,2,0,1,2], arpW: "triangle", arpO: 24, arpV: .045,
            stab: { pat: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], w: "sawtooth", v: .03, f: 1400 },
            bass: { pat: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], w: "triangle", v: .14, fifth: true },
            k: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], s: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], h: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], kv: .22, sv: .04, hv: .02 },
  jazz:   { bpm: 100, root: 48, swing: .16, chords: [[2,5,9,12],[7,11,14,17],[0,4,7,11],[9,13,16,19]],
            arp: [null,null,null,null,null,null,3,null,null,null,null,null,null,null,1,null], arpW: "sine", arpO: 24, arpV: .05,
            stab: { pat: [0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0], w: "triangle", v: .03, f: 2400 },
            bass: { walk: true, w: "triangle", v: .15 },
            k: [], s: [], h: [1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1], kv: 0, sv: 0, hv: .012, brush: true },
  tense:  { bpm: 96, root: 45, chords: [[0,3,7],[-4,0,3],[3,7,10],[-2,2,5]],
            arp: [0,0,2,0,1,0,2,0,0,0,2,0,1,0,2,1], arpW: "sawtooth", arpO: 12, arpV: .022, arpF: 1500,
            pad: { w: "sawtooth", v: .018, f: 900 }, bass: { pat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], w: "sawtooth", v: .06, f: 400 },
            k: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0], s: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1], h: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], kv: .3, sv: .05, hv: .012 },
  epic:   { bpm: 84, root: 38, chords: [[0,3,7],[-2,2,5],[3,7,10],[5,8,12]],
            arp: [0,null,1,null,2,null,1,null,0,null,1,null,2,1,2,null], arpW: "triangle", arpO: 24, arpV: .04,
            pad: { w: "sawtooth", v: .022, f: 1100 }, bass: { pat: [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0], w: "sawtooth", v: .07, f: 500 },
            k: [1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0], s: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], h: [], kv: .4, sv: .05, hv: 0, timp: true },
  arcade: { bpm: 132, root: 57, chords: [[0,3,7],[-4,0,3],[3,7,10],[-2,2,5]],
            arp: [0,1,2,1,0,1,2,1,0,1,2,1,0,2,1,2], arpW: "square", arpO: 12, arpV: .028, arpF: 3200,
            bass: { pat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1], w: "square", v: .05, f: 900 },
            k: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], s: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], h: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], kv: .32, sv: .06, hv: .016 },
  mystery:{ bpm: 70, root: 40, chords: [[0,3,7,14],[-4,0,3,7],[5,8,12,15],[7,10,14,17]],
            arp: [3,null,null,2,null,null,1,null,null,3,null,null,0,null,null,null], arpW: "sine", arpO: 36, arpV: .04,
            pad: { w: "triangle", v: .03 }, bass: { pat: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], w: "sine", v: .12 },
            k: [1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0], s: [], h: [], kv: .18, sv: 0, hv: 0 },
  party:  { bpm: 118, root: 48, chords: [[0,4,7],[7,11,14],[9,12,16],[5,9,12]],
            arp: [0,2,1,2,0,2,1,2,0,2,1,2,0,1,2,1], arpW: "triangle", arpO: 24, arpV: .035,
            stab: { pat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], w: "square", v: .018, f: 2000 },
            bass: { pat: [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0], w: "triangle", v: .13 },
            k: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], s: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], h: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], kv: .28, sv: .05, hv: .015, clap: true },
};
const Music = { want: null, playing: null, step: 0, next: 0, timer: 0 };
function mVoice(w, f, t, dur, v, o) {
  o = o || {};
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.type = w; osc.frequency.value = f; if (o.det) osc.detune.value = o.det;
  env(g, t, v, dur, o.att || .008, o.rel);
  let node = osc;
  if (o.f) { const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = o.f; osc.connect(fl); node = fl; }
  node.connect(g); g.connect(musicBus); if (o.verb) g.connect(reverb); if (o.dly) g.connect(delay);
  osc.start(t); osc.stop(t + dur + .05);
}
function mNoise(type, f, q, t, dur, v) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t, v, dur, .002);
  s.connect(fl); fl.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + dur + .05);
}
function mStep(st, step, t) {
  const bar = Math.floor(step / 16) % st.chords.length, s = step % 16, ch = st.chords[bar];
  const sixteenth = 60 / st.bpm / 4, barDur = sixteenth * 16;
  if (s === 0 && st.pad) ch.forEach((iv, i) => { mVoice(st.pad.w, midi(st.root + iv + 12), t, barDur * 1.02, st.pad.v, { att: .5, rel: .6, f: st.pad.f, verb: true, det: (i % 2 ? 6 : -6) }); });
  const a = st.arp[s];
  if (a != null) mVoice(st.arpW, midi(st.root + ch[a % ch.length] + st.arpO), t, sixteenth * 1.8, st.arpV, { f: st.arpF, dly: true, verb: true });
  if (st.stab && st.stab.pat[s]) ch.forEach(iv => mVoice(st.stab.w, midi(st.root + iv + 12), t, sixteenth * 1.2, st.stab.v, { f: st.stab.f }));
  if (st.bass) {
    if (st.bass.walk) { if (s % 4 === 0) { const n = ch[(s / 4) % ch.length] - (s === 0 ? 12 : 12 - (s === 12 ? 1 : 0)); mVoice(st.bass.w, midi(st.root + n - 12), t, sixteenth * 3.5, st.bass.v, { f: 900 }); } }
    else if (st.bass.pat[s]) { const n = st.bass.fifth && s >= 8 ? ch[0] + 7 : ch[0]; mVoice(st.bass.w, midi(st.root + n - 12), t, sixteenth * 1.8, st.bass.v, { f: st.bass.f || 1200 }); }
  }
  if (st.k[s]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(st.timp ? 90 : 140, t); o.frequency.exponentialRampToValueAtTime(st.timp ? 45 : 42, t + .22);
    env(g, t, st.kv, st.timp ? .6 : .26); o.connect(g); g.connect(musicBus); if (st.timp) g.connect(reverb); o.start(t); o.stop(t + .7); }
  if (st.s[s]) { mNoise("bandpass", st.clap ? 1500 : 1900, .8, t, .14, st.sv); if (st.clap) mNoise("bandpass", 1300, .8, t + .012, .1, st.sv * .8); }
  if (st.h[s]) mNoise(st.brush ? "bandpass" : "highpass", st.brush ? 5000 : 7500, st.brush ? .6 : .5, t, st.brush ? .09 : .035, st.hv * (s % 4 === 0 ? 1 : .7));
}
Music.start = function (style) {
  Music.want = style;
  if (!musicOn || !ready() || !STY[style]) return;
  if (Music.playing === style) return;
  Music.stop(true); Music.want = style;
  const st = STY[style]; Music.playing = style; Music.step = 0; Music.next = ac.currentTime + .15;
  musicBus.gain.cancelScheduledValues(ac.currentTime);
  musicBus.gain.setValueAtTime(.0001, ac.currentTime); musicBus.gain.exponentialRampToValueAtTime(musicVol * .5 + .0001, ac.currentTime + 1.5);
  Music.timer = setInterval(() => {
    if (!ready()) return;
    while (Music.next < ac.currentTime + .18) {
      mStep(st, Music.step, Music.next);
      const six = 60 / st.bpm / 4; const sw = st.swing ? (Music.step % 2 === 0 ? 1 + st.swing : 1 - st.swing) : 1;
      Music.next += six * sw; Music.step = (Music.step + 1) % (16 * st.chords.length * 2);
    }
  }, 30);
};
Music.stop = function (keepWant) { clearInterval(Music.timer); Music.timer = 0; Music.playing = null; if (!keepWant) Music.want = null; };
S.music = Music;

/* ======================= FX CANVAS ======================= */
const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
let cv, g2, P = [], raf = 0, lastT = 0, dpr = 1;
function sizeFx() { if (!cv) return; dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
function addP(p) { if (RM || !g2) return; p.t = 0; P.push(p); if (P.length > 900) P.splice(0, P.length - 900); if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(fxLoop); } }
const rnd = (a, b) => a + Math.random() * (b - a);
const easeOut = k => 1 - Math.pow(1 - k, 3);
function fxLoop(now) {
  const dt = Math.max(0, Math.min(.05, (now - lastT) / 1000)); lastT = now;
  g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, innerWidth, innerHeight);
  P = P.filter(p => (p.t += dt) < p.life);
  for (const p of P) {
    const k = p.t / p.life;
    if (p.type === "spark" || p.type === "drop" || p.type === "conf") {
      p.vy += (p.g || 0) * dt; p.vx *= (p.drag || .985); p.x += p.vx * dt; p.y += p.vy * dt;
      g2.globalCompositeOperation = p.type === "spark" ? "lighter" : "source-over";
      g2.globalAlpha = p.type === "conf" ? Math.min(1, (1 - k) * 2) : 1 - k; g2.fillStyle = p.c;
      if (p.type === "conf") { p.rot += p.vr * dt; g2.save(); g2.translate(p.x, p.y); g2.rotate(p.rot); g2.fillRect(-p.r, -p.r * .45, p.r * 2, p.r * .9 * Math.abs(Math.cos(p.rot * 1.7))); g2.restore(); }
      else { g2.beginPath(); g2.arc(p.x, p.y, Math.max(.3, p.r * (1 - k * .6)), 0, 7); g2.fill(); }
    } else if (p.type === "smoke") {
      p.x += p.vx * dt; p.y += p.vy * dt;
      g2.globalCompositeOperation = "source-over"; g2.globalAlpha = .4 * (1 - k); g2.fillStyle = p.c || "#3a4a52";
      g2.beginPath(); g2.arc(p.x, p.y, p.r + 26 * easeOut(k), 0, 7); g2.fill();
    } else if (p.type === "ring") {
      g2.globalCompositeOperation = "lighter"; g2.globalAlpha = 1 - k; g2.strokeStyle = p.c; g2.lineWidth = p.w * (1 - k) + .5;
      g2.beginPath(); g2.arc(p.x, p.y, Math.max(.1, p.r0 + (p.r1 - p.r0) * easeOut(k)), 0, 7); g2.stroke();
    } else if (p.type === "flash") {
      g2.globalCompositeOperation = "lighter"; g2.globalAlpha = 1 - k;
      const r = p.r * (1 + k), gr = g2.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gr.addColorStop(0, "#fff7e8"); gr.addColorStop(.3, p.c || "#ffb36b"); gr.addColorStop(1, "rgba(255,123,63,0)");
      g2.fillStyle = gr; g2.beginPath(); g2.arc(p.x, p.y, r, 0, 7); g2.fill();
    } else if (p.type === "streak") {
      const e = k * k, tk = Math.max(0, e - .18);
      const hx = p.x0 + (p.x1 - p.x0) * e, hy = p.y0 + (p.y1 - p.y0) * e, tx = p.x0 + (p.x1 - p.x0) * tk, ty = p.y0 + (p.y1 - p.y0) * tk;
      g2.globalCompositeOperation = "lighter"; g2.globalAlpha = 1;
      const lg = g2.createLinearGradient(tx, ty, hx, hy); lg.addColorStop(0, "rgba(255,180,120,0)"); lg.addColorStop(1, p.c || "#fff1dc");
      g2.strokeStyle = lg; g2.lineWidth = 3; g2.lineCap = "round"; g2.beginPath(); g2.moveTo(tx, ty); g2.lineTo(hx, hy); g2.stroke();
      g2.fillStyle = "#fff"; g2.beginPath(); g2.arc(hx, hy, 3, 0, 7); g2.fill();
    }
  }
  g2.globalAlpha = 1; g2.globalCompositeOperation = "source-over";
  raf = P.length ? requestAnimationFrame(fxLoop) : 0;
  if (!raf) g2.clearRect(0, 0, innerWidth, innerHeight);
}
function pt(a, b) { if (a && typeof a === "object" && a.getBoundingClientRect) { const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } if (a && typeof a === "object") return a; return { x: a, y: b }; }
// fx target can be an element, {x,y}, or two numbers x,y — remaining args follow.
function targ(args) { const a = [...args]; if (typeof a[0] === "number" && typeof a[1] === "number") return [{ x: a[0], y: a[1] }, a.slice(2)]; return [pt(a[0]), a.slice(1)]; }
const FX = {
  at: pt,
  explode() { const [{ x, y }, [s0]] = targ(arguments); const s = typeof s0 === "number" && s0 > 0 ? s0 : 1;
    addP({ type: "flash", x, y, r: 38 * s, life: .35 });
    addP({ type: "ring", x, y, r0: 6, r1: 70 * s, w: 4, c: "#ffb36b", life: .6 });
    for (let i = 0; i < 34 * s; i++) { const a2 = rnd(0, 6.28), v = rnd(80, 340) * s;
      addP({ type: "spark", x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v - 60, g: 420, r: rnd(1.5, 3.5), c: `hsl(${rnd(15, 48)},100%,${rnd(55, 75)}%)`, life: rnd(.45, 1.1) }); }
    for (let i = 0; i < 9 * s; i++) addP({ type: "smoke", x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-20, 20), vy: rnd(-50, -15), r: rnd(4, 9), life: rnd(1, 1.8) }); },
  splash() { const [{ x, y }, [color]] = targ(arguments); const c = typeof color === "string" ? color : "#64d2da";
    addP({ type: "ring", x, y, r0: 4, r1: 46, w: 3, c, life: .7 }); addP({ type: "ring", x, y, r0: 2, r1: 30, w: 2, c: "#e6fbfc", life: .5 });
    for (let i = 0; i < 22; i++) { const a2 = rnd(-2.6, -.5), v = rnd(90, 260); addP({ type: "drop", x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v, g: 700, r: rnd(1.5, 3), c: i % 3 ? c : "#e6fbfc", life: rnd(.5, .9) }); } },
  sparkle() { const [{ x, y }, [color, n0]] = targ(arguments); const n = typeof n0 === "number" ? n0 : 18; const c = typeof color === "string" ? color : null;
    for (let i = 0; i < n; i++) { const a2 = rnd(0, 6.28), v = rnd(40, 180); addP({ type: "spark", x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v, g: 60, r: rnd(1.2, 2.6), c: c || `hsl(${rnd(40, 60)},100%,70%)`, life: rnd(.4, .9) }); }
    addP({ type: "ring", x, y, r0: 2, r1: 30, w: 2, c: c || "#ffe08a", life: .45 }); },
  ring() { const [{ x, y }, [color, r1]] = targ(arguments); addP({ type: "ring", x, y, r0: 4, r1: typeof r1 === "number" && r1 > 4 ? r1 : 50, w: 3, c: typeof color === "string" ? color : "#64d2da", life: .6 }); },
  confetti(n) { n = typeof n === "number" ? n : 160; const cols = ["#ff8a4c", "#5fd3dc", "#ffd35c", "#b9a3ff", "#7be07b", "#ff6fa8"];
    for (let i = 0; i < n; i++) addP({ type: "conf", x: rnd(0, innerWidth), y: rnd(-80, -10), vx: rnd(-60, 60), vy: rnd(60, 240), g: 120, drag: .995, r: rnd(3, 6), rot: rnd(0, 6), vr: rnd(-8, 8), c: cols[i % cols.length], life: rnd(2.2, 3.6) }); },
  firework() { const [{ x, y }, [h0]] = targ(arguments); const hue = typeof h0 === "number" ? h0 : rnd(0, 360);
    addP({ type: "flash", x, y, r: 24, life: .3, c: `hsl(${hue},100%,70%)` });
    for (let i = 0; i < 48; i++) { const a2 = (i / 48) * 6.28, v = rnd(160, 260); addP({ type: "spark", x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v, g: 160, r: rnd(1.6, 2.8), c: `hsl(${hue + rnd(-15, 15)},100%,68%)`, life: rnd(.9, 1.5) }); } },
  fireworks(count) { count = typeof count === "number" ? count : 10; for (let i = 0; i < count; i++) setTimeout(() => FX.firework(rnd(innerWidth * .15, innerWidth * .85), rnd(innerHeight * .12, innerHeight * .5)), i * 260); },
  streak(a, b, ms, color) { const p0 = pt(a), p1 = pt(b); addP({ type: "streak", x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, life: (typeof ms === "number" ? ms : 400) / 1000, c: color }); },
  shake(el) { if (RM) return; const w = (el && el.classList) ? el : ($("#stage") || document.body); w.classList.remove("fx-shake"); void w.offsetWidth; w.classList.add("fx-shake"); },
  float() { const [{ x, y }, [text, color]] = targ(arguments); const d = document.createElement("div"); d.className = "fx-float"; d.textContent = text == null ? "" : String(text); d.style.left = x + "px"; d.style.top = y + "px"; if (typeof color === "string") d.style.color = color; document.body.appendChild(d); setTimeout(() => d.remove(), 1300); },
  big(text, tone) { const bg = $("#big"); if (!bg) return; bg.textContent = text; bg.className = tone || ""; void bg.offsetWidth; bg.classList.add("go"); },
};
S.fx = FX;

/* ======================= UI HELPERS ======================= */
const SUITS = { "♠": "black", "♣": "black", "♥": "red", "♦": "red" };
const UI = {
  esc,
  cardHTML(c, cls) {
    cls = cls || "";
    if (!c || c.hidden) return `<div class="g-card back ${cls}"><div class="g-card-back"></div></div>`;
    if (c.r === "JK") return `<div class="g-card joker ${c.color === "red" ? "red" : "black"} ${cls}"><span class="ci tl">★</span><span class="cj">JOKER</span><span class="ci br">★</span></div>`;
    const col = SUITS[c.s] || "black";
    return `<div class="g-card ${col} ${cls}" data-r="${esc(c.r)}" data-s="${esc(c.s)}"><span class="ci tl">${esc(c.r)}<i>${esc(c.s)}</i></span><span class="cs">${esc(c.s)}</span><span class="ci br">${esc(c.r)}<i>${esc(c.s)}</i></span></div>`;
  },
  dieHTML(v, cls) {
    const P = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[v] || [];
    let h = `<div class="g-die ${cls || ""}" data-v="${v}">`; for (let i = 1; i <= 9; i++) h += `<i class="${P.includes(i) ? "on" : ""}"></i>`; return h + `</div>`;
  },
  rollDice(container, values, ms) {
    ms = ms || 700; SFX.dice();
    const els = values.map(() => { const d = document.createElement("div"); container.appendChild(d); return d; });
    return new Promise(res => {
      const t0 = performance.now();
      (function spin() {
        const k = (performance.now() - t0) / ms;
        els.forEach((d, i) => { const v = k >= 1 ? values[i] : 1 + Math.floor(Math.random() * 6); const tmp = document.createElement("div"); tmp.innerHTML = UI.dieHTML(v, k >= 1 ? "landed" : "rolling"); const nd = tmp.firstChild; d.replaceWith(nd); els[i] = nd; });
        if (k < 1) setTimeout(spin, 70); else res(els);
      })();
    });
  },
  fly(from, to, html, ms) {
    ms = ms || 420;
    const a = from.getBoundingClientRect ? from.getBoundingClientRect() : from, b = to.getBoundingClientRect ? to.getBoundingClientRect() : to;
    const g = document.createElement("div"); g.className = "fx-ghost"; g.innerHTML = html || "";
    Object.assign(g.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
    document.body.appendChild(g);
    if (RM || !g.animate) { g.remove(); return Promise.resolve(); }
    const dx = b.left - a.left + (b.width - a.width) / 2, dy = b.top - a.top + (b.height - a.height) / 2;
    const an = g.animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${dx * .5}px,${dy * .5 - 30}px) scale(1.12)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(1)` }], { duration: ms, easing: "cubic-bezier(.4,0,.2,1)" });
    return new Promise(res => { an.onfinish = () => { g.remove(); res(); }; });
  },
  pop(el, cls) { if (!el) return; cls = cls || "anim-pop"; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); },
  askName(cur0) {
    return new Promise(res => {
      const m = document.createElement("div"); m.className = "g-confirm";
      m.innerHTML = `<form class="g-confirm-box" role="dialog" aria-modal="true"><p>Cum te cheamă? Numele apare la masă și în clasament.</p><input class="g-input" maxlength="16" placeholder="ex. Damian" value="${esc(cur0 || "")}" autocomplete="off" spellcheck="false" style="width:100%;margin:6px 0 12px"><div class="g-row"><button type="button" class="g-btn" data-v="0">Renunț</button><button type="submit" class="g-btn primary">Salvează</button></div></form>`;
      document.body.appendChild(m); const inp = m.querySelector("input"); setTimeout(() => { inp.focus(); inp.select(); }, 30);
      const done = v => { m.remove(); res(v); };
      m.querySelector("form").addEventListener("submit", e => { e.preventDefault(); done(inp.value.trim()); });
      m.addEventListener("click", e => { if (e.target.closest("[data-v='0']") || e.target === m) done(null); });
    });
  },
  confirm(text, yes, no, opts) {
    opts = opts || {};
    return new Promise(res => {
      const m = document.createElement("div"); m.className = "g-confirm" + (opts.cls ? " " + opts.cls : "");
      m.innerHTML = `<div class="g-confirm-box" role="dialog" aria-modal="true">${opts.title ? `<h3 class="g-confirm-title">${esc(opts.title)}</h3>` : ""}<p>${esc(text)}</p><div class="g-row"><button class="g-btn" data-v="0">${esc(no || "Nu")}</button><button class="g-btn ${opts.danger ? "danger" : "primary"}" data-v="1">${esc(yes || "Da")}</button></div></div>`;
      document.body.appendChild(m); m.querySelector("[data-v='1']").focus();
      m.addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b || e.target === m) { m.remove(); res(!!(b && b.dataset.v === "1")); } });
    });
  },
  // like confirm, with several choices: btns = [[value, label, cls]], returns the chosen value (null = closed)
  choice(text, btns, opts) {
    opts = opts || {};
    return new Promise(res => {
      const m = document.createElement("div"); m.className = "g-confirm g-choice" + (opts.cls ? " " + opts.cls : "");
      m.innerHTML = `<div class="g-confirm-box" role="dialog" aria-modal="true">${opts.title ? `<h3 class="g-confirm-title">${esc(opts.title)}</h3>` : ""}<p>${esc(text)}</p>${opts.note ? `<p class="g-confirm-note">${esc(opts.note)}</p>` : ""}<div class="g-row">${btns.map(b => `<button class="g-btn ${b[2] || ""}" data-c="${esc(b[0])}">${esc(b[1])}</button>`).join("")}</div></div>`;
      document.body.appendChild(m); const last = m.querySelector("[data-c]:last-child"); if (last) last.focus();
      m.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (b || e.target === m) { m.remove(); res(b ? b.dataset.c : null); } });
    });
  },
  deck52(jokers) { const r = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], s = ["♠", "♥", "♦", "♣"], d = [];
    for (const su of s) for (const ra of r) d.push({ r: ra, s: su }); for (let i = 0; i < (jokers || 0); i++) d.push({ r: "JK", s: "", color: i % 2 ? "red" : "black" }); return d; },
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
};
S.ui = UI;

/* ======================= TOAST / MODAL ======================= */
let toastT;
function toast(t) { const el = $("#toast"); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3200); }
S.toast = toast;
function openRules(def) {
  const m = $("#modal"); if (!m) return;
  $("#modalTitle").textContent = "Reguli: " + def.name;
  $("#modalBody").innerHTML = (def.rules || "<p>Regulile vin în curând.</p>") + (def.controls ? `<h3>Cum se joacă aici</h3>${def.controls}` : "");
  m.hidden = false; $("#modalClose").focus(); SFX.whoosh();
  store.set("salon-rules-" + def.id, "1");
}
function closeModal() { const m = $("#modal"); if (m) m.hidden = true; }

/* ======================= DATA ======================= */
let db = null, room = null, lobbyReady = false;
const queues = {};
/* sănătatea conexiunii MELE, măsurată pe scrierile de joc (st/ și pt/): latență medie, scrieri care atârnă, eșecuri */
const NET = { fly: new Map(), k: 0, lag: 0, okAt: Date.now(), failAt: 0, st: "ok", stAt: Date.now() };
function netTrack(path, fn) {
  if (!/^(st|pt)\//.test(path)) return fn;
  return async () => { const k = ++NET.k, t0 = Date.now(); NET.fly.set(k, t0);
    try { const r = await fn(); const d = Math.min(2500, Date.now() - t0); NET.lag = NET.lag ? NET.lag * .5 + d * .5 : d; /* plafon: o scriere blocată offline nu ține „lent” minute întregi */ NET.okAt = Date.now(); return r; }
    catch (e) { NET.failAt = Date.now(); throw e; } finally { NET.fly.delete(k); } };
}
function netState() {
  const now = Date.now(); let old = 0; NET.fly.forEach(t => { old = Math.max(old, now - t); });
  const offline = (typeof navigator !== "undefined" && navigator.onLine === false) || old > 8000 || NET.failAt > NET.okAt;
  const st = offline ? "off" : (NET.lag > 1500 || old > 3000) ? "slow" : "ok";
  if (st !== NET.st) { NET.st = st; NET.stAt = now; }
  return { st, lag: Math.round(NET.lag), pending: NET.fly.size, since: now - NET.stAt };
}
function write(path, fn) {
  queues[path] = (queues[path] || Promise.resolve()).then(netTrack(path, fn)).catch(e => {
    console.error("write", path, e);
    if (Date.now() - (NET.toastAt || 0) < 8000) return; NET.toastAt = Date.now(); // fără avalanșă de mesaje când pică rețeaua
    toast(e && e.code === "invalid_argument" ? "Nu ai voie să scrii aici. Cere acces de Contributor sau Editor la pagină." : "Nu s-a putut salva. Încearcă din nou.");
  });
  return queues[path];
}
let seatsAll = {}, scores = {}, scoreDays = {}, peers = [], scoreTab = store.get("salon-scoretab") || "azi";
function dayKey(t) { const d = t ? new Date(t) : new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function today() { return scoreDays[dayKey()] || {}; }
const ZILE = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"], LUNI = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
function dayLabel(k) { const [y, m, d] = k.split("-").map(Number); const dt = new Date(y, m - 1, d); if (k === dayKey()) return "Azi"; if (k === dayKey(Date.now() - 864e5)) return "Ieri"; const z = ZILE[dt.getDay()]; return z[0].toUpperCase() + z.slice(1) + ", " + d + " " + LUNI[m - 1] + (y !== new Date().getFullYear() ? " " + y : ""); }

/* ======================= ROUTER / STATE ======================= */
let cur = null; // current game session
let homeFilter = "all", homeSearch = "";
const CATS = [
  ["all", "Toate"], ["masa", "Jocuri de masă"], ["strategie", "Strategie"], ["carti", "Cărți și zaruri"],
  ["cuvinte", "Cuvinte și petrecere"], ["arcade", "Arcade, timp real"], ["echipa", "În echipă"],
];

/* Seats: 2-player games use p1/p2. Games with def.maxPlayers > 2 ("multi") use p1..pN (N ≤ 6). */
const ALLSEATS = ["p1", "p2", "p3", "p4", "p5", "p6"];
const isMulti = def => !!def && (def.maxPlayers | 0) > 2;
const seatKeys = def => isMulti(def) ? ALLSEATS.slice(0, Math.min(6, def.maxPlayers | 0)) : ["p1", "p2"];
const minPlayers = def => isMulti(def) ? Math.max(2, Math.min(def.maxPlayers | 0, (def.minPlayers | 0) || 2)) : 2;
function seatOf(seats, id) { if (!seats) return null; for (const p of ALLSEATS) if (seats[p] && seats[p].owner === id) return p; return null; }

function nameOfSeat(seats, s) { return (seats && seats[s] && seats[s].name) || ("Jucătorul " + (String(s || "").replace(/^p/, "") || "?")); }

/* ======================= HOME ======================= */
function renderHome() {
  const main = $("#main");
  Music.start("jazz");
  document.title = "Salonul de Jocuri";
  if (!$("#homeRoot")) {
    main.innerHTML = `<div id="homeRoot">
  <section class="hero">
    <div class="hero-l">
      <h1 class="h-title">Salonul <span>de jocuri</span></h1>
      <p class="lead">${S.games.length} jocuri pentru doi, fiecare pe calculatorul lui. Alegi jocul, celălalt intră în același joc, iar locurile se ocupă singure.</p>
      <div class="namebox"><label for="nickInput">Numele tău</label><input id="nickInput" class="g-input" maxlength="16" placeholder="ex. Damian" value="${esc(nick)}" autocomplete="off" spellcheck="false"></div>
    </div>
    <div class="hero-r">
      <div class="g-panel"><h3 class="mini-h">Online acum</h3><div class="online" id="homeOnline"></div></div>
      <div class="g-panel"><div class="sc-head"><h3 class="mini-h">Clasament</h3><div class="sc-tabs" id="scTabs"></div></div><div id="homeTotals"></div></div>
    </div>
  </section>
  <div class="home-tools">
    <div class="cats" role="group" aria-label="Categorii" id="homeCats"></div>
    <input id="searchInput" class="g-input search" placeholder="Caută un joc…" value="${esc(homeSearch)}" autocomplete="off" spellcheck="false">
  </div>
  <div class="games-grid" id="homeGrid"></div>
  <footer class="home-foot">
    <label class="testmode"><input type="checkbox" id="testMode" ${testMode ? "checked" : ""}> Mod test: fiecare tab e alt jucător (ca să încerci singur)</label>
  </footer></div>`;
    const ni = $("#nickInput");
    let nickT = 0;
    ni.addEventListener("input", () => { setNick(ni.value.trim()); clearTimeout(nickT); nickT = setTimeout(lobbyPresence, 500); });
    ni.addEventListener("change", () => { setNick(ni.value.trim()); lobbyPresence(); });
    const si = $("#searchInput");
    si.addEventListener("input", () => { homeSearch = si.value; updateHome(); });
  }
  updateHome();
}
function updateHome() {
  if (!$("#homeRoot")) return;
  const online = peers.filter(p => !p.sameTab && p.presence && p.presence.name);
  const totals = scores.total || {};
  const totalList = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const order = CATS.map(c => c[0]);
  const games = S.games.slice().sort((a, b) => (order.indexOf(a.cat) - order.indexOf(b.cat)) || a.name.localeCompare(b.name, "ro")).filter(g => (homeFilter === "all" || g.cat === homeFilter) &&
    (!homeSearch || (g.name + " " + (g.blurb || "")).toLowerCase().includes(homeSearch.toLowerCase())));
  $("#homeOnline").innerHTML = online.length ? online.map(p => { const gm = p.presence.game && S.byId[p.presence.game];
    return `<div class="on-row"><span class="dot"></span><b>${esc(p.presence.name)}</b>${gm ? ` <span class="muted">în ${esc(gm.name)}</span> <button class="g-btn small" data-go="${esc(gm.id)}">Intră și tu</button>` : ` <span class="muted">în salon</span>`}</div>`; }).join("") : `<p class="muted">Deocamdată doar tu. Trimite-i link-ul celuilalt jucător.</p>`;
  $("#scTabs").innerHTML = [["azi", "Azi"], ["zile", "Pe zile"], ["total", "Total"]].map(([k, l]) => `<button class="chip-btn sc-tab" data-sctab="${k}" aria-pressed="${scoreTab === k}">${l}</button>`).join("");
  const rows = (obj, n) => { const l = Object.entries(obj || {}).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]); return l.length ? `<div class="totals">${l.slice(0, n || 6).map(([nm, v], i) => `<div class="tot-row"><span class="rank">${i + 1}</span><b>${esc(nm)}</b><span class="tot-v">${v} ${v === 1 ? "victorie" : "victorii"}</span></div>`).join("")}</div>` : ""; };
  let th = "";
  if (scoreTab === "azi") th = rows(today().total) || `<p class="muted">Nicio victorie azi. Prima partidă deschide clasamentul zilei.</p>`;
  else if (scoreTab === "total") th = rows(totals) || `<p class="muted">Nicio partidă terminată încă.</p>`;
  else { const ks = Object.keys(scoreDays).filter(k => Object.values(scoreDays[k].total || {}).some(v => v > 0)).sort().reverse();
    th = ks.length ? ks.slice(0, 14).map(k => { const l = Object.entries(scoreDays[k].total || {}).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
      return `<div class="day-row"><div class="day-h">${esc(dayLabel(k))}${l.length ? ` <span class="day-win">🏆 ${esc(l[0][0])}</span>` : ""}</div><div class="day-l">${l.map(([nm, v]) => `<span><b>${esc(nm)}</b> ${v}</span>`).join(" · ")}</div></div>`; }).join("")
      : `<p class="muted">Încă nu sunt zile cu partide terminate.</p>`; }
  th += (db ? `<div class="sc-reset">${scoreTab === "azi" ? `<button class="link" id="resetToday">Resetează ziua de azi</button>` : ""}<button class="link" id="resetAll">Resetează tot clasamentul</button></div>` : "");
  $("#homeTotals").innerHTML = th;
  $("#homeCats").innerHTML = CATS.map(([k, l]) => `<button class="chip-btn" data-cat="${k}" aria-pressed="${homeFilter === k}">${l}</button>`).join("");
  $("#homeGrid").innerHTML = games.map(g => gameCard(g)).join("") || `<p class="muted">Niciun joc găsit.</p>`;
}
function gameCard(g) {
  const st = seatsAll[g.id] || {};
  const multi = isMulti(g);
  const occ = (multi ? seatKeys(g) : ["p1", "p2"]).filter(s => st[s] && st[s].owner);
  const mine = seatOf(st, ME);
  let badge = "";
  if (multi) { if (occ.length) badge = `<span class="badge ${mine ? "me" : "wait"}">${occ.length}/${seatKeys(g).length} jucători</span>`; }
  else if (occ.length === 1 && !mine) badge = `<span class="badge wait">${esc(st[occ[0]].name)} te așteaptă</span>`;
  else if (occ.length === 2) badge = `<span class="badge full">${esc(st.p1.name)} vs ${esc(st.p2.name)}</span>`;
  else if (mine) badge = `<span class="badge me">Ai loc aici</span>`;
  const gsc = (scores.g && scores.g[g.id]) || {};
  const best = Object.entries(gsc).sort((a, b) => b[1] - a[1])[0];
  const kind = g.mode === "realtime" ? "timp real" : "pe rând";
  return `<button class="game-card" data-go="${g.id}" style="--gc:${g.color || "var(--accent)"}">
    <span class="gc-icon" aria-hidden="true">${g.icon || ""}</span>
    <span class="gc-body"><span class="gc-name">${esc(g.name)}</span><span class="gc-blurb">${esc(g.blurb || "")}</span>
    <span class="gc-meta"><span class="tag">${kind}</span>${multi ? `<span class="tag">${minPlayers(g)}–${seatKeys(g).length} jucători</span>` : ""}${g.coop ? `<span class="tag coop">în echipă</span>` : ""}${best ? `<span class="tag gold">${esc(best[0])}: ${best[1]}</span>` : ""}</span></span>
    ${badge}</button>`;
}

/* ======================= GAME SESSION ======================= */
let BOT_ID = "bot:" + ME;
// games where starting first gives no real edge: the winner starts the rematch; elsewhere the loser does
const WINNER_STARTS = new Set(["razboi", "perechi", "yams", "nu-te-supara", "macao"]);
function botSeatOf(seats) { if (!seats) return null; if (seats.p1 && seats.p1.owner === BOT_ID) return "p1"; if (seats.p2 && seats.p2.owner === BOT_ID) return "p2"; return null; }
const isBotSeat = d => !!(d && d.bot);
// multi-seat bots: owner "bot:<driverId>:<rand>" — driven by the client whose id is <driverId>
const isMyBot = owner => typeof owner === "string" && (owner === BOT_ID || owner.startsWith(BOT_ID + ":"));
const botDriver = owner => typeof owner === "string" && owner.startsWith("bot:") ? owner.slice(4).split(":")[0] : null;
const newBotOwner = () => BOT_ID + ":" + rid();
const BOT_NAMES = { m: ["Costel", "Gică", "Nelu", "Viorel", "Mitică", "Fane", "Sandu", "Relu"], f: ["Mărioara", "Viorica", "Lenuța", "Fănica", "Gina", "Tanța", "Leana", "Veta"] };
function pickBotIdentity(d) {
  const used = new Set(ALLSEATS.map(k => d[k] && d[k].name).filter(Boolean));
  for (let i = 0; i < 40; i++) { const g = Math.random() < .5 ? "m" : "f"; const l = BOT_NAMES[g]; const name = "Bot " + l[Math.floor(Math.random() * l.length)]; if (!used.has(name)) return { name, g }; }
  return { name: "Bot " + rid().slice(0, 3), g: "m" };
}
// seats taking part in the current game (multi): stored in state.__pl at Start
function playersOf(s) {
  if (!isMulti(s.def)) return ["p1", "p2"];
  if (s.state && Array.isArray(s.state.__pl)) return s.state.__pl.slice();
  if (s.state) return ["p1", "p2"];
  const seats = s.seats || {}; return seatKeys(s.def).filter(k => seats[k] && seats[k].owner);
}
// my seat as seen by the game: in multi, a seat not part of the running game makes me a spectator
function mySeat(s) { const me = seatOf(s.seats, ME); if (!me || !isMulti(s.def) || !s.state) return me; return playersOf(s).includes(me) ? me : null; }
function myBotSeats(s) { if (!s.state) return []; const seats = s.seats || {}; return playersOf(s).filter(k => seats[k] && isMyBot(seats[k].owner) && seats[k].bot); }

function enterGame(id) {
  const def = S.byId[id]; if (!def) { location.hash = ""; return; }
  leaveGame();
  const sess = cur = {
    id, def, seats: null, state: undefined, parts: Object.fromEntries(seatKeys(def).map(k => [k, null])), view: null, mbots: null, mbotsKey: "", botRR: 0, botView: null, unsubs: [], cleanups: [],
    named: null, lastSt: null, lastIn: null, autoTried: false, endShown: null, prevState: null, mountedRev: null,
    lastChange: Date.now(), botTimer: 0, announced: null,
    rsSeen: 0, rsLoaded: false, rsKill: [], seatsLoaded: false, enterAt: Date.now(), connKey: "",
  };
  document.title = def.name + " · Salonul de Jocuri";
  renderGameShell();
  Music.start(def.music || "calm");
  if (!store.get("salon-rules-" + id)) setTimeout(() => { if (cur === sess) openRules(def); }, 400);
  lobbyPresence();
  if (!db) { renderStage(); return; }
  const onErr = e => { console.warn("snapshot", e); };
  sess.unsubs.push(db.doc("seats/" + id).onSnapshot(s => { if (cur !== sess) return; const sd = s.exists ? s.data() : {};
    if (sd && sd.__rs) noteReset(sess, sd.__rs, sd.__rsBy || null, null, !sess.seatsLoaded);
    sess.seats = sd; sess.seatsLoaded = true; maybeAutoSeat(); syncSeatName(sess); if (sess.named) sess.named.presence({ seat: seatOf(sess.seats, ME) || null, name: nick || "" }).catch(() => {}); renderHeader(); renderStage(); }, onErr));
  // „Resetează masa”: rs/<id> = { n, by, kill } — every client drops its auto-seat/reclaim and the killed game
  sess.unsubs.push(db.doc("rs/" + id).onSnapshot(s => { if (cur !== sess) return; const d = s.exists ? s.data() : null;
    if (!sess.rsLoaded) { sess.rsLoaded = true; if (d && d.n) { sess.rsSeen = Math.max(sess.rsSeen, d.n); if (d.kill) sess.rsKill.push(d.kill); } maybeAutoSeat(); return; }
    if (d && d.n) noteReset(sess, d.n, d.by, d.kill, false); }, e => { onErr(e); if (cur === sess && !sess.rsLoaded) { sess.rsLoaded = true; maybeAutoSeat(); } }));
  setTimeout(() => { if (cur === sess && !sess.rsLoaded) { sess.rsLoaded = true; maybeAutoSeat(); } }, 2500);
  sess.unsubs.push(db.doc("st/" + id).onSnapshot(s => { if (cur !== sess) return; const d = s.exists ? s.data() : null; let ns = d ? d.s : null; if (ns && isMulti(def) && !Array.isArray(ns.__pl)) ns = null;
    /* partidă dintr-o versiune veche → înapoi în lobby */
    if (ns && ns.__prev && !sess.rsKill.includes(ns.__prev)) sess.rsKill.push(ns.__prev);
    if (ns && sess.rsKill.includes(ns.__sid)) {
      // o mutare întârziată (ex. simularea gazdei) din partida oprită a rescris-o peste „Joc nou”/„Resetează masa”:
      // cine a pornit partida nouă (sau a resetat masa) o rescrie; ceilalți o ignoră
      const mine = sess.state ? sess.startedSid === sess.state.__sid : (sess.resetBy && sess.resetBy === sess.rsSeen);
      if (mine) { const keep = sess.state ? clone(sess.state) : null; write("st/" + id, () => db.doc("st/" + id).set({ s: keep })); }
      return;
    }
    // scriere întârziată (ex. un dispozitiv care a fost offline își trimite starea veche la revenire): mult în urmă ca revizie
    // ȘI ca timp față de ce avem → o ignorăm; dacă ultima stare bună e a mea, o rescriu
    const cs = sess.state;
    if (ns && cs && ns.__sid === cs.__sid && !ns.__end && (ns.__rev || 0) < (cs.__rev || 0) - 3 && (ns.__t || 0) < (cs.__t || 0) - 8000) {
      if (cs.__by === ME || isMyBot(cs.__by)) { const keep = clone(cs); write("st/" + id, () => cur === sess && sess.state === cs ? db.doc("st/" + id).set({ s: keep }) : null); }
      return;
    }
    applyState(ns); }, onErr));
  seatKeys(def).forEach(p => sess.unsubs.push(db.doc("pt/" + id + "_" + p).onSnapshot(s => { if (cur !== sess) return; const v = s.exists ? (s.data().d ?? null) : null; if (JSON.stringify(v) !== JSON.stringify(sess.parts[p])) sess.lastChange = Date.now(); sess.parts[p] = v; renderStage(true); }, onErr)));
  if (def.mode === "realtime") joinRt(sess);
  sess.botTimer = setInterval(() => botTick(sess), 70);
  sess.connTimer = setInterval(() => connTick(sess), 2000);
}
function leaveGame() {
  if (!cur) return;
  const s = cur; cur = null;
  clearInterval(s.botTimer); clearInterval(s.connTimer);
  s.unsubs.forEach(u => { try { u(); } catch (e) {} });
  destroyView(s);
  if (s.named) { try { s.named.leave(); } catch (e) {} }
  lobbyPresence();
}
function destroyView(s) {
  if (s.view) { try { s.view.destroy && s.view.destroy(); } catch (e) { console.error(e); } }
  if (s.botView) { try { s.botView.destroy && s.botView.destroy(); } catch (e) { console.error(e); } }
  s.view = null; s.botView = null; s.ctx = null; s.botCtx = null;
  if (s.botRoot) { s.botRoot.remove(); s.botRoot = null; }
  if (s.mbots) { s.mbots.forEach(b => { if (b.view) { try { b.view.destroy && b.view.destroy(); } catch (e) { console.error(e); } } if (b.root && b.root.parentNode) b.root.remove(); }); }
  s.mbots = null; s.mbotsKey = "";
  s.cleanups.forEach(f => { try { f(); } catch (e) {} }); s.cleanups = [];
}
function applyState(ns) {
  const s = cur; if (!s) return;
  const old = s.state;
  if (old && ns && old.__rev === ns.__rev && old.__by === ns.__by && old.__sid === ns.__sid) return; // own echo
  s.prevState = old === undefined ? null : old;
  s.state = ns; s.lastChange = Date.now();
  if (ns && old && ns.__sid !== old.__sid) { destroyView(s); s.endShown = null; }
  renderStage();
}
function syncSeatName(sess) {
  const me = seatOf(sess.seats, ME); const n = (nick || "").trim();
  if (!me || !n || !db || sess.seats[me].name === n || sess.nameSyncing) return;
  sess.nameSyncing = true;
  write("seats/" + sess.id, () => db.doc("seats/" + sess.id).update({ [me]: { name: n } })).then(() => { sess.nameSyncing = false; });
}
function migrateLocalSeat(sess) {
  if (!db || ME === LOCAL_ID || !sess.seats || sess.migrated) return false;
  const d = sess.seats, keys = Object.keys(d).filter(k => /^p[1-6]$/.test(k));
  const hit = keys.filter(k => d[k] && (d[k].owner === LOCAL_ID || (typeof d[k].owner === "string" && d[k].owner.startsWith("bot:" + LOCAL_ID))));
  if (!hit.length) return false;
  sess.migrated = true;
  const upd = {}; hit.forEach(k => { const o = d[k].owner; upd[k] = { owner: o === LOCAL_ID ? ME : "bot:" + ME + o.slice(("bot:" + LOCAL_ID).length) }; });
  write("seats/" + sess.id, () => db.doc("seats/" + sess.id).update(upd));
  return true;
}
/* ---- „Resetează masa”: golește toate locurile + partida, pentru toți ---- */
// n = marcajul resetării (timestamp). Idempotent: același n e procesat o singură dată.
function noteReset(sess, n, by, kill, initial) {
  if (kill && !sess.rsKill.includes(kill)) sess.rsKill.push(kill);
  if (!n || n <= sess.rsSeen) return;
  sess.rsSeen = n;
  sess.autoTried = true; sess.reclaimTried = true; // după resetare nimeni nu e reașezat automat
  if (initial) return;
  if (sess.state && (!kill || sess.state.__sid === kill)) { sess.prevState = sess.state; destroyView(sess); sess.state = null; sess.endShown = null; sess.parts = Object.fromEntries(seatKeys(sess.def).map(k => [k, null])); }
  document.querySelectorAll(".g-confirm:not(.g-reset-ask)").forEach(m => { const b = m.querySelector("[data-v='0']"); if (b) b.click(); else m.remove(); });
  const bg = $("#big"); if (bg) bg.classList.remove("go");
  if (sess.resetBy !== n) toast(`Masa a fost resetată${by ? " de " + by : ""}. Alege un loc ca să joci.`);
  renderStage();
}
async function resetTable() {
  const s = cur; if (!s || !db) return;
  const keys = seatKeys(s.def), n = Math.max(Date.now(), s.rsSeen + 1), kill = s.state ? s.state.__sid : null;
  const by = (nick || "").trim() || "cineva";
  s.resetBy = n; s.rsSeen = n; s.autoTried = true; s.reclaimTried = true;
  if (kill && !s.rsKill.includes(kill)) s.rsKill.push(kill);
  // 1) marcajul întâi, ca nimeni să nu se reașeze automat pe locurile golite
  await write("rs/" + s.id, () => db.doc("rs/" + s.id).set({ n, by, kill: kill || null, at: Date.now() }));
  // 2) partida + părțile private
  s.prevState = s.state; destroyView(s); s.state = null; s.endShown = null;
  s.parts = Object.fromEntries(keys.map(k => [k, null]));
  const bg = $("#big"); if (bg) bg.classList.remove("go");
  write("st/" + s.id, () => db.doc("st/" + s.id).set({ s: null }));
  keys.forEach(p => write("pt/" + s.id + "_" + p, () => db.doc("pt/" + s.id + "_" + p).set({ d: null })));
  // 3) locurile, sub lease (nu se amestecă cu o așezare în curs a altcuiva)
  s.seats = Object.assign(Object.fromEntries(keys.map(k => [k, null])), { __rs: n, __rsBy: by });
  renderHeader(); renderStage();
  await editSeats(s, ME, nd => { keys.forEach(k => { nd[k] = null; }); nd.__rs = n; nd.__rsBy = by; });
  SFX.whoosh();
  // o mutare/boț întârziat poate rescrie partida veche peste resetare: verificăm o dată
  setTimeout(async () => { if (cur !== s || !kill) return; try { const sn = await db.doc("st/" + s.id).get(); const d = sn.exists ? sn.data() : null;
    if (d && d.s && d.s.__sid === kill) write("st/" + s.id, () => db.doc("st/" + s.id).set({ s: null })); } catch (e) {} }, 1500);
}
async function askResetTable() {
  if (!cur || !db) return;
  const ok = await UI.confirm("Toate locurile se eliberează (oameni și boți), iar partida în curs se oprește pentru toți. Apoi fiecare își alege din nou locul.",
    "🔄 Resetează masa", "Renunț", { title: "Resetezi masa?", danger: true, cls: "g-reset-ask" });
  if (ok) resetTable();
}
async function maybeAutoSeat() {
  const s = cur; if (!s || !s.seats || !s.seatsLoaded || !s.rsLoaded) return; if (migrateLocalSeat(s)) return;
  if (s.seats.__rs) { s.autoTried = true; s.reclaimTried = true; return; } // masa tocmai a fost resetată: fiecare alege singur locul
  if (seatOf(s.seats, ME) && s.reclaimTried && s.reclaimed) { s.reclaimTried = false; s.reclaimed = false; } // reîntors pe loc: alt „bot în locul meu” ulterior se poate recupera din nou
  if (!seatOf(s.seats, ME) && !s.reclaimTried) { const k = Object.keys(s.seats).find(p => /^p[1-6]$/.test(p) && s.seats[p] && s.seats[p].bot && s.seats[p].was === ME && !s.seats[p].quit);
    if (k) s.reclaimed = true;
    if (k) { s.reclaimTried = true; const e = s.seats[k]; write("seats/" + s.id, () => db.doc("seats/" + s.id).set(Object.assign({}, s.seats, { [k]: { owner: ME, name: (nick || "").trim() || e.name, at: Date.now() } }))); return; } }
  if (s.autoTried) return;
  if (seatOf(s.seats, ME)) return;
  const free = seatKeys(s.def).find(p => !(s.seats[p] && s.seats[p].owner));
  if (!free) return;
  s.autoTried = true;
  await claimSeat("auto", false, true);
}
async function claimSeat(want, asBot, isAuto) {
  const s = cur; if (!s || !db) return;
  if (isMulti(s.def)) return claimSeatMulti(want, asBot, isAuto);
  const ref = db.doc("seats/" + s.id);
  const owner = asBot ? BOT_ID : ME, rs0 = s.rsSeen;
  await write("seats/" + s.id, async () => {
    let lease = await ref.acquire({ holder: ME, ttlMs: 2500 });
    for (let i = 0; i < 30 && !lease.acquired; i++) { await new Promise(r => setTimeout(r, 250 + Math.random() * 300)); lease = await ref.acquire({ holder: ME, ttlMs: 2500 }); }
    if (!lease.acquired) { toast("Locul nu s-a putut ocupa. Mai încearcă o dată."); return; }
    const snap = await ref.get(); const d = snap.exists ? snap.data() : {};
    if (asBot ? botSeatOf(d) : seatOf(d, ME)) { await freeLease(ref); return; }
    if (isAuto && (d.__rs || s.rsSeen !== rs0 || cur !== s)) { await freeLease(ref); return; } // masa a fost resetată între timp
    const free = p => !(d[p] && d[p].owner);
    const seat = want === "auto" || asBot || !free(want) ? ["p1", "p2"].find(free) : want; // locul cerut tocmai s-a ocupat → celălalt
    if (!seat) { await freeLease(ref); return; }
    const name = asBot ? "Bot" : ((nick || "").trim() || (seat === "p1" ? "Jucătorul 1" : "Jucătorul 2"));
    const nd = { p1: d.p1 || null, p2: d.p2 || null }; nd[seat] = { owner, name, at: Date.now() }; if (asBot) nd[seat].bot = true;
    await ref.set(nd);
    await freeLease(ref);
  });
  SFX.select();
}
/* ---- multi-seat (def.maxPlayers > 2) seat operations ---- */
function seatsCopy(def, d) { const nd = {}; seatKeys(def).forEach(k => { nd[k] = (d && d[k]) || null; }); return nd; }
// run fn(nd) on a fresh copy of the seats doc under a short lease; fn returns false to skip writing.
// Edits from one client are serialized (write queue) and always use the CLIENT id as lease holder, so quick
// successive edits (e.g. 3× „+ Bot”) re-acquire at once instead of waiting for each other's lease to expire.
// Contention with other clients is retried with backoff; optional check(d) verifies the edit really landed
// (read-back) and the whole edit is redone if another write overwrote it.
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
// după scriere lease-ul nu mai e necesar: îl eliberăm (release, sau un ttl de 1 ms dacă API-ul nu are release),
// ca alt dispozitiv (ex. „Resetează masa”, o așezare simultană) să nu aștepte 2,5 s degeaba
async function freeLease(ref) {
  try { if (ref.release) await ref.release({ holder: ME }); else await ref.acquire({ holder: ME, ttlMs: 1 }); } catch (e) {}
}
async function editSeats(s, holder, fn, check) {
  const ref = db.doc("seats/" + s.id);
  let done = false;
  await write("seats/" + s.id, async () => {
    for (let round = 0; round < 4 && !done; round++) {
      let lease = await ref.acquire({ holder: ME, ttlMs: 2500 });
      for (let i = 0; i < 40 && !lease.acquired; i++) { await sleepMs(Math.min(900, 120 + i * 60) + Math.random() * 200); lease = await ref.acquire({ holder: ME, ttlMs: 2500 }); }
      if (!lease.acquired) continue;
      const snap = await ref.get(); const raw = snap.exists ? snap.data() : {}; const nd = seatsCopy(s.def, raw);
      if (check && check(nd)) { done = true; break; }
      if (fn(nd, raw) === false) { await freeLease(ref); done = true; break; }
      s.seats = nd;
      await ref.set(nd);
      await freeLease(ref);
      if (!check) { done = true; break; }
      await sleepMs(60);
      const back = await ref.get(); if (check(seatsCopy(s.def, back.exists ? back.data() : {}))) done = true;
    }
    if (!done) { toast("Locurile nu s-au putut actualiza. Mai încearcă o dată."); SFX.error(); }
  });
  return done;
}
async function claimSeatMulti(want, asBot, isAuto) {
  const s = cur; if (!s || !db) return;
  const owner = asBot ? newBotOwner() : ME, rs0 = s.rsSeen;
  let ok = false;
  await editSeats(s, owner, (nd, raw) => {
    if (!asBot && seatOf(nd, ME)) return false;
    // o așezare automată rămasă „în zbor” nu are voie să aterizeze după „Resetează masa”
    if (isAuto && (raw.__rs || s.rsSeen !== rs0 || cur !== s)) return false;
    const keys = seatKeys(s.def), free = p => !(nd[p] && nd[p].owner);
    let seat = null;
    if (want === "auto") {
      // a running game: first fill a seat that is part of it, otherwise sit down for the next game
      const pl = s.state && !s.state.__end ? playersOf(s) : [];
      seat = pl.find(free) || keys.find(free);
    } else seat = keys.includes(want) && free(want) ? want : null;
    // a bot asked for a seat that was filled meanwhile (rapid clicks on the same „+ Bot”): take the next free seat
    if (!seat && !asBot && want !== "auto") seat = keys.find(free) || null; // locul ales tocmai a fost luat: altul liber
    if (!seat && asBot) { const pl = s.state && !s.state.__end ? playersOf(s) : []; seat = pl.find(free) || keys.find(free) || null; }
    if (!seat) return false;
    if (asBot) { const id = pickBotIdentity(nd); nd[seat] = { owner, name: id.name, at: Date.now(), bot: true, g: id.g }; }
    else nd[seat] = { owner, name: (nick || "").trim() || ("Jucătorul " + seat.slice(1)), at: Date.now() };
    ok = true;
  }, nd => asBot ? Object.values(nd).some(e => e && e.owner === owner) : (ok && !!seatOf(nd, ME)));
  if (ok) SFX.select();
}
async function setSeatMulti(seat, entry) { const s = cur; if (!s || !db) return; await editSeats(s, ME, nd => { if (!(seat in nd)) return false; nd[seat] = entry; }); }
// I take over a seat (human from another device, or a bot). Bots driven by the old human go to me.
async function takeSeatMulti(seat) {
  const s = cur; if (!s || !db) return;
  await editSeats(s, ME, nd => {
    const old = nd[seat]; if (!old || seatOf(nd, ME)) return false;
    nd[seat] = { owner: ME, name: (nick || "").trim() || (isBotSeat(old) ? "Jucătorul " + seat.slice(1) : old.name), at: Date.now() };
    if (!isBotSeat(old)) Object.keys(nd).forEach(k => { const e = nd[k]; if (e && e.bot && botDriver(e.owner) === old.owner) nd[k] = Object.assign({}, e, { owner: newBotOwner() }); });
  });
  SFX.select();
}
// a bot whose driving client is gone: I drive it from now on
async function adoptBot(seat) { const s = cur; if (!s || !db) return; await editSeats(s, ME, nd => { const e = nd[seat]; if (!e || !e.bot || isMyBot(e.owner)) return false; nd[seat] = Object.assign({}, e, { owner: newBotOwner() }); }); SFX.select(); }
// leaving a running multi game: a bot (driven by me) keeps playing my seat so the others are not blocked
async function botReplaceMe() {
  const s = cur; if (!s || !db) return;
  s.reclaimTried = true; // plecare voită: nu-mi iau înapoi locul automat (nici după reîncărcare: „quit”)
  await editSeats(s, ME, nd => { const me = seatOf(nd, ME); if (!me) return false; const g = Math.random() < .5 ? "m" : "f"; nd[me] = { owner: newBotOwner(), name: nd[me].name, at: Date.now(), bot: true, g, was: ME, quit: 1 }; });
}

async function removeSeat(owner) {
  const s = cur; if (!s || !db) return;
  if (isMulti(s.def)) return editSeats(s, ME, nd => { Object.keys(nd).forEach(p => { if (nd[p] && nd[p].owner === owner) nd[p] = null; }); });
  const ref = db.doc("seats/" + s.id);
  await write("seats/" + s.id, async () => { const snap = await ref.get(); const d = snap.exists ? snap.data() : {}; const nd = { p1: d.p1 || null, p2: d.p2 || null };
    ["p1", "p2"].forEach(p => { if (nd[p] && nd[p].owner === owner) nd[p] = null; }); await ref.set(nd); });
}
async function takeSeat(seat) {
  const s = cur; if (!s || !db) return;
  if (isMulti(s.def)) return takeSeatMulti(seat);
  const ref = db.doc("seats/" + s.id);
  await write("seats/" + s.id, async () => { const snap = await ref.get(); const d = snap.exists ? snap.data() : {};
    const nd = { p1: d.p1 || null, p2: d.p2 || null }; const old = nd[seat]; if (!old || isBotSeat(old) || seatOf(nd, ME)) return;
    nd[seat] = { owner: ME, name: (nick || "").trim() || old.name, at: Date.now() };
    const o = seat === "p1" ? "p2" : "p1"; if (nd[o] && nd[o].owner === "bot:" + old.owner) nd[o] = Object.assign({}, nd[o], { owner: BOT_ID });
    await ref.set(nd); });
  SFX.select();
}
async function leaveSeat() {
  const s = cur; if (!s) return;
  s.autoTried = true;
  if (isMulti(s.def) && s.state && !s.state.__end && mySeat(s)) {
    if (!(await UI.confirm("Pleci de la masă în timpul jocului? Un bot îți continuă locul, ca să nu se blocheze ceilalți.", "Plec", "Rămân"))) return;
    return botReplaceMe();
  }
  await removeSeat(ME);
}
function setupState(def, seats, players) {
  if (isMulti(def)) {
    const names = {}, info = {};
    players.forEach(k => { names[k] = nameOfSeat(seats, k); const e = seats[k] || {}; info[k] = { name: names[k], bot: !!e.bot, g: e.g || null }; });
    const c = { names, players: players.slice(), n: players.length, seatInfo: info, rng: Math.random, ui: UI };
    let st = {};
    try { st = def.setup ? (def.setup(c) || {}) : {}; } catch (e) { console.error(e); toast("Eroare la pornirea jocului."); return null; }
    st = clone(st); st.__sid = rid(); st.__rev = 1; st.__by = ME; st.__t = Date.now(); st.__pl = players.slice();
    return st;
  }
  const ctxS = { names: { p1: nameOfSeat(seats, "p1"), p2: nameOfSeat(seats, "p2") }, players: ["p1", "p2"], n: 2, rng: Math.random, ui: UI };
  let st = {};
  try { st = def.setup ? (def.setup(ctxS) || {}) : {}; } catch (e) { console.error(e); toast("Eroare la pornirea jocului."); return null; }
  st = clone(st); st.__sid = rid(); st.__rev = 1; st.__by = ME; st.__t = Date.now();
  return st;
}
// partida veche (dacă există) devine „moartă”: o scriere întârziată cu sid-ul ei nu mai poate reînvia jocul
function markNewGame(s, st) {
  const prev = s.state && s.state.__sid;
  st.__prev = prev || null;
  if (prev && !s.rsKill.includes(prev)) s.rsKill.push(prev);
  s.startedSid = st.__sid;
}
async function startGameMulti() {
  const s = cur; if (!s || !db) return;
  const def = s.def, keys = seatKeys(def), seats = s.seats || {};
  let occ = keys.filter(k => seats[k] && seats[k].owner).map(k => seats[k]);
  if (occ.length < minPlayers(def)) { toast(`Sunt necesari cel puțin ${minPlayers(def)} jucători. Adaugă un bot sau așteaptă pe cineva.`); SFX.error(); return; }
  const prev = s.state;
  // first game: random order; rematch: rotate by one (the old second player starts)
  if (prev && prev.__end && Array.isArray(prev.__pl) && occ.length > 1) occ = occ.slice(1).concat(occ.slice(0, 1));
  else occ = UI.shuffle(occ);
  const nd = {}; keys.forEach((k, i) => { nd[k] = occ[i] || null; });
  const players = keys.slice(0, occ.length);
  s.seats = nd;
  write("seats/" + s.id, () => db.doc("seats/" + s.id).set(nd));
  const st = setupState(def, nd, players); if (!st) return;
  markNewGame(s, st);
  SFX.start();
  keys.forEach(p => write("pt/" + s.id + "_" + p, () => db.doc("pt/" + s.id + "_" + p).set({ d: null })));
  s.parts = Object.fromEntries(keys.map(k => [k, null]));
  s.prevState = null; destroyView(s); s.state = st; s.endShown = null; s.lastChange = Date.now();
  write("st/" + s.id, () => db.doc("st/" + s.id).set({ s: st }));
  renderStage();
}
// back to the lobby (multi): clears the game so players can change seats/bots
function toLobby() {
  const s = cur; if (!s || !db) return;
  const keys = seatKeys(s.def);
  keys.forEach(p => write("pt/" + s.id + "_" + p, () => db.doc("pt/" + s.id + "_" + p).set({ d: null })));
  s.parts = Object.fromEntries(keys.map(k => [k, null]));
  s.prevState = s.state; destroyView(s); s.state = null; s.endShown = null; s.lastChange = Date.now();
  write("st/" + s.id, () => db.doc("st/" + s.id).set({ s: null }));
  renderStage();
}
async function startGame() {
  const s = cur; if (!s || !db) return;
  if (isMulti(s.def)) return startGameMulti();
  const seats = s.seats || {};
  // decide who sits in p1 (= who starts in most games)
  const prev = s.state, w = prev && prev.__end && prev.__end.winner;
  let swap;
  if (s.def.coop || !prev || !prev.__end) swap = Math.random() < .5;
  else if (w === "p1" || w === "p2") { const starter = WINNER_STARTS.has(s.id) ? w : (w === "p1" ? "p2" : "p1"); swap = starter !== "p1"; }
  else swap = true; // draw: alternate
  if (swap && seats.p1 && seats.p2) {
    const nd = { p1: seats.p2, p2: seats.p1 };
    s.seats = nd;
    write("seats/" + s.id, () => db.doc("seats/" + s.id).set(nd));
  }
  const st = setupState(s.def, s.seats); if (!st) return;
  markNewGame(s, st);
  SFX.start();
  ["p1", "p2"].forEach(p => write("pt/" + s.id + "_" + p, () => db.doc("pt/" + s.id + "_" + p).set({ d: null })));
  s.parts = { p1: null, p2: null };
  s.prevState = null; destroyView(s); s.state = st; s.endShown = null; s.lastChange = Date.now();
  write("st/" + s.id, () => db.doc("st/" + s.id).set({ s: st }));
  renderStage();
}
function commitAs(actor) {
  return function (ns, opts) {
    const s = cur; if (!s || !db) return;
    if (!ns || typeof ns !== "object" || Array.isArray(ns)) { console.error("commit refuzat: stare goală/invalidă", ns); return; } // nu scriem niciodată o stare goală
    opts = opts || {};
    const st = clone(ns);
    const old = s.state || {};
    st.__sid = old.__sid; st.__rev = (old.__rev || 0) + 1; st.__by = actor; st.__t = Date.now();
    if (old.__pl) st.__pl = old.__pl.slice(); else delete st.__pl;
    if (opts.winner) st.__end = { winner: opts.winner, at: Date.now() };
    s.prevState = s.state; s.state = st; s.lastChange = Date.now();
    // coalescing: dacă până la rândul acestei scrieri am comis deja o stare mai nouă, scriem doar pe aceea (nu o rafală de stări vechi)
    write("st/" + s.id, () => { const n = s.state; if (!opts.winner && n && n !== st && n.__sid === st.__sid && n.__by === actor && n.__rev > st.__rev) return null; return db.doc("st/" + s.id).set({ s: st }); });
    if (opts.winner) recordWin(s, opts.winner);
    renderStage();
  };
}
const commit = (st, opts) => commitAs(ME)(st, opts);
function recordWin(s, w) {
  let key;
  const seatWin = typeof w === "string" && ALLSEATS.includes(w);
  if (seatWin) key = nameOfSeat(s.seats, w);
  else if (w === "team") key = "Echipa voastră";
  else if (w === "lose") key = "Jocul (contra voastră)";
  else return;
  const ref = db.doc("scores/all");
  const g = (scores.g && scores.g[s.id]) || {};
  const tot = scores.total || {};
  const upd = { g: { [s.id]: { [key]: (g[key] || 0) + 1 } } };
  if (seatWin) upd.total = { [key]: (tot[key] || 0) + 1 };
  write("scores/all", async () => { const snap = await ref.get(); if (snap.exists) await ref.update(upd); else await ref.set(upd); });
  const dk = dayKey(), dref = db.doc("scores/day-" + dk), dd = scoreDays[dk] || {};
  const dg = (dd.g && dd.g[s.id]) || {}, dt = dd.total || {};
  const dupd = { day: dk, g: { [s.id]: { [key]: (dg[key] || 0) + 1 } } };
  if (seatWin) dupd.total = { [key]: (dt[key] || 0) + 1 };
  write("scores/day-" + dk, async () => { const snap = await dref.get(); if (snap.exists) await dref.update(dupd); else await dref.set(dupd); });
}
async function resetScores(what) {
  if (!db) return;
  if (what === "azi") {
    if (!(await UI.confirm("Ștergi clasamentul de azi?", "Șterge", "Renunț"))) return;
    const k = dayKey(); write("scores/day-" + k, () => db.doc("scores/day-" + k).set({ day: k, g: {}, total: {} }));
  } else {
    if (!(await UI.confirm("Ștergi tot clasamentul (general și pe zile)? Nu se poate anula.", "Șterge tot", "Renunț"))) return;
    write("scores/all", () => db.doc("scores/all").set({ g: {}, total: {}, resetAt: Date.now() }));
    Object.keys(scoreDays).forEach(k => write("scores/day-" + k, () => db.doc("scores/day-" + k).delete()));
  }
  SFX.select && SFX.select();
}
function setPartAs(seat) {
  return function (data) {
    const s = cur; if (!s || !db || !seat) return;
    s.parts[seat] = clone(data); s.lastChange = Date.now();
    write("pt/" + s.id + "_" + seat, () => db.doc("pt/" + s.id + "_" + seat).set({ d: clone(data) }));
    renderStage(true);
  };
}

/* ---------- bot driver ---------- */
function botTickMulti(s) {
  if (cur !== s || !s.mbots || !s.mbots.length || !s.state || s.state.__end) return;
  if (!s.botWait) s.botWait = window.__SALON_BOTFAST ? 30 : 650 + Math.random() * 800;
  if (Date.now() - s.lastChange < s.botWait) return;
  const bots = s.mbots, n = bots.length;
  for (let i = 0; i < n; i++) {
    const b = bots[(s.botRR + i) % n];
    let acted = false;
    try { acted = b.view ? (b.view.bot ? b.view.bot(b.ctx) : false) : (s.def.bot ? s.def.bot(b.ctx) : false); } catch (e) { console.error("bot", e); }
    if (cur !== s || !s.mbots) return;
    if (acted) { s.lastChange = Date.now(); s.botWait = 0; s.botRR = (s.botRR + i + 1) % n; return; }
  }
}
function botTick(s) {
  if (isMulti(s.def)) return botTickMulti(s);
  if (cur !== s || !s.botView || !s.botCtx || !s.state || s.state.__end) return;
  if (!s.botView.bot) return;
  const rtm = s.def.mode === "realtime";
  if (!rtm) {
    if (!s.botWait) s.botWait = 700 + Math.random() * 900;
    if (Date.now() - s.lastChange < s.botWait) return;
  }
  let acted = false;
  try { acted = s.botView.bot(s.botCtx); } catch (e) { console.error("bot", e); }
  if (!rtm && acted) { s.lastChange = Date.now(); s.botWait = 0; }
}

/* ---------- realtime (named room presence + local loopback for the bot) ---------- */
function rtDeliver(s, fromSeat, key, data) {
  for (const c of [s.ctx, s.botCtx]) {
    if (!c || !c.me || c.me === fromSeat) continue;
    const list = key === "st" ? c._st : c._in;
    list.forEach(f => { try { f(data, fromSeat); } catch (e) { console.error(e); } });
  }
}
async function joinRt(sess) {
  if (!room) return;
  try {
    const nr = await room.join("g-" + sess.id);
    if (cur !== sess) { nr.leave(); return; }
    sess.named = nr;
    nr.presence({ seat: seatOf(sess.seats, ME) || null, name: nick || "" });
    nr.onPeers(ch => {
      if (cur !== sess) return;
      for (const p of ch.peers) {
        if (p.sameTab) continue;
        const pr = p.presence || {};
        if (pr.st !== undefined && pr.st !== sess.lastSt) { sess.lastSt = pr.st; rtDeliver(sess, pr.seat || "p1", "st", pr.st); }
        if (pr.in !== undefined && pr.in !== sess.lastIn) { sess.lastIn = pr.in; rtDeliver(sess, pr.seat || "p2", "in", pr.in); }
      }
      renderHeader();
    });
  } catch (e) { console.warn("room join", e); }
}

/* ---------- context passed to games ---------- */
const NOOP = () => {};
const SILENT_SFX = new Proxy({}, { get: () => NOOP });
const SILENT_FX = new Proxy({ at: pt }, { get: (t, k) => k === "at" ? pt : NOOP });
const SILENT_UI = Object.assign({}, UI, {
  fly: () => Promise.resolve(), pop: NOOP, confirm: () => Promise.resolve(true),
  rollDice(container, values) { const els = values.map(v => { const tmp = document.createElement("div"); tmp.innerHTML = UI.dieHTML(v); const d = tmp.firstChild; container.appendChild(d); return d; }); return Promise.resolve(els); },
});
function fillNames(s, names) { const keys = isMulti(s.def) ? seatKeys(s.def) : ["p1", "p2"]; keys.forEach(k => { names[k] = nameOfSeat(s.seats, k); }); return names; }
// botSeat (multi only): the seat this bot ctx acts for
function makeCtx(s, root, asBot, botSeat) {
  const multi = isMulti(s.def);
  const actor = asBot ? (multi ? ((s.seats || {})[botSeat] || {}).owner || BOT_ID : BOT_ID) : ME;
  const me = asBot ? (multi ? botSeat : botSeatOf(s.seats)) : (multi ? mySeat(s) : seatOf(s.seats, ME));
  const names = fillNames(s, {});
  const peerCtx = () => asBot ? s.ctx : s.botCtx;
  const nextOf = seat => { const pl = playersOf(s); const i = pl.indexOf(seat); return i < 0 ? null : pl[(i + 1) % pl.length]; };
  const bm = { rev: null };
  const ctx = {
    root, def: s.def, isBot: !!asBot,
    me, spectator: !me,
    get other() { return me ? (multi ? nextOf(me) : (me === "p1" ? "p2" : "p1")) : null; },
    get players() { return playersOf(s); }, get n() { return playersOf(s).length; },
    seatInfo(seat) { const e = (s.seats || {})[seat]; return e ? { name: e.name, bot: !!e.bot, g: e.g || null } : null; },
    names, nameOf: seat => names[seat] || seat, myName: me ? names[me] : (nick || "Spectator"),
    get state() { return s.state; }, get prev() { return s.prevState; }, get parts() { return s.parts; },
    partOf(seat) { return (s.parts && s.parts[seat]) ?? null; },
    get myPart() { return me ? s.parts[me] : null; }, get theirPart() { const o = ctx.other; return o ? s.parts[o] : null; },
    get fresh() { return asBot ? (multi ? bm.rev === null : s.botMountedRev === null) : s.mountedRev === null; },
    _bm: bm,
    get ended() { return !!(s.state && s.state.__end); },
    get byMe() { return !!(s.state && s.state.__by === actor); },
    commit: commitAs(actor), setPart: setPartAs(me), restart: startGame, resetTable: askResetTable,
    // conexiunea: a mea (net) și a fiecărui loc (conn) — vezi briefs/DONE_R1_STABILITY.md
    net: () => netState(), conn: seat => connOf(s, seat), here: seat => humanHere(s, seat),
    connAll() { const o = {}; playersOf(s).forEach(k => { o[k] = connOf(s, k); }); return o; },
    sfx: asBot ? SILENT_SFX : SFX, fx: asBot ? SILENT_FX : FX, ui: asBot ? SILENT_UI : UI, toast: asBot ? NOOP : toast,
    status(text, tone) { if (asBot) return; const el = $("#gstatus"); if (el) { el.innerHTML = text; el.className = "g-status " + (tone || ""); } },
    color: seat => multi && ALLSEATS.includes(seat) ? `var(--${seat})` : (seat === "p1" ? "var(--p1)" : "var(--p2)"),
    on(target, type, fn, opt) { if (asBot && (target === document || target === window)) return; target.addEventListener(type, fn, opt); s.cleanups.push(() => target.removeEventListener(type, fn, opt)); },
    timeout(fn, ms) { const t = setTimeout(fn, ms); s.cleanups.push(() => clearTimeout(t)); return t; },
    interval(fn, ms) { const t = setInterval(fn, ms); s.cleanups.push(() => clearInterval(t)); return t; },
    raf(fn) { let id = 0, last = performance.now(), alive = true; const loop = now => { if (!alive) return; const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; try { fn(dt, now); } catch (e) { console.error(e); } id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); const stop = () => { alive = false; cancelAnimationFrame(id); }; s.cleanups.push(stop); return stop; },
    _st: [], _in: [],
    rt: {
      isHost: me === "p1",
      connected() { if (peerCtx()) return true; return !!(s.named && s.named.peers().some(p => !p.sameTab && p.presence && p.presence.seat && p.presence.seat !== me)); },
      send(obj) { const k = me === "p1" ? "st" : "in";
        if (peerCtx()) { rtDeliver(s, me, k, clone(obj)); return; }
        if (!asBot && s.named) s.named.presence({ [k]: obj, seat: me }).catch(() => {}); },
      onState(fn) { ctx._st.push(fn); },
      onInput(fn) { ctx._in.push(fn); },
      get available() { return !!room || !!peerCtx(); },
    },
    end(winner, stateExtra) { commitAs(actor)(Object.assign({}, s.state, stateExtra || {}), { winner }); },
  };
  return ctx;
}

/* ---------- rendering of the game screen ---------- */
function renderGameShell() {
  const s = cur; const def = s.def;
  $("#main").innerHTML = `
  <div class="game-top">
    <button class="g-btn ghost" id="backBtn" title="Înapoi în salon">← Salon</button>
    <div class="gt-title"><span class="gt-icon" aria-hidden="true">${def.icon || ""}</span><h2>${esc(def.name)}</h2></div>
    <div class="gt-actions">
      <button class="g-btn" id="rulesBtn">Reguli</button>
      <button class="g-btn ghost" id="newGameBtn" hidden title="Repornește partida cu aceiași jucători"><span aria-hidden="true">↻</span> Joc nou</button>
      <button class="g-btn ghost reset-btn" id="resetTableBtn" hidden title="Eliberează toate locurile și oprește partida pentru toți"><span aria-hidden="true">🔄</span> <span class="rt-long">Resetează masa</span><span class="rt-short">Resetează</span></button>
      <button class="g-btn ghost" id="forfeitBtn" hidden>Abandonează</button>
    </div>
  </div>
  <div class="players" id="players"></div>
  <div id="gstatus" class="g-status" aria-live="polite"></div>
  <div id="endbar"></div>
  <div id="stage" class="stage"></div>`;
  renderHeader();
}
function seatChipBtns(s, seat, ctxt) {
  // buttons on a seat (header chip or lobby card). ctxt: "lobby" | "game"
  const seats = s.seats || {}, d = seats[seat], mine = seatOf(seats, ME), inGameMe = mySeat(s);
  const b = [];
  if (!d) {
    if (!mine) b.push(`<button class="g-btn small" data-seat="${seat}">Ia locul</button>`);
    b.push(`<button class="g-btn small ghost" data-addbot="${seat}">+ Bot</button>`);
  } else if (d.owner === ME) {
    if (ctxt === "lobby") b.push(`<button class="g-btn small ghost" id="leaveSeat2">Eliberează</button>`);
  } else if (isBotSeat(d)) {
    if (ctxt === "lobby") b.push(`<button class="g-btn small ghost" data-rmbot="${seat}">Scoate botul</button>`);
    else if (!inGameMe) b.push(`<button class="g-btn small" data-take="${seat}">Ia locul</button>`);
    const drv = botDriver(d.owner);
    if (!isMyBot(d.owner) && drv && !isOnline(drv) && (ctxt === "lobby" ? !!mine : !!inGameMe || !!mine)) b.push(`<button class="g-btn small ghost" data-adopt="${seat}" title="Cel care conducea botul a plecat">Preia botul</button>`);
  } else if (ctxt === "game" ? !inGameMe : !mine) b.push(`<button class="g-btn small" data-take="${seat}">Ia locul</button>`);
  else if (mine && room && !inThisGame(d.owner) && graceLeft(s, d.owner) === 0) b.push(`<button class="g-btn small ghost" data-botfor="${seat}" title="${esc(d.name)} nu e în joc acum">🤖 Bot în locul lui/ei</button>`);
  return b.join("");
}
// butoanele „Joc nou” / „Resetează masa” din antet: oricine e la masă; spectatorii doar când jocul pare blocat
function tableLooksStuck(s) {
  if (!s.state) return false;
  if (!room) return true; // fără prezență nu putem ști cine e aici
  const seats = s.seats || {};
  const humans = ALLSEATS.filter(k => seats[k] && seats[k].owner && !seats[k].bot);
  const bots = ALLSEATS.filter(k => seats[k] && seats[k].bot);
  const botsAlive = bots.some(k => isMyBot(seats[k].owner) || isOnline(botDriver(seats[k].owner)));
  return !humans.some(k => seats[k].owner === ME || inThisGame(seats[k].owner)) && !(bots.length && botsAlive && !humans.length && !s.state.__end && Date.now() - s.lastChange < 30000);
}
function syncGameBtns(s, seated, inGame) {
  const st = s.state, stuck = !seated && tableLooksStuck(s);
  const fb = $("#forfeitBtn"); if (fb) fb.hidden = !(inGame && st && !st.__end);
  const ng = $("#newGameBtn"); if (ng) ng.hidden = !(st && ((seated && !st.__end) || stuck));
  const rb = $("#resetTableBtn"); if (rb) rb.hidden = !(st && (seated || stuck));
}
function renderHeaderMulti(s, el) {
  const seats = s.seats || {}, me = mySeat(s), mine = seatOf(seats, ME);
  const gsc = (today().g && today().g[s.id]) || {};
  const running = !!s.state;
  const pl = running ? playersOf(s) : seatKeys(s.def).filter(k => seats[k] && seats[k].owner);
  const chip = (seat, extra) => { const d = seats[seat];
    const isTurn = s.state && !s.state.__end && s.state.turn === seat;
    return `<div class="pl ${seat} multi ${isTurn ? "turn" : ""} ${me === seat ? "me" : ""}">
      <span class="pl-dot"></span>
      <span class="pl-name">${d ? esc(d.name) : "Loc liber"}${d && d.owner === ME ? ` <small>(tu)</small> <button class="rename ${nick ? "" : "need"}" data-rename="1" title="Schimbă numele">✎</button>` : ""}${isBotSeat(d) ? " <small>(bot)</small>" : ""}${extra || ""}</span>
      <span class="pl-score">${d ? (gsc[d.name] || 0) : ""}</span>
      ${running ? seatChipBtns(s, seat, "game") : ""}
    </div>`; };
  let h = pl.map(k => chip(k)).join("");
  if (running) {
    const waiting = seatKeys(s.def).filter(k => !pl.includes(k) && seats[k] && seats[k].owner);
    h += waiting.map(k => chip(k, ` <small>(la partida următoare)</small>`)).join("");
    const free = seatKeys(s.def).filter(k => !(seats[k] && seats[k].owner)).length;
    if (!mine && free) h += `<button class="g-btn small" id="joinNextBtn">Intră la masă</button>`;
  }
  if (mine && running) h += `<button class="link" id="leaveSeat">Eliberează locul</button>`;
  el.innerHTML = h;
  syncGameBtns(s, !!mine, !!me);
}
function renderHeader() {
  const s = cur; if (!s) return; const el = $("#players"); if (!el) return;
  if (isMulti(s.def)) return renderHeaderMulti(s, el);
  const seats = s.seats || {}; const me = seatOf(seats, ME); const bs = botSeatOf(seats);
  const gsc = (today().g && today().g[s.id]) || {};
  const online = s.named ? s.named.peers().filter(p => !p.sameTab) : [];
  const card = seat => { const d = seats[seat];
    const isTurn = s.state && !s.state.__end && (s.state.turn === seat);
    return `<div class="pl ${seat} ${isTurn ? "turn" : ""} ${me === seat ? "me" : ""}">
      <span class="pl-dot"></span>
      <span class="pl-name">${d ? esc(d.name) : "Loc liber"}${me === seat ? ` <small>(tu)</small> <button class="rename ${nick ? "" : "need"}" data-rename="1" title="Schimbă numele">✎</button>` : ""}${isBotSeat(d) ? " <small>(calculator)</small>" : ""}</span>
      <span class="pl-score">${d ? (gsc[d.name] || 0) : ""}</span>
      ${!d && !me ? `<button class="g-btn small" data-seat="${seat}">Ocupă</button>` : ""}
      ${d && !me && !isBotSeat(d) ? `<button class="g-btn small" data-take="${seat}">Ia locul</button>` : ""}
      ${d && me && me !== seat && !isBotSeat(d) && room && !inThisGame(d.owner) && graceLeft(s, d.owner) === 0 ? `<button class="g-btn small ghost" data-botfor="${seat}" title="${esc(d.name)} nu e în joc acum">🤖 Bot în locul lui/ei</button>` : ""}
      ${bs === seat ? `<button class="g-btn small ghost" id="removeBotBtn">Scoate botul</button>` : ""}
    </div>`; };
  el.innerHTML = card("p1") + `<span class="vs">vs</span>` + card("p2") +
    (me ? `<button class="link" id="leaveSeat">Eliberează locul</button>` : "") +
    (s.def.mode === "realtime" && !bs ? `<span class="net ${online.length ? "ok" : ""}">${online.length ? "conectat" : "aștept conexiunea"}</span>` : "");
  syncGameBtns(s, !!me, !!me);
}
function lobbyResetRow(occ) {
  return `<div class="lob-foot"><button class="link" id="rulesBtn2">Citește regulile</button>
    <button class="g-btn small ghost reset-btn" id="resetTableBtn2" ${occ ? "" : "disabled"} title="Locuri blocate? Golește toată masa și așezați-vă din nou"><span aria-hidden="true">🔄</span> Resetează masa</button></div>`;
}
function clearGameStatus() { const el = $("#gstatus"); if (el && el.innerHTML) { el.innerHTML = ""; el.className = "g-status"; } }
function renderLobbyMulti(s, stage) {
  destroyView(s); clearGameStatus();
  const def = s.def, seats = s.seats || {}, keys = seatKeys(def), mine = seatOf(seats, ME);
  const occ = keys.filter(k => seats[k] && seats[k].owner).length, min = minPlayers(def);
  const card = k => { const d = seats[k];
    return `<div class="lob-seat ${k} ${d ? "occ" : "free"} ${d && d.owner === ME ? "me" : ""}">
      <span class="lob-dot"></span>
      <span class="lob-name">${d ? esc(d.name) : "Loc liber"}</span>
      <span class="lob-sub">${d ? (d.owner === ME ? "tu" : isBotSeat(d) ? "bot" + (isMyBot(d.owner) ? " · al tău" : "") : "jucător") : "&nbsp;"}</span>
      <span class="lob-btns">${seatChipBtns(s, k, "lobby")}</span>
    </div>`; };
  const canStart = !!mine && occ >= min;
  stage.innerHTML = `<div class="pre lobby" id="lobby">
    <div class="pre-icon" aria-hidden="true">${def.icon || ""}</div>
    <h3>${esc(def.name)}</h3>
    <p class="muted">${esc(def.blurb || "")}</p>
    <p>Între <b>${min}</b> și <b>${keys.length}</b> jucători. Ocupă un loc, adaugă boți pe locurile goale, apoi apasă <b>Start</b>.</p>
    <div class="lob-seats">${keys.map(card).join("")}</div>
    <button class="g-btn primary big" id="startBtn" ${canStart ? "" : "disabled"}>Start${occ ? ` · ${occ} ${occ === 1 ? "jucător" : "jucători"}` : ""}</button>
    ${!mine ? `<p class="muted">Ocupă un loc ca să poți porni jocul.</p>` : occ < min ? `<p class="muted">Mai e nevoie de ${min - occ} ${min - occ === 1 ? "jucător" : "jucători"} (om sau bot).</p>` : ""}
    <p class="muted small-note">La Start, ordinea la masă se trage la sorți. La revanșă, ordinea se rotește cu un loc. Boții joacă de pe calculatorul celui care i-a adăugat.</p>
    ${lobbyResetRow(occ)}
  </div>`;
}
function mountMultiBots(s) {
  // one bot context (def.bot) or hidden view (view.bot) per bot seat driven by this client
  const want = myBotSeats(s);
  const key = want.map(k => k + "=" + s.seats[k].owner).join(",");
  if (key === s.mbotsKey && s.mbots) return;
  s.mbotsKey = key;
  s.mbots = want.map(seat => {
    if (s.def.bot) { const root = document.createElement("div"); const ctx = makeCtx(s, root, true, seat); ctx._bm.rev = -1; return { seat, ctx, root, view: null }; }
    const br = document.createElement("div"); br.className = "bot-root g-area"; br.setAttribute("aria-hidden", "true"); document.body.appendChild(br);
    const ctx = makeCtx(s, br, true, seat); let view = null;
    try { view = s.def.view(br, ctx) || {}; } catch (e) { console.error("bot view", e); }
    return { seat, ctx, root: br, view };
  });
}
function renderStageMulti(s, stage) {
  const seats = s.seats || {}, me = mySeat(s);
  if (!s.state) { renderLobbyMulti(s, stage); return; }
  if (s.def.mode === "realtime") { stage.innerHTML = `<div class="pre"><p>Jocurile în timp real nu suportă încă mai mult de doi jucători.</p></div>`; return; }
  // remount when my seat changed or the set of bots I drive changed
  const wantKey = myBotSeats(s).map(k => k + "=" + seats[k].owner).join(",");
  if ((s.view && me !== s.ctx.me) || (s.mbots && wantKey !== s.mbotsKey && !s.def.bot)) destroyView(s);
  if (!s.view) {
    stage.innerHTML = `<div class="g-area" id="garea"></div>`;
    const root = $("#garea");
    s.ctx = makeCtx(s, root, false);
    s.mountedRev = null;
    try { s.view = s.def.view(root, s.ctx) || {}; } catch (e) { console.error(e); stage.innerHTML = `<div class="pre"><p>Jocul a întâmpinat o eroare la pornire.</p><button class="g-btn primary" id="resetBrokenBtn">Pornește o partidă nouă</button></div>`; const rb = $("#resetBrokenBtn"); if (rb) rb.onclick = () => { const ss = cur; if (!ss) return; destroyView(ss); write("st/" + ss.id, () => db.doc("st/" + ss.id).set({ s: null })); }; return; }
  } else fillNames(s, s.ctx.names);
  if (wantKey !== s.mbotsKey || !s.mbots) {
    if (s.mbots && s.def.bot) { s.mbots = null; }
    mountMultiBots(s);
  }
  (s.mbots || []).forEach(b => { fillNames(s, b.ctx.names); if (b.view && b.view.render) { try { b.view.render(b.ctx); } catch (e) { console.error(e); } } b.ctx._bm.rev = s.state.__rev; });
  try { s.view.render && s.view.render(s.ctx); } catch (e) { console.error(e); }
  s.mountedRev = s.state.__rev;
  if (s.announced !== s.state.__sid) {
    s.announced = s.state.__sid;
    const t = s.state.turn;
    if (typeof t === "string" && ALLSEATS.includes(t) && !s.state.__end && Date.now() - (s.state.__t || 0) < 6000 && (s.state.__rev || 0) <= 2) FX.big(t === me ? "Tu începi" : nameOfSeat(seats, t) + " începe");
  }
  renderEnd();
}
function renderStage(partsOnly) {
  const s = cur; if (!s) return; const stage = $("#stage"); if (!stage) return;
  renderHeader();
  if (isMulti(s.def) && db && s.seats !== null && s.state !== undefined) { renderStageMulti(s, stage); return; }
  const seats = s.seats || {}; const me = seatOf(seats, ME);
  const both = seats.p1 && seats.p1.owner && seats.p2 && seats.p2.owner;
  const bs = botSeatOf(seats);
  if (!db) { stage.innerHTML = `<div class="pre"><p>Jocul online merge doar când pagina e deschisă în Claude.</p></div>`; return; }
  if (s.seats === null || s.state === undefined) { stage.innerHTML = `<div class="pre"><p class="muted">Se încarcă…</p></div>`; return; }
  if (s.def.mode === "realtime" && !room && !bs) { stage.innerHTML = `<div class="pre"><p>Jocurile în timp real au nevoie de conexiune live, iar aici nu e disponibilă. Poți juca totuși cu un bot.</p>${me ? `<button class="g-btn primary" id="addBotBtn">Joacă cu un bot</button>` : ""}</div>`; return; }
  if (!s.state) {
    destroyView(s); clearGameStatus();
    const starterNote = s.def.coop ? "" : `<p class="muted small-note">Cine începe se trage la sorți. La revanșă începe ${WINNER_STARTS.has(s.id) ? "cel care a câștigat (aici ordinea nu dă avantaj)" : "cel care a pierdut, ca să fie corect"}.</p>`;
    stage.innerHTML = `<div class="pre">
      <div class="pre-icon" aria-hidden="true">${s.def.icon || ""}</div>
      <h3>${esc(s.def.name)}</h3>
      <p class="muted">${esc(s.def.blurb || "")}</p>
      ${both ? `<p>${esc(seats.p1.name)} și ${esc(seats.p2.name)} sunt la masă.</p>
        ${me ? `<button class="g-btn primary big" id="startBtn">Începe jocul</button>` : `<p class="muted">Te uiți ca spectator. Dacă unul dintre locuri e al tău de pe alt dispozitiv, apasă „Ia locul” sus.</p>`}`
        : (me ? `<p>Aștepți al doilea jucător. Spune-i să deschidă salonul și să aleagă același joc.</p><p class="muted">Sau joacă acum ${s.def.coop ? "împreună cu" : "contra"} calculatorului:</p><button class="g-btn primary big" id="addBotBtn">Joacă cu un bot</button>`
              : `<p>Ocupă un loc ca să joci.</p>`)}
      ${starterNote}
      ${lobbyResetRow(["p1", "p2"].filter(k => seats[k] && seats[k].owner).length)}
    </div>`;
    return;
  }
  // state exists: mount views
  if (s.view && seatOf(seats, ME) !== s.ctx.me) { destroyView(s); }
  if (s.botView && botSeatOf(seats) !== s.botCtx.me) { destroyView(s); }
  if (!s.view) {
    stage.innerHTML = `<div class="g-area" id="garea"></div>`;
    const root = $("#garea");
    s.ctx = makeCtx(s, root, false);
    s.mountedRev = null;
    try { s.view = s.def.view(root, s.ctx) || {}; } catch (e) { console.error(e); stage.innerHTML = `<div class="pre"><p>Jocul a întâmpinat o eroare la pornire.</p><button class="g-btn primary" id="resetBrokenBtn">Pornește o partidă nouă</button></div>`; const rb = $("#resetBrokenBtn"); if (rb) rb.onclick = () => { const ss = cur; if (!ss) return; destroyView(ss); write("st/" + ss.id, () => db.doc("st/" + ss.id).set({ s: null })); }; return; }
  } else { s.ctx.names.p1 = nameOfSeat(seats, "p1"); s.ctx.names.p2 = nameOfSeat(seats, "p2"); }
  if (bs && !s.botView) {
    const br = document.createElement("div"); br.className = "bot-root g-area"; br.setAttribute("aria-hidden", "true");
    document.body.appendChild(br); s.botRoot = br;
    s.botCtx = makeCtx(s, br, true); s.botMountedRev = null;
    try { s.botView = s.def.view(br, s.botCtx) || {}; } catch (e) { console.error("bot view", e); s.botView = null; }
  }
  if (s.botView) { s.botCtx.names.p1 = nameOfSeat(seats, "p1"); s.botCtx.names.p2 = nameOfSeat(seats, "p2"); try { s.botView.render && s.botView.render(s.botCtx); } catch (e) { console.error(e); } s.botMountedRev = s.state.__rev; }
  try { s.view.render && s.view.render(s.ctx); } catch (e) { console.error(e); }
  s.mountedRev = s.state.__rev;
  if (s.announced !== s.state.__sid) {
    s.announced = s.state.__sid;
    const t = s.state.turn;
    if (!s.def.coop && (t === "p1" || t === "p2") && !s.state.__end && Date.now() - (s.state.__t || 0) < 6000 && (s.state.__rev || 0) <= 2) {
      FX.big(t === me ? "Tu începi" : nameOfSeat(seats, t) + " începe");
    }
  }
  renderEnd();
}
function renderEnd() {
  const s = cur; const bar = $("#endbar"); if (!bar) return;
  const st = s.state; const me = seatOf(s.seats, ME);
  if (!st || !st.__end) { bar.innerHTML = ""; return; }
  const w = st.__end.winner;
  let text, tone;
  if (w === "draw") { text = "Remiză!"; tone = ""; }
  else if (w === "team") { text = "Ați câștigat împreună!"; tone = "win"; }
  else if (w === "lose") { text = "Jocul v-a învins de data asta"; tone = "lose"; }
  else { text = w === me ? "Ai câștigat!" : esc(nameOfSeat(s.seats, w)) + " a câștigat"; tone = w === me ? "win" : "lose"; }
  bar.innerHTML = `<div class="endbar ${tone}"><span class="eb-t">${text}</span><span class="g-row">${me ? `<button class="g-btn primary" id="rematchBtn">Revanșă</button>` : ""}${me && isMulti(s.def) ? `<button class="g-btn" id="lobbyBtn">Schimbă jucătorii</button>` : ""}<button class="g-btn ghost" id="backBtn2">Alt joc</button></span></div>`;
  if (s.endShown !== st.__sid) {
    s.endShown = st.__sid;
    const fresh = Date.now() - (st.__end.at || 0) < 8000;
    if (fresh) {
      if (tone === "win") { SFX.win(); FX.big("Victorie!", "flare"); FX.confetti(); FX.fireworks(8); }
      else if (tone === "lose") { SFX.lose(); FX.big(w === "lose" ? "Ați pierdut" : "Înfrângere", "muted"); }
      else { SFX.chime(); FX.big("Remiză"); }
    }
  }
}

/* ======================= LOBBY PRESENCE ======================= */
let hidAt = (typeof document !== "undefined" && document.hidden) ? Date.now() : 0, presNet = "ok";
function lobbyPresence() { presNet = netState().st; if (room) room.presence({ name: nick || "", game: cur ? cur.id : null, id: ME, net: presNet, hid: hidAt || null }).catch(() => {}); }
function inThisGame(id) { return !!cur && peers.some(p => p.presence && p.presence.id === id && p.presence.game === cur.id && !p.sameTab); }
/* conexiunea celorlalți (din prezență) + perioada de grație de 3 min înainte să le poată lua cineva locul cu un bot */
const GRACE_MS = +window.__SALON_GRACE_MS || 180000, HIDE_MS = +window.__SALON_HIDE_MS || 300000, seenAt = {}; // (testele pot scurta duratele)
function noteSeen() { if (!cur) return; const now = Date.now(); peers.forEach(p => { const pr = p.presence; if (pr && pr.id && pr.game === cur.id && !p.sameTab) seenAt[pr.id] = now; }); }
function awayMs(s, id) { if (!id || id === ME || inThisGame(id)) return 0; return Date.now() - Math.max(seenAt[id] || 0, s.enterAt || 0); }
function graceLeft(s, id) { if (!s.state || s.state.__end || !room) return 0; const a = awayMs(s, id); return a > 0 ? Math.max(0, GRACE_MS - a) : GRACE_MS; }
function connOf(s, seat) {
  const e = (s.seats || {})[seat];
  if (!e || !e.owner) return { st: "off", away: 0, grace: 0, bot: false, me: false };
  if (e.bot) return { st: "bot", away: 0, grace: 0, bot: true, me: false };
  if (e.owner === ME) { const n = netState(); return { st: n.st, away: 0, grace: 0, bot: false, me: true }; }
  if (!room) return { st: "ok", away: 0, grace: 0, bot: false, me: false };
  const p = peers.find(q => q.presence && q.presence.id === e.owner && q.presence.game === s.id && !q.sameTab);
  if (!p) { const a = awayMs(s, e.owner); return { st: "off", away: a, grace: Math.max(0, GRACE_MS - a), bot: false, me: false }; }
  const pr = p.presence;
  return { st: pr.net === "off" || pr.net === "slow" ? "slow" : "ok", away: 0, grace: 0, bot: false, me: false, hidden: pr.hid ? Date.now() - pr.hid : 0 };
}
// un om e „aici” dacă pagina lui e în joc și nu stă ascunsă (alt tab / ecran stins) de peste 5 minute
function connTick(s) {
  if (cur !== s) return;
  noteSeen();
  const n = netState();
  if (n.st !== presNet) lobbyPresence();
  // după un eșec nu mai scrie nimeni (gazda tace cât e „off”) → sondez singur baza ca să aflu când a revenit rețeaua
  if (db && NET.failAt > NET.okAt && !NET.probe) { NET.probe = 1; const t0 = Date.now();
    db.doc("seats/" + s.id).get().then(() => { NET.okAt = Date.now(); NET.lag = Date.now() - t0; }, () => { NET.failAt = Date.now(); }).then(() => { NET.probe = 0; }); }
  if (s.state && !s.state.__end) { const k = Object.keys(s.seats || {}).filter(p => /^p[1-6]$/.test(p) && s.seats[p] && !s.seats[p].bot && graceLeft(s, s.seats[p].owner) === 0).join(",");
    if (k !== s.connKey) { s.connKey = k; renderHeader(); } }
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { hidAt = document.hidden ? Date.now() : 0; lobbyPresence(); });
if (typeof window !== "undefined") { window.addEventListener("online", () => lobbyPresence()); window.addEventListener("offline", () => lobbyPresence()); }
function humanHere(s, seat) { const c = connOf(s, seat); if (c.bot) return false; if (c.me) return !hidAt || Date.now() - hidAt < HIDE_MS; return c.st !== "off" && !(c.hidden > HIDE_MS); }
function isOnline(id) { return peers.some(p => p.presence && p.presence.id === id && !p.sameTab); }

/* ======================= EVENTS ======================= */
function onHash() {
  const id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if (id && S.byId[id]) { if (!cur || cur.id !== id) enterGame(id); }
  else { leaveGame(); renderHome(); }
  window.scrollTo(0, 0);
}
function bindGlobal() {
  document.addEventListener("click", async e => {
    const go = e.target.closest(".game-card[data-go], .on-row [data-go]");
    if (go) { SFX.select(); location.hash = go.dataset.go; return; }
    const cat = e.target.closest(".chip-btn[data-cat]");
    if (cat) { homeFilter = cat.dataset.cat; SFX.tick(); updateHome(); return; }
    const sct = e.target.closest("[data-sctab]");
    if (sct) { scoreTab = sct.dataset.sctab; store.set("salon-scoretab", scoreTab); SFX.tick(); updateHome(); return; }
    if (e.target.closest("[data-rename]")) { const n = await UI.askName(nick); if (n) { setNick(n); saveNickDb(); const ni = $("#nickInput"); if (ni) ni.value = n; if (cur) syncSeatName(cur); lobbyPresence(); } return; }
    const bf = e.target.closest("[data-botfor]");
    if (bf && cur && db) { const ss = cur, seat = bf.dataset.botfor, d = (ss.seats || {})[seat]; if (!d || isBotSeat(d)) return;
      const gl = graceLeft(ss, d.owner); if (gl > 0) { toast(`${d.name} poate reveni încă ${Math.ceil(gl / 60000)} min. Locul rămâne al ei/lui până atunci.`); renderHeader(); return; }
      if (!(await UI.confirm(`${d.name} nu e în joc acum. Pui un bot să joace în locul ei/lui? Când revine în joc, își ia locul înapoi automat.`, "Pune botul", "Renunț"))) return;
      const multi = isMulti(ss.def), g = Math.random() < .5 ? "m" : "f";
      const entry = { owner: multi ? newBotOwner() : BOT_ID, name: d.name, at: Date.now(), bot: true, was: d.owner }; if (multi) entry.g = g;
      if (!multi && botSeatOf(ss.seats)) return;
      write("seats/" + ss.id, () => db.doc("seats/" + ss.id).update({ [seat]: entry })); SFX.select(); return; }
    if (e.target.closest("#resetToday")) { resetScores("azi"); return; }
    if (e.target.closest("#resetAll")) { resetScores("tot"); return; }
    const t = e.target.closest("button, a, input");
    if (!t) { if (e.target.id === "modal") closeModal(); return; }
    const id = t.closest("#garea") ? "" : t.id;
    if (id === "backBtn" || id === "backBtn2") { location.hash = ""; return; }
    if (id === "rulesBtn" || id === "rulesBtn2") { if (cur) openRules(cur.def); return; }
    if (id === "modalClose") { closeModal(); return; }
    if (id === "startBtn") { startGame(); return; }
    if (id === "rematchBtn") { startGame(); return; }
    if (cur && (id === "leaveSeat" || id === "leaveSeat2" || id === "forfeitBtn")) cur.reclaimTried = true;
    if (id === "leaveSeat") { leaveSeat(); return; }
    if (id === "addBotBtn") { claimSeat("auto", true); return; }
    if (id === "removeBotBtn") { if (await UI.confirm("Scoți botul de la masă?", "Scoate", "Rămâne")) removeSeat(BOT_ID); return; }
    if (id === "lobbyBtn") { toLobby(); return; }
    if (id === "joinNextBtn") { claimSeat("auto"); return; }
    if (id === "leaveSeat2") { removeSeat(ME); if (cur) cur.autoTried = true; return; }
    if (t.dataset && t.dataset.addbot && cur && !t.closest("#garea")) { claimSeat(t.dataset.addbot, true); return; }
    if (t.dataset && t.dataset.rmbot && cur && !t.closest("#garea")) { const d = (cur.seats || {})[t.dataset.rmbot]; if (d && d.bot) removeSeat(d.owner); return; }
    if (t.dataset && t.dataset.adopt && cur && !t.closest("#garea")) { adoptBot(t.dataset.adopt); return; }
    if (t.dataset && t.dataset.seat && cur && isMulti(cur.def) && t.closest("#players, #lobby")) { claimSeat(t.dataset.seat); return; }
    if ((id === "resetTableBtn" || id === "resetTableBtn2") && cur) { askResetTable(); return; }
    if (id === "newGameBtn" && cur && cur.state) {
      const ss = cur, sts = ss.seats || {}, mine = seatOf(sts, ME);
      const occ = seatKeys(ss.def).filter(k => sts[k] && sts[k].owner).length;
      const direct = !!mine && occ >= minPlayers(ss.def);
      // a treia variantă, „Resetează masa”, e aici și pentru jocurile pe tot ecranul al căror meniu apasă „Joc nou”
      const ch = await UI.choice(direct ? "Repornești jocul de la zero, cu aceiași jucători? Partida de acum se oprește fără câștigător." : "Oprești partida? Ce s-a jucat până acum se pierde (fără câștigător), iar masa rămâne cum e.",
        [["no", "Continuăm", ""], ["reset", "🔄 Resetează masa", "reset-btn ghost"], ["yes", direct ? "↻ Joc nou" : "Oprește partida", "primary"]],
        { title: "Joc nou?", note: "Locuri blocate sau cineva a plecat? „Resetează masa” eliberează toate locurile, pentru toți." });
      if (ch === "reset") { askResetTable(); return; }
      if (ch !== "yes" || cur !== ss || !ss.state) return;
      if (direct) { startGame(); return; }
      if (isMulti(ss.def)) { toLobby(); return; }
      destroyView(ss); ss.state = null; write("st/" + ss.id, () => db.doc("st/" + ss.id).set({ s: null })); renderStage(); return; }
    if (id === "forfeitBtn" && cur && isMulti(cur.def)) { if (!cur.state || cur.state.__end) return; const me = mySeat(cur); if (!me) return;
      if (!(await UI.confirm("Sigur abandonezi partida? Un bot îți continuă locul ca ceilalți să poată termina jocul.", "Abandonez", "Continui"))) return;
      if (cur.def.forfeit) { let r = null; try { r = cur.def.forfeit(cur.state, me, cur.ctx); } catch (e) { console.error(e); }
        if (r && r.state) { commit(r.state, r.winner ? { winner: r.winner } : undefined); if (r.winner) return; } }
      botReplaceMe(); return; }
    if (id === "forfeitBtn") { if (!cur || !cur.state) return; const me = seatOf(cur.seats, ME); if (!me) return;
      if (await UI.confirm("Sigur abandonezi partida?", "Abandonez", "Continui")) commit(cur.state, { winner: cur.def.coop ? "lose" : (me === "p1" ? "p2" : "p1") }); return; }
    if (t.dataset && t.dataset.seat && cur && t.closest("#players")) { claimSeat(t.dataset.seat); return; }
    if (t.dataset && t.dataset.take && cur) { const sd = (cur.seats || {})[t.dataset.take];
      const on = sd && isOnline(sd.owner);
      if (await UI.confirm(on ? `${sd.name} pare să fie online acum. Sigur îi iei locul?` : `Iei locul lui ${sd ? sd.name : "jucător"}? (de exemplu, dacă ești tot tu, de pe alt dispozitiv)`, "Iau locul", "Renunț")) takeSeat(t.dataset.take); return; }
    if (id === "sndBtn") { soundOn = !soundOn; store.set("salon-sound", soundOn ? "on" : "off"); audio(); if (sfxBus) sfxBus.gain.value = soundOn ? 1 : 0; syncAudioBtns(); if (soundOn) SFX.ping(); return; }
    if (id === "musBtn") { musicOn = !musicOn; store.set("salon-music", musicOn ? "on" : "off"); audio();
      if (musicBus) musicBus.gain.value = musicOn ? musicVol * .5 : 0;
      if (musicOn) { const w = Music.want; Music.stop(true); Music.start(w || "jazz"); } else Music.stop(true); syncAudioBtns(); return; }
  });
  document.addEventListener("change", e => {
    if (e.target.id === "testMode") { store.set("salon-test", e.target.checked ? "1" : "0"); toast("Reîncarcă pagina ca să se aplice modul test."); }
    if (e.target.id === "musVol") { musicVol = parseFloat(e.target.value); store.set("salon-musicvol", String(musicVol)); if (musicBus && musicOn) musicBus.gain.value = musicVol * .5; }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeModal(); }
    if ((e.key === "?" ) && cur && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) openRules(cur.def);
  });
  addEventListener("hashchange", onHash);
  addEventListener("resize", sizeFx);
}
function syncAudioBtns() {
  const sb = $("#sndBtn"), mb = $("#musBtn");
  if (sb) { sb.setAttribute("aria-pressed", soundOn); sb.querySelector("span").textContent = soundOn ? "Sunete" : "Fără sunete"; }
  if (mb) { mb.setAttribute("aria-pressed", musicOn); mb.querySelector("span").textContent = musicOn ? "Muzică" : "Fără muzică"; }
  const mv = $("#musVol"); if (mv) mv.value = musicVol;
}

/* ======================= BOOT ======================= */
S.boot = async function () {
  cv = $("#fx"); g2 = cv && cv.getContext ? cv.getContext("2d") : null; sizeFx();
  bindGlobal(); syncAudioBtns();
  onHash();
  let d = null, r = null;
  try { d = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch (e) { d = null; }
  try { r = window.claude && window.claude.use ? await window.claude.use("room") : null; } catch (e) { r = null; }
  if (!window.__SALON_ME && !testMode) {
    // NU folosim contul Claude ca identitate: doi oameni pot juca de pe același cont, pe telefoane diferite.
  }
  db = d; room = r;
  if (db && !window.__SALON_NICK) {
    try { const ns = await db.doc("nicks/" + ME).get(); const n = ns.exists ? String(ns.data().n || "").slice(0, 16) : "";
      if (n && !nick) { nick = n; store.set("salon-nick", n); const ni = $("#nickInput"); if (ni && !ni.value) ni.value = n; }
      else if (nick && n !== nick) saveNickDb(); } catch (e) {}
  }
  if (db) {
    db.collection("seats").onSnapshot(snap => { const m = {}; for (const doc of snap.docs) m[doc.id] = doc.data(); seatsAll = m; if (!cur) renderHome(); }, () => {});
    db.collection("scores").onSnapshot(snap => { const days = {}; let all = {}; for (const doc of snap.docs) { if (doc.id === "all") all = doc.data() || {}; else if (doc.id.startsWith("day-")) days[doc.id.slice(4)] = doc.data() || {}; } scores = all; scoreDays = days; if (!cur) renderHome(); else renderHeader(); }, () => {});
  }
  if (room) {
    lobbyPresence();
    room.onPeers(ch => { noteSeen(); peers = ch.peers.slice(); noteSeen(); if (!cur) renderHome(); else if (isMulti(cur.def)) { if (cur.state) renderHeader(); else if (cur.state === null) renderStage(); } else renderHeader(); });
  }
  if (cur) { const id = cur.id; cur = null; enterGame(id); } else renderHome();
};
S._internal = { makeCtx, STY };
S._bot = function () {
  if (!cur || !cur.view || !cur.ctx) return 'nobot';
  const fn = cur.view.bot ? () => cur.view.bot(cur.ctx) : (isMulti(cur.def) && cur.def.bot ? () => cur.def.bot(cur.ctx) : null);
  if (!fn) return 'nobot';
  try { return fn(); } catch (e) { console.error('bot error', e); return 'error'; } };
S._info = function () { return cur ? { me: isMulti(cur.def) ? mySeat(cur) : seatOf(cur.seats, ME), seat: seatOf(cur.seats, ME), ended: !!(cur.state && cur.state.__end), hasState: !!cur.state, rev: cur.state ? cur.state.__rev : 0,
  players: cur.state ? playersOf(cur) : null, myBots: isMulti(cur.def) ? (cur.mbots || []).map(b => b.seat) : null } : null; };
})();
