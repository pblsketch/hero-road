# -*- coding: utf-8 -*-
"""도트(픽셀아트) 스프라이트 시트 프롬프트(tools/prompts/sp_*.txt, props_*.txt)와 manifest_sprites.tsv를 만든다.

    python tools/make_sprites.py

- 탑뷰(3/4 내려다보기) RPG. PPU = 32(땅 한 칸 32x32 px). 어른 키 약 1.5칸(48px), 아이 약 1.1칸.
- 스프라이트 시트 규칙: 마젠타 단색 배경, 프레임끼리 넓게 띄운 격자, 행마다 발밑 기준선(발밑 피벗) 통일,
  동작마다 프레임 수를 다르게(걷기 4, 공격 3, 도술 3). 오른쪽 방향은 왼쪽을 뒤집어 쓴다.
- 인물은 목판화 초상(assets/raw/pt_*.png)을 참조로 넘겨 옷·색·머리 모양을 맞춘다(gen.ps1 RefMode char).
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDIR = os.path.join(ROOT, "tools", "prompts")

SHEET = (
    "Pixel art sprite sheet for a top-down 2D RPG in the style of 16-bit SNES-era JRPG overworld sprites "
    "(3/4 top-down view), crisp hard-edged pixels, no anti-aliasing, limited palette, dark 1-pixel outlines, "
    "cute chibi proportions about 2 heads tall. Solid flat pure magenta background (#FF00FF) everywhere behind "
    "the sprites, no gradients, no floor, no cast shadows on the background. Frames are laid out in a strict "
    "invisible grid with wide empty magenta gaps so that no frame touches or overlaps another, even weapons, "
    "sleeves and hair stay inside their own cell. Every frame is drawn at exactly the same scale. Within each row "
    "the feet of every frame rest on the same baseline (foot pivot fixed at bottom center), so the character does "
    "not jitter when animated. No text, no numbers, no grid lines, no labels, no motion trails."
)
WALK = (
    "Layout: exactly 3 rows of 4 frames. Row 1: walking DOWN toward the viewer (front view), 4-frame walk cycle "
    "(right foot forward, standing, left foot forward, standing). Row 2: walking LEFT (side view facing left), "
    "4-frame walk cycle. Row 3: walking UP away from the viewer (back view), 4-frame walk cycle."
)
ATTACK = (
    "Layout: exactly 6 rows. Row 1: walking DOWN toward the viewer (front view), 4-frame walk cycle. Row 2: "
    "walking LEFT (side view facing left), 4-frame walk cycle. Row 3: walking UP (back view), 4-frame walk cycle. "
    "Row 4: sword slash facing DOWN, 3 frames (wind-up with the sword raised, fast swing, follow-through). Row 5: "
    "sword slash facing LEFT, 3 frames. Row 6: sword slash facing UP, 3 frames. The sword stays fully inside each "
    "frame's cell."
)
CAST = (
    "Layout: exactly 6 rows. Row 1: walking DOWN toward the viewer (front view), 4-frame walk cycle. Row 2: "
    "walking LEFT (side view facing left), 4-frame walk cycle. Row 3: walking UP (back view), 4-frame walk cycle. "
    "Row 4: casting a spell facing DOWN, 3 frames (raising a paper talisman, thrusting it forward, glowing "
    "talisman released). Row 5: casting facing LEFT, 3 frames. Row 6: casting facing UP, 3 frames."
)
ENEMY = (
    "Layout: exactly 6 rows. Row 1: walking DOWN (front view), 4-frame walk cycle. Row 2: walking LEFT (side view "
    "facing left), 4-frame walk cycle. Row 3: walking UP (back view), 4-frame walk cycle. Row 4: attack facing "
    "DOWN, 3 frames (wind-up, strike, recover). Row 5: attack facing LEFT, 3 frames. Row 6: attack facing UP, 3 frames."
)
BOSS = (
    "Layout: exactly 6 rows. Row 1: walking DOWN toward the viewer (front view), 4-frame walk cycle. Row 2: walking "
    "LEFT (side view facing left), 4-frame walk cycle. Row 3: walking UP (back view), 4-frame walk cycle. Row 4: heavy "
    "glaive sweep facing DOWN, 3 frames (wind-up with the glaive raised high, wide sweeping strike, follow-through). "
    "Row 5: the same sweep facing LEFT, 3 frames. Row 6: the same sweep facing UP, 3 frames. The long glaive stays "
    "fully inside each frame's cell."
)
MING = ("The story world is an idealized Ming-dynasty China as imagined in Joseon Korean novels: MING DYNASTY "
        "Chinese clothing, not Korean hanbok.")
JOSEON = "Late-Joseon Korea: Korean hanbok clothing."

P, M = {}, []


def sheet(name, layout, desc, ref="", setting=MING, size="1536x1024"):
    P[name] = SHEET + "\n\n" + layout + "\n\nCharacter: " + desc + " " + setting
    M.append((name, size, ref, "char" if ref else "style"))


# ── 주인공 ──
sheet("sp_hero_m_child", WALK, "a bright noble boy of about 7 with round face, hair tied in two small tufts, small blue child robe with cloud patterns.", "assets/raw/pt_m_child.png")
sheet("sp_hero_m_youth", ATTACK, "a young martial trainee about 17, hair in a topknot tied with a red headband, simple indigo martial robe with a red sash, cloth boots, holding a straight sword.")
sheet("sp_hero_m_general", ATTACK, "a young general about 17 in dark-gold scale armor over a crimson robe, crimson cape, helmet with a red tassel, holding a long straight sword.", "assets/raw/pt_m_hero.png")
sheet("sp_hero_f_child", WALK, "a clever noble girl of about 7, hair in a single braid with a red ribbon, peach-colored jacket and skirt.", "assets/raw/pt_f_child.png")
sheet("sp_hero_f_scholar", ATTACK, "a young woman about 17 disguised as a young male scholar: hair in a man's topknot under a small black scholar cap, light blue scholar robe, holding a straight sword.", "assets/raw/pt_f_scholar.png")
sheet("sp_hero_f_general", ATTACK, "a young woman commander disguised as a man, silver-white scale armor over a deep indigo robe, commander helmet with a white plume, holding a straight sword.", "assets/raw/pt_f_general.png")
sheet("sp_hero_f_lady", WALK, "a young noblewoman about 17, hair in an elegant high bun with gold pins, deep indigo and white lady's jacket and long skirt.", "assets/raw/pt_f_lady.png")
sheet("sp_hero_f_sage", CAST, "a young noblewoman who studied Taoist magic, hair in a neat bun with a jade pin, deep green and ivory lady's dress, holding a paper talisman.", "assets/raw/pt_f_sage.png")

# ── 이야기 속 인물 ──
sheet("sp_father", WALK, "a loyal minister in his 50s with a neat black beard, black official gauze hat with two side wings, deep red official robe with a rank badge.", "assets/raw/pt_father.png")
sheet("sp_mother", WALK, "a gentle noble lady in her 40s, hair in a modest high bun with a jade pin, pale green jacket over a long skirt.", "assets/raw/pt_mother.png")
sheet("sp_villain", WALK, "a treacherous minister in his 50s with sly narrow eyes and a thin long moustache, black official gauze hat with two side wings, purple official robe.", "assets/raw/pt_villain.png")
sheet("sp_emperor", WALK, "the Ming emperor in a yellow dragon robe and black winged imperial crown.", "assets/raw/pt_emperor.png")
sheet("sp_rescuer", WALK, "an old retired scholar-hermit with a grey beard, simple brown robe and a square black scholar cap.", "assets/raw/pt_rescuer.png")
sheet("sp_master", WALK, "an old Taoist master with a long white beard, grey robe with a crane pattern, holding a horsetail whisk.", "assets/raw/pt_master.png")
sheet("sp_yunseon", WALK, "a young man about 17, blue scholar robe and a black scholar cap, friendly face.", "assets/raw/pt_yunseon.png")
sheet("sp_yunsojeo", WALK, "a young noble lady about 16, hair in a neat bun with a pink flower, light pink and ivory jacket and skirt.", "assets/raw/pt_yunsojeo.png")
sheet("sp_enemy_general", WALK, "a fierce northern barbarian general with a thick moustache, fur-trimmed helmet, dark lamellar armor and wolf-fur mantle.", "assets/raw/pt_enemy.png")

# ── 엑스트라 ──
sheet("sp_listener", WALK, "a Joseon village youth about 13 in a white jeogori jacket and baji trousers with a black cloth headband, curious face.", setting=JOSEON)
sheet("sp_narrator", WALK, "a jeongisu storyteller of late-Joseon Seoul, man in his 50s, black horsehair gat hat, grey dopo robe, holding an open book and a folding fan.", "assets/raw/pt_narrator.png", setting=JOSEON)
sheet("sp_joseon_man", WALK, "a Joseon commoner man in a white-grey hanbok with a straw hat, carrying a small bundle.", setting=JOSEON)
sheet("sp_joseon_woman", WALK, "a Joseon commoner woman in a pale yellow jeogori and navy skirt, hair in a low bun, carrying a basket.", setting=JOSEON)
sheet("sp_courtier", WALK, "a Ming court official in a green round-collar robe and black gauze hat with two side wings, holding an ivory tablet.")
sheet("sp_court_lady", WALK, "a Ming palace maid in a pink jacket and long skirt with hair in two buns.")
sheet("sp_villager_m", WALK, "a Ming commoner man in a brown tunic and trousers with a cloth head wrap.")
sheet("sp_villager_w", WALK, "a Ming commoner woman in a blue jacket and apron with a simple bun.")
sheet("sp_monk", WALK, "a Buddhist monk with a shaved head in a grey robe and brown kasaya, holding prayer beads.")
sheet("sp_soldier", WALK, "a Ming soldier in red padded armor and a round helmet, holding a spear.")
sheet("sp_physician", WALK, "an old royal physician in a dark navy robe and black cap, carrying a medicine box.")
sheet("sp_servant", WALK, "a young household servant boy in a grey tunic with hair in a topknot.")

# ── 적(공격 동작 포함) ──
# 적장 결전(실시간 보스전)용: 철목달. 크게 그려 보스답게
sheet("sp_boss", BOSS, "a huge fierce northern barbarian warlord, the enemy commander: broad shoulders, thick moustache, fur-trimmed helmet with a red plume, dark lamellar armor, wolf-fur mantle, wielding a long heavy crescent glaive. He looks bigger and more menacing than ordinary soldiers.", "assets/raw/pt_enemy.png")
sheet("sp_assassin", ENEMY, "a masked assassin in black clothes with a black face cloth, holding a short dagger.")
sheet("sp_barbarian", ENEMY, "a northern barbarian soldier in a fur hat and brown leather armor, holding a curved saber.")
sheet("sp_phantom", ENEMY, "a phantom warrior conjured by a Taoist master, made of swirling grey ink-like mist shaped into an armored soldier with a spear, glowing pale eyes, semi-transparent edges.")

# ── 소품(건물·자연·물건) ──
PROPS = (
    "Pixel art game objects for a top-down 2D RPG in the style of 16-bit SNES-era JRPGs (3/4 top-down view), crisp "
    "hard-edged pixels, no anti-aliasing, limited palette, dark 1-pixel outlines. Everything is drawn at one "
    "consistent pixel scale where one ground tile is 32x32 pixels and a person would be about 48 pixels tall. "
    "Solid flat pure magenta background (#FF00FF) everywhere, no ground, no floor tiles, no cast shadows on the "
    "background. Each object is separate with wide empty magenta gaps so no object touches another, arranged in "
    "neat rows. No text, no labels, no people. Setting: an idealized Ming-dynasty China as imagined in Joseon "
    "Korean novels.\n\nObjects: "
)


def props(name, desc, size="1536x1024"):
    P[name] = PROPS + desc
    M.append((name, size, "", "style"))


props("props_buildings",
      "1) a noble courtyard house hall with a dark grey tiled roof, white walls and red wooden pillars (about 6 tiles wide), "
      "2) a small thatched-roof cottage (about 4 tiles wide), 3) a grand palace throne hall with a golden-yellow glazed tile "
      "roof, red columns and stone stairs on a stone platform (about 8 tiles wide), 4) a Buddhist temple hall with a dark "
      "roof, red pillars and a stone step (about 6 tiles wide), 5) a small ancestral shrine with a tiled roof (about 3 tiles "
      "wide), 6) a big roofed wooden main gate with red doors (about 4 tiles wide).")
props("props_nature",
      "two rows: 1) a tall pine tree, 2) a weeping willow tree, 3) a plum tree with pink blossoms, 4) a bamboo cluster, "
      "5) a round green bush, 6) a large grey boulder, 7) a cluster of small rocks, 8) a clump of tall river reeds, "
      "9) a patch of red and yellow flowers, 10) a tree stump, 11) a small pond lotus leaf cluster, 12) an autumn maple tree "
      "with red leaves. Trees are about 2 to 3 tiles wide and 3 to 4 tiles tall.")
props("props_objects",
      "three rows: 1) a round stone well with a wooden roof, 2) an archery target on a wooden stand, 3) a straw training "
      "dummy on a post, 4) a stone altar with a bronze incense burner, 5) a white army tent with a red trim, 6) a wooden "
      "bookshelf with scrolls, 7) a low wooden table with scrolls and an ink stone, 8) a group of brown clay storage jars, "
      "9) a wooden cart, 10) a red war banner on a pole, 11) a small bonfire with flames, 12) a stone lantern, 13) a market "
      "stall with a cloth awning and goods, 14) a small wooden rowing boat, 15) a treasure chest made of red lacquered wood, "
      "16) a war drum on a wooden stand.")

for name, text in P.items():
    assert all(ord(ch) < 128 for ch in text), name
    with open(os.path.join(PDIR, name + ".txt"), "w", encoding="utf-8") as f:
        f.write(text)
with open(os.path.join(ROOT, "tools", "manifest_sprites.tsv"), "w", encoding="utf-8") as f:
    f.write("# name\tsize\tref\tmode\n")
    for name, size, ref, mode in M:
        f.write(f"{name}\t{size}\t{ref}\t{mode}\n")
print(len(P), "prompts")
