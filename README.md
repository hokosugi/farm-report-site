# 農作業レポートサイト（GitHub Pages）

iPhoneショートカットで記録した農作業レポート（音声要約JSON＋画像）を、
静的サイトとして表示・公開するための一式です。

- 表示：作業内容 / 作業時間 / 収穫 / 農薬散布を表で表示し、その下にメイン画像（キャプション付き）、さらに下に追加画像を並べる
- 更新：`data/reports/` にレポートJSONを1件=1ファイルで置くだけ。CIが一覧（`data/reports.json`）を自動再生成してデプロイ
- ホスティング：GitHub Pages（無料・静的）

---

## ディレクトリ構成

```
farm-report-site/
├─ index.html                 # 表示ページ
├─ css/style.css
├─ js/app.js                  # reports.json を読んで描画
├─ build.py                   # reports/*.json → reports.json を生成
├─ .nojekyll                  # GitHub Pages の Jekyll 処理を無効化
├─ .github/workflows/deploy.yml   # push で自動ビルド＆デプロイ
└─ data/
   ├─ reports.json            # 生成物（一覧）。手で編集しない
   ├─ reports/                # ★ここに1件=1ファイルで置く
   │  └─ 2026-08-01-0700.json
   └─ images/                 # ★画像はここ。レポートIDごとにフォルダ
      └─ 2026-08-01-0700/
         ├─ main.jpg          # メイン画像（1枚 or なし）
         ├─ extra-1.jpg       # 追加画像
         └─ extra-2.jpg
```

---

## JSONスキーマ（1レポート＝1ファイル）

ファイル名は `data/reports/<id>.json`。`id` は日時ベースで一意にしてください（例 `2026-08-01-0700`）。

```json
{
  "id": "2026-08-01-0700",     // 必須・一意。画像フォルダ名と揃える
  "date": "2026-08-01",        // 必須 YYYY-MM-DD
  "time": "07:00",             // 任意 HH:MM
  "field": "第一圃場",          // 任意 圃場名
  "weather": "晴れ",            // 任意
  "work": "トマトの定植…",       // 必須 作業内容
  "duration_min": 150,         // 任意 作業時間（分）。表では「2時間30分」に整形
  "harvest": [                 // 任意 収穫（複数可）。空配列なら「なし」
    { "item": "キュウリ", "qty": 8.5, "unit": "kg" }
  ],
  "pesticide": [               // 任意 農薬散布（複数可）。空配列なら「なし」
    { "name": "ダコニール1000", "dilution": "1000倍", "target": "うどんこ病予防", "amount": "40L" }
  ],
  "note": "灌水を早めに実施",     // 任意 メモ
  "images": [                  // メイン画像（0〜1枚が既定）
    { "file": "images/2026-08-01-0700/main.jpg", "caption": "定植後の様子" }
  ],
  "extra_images": [            // 追加画像フォルダ（0〜複数）
    { "file": "images/2026-08-01-0700/extra-1.jpg", "caption": "支柱立て" }
  ]
}
```

- `images` を空配列にすれば画像なしのレポートになります（ショートカットの既定）。
- `file` のパスは `data/` からの相対（`images/...`）で書きます。

---

## 初回セットアップ（GitHub Pages）

1. GitHubで新規リポジトリを作成し、この `farm-report-site/` の中身一式を push する。
2. リポジトリの **Settings → Pages** を開く。
3. **Build and deployment → Source** を **GitHub Actions** に設定する。
4. `main` ブランチに push すると `deploy.yml` が動き、数分後に
   `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される。

以降は `data/reports/` にファイルを追加して push するだけで自動更新されます。

---

## レポートを追加する（iPhoneショートカット側）

ショートカットからの投入方法は2通り。手軽なのは A です。

### A. GitHub APIで直接コミット（推奨）
ショートカットの「URLの内容を取得」でGitHubのContents APIを叩き、
`data/reports/<id>.json` と画像ファイルを作成（PUT）します。

- 必要なもの：GitHubの **Fine-grained personal access token**（対象リポジトリの `Contents: Read and write` 権限のみ）
- エンドポイント：`PUT https://api.github.com/repos/<user>/<repo>/contents/data/reports/<id>.json`
- 本文：`{ "message": "add report", "content": "<Base64化したJSON>" }`
- 画像も同様に `data/images/<id>/main.jpg` へ、Base64化して PUT

push されると CI が走り、サイトが更新されます。

### B. 手動 / PC経由
ショートカットで作ったJSONと画像をPCに移し、`data/reports/` と
`data/images/<id>/` に置いて `git push` する。

---

## 画像は「圧縮版」を載せる（重要）

GitHub Pagesの公開サイト上限は1GB。iPhoneの無圧縮写真（2〜4MB）をそのまま貯めると
数百枚で頭打ちになります。**長辺1600px・JPEG品質80%程度に圧縮**すれば1枚300KB〜1MBに収まり、
数千枚＝数年分入ります。圧縮はショートカット側（「イメージのサイズを変更」アクション）で
行うのが手軽です。

原本を高画質で残したい場合は、原本だけ別ストレージ（Googleフォト等）に保管し、
サイトには圧縮版のみ載せる運用にしてください。

---

## ローカルで確認する

```bash
cd farm-report-site
python build.py            # reports.json を生成
python -m http.server 8000 --directory .
# ブラウザで http://localhost:8000 を開く
```

`file://` で直接開くと fetch がブロックされるため、必ずローカルサーバー経由で開いてください。
