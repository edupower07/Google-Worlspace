#!/usr/bin/env python3
"""Googleドライブの「ClaudeCode×Google活用動画」フォルダから、
サイト用のデータ(docs/data/episodes.json)と表紙画像(docs/assets/covers/)を作る。

使い方:
    GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN を環境変数に入れて
    python3 scripts/sync_from_drive.py

- 何回実行してもよい。すでに入っている youtube_id などの手入力の値は消さない。
- 新しい回のフォルダができていれば追加し、動画ができていれば status を ready にする。
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
from pathlib import Path

import requests
from PIL import Image

ROOT_FOLDER_ID = "1hIQjWnKqUpchixi8dBD1y2DB6IbfZ4CN"  # ClaudeCode×Google活用動画
REPO = Path(__file__).resolve().parent.parent
DATA_PATH = REPO / "docs" / "data" / "episodes.json"
COVER_DIR = REPO / "docs" / "assets" / "covers"
COVER_WIDTH = 640

# 部(シリーズの区切り)。回の番号で決める
PARTS = [
    {"id": "p1", "range": (1, 8), "series": "基本編", "name": "第1部 まずはここから基本編"},
    {"id": "p2", "range": (9, 18), "series": "基本編", "name": "第2部 知ってると差がつく小技編"},
    {"id": "p3", "range": (19, 25), "series": "基本編", "name": "第3部 授業で使える活用編"},
    {"id": "p4", "range": (26, 30), "series": "基本編", "name": "第4部 Geminiで一歩先へ応用編"},
    {"id": "a1", "range": (31, 38), "series": "応用編", "name": "Part1 Gemini Notebook(旧 NotebookLM)"},
    {"id": "a2", "range": (39, 46), "series": "応用編", "name": "Part2 GAS(Google Apps Script)"},
    {"id": "a3", "range": (47, 54), "series": "応用編", "name": "Part3 授業の1場面"},
    {"id": "a4", "range": (55, 60), "series": "応用編", "name": "Part4 Gemini"},
]
EXTRA_PART = {"id": "ex", "series": "番外編", "name": "番外編"}

# 回ごとに決めたアプリのタグ。ここに無い新しい回は APP_RULES で推定する
APP_OVERRIDES = {
    "01": ["ドキュメント"], "02": ["スライド"], "03": ["スプレッドシート"], "04": ["Classroom"],
    "05": ["フォーム"], "06": ["ドキュメント"], "07": ["スプレッドシート"], "08": ["Classroom"],
    "09": ["ドライブ"], "10": ["スライド"], "11": ["スライド"], "12": ["スプレッドシート"],
    "13": ["スプレッドシート"], "14": ["スプレッドシート"], "15": ["ドキュメント"], "16": ["ドキュメント"],
    "17": ["Classroom"], "18": ["Classroom"], "19": ["スライド"], "20": ["スライド"],
    "21": ["スプレッドシート"], "22": ["フォーム", "スプレッドシート"], "23": ["Classroom"], "24": ["Classroom"],
    "25": ["ドキュメント"], "26": ["Gemini"], "27": ["Gemini"], "28": ["Gemini", "Classroom"],
    "29": ["Gemini"], "30": ["Gemini Notebook"],
    "31": ["Gemini Notebook"], "32": ["Gemini Notebook"], "33": ["Gemini Notebook"], "34": ["Gemini Notebook"],
    "35": ["Gemini Notebook"], "36": ["Gemini Notebook"], "37": ["Gemini Notebook", "Classroom"], "38": ["Gemini Notebook"],
    "39": ["GAS", "Gemini"], "40": ["GAS", "スプレッドシート", "ドキュメント"], "41": ["GAS", "フォーム"],
    "42": ["GAS", "スプレッドシート"], "43": ["GAS", "カレンダー"], "44": ["GAS", "スプレッドシート"],
    "45": ["GAS", "ドライブ"], "46": ["GAS"],
    "47": ["フォーム"], "48": ["スライド"], "49": ["ドキュメント"], "50": ["マイマップ"],
    "51": ["フォーム", "スライド"], "52": ["Classroom"], "53": ["サイト"], "54": ["スプレッドシート"],
    "55": ["Gemini"], "56": ["Gemini", "Classroom"], "57": ["Gemini"], "58": ["Gemini"],
    "59": ["Gemini"], "60": ["Vids"], "ex-canvas": ["Gemini", "サイト"],
}

# 使っているアプリのタグの推定ルール(上から順に優先)
APP_RULES = [
    ("Gemini Notebook", ["NotebookLM", "Gemini Notebook", "ノートブック"]),
    ("GAS", ["GAS", "Apps Script"]),
    ("Gemini", ["Gemini", "Canvas"]),
    ("Classroom", ["Classroom", "クラスルーム"]),
    ("フォーム", ["フォーム", "テストモード", "小テストの丸つけ"]),
    ("スプレッドシート", ["スプレッドシート", "スプシ", "条件付き書式", "RAND", "プルダウン", "チェックボックス", "SPARKLINE", "カラースケール"]),
    ("ドキュメント", ["ドキュメント", "提案モード", "音声入力", "変更履歴", "@"]),
    ("スライド", ["スライド", "マスター", "思考ツール"]),
    ("カレンダー", ["カレンダー"]),
    ("ドライブ", ["ドライブ", "URLを1語"]),
    ("サイト", ["サイト"]),
    ("マイマップ", ["マイマップ"]),
    ("Vids", ["Vids"]),
]


def access_token() -> str:
    try:
        r = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": os.environ["GDRIVE_CLIENT_ID"],
                "client_secret": os.environ["GDRIVE_CLIENT_SECRET"],
                "refresh_token": os.environ["GDRIVE_REFRESH_TOKEN"],
                "grant_type": "refresh_token",
            },
            timeout=30,
        )
    except KeyError as e:
        sys.exit(f"環境変数 {e} がありません")
    r.raise_for_status()
    return r.json()["access_token"]


class Drive:
    def __init__(self) -> None:
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {access_token()}"

    def children(self, folder_id: str) -> list[dict]:
        out, token = [], None
        while True:
            params = {
                "q": f"'{folder_id}' in parents and trashed = false",
                "fields": "nextPageToken, files(id, name, mimeType, modifiedTime, size, videoMediaMetadata)",
                "pageSize": 1000,
            }
            if token:
                params["pageToken"] = token
            r = self.s.get("https://www.googleapis.com/drive/v3/files", params=params, timeout=60)
            r.raise_for_status()
            d = r.json()
            out += d.get("files", [])
            token = d.get("nextPageToken")
            if not token:
                return out

    def download(self, file_id: str) -> bytes:
        r = self.s.get(f"https://www.googleapis.com/drive/v3/files/{file_id}", params={"alt": "media"}, timeout=120)
        r.raise_for_status()
        return r.content


def part_for(no: int | None) -> dict:
    if no is None:
        return EXTRA_PART
    for p in PARTS:
        if p["range"][0] <= no <= p["range"][1]:
            return p
    return EXTRA_PART


def parse_caption(text: str) -> dict:
    lines = [l.rstrip() for l in text.replace("\r\n", "\n").split("\n")]
    title = None
    body_lines = []
    hashtags = []
    for l in lines:
        s = l.strip()
        if title is None and s.startswith("【") and "】" in s:
            title = s[1 : s.index("】")]
            continue
        if s and all(w.startswith("#") for w in s.split()):
            hashtags += s.split()
            continue
        body_lines.append(l)
    body = "\n".join(body_lines).strip()
    body = re.sub(r"\n{3,}", "\n\n", body)
    return {"title": title, "body": body, "hashtags": hashtags}


def guess_apps(title: str, body: str) -> list[str]:
    """タイトルから判定し、何も見つからなければ投稿文から1つだけ拾う"""
    apps = [app for app, words in APP_RULES if any(w in title for w in words)]
    if not apps:
        apps = [app for app, words in APP_RULES if any(w in body for w in words)][:1]
    return apps[:3]


def save_cover(png: bytes, dest: Path) -> None:
    img = Image.open(io.BytesIO(png)).convert("RGB")
    h = round(img.height * COVER_WIDTH / img.width)
    img = img.resize((COVER_WIDTH, h), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=82, optimize=True, progressive=True)


def main() -> None:
    drive = Drive()
    old = {}
    if DATA_PATH.exists():
        for e in json.loads(DATA_PATH.read_text())["episodes"]:
            old[e["id"]] = e

    episodes = []
    for f in drive.children(ROOT_FOLDER_ID):
        if f["mimeType"] != "application/vnd.google-apps.folder":
            continue
        m = re.match(r"^第(\d+)回_(.+)$", f["name"])
        if m:
            no, slug = int(m.group(1)), m.group(2)
            eid = f"{no:02d}"
        elif f["name"].startswith("番外編_"):
            no, slug = None, f["name"][len("番外編_") :]
            eid = "ex-" + re.sub(r"[^A-Za-z0-9]+", "-", slug).strip("-").lower() or "ex"
        else:
            continue

        files = drive.children(f["id"])
        by_suffix = {}
        # 差しかえで古いファイルが残っていることがあるので、新しいほうを使う
        for x in sorted(files, key=lambda x: x["modifiedTime"]):
            for suf in ("_video.mp4", "_video_v.mp4", "_cover.png", "_caption.txt"):
                if x["name"].endswith(suf):
                    by_suffix[suf] = x
        video = by_suffix.get("_video.mp4")
        prev = old.get(eid, {})

        cap = {"title": None, "body": "", "hashtags": []}
        if "_caption.txt" in by_suffix:
            cap = parse_caption(drive.download(by_suffix["_caption.txt"]["id"]).decode("utf-8"))

        cover_rel = None
        if "_cover.png" in by_suffix:
            dest = COVER_DIR / f"{eid}.jpg"
            src = by_suffix["_cover.png"]
            if not dest.exists() or prev.get("cover_src_modified") != src["modifiedTime"]:
                save_cover(drive.download(src["id"]), dest)
            cover_rel = f"assets/covers/{eid}.jpg"

        part = part_for(no)
        title = cap["title"] or slug.replace("_", " ")
        duration = None
        if video and video.get("videoMediaMetadata", {}).get("durationMillis"):
            duration = round(int(video["videoMediaMetadata"]["durationMillis"]) / 1000)

        ep = {
            "id": eid,
            "no": no,
            "slug": slug,
            "title": title,
            "series": part["series"],
            "part": part["id"],
            "apps": APP_OVERRIDES.get(eid) or prev.get("apps") or guess_apps(title + "\n" + slug, cap["body"]),
            "description": cap["body"],
            "hashtags": cap["hashtags"],
            "status": "ready" if video else "in_progress",
            "duration_sec": duration,
            "cover": cover_rel,
            "youtube_id": prev.get("youtube_id"),
            "video_file": video["name"] if video else None,
            "drive": {
                "folder_id": f["id"],
                "video_id": video["id"] if video else None,
                "video_v_id": by_suffix.get("_video_v.mp4", {}).get("id"),
            },
            "cover_src_modified": by_suffix.get("_cover.png", {}).get("modifiedTime"),
        }
        # 手で書きかえた項目は残す
        for k in ("title_override", "note", "hidden"):
            if k in prev:
                ep[k] = prev[k]
        episodes.append(ep)
        print(f"{eid:>12}  {ep['status']:<11} {title}", file=sys.stderr)

    episodes.sort(key=lambda e: (e["no"] is None, e["no"] or 0, e["id"]))
    parts = [{k: p[k] for k in ("id", "series", "name")} for p in PARTS] + [EXTRA_PART]
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(
        json.dumps({"parts": parts, "episodes": episodes}, ensure_ascii=False, indent=2) + "\n"
    )
    ready = sum(e["status"] == "ready" for e in episodes)
    print(f"\n{len(episodes)} 件(動画あり {ready} 件)を {DATA_PATH.relative_to(REPO)} に書きました", file=sys.stderr)


if __name__ == "__main__":
    main()
