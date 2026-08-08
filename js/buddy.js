/* Typa — src/buddy.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
function reduced() {
try {
return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
} catch (e) { return false; }
}
function S(tag, attrs, parent) {
const el = document.createElementNS(NS, tag);
if (attrs) Object.keys(attrs).forEach(k => {
if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, String(attrs[k]));
});
if (parent) parent.appendChild(el);
return el;
}
function pivot(el, x, y) {
el.style.transformBox = 'view-box';
el.style.transformOrigin = `${x}px ${y}px`;
el.style.willChange = 'transform';
return el;
}
function fitPivot(el, origin) {
el.style.transformBox = 'fill-box';
el.style.transformOrigin = origin === 'bottom' ? '50% 100%' : '50% 50%';
return el;
}
function run(el, frames, opt) {
if (!el || reduced() || typeof el.animate !== 'function') return null;
try { return el.animate(frames, opt); } catch (e) { return null; }
}
function once(parent, el, frames, opt) {
if (reduced()) return;
parent.appendChild(el);
const a = run(el, frames, opt);
if (!a) { el.remove(); return; }
const bye = () => { if (el.parentNode) el.parentNode.removeChild(el); };
a.onfinish = bye;
a.oncancel = bye;
}
function rand(a, b) { return Math.random() * (b - a) + a; }
const SPRING = 'cubic-bezier(.22,1.2,.36,1)';
const OUT = 'cubic-bezier(.22,1,.36,1)';
const HEAD_X = 140, HEAD_Y = 88, HEAD_R = 34;
const SH_L = { x: 108, y: 124 }, SH_R = { x: 172, y: 124 };
function buildBody(parent, p) {
const breath = pivot(S('g', { class: 'bd-breath' }, parent), HEAD_X, 168);
const react = pivot(S('g', { class: 'bd-react' }, breath), HEAD_X, 168);
const lean = pivot(S('g', { class: 'bd-lean' }, react), HEAD_X, 168);
S('ellipse', { cx: HEAD_X, cy: 176, rx: 34, ry: 6, fill: '#000', opacity: .1 }, lean);
S('rect', { x: 110, y: 112, width: 60, height: 62, rx: 24, fill: p.cloth }, lean);
if (p.collar) S('path', { d: 'M122 116 L140 132 L158 116 Z', fill: p.collar }, lean);
function arm(sh, baseDeg, mirror) {
const outer = pivot(S('g', {}, lean), sh.x, sh.y);
const inner = S('g', { transform: `rotate(${baseDeg} ${sh.x} ${sh.y})` }, outer);
S('rect', { x: sh.x - 7, y: sh.y - 6, width: 14, height: 42, rx: 7, fill: p.cloth }, inner);
S('circle', { cx: sh.x, cy: sh.y + 38, r: 9, fill: p.skin }, inner);
outer._dir = mirror ? -1 : 1;
return outer;
}
const armL = arm(SH_L, 18, false);
const armR = arm(SH_R, -18, true);
const head = pivot(S('g', {}, lean), HEAD_X, HEAD_Y + 26);
S('circle', { cx: HEAD_X, cy: HEAD_Y, r: HEAD_R, fill: p.skin }, head);
S('path', {
d: `M${HEAD_X - 34} ${HEAD_Y - 4} a34 34 0 0 1 68 0 q-10 -14 -34 -12 q-24 2 -34 12 Z`,
fill: p.hair
}, head);
S('ellipse', { cx: HEAD_X - 23, cy: HEAD_Y + 10, rx: 7, ry: 4.5, fill: '#ff9d9d', opacity: .55 }, head);
S('ellipse', { cx: HEAD_X + 23, cy: HEAD_Y + 10, rx: 7, ry: 4.5, fill: '#ff9d9d', opacity: .55 }, head);
const face = buildFace(head);
return { breath, react, lean, armL, armR, head, face, hatHost: head };
}
function buildFace(head) {
const eyeY = HEAD_Y + 2;
const g = S('g', {}, head);
const normal = S('g', {}, g);
const eyes = pivot(S('g', {}, normal), HEAD_X, eyeY);
[-12, 12].forEach(dx => {
S('ellipse', { cx: HEAD_X + dx, cy: eyeY, rx: 4.6, ry: 6, fill: '#2b2b33' }, eyes);
S('circle', { cx: HEAD_X + dx - 1.6, cy: eyeY - 2.6, r: 1.7, fill: '#fff' }, eyes);
});
S('path', {
d: `M${HEAD_X - 6} ${HEAD_Y + 15} q6 6 12 0`,
fill: 'none', stroke: '#2b2b33', 'stroke-width': 2.4, 'stroke-linecap': 'round'
}, normal);
const happy = S('g', { opacity: 0 }, g);
[-12, 12].forEach(dx => {
S('path', {
d: `M${HEAD_X + dx - 5} ${eyeY + 1} q5 -6 10 0`,
fill: 'none', stroke: '#2b2b33', 'stroke-width': 2.4, 'stroke-linecap': 'round'
}, happy);
});
S('path', {
d: `M${HEAD_X - 9} ${HEAD_Y + 13} q9 12 18 0 z`,
fill: '#2b2b33'
}, happy);
const sad = S('g', { opacity: 0 }, g);
[-12, 12].forEach((dx, i) => {
const s = i === 0 ? 1 : -1;
S('path', {
d: `M${HEAD_X + dx - 4.5 * s} ${eyeY - 5} l${4.5 * s} 5 l${-4.5 * s} 5`,
fill: 'none', stroke: '#2b2b33', 'stroke-width': 2.4,
'stroke-linecap': 'round', 'stroke-linejoin': 'round'
}, sad);
});
S('path', {
d: `M${HEAD_X - 6} ${HEAD_Y + 18} q6 -7 12 0`,
fill: 'none', stroke: '#2b2b33', 'stroke-width': 2.4, 'stroke-linecap': 'round'
}, sad);
return { normal, happy, sad, eyes, current: 'normal', timer: 0 };
}
function sparkle(layer, x, y, color) {
const s = S('path', {
d: 'M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6 Z',
fill: color || '#ffd166'
});
fitPivot(s);
once(layer, s, [
{ transform: `translate(${x}px,${y}px) scale(.2) rotate(0deg)`, opacity: 0 },
{ transform: `translate(${x}px,${y - 7}px) scale(1.15) rotate(50deg)`, opacity: 1, offset: .35 },
{ transform: `translate(${x}px,${y - 20}px) scale(.7) rotate(110deg)`, opacity: 0 }
], { duration: 680, easing: OUT });
}
function sweat(layer, x, y) {
const d = fitPivot(S('path', { d: 'M0 -8 q7 8 0 12 q-7 -4 0 -12 Z', fill: '#7cc6f2' }));
once(layer, d, [
{ transform: `translate(${x}px,${y}px) scale(.5)`, opacity: 0 },
{ transform: `translate(${x + 6}px,${y + 12}px) scale(1)`, opacity: .95, offset: .35 },
{ transform: `translate(${x + 15}px,${y + 36}px) scale(.8)`, opacity: 0 }
], { duration: 800, easing: 'ease-in' });
}
function puff(layer, x, y, color) {
for (let i = 0; i < 3; i++) {
const c = fitPivot(S('circle', { cx: x + rand(-8, 8), cy: y, r: rand(6, 11), fill: color || '#c9cdd6' }));
once(layer, c, [
{ transform: 'translateY(0) scale(.35)', opacity: .8 },
{ transform: 'translateY(-40px) scale(1.45)', opacity: 0 }
], { duration: rand(760, 1040), delay: i * 90, easing: OUT });
}
}
const JOBS = {
office: {
label: 'かいしゃいん',
unit: 'しょるい',
palette: { skin: '#ffd9b8', hair: '#4a3b32', cloth: '#5b7fc7', collar: '#eef3fb' },
scene(ctx) {
S('rect', { x: 206, y: 104, width: 84, height: 58, rx: 8, fill: '#3a4256' }, ctx.back);
S('rect', { x: 212, y: 110, width: 72, height: 46, rx: 4, fill: '#8fd3f4' }, ctx.back);
for (let i = 0; i < 4; i++) {
S('rect', { x: 218, y: 118 + i * 9, width: 40 + i * 6, height: 4, rx: 2, fill: '#fff', opacity: .85 }, ctx.back);
}
S('rect', { x: 240, y: 162, width: 16, height: 10, fill: '#3a4256' }, ctx.back);
S('rect', { x: 8, y: 172, width: 304, height: 12, rx: 5, fill: '#c98f5a' }, ctx.front);
S('rect', { x: 8, y: 184, width: 304, height: 46, fill: '#b47d4c' }, ctx.front);
S('rect', { x: 92, y: 168, width: 96, height: 14, rx: 5, fill: '#e8ecf2', stroke: '#b9c2cf', 'stroke-width': 2 }, ctx.front);
S('rect', { x: 16, y: 152, width: 22, height: 20, rx: 4, fill: '#f0866b' }, ctx.front);
S('path', { d: 'M38 158 q10 6 0 10', fill: 'none', stroke: '#f0866b', 'stroke-width': 4 }, ctx.front);
},
tap(ctx, arm) {
run(arm, [
{ transform: 'rotate(0deg)' },
{ transform: `rotate(${11 * arm._dir}deg)` },
{ transform: 'rotate(0deg)' }
], { duration: 190, easing: OUT, composite: 'add' });
},
done(ctx) {
const p = S('rect', {
x: 130, y: 150, width: 26, height: 18, rx: 2,
fill: '#fff', stroke: '#cfd6e0', 'stroke-width': 1.5
});
fitPivot(p);
once(ctx.fx, p, [
{ transform: 'translate(0,0) rotate(0deg)', opacity: 0 },
{ transform: 'translate(-20px,-26px) rotate(-14deg)', opacity: 1, offset: .45 },
{ transform: 'translate(-58px,4px) rotate(4deg)', opacity: 1 }
], { duration: 560, easing: 'cubic-bezier(.3,.7,.4,1)' });
return 500;
},
stackItem(ctx, i, g) {
S('rect', {
x: 46, y: 162 - i * 7, width: 30, height: 7, rx: 2,
fill: '#fff', stroke: '#cfd6e0', 'stroke-width': 1.5
}, g);
},
miss(ctx) {
for (let i = 0; i < 3; i++) {
const p = S('rect', {
x: 132, y: 148, width: 22, height: 16, rx: 2,
fill: '#fff', stroke: '#cfd6e0', 'stroke-width': 1.5
});
fitPivot(p);
once(ctx.fx, p, [
{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
{ transform: `translate(${rand(-70, 70)}px,${rand(-58, -30)}px) rotate(${rand(-140, 140)}deg)`, opacity: 0 }
], { duration: rand(620, 860), easing: OUT });
}
}
},
chef: {
label: 'シェフ',
unit: 'りょうり',
palette: { skin: '#ffd9b8', hair: '#6b4a2f', cloth: '#fdfdfd', collar: '#ffd166' },
scene(ctx) {
S('rect', { x: 208, y: 166, width: 48, height: 8, rx: 4, fill: '#5a616e' }, ctx.back);
S('rect', { x: 8, y: 172, width: 304, height: 12, rx: 5, fill: '#e3e8ee' }, ctx.front);
S('rect', { x: 8, y: 184, width: 304, height: 46, fill: '#cdd5de' }, ctx.front);
},
props(ctx) {
const pan = pivot(S('g', {}, ctx.front), 184, 158);
S('rect', { x: 182, y: 155, width: 34, height: 6, rx: 3, fill: '#4a4f5a' }, pan);
S('path', { d: 'M212 152 h40 a20 20 0 0 1 -40 0 Z', fill: '#3a3f48' }, pan);
S('ellipse', { cx: 232, cy: 152, rx: 20, ry: 4, fill: '#565c68' }, pan);
ctx.pan = pan;
for (let i = 0; i < 3; i++) {
const at = S('g', { transform: `translate(${218 + i * 14} 172)` }, ctx.front);
const f = fitPivot(S('path', {
d: 'M0 0 q7 -10 0 -17 q-7 6 0 17 Z', fill: '#ff9f1c', opacity: .85
}, at), 'bottom');
run(f, [
{ transform: 'scaleY(1) scaleX(1)' },
{ transform: 'scaleY(1.25) scaleX(.88)' },
{ transform: 'scaleY(.92) scaleX(1.08)' },
{ transform: 'scaleY(1) scaleX(1)' }
], { duration: 620 + i * 130, iterations: Infinity, easing: 'ease-in-out' });
}
const h = S('g', {}, ctx.parts.hatHost);
const line = { fill: '#fff', stroke: '#e3e8ee', 'stroke-width': 1.5 };
S('rect', Object.assign({ x: HEAD_X - 26, y: HEAD_Y - 44, width: 52, height: 16, rx: 4 }, line), h);
S('circle', Object.assign({ cx: HEAD_X - 16, cy: HEAD_Y - 50, r: 12 }, line), h);
S('circle', Object.assign({ cx: HEAD_X + 16, cy: HEAD_Y - 50, r: 12 }, line), h);
S('circle', Object.assign({ cx: HEAD_X, cy: HEAD_Y - 56, r: 14 }, line), h);
},
tap(ctx, arm) {
run(ctx.armR, [
{ transform: 'rotate(0deg)' }, { transform: 'rotate(-13deg)' }, { transform: 'rotate(0deg)' }
], { duration: 300, easing: OUT, composite: 'add' });
run(ctx.pan, [
{ transform: 'rotate(0deg)' }, { transform: 'rotate(-22deg)' }, { transform: 'rotate(0deg)' }
], { duration: 300, easing: OUT, composite: 'add' });
const f = fitPivot(S('circle', { r: 5.5, fill: '#ff8f5e' }));
once(ctx.fx, f, [
{ transform: 'translate(232px,148px)' },
{ transform: 'translate(240px,112px)', offset: .5 },
{ transform: 'translate(232px,148px)' }
], { duration: 440, easing: 'ease-in-out' });
},
done(ctx) {
sparkle(ctx.fx, 232, 126, '#ffd166');
return 220;
},
stackItem(ctx, i, g) {
const y = 166 - i * 9;
S('ellipse', { cx: 58, cy: y, rx: 24, ry: 6, fill: '#fff', stroke: '#d6dde6', 'stroke-width': 1.5 }, g);
S('circle', { cx: 58, cy: y - 4, r: 6, fill: ['#ff8f5e', '#8bd17c', '#ffd166'][i % 3] }, g);
},
miss(ctx) {
run(ctx.pan, [
{ transform: 'rotate(0deg)' }, { transform: 'rotate(-34deg)' }, { transform: 'rotate(0deg)' }
], { duration: 440, easing: OUT, composite: 'add' });
const f = fitPivot(S('circle', { r: 5.5, fill: '#c07a4a' }));
once(ctx.fx, f, [
{ transform: 'translate(232px,148px)', opacity: 1 },
{ transform: 'translate(280px,92px)', opacity: 1, offset: .45 },
{ transform: 'translate(308px,206px)', opacity: 0 }
], { duration: 820, easing: 'ease-in' });
puff(ctx.fx, 232, 150, '#9aa1ad');
}
},
carpenter: {
label: '大工',
unit: 'くぎ',
palette: { skin: '#ffd9b8', hair: '#2f2a26', cloth: '#6fae7a', collar: '#f2e3c2' },
scene(ctx) {
S('rect', { x: 8, y: 172, width: 304, height: 12, rx: 5, fill: '#d9a86c' }, ctx.front);
S('rect', { x: 8, y: 184, width: 304, height: 46, fill: '#b98a52' }, ctx.front);
S('rect', { x: 196, y: 150, width: 110, height: 22, rx: 4, fill: '#e6c493', stroke: '#c9a271', 'stroke-width': 2 }, ctx.front);
S('path', { d: 'M210 160 h84', stroke: '#d8b485', 'stroke-width': 2, fill: 'none' }, ctx.front);
},
props(ctx) {
const ham = pivot(S('g', {}, ctx.front), 188, 156);
const inner = S('g', { transform: 'rotate(28 188 156)' }, ham);
S('rect', { x: 184, y: 108, width: 8, height: 50, rx: 4, fill: '#b0763f' }, inner);
S('rect', { x: 172, y: 98, width: 32, height: 15, rx: 3, fill: '#8d94a3' }, inner);
S('rect', { x: 194, y: 98, width: 10, height: 15, rx: 3, fill: '#6f7686' }, inner);
ctx.hammer = ham;
},
tap(ctx, arm) {
run(ctx.hammer, [
{ transform: 'rotate(0deg)', offset: 0 },
{ transform: 'rotate(-14deg)', offset: .22 },
{ transform: 'rotate(52deg)', offset: .58 },
{ transform: 'rotate(0deg)', offset: 1 }
], { duration: 300, easing: 'cubic-bezier(.4,0,.5,1)', composite: 'add' });
run(ctx.armR, [
{ transform: 'rotate(0deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0deg)' }
], { duration: 300, easing: OUT, composite: 'add' });
setTimeout(() => sparkle(ctx.fx, 238, 144, '#ffe08a'), 150);
},
done(ctx) { return 0; },
stackItem(ctx, i, g) {
const x = 216 + i * 17;
if (x > 300) return;
S('rect', { x: x - 1.5, y: 146, width: 3, height: 10, fill: '#8d94a3' }, g);
S('ellipse', { cx: x, cy: 146, rx: 4.5, ry: 2.5, fill: '#aab1bf' }, g);
},
miss(ctx) {
run(ctx.hammer, [
{ transform: 'rotate(0deg)' },
{ transform: 'rotate(62deg)' },
{ transform: 'rotate(40deg)' },
{ transform: 'rotate(0deg)' }
], { duration: 640, easing: OUT, composite: 'add' });
const st = fitPivot(S('path', {
d: 'M0 -14 L4 -4 L14 -3 L6 4 L9 14 L0 8 L-9 14 L-6 4 L-14 -3 L-4 -4 Z', fill: '#ff5d5d'
}));
once(ctx.fx, st, [
{ transform: 'translate(196px,152px) scale(.3)', opacity: 1 },
{ transform: 'translate(196px,140px) scale(1.5)', opacity: 0 }
], { duration: 600, easing: OUT });
}
}
};
const JOB_IDS = Object.keys(JOBS);
const STACK_MAX = 6;
const RANDOM = 'random';
function pickJob(exclude) {
const list = JOB_IDS.filter(id => id !== exclude);
const from = list.length ? list : JOB_IDS;
return from[Math.floor(Math.random() * from.length)];
}
const state = {
host: null, ctx: null, job: null, jobId: '',
stack: 0, flip: false, idle: [], faceTimer: 0, doneTimer: 0,
random: false, rerollTimer: 0
};
function render(host, opt) {
if (!host) return;
stop();
state.host = host;
state.stack = 0;
state.flip = false;
const want = opt ? opt.job : '';
state.random = !JOBS[want];
const jobId = state.random ? pickJob(state.jobId) : want;
const job = JOBS[jobId];
state.jobId = jobId;
state.job = job;
host.className = 'buddy';
host.innerHTML = '';
const svg = S('svg', {
class: 'buddy-svg', viewBox: '0 0 320 230',
role: 'img', 'aria-label': `${job.label}の ちびキャラ。打つと はたらきます`
}, host);
const ctx = {
svg,
back: S('g', {}, svg),
char: S('g', {}, svg),
front: S('g', {}, svg)
};
job.scene(ctx);
ctx.parts = buildBody(ctx.char, job.palette);
ctx.armL = ctx.parts.armL;
ctx.armR = ctx.parts.armR;
ctx.stackG = S('g', {}, svg);
ctx.fx = S('g', {}, svg);
if (job.props) job.props(ctx);
state.ctx = ctx;
startIdle();
drawStack();
}
function startIdle() {
const c = state.ctx;
if (!c) return;
const add = a => { if (a) state.idle.push(a); };
add(run(c.parts.breath, [
{ transform: 'translateY(0) scaleY(1)' },
{ transform: 'translateY(-2.6px) scaleY(1.012)' },
{ transform: 'translateY(0) scaleY(1)' }
], { duration: 2600, iterations: Infinity, easing: 'ease-in-out' }));
add(run(c.parts.lean, [
{ transform: 'rotate(-.7deg)' },
{ transform: 'rotate(.7deg)' },
{ transform: 'rotate(-.7deg)' }
], { duration: 4300, iterations: Infinity, easing: 'ease-in-out' }));
add(run(c.parts.face.eyes, [
{ transform: 'scaleY(1)', offset: 0 },
{ transform: 'scaleY(1)', offset: .92 },
{ transform: 'scaleY(.08)', offset: .955 },
{ transform: 'scaleY(1)', offset: .99 },
{ transform: 'scaleY(1)', offset: 1 }
], { duration: 4400, iterations: Infinity, easing: 'ease-in-out' }));
}
function setFace(name, holdMs) {
const f = state.ctx ? state.ctx.parts.face : null;
if (!f) return;
if (state.faceTimer) { clearTimeout(state.faceTimer); state.faceTimer = 0; }
['normal', 'happy', 'sad'].forEach(key => {
const el = f[key];
const to = key === name ? 1 : 0;
if (reduced() || typeof el.animate !== 'function') { el.setAttribute('opacity', to); return; }
el.setAttribute('opacity', to);
run(el, [{ opacity: to === 1 ? 0 : 1 }, { opacity: to }], { duration: 140, easing: 'ease-out' });
});
f.current = name;
if (holdMs && name !== 'normal') {
state.faceTimer = setTimeout(() => { state.faceTimer = 0; setFace('normal'); }, holdMs);
}
}
function drawStack() {
const c = state.ctx;
if (!c) return;
c.stackG.innerHTML = '';
for (let i = 0; i < state.stack; i++) state.job.stackItem(c, i, c.stackG);
}
function addStack() {
const c = state.ctx;
if (!c) return;
state.stack = Math.min(STACK_MAX, state.stack + 1);
drawStack();
run(c.stackG, [
{ transform: 'scale(.72) translateY(4px)', opacity: .4 },
{ transform: 'scale(1) translateY(0)', opacity: 1 }
], { duration: 320, easing: SPRING });
}
function tap() {
const c = state.ctx;
if (!c) return;
state.flip = !state.flip;
const arm = state.flip ? c.armL : c.armR;
state.job.tap(c, arm);
run(c.parts.head, [
{ transform: 'translateY(0)' },
{ transform: 'translateY(1.8px)' },
{ transform: 'translateY(0)' }
], { duration: 190, easing: OUT, composite: 'add' });
run(c.parts.lean, [
{ transform: 'rotate(0deg)' },
{ transform: 'rotate(.9deg)' },
{ transform: 'rotate(0deg)' }
], { duration: 420, easing: 'ease-in-out', composite: 'add' });
}
function done() {
const c = state.ctx;
if (!c) return;
const wait = state.job.done(c) || 0;
run(c.parts.react, [
{ transform: 'translateY(0) scale(1)', offset: 0 },
{ transform: 'translateY(-13px) scale(1.03)', offset: .42 },
{ transform: 'translateY(2px) scale(.98)', offset: .74 },
{ transform: 'translateY(0) scale(1)', offset: 1 }
], { duration: 520, easing: SPRING, composite: 'add' });
sparkle(c.fx, HEAD_X - 44, 70, '#ffd166');
sparkle(c.fx, HEAD_X + 44, 78, '#8bd17c');
setFace('happy', 820);
if (state.doneTimer) clearTimeout(state.doneTimer);
if (wait > 0) state.doneTimer = setTimeout(() => { state.doneTimer = 0; addStack(); }, wait);
else addStack();
}
function miss() {
const c = state.ctx;
if (!c) return;
run(c.parts.react, [
{ transform: 'translateX(0) rotate(0deg)' },
{ transform: 'translateX(-5px) rotate(-3.5deg)' },
{ transform: 'translateX(5px) rotate(3.5deg)' },
{ transform: 'translateX(-3px) rotate(-2deg)' },
{ transform: 'translateX(0) rotate(0deg)' }
], { duration: 420, easing: 'ease-in-out', composite: 'add' });
sweat(c.fx, HEAD_X + 30, 62);
state.job.miss(c);
setFace('sad', 780);
}
function combo() {
const c = state.ctx;
if (!c) return;
run(c.parts.react, [
{ transform: 'translateY(0) rotate(0deg)', offset: 0 },
{ transform: 'translateY(-16px) rotate(-4deg)', offset: .38 },
{ transform: 'translateY(0) rotate(3deg)', offset: .7 },
{ transform: 'translateY(0) rotate(0deg)', offset: 1 }
], { duration: 640, easing: SPRING, composite: 'add' });
sparkle(c.fx, HEAD_X - 40, 58, '#ffd166');
sparkle(c.fx, HEAD_X + 40, 66, '#7cc6f2');
setFace('happy', 620);
}
function cheer() {
const c = state.ctx;
if (!c) return;
run(c.parts.react, [
{ transform: 'translateY(0) scale(1)', offset: 0 },
{ transform: 'translateY(-22px) scale(1.06)', offset: .3 },
{ transform: 'translateY(0) scale(.96)', offset: .55 },
{ transform: 'translateY(-11px) scale(1.02)', offset: .76 },
{ transform: 'translateY(0) scale(1)', offset: 1 }
], { duration: 980, easing: SPRING, composite: 'add' });
[[-52, 62, '#ffd166'], [54, 70, '#8bd17c'], [-16, 46, '#7cc6f2'], [26, 44, '#ff9d9d']]
.forEach(([dx, y, color], i) => {
setTimeout(() => sparkle(c.fx, HEAD_X + dx, y, color), i * 90);
});
setFace('happy', 1400);
run(c.stackG, [
{ transform: 'translateY(0)', opacity: 1 },
{ transform: 'translateY(-16px)', opacity: 0 }
], { duration: 480, easing: OUT });
setTimeout(() => { state.stack = 0; drawStack(); }, 460);
}
function reroll(delayMs) {
if (!state.random || !state.host) return false;
if (state.rerollTimer) clearTimeout(state.rerollTimer);
const host = state.host;
state.rerollTimer = setTimeout(() => {
state.rerollTimer = 0;
if (!host.isConnected) return;
render(host, { job: RANDOM });
}, delayMs > 0 ? delayMs : 1800);
return true;
}
function stop() {
state.idle.forEach(a => { try { a.cancel(); } catch (e) { } });
state.idle = [];
if (state.faceTimer) clearTimeout(state.faceTimer);
if (state.doneTimer) clearTimeout(state.doneTimer);
if (state.rerollTimer) clearTimeout(state.rerollTimer);
state.faceTimer = 0;
state.doneTimer = 0;
state.rerollTimer = 0;
}
function jobs() {
return JOB_IDS.map(id => ({ id, label: JOBS[id].label, unit: JOBS[id].unit }));
}
function normalizeJob(id) { return JOBS[id] ? id : RANDOM; }
global.Typa = global.Typa || {};
global.Typa.Buddy = {
RANDOM, render, reroll, tap, done, miss, combo, cheer, stop, jobs, normalizeJob,
get job() { return state.jobId; },
get produced() { return state.stack; }
};
})(window);
