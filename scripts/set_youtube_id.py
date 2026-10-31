#!/usr/bin/env python3
"""アップロードした YouTube の動画IDを、サイトのデータに記録する。

    python3 scripts/set_youtube_id.py 12 dQw4w9WgXcQ
    python3 scripts/set_youtube_id.py 12 https://youtu.be/dQw4w9WgXcQ   # URL でもよい
    python3 scripts/set_youtube_id.py --list                           # 記録の状況を見る
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "docs" / "data" / "episodes.json"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def extract_id(s: str) -> str:
    s = s.strip()
    if ID_RE.match(s):
        return s
    m = re.search(r"(?:youtu\.be/|v=|/shorts/|/embed/|/video/)([A-Za-z0-9_-]{11})", s)
    if not m:
        sys.exit(f"動画IDが読みとれません: {s}")
    return m.group(1)


def main() -> None:
    data = json.loads(DATA.read_text())
    eps = data["episodes"]
    if len(sys.argv) == 2 and sys.argv[1] == "--list":
        for e in eps:
            if e["status"] == "ready":
                print(f"{e['id']:>10}  {e.get('youtube_id') or '(未)':<12} {e['title']}")
        n = sum(1 for e in eps if e.get("youtube_id"))
        print(f"\n記録済み {n} / 動画あり {sum(e['status'] == 'ready' for e in eps)}")
        return
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    key, vid = sys.argv[1], extract_id(sys.argv[2])
    key = f"{int(key):02d}" if key.isdigit() else key
    ep = next((e for e in eps if e["id"] == key), None)
    if not ep:
        sys.exit(f"回のID {key} が見つかりません(--list で確認できます)")
    dup = next((e for e in eps if e.get("youtube_id") == vid and e["id"] != key), None)
    if dup:
        sys.exit(f"この動画IDはすでに {dup['id']} に記録されています")
    ep["youtube_id"] = vid
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"{key} {ep['title']} → {vid}")


if __name__ == "__main__":
    main()
