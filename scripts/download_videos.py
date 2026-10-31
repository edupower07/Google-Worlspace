#!/usr/bin/env python3
"""YouTube にまだ上げていない回の横動画(*_video.mp4)を、ドライブから youtube/videos/ にまとめてダウンロードする。

    python3 scripts/download_videos.py          # アップロード待ちの回すべて
    python3 scripts/download_videos.py 01 02    # 回を指定

環境変数 GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN が必要。
無い場合は、パソコンの Google ドライブ(デスクトップ版)のフォルダから直接ファイルを選んでもよい。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_from_drive import Drive  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "docs" / "data" / "episodes.json"
OUT = REPO / "youtube" / "videos"


def main() -> None:
    eps = json.loads(DATA.read_text())["episodes"]
    want = set(f"{int(a):02d}" if a.isdigit() else a for a in sys.argv[1:])
    targets = [
        e for e in eps
        if e["status"] == "ready" and (e["id"] in want if want else not e.get("youtube_id"))
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    drive = Drive()
    for e in targets:
        dest = OUT / e["video_file"]
        if dest.exists():
            print(f"あり  {dest.name}")
            continue
        dest.write_bytes(drive.download(e["drive"]["video_id"]))
        print(f"保存  {dest.name}")
    print(f"\n{len(targets)} 本 → {OUT.relative_to(REPO)}/")


if __name__ == "__main__":
    main()
