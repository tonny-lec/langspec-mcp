# RPI ワークフロー

## RPI とは

**R**esearch → **P**lan → **I**mplement の略。
各フェーズにバリデーションゲートを設けた体系的な開発ワークフローである。
実現不可能な機能に時間を浪費することを防ぎ、包括的なドキュメンテーションを確保する。

---

## ワークフロー全体像

```
Step 1: Describe   → 機能の記述（手動）
Step 2: Research   → 実現可能性調査（/rpi:research）
Step 3: Plan       → 計画ドキュメント作成（/rpi:plan）
Step 4: Implement  → フェーズ別実装（/rpi:implement）
```

---

## フォルダ構造

すべての機能作業は `rpi/{feature-slug}/` 配下に集約される:

```
rpi/{feature-slug}/
├── REQUEST.md              # Step 1: 機能の初期記述
├── research/
│   └── RESEARCH.md         # Step 2: GO/NO-GO 分析
├── plan/
│   ├── PLAN.md             # Step 3: 実装ロードマップ
│   ├── pm.md               # プロダクト要件
│   ├── ux.md               # UX 設計
│   └── eng.md              # 技術仕様
└── implement/
    └── IMPLEMENT.md        # Step 4: 実装記録
```

---

## Step 1: Describe（機能の記述）

**手動ステップ。**

1. Claude にプランモードで機能を記述させる
2. 出力: `rpi/plans/{feature-name}.md`
3. 機能フォルダ `rpi/{feature-slug}/` を作成
4. プランを `REQUEST.md` にリネームしてコピー

```
User: "Add OAuth2 authentication with Google and GitHub providers"

1. Claude generates plan → rpi/plans/oauth2-authentication.md
2. Create: rpi/oauth2-authentication/
3. Copy & rename: rpi/oauth2-authentication/REQUEST.md
```

---

## Step 2: Research（`/rpi:research`）

### 目的

Planning 前の **GO/NO-GO ゲート**。
機能のプロダクト適合性・技術的実現可能性・リスクを評価する。

### 6つのフェーズ

| フェーズ | エージェント | 目的 |
|---------|------------|------|
| Phase 0 | （直接） | コンテキスト読み込み（REQUEST.md + constitution） |
| Phase 1 | `requirement-parser` | 要件の構造化（機能名・型・要件・制約） |
| Phase 2 | `product-manager` | プロダクト分析（ユーザー価値・市場適合性・戦略整合） |
| Phase 2.5 | `Explore`（組み込み） | **コード探索**（既存実装・統合点・制約の実態把握） |
| Phase 3 | `senior-software-engineer` | 技術的実現可能性（アプローチ・複雑度・リスク） |
| Phase 4 | `technical-cto-advisor` | 戦略的評価（GO/NO-GO 判断・リスク対報酬） |
| Phase 5 | `documentation-analyst-writer` | リサーチレポート生成 |

### Phase 2.5 の重要性

> **CRITICAL PHASE** — Phase 3（技術的実現可能性）の前に**実際のコードベースを深く分析**する。
> 仮定ではなく「コードの現実」に基づいた判断を可能にする。

### 出力

- `rpi/{feature-slug}/research/RESEARCH.md`
- 判断: **GO** / **NO-GO** / **CONDITIONAL GO** / **DEFER**

### フロー制御

- Phase 1 で曖昧さがあれば **ユーザーに質問して停止**
- すべてのフェーズの結果を Phase 5 で統合
- 完了後は `/compact` を促す（コンテキスト管理）

---

## Step 3: Plan（`/rpi:plan`）

### 前提条件

- Research で **GO** 判定済み
- `rpi/{feature-slug}/research/RESEARCH.md` が存在

### 5つのフェーズ

| フェーズ | 内容 |
|---------|------|
| Phase 0 | コンテキスト読み込み（リサーチ結果 + constitution） |
| Phase 1 | 要件理解（スコープ・影響コンポーネント・既存パターン） |
| Phase 2 | 技術要件分析（依存関係・統合点・リスク） |
| Phase 3 | 機能アーキテクチャ設計（`senior-software-engineer`） |
| Phase 4 | 実装タスク分解（3-5フェーズに分割） |
| Phase 5 | ドキュメント生成 |

### 出力ファイル（4つ）

| ファイル | 内容 | 担当エージェント |
|---------|------|----------------|
| `pm.md` | プロダクト要件（ユーザーストーリー・受入基準・スコープ） | `product-manager` |
| `ux.md` | UX 設計（フロー・ワイヤーフレーム・アクセシビリティ） | `ux-designer` |
| `eng.md` | 技術仕様（アーキテクチャ・API・DB スキーマ） | `senior-software-engineer` |
| `PLAN.md` | 実装ロードマップ（フェーズ別タスク・依存関係・成功基準） | `documentation-analyst-writer` |

### タスク分解の原則

- **3-5つの論理的フェーズ** に分割
- 各フェーズが**動作可能でテスト可能な機能**を提供
- フェーズは**段階的に積み上がる**構造
- **並列化の機会**を特定（フロントエンド/バックエンドの並行作業など）

---

## Step 4: Implement（`/rpi:implement`）

### 前提条件

- `rpi/{feature-slug}/plan/PLAN.md` が存在

### オプションフラグ

| フラグ | 説明 |
|--------|------|
| `--phase N` | 特定フェーズのみ実行 |
| `--validate-only` | 検証のみ（実装なし） |
| `--skip-validation` | バリデーションゲートをスキップ（注意して使用） |

### 各フェーズの実行ループ（6ステップ）

