/* Typa — src/hands.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const Layout = global.Typa.Layout;
const VIEW_W = 1000;
const VIEW_H = 100;
const COL = VIEW_W / 60;
const HOME_COL = {
'l-pinky': 9, 'l-ring': 13, 'l-middle': 17, 'l-index': 21,
'r-index': 33, 'r-middle': 37, 'r-ring': 41, 'r-pinky': 45
};
const ROLES = ['pinky', 'ring', 'middle', 'index'];
const FINGER_TOP = { pinky: 30, ring: 12, middle: 4, index: 18 };
const FINGER_W = 52;
const LETTER_DY = 26;
const PALM = { y: 66, h: 80, rx: 36, edge: 6 };
const THUMB = { w: 44, h: 52, rot: 44, pivotY: 96 };
const HOME_CHAR = {
'l-pinky': 'A', 'l-ring': 'S', 'l-middle': 'D', 'l-index': 'F',
'r-index': 'J', 'r-middle': 'K', 'r-ring': 'L', 'r-pinky': ';'
};
const state = { container: null, els: {}, on: [] };
function fingerId(hand, role) { return `${hand === 'left' ? 'l' : 'r'}-${role}`; }
function centerX(hand, role) { return HOME_COL[fingerId(hand, role)] * COL; }
function part(id, shape) {
return `<g class="hand-finger" data-finger="${id}" style="--finger:${color(id)}">${shape}</g>`;
}
function color(id) {
const f = Layout.FINGERS[id];
return f ? f.color : 'currentColor';
}
function handSvg(hand) {
const inner = hand === 'left' ? 1 : -1;
const pivotX = centerX(hand, 'index') + inner * (FINGER_W / 2);
const outerX = centerX(hand, 'pinky') - inner * (FINGER_W / 2 + PALM.edge);
let out = `<rect class="hand-palm" x="${round(Math.min(pivotX, outerX))}" y="${PALM.y}"
      width="${round(Math.abs(pivotX - outerX))}" height="${PALM.h}" rx="${PALM.rx}"/>`;
out += part('thumb',
`<rect x="${round(pivotX - THUMB.w / 2)}" y="${THUMB.pivotY - THUMB.h}"
         width="${THUMB.w}" height="${THUMB.h}" rx="${THUMB.w / 2}"
         transform="rotate(${inner * THUMB.rot} ${round(pivotX)} ${THUMB.pivotY})"/>`);
ROLES.forEach(role => {
const id = fingerId(hand, role);
const cx = centerX(hand, role);
const top = FINGER_TOP[role];
out += part(id,
`<rect x="${round(cx - FINGER_W / 2)}" y="${top}" width="${FINGER_W}"
           height="${VIEW_H + 20 - top}" rx="${FINGER_W / 2}"/>` +
(HOME_CHAR[id] ? `<text x="${round(cx)}" y="${top + LETTER_DY}">${HOME_CHAR[id]}</text>` : ''));
});
return out;
}
function handCenterPct(hand) {
const inner = hand === 'left' ? 1 : -1;
const a = centerX(hand, 'index') + inner * (FINGER_W / 2);
const b = centerX(hand, 'pinky') - inner * (FINGER_W / 2 + PALM.edge);
return round((a + b) / 2 / VIEW_W * 100);
}
function round(n) { return Math.round(n * 10) / 10; }
function render(container) {
if (!container) return;
state.container = container;
state.els = {};
state.on = [];
container.className = 'hands';
container.innerHTML = `
      <div class="hands-body">
        <svg class="hands-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img"
             aria-label="りょうての イラスト。つぎに つかう 指が 光ります">
          <g class="hand hand-left">${handSvg('left')}</g>
          <g class="hand hand-right">${handSvg('right')}</g>
        </svg>
      </div>
      <p class="hands-label">
        <span style="left:${handCenterPct('left')}%">ひだり手</span>
        <span style="left:${handCenterPct('right')}%">みぎ手</span>
      </p>`;
container.querySelectorAll('.hand-finger').forEach(el => {
const id = el.dataset.finger;
if (!state.els[id]) state.els[id] = [];
state.els[id].push(el);
});
}
function highlight(ids) {
state.on.forEach(el => el.classList.remove('is-next'));
state.on = [];
(ids || []).forEach(id => {
(state.els[id] || []).forEach(el => {
el.classList.add('is-next');
state.on.push(el);
});
});
}
function press(id, ok) {
const cls = ok ? 'is-hit' : 'is-miss';
(state.els[id] || []).forEach(el => {
el.classList.remove('is-hit', 'is-miss');
void el.getBoundingClientRect();
el.classList.add(cls);
setTimeout(() => el.classList.remove(cls), 220);
});
}
function shiftFingerFor(id) {
if (!id) return 'l-pinky';
return String(id).charAt(0) === 'l' ? 'r-pinky' : 'l-pinky';
}
global.Typa = global.Typa || {};
global.Typa.Hands = { render, highlight, press, shiftFingerFor, HOME_CHAR, VIEW_W, VIEW_H };
})(window);
