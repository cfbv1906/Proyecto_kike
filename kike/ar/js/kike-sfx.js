// KIKE — efectos de sonido sintetizados con Web Audio (sin archivos).
// playSfx('encontrado' | 'abrir' | 'cerrar' | 'modelo' | 'pausa')
let ctx = null, master = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Cuerda pulsada (guitarra/charango): ruido filtrado + sinusoide con caída rápida
function pluck(c, out, f, t, peak = 0.3, d = 0.7) {
  const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f;
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
}

// Golpe de cajón: bombo corto + palmada de ruido
function cajon(c, out, t, peak = 0.7) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
  const len = Math.floor(c.sampleRate * 0.08), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
  const ng = c.createGain(); ng.gain.value = peak * 0.35;
  s.connect(bp).connect(ng).connect(out); s.start(t);
}

const SFX = {
  // Al detectar el afiche: rasgueo ascendente
  encontrado(c, o) { const t = c.currentTime + 0.01; [196, 246.9, 329.6, 392, 523.3].forEach((f, i) => pluck(c, o, f, t + i * 0.045, 0.22, 0.9)); },
  abrir(c, o) { const t = c.currentTime + 0.01; pluck(c, o, 523.3, t, 0.26, 0.5); pluck(c, o, 784, t + 0.08, 0.2, 0.6); },
  cerrar(c, o) { const t = c.currentTime + 0.01; pluck(c, o, 392, t, 0.22, 0.35); pluck(c, o, 261.6, t + 0.07, 0.2, 0.45); },
  pausa(c, o) { const t = c.currentTime + 0.01; cajon(c, o, t, 0.45); },
  modelo(c, o) { const t = c.currentTime + 0.01; cajon(c, o, t); pluck(c, o, 659.3, t + 0.12, 0.18, 0.5); }
};

export function playSfx(name) {
  try { const c = ensure(); if (c && SFX[name]) SFX[name](c, master); } catch (e) { console.warn('sfx', e); }
}
