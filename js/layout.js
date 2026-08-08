/* Typa — src/layout.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const FINGERS = {
'l-pinky': { label: 'ひだり こゆび', short: 'こ', hand: 'left', color: '#6b74d8' },
'l-ring': { label: 'ひだり くすりゆび', short: 'くす', hand: 'left', color: '#2b8fd0' },
'l-middle': { label: 'ひだり なかゆび', short: 'なか', hand: 'left', color: '#0f9c8a' },
'l-index': { label: 'ひだり ひとさしゆび', short: 'ひと', hand: 'left', color: '#5da12f' },
'r-index': { label: 'みぎ ひとさしゆび', short: 'ひと', hand: 'right', color: '#c8940f' },
'r-middle': { label: 'みぎ なかゆび', short: 'なか', hand: 'right', color: '#d2702c' },
'r-ring': { label: 'みぎ くすりゆび', short: 'くす', hand: 'right', color: '#c9484a' },
'r-pinky': { label: 'みぎ こゆび', short: 'こ', hand: 'right', color: '#a355bd' },
'thumb': { label: 'おやゆび', short: 'おや', hand: 'both', color: '#6c7a89' }
};
const FINGER_OF = {};
const assign = (finger, codes) => codes.forEach(code => { FINGER_OF[code] = finger; });
assign('l-pinky', ['Escape', 'Backquote', 'Digit1', 'KeyQ', 'KeyA', 'KeyZ', 'Tab', 'CapsLock', 'ShiftLeft', 'ControlLeft']);
assign('l-ring', ['Digit2', 'KeyW', 'KeyS', 'KeyX']);
assign('l-middle', ['Digit3', 'KeyE', 'KeyD', 'KeyC']);
assign('l-index', ['Digit4', 'Digit5', 'KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyV', 'KeyB']);
assign('r-index', ['Digit6', 'Digit7', 'KeyY', 'KeyU', 'KeyH', 'KeyJ', 'KeyN', 'KeyM']);
assign('r-middle', ['Digit8', 'KeyI', 'KeyK', 'Comma']);
assign('r-ring', ['Digit9', 'KeyO', 'KeyL', 'Period']);
assign('r-pinky', ['Digit0', 'KeyP', 'Minus', 'Equal', 'IntlYen', 'BracketLeft', 'BracketRight', 'Backslash',
'Semicolon', 'Quote', 'Slash', 'IntlRo', 'Backspace', 'Enter', 'ShiftRight',
'ControlRight', 'AltRight']);
assign('thumb', ['Space', 'NonConvert', 'Convert', 'AltLeft', 'Lang2', 'Lang1']);
const HOME_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
const BUMP_KEYS = ['KeyF', 'KeyJ'];
const K = (code, lo, up, kana, opt) => Object.assign({ code, lo, up, kana: kana || '', w: 1, h: 1 }, opt || {});
const CHROMEBOOK_TOP = [
K('Escape', '', '', '', { label: 'esc', w: 1.25, top: true }),
K('BrowserBack', '', '', '', { label: 'もどる', top: true }),
K('BrowserForward', '', '', '', { label: 'すすむ', top: true }),
K('BrowserRefresh', '', '', '', { label: 'さいよみこみ', top: true }),
K('F4', '', '', '', { label: 'ぜんがめん', top: true }),
K('F5', '', '', '', { label: 'ウィンドウ', top: true }),
K('F6', '', '', '', { label: 'あかるさ −', top: true }),
K('F7', '', '', '', { label: 'あかるさ ＋', top: true }),
K('F8', '', '', '', { label: 'ミュート', top: true }),
K('F9', '', '', '', { label: 'おと −', top: true }),
K('F10', '', '', '', { label: 'おと ＋', top: true }),
K('Power', '', '', '', { label: 'でんげん', w: 1.75, top: true })
];
const JIS = [
CHROMEBOOK_TOP,
[
K('Backquote', '', '', '', { label: 'かな英数' }),
K('Digit1', '1', '!', 'ぬ'), K('Digit2', '2', '"', 'ふ'), K('Digit3', '3', '#', 'あ'),
K('Digit4', '4', '$', 'う'), K('Digit5', '5', '%', 'え'), K('Digit6', '6', '&', 'お'),
K('Digit7', '7', "'", 'や'), K('Digit8', '8', '(', 'ゆ'), K('Digit9', '9', ')', 'よ'),
K('Digit0', '0', '', 'わ'), K('Minus', '-', '=', 'ほ'), K('Equal', '^', '~', 'へ'),
K('IntlYen', '\\', '|', 'ー'), K('Backspace', '', '', '', { label: 'けす' })
],
[
K('Tab', '', '', '', { label: 'タブ', w: 1.5 }),
K('KeyQ', 'q', 'Q', 'た'), K('KeyW', 'w', 'W', 'て'), K('KeyE', 'e', 'E', 'い'),
K('KeyR', 'r', 'R', 'す'), K('KeyT', 't', 'T', 'か'), K('KeyY', 'y', 'Y', 'ん'),
K('KeyU', 'u', 'U', 'な'), K('KeyI', 'i', 'I', 'に'), K('KeyO', 'o', 'O', 'ら'),
K('KeyP', 'p', 'P', 'せ'), K('BracketLeft', '@', '`', '゛'), K('BracketRight', '[', '{', '゜'),
K('Enter', '', '', '', { label: 'エンター', w: 1.5, h: 2 })
],
[
K('CapsLock', '', '', '', { label: 'けんさく', w: 1.75 }),
K('KeyA', 'a', 'A', 'ち'), K('KeyS', 's', 'S', 'と'), K('KeyD', 'd', 'D', 'し'),
K('KeyF', 'f', 'F', 'は'), K('KeyG', 'g', 'G', 'き'), K('KeyH', 'h', 'H', 'く'),
K('KeyJ', 'j', 'J', 'ま'), K('KeyK', 'k', 'K', 'の'), K('KeyL', 'l', 'L', 'り'),
K('Semicolon', ';', '+', 'れ'), K('Quote', ':', '*', 'け'), K('Backslash', ']', '}', 'む')
],
[
K('ShiftLeft', '', '', '', { label: 'シフト', w: 2.25 }),
K('KeyZ', 'z', 'Z', 'つ'), K('KeyX', 'x', 'X', 'さ'), K('KeyC', 'c', 'C', 'そ'),
K('KeyV', 'v', 'V', 'ひ'), K('KeyB', 'b', 'B', 'こ'), K('KeyN', 'n', 'N', 'み'),
K('KeyM', 'm', 'M', 'も'), K('Comma', ',', '<', 'ね'), K('Period', '.', '>', 'る'),
K('Slash', '/', '?', 'め'), K('IntlRo', '\\', '_', 'ろ'),
K('ShiftRight', '', '', '', { label: 'シフト', w: 1.75 })
],
[
K('ControlLeft', '', '', '', { label: 'コントロール', w: 1.5 }),
K('AltLeft', '', '', '', { label: 'オルト', w: 1.25 }),
K('NonConvert', '', '', '', { label: '英数', w: 1.25 }),
K('Space', ' ', ' ', '', { label: 'スペース', w: 4 }),
K('Convert', '', '', '', { label: 'かな', w: 1.25 }),
K('AltRight', '', '', '', { label: 'オルト', w: 1.25 }),
K('ControlRight', '', '', '', { label: 'コントロール', w: 1.5 }),
K('ArrowLeft', '', '', '', { label: '←', w: 0.75 }), K('ArrowUp', '', '', '', { label: '↑', w: 0.75 }),
K('ArrowDown', '', '', '', { label: '↓', w: 0.75 }), K('ArrowRight', '', '', '', { label: '→', w: 0.75 })
]
];
const US = [
CHROMEBOOK_TOP,
[
K('Backquote', '`', '~'), K('Digit1', '1', '!'), K('Digit2', '2', '@'), K('Digit3', '3', '#'),
K('Digit4', '4', '$'), K('Digit5', '5', '%'), K('Digit6', '6', '^'), K('Digit7', '7', '&'),
K('Digit8', '8', '*'), K('Digit9', '9', '('), K('Digit0', '0', ')'),
K('Minus', '-', '_'), K('Equal', '=', '+'),
K('Backspace', '', '', '', { label: 'けす', w: 2 })
],
[
K('Tab', '', '', '', { label: 'タブ', w: 1.5 }),
K('KeyQ', 'q', 'Q'), K('KeyW', 'w', 'W'), K('KeyE', 'e', 'E'), K('KeyR', 'r', 'R'),
K('KeyT', 't', 'T'), K('KeyY', 'y', 'Y'), K('KeyU', 'u', 'U'), K('KeyI', 'i', 'I'),
K('KeyO', 'o', 'O'), K('KeyP', 'p', 'P'),
K('BracketLeft', '[', '{'), K('BracketRight', ']', '}'),
K('Backslash', '\\', '|', '', { w: 1.5 })
],
[
K('CapsLock', '', '', '', { label: 'けんさく', w: 1.75 }),
K('KeyA', 'a', 'A'), K('KeyS', 's', 'S'), K('KeyD', 'd', 'D'), K('KeyF', 'f', 'F'),
K('KeyG', 'g', 'G'), K('KeyH', 'h', 'H'), K('KeyJ', 'j', 'J'), K('KeyK', 'k', 'K'),
K('KeyL', 'l', 'L'), K('Semicolon', ';', ':'), K('Quote', "'", '"'),
K('Enter', '', '', '', { label: 'エンター', w: 2.25 })
],
[
K('ShiftLeft', '', '', '', { label: 'シフト', w: 2.25 }),
K('KeyZ', 'z', 'Z'), K('KeyX', 'x', 'X'), K('KeyC', 'c', 'C'), K('KeyV', 'v', 'V'),
K('KeyB', 'b', 'B'), K('KeyN', 'n', 'N'), K('KeyM', 'm', 'M'),
K('Comma', ',', '<'), K('Period', '.', '>'), K('Slash', '/', '?'),
K('ShiftRight', '', '', '', { label: 'シフト', w: 2.75 })
],
[
K('ControlLeft', '', '', '', { label: 'コントロール', w: 1.5 }),
K('AltLeft', '', '', '', { label: 'オルト', w: 1.25 }),
K('Space', ' ', ' ', '', { label: 'スペース', w: 6.5 }),
K('AltRight', '', '', '', { label: 'オルト', w: 1.25 }),
K('ControlRight', '', '', '', { label: 'コントロール', w: 1.5 }),
K('ArrowLeft', '', '', '', { label: '←', w: 0.75 }), K('ArrowUp', '', '', '', { label: '↑', w: 0.75 }),
K('ArrowDown', '', '', '', { label: '↓', w: 0.75 }), K('ArrowRight', '', '', '', { label: '→', w: 0.75 })
]
];
const LAYOUTS = { jis: { label: '日本語配列（JIS）', rows: JIS }, us: { label: '英語配列（US）', rows: US } };
function findKey(layoutId, ch) {
const rows = (LAYOUTS[layoutId] || LAYOUTS.jis).rows;
for (let r = 1; r < rows.length; r++) {
for (const key of rows[r]) {
if (!key.lo) continue;
if (key.lo === ch) return { key, shift: false };
if (key.up && key.up === ch) return { key, shift: true };
}
}
return null;
}
function fingerOf(code) {
const id = FINGER_OF[code];
return id ? Object.assign({ id }, FINGERS[id]) : null;
}
global.Typa = global.Typa || {};
global.Typa.Layout = { FINGERS, FINGER_OF, HOME_KEYS, BUMP_KEYS, LAYOUTS, findKey, fingerOf };
})(window);