```
┌─────────────────────────────────────────────┐
│ Phase N: [Phase Name]                        │
├─────────────────────────────────────────────┤
│                                              │
│  1. Code Discovery (Explore Agent)           │
│     └→ 変更前にコードの現状を理解            │
│                                              │
│  2. Implementation (senior-software-engineer)│
│     └→ フェーズの成果物を実装                │
│                                              │
│  3. Self-Validation                          │
│     └→ チェックリストに対する自己検証         │
│                                              │
│  4. Code Review (code-reviewer Agent)        │
│     └→ セキュリティ・正確性・保守性          │
│                                              │
│  5. User Validation Gate ← 必ず停止          │
│     ├→ PASS: 次のフェーズへ                  │
│     ├→ CONDITIONAL PASS: 課題を記録して続行  │
│     └→ FAIL: 修正後に再検証                  │
│                                              │
│  6. Documentation Update                     │
│     └→ PLAN.md と IMPLEMENT.md を更新        │
│                                              │
└─────────────────────────────────────────────┘
```

### Step 1: Code Discovery

Explore エージェントでコードの現状を把握:
- 現在の実装パターン
- 統合点（何が影響を受けるか）
- 依存関係と制約
- 従うべきコーディングスタイル
- リスクと注意点

### Step 2: Implementation

`senior-software-engineer` エージェントが実装:
- Discovery の結果を踏まえた実装
- Constitutional constraints の遵守
- テスト作成
- ログ追加
- エラーハンドリング

### Step 3: Self-Validation

```
- [ ] すべての成果物が実装済み
- [ ] リンティング通過
- [ ] テスト通過
- [ ] ビルド成功
- [ ] 既存テストに退行なし
- [ ] Constitutional constraints 遵守
```

### Step 4: Code Review

`code-reviewer` エージェントによるレビュー:

```markdown
# CODE REVIEW REPORT
- Verdict: [NEEDS REVISION | APPROVED WITH SUGGESTIONS]
- Blockers: N | High: N | Medium: N

## Blockers
- file:line — issue — specific fix suggestion

## High Priority
- file:line — principle violated — proposed refactor

## Medium Priority
- file:line — clarity/naming/docs suggestion

## Good Practices
- Brief acknowledgements
```

### Step 5: User Validation Gate

**必ずユーザーの承認を得る**。自動で次のフェーズに進まない。

表示内容:
- 完了した成果物一覧
- 変更ファイルと行数
- テスト結果
- コードレビュー結果
- PLAN.md の検証基準

### Step 6: Documentation Update

PLAN.md のフェーズステータスを更新:
```markdown
- [ ] Phase N: Not Started
- [~] Phase N: In Progress
- [x] Phase N: Validated (PASS)
- [!] Phase N: Conditional Pass (with notes)
- [-] Phase N: Failed Validation (needs rework)
```

IMPLEMENT.md に各フェーズの検証記録を追記。

---

## エージェント一覧

### Research で使用

| エージェント | モデル | 役割 |
|------------|--------|------|
| `requirement-parser` | sonnet | 要件の構造化解析 |
| `product-manager` | opus | プロダクト分析・ユーザー価値評価 |
| `Explore` | 組み込み | コードベースの深い探索 |
| `senior-software-engineer` | opus | 技術的実現可能性評価 |
| `technical-cto-advisor` | opus | 戦略的 GO/NO-GO 判断 |
| `documentation-analyst-writer` | opus | レポート生成 |

### Plan で使用

| エージェント | 役割 |
|------------|------|
| `senior-software-engineer` | アーキテクチャ設計 |
| `product-manager` | pm.md（プロダクト要件） |
| `ux-designer` | ux.md（UX 設計） |
| `documentation-analyst-writer` | ドキュメント統合 |

### Implement で使用

| エージェント | 役割 |
|------------|------|
| `Explore` | 実装前のコード調査 |
| `senior-software-engineer` | 実装 |
| `code-reviewer` | コードレビュー |
| `constitutional-validator` | 原則への準拠検証 |

---

## エラーハンドリング

| 状況 | 対応 |
|------|------|
| REQUEST.md が存在しない | 停止してユーザーに通知 |
| 機能記述が曖昧 | requirement-parser が質問を生成し停止 |
| Research が NO-GO | 警告を表示し続行するか確認 |
| 実装が失敗 | 最大2回のリトライ後、ユーザーに相談 |
| テストが失敗 | 原因分析 → 修正 → 再実行 → 解決しなければ報告 |
| エージェントがタイムアウト | 1回リトライ → 失敗したら報告して続行 |

---

## 使うべき場面 / 使わない場面

### 使うべき

- 新機能の開発
- 構造化された実装が必要な機能
- 複数フェーズに分割すべき大きな作業

### 使わない

- バグ修正（直接修正で十分）
- 30分未満の小さな変更
- 探索的なプロトタイピング
- ドキュメントのみの変更

---

## ワークフロー使用例

```bash
# Step 1: 機能記述
# (手動で rpi/oauth2-auth/ を作成し REQUEST.md を配置)

# Step 2: リサーチ
/rpi:research rpi/oauth2-auth/REQUEST.md

# Step 3: 計画
/rpi:plan oauth2-auth

# Step 4: 実装（全フェーズ）
/rpi:implement oauth2-auth

# Step 4: 実装（特定フェーズ）
/rpi:implement oauth2-auth --phase 3

# Step 4: 検証のみ
/rpi:implement oauth2-auth --phase 2 --validate-only
```

---

## 出典

- `workflow/rpi/rpi-workflow.md`
- `workflow/rpi/.claude/commands/rpi/` 配下のコマンドファイル
- `workflow/rpi/.claude/agents/` 配下のエージェントファイル
