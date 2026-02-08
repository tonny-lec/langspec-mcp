# ブラウザ自動化 MCP 比較

## 3つの選択肢

Claude Code でブラウザ自動化を行うための主要な MCP サーバーの比較。

---

## 一覧

### A. Chrome DevTools MCP

| 項目 | 詳細 |
|------|------|
| **提供元** | Google Chrome チーム（公式） |
| **アーキテクチャ** | Chrome DevTools Protocol (CDP) + Puppeteer |
| **トークン使用量** | ~19.0k tokens (9.5% of context) |
| **ツール数** | 26 |
| **強み** | パフォーマンス分析、ネットワークデバッグ |

### B. Claude in Chrome

| 項目 | 詳細 |
|------|------|
| **提供元** | Anthropic（公式拡張機能） |
| **アーキテクチャ** | ブラウザ拡張 + Computer Use |
| **トークン使用量** | ~15.4k tokens (7.7% of context) |
| **ツール数** | 16 |
| **強み** | ログイン状態での操作、視覚的確認 |

### C. Playwright MCP

| 項目 | 詳細 |
|------|------|
| **提供元** | Microsoft（公式 + コミュニティ） |
| **アーキテクチャ** | Accessibility Tree ベースの自動化 |
| **トークン使用量** | ~13.7k tokens (6.8% of context) |
| **ツール数** | 21 |
| **強み** | クロスブラウザ対応、E2E テスト |

---

## 詳細比較表

| 機能 | Chrome DevTools | Claude in Chrome | Playwright |
|------|----------------|------------------|------------|
| **主目的** | デバッグ & パフォーマンス | 汎用ブラウザ操作 | UI テスト & E2E |
| **ブラウザ対応** | Chrome のみ | Chrome のみ | Chromium, Firefox, WebKit |
| **トークン効率** | 19.0k (9.5%) | 15.4k (7.7%) | **13.7k (6.8%)** |
| **要素選択** | CSS/XPath | 視覚 + DOM | Accessibility Tree |
| **パフォーマンストレース** | **優秀** | なし | 限定的 |
| **ネットワーク検査** | **深い分析** | 基本的 | 基本的 |
| **コンソールログ** | **完全アクセス** | 完全アクセス | 限定的 |
| **クロスブラウザ** | No | No | **Yes** |
| **CI/CD 統合** | **優秀** | 不向き（ログイン必要） | **優秀** |
| **ヘッドレスモード** | Yes | No | Yes |
| **認証** | 設定が必要 | セッション利用 | 設定が必要 |
| **スケジュールタスク** | No | Yes | No |
| **コスト** | 無料 | 有料プラン必須 | 無料 |

---

## ツール一覧

### Chrome DevTools MCP（26ツール）

```
INPUT AUTOMATION (8):  click, drag, fill, fill_form, handle_dialog,
                       hover, press_key, upload_file

NAVIGATION (6):        close_page, list_pages, navigate_page,
                       new_page, select_page, wait_for

EMULATION (2):         emulate, resize_page

PERFORMANCE (3):       performance_analyze_insight,
                       performance_start_trace, performance_stop_trace

NETWORK (2):           get_network_request, list_network_requests

DEBUGGING (5):         evaluate_script, get_console_message,
                       list_console_messages, take_screenshot,
                       take_snapshot
```

### Claude in Chrome（16ツール）

```
BROWSER CONTROL:       navigate, read_page, find, computer
                       (click, type, scroll)
FORM INTERACTION:      form_input, javascript_tool
MEDIA:                 upload_image, get_page_text, gif_creator
TAB MANAGEMENT:        tabs_context_mcp, tabs_create_mcp
DEVELOPMENT:           read_console_messages, read_network_requests
UTILITIES:             shortcuts_list, shortcuts_execute,
                       resize_window, update_plan
```

### Playwright MCP（21ツール）

```
NAVIGATION:            navigate, goBack, goForward, reload
INTERACTION:           click, fill, select, hover, press, drag, uploadFile
ELEMENT QUERIES:       getElement, getElements, waitForSelector
ASSERTIONS:            assertVisible, assertText, assertTitle
PAGE STATE:            screenshot, getAccessibilityTree, evaluateScript
BROWSER MGMT:         newPage, closePage
```

