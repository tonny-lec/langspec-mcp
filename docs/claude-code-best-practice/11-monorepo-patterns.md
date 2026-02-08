# モノレポでのパターン

## 概要

大規模モノレポで Claude Code を効果的に使うための2つの重要なパターン:
1. **CLAUDE.md のロード方式** — 祖先ロードと子孫の遅延ロード
2. **Skills の検出方式** — プロジェクトレベルとパッケージレベルの自動検出

---

## CLAUDE.md のロード方式（詳細は [01-claude-md-memory.md](01-claude-md-memory.md)）

### 2つのメカニズム

| メカニズム | 方向 | タイミング | 例 |
|-----------|------|----------|-----|
| **Ancestor Loading** | 上方向 | 起動時に即座 | `/mymonorepo/CLAUDE.md` は常にロード |
| **Descendant Loading** | 下方向 | ファイル操作時（遅延） | `frontend/CLAUDE.md` はそのディレクトリのファイルを操作した時 |

### 核心ルール

- **祖先は常にロード** — ルートの共有ルールが全コンポーネントに適用
- **子孫は遅延ロード** — 関連コンポーネントの指示だけがロードされる
- **兄弟はロードされない** — `frontend/` で作業中に `backend/CLAUDE.md` はロードされない

---

## Skills の検出方式

### CLAUDE.md との重要な違い

**Skills は CLAUDE.md と異なるロード方式を使う。**

| 振る舞い | CLAUDE.md | Skills |
|---------|-----------|--------|
| 祖先ロード（上方向） | **Yes** | **No** |
| ネスト検出（下方向） | Yes（遅延） | Yes（自動検出） |
| コンテンツロード | 全文 | Description のみ（呼び出し時に全文） |

Skills は上方向の探索を行わない。代わりにプロジェクトルートの `.claude/skills/` と、ファイル操作時にネストされた `.claude/skills/` を検出する。

### Skills の配置と検出

```
/mymonorepo/
├── .claude/skills/
│   └── shared-conventions/SKILL.md    # プロジェクトレベル（常に利用可能）
├── packages/
│   ├── frontend/
│   │   ├── .claude/skills/
│   │   │   └── react-patterns/SKILL.md  # frontend 固有
│   │   └── src/App.tsx
│   ├── backend/
│   │   ├── .claude/skills/
│   │   │   └── api-design/SKILL.md      # backend 固有
│   │   └── src/
│   └── shared/
│       ├── .claude/skills/
│       │   └── utils-patterns/SKILL.md  # shared 固有
│       └── src/
```

### 検出タイミング

**起動直後（ファイル操作なし）:**

| スキル | コンテキスト内? | 理由 |
|--------|-------------|------|
| `shared-conventions` | **Yes** | ルート `.claude/skills/` |
| `react-patterns` | **No** | `packages/frontend/` 未操作 |
| `api-design` | **No** | `packages/backend/` 未操作 |
| `utils-patterns` | **No** | `packages/shared/` 未操作 |

**`packages/frontend/src/App.tsx` を編集後:**

| スキル | コンテキスト内? | 理由 |
|--------|-------------|------|
| `shared-conventions` | **Yes** | ルート `.claude/skills/` |
| `react-patterns` | **Yes** | `packages/frontend/` のファイル操作で検出 |
| `api-design` | **No** | `packages/backend/` 未操作 |
| `utils-patterns` | **No** | `packages/shared/` 未操作 |

---

## 文字数バジェット

スキルの description はデフォルトで **15,000文字** のバジェット内でコンテキストにロードされる。

大規模モノレポで多くのパッケージとスキルがある場合、このリミットに達する可能性がある。

**対策**:
- `/context` コマンドで除外されたスキルの警告を確認
- `SLASH_COMMAND_TOOL_CHAR_BUDGET` 環境変数でリミットを増加
- description を簡潔に保つ

---

## Skills の優先順位

同名のスキルが複数レベルに存在する場合:

| 優先度 | レベル | スコープ |
|--------|--------|---------|
| 1（最高） | Enterprise | 組織全体 |
| 2 | Personal (`~/.claude/skills/`) | 個人の全プロジェクト |
| 3（最低） | Project (`.claude/skills/`) | このプロジェクトのみ |

Plugin スキルは `plugin-name:skill-name` の名前空間を持つため競合しない。

---

## モノレポでのベストプラクティス

### CLAUDE.md

1. **ルート CLAUDE.md に共有規約を配置** — コーディング規約、コミットメッセージ形式、PR テンプレート
2. **コンポーネント CLAUDE.md に固有の指示を配置** — フレームワーク固有パターン、テスト規約
3. **CLAUDE.local.md で個人設定** — `.gitignore` に追加

### Skills

1. **ルート `.claude/skills/` に共有ワークフロー** — リポジトリ全体で使う規約やパターン
2. **パッケージ `.claude/skills/` に固有スキル** — 各チームが独立して管理
3. **`disable-model-invocation: true` で危険なスキルを保護** — デプロイ系は明示的呼び出しのみ
4. **description は簡潔に** — コンテキストバジェットを節約
5. **名前にプレフィックスを使用** — `frontend-review`, `backend-deploy` で混乱を防止

---

## この設計がモノレポに適する理由

1. **パッケージ固有のスキルが分離される** — フロントエンド開発者がバックエンドスキルでコンテキストを汚染されない
2. **自動検出で設定が不要** — パッケージレベルのスキルを明示的に登録する必要がない
3. **コンテキストが最適化される** — Description のみロード + ネストスキルのオンデマンド検出
4. **チームが独立してスキルを管理できる** — 他チームとの調整なしで自チームのスキルを定義・更新

---

## 出典

- [Claude Code Documentation - CLAUDE.md Loading](https://code.claude.com/docs/en/memory#how-claude-looks-up-memories)
- [Claude Code Documentation - Skills Discovery](https://code.claude.com/docs/en/skills#automatic-discovery-from-nested-directories)
- [Boris Cherny on X - CLAUDE.md Loading 解説](https://x.com/bcherny/status/2016339448863355206)
