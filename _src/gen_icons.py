# -*- coding: utf-8 -*-
"""生成 PWA 图标（纯标准库，浅紫色调）"""
import zlib, struct, math, time, os

STOPS = [(0.00, (0xB8, 0xA8, 0xE0)),
         (0.42, (0xC9, 0xBC, 0xEC)),
         (0.74, (0xDA, 0xD0, 0xF4)),
         (1.00, (0xEC, 0xE6, 0xFA))]

DOTS = [(0.245, 0.740, 0.016), (0.775, 0.245, 0.013),
        (0.715, 0.780, 0.010), (0.300, 0.295, 0.013)]


def lerp(a, b, t):
    return a + (b - a) * t


def grad(t):
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    for i in range(len(STOPS) - 1):
        t0, c0 = STOPS[i]
        t1, c1 = STOPS[i + 1]
        if t <= t1:
            k = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            return (lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k))
    return STOPS[-1][1]


def make_sampler(star_r, star_cy):
    def sample(u, v):
        r, g, b = grad(u * 0.5 + v * 0.5)
        # 左上柔光
        dx, dy = u - 0.28, v - 0.22
        a = 1.0 - math.sqrt(dx * dx + dy * dy) / 0.58
        if a > 0:
            a *= 0.40
            r, g, b = lerp(r, 255, a), lerp(g, 255, a), lerp(b, 255, a)
        # 右下压暗
        dx, dy = u - 0.96, v - 1.02
        a = 1.0 - math.sqrt(dx * dx + dy * dy) / 0.72
        if a > 0:
            a *= 0.22
            r, g, b = lerp(r, 0x8B, a), lerp(g, 0x7C, a), lerp(b, 0xB8, a)
        # 柔和四点星
        sx = abs(u - 0.5) / star_r
        sy = abs(v - star_cy) / star_r
        if sx ** 0.55 + sy ** 0.55 <= 1.0:
            k = max(sx, sy) ** 0.7
            r, g, b = 255.0, lerp(255, 0xF4, k), lerp(255, 0xEE, k)
        for px, py, pr in DOTS:
            ddx, ddy = u - px, v - py
            if ddx * ddx + ddy * ddy <= pr * pr:
                r, g, b = 255.0, 255.0, 255.0
        return r, g, b
    return sample


def render(size, star_r, star_cy, ss=3):
    sample = make_sampler(star_r, star_cy)
    inv = 1.0 / size
    step = 1.0 / ss
    n = ss * ss
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = 0.0
            for sy in range(ss):
                v = (y + (sy + 0.5) * step) * inv
                for sx in range(ss):
                    u = (x + (sx + 0.5) * step) * inv
                    pr, pg, pb = sample(u, v)
                    r += pr; g += pg; b += pb
            row.append(int(r / n + 0.5)); row.append(int(g / n + 0.5)); row.append(int(b / n + 0.5))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
    os.makedirs(out, exist_ok=True)
    jobs = [('icon-192.png', 192, 0.29, 0.46, 3),
            ('icon-512.png', 512, 0.29, 0.46, 2),
            ('icon-maskable-512.png', 512, 0.20, 0.50, 2)]
    for name, size, sr, cy, ss in jobs:
        write_png(os.path.join(out, name), size, render(size, sr, cy, ss))
        print('generated', name)
