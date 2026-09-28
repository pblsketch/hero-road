# -*- coding: utf-8 -*-
"""링크를 나눌 때(카카오톡·문자·SNS) 뜨는 썸네일(assets/ui/og-thumb.jpg, 1200×630)을 만든다.

    python tools/make_og.py [게임 화면 스크린숏]

- 바탕: 제목 화면 그림(assets/ui/title_art.webp), 아래 띠에 제목.
- 오른쪽: 실제 도트 맵 화면 카드(기본: tests/shots/world-desktop/ch3_2walk.png — tests/world_shots.mjs가 만든다).
- 카카오톡은 한 번 읽은 썸네일을 오래 기억하므로, 그림을 바꾸면 파일 이름도 바꾸고 index.html의 og:image를 고친다.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_assets import ROOT, serif_font  # noqa: E402

W, H = 1200, 630
OUT = os.path.join(ROOT, 'assets', 'ui', 'og-thumb.jpg')
SHOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tests', 'shots', 'world-desktop', 'ch3_2walk.png')
CROP = (205, 190, 900, 722)  # 3장 고향 마을: 초가·대청·마을 사람·매화나무


def main():
    t = Image.open(os.path.join(ROOT, 'assets', 'ui', 'title_art.webp')).convert('RGB')
    r = max(W / t.width, H / t.height)
    t = t.resize((round(t.width * r), round(t.height * r)), Image.LANCZOS)
    t = t.crop(((t.width - W) // 2, (t.height - H) // 2, (t.width - W) // 2 + W, (t.height - H) // 2 + H)).convert('RGBA')

    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rectangle([0, H - 170, W, H], fill=(239, 226, 195, 232))
    t = Image.alpha_composite(t, ov)

    # 도트 화면 카드
    shot = Image.open(SHOT).convert('RGB').crop(CROP)
    cw = 390
    shot = shot.resize((cw, round(shot.height * cw / shot.width)), Image.LANCZOS)
    pad = 8
    x0, y0 = W - cw - 2 * pad - 28, H - shot.height - 2 * pad - 26
    card = Image.new('RGBA', (cw + 2 * pad, shot.height + 2 * pad), (255, 248, 232, 255))
    card.paste(shot, (pad, pad))
    cd = ImageDraw.Draw(card)
    cd.rectangle([0, 0, card.width - 1, card.height - 1], outline=(42, 33, 25, 255), width=3)
    cd.rectangle([pad - 1, pad - 1, pad + cw, pad + shot.height], outline=(42, 33, 25, 160), width=1)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([x0 + 8, y0 + 10, x0 + card.width + 8, y0 + card.height + 10], fill=(30, 20, 10, 120))
    t = Image.alpha_composite(t, shadow.filter(ImageFilter.GaussianBlur(8)))
    t.alpha_composite(card, (x0, y0))
    # 카드 위 꼬리표
    d = ImageDraw.Draw(t)
    tag = '실제 게임 화면'
    ft = serif_font(22, 800)
    tw = d.textlength(tag, font=ft)
    d.rounded_rectangle([x0 + 14, y0 - 16, x0 + 14 + tw + 24, y0 + 18], radius=8, fill=(179, 52, 42, 255))
    d.text((x0 + 26, y0 + 1), tag, font=ft, fill=(255, 245, 235), anchor='lm')

    # 제목 띠
    brush = os.path.join(ROOT, 'tools', 'fonts_src', 'NanumBrushScript-Regular.ttf')
    fb = ImageFont.truetype(brush, 100) if os.path.exists(brush) else serif_font(72)
    d.text((52, H - 92), '영웅의 길', font=fb, fill=(42, 33, 25), anchor='lm')
    d.text((372, H - 110), '영웅소설 도트 RPG', font=serif_font(40, 800), fill=(179, 52, 42), anchor='lm')
    d.text((374, H - 60), '영웅의 일대기를 직접 걷는 게임', font=serif_font(26, 600), fill=(70, 55, 40), anchor='lm')

    t.convert('RGB').save(OUT, quality=86, optimize=True, progressive=True)
    print(OUT, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
