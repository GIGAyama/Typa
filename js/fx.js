/* Typa — src/fx.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const T = global.Typa = global.Typa || {};
const doc = global.document;
const STEP_MS = 42;
const STEP_MAX_MS = 420;
const PARTY = ['#ffd166', '#06d6a0', '#4cc9f0', '#ff6b6b', '#b794ff', '#ffa94d', '#5ee7df'];
function reduced() {
try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; }
catch (e) { return false; }
}
const canAnimate = typeof Element !== 'undefined' && !!Element.prototype.animate;
function stagger(nodes, base) {
let last = base;
Array.prototype.forEach.call(nodes, (el, i) => {
if (!el || el.nodeType !== 1) return;
if (el.hasAttribute('hidden')) return;
const delay = Math.min(base + i * STEP_MS, base + STEP_MAX_MS);
el.classList.add('fx-rise');
el.style.setProperty('--fx-d', delay + 'ms');
last = Math.max(last, delay);
});
return last;
}
const INNER_LISTS = [
'.menu-grid', '.menu-col', '.menu-list', '.course-list', '.stage-list', '.badge-grid',
'.pool-grid', '.today', '.result-grid', '.tile-row', '.subtabs'
];
const SLIDE = { fwd: 26, back: -26, right: 34, left: -34 };
function enter(root, opt) {
if (!root) return;
const o = opt || {};
const base = o.base != null ? o.base : 0;
if (!reduced()) {
root.style.setProperty('--fx-x', (SLIDE[o.dir] || 0) + 'px');
if (o.self) stagger([root], base);
else stagger(root.children, base);
INNER_LISTS.forEach(sel => {
root.querySelectorAll(sel).forEach(list => stagger(list.children, base + 60));
});
}
numbers(root);
bars(root);
rings(root);
}
function ghost(el, dir) {
if (!el || reduced()) return;
const r = el.getBoundingClientRect();
if (!r.width || !r.height) return;
const box = el.cloneNode(true);
box.classList.add('fx-ghost');
box.setAttribute('aria-hidden', 'true');
box.removeAttribute('id');
box.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
box.style.left = r.left + 'px';
box.style.top = r.top + 'px';
box.style.width = r.width + 'px';
box.style.height = r.height + 'px';
box.style.setProperty('--fx-gx', (dir === 'back' ? 22 : -22) + 'px');
doc.body.appendChild(box);
setTimeout(() => { if (box.parentNode) box.parentNode.removeChild(box); }, 320);
}
function tapThen(el, run) {
if (!el || reduced()) { run(); return; }
el.classList.remove('tapped');
void el.offsetWidth;
el.classList.add('tapped');
setTimeout(() => el.classList.remove('tapped'), 520);
setTimeout(run, 150);
}
function clear(root) {
if (!root) return;
root.querySelectorAll('.fx-rise').forEach(el => {
el.classList.remove('fx-rise');
el.style.removeProperty('--fx-d');
});
}
function clearLayer() {
const box = doc.getElementById('fx-layer');
if (box) box.innerHTML = '';
}
function numbers(root) {
root.querySelectorAll('[data-count]').forEach(el => {
const to = Number(el.dataset.count);
const dec = Number(el.dataset.dec || 0);
if (!isFinite(to)) return;
const text = to.toFixed(dec);
if (reduced() || to === 0 || !global.requestAnimationFrame) { el.textContent = text; return; }
const dur = 620;
const wait = Number(el.dataset.countDelay || 140);
el.textContent = (0).toFixed(dec);
const begin = () => {
const start = performance.now();
const tick = now => {
const p = Math.min(1, (now - start) / dur);
const e = 1 - Math.pow(1 - p, 3);
el.textContent = (to * e).toFixed(dec);
if (p < 1) requestAnimationFrame(tick);
else el.textContent = text;
};
requestAnimationFrame(tick);
};
if (wait > 0) setTimeout(begin, wait); else begin();
});
}
function bars(root) {
root.querySelectorAll('[data-grow]').forEach(el => {
const pct = Math.max(0, Math.min(100, Number(el.dataset.grow) || 0));
if (reduced() || !global.requestAnimationFrame) { el.style.width = pct + '%'; return; }
el.style.width = '0%';
requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = pct + '%'; }));
});
}
function rings(root) {
root.querySelectorAll('[data-ring]').forEach(el => {
const r = Number(el.getAttribute('r')) || 0;
const len = 2 * Math.PI * r;
const ratio = Math.max(0, Math.min(1, Number(el.dataset.ring) || 0));
el.style.strokeDasharray = len.toFixed(2);
if (reduced() || !global.requestAnimationFrame) {
el.style.strokeDashoffset = (len * (1 - ratio)).toFixed(2);
return;
}
el.style.strokeDashoffset = len.toFixed(2);
requestAnimationFrame(() => requestAnimationFrame(() => {
el.style.transition = 'stroke-dashoffset .95s cubic-bezier(.2,.85,.3,1) .12s';
el.style.strokeDashoffset = (len * (1 - ratio)).toFixed(2);
}));
});
}
function layer() {
let el = doc.getElementById('fx-layer');
if (!el) {
el = doc.createElement('div');
el.id = 'fx-layer';
el.className = 'fx-layer';
el.setAttribute('aria-hidden', 'true');
doc.body.appendChild(el);
}
return el;
}
function confetti(opt) {
if (reduced() || !canAnimate) return;
const o = opt || {};
const box = layer();
const n = Math.max(6, Math.min(160, o.count || 84));
const power = o.power || 1;
const x = o.x != null ? o.x : global.innerWidth / 2;
const y = o.y != null ? o.y : global.innerHeight * 0.3;
for (let i = 0; i < n; i++) {
const p = doc.createElement('span');
p.className = 'fx-bit';
const size = 6 + Math.random() * 8;
p.style.left = x + 'px';
p.style.top = y + 'px';
p.style.width = size + 'px';
p.style.height = (size * (0.4 + Math.random() * 0.8)) + 'px';
p.style.background = PARTY[i % PARTY.length];
if (i % 3 === 0) p.style.borderRadius = '50%';
box.appendChild(p);
const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
const dist = (110 + Math.random() * 230) * power;
const dx = Math.cos(angle) * dist;
const dy = Math.sin(angle) * dist * 0.62 - 60 * power;
const fall = 260 + Math.random() * 320;
const spin = (Math.random() * 900 - 450) + 'deg';
const dur = 1100 + Math.random() * 900;
const anim = p.animate([
{ transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 1 },
{ transform: `translate3d(${dx * 0.72}px, ${dy}px, 0) rotate(${spin})`, opacity: 1, offset: 0.42 },
{ transform: `translate3d(${dx}px, ${dy + fall}px, 0) rotate(${spin})`, opacity: 0 }
], { duration: dur, easing: 'cubic-bezier(.18,.75,.3,1)', fill: 'forwards' });
anim.onfinish = () => { if (p.parentNode) p.parentNode.removeChild(p); };
setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, dur + 400);
}
}
function confettiAt(el, opt) {
if (!el) { confetti(opt); return; }
const r = el.getBoundingClientRect();
confetti(Object.assign({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, opt || {}));
}
function ripple(el) {
if (!el || reduced() || !canAnimate) return;
const r = el.getBoundingClientRect();
const ring = doc.createElement('span');
ring.className = 'fx-ripple';
ring.style.left = (r.left + r.width / 2) + 'px';
ring.style.top = (r.top + r.height / 2) + 'px';
layer().appendChild(ring);
const anim = ring.animate([
{ transform: 'translate(-50%,-50%) scale(.2)', opacity: .85 },
{ transform: 'translate(-50%,-50%) scale(2.4)', opacity: 0 }
], { duration: 720, easing: 'cubic-bezier(.2,.8,.3,1)' });
anim.onfinish = () => { if (ring.parentNode) ring.parentNode.removeChild(ring); };
}
function pop(el, delay) {
if (!el || reduced() || !canAnimate) return;
el.animate([
{ transform: 'scale(.4)', opacity: 0 },
{ transform: 'scale(1.18)', opacity: 1, offset: .62 },
{ transform: 'scale(1)', opacity: 1 }
], { duration: 520, delay: delay || 0, easing: 'cubic-bezier(.2,1.5,.4,1)', fill: 'backwards' });
}
function popAll(nodes, step) {
Array.prototype.forEach.call(nodes || [], (el, i) => pop(el, i * (step || 130)));
}
T.FX = {
reduced, enter, clear, clearLayer, stagger, numbers, bars, rings,
ghost, tapThen,
confetti, confettiAt, ripple, pop, popAll
};
})(window);
