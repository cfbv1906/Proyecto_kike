// KIKE · Filtro facial — interfaz, sonidos UX y foto.
// El script de la máscara (en app.json) avisa con window.kikeFiltro.onVariant(i).
import { startFaceFilter } from "./mediapipe/mediapipe_controller.js";

const VARIANTES = [
  { nombre: "KIKE ROJO", gesto: "Inicio" },
  { nombre: "ESTRELLAS", gesto: "Cejas arriba" },
  { nombre: "KIKE NEGRO", gesto: "Boca abierta" },
  { nombre: "ANDINO", gesto: "Sonrisa" },
];

// ---------- Sonidos UX (Web Audio, sin archivos) ----------
let ctx = null, master = null;
function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function pluck(c, out, f, t, peak = 0.3, d = 0.7, type = "triangle") {
  const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
  o.type = type; o.frequency.value = f;
  lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
}
function cajon(c, out, t, peak = 0.7) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
  const len = Math.floor(c.sampleRate * 0.08), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.9;
  const ng = c.createGain(); ng.gain.value = peak * 0.35;
  s.connect(bp).connect(ng).connect(out); s.start(t);
}
const SFX = {
  // 0 · cara encontrada / KIKE base: rasgueo ascendente
  v0(c, o) { const t = c.currentTime + 0.01; [196, 246.9, 329.6, 392, 523.3].forEach((f, i) => pluck(c, o, f, t + i * 0.045, 0.2, 0.9)); },
  // 1 · cejas: destellos agudos que suben (estrellas)
  v1(c, o) { const t = c.currentTime + 0.01; [880, 1174.7, 1568, 2093].forEach((f, i) => pluck(c, o, f, t + i * 0.06, 0.16, 0.5, "sine")); },
  // 2 · boca: golpe de cajón + nota grave
  v2(c, o) { const t = c.currentTime + 0.01; cajon(c, o, t, 0.75); pluck(c, o, 196, t + 0.1, 0.22, 0.45); },
  // 3 · sonrisa: arpegio pentatónico de charango
  v3(c, o) { const t = c.currentTime + 0.01; [523.3, 587.3, 659.3, 784, 880, 1046.5].forEach((f, i) => pluck(c, o, f, t + i * 0.05, 0.17, 0.55)); },
  foto(c, o) { const t = c.currentTime + 0.01; cajon(c, o, t, 0.35); pluck(c, o, 1318.5, t + 0.05, 0.14, 0.3, "sine"); },
  ui(c, o) { const t = c.currentTime + 0.01; pluck(c, o, 659.3, t, 0.16, 0.25); },
};
function playSfx(n) { try { const c = ensure(); if (c && SFX[n]) SFX[n](c, master); } catch (e) { console.warn("sfx", e); } }

// ---------- Interfaz ----------
const $ = (s) => document.querySelector(s);
const chips = $("#chips");
VARIANTES.forEach((v, i) => {
  const b = document.createElement("button");
  b.className = "chip" + (i === 0 ? " on" : "");
  b.dataset.i = i;
  b.innerHTML = `<b>${v.nombre}</b><small>${v.gesto}</small>`;
  b.addEventListener("click", () => window.kikeSetVariant && window.kikeSetVariant(i));
  chips.appendChild(b);
});

let actual = 0, hintTimer = null;
function marcar(i) {
  chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", +c.dataset.i === i));
  const n = $("#nombre"); n.textContent = VARIANTES[i].nombre;
  n.classList.remove("pop"); void n.offsetWidth; n.classList.add("pop");
  const f = $("#flash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
}
window.kikeFiltro = {
  onVariant(i) { actual = i; marcar(i); playSfx("v" + i); $("#hint").classList.add("off"); },
  onFound() { $("#buscando").classList.add("off"); },
};

// ---------- Foto ----------
function cover(sw, sh, dw, dh) {
  const s = Math.max(dw / sw, dh / sh), w = sw * s, h = sh * s;
  return [(dw - w) / 2, (dh - h) / 2, w, h];
}
function tomarFoto() {
  const ff = window.faceFilter; if (!ff) return;
  const app = $("#app"), W = app.clientWidth, H = app.clientHeight, k = 2;
  const out = document.createElement("canvas"); out.width = W * k; out.height = H * k;
  const g = out.getContext("2d");
  g.save(); g.scale(k, k);
  const v = ff.webCamera.video || $("#video-renderer");
  const [x, y, w, h] = cover(v.videoWidth, v.videoHeight, W, H);
  g.translate(W, 0); g.scale(-1, 1); // todo se ve en espejo, como en pantalla
  g.drawImage(v, x, y, w, h);
  const r = ff.player.renderer;
  r.render(ff.player.mainScene, ff.player.camera);
  g.drawImage(r.domElement, 0, 0, W, H);
  g.restore();
  g.fillStyle = "rgba(182,39,29,.92)"; g.fillRect(0, out.height - 74 * k / 1.4, out.width, 74 * k / 1.4);
  g.fillStyle = "#F2E1BF"; g.font = `${22 * k}px Anton, Impact, sans-serif`; g.textAlign = "center";
  g.fillText("KIKE · PERÚ CRUZA FRONTERAS", out.width / 2, out.height - 20 * k);
  playSfx("foto");
  $("#flash").classList.remove("go"); void $("#flash").offsetWidth; $("#flash").classList.add("go");
  out.toBlob(async (blob) => {
    const file = new File([blob], "kike-filtro.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "KIKE" }); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kike-filtro.png"; a.click();
  }, "image/png");
}
$("#foto").addEventListener("click", tomarFoto);

// ---------- Arranque (gesto del usuario: cámara + audio) ----------
$("#iniciar").addEventListener("click", async () => {
  playSfx("ui");
  $("#inicio").classList.add("off");
  $("#cargando").classList.remove("off");
  try {
    await startFaceFilter("app.json", { showGui: false });
    $("#cargando").classList.add("off");
    $("#ui").classList.remove("off");
    hintTimer = setTimeout(() => $("#hint").classList.add("off"), 9000);
  } catch (e) {
    console.error(e);
    $("#cargando").classList.add("off");
    $("#error").classList.remove("off");
  }
});
