# 農作業レポートサイト（GitHub Pages）

iPhoneショートカット → Googleスプレッドシート（台帳）に貯めた農作業記録を、
静的サイトとして表示・公開するための一式です。

- 記録：ショートカットの音声入力が `raw_json` として台帳に1行=1レポートで溜まる
- 変換：`convert.py` が台帳（CSV）を読み、サイト表示用の `data/reports.json` を生成
- 表示：作業内容 / 作業時間 / 収穫 / 農薬散布を表で表示し、その下に画像（Drive画像URL対応）
- ホスティング：GitHub Pages（無料・静的）

---

## データの流れ

```
iPhoneショートカット
      │ 音声要約 raw_json を1行追記
      ▼
Googleスプレッドシート「農作業台帳」   ← A〜L列（下表）
      │ CSVエクスポート or ウェブ公開
      ▼
data/ledger.csv   ─ python convert.py ─▶  data/reports.json
                                                │
                                                ▼
                                    index.html / js/app.js が描画
```

台帳が主データ、`reports.json` は生成物です。`reports.json` は手で編集しません。

---

## 台帳の列マッピング（A〜L列）

| 列 | ヘッダー | 用途 | サイトJSONでの扱い |
|----|----------|------|-------------------|
| A | 受信時刻 | 記録の受信日時 | raw_json内に日時が無い場合の日付フォールバック |
| B | record_id | サーバ側ID | 未使用 |
| C | record_type | `general_work` / `pesticide_application` | 収穫か農薬かの判定に使用 |
| D | summary | 作業の要約文 | `work`（作業内容） |
| E | raw_json | **主データ**（下記details） | 収穫・農薬・圃場・日時などを抽出 |
| F | client_record_id | 端末側ID | idの予備 |
| G | status | 手動確認ステータス | **`confirmed` のみ公開**。`needs_review`（希釈・散布量が未確定）や空欄は保留してアップしない |
| H | problems | 不備メモ | `note`に「（要確認：…）」として付記 |
| I | 希釈倍数 | 手動訂正用 | 値があれば raw_json より**優先** |
| J | 散布量(L) | 手動訂正用 | 値があれば raw_json より**優先** |
| K | 対象病害虫 | 手動訂正用 | 値があれば raw_json より**優先** |
| L | photo_url | Drive画像URL | `images`（表示用サムネイルURLに自動変換） |
| M | 施肥量 | 肥料の散布量（液肥=L, 追肥=kg）手動訂正用 | 肥料の `amount` を上書き |
| N | 液肥希釈倍数 | 液肥のみ・手動訂正用 | 肥料の `dilution` を上書き |

`raw_json` の `details` から抽出する主な項目：

- `location` → 圃場名（`convert.py` の `LOCATION_MAP` でコード→表示名に変換）
- `date` → `date` / `time`
- `crops[]`（`crop_name`, `harvest_amount_kg`, `observation`）→ `harvest` と `note`
- `pesticide_name` → **農薬名**（台帳に列が無いので raw_json から新規抽出）
- `dilution_ratio` / `spray_volume_l` / `target_disease` → 希釈・散布量・対象（I/J/K列で上書き可）
- `notes` → `note`

record_type による分岐：
- `pesticide_application`（農薬）→ `pesticide`
- `fertilizer_application`（肥料・活力剤）→ `fertilizer`（希釈は液肥のみ・散布量はL/kg・目的・対象作物）。農薬散布には含めない
- `general_work` など → 収穫があれば `harvest`

> record_type が誤って農薬でも、名前（メネデール・液肥・活力剤・化成・尿素等）で肥料と判定して救済する。
> 確実に分けるにはシステムプロンプトで肥料・活力剤を `fertilizer_application` に分類させる。

> 注：台帳には**作業時間**の列がないため、その欄は空欄（「—」）表示です（音声から拾えない前提）。
> **天気**は台帳に列が無くても、圃場の座標＋作業時刻から過去天気APIで自動取得します（次項）。

