#!/usr/bin/env python3
"""Typa のアイコンを生成します（外部ライブラリなし・標準ライブラリだけで PNG を書き出します）。

    python3 icons/make_icons.py

デザインは「青い角丸の板に、白い T と キーボードの3つのキー」です。
絵文字やイラストを使わず、小さく表示しても形が読み取れる面積の大きい図形だけで
できているので、ホーム画面の小さなアイコンでも何のアプリか分かります。

maskable 版は、Android がアイコンを円などに切り抜いても図が欠けないよう、
安全領域（中央 80%）の内側に図を収めています。
"""
import struct
import zlib
import os

BG = (29, 78, 216)        # #1d4ed8 ブランドの青
BG2 = (37, 99, 235)       # ほんの少し明るい青（上から下へのグラデーション）
FG = (255, 255, 255)
SS = 3                    # スーパーサンプリング（かどをなめらかにします）


def rounded_rect(x, y, w, h, r):
    """角丸長方形の内側かどうかを返す判定関数を作ります。"""
    def inside(px, py):
        if px < x or py < y or px > x + w or py > y + h:
            return False
        cx = min(max(px, x + r), x + w - r)
        cy = min(max(py, y + r), y + h - r)
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    return inside


def build(size, maskable=False):
    """1枚ぶんの RGBA ピクセルを作ります。"""
    # maskable は 円に切り抜かれても欠けないよう、図を中央 78% に収めます
    pad = size * 0.11 if maskable else 0.0
    inner = size - pad * 2
    plate = rounded_rect(pad, pad, inner, inner, inner * (0.30 if not maskable else 0.22))

    # T の形（たて棒とよこ棒）
    bar_h = inner * 0.13
    bar_w = inner * 0.54
    bar_x = pad + (inner - bar_w) / 2
    bar_y = pad + inner * 0.20
    stem_w = inner * 0.15
    stem_x = pad + (inner - stem_w) / 2
    stem_y = bar_y
    stem_h = inner * 0.40
    top_bar = rounded_rect(bar_x, bar_y, bar_w, bar_h, bar_h / 2)
    stem = rounded_rect(stem_x, stem_y, stem_w, stem_h, stem_w / 3)

    # 下のキーボード（3つのキー）
    key_y = pad + inner * 0.70
    key_h = inner * 0.12
    key_w = inner * 0.15
    gap = inner * 0.055
    total = key_w * 3 + gap * 2
    key_x0 = pad + (inner - total) / 2
    keys = [rounded_rect(key_x0 + i * (key_w + gap), key_y, key_w, key_h, key_h * 0.35)
            for i in range(3)]

    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    fx = px + (sx + 0.5) / SS
                    fy = py + (sy + 0.5) / SS
                    if not plate(fx, fy):
                        continue
                    if top_bar(fx, fy) or stem(fx, fy) or any(k(fx, fy) for k in keys):
                        c = FG
                    else:
                        t = fy / size
                        c = (int(BG[0] + (BG2[0] - BG[0]) * t),
                             int(BG[1] + (BG2[1] - BG[1]) * t),
                             int(BG[2] + (BG2[2] - BG[2]) * t))
                    r += c[0]
                    g += c[1]
                    b += c[2]
                    a += 255
            n = SS * SS
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                hits = a // 255
                row += bytes((r // hits, g // hits, b // hits, a // n))
        rows.append(bytes(row))
    return rows


def write_png(path, rows, size):
    raw = b''.join(b'\x00' + row for row in rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = (b'\x89PNG\r\n\x1a\n' +
           chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) +
           chunk(b'IDAT', zlib.compress(raw, 9)) +
           chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print(f'{path} ({size}x{size}, {len(png)} bytes)')


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    targets = [
        ('favicon-32.png', 32, False),
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('apple-touch-icon.png', 180, True),   # iOS は角を自分で丸めるので余白つき
        ('icon-maskable-192.png', 192, True),
        ('icon-maskable-512.png', 512, True),
    ]
    for name, size, maskable in targets:
        write_png(os.path.join(here, name), build(size, maskable), size)


if __name__ == '__main__':
    main()
