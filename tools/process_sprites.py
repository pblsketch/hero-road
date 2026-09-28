# -*- coding: utf-8 -*-
"""도트 스프라이트 시트·소품 원본(assets/raw/sp_*.png, props_*.png)을 게임용 아틀라스로 만든다.

    python tools/process_sprites.py [이름...]

영상에서 배운 규칙(「관동별곡」 process_assets.py에서 가져옴):
  1) 배경 제거: 마젠타 단색 배경을 색으로 빼고 가장자리 번짐을 걷어 낸다.
  2) 프레임 자동 검출: 행별 기대 개수에 맞춰 빈 틈으로 자른다(격자가 조금 어긋나도 괜찮다).
  3) 발밑 피벗: 발 부분의 가운데를 기준으로 모든 프레임을 같은 칸에 정렬한다(걸을 때 튀지 않게).
  4) PPU 기준 축소: 땅 한 칸 32px. 어른 키 48px, 아이 36px을 기준으로 같은 배율을 적용한다.
결과: assets/sprites/<이름>.png + assets/sprites.json(프레임 크기·피벗·동작)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "assets", "raw")
OUT = os.path.join(ROOT, "assets", "sprites")
os.makedirs(OUT, exist_ok=True)
META_PATH = os.path.join(ROOT, "assets", "sprites.json")
META = json.load(open(META_PATH, encoding="utf-8")) if os.path.exists(META_PATH) else {}
TILE = 32


def load_rgba(name):
    im = Image.open(os.path.join(RAW, name + ".png")).convert("RGBA")
    a = np.array(im).astype(np.int16)
    rgb, alpha = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = (r > 170) & (b > 170) & (g < 110) & (np.abs(r - b) < 70)
    alpha = np.where(magenta, 0, alpha)
    spill = (alpha > 0) & (r > g + 40) & (b > g + 40)
    m = np.minimum(r, b)
    rgb[..., 0] = np.where(spill, np.minimum(r, g + (m - g) // 3 + 20), r)
    rgb[..., 2] = np.where(spill, np.minimum(b, g + (m - g) // 3 + 20), b)
    near = ndimage.binary_dilation(alpha == 0, iterations=1) & (alpha > 0)
    weak = near & (r > 150) & (b > 150) & (g < 140)
    alpha = np.where(weak, 0, alpha)
    return np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8)


def split_1d(proj, n, min_gap=2):
    """1차원 투영에서 내용 구간을 n개로 나눈다. 넓은 빈 틈부터 고르고, 치우치면 균등 분할점 근처의 틈을 쓴다."""
    idx = np.nonzero(proj > 0)[0]
    if len(idx) == 0:
        return []
    lo, hi = idx.min(), idx.max() + 1
    gaps, run = [], None
    for x in range(lo, hi):
        if proj[x] == 0:
            run = x if run is None else run
        elif run is not None:
            if x - run >= min_gap:
                gaps.append((run, x))
            run = None
    if n <= 1:
        return [(lo, hi)]

    def segs(cuts):
        pts = [lo] + list(cuts) + [hi]
        return [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]

    def ok(sg):
        ws = [b - a for a, b in sg]
        return min(ws) > 0.45 * np.median(ws)

    by_width = sorted(gaps, key=lambda g: -(g[1] - g[0]))[: n - 1]
    cuts = sorted((a + b) // 2 for a, b in by_width)
    if len(cuts) == n - 1 and ok(segs(cuts)):
        return segs(cuts)
    cuts, W = [], hi - lo
    for i in range(1, n):
        target = lo + W * i / n
        cand = [((a + b) // 2) for a, b in gaps if abs((a + b) / 2 - target) < W / n * 0.45]
        if cand:
            cuts.append(min(cand, key=lambda c: abs(c - target)))
        else:
            w0, w1 = int(target - W / n * 0.3), int(target + W / n * 0.3)
            cuts.append(w0 + int(np.argmin(proj[w0:w1])))
    return segs(sorted(cuts))


def clean_mask(arr):
    mask = arr[..., 3] > 40
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return np.isin(lab, np.nonzero(sizes >= 30)[0] + 1)


def grid_boxes(arr, counts):
    clean = clean_mask(arr)
    rows = split_1d(clean.sum(axis=1), len(counts), min_gap=3)
    out = []
    for (y0, y1), c in zip(rows, counts):
        cols = split_1d(clean[y0:y1].sum(axis=0), c, min_gap=2)
        out.append([(x0, y0, x1, y1) for x0, x1 in cols])
    return out, clean


def crop(arr, mask, b):
    x0, y0, x1, y1 = b
    sub = arr[y0:y1, x0:x1].copy()
    sub[..., 3] = np.where(mask[y0:y1, x0:x1], sub[..., 3], 0)
    ys, xs = np.nonzero(sub[..., 3] > 40)
    if len(ys):
        sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return sub


def foot_x(sub):
    """아래쪽 12% 줄의 불투명 픽셀 가운데 = 발밑 피벗 x"""
    a = sub[..., 3] > 100
    band = a[int(a.shape[0] * 0.88):]
    xs = np.nonzero(band)[1]
    if len(xs) == 0:
        xs = np.nonzero(a)[1]
    return float(np.median(xs))


def shrink(sub, s, palette=40):
    """알파를 곱한 뒤 BOX로 줄이고 색 수를 줄여 진짜 도트처럼 만든다."""
    im = Image.fromarray(sub, "RGBA")
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    arr = np.array(im).astype(np.float32)
    arr[..., :3] *= arr[..., 3:4] / 255.0
    pm = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA").resize((w, h), Image.BOX)
    p = np.array(pm).astype(np.float32)
    al = p[..., 3:4]
    p[..., :3] = np.where(al > 0, p[..., :3] * 255.0 / np.maximum(al, 1), 0)
    p[..., 3] = np.where(p[..., 3] > 110, 255, 0)
    out = Image.fromarray(p.clip(0, 255).astype(np.uint8), "RGBA")
    rgb = out.convert("RGB").quantize(colors=palette, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    return Image.merge("RGBA", (*rgb.split(), out.getchannel("A")))


# 동작 배치: 걷기 3행(아래·왼쪽·위) × 4, 공격(또는 도술) 3행 × 3
WALK_ROWS = [[("walk_down", 4)], [("walk_left", 4)], [("walk_up", 4)]]
ACT_ROWS = WALK_ROWS + [[("atk_down", 3)], [("atk_left", 3)], [("atk_up", 3)]]
FPS = {"walk_down": 8, "walk_left": 8, "walk_up": 8, "atk_down": 16, "atk_left": 16, "atk_up": 16}


def character(key, layout, height, cell=(64, 64), raw=None):
    """height: 앞모습 첫 프레임의 목표 키(px). 모든 프레임에 같은 배율을 쓴다. raw: 다른 원본 시트에서 크기만 달리 뽑을 때"""
    arr = load_rgba(raw or key)
    want = [sum(n for _, n in row) for row in layout]
    rows, clean = grid_boxes(arr, want)
    first = crop(arr, clean, rows[0][0])
    scale = height / first.shape[0]
    fw, fh = cell
    px, py = fw // 2, fh - 2
    anims, frames = {}, []
    for ri, row in enumerate(layout):
        items = rows[ri] if ri < len(rows) else []
        k = 0
        for an, n in row:
            fl = []
            for _ in range(n):
                if k >= len(items):
                    break
                sub = crop(arr, clean, items[k]); k += 1
                cx = foot_x(sub)
                im = shrink(sub, scale)
                fl.append((im, cx * scale))
            anims[an] = {"start": len(frames), "n": len(fl), "fps": FPS.get(an, 8)}
            frames.extend(fl)
    cols = 8
    atlas = Image.new("RGBA", (cols * fw, ((len(frames) + cols - 1) // cols) * fh), (0, 0, 0, 0))
    for i, (im, cx) in enumerate(frames):
        x, y = round(px - cx), py - im.height
        if x < 0 or y < 0 or x + im.width > fw:
            print(f"  ! {key} frame {i} {im.size} 칸 밖으로 나감")
        atlas.alpha_composite(im, ((i % cols) * fw + max(0, x), (i // cols) * fh + max(0, y)))
    atlas.save(os.path.join(OUT, key + ".png"))
    META[key] = {"img": f"assets/sprites/{key}.png", "fw": fw, "fh": fh, "px": px, "py": py, "cols": cols, "anims": anims}
    print(f"{key}: {len(frames)} frames ×{scale:.3f}", {a: v['n'] for a, v in anims.items()})


def props(key, defs, rows_counts):
    """defs: [(이름, 가로 칸 수, 발자국(충돌) 비율 (x0, y0, x1, y1) — 그림 안에서 막히는 부분)] 행 순서대로"""
    arr = load_rgba(key)
    rows, clean = grid_boxes(arr, rows_counts)
    boxes = [b for row in rows for b in row]
    for (name, tiles_w, foot), b in zip(defs, boxes):
        sub = crop(arr, clean, b)
        s = tiles_w * TILE / sub.shape[1]
        im = shrink(sub, s, palette=48)
        im.save(os.path.join(OUT, name + ".png"))
        w, h = im.size
        fx0, fy0, fx1, fy1 = foot
        META[name] = {"img": f"assets/sprites/{name}.png", "w": w, "h": h,
                      "foot": [round(fx0 * w), round(fy0 * h), round(fx1 * w), round(fy1 * h)]}
        print(f"  prop {name}: {w}x{h}")


HEROES_ACT = {"sp_hero_m_youth": 48, "sp_hero_m_general": 50, "sp_hero_f_scholar": 48, "sp_hero_f_general": 50, "sp_hero_f_sage": 48}
HEROES_WALK = {"sp_hero_m_child": 36, "sp_hero_f_child": 36, "sp_hero_f_lady": 48}
ENEMIES = {"sp_assassin": 46, "sp_barbarian": 48, "sp_phantom": 50}
# 실시간 보스전: 적장은 크게(원본 시트를 큰 키로 다시 줄여 픽셀이 고르게)
BOSSES = {"sp_boss": ("sp_boss", 72), "sp_phantom_boss": ("sp_phantom", 66), "sp_barbarian_boss": ("sp_barbarian", 64)}
NPC_H = {"sp_emperor": 50, "sp_enemy_general": 52, "sp_listener": 42, "sp_servant": 40}

BUILDINGS = [("pr_house", 6, (0.02, 0.35, 0.98, 0.97)), ("pr_cottage", 4, (0.03, 0.3, 0.97, 0.97)), ("pr_palace", 9, (0.02, 0.3, 0.98, 0.97)),
             ("pr_temple", 6, (0.02, 0.35, 0.98, 0.97)), ("pr_shrine", 3, (0.02, 0.35, 0.98, 0.97)), ("pr_gate", 4, (0.0, 0.35, 1.0, 0.97))]
NATURE = [("pr_pine", 3, (0.4, 0.8, 0.6, 1.0)), ("pr_willow", 3, (0.4, 0.8, 0.6, 1.0)), ("pr_plum", 3, (0.4, 0.8, 0.6, 1.0)), ("pr_bamboo", 2, (0.15, 0.7, 0.85, 1.0)),
          ("pr_bush", 1.5, (0.1, 0.4, 0.9, 1.0)), ("pr_boulder", 2, (0.05, 0.35, 0.95, 1.0)), ("pr_rocks", 1.5, (0.05, 0.3, 0.95, 1.0)), ("pr_reeds", 1.5, (0, 0, 0, 0)),
          ("pr_flowers", 1.5, (0, 0, 0, 0)), ("pr_stump", 1, (0.1, 0.3, 0.9, 1.0)), ("pr_lotus", 2, (0, 0, 0, 0)), ("pr_maple", 3, (0.4, 0.8, 0.6, 1.0))]
OBJECTS = [("pr_well", 2, (0.05, 0.45, 0.95, 1.0)), ("pr_target", 1.5, (0.2, 0.6, 0.8, 1.0)), ("pr_dummy", 1, (0.2, 0.7, 0.8, 1.0)), ("pr_altar", 2, (0.05, 0.4, 0.95, 1.0)),
           ("pr_tent", 4, (0.05, 0.4, 0.95, 1.0)), ("pr_bookshelf", 2, (0.0, 0.5, 1.0, 1.0)), ("pr_table", 2, (0.0, 0.4, 1.0, 1.0)), ("pr_jars", 2, (0.05, 0.4, 0.95, 1.0)),
           ("pr_cart", 2.5, (0.05, 0.4, 0.95, 1.0)), ("pr_banner", 1, (0.3, 0.85, 0.7, 1.0)), ("pr_bonfire", 1.5, (0.15, 0.5, 0.85, 1.0)), ("pr_lantern", 1, (0.15, 0.6, 0.85, 1.0)),
           ("pr_stall", 3, (0.02, 0.45, 0.98, 1.0)), ("pr_boat", 3, (0.05, 0.3, 0.95, 1.0)), ("pr_chest", 1.5, (0.05, 0.4, 0.95, 1.0)), ("pr_drum", 1.5, (0.1, 0.5, 0.9, 1.0))]


def run(names):
    for f in sorted(os.listdir(RAW)):
        key = f[:-4]
        if not f.endswith(".png") or (names and key not in names):
            continue
        try:
            if key in BOSSES or any(v[0] == key for v in BOSSES.values()):
                for bk, (rk, bh) in BOSSES.items():
                    if rk == key:
                        character(bk, ACT_ROWS, bh, cell=(192, 120), raw=rk)
                if key == "sp_boss":
                    continue
            if key in HEROES_ACT:
                character(key, ACT_ROWS, HEROES_ACT[key], cell=(96, 80))
            elif key in ENEMIES:
                character(key, ACT_ROWS, ENEMIES[key], cell=(96, 80))
            elif key in HEROES_WALK:
                character(key, WALK_ROWS, HEROES_WALK[key])
            elif key.startswith("sp_"):
                character(key, WALK_ROWS, NPC_H.get(key, 46))
            elif key == "props_buildings":
                props(key, BUILDINGS, [3, 3])
            elif key == "props_nature":
                props(key, NATURE, [6, 6])
            elif key == "props_objects":
                props(key, OBJECTS, [6, 6, 4])
        except Exception as e:  # 한 장이 잘못돼도 나머지는 만든다
            print(f"  ! {key}: {e}")
    json.dump(META, open(META_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # file://로 열어도 읽히게 같은 내용을 스크립트로도 쓴다(fetch 없이 <script>로 불러옴)
    with open(os.path.join(ROOT, "js", "data", "sprites.js"), "w", encoding="utf-8") as f:
        f.write("'use strict';\n// 자동 생성 파일(tools/process_sprites.py) — 고치지 마세요. 스프라이트 크기·발밑 피벗·동작·소품 발자국\nwindow.SPRITES = ")
        json.dump(META, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")


if __name__ == "__main__":
    run(set(sys.argv[1:]))