---

## ローカルで確認する

```bash
cd farm-report-site
python convert.py                 # data/ledger.csv → data/reports.json
python -m http.server 8000 --directory .
# ブラウザで http://localhost:8000 を開く
```

`file://` で直接開くと fetch がブロックされるため、必ずローカルサーバー経由で開いてください。

別のCSVや公開URLを変換する場合：

```bash
python convert.py path/to/other.csv
python convert.py --url "https://docs.google.com/.../pub?output=csv"
```

---

## 更新のしかた（3通り）

### A. 台帳CSVを差し替えて push（今すぐ動く・手軽）
1. 台帳を「ファイル → ダウンロード → カンマ区切り(.csv)」でエクスポート
2. `data/ledger.csv` を上書き
3. `git push` → CIが `convert.py` を実行して自動デプロイ

### B. 台帳を「ウェブに公開」して全自動（推奨・自動更新）
1. スプレッドシートで「ファイル → 共有 → ウェブに公開 → CSV」を選び、公開URLを取得
2. `.github/workflows/deploy.yml` の生成ステップを次に変更：
   ```yaml
   run: python convert.py --url "https://docs.google.com/.../pub?gid=0&single=true&output=csv"
   ```
3. 定期実行したい場合は `on:` に `schedule` を追加：
   ```yaml
   on:
     schedule:
       - cron: '0 21 * * *'   # 毎日 06:00 JST（UTC 21:00）
     workflow_dispatch:
   ```
   ※ scheduleだけではデプロイartifactの再生成に push が要る構成のため、
     自動コミット（`reports.json` を commit する step）を足すか、`workflow_dispatch` で手動実行します。

### C. Google Drive API / サービスアカウント（最も堅牢）
台帳を非公開のまま自動取得したい場合はサービスアカウントを発行し、
Sheets APIで読む方式に差し替えます（必要になったら対応します）。

---

## 天気の自動取得

台帳に天気列はありませんが、**圃場の座標＋作業時刻**から過去天気を自動で引いて
`weather`（例：「晴れ 28℃」）に埋めます。天気APIは Open-Meteo（無料・APIキー不要）を使用。

設定は一度だけ。`convert.py` の `FIELD_COORDS` に圃場コードの緯度経度を入れます。

```python
FIELD_COORDS = {
    "field_sawayaka_01": (34.6851, 135.5200),   # ← 実際の座標に置き換える
}
```

座標はGoogleマップで圃場を右クリック→先頭の数値（緯度, 経度）をコピーして貼るのが早いです。
未設定（`None`）の圃場は天気が空欄になります。

- 粒度：作業時刻に最も近い1時間の天気・気温（`raw_json` の時刻を使用）
- 直近の日付は forecast API（`past_days`）、古い日付は archive API を自動で使い分け
- 通信できない・データが無い場合は空欄で継続（サイトは落ちません）
- オフラインで変換だけ試すときは `python convert.py --no-weather`

---

## 画像について（重要）

台帳の `photo_url` はGoogle Driveの共有リンクです。サイト表示には
`https://drive.google.com/thumbnail?id=<ID>&sz=w2000` へ自動変換していますが、
**対象ファイルが「リンクを知っている全員が閲覧可」で共有されている必要があります**。
非公開のままだと画像枠に「画像を表示できません」と出ます。

Drive画像はサイト側の容量を消費しません（GitHubには載せない）。
共有設定さえ整えれば、そのまま外部表示されます。

---

## ディレクトリ構成

```
farm-report-site/
├─ index.html                 # 表示ページ
├─ css/style.css
├─ js/app.js                  # reports.json を読んで描画（Drive画像URL対応）
├─ convert.py                 # 台帳CSV → reports.json を生成
├─ .nojekyll
├─ .github/workflows/deploy.yml
└─ data/
   ├─ ledger.csv              # 台帳のエクスポート（入力）
   └─ reports.json            # 生成物（表示側が読む）。手で編集しない
```
