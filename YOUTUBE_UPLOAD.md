# YouTube アップロードの引き継ぎ(ローカルの Claude Code 向け)

クラウドの Claude Code には YouTube にログインしたブラウザが無いため、アップロードはローカル(自分のパソコン)の Claude Code でブラウザを操作して行います。
このファイルは、その作業をローカルの Claude Code にそのまま任せるための手順書です。

## 依頼するときの文(コピーして Claude Code に渡す)

```text
このリポジトリの YOUTUBE_UPLOAD.md を読んで、その手順どおりに
Google Workspace 活用動画を YouTube にアップロードして、動画IDをサイトのデータに記録してほしい。
ブラウザは私の YouTube にログイン済みの Chrome を使って。
公開設定は必ず 限定公開 にして、公開 にはしないこと。
まず最初の3本だけやって、うまくいったら確認をとってから残りを進めて。
```

## 前提

- ブランチ `claude/wonderful-faraday-gd4xg1` で作業する(`git pull` してから始める)
- アップロード先の YouTube チャンネルは、全力先生(@edupower07)のチャンネル。複数のチャンネルがある場合は、始める前に本人に確認する
- `youtube/UPLOAD_SHEET.md` に、回ごとのタイトル・説明文・動画ファイル名・ドライブのリンクがまとまっている

## 手順

### 1. 動画ファイルを手元に用意する

次のどれかでよい。

- A. `python3 scripts/download_videos.py` を実行する(環境変数 `GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` / `GDRIVE_REFRESH_TOKEN` が必要)。`youtube/videos/` に保存される
- B. パソコンに Google ドライブ(デスクトップ版)が入っていれば、`マイドライブ/ClaudeCode×Google活用動画/第NN回_…/` の中の `*_video.mp4` をそのまま使う
- C. `youtube/UPLOAD_SHEET.md` のドライブのリンクをブラウザで開いてダウンロードする

使うのは **横の動画 `*_video.mp4`** だけ。縦の `*_video_v.mp4` は使わない。

### 2. YouTube Studio でアップロードする

https://studio.youtube.com を開き、作成 → 動画をアップロード。一度に最大15本まで選べる。

1本ごとに、`youtube/UPLOAD_SHEET.md` のその回の欄を見て、次のとおりに入れる。

| 項目 | 入れるもの |
|---|---|
| タイトル | アップロード表の タイトル をそのまま |
| 説明 | アップロード表の 説明 をそのまま(``` の中身だけ) |
| サムネイル | 任意。入れるなら、ドライブの同じフォルダの `*_cover.png`(16:9) |
| 再生リスト | `Google Workspace 活用動画(全60回)`。無ければ 限定公開 で新しく作る |
| 視聴者 | **いいえ、子ども向けではありません** |
| 公開設定 | **限定公開**(公開 にはしない。非公開 だとサイトに埋め込めない) |

- 「動画の要素」「チェック」の画面は変えずに次へ進んでよい
- ファイル選択の画面がブラウザ操作で開けない場合は、Playwright の `setInputFiles` でページの `input[type=file]` にファイルを渡すとよい
- 1日にアップロードできる本数には上限がある。上限のメッセージが出たら、その日はそこで止めて、翌日に続きから進める

### 3. 動画IDを記録する

アップロードが終わると、動画のリンク(`https://youtu.be/XXXXXXXXXXX`)が出る。末尾の11文字が動画ID。

```bash
python3 scripts/set_youtube_id.py 12 https://youtu.be/XXXXXXXXXXX
```

- 最初の引数は回のID(`01`〜`60`、番外編は `ex-canvas`)
- 記録の状況は `python3 scripts/set_youtube_id.py --list` で見られる
- 記録したら `python3 scripts/make_upload_sheet.py` でアップロード表を作り直す(済んだ回が表から消える)

### 4. コミットしてプッシュする

```bash
git add docs/data/episodes.json youtube/UPLOAD_SHEET.md
git commit -m "YouTube の動画IDを記録(第NN回〜第MM回)"
git push origin claude/wonderful-faraday-gd4xg1
```

数本ずつこまめにコミットしてよい。

### 5. 確認する

```bash
cd docs && python3 -m http.server 8000
```

http://localhost:8000 を開いて、記録した回のカードを押し、動画が再生できることを確かめる。
再生できない場合は、YouTube Studio のその動画の 詳細 → もっと見る → 埋め込みを許可 がオンになっているかを見る。

## やってはいけないこと

- 公開設定を **公開** にしない(サイトもまだ公開しない予定のため)
- チャンネルにすでにある、ほかの動画を変えたり消したりしない
- `docs/data/episodes.json` を手で大きく書きかえない(動画IDは `set_youtube_id.py` で入れる)
