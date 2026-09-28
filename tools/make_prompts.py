# -*- coding: utf-8 -*-
"""에셋 생성 프롬프트(tools/prompts/*.txt)와 manifest(tools/manifest.tsv)를 만든다.

    python tools/make_prompts.py

프롬프트는 영어(ASCII)만 쓴다. gen.ps1이 명령문에 그대로 넣어 넘기기 때문이다.
manifest 열: 이름, 크기, 참조 이미지, 참조 방식(same|style|scene)

화풍: 방각본 고소설 목판 삽화풍(화풍 시안 A, design/style-samples/style_a_woodblock.png).
참조: design/ref/ref_cast.png = 화풍 시안 A(남성 영웅·남장 여성 대원수·도사·간신 네 사람).
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDIR = os.path.join(ROOT, "tools", "prompts")
os.makedirs(PDIR, exist_ok=True)

CAST = "design/ref/ref_cast.png"

STYLE = (
    "Art style: hand-colored Korean woodblock print, like the illustrations of late-Joseon commercially printed "
    "classical novels (bangakbon) and the Oryun Haengsildo: bold carved black outlines with the slight irregularity "
    "of a carved wood block, flat areas of hand-applied color limited to vermilion red, indigo blue, ochre yellow and "
    "soft green, visible wood grain and ink-press texture, cream mulberry paper background. Strong graphic "
    "readability, printed look, not a painting. Absolutely no text, no letters, no calligraphy, no seals, no "
    "signatures, no captions, no frames or borders."
)
MING = (
    " The story world is an idealized Ming-dynasty China as imagined in late-Joseon Korean heroic novels, so every "
    "story character wears MING DYNASTY Chinese clothing and armor, never Korean hanbok."
)
JOSEON = (
    " This is late-Joseon Korea (18th-19th century): people wear Korean hanbok, men wear black horsehair gat hats "
    "or headbands."
)

PORTRAIT = (
    "Bust portrait (head and upper chest) of a single character for a story game character card. The figure is "
    "centered, facing slightly toward the viewer, and fills most of the square. Plain cream mulberry paper "
    "background with nothing else on it.\n\nCharacter: "
)
SCENE = (
    "Wide illustration of one scene from a classical heroic novel, for a mobile story game. Clear readable "
    "composition, figures large enough to recognize, calm areas of plain paper around the figures.\n\nScene: "
)

P = {}      # name -> prompt
M = []      # (name, size, ref, mode)


def portrait(name, desc, ref=CAST, mode="style", setting=MING):
    P[name] = PORTRAIT + desc + "\n\n" + STYLE + setting
    M.append((name, "1024x1024", ref, mode))


def scene(name, desc, size="1536x1024", ref=CAST, mode="scene", setting=MING):
    P[name] = SCENE + desc + "\n\n" + STYLE + setting
    M.append((name, size, ref, mode))


# ── 인물 공통 문구(초상과 장면에서 같은 말을 되풀이해 모습을 맞춘다) ──
HERO_M = ("a young male hero about 17, son of a loyal noble family, bright determined eyes, straight black eyebrows, "
          "hair in a topknot")
HERO_M_ARMOR = HERO_M + ", dark-gold scale armor over a crimson robe, helmet with a red tassel"
HERO_F = ("a young woman hero about 17, slender and composed, sharp intelligent eyes, beautiful but androgynous "
          "when disguised as a man")
HERO_F_ARMOR = HERO_F + ", disguised as a man: silver-white scale armor over a deep indigo robe, commander helmet with a white plume"
FATHER = ("a loyal upright minister in his 50s, dignified stern face, neat black beard, black Ming official gauze "
          "hat with two side wings, deep red official robe")
MOTHER = ("his wife, a gentle noble lady in her 40s, kind worried eyes, hair in a modest high bun with a jade pin, "
          "pale green Ming jacket over a long skirt")
VILLAIN = ("the treacherous minister, in his 50s, sly narrow eyes, thin long moustache, black Ming official gauze hat "
           "with two side wings, purple official robe")
MASTER = ("the old Taoist master, long white beard and eyebrows, kind eyes, grey Taoist robe with a crane pattern, "
          "horsetail whisk")
RESCUER = ("an old retired scholar-hermit in his 60s, warm wise face, grey beard, simple brown scholar robe and a "
           "square black scholar cap")
YUNSEON = ("a young man about 17, the rescuer's son, handsome and good-natured but a little proud, blue scholar "
           "robe and black scholar cap")
EMPEROR = ("the Ming emperor, in his 40s, anxious but dignified, yellow dragon robe, black winged imperial crown")
ENEMY = ("a fierce northern barbarian general, broad face, thick moustache, fur-trimmed helmet, dark lamellar armor "
         "with a wolf-fur mantle")

# ── 초상(1024 → 320 webp) ──
portrait("pt_narrator",
         "a jeongisu, a professional storyteller of late-Joseon Seoul who reads novels aloud at the market, man in "
         "his 50s with a lively expressive face and a slight mischievous smile, black gat hat, white-grey dopo robe, "
         "holding an open thread-bound Korean novel book in one hand and a folding fan in the other.",
         setting=JOSEON)
portrait("pt_father", FATHER + ". Expression: upright and resolute.")
portrait("pt_mother", MOTHER + ". Expression: gentle and loving.")
portrait("pt_villain",
         "Draw ONLY the fourth character from the left in the reference image, " + VILLAIN +
         ". Expression: a cold scheming sidelong smile.", mode="same")
portrait("pt_emperor", EMPEROR + ". Expression: troubled, looking to the viewer for help.")
portrait("pt_rescuer", RESCUER + ". Expression: compassionate.")
portrait("pt_master",
         "Draw ONLY the third character from the left in the reference image, " + MASTER +
         ". Expression: calm, knowing smile.", mode="same")
portrait("pt_yunseon", YUNSEON + ". Expression: friendly, slightly competitive grin.")
portrait("pt_yunsojeo",
         "the rescuer's daughter, a young noble lady about 16, clear calm eyes, gentle but firm, hair in a neat bun "
         "with a pink flower and a silver pin, light pink and ivory Ming jacket. Expression: quiet resolve.")
portrait("pt_enemy", ENEMY + ". Expression: arrogant and threatening.")
portrait("pt_phantom",
         "a phantom warrior conjured by a Taoist master for sparring practice, made of swirling grey ink-like mist "
         "shaped into an armored soldier with a spear, blank glowing eyes, semi-transparent edges. Expression: "
         "none, eerie.")
portrait("pt_m_child",
         "a bright noble boy of "
         "about 7, round face, determined eyes, hair tied in two small tufts, small blue child robe. Expression: "
         "curious and brave.")
portrait("pt_m_hero",
         "Draw ONLY the first character from the left in the reference image, " + HERO_M_ARMOR +
         ". Expression: determined.", mode="same")
portrait("pt_m_scholar",
         HERO_M + ", wearing a green Ming scholar-official robe and a black gauze hat decorated with a paper flower "
         "(the royal flower given to the top examination graduate). Expression: proud and happy.")
portrait("pt_f_child",
         "a clever noble girl "
         "of about 7, bright sharp eyes, hair in a single braid with a red ribbon, small peach-colored child jacket. "
         "Expression: clever and lively.")
portrait("pt_f_scholar",
         HERO_F + ", disguised as a young male scholar: hair tied up in a man's topknot under a black scholar cap, "
         "light blue scholar robe, face beautiful but androgynous. Expression: composed, a little watchful.")
portrait("pt_f_general",
         "Draw ONLY the second character from the left in the reference image, " + HERO_F_ARMOR +
         ". Expression: commanding and calm.", mode="same")
portrait("pt_f_lady",
         HERO_F + ", now openly a woman: hair in an elegant high bun with gold pins, deep indigo and white Ming "
         "lady's jacket and long skirt. Expression: dignified, thoughtful.")
portrait("pt_f_sage",
         HERO_F + ", a young noblewoman who studied Taoist magic and never disguised herself: hair in a neat bun "
         "with a jade pin, deep green and ivory Ming lady's jacket, holding a folded paper talisman. Expression: "
         "serene and mysterious.")

# ── 장면(1536x1024 → 1280 webp) ──
scene("sc_market",
      "A crowded market street in late-Joseon Seoul in front of a tobacco shop: a jeongisu storyteller (man in a "
      "black gat and grey dopo) sits on a low stool reading an open thread-bound novel aloud with dramatic gestures, "
      "a circle of commoners, children and a peddler listen spellbound, some tossing copper coins onto a straw mat.",
      mode="style", setting=JOSEON)
scene("sc_court",
      "Inside a Ming palace hall: " + FATHER + " kneels and remonstrates boldly before the emperor on a raised "
      "throne, while " + VILLAIN + " stands among the courtiers glaring at him with hatred.")
scene("sc_prayer",
      "An old noble couple (" + FATHER + ", and " + MOTHER + ") bow and pray for a child before a stone altar on a "
      "misty sacred mountain at night, incense smoke rising, stars above, pine trees.")
scene("sc_dream",
      "A prenatal dream: a radiant heavenly immortal descends from swirling five-colored clouds on the back of a "
      "blue dragon toward a sleeping noble lady in a Ming bedroom, soft light pouring down, stars and a celestial "
      "palace faintly above.")
scene("sc_child",
      "A walled Ming courtyard: a small bright child of about 7 amazes the family by drawing a bow and hitting the "
      "target while scrolls of military books lie open on a table, the proud father and mother watching, servants "
      "clapping.")
scene("sc_ruin",
      "At night the noble family house burns in huge flames set by soldiers of the treacherous minister; a mother "
      "in a pale green jacket holds a small child by the hand and flees through a back gate into the dark, "
      "soldiers with torches in pursuit.")
scene("sc_river",
      "At dawn a small child clings to a drifting plank on a wide misty river after being thrown into the water, "
      "near death, while an old scholar-hermit (" + RESCUER + ") in a small boat reaches out to rescue the child.")
scene("sc_training",
      "A mountain hermitage among pine trees and cliffs above the clouds: " + MASTER + " teaches a young student "
      "sword forms and reads an old military book, a crane stands by, a small thatched hut.")
scene("sc_disguise",
      "In a quiet room lit by a candle, a young woman about 17 cuts her long hair short and ties it into a man's "
      "topknot before a bronze mirror, a folded man's scholar robe and black cap beside her, her face resolute.")
scene("sc_exam",
      "The palace examination hall courtyard: candidates at low desks, the emperor on a throne, a young top "
      "graduate in a green robe kneels to receive a paper flower for the hat, the second-place graduate kneels just "
      "behind, officials in red robes watching.")
scene("sc_march",
      "A great army marches out of the capital gate: the young supreme commander in shining armor rides a white "
      "horse at the front under huge banners, rows of spearmen and cavalry, drums and flags.")
scene("sc_siege",
      "The climax of a war tale: the emperor in a yellow dragon robe is surrounded by enemy soldiers on a "
      "battlefield, about to surrender, when " + HERO_M_ARMOR + " charges in on a flying dragon-horse wreathed in "
      "clouds, sword raised, enemy soldiers falling back in terror; " + ENEMY + " recoils.")
scene("sc_reunion",
      "A tearful family reunion in a courtyard: the young hero in armor kneels and embraces the aged father in a "
      "worn exile's robe and the mother in a pale green jacket, all weeping with joy, attendants bowing.")
scene("sc_pulse",
      "Inside an army tent: the young woman commander disguised as a man (silver armor set aside, indigo robe) "
      "lies ill on a mat while an old royal physician in a dark robe takes her pulse at the wrist, his eyes wide "
      "with shock at his discovery, a young officer in blue watching.")
scene("sc_general_f",
      "A battlefield under banners: the young woman supreme commander, now openly a woman with a high bun under "
      "her helmet, in silver-white armor and indigo robe, commands from a white horse; the young man in blue armor "
      "who is her husband and second-in-command bows and takes her orders.")
scene("sc_boudoir",
      "In the quiet inner women's quarters of a Ming house: a young woman in an elegant indigo lady's dress places "
      "a folded set of silver armor, a commander's seal and a helmet into a wooden chest, looking thoughtfully "
      "out of a lattice window toward the distant capital, a garden of plum blossoms outside.")
scene("sc_pihwadang",
      "A walled garden of magical trees behind a noble house at night: a young noblewoman in a deep green lady's "
      "dress stands calmly and raises a paper talisman; the trees have come alive as a maze of branches and wind, "
      "fire and whirlwind drive back bewildered barbarian soldiers.")
scene("sc_victory",
      "A triumphal return: the young hero in armor rides into the capital at the head of the army while the "
      "emperor waits at the palace gate, crowds cheering, the captured treacherous minister in purple is led in "
      "chains behind.")

# 딸의 길 전용 장면(수련·출전에 여성 영웅이 보이도록)
scene("sc_training_f",
      "A mountain hermitage among pine trees and cliffs above the clouds: " + MASTER + " teaches two students side by "
      "side: the young woman hero disguised as a young man (hair in a man's topknot, light blue scholar robe, "
      "practicing sword forms with a calm focused face) and a young man in a blue robe (the rescuer's son) reading "
      "a military book beside her, a crane stands by, a small thatched hut.")
scene("sc_march_f",
      "A great army marches out of the capital gate: the young woman supreme commander disguised as a man, in "
      "silver-white scale armor over a deep indigo robe with a white-plumed helmet, rides a white horse at the front "
      "under huge banners; a young officer in blue armor rides just behind her; rows of spearmen and cavalry, drums "
      "and flags.")
scene("sc_siege_f",
      "The climax of a war tale: the emperor in a yellow dragon robe is surrounded by enemy soldiers on a "
      "battlefield, about to surrender, when " + HERO_F_ARMOR + " charges in on a flying dragon-horse wreathed in "
      "clouds, sword raised, enemy soldiers falling back in terror; " + ENEMY + " recoils.")

# ── 타이틀 그림(세로) ──
scene("title_art",
      "Vertical title illustration for a game about Korean classical heroic novels: a young hero in armor on a "
      "white horse on a cliff, sword raised toward the sky, the heavenly palace among clouds above with a descending "
      "star, a great army and banners far below, dramatic diagonal composition, empty calm paper area in the top "
      "third for the title.", size="1024x1536")

# ── 쓰기 ──
for name, text in P.items():
    assert all(ord(ch) < 128 for ch in text), name
    with open(os.path.join(PDIR, name + ".txt"), "w", encoding="utf-8") as f:
        f.write(text)
with open(os.path.join(ROOT, "tools", "manifest.tsv"), "w", encoding="utf-8") as f:
    f.write("# name\tsize\tref\tmode\n")
    for name, size, ref, mode in M:
        f.write(f"{name}\t{size}\t{ref}\t{mode}\n")
print(len(P), "prompts")
