"""立繪後製：套用去背遮罩、統一裁切、輸出 WebP。

  python tools/make_masks.py                   先用本機 ComfyUI 的 BiRefNet 產生遮罩（images/sprites_mask）
  python tools/process_sprites.py              再處理 images/sprites_raw 全部 → images/sprites
  python tools/process_sprites.py --preview    另外輸出深色背景預覽到 images/sprites_preview

原圖是白底，半透明的邊緣其實是「顏色 × a + 白 × (1 − a)」。套用遮罩時順便解預乘，
把白色從邊緣拿掉，放在深色場景上才不會有白邊。
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'images', 'sprites_raw')
MASKS = os.path.join(ROOT, 'images', 'sprites_mask')
OUT = os.path.join(ROOT, 'images', 'sprites')
PREVIEW = os.path.join(ROOT, 'images', 'sprites_preview')

# 正面立繪共用的裁切框（在 832×1248 的原圖上），頭頂到腳踝、涵蓋整個髮寬，2:3；再縮成 640×960
CROP = (36, 0, 796, 1140)
SIZE = (640, 960)
EDGE_FADE = 12            # 左右與下緣的 alpha 漸隱寬度（像素），萬一還有被切到的髮梢也不會是硬邊
# 背影、稽核官這類構圖不同的，先依人物外框縮放對齊到基準圖的人物
ALIGN_TO_BASE = {'claude_back', 'auditor'}


def hair_gap(rgb, alpha):
    """BiRefNet 偶爾把長髮之間被圍住的白底當成人物。逐一檢查人物範圍內每塊封閉的純白區域：
    外圍一圈「有顏色的」像素（略過黑色外框線與淺白抗鋸齒）有七成以上是橘色頭髮，才當成髮隙挖掉。
    裙子的白底旁邊是米色陰影與布料，即使鄰接橘色裙片也到不了七成；太大塊的白區一律保留。"""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lo = rgb.min(axis=2)
    pure = ((lo >= 248) & ((rgb.max(axis=2) - lo) <= 6) & (alpha > 0.5)).astype(np.uint8)
    hair = (r > 170) & (g > 70) & (g < 200) & (b < 140) & (r - b > 90)
    lum = (r * 3 + g * 6 + b) / 10
    colored = (lum > 90) & (lum < 225)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(pure, connectivity=4)
    gap = np.zeros(pure.shape, np.float32)
    kernel = np.ones((5, 5), np.uint8)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 12 or area > 6000:
            continue
        y0, y1, x0, x1 = max(0, y - 4), y + h + 4, max(0, x - 4), x + w + 4
        comp = (labels[y0:y1, x0:x1] == i).astype(np.uint8)
        ring = cv2.dilate(comp, kernel).astype(bool) & ~comp.astype(bool) & colored[y0:y1, x0:x1]
        if ring.sum() >= 6 and hair[y0:y1, x0:x1][ring].mean() >= 0.7:
            gap[y0:y1, x0:x1] = np.maximum(gap[y0:y1, x0:x1], comp)
    # 擴張一點再羽化，把縫隙邊緣的淺色抗鋸齒一起帶走
    gap = cv2.dilate(gap, np.ones((3, 3), np.uint8))
    return cv2.GaussianBlur(gap, (5, 5), 0)


def fade_edges(img):
    a = np.asarray(img).copy()
    h, w = a.shape[:2]
    ramp = np.linspace(0.0, 1.0, EDGE_FADE, dtype=np.float32)
    f = np.ones((h, w), np.float32)
    f[:, :EDGE_FADE] *= ramp
    f[:, -EDGE_FADE:] *= ramp[::-1]
    f[-EDGE_FADE:, :] *= ramp[::-1][:, None]
    a[..., 3] = (a[..., 3].astype(np.float32) * f).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def to_rgba(name):
    rgb = np.asarray(Image.open(os.path.join(RAW, name + '.png')).convert('RGB')).astype(np.float32)
    mask = Image.open(os.path.join(MASKS, name + '.png')).convert('L')
    if mask.size != (rgb.shape[1], rgb.shape[0]):
        mask = mask.resize((rgb.shape[1], rgb.shape[0]), Image.LANCZOS)
    alpha = np.asarray(mask).astype(np.float32) / 255.0
    alpha[alpha < 0.02] = 0.0
    alpha *= 1.0 - hair_gap(rgb, alpha)
    a = np.clip(alpha, 1e-3, 1.0)[..., None]
    col = np.clip((rgb - 255.0 * (1.0 - a)) / a, 0, 255)
    return Image.fromarray(np.dstack([col, alpha * 255.0]).astype(np.uint8), 'RGBA')


def figure_box(rgba):
    a = np.asarray(rgba)[..., 3]
    ys, xs = np.where(a > 128)
    return xs.min(), ys.min(), xs.max(), ys.max()


def align(rgba, ref_box, size):
    """把人物縮放、平移到和基準圖人物相同的頭頂、腳底與水平中心。"""
    x0, y0, x1, y1 = figure_box(rgba)
    rx0, ry0, rx1, ry1 = ref_box
    s = (ry1 - ry0) / (y1 - y0)
    fig = rgba.crop((x0, y0, x1 + 1, y1 + 1))
    fig = fig.resize((max(1, round(fig.width * s)), max(1, round(fig.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    cx = (rx0 + rx1) / 2
    canvas.paste(fig, (round(cx - fig.width / 2), ry0), fig)
    return canvas


def main():
    preview = '--preview' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    if preview:
        os.makedirs(PREVIEW, exist_ok=True)
    names = sorted(f[:-4] for f in os.listdir(RAW) if f.endswith('.png') and not f.startswith('_'))
    base = to_rgba('claude_base')
    ref_box = figure_box(base)
    for name in names:
        if name == 'claude_base':
            continue
        rgba = to_rgba(name)
        if name in ALIGN_TO_BASE:
            rgba = align(rgba, ref_box, base.size)
        sprite = fade_edges(rgba.crop(CROP).resize(SIZE, Image.LANCZOS))
        path = os.path.join(OUT, name + '.webp')
        sprite.save(path, 'WEBP', quality=90, method=6)
        if preview:
            bg = Image.new('RGBA', sprite.size, (30, 27, 24, 255))
            bg.alpha_composite(sprite)
            bg.convert('RGB').save(os.path.join(PREVIEW, name + '.png'))
        print(f'{name}: {sprite.size[0]}x{sprite.size[1]}, {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    main()
