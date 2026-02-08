# CLAUDE.md とメモリ管理

## CLAUDE.md とは

CLAUDE.md は Claude Code がセッション開始時に自動的に読み込む **永続的コンテキストファイル** である。
プロジェクトの指示、コーディング規約、アーキテクチャ概要などを記載し、Claude の振る舞いをプロジェクトに合わせてカスタマイズする。

---

## CLAUDE.md のロード機構

Claude Code は **2つの異なるメカニズム** で CLAUDE.md を読み込む。

### 1. Ancestor Loading（上方向への探索）

Claude Code 起動時、**カレントディレクトリからファイルシステムのルートに向かって上方向に** 探索し、見つかったすべての CLAUDE.md を読み込む。

- **起動時に即座にロードされる**
- 常に親ディレクトリの設定が適用される

### 2. Descendant Loading（下方向への遅延探索）

カレントディレクトリ配下のサブディレクトリにある CLAUDE.md は **起動時にはロードされない**。
Claude がそのサブディレクトリのファイルを読み書きした時点で初めて読み込まれる（**遅延ロード / Lazy Loading**）。

---

## モノレポでの具体例

```
/mymonorepo/
├── CLAUDE.md          # ルートレベル（共有指示）
├── frontend/
│   └── CLAUDE.md      # フロントエンド固有の指示
├── backend/
│   └── CLAUDE.md      # バックエンド固有の指示
└── api/
    └── CLAUDE.md      # API固有の指示
```

### シナリオ1: ルートディレクトリから起動

```bash
cd /mymonorepo && claude
```

| ファイル | 起動時ロード? | 理由 |
|---------|-------------|------|
| `/mymonorepo/CLAUDE.md` | Yes | カレントディレクトリ |
| `/mymonorepo/frontend/CLAUDE.md` | No | `frontend/` のファイルを操作した時にロード |
| `/mymonorepo/backend/CLAUDE.md` | No | `backend/` のファイルを操作した時にロード |
| `/mymonorepo/api/CLAUDE.md` | No | `api/` のファイルを操作した時にロード |

### シナリオ2: コンポーネントディレクトリから起動

```bash
cd /mymonorepo/frontend && claude
```

| ファイル | 起動時ロード? | 理由 |
|---------|-------------|------|
| `/mymonorepo/CLAUDE.md` | Yes | 祖先ディレクトリ（上方向探索） |
| `/mymonorepo/frontend/CLAUDE.md` | Yes | カレントディレクトリ |
| `/mymonorepo/backend/CLAUDE.md` | No | 別ブランチ（兄弟ディレクトリ） |
| `/mymonorepo/api/CLAUDE.md` | No | 別ブランチ（兄弟ディレクトリ） |

---

## ロードの核心ルール

| ルール | 説明 |
|--------|------|
| **祖先は常にロード** | 上方向の CLAUDE.md は起動時に必ずロードされる |
| **子孫は遅延ロード** | サブディレクトリの CLAUDE.md はファイル操作時に初めてロード |
| **兄弟はロードされない** | `frontend/` で作業中に `backend/CLAUDE.md` がロードされることはない |
| **グローバル CLAUDE.md** | `~/.claude/CLAUDE.md` に配置すると全プロジェクトに適用 |

---

## この設計がモノレポで有効な理由

1. **共有指示が下位に伝播** — ルートレベルの CLAUDE.md にリポジトリ全体の規約を記載すれば、どのディレクトリから起動しても適用される
2. **コンポーネント固有の指示は分離される** — フロントエンド開発者がバックエンドの指示でコンテキストを汚染されない
3. **コンテキストが最適化される** — 遅延ロードにより、無関係な指示の読み込みを回避

---

## CLAUDE.md のベストプラクティス

### 行数制限

**150行以下を推奨。** 長すぎると Claude の遵守率が低下する。これは著者の経験則であり、100%の保証はないが、実用的な目安として有効。

### 配置戦略

| 何を書くか | どこに置くか |
|-----------|------------|
| コーディング規約、コミットメッセージ形式、PR テンプレート | ルート `CLAUDE.md` |
| フレームワーク固有のパターン、テスト規約 | コンポーネントの `CLAUDE.md` |
| 個人的な設定（チームに共有しない指示） | `CLAUDE.local.md`（`.gitignore` に追加） |

### 効果的な CLAUDE.md の構成例（リポジトリから）

```markdown
# CLAUDE.md

## Repository Overview
[リポジトリの目的を簡潔に]

## Key Components
[主要コンポーネントの一覧と場所]

## Critical Patterns
[Claude が守るべき重要なパターン]

## Workflow Best Practices
[作業時の注意点]

## Debugging Tips
[デバッグの Tips]
```

**核心**: CLAUDE.md は「Claude にとっての README」である。人間が README を読んでプロジェクトを理解するのと同様に、Claude は CLAUDE.md を読んでプロジェクトのコンテキストを理解する。

---

## CLAUDE.local.md

- `.gitignore` に追加して使う個人用ファイル
- チームメンバーに影響を与えずに個人の設定を追加可能
- 例: デバッグ用の追加指示、個人的なワークフロー設定

---

## グローバル CLAUDE.md

`~/.claude/CLAUDE.md` に配置すると、すべての Claude Code セッションで自動的にロードされる。

用途:
- 全プロジェクト共通のコーディングスタイル
- 個人的なワークフロー設定
- よく使うコマンドやパターンの定義

---

## 出典

- [Claude Code Documentation - How Claude Looks Up Memories](https://code.claude.com/docs/en/memory#how-claude-looks-up-memories)
- [Boris Cherny on X - CLAUDE.md Loading 解説](https://x.com/bcherny/status/2016339448863355206)
