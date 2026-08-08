/* Typa — src/keyboard.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const Layout = global.Typa.Layout;
const state = {
container: null,
layoutId: 'jis',
keyEls: {},
onTap: null,
fingerGuide: true,
labels: true,
shiftSticky: false
};
function keyHtml(key, layoutId) {
const finger = Layout.fingerOf(key.code);
const isHome = Layout.HOME_KEYS.indexOf(key.code) >= 0;
const isBump = Layout.BUMP_KEYS.indexOf(key.code) >= 0;
const classes = ['kb-key'];
if (key.top) classes.push('is-top');
if (isHome) classes.push('is-home');
if (isBump) classes.push('is-bump');
if (key.label) classes.push('is-named');
if (finger) classes.push(`f-${finger.id}`);
let inner = '';
if (key.label) {
inner = `<span class="kb-name">${key.label}</span>`;
} else {
const main = key.lo === ' ' ? '' : (key.lo || '');
inner = `<span class="kb-main">${escapeHtml(main.toUpperCase())}</span>`;
if (key.up && key.up !== key.lo.toUpperCase()) {
inner = `<span class="kb-up">${escapeHtml(key.up)}</span>` + inner;
}
if (layoutId === 'jis' && key.kana) {
inner += `<span class="kb-kana">${escapeHtml(key.kana)}</span>`;
}
}
return { classes, inner, finger };
}
function escapeHtml(s) {
return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function render(container, opt) {
opt = opt || {};
state.container = container;
state.layoutId = opt.layoutId || state.layoutId;
state.fingerGuide = opt.fingerGuide !== false;
state.labels = opt.labels !== false;
state.onTap = opt.onTap !== undefined ? opt.onTap : state.onTap;
state.keyEls = {};
const rows = (Layout.LAYOUTS[state.layoutId] || Layout.LAYOUTS.jis).rows;
container.className = `kb${state.fingerGuide ? ' show-finger' : ''}${state.labels ? '' : ' is-blank'}`;
container.innerHTML = '';
rows.forEach((row, rowIndex) => {
const total = row.reduce((sum, k) => sum + k.w, 0);
const scale = row[0] && row[0].top ? (60 / total) : 4;
let col = 1;
row.forEach(key => {
const span = Math.max(2, Math.round(key.w * scale));
const { classes, inner } = keyHtml(key, state.layoutId);
const el = document.createElement('div');
el.className = classes.join(' ');
el.style.gridColumn = `${col} / span ${span}`;
el.style.gridRow = `${rowIndex + 1} / span ${key.h || 1}`;
const finger = Layout.fingerOf(key.code);
if (finger) el.style.setProperty('--finger', finger.color);
el.dataset.code = key.code;
el.innerHTML = inner;
container.appendChild(el);
state.keyEls[key.code] = el;
col += span;
});
});
bindTap(container);
}
function bindTap(container) {
container.addEventListener('pointerdown', e => {
const el = e.target.closest('.kb-key');
if (!el || !state.onTap) return;
const code = el.dataset.code;
const key = findKeyByCode(code);
if (!key || key.top) return;
e.preventDefault();
if (code === 'ShiftLeft' || code === 'ShiftRight') {
state.shiftSticky = !state.shiftSticky;
container.classList.toggle('shift-on', state.shiftSticky);
return;
}
const ch = state.shiftSticky && key.up ? key.up : key.lo;
if (state.shiftSticky) {
state.shiftSticky = false;
container.classList.remove('shift-on');
}
flash(code, true);
state.onTap({ code, char: ch });
});
}
function findKeyByCode(code) {
const rows = (Layout.LAYOUTS[state.layoutId] || Layout.LAYOUTS.jis).rows;
for (const row of rows) for (const key of row) if (key.code === code) return key;
return null;
}
function highlight(codes, shift) {
Object.keys(state.keyEls).forEach(code => {
state.keyEls[code].classList.remove('is-next', 'is-next-shift');
});
(codes || []).forEach(code => {
const el = state.keyEls[code];
if (el) el.classList.add('is-next');
});
if (shift) {
['ShiftLeft', 'ShiftRight'].forEach(code => {
const el = state.keyEls[code];
if (el) el.classList.add('is-next-shift');
});
}
}
function flash(code, ok) {
const el = state.keyEls[code];
if (!el) return;
const cls = ok ? 'hit-ok' : 'hit-miss';
el.classList.remove('hit-ok', 'hit-miss');
void el.offsetWidth;
el.classList.add(cls);
setTimeout(() => el.classList.remove(cls), 220);
}
function setFingerGuide(on) {
state.fingerGuide = !!on;
if (state.container) state.container.classList.toggle('show-finger', state.fingerGuide);
}
function heat(byChar) {
let max = 0;
Object.keys(byChar || {}).forEach(k => { max = Math.max(max, byChar[k]); });
clearPaint();
if (max <= 0) return 0;
const byCode = {};
Object.keys(byChar).forEach(ch => {
const found = Layout.findKey(state.layoutId, ch === 'space' ? ' ' : ch);
if (!found) return;
byCode[found.key.code] = (byCode[found.key.code] || 0) + byChar[ch];
});
Object.keys(byCode).forEach(code => {
const el = state.keyEls[code];
if (!el) return;
el.classList.add('is-heat');
el.style.setProperty('--heat', (byCode[code] / max).toFixed(2));
el.setAttribute('title', `ミス ${Math.round(byCode[code])} かい`);
});
return max;
}
function clearPaint() {
Object.keys(state.keyEls).forEach(code => {
const el = state.keyEls[code];
el.classList.remove('is-heat', 'is-mastery', 'm-good', 'm-soso', 'm-weak', 'm-unknown');
el.style.removeProperty('--heat');
el.style.removeProperty('--mastery');
el.removeAttribute('title');
el.removeAttribute('aria-label');
});
}
function mastery(byKey) {
clearPaint();
const M = global.Typa.Mastery;
let painted = 0;
Object.keys(byKey || {}).forEach(ch => {
const stat = byKey[ch];
const found = Layout.findKey(state.layoutId, ch === 'space' ? ' ' : ch);
if (!found) return;
const el = state.keyEls[found.key.code];
if (!el) return;
const id = M.idOf(stat.mastery);
const label = M.labelOf(stat.mastery);
el.classList.add('is-mastery', `m-${id}`);
el.style.setProperty('--mastery', (stat.mastery === null ? 0 : 1 - stat.mastery).toFixed(2));
const ms = stat.medianMs ? `、${(stat.medianMs / 1000).toFixed(1)}びょう` : '';
el.setAttribute('title', `${ch.toUpperCase()} ${label}${ms}`);
el.setAttribute('aria-label', `${ch.toUpperCase()} ${label}`);
painted++;
});
return painted;
}
global.Typa = global.Typa || {};
global.Typa.Keyboard = { render, highlight, flash, heat, mastery, setFingerGuide, get layoutId() { return state.layoutId; } };
})(window);
