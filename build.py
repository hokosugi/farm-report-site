#!/usr/bin/env python3
"""
data/reports/*.json を走査して data/reports.json（配列）を再生成する。

ショートカットは data/reports/ に1レポート=1ファイルを置くだけでよく、
このスクリプトが全ファイルをまとめた一覧を作る。
CI（GitHub Actions）またはローカルで実行する。

使い方:
    python build.py            # プロジェクト直下で実行
    python build.py --check    # 検証のみ（書き込みしない）
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPORTS_DIR = ROOT / "data" / "reports"
OUTPUT = ROOT / "data" / "reports.json"

# レポート1件に必須のキー
REQUIRED = ["id", "date", "work"]


def load_report(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    missing = [k for k in REQUIRED if k not in data or data[k] in (None, "")]
    if missing:
        raise ValueError(f"{path.name}: 必須キー不足 -> {', '.join(missing)}")
    # 既定値の補完（表示側で落ちないように）
    data.setdefault("time", "")
    data.setdefault("field", "")
    data.setdefault("weather", "")
    data.setdefault("note", "")
    data.setdefault("harvest", [])
    data.setdefault("pesticide", [])
    data.setdefault("images", [])
    data.setdefault("extra_images", [])
    return data


def build(check_only: bool = False) -> int:
    if not REPORTS_DIR.exists():
        print(f"レポートフォルダが見つかりません: {REPORTS_DIR}", file=sys.stderr)
        return 1

    files = sorted(REPORTS_DIR.glob("*.json"))
    reports, errors = [], []
    for path in files:
        try:
            reports.append(load_report(path))
        except (json.JSONDecodeError, ValueError) as e:
            errors.append(str(e))

    if errors:
        print("=== エラー ===", file=sys.stderr)
        for e in errors:
            print(" -", e, file=sys.stderr)
        return 1

    # 新しい順（date + time 降順）
    reports.sort(key=lambda r: f"{r.get('date','')} {r.get('time','')}", reverse=True)

    print(f"レポート {len(reports)} 件を読み込みました。")
    if check_only:
        print("--check: 検証のみ。書き込みは行いません。")
        return 0

    OUTPUT.write_text(
        json.dumps(reports, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"生成: {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(build(check_only="--check" in sys.argv))
