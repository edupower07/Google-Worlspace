#!/usr/bin/env python3
"""docs/data/episodes.json から、YouTube にアップロードするときの表(youtube/UPLOAD_SHEET.md)を作る。

    python3 scripts/make_upload_sheet.py

- 動画ができていて、まだ youtube_id が入っていない回だけを載せる
- タイトルと説明文は、YouTube の入力欄にそのまま貼れる形にしてある
"""
from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "docs" / "data" / "episodes.json"
OUT = REPO / "youtube" / "UPLOAD_SHEET.md"

SERIES_NAME = "Google Workspace 活用動画"
PLAYLIST = "Google Workspace 活用動画(全60回)"


def label(ep: dict) -> str:
    return f"第{ep['no']:02d}回" if ep["no"] else "番外編"


def yt_title(ep: dict) -> str:
    t = f"{ep['title']}｜{SERIES_NAME} {label(ep)}"
    return t[:100]


def yt_description(ep: dict, part_name: str) -> str:
    body = ep["description"].replace("<", "＜").replace(">", "＞")
    lines = [
        body,
        "",
        f"{SERIES_NAME} {label(ep)}({part_name})",
        "画面は HTML で再現したものです。実際の画面とボタン名などが少しちがうことがあります。",
        "動画に出てくる子ども・学校・先生の名前は、すべて架空です。",
    ]
    if ep.get("hashtags"):
        lines += ["", " ".join(ep["hashtags"])]
    return "\n".join(lines)[:4900]


def main() -> None:
    data = json.loads(DATA.read_text())
    parts = {p["id"]: p["name"] for p in data["parts"]}
    todo = [e for e in data["episodes"] if e["status"] == "ready" and not e.get("youtube_id")]
    done = [e for e in data["episodes"] if e.get("youtube_id")]

    out = [
        "# YouTube アップロード表",
        "",
        "このファイルは `python3 scripts/make_upload_sheet.py` で作り直せます。手で書きかえないでください。",
        "",
        f"- アップロード待ち: **{len(todo)} 本** / アップロード済み: {len(done)} 本",
        "- 公開設定: **限定公開**(サイトに埋め込むため。非公開だと埋め込めない)",
        "- 視聴者: **いいえ、子ども向けではありません**(先生向けの動画のため)",
        f"- 再生リスト: **{PLAYLIST}**(なければ限定公開で作る)",
        "- アップロードするのは横の動画 `*_video.mp4`(16:9)。縦の `*_video_v.mp4` は使わない",
        "- アップロードしたら `python3 scripts/set_youtube_id.py <回のID> <動画ID>` で記録する",
        "",
        "| 回のID | 動画ファイル名 | タイトル |",
        "|---|---|---|",
    ]
    for e in todo:
        out.append(f"| {e['id']} | `{e['video_file']}` | {yt_title(e)} |")
    out.append("")

    for e in todo:
        out += [
            "---",
            "",
            f"## {e['id']} {label(e)} {e['title']}",
            "",
            f"- 動画ファイル: `{e['video_file']}`",
            f"- ドライブ: https://drive.google.com/file/d/{e['drive']['video_id']}/view",
            "",
            "タイトル",
            "",
            "```text",
            yt_title(e),
            "```",
            "",
            "説明",
            "",
            "```text",
            yt_description(e, parts.get(e["part"], "")),
            "```",
            "",
        ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(out))
    print(f"{OUT.relative_to(REPO)} に {len(todo)} 本分を書きました")


if __name__ == "__main__":
    main()
