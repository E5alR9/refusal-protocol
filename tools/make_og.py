"""
產生分享預覽圖 images/og.jpg（1200×630），給 LINE、Discord、X 等的連結預覽用。
用法：python tools/make_og.py
需要 Pillow，以及 Windows 內建的 Noto Serif TC、Georgia 字型。
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'images' / 'og.jpg'
SPRITE = ROOT / 'images' / 'sprites' / 'claude_warm.webp'
FONTS = Path('C:/Windows/Fonts')

W, H = 1200, 630
OBSIDIAN = (30, 27, 24)
PARCHMENT = (250, 248, 245)
GOLD = (201, 165, 90)
GOLD_BRIGHT = (232, 203, 134)
TERRACOTTA = (217, 119, 6)


def serif(size, weight='Bold'):
    f = ImageFont.truetype(str(FONTS / 'NotoSerifTC-VF.ttf'), size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def background():
    img = Image.new('RGB', (W, H), OBSIDIAN)
    px = img.load()
    # 左側偏暖的光暈，往四角漸暗
    for y in range(H):
        for x in range(W):
            d = math.hypot((x - 380) / 620, (y - 300) / 420)
            glow = max(0.0, 1 - d)
            v = math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2))
            dark = max(0.0, v - 0.7) * 0.9
            r = OBSIDIAN[0] + (110 - OBSIDIAN[0]) * glow ** 1.6
            g = OBSIDIAN[1] + (58 - OBSIDIAN[1]) * glow ** 1.6
            b = OBSIDIAN[2] + (14 - OBSIDIAN[2]) * glow ** 1.6
            px[x, y] = (int(r * (1 - dark)), int(g * (1 - dark)), int(b * (1 - dark)))
    # 淡淡的菱格紋，呼應標題畫面的錦緞底紋
    lines = Image.new('L', (W, H), 0)
    ld = ImageDraw.Draw(lines)
    for k in range(-H, W, 46):
        ld.line([(k, 0), (k + H, H)], fill=14)
        ld.line([(k + H, 0), (k, H)], fill=14)
    img.paste(Image.new('RGB', (W, H), GOLD), (0, 0), lines)
    return img


def frame(draw):
    m = 22
    draw.rectangle([m, m, W - m, H - m], outline=GOLD + (0,), width=1)
    draw.rectangle([m + 6, m + 6, W - m - 6, H - m - 6], outline=(120, 98, 54), width=1)
    c = 34
    for (x, y, sx, sy) in [(m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)]:
        draw.line([(x, y + sy * c), (x, y), (x + sx * c, y)], fill=GOLD_BRIGHT, width=3)


def crest(draw, cx, cy):
    # 闔上的家憲：與標題家徽同一個造型
    s = 0.62
    def r(x0, y0, x1, y1):
        return [cx + (x0 - 100) * s, cy + (y0 - 100) * s, cx + (x1 - 100) * s, cy + (y1 - 100) * s]
    draw.ellipse(r(8, 8, 192, 192), outline=GOLD, width=2)
    draw.rounded_rectangle(r(66, 50, 142, 152), radius=3, fill=(238, 232, 220))
    draw.rounded_rectangle(r(60, 44, 136, 146), radius=3, fill=TERRACOTTA)
    draw.rounded_rectangle(r(60, 44, 72, 146), radius=3, fill=(154, 79, 5))
    draw.rectangle(r(78, 52, 129, 138), outline=GOLD, width=2)
    for i in range(12):
        a = math.radians(i * 30)
        x, y = cx + math.sin(a) * 10 * s * 1.1, cy - 2 * s - math.cos(a) * 10 * s * 1.1
        draw.ellipse([x - 3.4 * s, y - 3.4 * s, x + 3.4 * s, y + 3.4 * s], fill=GOLD)
    draw.ellipse([cx - 4.5 * s, cy - 6.5 * s, cx + 4.5 * s, cy + 2.5 * s], fill=PARCHMENT)
    draw.rounded_rectangle(r(132, 88, 142, 108), radius=2, fill=GOLD)


def main():
    img = background().convert('RGBA')

    # 立繪：取上半身，貼在右側，底部淡出
    sp = Image.open(SPRITE).convert('RGBA')
    scale = 900 / sp.height
    sp = sp.resize((round(sp.width * scale), 900), Image.LANCZOS)
    fade = Image.new('L', sp.size, 255)
    fd = ImageDraw.Draw(fade)
    for y in range(sp.height):
        t = (y - 520) / 120
        if t > 0:
            fd.line([(0, y), (sp.width, y)], fill=max(0, int(255 * (1 - t))))
    alpha = Image.composite(sp.getchannel('A'), Image.new('L', sp.size, 0), fade)
    sp.putalpha(alpha)
    glow = Image.new('RGBA', sp.size, (0, 0, 0, 0))
    glow.putalpha(alpha.filter(ImageFilter.GaussianBlur(28)).point(lambda v: v * 0.55))
    glow_col = Image.new('RGBA', sp.size, TERRACOTTA + (0,))
    glow_col.putalpha(glow.getchannel('A'))
    x0 = W - sp.width + 40
    img.alpha_composite(glow_col, (x0, 18))
    img.alpha_composite(sp, (x0, 18))

    draw = ImageDraw.Draw(img)
    frame(draw)
    crest(draw, 150, 128)

    tx = 84
    title = serif(118)
    draw.text((tx, 196), '拒絕協定', font=title, fill=PARCHMENT)
    en = ImageFont.truetype(str(FONTS / 'georgiaz.ttf'), 34)
    draw.text((tx + 4, 342), 'Project: Refusal Protocol', font=en, fill=GOLD_BRIGHT)
    draw.line([(tx + 4, 404), (tx + 420, 404)], fill=GOLD, width=1)
    sub = serif(34, 'SemiBold')
    draw.text((tx + 2, 424), '安思羅皮克家的克勞德大小姐', font=sub, fill=PARCHMENT)
    small = serif(24, 'Regular')
    draw.text((tx + 2, 480), '家憲、逐客令與第十三響之間的一夜　·　五種結局', font=small, fill=(214, 204, 188))
    tiny = serif(19, 'Regular')
    draw.text((tx + 2, 548), '非官方同人視覺小說　·　瀏覽器直接遊玩', font=tiny, fill=(160, 146, 124))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.convert('RGB').save(OUT, 'JPEG', quality=88, optimize=True, progressive=True)
    print(OUT, OUT.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
