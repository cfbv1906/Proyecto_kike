// KIKE — botones de canciones + diálogos sobre la realidad aumentada.
// Aparecen cuando MindAR detecta el afiche y se ocultan cuando se pierde.
import { playSfx } from './kike-sfx.js';
import { CANCIONES, ENLACES } from './kike-config.js';

const HIDE_DELAY = 1500;     // tolera pérdidas breves del tracking
let ui, dialog, btns, current = null, hideTimer = null, tick = null, toastEl, toastT;
const audios = new Map();
let wasPlaying = false;

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

function audioFor(c) {
  if (!audios.has(c.id)) {
    const a = new Audio(); a.preload = 'auto'; a.loop = true; a.src = c.archivo;
    a.addEventListener('error', () => toast('El audio de esta canción aún no está disponible.'));
    audios.set(c.id, a);
  }
  return audios.get(c.id);
}

function toast(msg, ms = 2600) {
  toastEl.textContent = msg; toastEl.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms);
}

function build() {
  ui = el('div'); ui.id = 'k-ui';
  dialog = el('div'); dialog.id = 'k-dialog';
  dialog.innerHTML = `
    <button class="k-x" aria-label="Cerrar">&times;</button>
    <div class="k-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <p class="k-tag">AHORA SUENA</p>
    <h3 id="k-title"></h3>
    <p id="k-text"></p>
    <div class="k-bar"><div id="k-fill"></div></div>
    <div class="k-row">
      <button id="k-pp" class="k-pp">PAUSA</button>
      <span id="k-links"></span>
    </div>`;
  const bar = el('div'); bar.id = 'k-buttons';
  CANCIONES.forEach((c, i) => {
    const b = el('button', '', `<b>0${i + 1}</b><span>${c.titulo}</span>`); b.dataset.i = i; bar.appendChild(b);
  });
  ui.append(dialog, bar);
  document.body.appendChild(ui);

  const top = el('div'); top.id = 'k-top';
  top.innerHTML = `<a href="../">&larr; Inicio</a><a href="../filtro/">Filtro facial &rarr;</a>`;
  document.body.appendChild(top);
  toastEl = el('div'); toastEl.id = 'k-toast'; document.body.appendChild(toastEl);

  btns = bar.querySelectorAll('button');
  btns.forEach((b) => b.addEventListener('click', () => select(+b.dataset.i)));
  dialog.querySelector('.k-x').addEventListener('click', () => { playSfx('cerrar'); closeDialog(true); });
  dialog.querySelector('#k-pp').addEventListener('click', togglePause);

  // Los toques sobre la interfaz no deben llegar al raycast del modelo 3D
  [ui, top].forEach((n) => ['pointerdown', 'touchstart'].forEach((t) => n.addEventListener(t, (e) => e.stopPropagation())));
}

function linksHtml() {
  const l = [];
  if (ENLACES.spotify) l.push(`<a href="${ENLACES.spotify}" target="_blank" rel="noopener">Spotify</a>`);
  if (ENLACES.youtube) l.push(`<a href="${ENLACES.youtube}" target="_blank" rel="noopener">YouTube</a>`);
  return l.join('');
}

function select(i) {
  const c = CANCIONES[i];
  if (current === i) { playSfx('cerrar'); closeDialog(true); return; }
  stopAudio();
  current = i;
  playSfx('abrir');
  btns.forEach((b, k) => b.classList.toggle('on', k === i));
  dialog.querySelector('#k-title').textContent = c.titulo;
  dialog.querySelector('#k-text').textContent = c.texto;
  dialog.querySelector('#k-links').innerHTML = linksHtml();
  dialog.style.setProperty('--k-color', '#' + c.vinilo.toString(16).padStart(6, '0'));
  dialog.classList.add('open');
  const a = audioFor(c);
  a.currentTime = 0;
  a.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); });
  window.kikeAR?.setSong(c.vinilo, c.etiqueta, true);
  clearInterval(tick);
  tick = setInterval(() => {
    if (a.duration) dialog.querySelector('#k-fill').style.width = (a.currentTime / a.duration * 100) + '%';
  }, 200);
}

function setPlaying(p) {
  dialog.classList.toggle('playing', p);
  dialog.querySelector('#k-pp').textContent = p ? 'PAUSA' : 'SEGUIR';
  dialog.querySelector('.k-tag').textContent = p ? 'AHORA SUENA' : 'EN PAUSA';
  const c = CANCIONES[current];
  if (c) window.kikeAR?.setSong(c.vinilo, c.etiqueta, p);
}

function togglePause() {
  if (current === null) return;
  const a = audioFor(CANCIONES[current]);
  playSfx('pausa');
  if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {}); else { a.pause(); setPlaying(false); }
}

function stopAudio() { audios.forEach((a) => { a.pause(); }); }

function closeDialog(resetVinyl) {
  stopAudio(); clearInterval(tick); current = null;
  dialog.classList.remove('open', 'playing');
  dialog.querySelector('#k-fill').style.width = '0%';
  btns.forEach((b) => b.classList.remove('on'));
  if (resetVinyl) window.kikeAR?.reset();
}

function show() {
  clearTimeout(hideTimer);
  if (!ui.classList.contains('visible')) playSfx('encontrado');
  ui.classList.add('visible');
  // Reanuda la canción si se había pausado al perder el afiche
  if (wasPlaying && current !== null) {
    audioFor(CANCIONES[current]).play().then(() => setPlaying(true)).catch(() => {});
  }
  wasPlaying = false;
}

function lost() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (current !== null) {
      const a = audioFor(CANCIONES[current]);
      wasPlaying = !a.paused; a.pause(); setPlaying(false);
    }
    ui.classList.remove('visible');
  }, HIDE_DELAY);
}

// Tocar el vinilo o las letras 3D: golpe de cajón + rebote
let lastTap = 0;
function hookModelTap() {
  (window.player?.imageTargets || []).forEach((it) => {
    if (!it.arContent) return;
    it.arContent.onClick = () => {
      const n = performance.now(); if (n - lastTap < 400) return; lastTap = n;
      playSfx('modelo'); window.kikeAR?.bounce();
    };
  });
}

let attached = null;
setInterval(() => {
  const mc = window.mindarController;
  if (mc && mc !== attached) {
    attached = mc; hookModelTap();
    mc.addListener('found', show); mc.addListener('lost', lost);
    mc.addListener('start', () => document.getElementById('k-top').classList.add('visible'));
  }
}, 300);

build();