---

## 用途別推奨

### Chrome DevTools MCP が最適

- **パフォーマンステスト** — Core Web Vitals、レンダリングボトルネック、メモリリーク
- **深いデバッグ** — ネットワークリクエスト詳細、コンソールエラー、DOM 検査
- **CI/CD パイプライン** — ヘッドレス実行、スクリプトベース

### Claude in Chrome が最適

- **手動テスト補助** — ログイン状態でのテスト、探索的テスト
- **素早い確認** — Figma との比較、新機能のスポットチェック
- **定期ブラウザタスク** — スケジュール自動チェック

### Playwright MCP が最適

- **E2E テスト自動化** — クロスブラウザテスト、テストスクリプト生成
- **信頼性の高い UI テスト** — Accessibility Tree ベースで壊れにくいセレクタ
- **CI/CD 統合** — ヘッドレスモード、テスト管理ツール連携

---

## トークン効率の影響

200k トークンコンテキストの場合:

| ツール | トークン使用量 | 残りコンテキスト |
|--------|-------------|----------------|
| Playwright | ~13.7k | **186.3k** |
| Claude in Chrome | ~15.4k | 184.6k |
| Chrome DevTools | ~19.0k | 181.0k |

Playwright と Chrome DevTools の差は **~5.3k トークン**。大量のコード文脈を扱うセッションでは重要。

---

## セキュリティ考慮事項

| 観点 | Chrome DevTools | Claude in Chrome | Playwright |
|------|----------------|------------------|------------|
| ブラウザプロファイル | 分離 | **実際のセッション使用** | 分離 |
| クラウド依存 | なし | あり | なし |
| 攻撃成功率 | - | 23.6%（緩和策なし）→ 11.2%（緩和策あり） | - |
| 制限サイト | - | 金融/アダルト/海賊版サイトブロック | - |
| 成熟度 | 安定 | **ベータ** | 安定 |

> **Claude in Chrome の注意**: 実際のブラウザセッション（Cookie）を使用するため、セキュリティリスクがある。

---

## インストール方法

```bash
# Playwright MCP（推奨: ユーザースコープ）
npx playwright install
claude mcp add playwright -s user -- npx @playwright/mcp@latest

# Chrome DevTools MCP
claude mcp add chrome-devtools -s user -- npx chrome-devtools-mcp@latest

# Claude in Chrome
# Chrome Web Store からインストール（Pro/Max/Team/Enterprise プランが必要）
```

---

## 推奨セットアップ

### 2つをインストール（推奨）

```bash
npx playwright install
claude mcp add playwright -s user -- npx @playwright/mcp@latest
claude mcp add chrome-devtools -s user -- npx chrome-devtools-mcp@latest
```

### ワークフロー

```
1. DEVELOP  → Claude Code (terminal)
2. TEST     → Playwright MCP (E2E, cross-browser)
3. DEBUG    → Chrome DevTools MCP (performance, network)
4. VERIFY   → Claude in Chrome (quick visual checks)
5. CI/CD    → Playwright MCP (headless, automated)
```

---

## 用途別早見表

| 必要なこと | 使うべきツール |
|-----------|-------------|
| クロスブラウザ E2E テスト | **Playwright MCP** |
| パフォーマンス分析 | **Chrome DevTools MCP** |
| ネットワークデバッグ | **Chrome DevTools MCP** |
| 素早い視覚確認 | **Claude in Chrome** |
| CI/CD 自動化 | **Playwright MCP** |
| テストスクリプト生成 | **Playwright MCP** |
| 最小トークン使用 | **Playwright MCP** |
| ログイン状態テスト | **Claude in Chrome** |
| コンソールログデバッグ | **Chrome DevTools MCP** |

---

## 出典

- [Chrome DevTools MCP - GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Playwright MCP - GitHub](https://github.com/microsoft/playwright-mcp)
- [Anthropic - Claude for Chrome](https://claude.com/blog/claude-for-chrome)
