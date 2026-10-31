# Google Workspace 活用動画

全力先生(@edupower07)が作っている、学校の先生向けの Google Workspace の使い方動画(全60回、1本30秒ほど)をまとめて見られるサイトです。

- サイトの本体: `docs/`(GitHub Pages で `docs/` を公開する形)
- 元の動画や表紙: Google ドライブ「ClaudeCode×Google活用動画」フォルダ
- 動画の再生: YouTube(限定公開)に上げた動画を埋め込む

いまは公開前のため、`docs/index.html` に検索エンジンよけ(`noindex`)を入れています。公開するときに外します。

## フォルダの中身

| 場所 | 中身 |
|---|---|
| `docs/index.html` | サイトのページ(1ページだけ) |
| `docs/assets/` | 見た目(`style.css`)、動き(`app.js`)、表紙の画像(`covers/`) |
| `docs/data/episodes.json` | 全回のデータ(タイトル、説明、アプリ、長さ、YouTube の動画ID など) |
| `scripts/sync_from_drive.py` | ドライブから全回のデータと表紙を取りこむ |
| `scripts/make_upload_sheet.py` | YouTube に上げるときのタイトルと説明の表を作る |
| `scripts/set_youtube_id.py` | 上げた動画の ID をデータに記録する |
| `scripts/download_videos.py` | YouTube に上げる動画をドライブからまとめてダウンロードする |
| `youtube/UPLOAD_SHEET.md` | YouTube のアップロード表(自動で作る) |
| `YOUTUBE_UPLOAD.md` | YouTube へのアップロードを、ローカルの Claude Code に任せるための手順書 |

## よくある作業

### 新しい回ができたとき

```bash
python3 scripts/sync_from_drive.py      # ドライブから取りこむ(すでに入っている動画IDは消えない)
python3 scripts/make_upload_sheet.py    # アップロード表を作り直す
```

そのあと `YOUTUBE_UPLOAD.md` の手順で YouTube に上げて、動画IDを記録します。

`sync_from_drive.py` には環境変数 `GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` / `GDRIVE_REFRESH_TOKEN` が必要です。
新しい回のアプリのタグは自動で推定します。直したいときは `scripts/sync_from_drive.py` の `APP_OVERRIDES` に書きます。

### 手元で見る

```bash
cd docs && python3 -m http.server 8000
```

http://localhost:8000 を開きます(`index.html` を直接開くと、データが読みこめません)。

### 公開するとき

1. `docs/index.html` の `<meta name="robots" content="noindex, nofollow">` の行を消す
2. GitHub のリポジトリの Settings → Pages で、Branch を `main`、フォルダを `/docs` にする
   (非公開のリポジトリで Pages を使うには、GitHub の有料プランが必要です)
