# -*- coding: utf-8 -*-
"""국립국악원 디지털 이음 악구(assets/raw_audio/*/*.wav)를 장면별 배경음(assets/bgm/*.mp3)으로 엮는다.

    python tools/make_bgm.py [곡 이름...]

- 악구는 한 연주를 번호 순서대로 잘게 나눈 것이라, 순서대로 이으면 실제 곡의 한 대목이 된다.
- 악구마다 앞뒤의 긴 무음만 줄이고(숨 쉬는 틈은 남김) 아주 짧게 겹쳐 잇는다(딸깍 소리 없게).
- 끝을 처음과 1.5초 겹쳐 두어, 되풀이할 때 이음매가 들리지 않게 한다.
- 음량은 곡마다 같은 크기(-17 LUFS, 두 번 재어 선형으로)로 맞추고, 모노 64kbps mp3로 줄인다.
- 원본(assets/raw_audio)은 용량이 커서 저장소에 올리지 않는다. 출처: 국립국악원 디지털 이음(공공누리 제1유형).
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
from scipy.io import wavfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "assets", "raw_audio")
OUT = os.path.join(ROOT, "assets", "bgm")
os.makedirs(OUT, exist_ok=True)
SR = 48000
# ffmpeg: PATH에 없으면 흔히 두는 자리에서 찾는다
import shutil
FFMPEG = shutil.which("ffmpeg") or next((p for p in [os.path.join(os.path.expanduser("~"), "ffmpeg", "bin", "ffmpeg.exe"), os.path.join("C:" + os.sep, "ffmpeg", "bin", "ffmpeg.exe")] if os.path.exists(p)), "ffmpeg")


def ids(prefix, nums):
    return [f"{prefix}{n:03d}" for n in nums]


# 곡 이름(js/core/audio.js의 TRACKS와 같음) → (악구 폴더, 악구 번호 순서)
TRACKS = {
    "market": ("gayageum_minyo", ["s1-915-001", "s1-915-002", "s1-916-001", "s1-916-002", "s1-916-003", "s1-918-001", "s1-918-002", "s1-918-003"]),
    "child": ("gayageum_minyo", ["s1-913-001", "s1-913-002", "s1-914-001", "s1-914-002", "s1-914-003", "s1-914-004"]),
    "court": ("geomungo_sanjo", ids("S2-001-", range(15, 23))),
    "tension": ("geomungo_sanjo", ids("S2-001-", range(29, 34))),
    "heaven": ("daegeum_sanjo", ids("w3-001-", range(1, 7))),
    "ruin": ("ajaeng_sanjo", ids("S4-001-", range(1, 7))),
    "scheme": ("ajaeng_sanjo", ids("S4-001-", range(7, 13))),
    "mountain": ("gayageum_sanjo", ids("s1-001-", [28, 29, 30, 31, 33, 34, 35, 36, 37, 39])),
    "final": ("gayageum_sanjo", ids("s1-001-", [62, 63, 64, 66, 67, 68, 69, 70, 71, 72, 73, 74])),
    "palace": ("sogeum_court", ids("w4-440-", [10, 12, 14, 19, 22, 23, 24, 25])),
    "battle": ("taepyeongso_sinawi", ids("w2-011-", range(200, 301, 10))),
    "boudoir": ("haegeum_sanjo", ids("S3-001-", range(1, 7))),
    "victory": ("victory", ids("w2-510-", range(1, 14))),
}


def load(path):
    """어떤 표본율·형식이든 48kHz 모노 float로 읽는다(ffmpeg)."""
    r = subprocess.run([FFMPEG, "-hide_banner", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def trim(x, lead=0.10, tail=0.35, db=-48):
    """앞뒤 무음을 줄인다. 앞은 lead초, 뒤는 tail초까지만 남긴다(울림 꼬리는 남김)."""
    peak = np.max(np.abs(x)) or 1.0
    thr = peak * 10 ** (db / 20)
    w = int(0.01 * SR)
    a = np.abs(x)
    # 10ms 창의 최댓값으로 소리가 있는 곳을 찾는다
    k = len(a) // w
    blocks = a[: k * w].reshape(k, w).max(axis=1) if k else a
    on = np.nonzero(blocks > thr)[0]
    if not len(on):
        return x
    s = max(0, on[0] * w - int(lead * SR))
    e = min(len(x), (on[-1] + 1) * w + int(tail * SR))
    return x[s:e]


def join(parts, xf=0.04):
    n = int(xf * SR)
    out = parts[0].copy()
    for p in parts[1:]:
        if len(out) < n or len(p) < n:
            out = np.concatenate([out, p]); continue
        t = np.linspace(0, np.pi / 2, n)
        mix = out[-n:] * np.cos(t) + p[:n] * np.sin(t)
        out = np.concatenate([out[:-n], mix, p[n:]])
    return out


def loopify(x, f=1.5):
    """끝 f초에 처음 f초를 겹쳐 넣고 처음 f초를 잘라 낸다 → 되풀이해도 이음매가 매끄럽다."""
    n = int(f * SR)
    if len(x) < 3 * n:
        return x
    t = np.linspace(0, np.pi / 2, n)
    y = x[n:].copy()
    y[-n:] = x[-n:] * np.cos(t) + x[:n] * np.sin(t)
    return y


def loudnorm(src, dst, target=-17.0):
    base = [FFMPEG, "-hide_banner", "-nostats", "-y", "-i", src]
    r = subprocess.run(base + ["-af", f"loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = json.loads(re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr)[-1])
    af = (f"loudnorm=I={target}:TP=-1.5:LRA=11:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    subprocess.run(base + ["-af", af, "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", dst], check=True, capture_output=True)
    return float(m["input_i"])


def main(names):
    tmp = os.path.join(OUT, "_tmp.wav")
    info = {}
    for name, (folder, order) in TRACKS.items():
        if names and name not in names:
            continue
        files = sorted(os.listdir(os.path.join(RAW, folder)))
        def find(i):  # 내려받은 파일 이름은 소문자이고 뒤에 글자가 붙기도 한다(s2-001-015g.wav)
            hit = [f for f in files if f.lower().endswith(".wav") and f.lower().startswith(i.lower())]
            if not hit:
                raise SystemExit(f"{folder}: {i} 파일이 없음")
            return os.path.join(RAW, folder, hit[0])
        parts = [trim(load(find(i))) for i in order]
        x = loopify(join(parts))
        x = x / max(1e-6, np.max(np.abs(x))) * 0.9
        wavfile.write(tmp, SR, x.astype(np.float32))
        dst = os.path.join(OUT, name + ".mp3")
        li = loudnorm(tmp, dst)
        info[name] = round(len(x) / SR, 1)
        print(f"{name}: {len(order)}개 악구 → {len(x) / SR:.1f}초 (원래 {li:.1f} LUFS) {os.path.getsize(dst) // 1024}KB")
    if os.path.exists(tmp):
        os.remove(tmp)
    return info


if __name__ == "__main__":
    main(set(sys.argv[1:]))
