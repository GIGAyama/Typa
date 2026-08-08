/* Typa — src/nav.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const BACK_DEBOUNCE_MS = 400;
const EDGE_PX = 28;
const SWIPE_MIN = 60;
const TABS = [
{ id: 'play', label: 'うつ', icon: 'keyboard' },
{ id: 'menu', label: 'えらぶ', icon: 'grid' },
{ id: 'records', label: 'きろく', icon: 'chart' },
{ id: 'settings', label: 'せってい', icon: 'gear' }
];
const ROOT_TAB = TABS[0].id;
const state = {
stack: [],
tab: ROOT_TAB,
lastBackAt: 0,
handlers: {},
onChange: null,
onBeforeRender: null,
dir: null,
guardArmed: false
};
const DIR = { FWD: 'fwd', BACK: 'back', RIGHT: 'right', LEFT: 'left' };
function tabDir(fromTab, toTab) {
if (!fromTab || fromTab === toTab) return null;
const from = TABS.findIndex(t => t.id === fromTab);
const to = TABS.findIndex(t => t.id === toTab);
if (from < 0 || to < 0) return null;
return to > from ? DIR.RIGHT : DIR.LEFT;
}
function current() { return state.stack[state.stack.length - 1] || null; }
function canGoBack() {
const cur = current();
if (state.stack.length > 1) return true;
if (cur && cur.screen !== state.tab) return true;
return state.tab !== ROOT_TAB;
}
function register(screen, handler) { state.handlers[screen] = handler; }
function emit() {
if (typeof state.onChange === 'function') {
state.onChange(current(), { canGoBack: canGoBack(), tab: state.tab, dir: state.dir });
}
}
function render(dir) {
const cur = current();
if (!cur) return;
state.dir = dir || null;
if (typeof state.onBeforeRender === 'function') state.onBeforeRender(state.dir, cur);
const handler = state.handlers[cur.screen];
if (handler && typeof handler.render === 'function') handler.render(cur.params || {});
emit();
}
function go(screen, params) {
const cur = current();
if (cur && !leaveOk(cur, 'go')) return false;
state.stack.push({ screen, params: params || {} });
render(DIR.FWD);
return true;
}
function selectTab(tabId) {
const cur = current();
if (cur && cur.screen === tabId && state.stack.length === 1) return;
if (cur && !leaveOk(cur, 'tab')) return;
const dir = tabDir(state.tab, tabId);
state.tab = tabId;
state.stack = [{ screen: tabId, params: {} }];
render(dir);
}
function leaveOk(entry, reason) {
const handler = state.handlers[entry.screen];
if (handler && typeof handler.leave === 'function') {
return handler.leave(entry.params || {}, reason || 'back') !== false;
}
return true;
}
function back(source) {
const now = Date.now();
if (now - state.lastBackAt < BACK_DEBOUNCE_MS) return;
state.lastBackAt = now;
const cur = current();
if (cur && !leaveOk(cur, 'back')) return;
if (state.stack.length > 1) {
state.stack.pop();
render(DIR.BACK);
return;
}
if (cur && cur.screen !== state.tab) {
state.stack = [{ screen: state.tab, params: {} }];
render(DIR.BACK);
return;
}
if (state.tab !== ROOT_TAB) {
const dir = tabDir(state.tab, ROOT_TAB);
state.tab = ROOT_TAB;
state.stack = [{ screen: ROOT_TAB, params: {} }];
render(dir || DIR.BACK);
return;
}
if (typeof state.onRootBack === 'function') state.onRootBack(source);
}
function replace(screen, params) {
if (state.stack.length > 0) state.stack.pop();
state.stack.push({ screen, params: params || {} });
render(DIR.FWD);
}
function armGuard() {
try {
history.pushState({ typa: 'guard', t: Date.now() }, '');
state.guardArmed = true;
} catch (e) { state.guardArmed = false; }
}
function setupHistoryGuard() {
try { history.replaceState({ typa: 'root' }, ''); } catch (e) { }
armGuard();
global.addEventListener('popstate', () => {
armGuard();
back('history');
});
}
function setupEdgeSwipe(root, indicator) {
let tracking = false, decided = false, startX = 0, startY = 0, fromLeft = false;
root.addEventListener('touchstart', e => {
if (e.touches.length !== 1) return;
const x = e.touches[0].clientX;
const width = global.innerWidth;
fromLeft = x <= EDGE_PX;
const fromRight = x >= width - EDGE_PX;
tracking = fromLeft || fromRight;
decided = false;
startX = x;
startY = e.touches[0].clientY;
}, { passive: true });
root.addEventListener('touchmove', e => {
if (!tracking) return;
const dx = e.touches[0].clientX - startX;
const dy = e.touches[0].clientY - startY;
const inward = fromLeft ? dx : -dx;
if (!decided) {
if (Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }
if (inward < 12) return;
decided = true;
}
if (indicator) {
indicator.classList.add('is-active');
indicator.classList.toggle('from-right', !fromLeft);
indicator.style.setProperty('--pull', Math.min(1, inward / SWIPE_MIN).toFixed(2));
}
if (e.cancelable) e.preventDefault();
}, { passive: false });
const finish = () => {
if (indicator) { indicator.classList.remove('is-active'); indicator.style.removeProperty('--pull'); }
tracking = false;
decided = false;
};
root.addEventListener('touchend', e => {
if (tracking && decided) {
const touch = e.changedTouches[0];
const dx = touch.clientX - startX;
const inward = fromLeft ? dx : -dx;
if (inward >= SWIPE_MIN) back('swipe');
}
finish();
}, { passive: true });
root.addEventListener('touchcancel', finish, { passive: true });
}
function init(opt) {
state.onChange = opt.onChange || null;
state.onBeforeRender = opt.onBeforeRender || null;
state.onRootBack = opt.onRootBack || null;
state.tab = opt.start || ROOT_TAB;
state.stack = [{ screen: state.tab, params: {} }];
setupHistoryGuard();
if (opt.root) setupEdgeSwipe(opt.root, opt.indicator || null);
render();
}
global.Typa = global.Typa || {};
global.Typa.Nav = {
TABS, ROOT_TAB, DIR, init, register, go, back, replace, selectTab, render, current, canGoBack,
get tab() { return state.tab; }
};
})(window);
