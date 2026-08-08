/* Typa — src/icons.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const PATHS = {
home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
keyboard: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 13h.01M9.5 13h.01M13 13h.01M16.5 13h.01M8 16.2h8"/>',
chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 17v-5M12.5 17V8M17 17v-7"/>',
gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/>',
back: '<path d="M15 5 8 12l7 7"/>',
next: '<path d="M9 5l7 7-7 7"/>',
up: '<path d="M5 15l7-7 7 7"/>',
hand: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V4.8a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V6.8a1.5 1.5 0 0 1 3 0v7.4a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 13.6a1.6 1.6 0 0 1 2.6-1.8L9 14.5"/>',
letter: '<path d="M5 19 12 5l7 14"/><path d="M7.8 14.5h8.4"/>',
word: '<path d="M4 7h16M4 12h11M4 17h7"/>',
text: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5"/>',
bolt: '<path d="M13.5 3 5.5 13.5h5L10 21l8.5-10.5h-5z"/>',
star: '<path d="m12 3.8 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17l-5.2 2.8 1-5.8L3.6 9.9l5.8-.8z"/>',
check: '<path d="m4.5 12.5 5 5 10-11"/>',
close: '<path d="M6 6l12 12M18 6 6 18"/>',
play: '<path d="M7.5 4.8 19 12 7.5 19.2z"/>',
retry: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.5V10h-5.5"/>',
info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.6h.01"/>',
target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6"/>',
clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.4 2"/>',
send: '<path d="M4.5 12 20 4.5 16 20l-4.5-5.5z"/><path d="M11.5 14.5 20 4.5"/>',
lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 4H19v14.5H6.5a2 2 0 0 0-2 2z"/><path d="M4.5 5.5v14.5"/>',
finger: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7"/><path d="M9.5 11 12 8.5l2.5 2.5"/>',
trophy: '<path d="M7 4.5h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3 3 0 0 0 7.5 10.5M17 6h2.5v1.5a3 3 0 0 1-3 3"/><path d="M12 13.5V17M9 20h6"/>',
fire: '<path d="M12 3.2c.6 2.6-1 3.7-2.3 5.1a6.5 6.5 0 0 0-1.9 4.5 6.2 6.2 0 0 0 12.4 0c0-2.6-1.4-4-2.6-5.2"/><path d="M12 20a3 3 0 0 1-1.6-5.6c.9-.6 1.4-1.3 1.6-2.4.9.8 1.7 1.6 2.2 2.5A3 3 0 0 1 12 20z"/>',
medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="m8.5 9.4-2-6.2M15.5 9.4l2-6.2"/><path d="m12 12 .9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9 14.2l2.1-.3z"/>',
grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17M15 3.5v17"/>',
trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.8 6.5 7.7 20h8.6l.9-13.5"/><path d="M10.5 10v6M13.5 10v6"/>',
timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4.2l2.8 1.6"/><path d="M9.5 2.8h5"/>',
sparkle: '<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6-5.5-1.7L10.3 9z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
box: '<path d="M3.5 8.5h17v11h-17z"/><path d="M2.5 4.5h19v4h-19z"/><path d="M12 4.5v15"/><path d="M9 12h6"/>',
map: '<path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z"/><path d="M9 4.5v12.7M15 6.8v12.7"/>',
palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.8 0-1.3-1-1.6-1-2.7 0-.8.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-3.9-4-7-9-7z"/><path d="M7.5 10h.01M11 7.2h.01M15.4 8.3h.01"/>',
save: '<path d="M5.5 3.5h9L19 8v12.5H5.5z"/><path d="M14 3.5V8h4.5"/><path d="M8.5 13h7M8.5 16.5h5"/>',
crown: '<path d="M4 18.5h16"/><path d="m4 8 3.5 3L12 5l4.5 6L20 8l-1.5 8h-13z"/>',
smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.6 10h.01M15.4 10h.01"/><path d="M8.4 14.2a4.4 4.4 0 0 0 7.2 0"/>'
};
function icon(name, cls) {
const body = PATHS[name] || PATHS.info;
return `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" width="24" height="24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true" focusable="false">${body}</svg>`;
}
global.Typa = global.Typa || {};
global.Typa.icon = icon;
global.Typa.ICON_NAMES = Object.keys(PATHS);
})(window);
