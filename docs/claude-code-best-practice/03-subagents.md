# Subagents システム

## Subagents とは

Subagents（サブエージェント）は、Claude Code 内で**独立した実行コンテキスト**を持つエージェントである。
メインの会話とは分離されたループで動作し、完了後に要約された結果を返す。

---

## Subagent の定義構造

### ファイル配置

```
.claude/agents/<agent-name>.md
```

### YAML フロントマター

```yaml
---
name: weather
description: Use this agent PROACTIVELY when you need to fetch
             and transform weather data for Karachi, Pakistan.
tools: WebFetch, Read, Write
model: haiku
color: green
skills:
  - weather-fetcher
  - weather-transformer
---
```

### フロントマターの各プロパティ

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `name` | string | サブエージェントの識別子 |
| `description` | string | いつこのエージェントを使うかの説明。`"PROACTIVELY"` を含めると自動呼び出しされる |
| `tools` | string | カンマ区切りの許可ツール一覧 |
| `model` | string | 使用モデル（通常は `haiku` で効率化） |
| `color` | string | CLI 出力の色（視覚的区別用） |
| `skills` | list | 起動時に事前ロードするスキル名のリスト |

---

## description における `PROACTIVELY` キーワード

```yaml
description: Use this agent PROACTIVELY when you need to...
```

`PROACTIVELY` を description に含めると、Claude がそのエージェントの使用が適切と判断した場合に**ユーザーの明示的な指示なしに自動で呼び出す**。

---

## Skills の事前ロード

```yaml
skills:
  - weather-fetcher
  - weather-transformer
```

`skills` フィールドに指定されたスキルは、**エージェント起動時にフルコンテンツがコンテキストに注入** される。
これは通常のスキルロード（description のみ → 呼び出し時にフルロード）とは異なる。

**利点**:
- エージェントが起動した時点でドメイン知識を持っている
- 追加のスキル呼び出しステップが不要
- 単一の実行コンテキストで一貫した処理が可能

---

## Subagent の呼び出し方法

### Task ツールを使用（推奨）

```
Task(subagent_type="weather", description="Fetch and transform Karachi weather", prompt="...", model="haiku")
```

### 重要: Bash コマンドでの呼び出しは不可

**サブエージェントは他のサブエージェントを Bash コマンドで呼び出すことができない。** 必ず Task ツールを使う。

```
// NG: Bash で呼び出そうとする
Bash("claude invoke weather-agent")

// OK: Task ツールを使う
Task(subagent_type="weather", ...)
```

エージェント定義でも「launch」「run」のような Bash コマンドと誤解されうる曖昧な表現を避ける。

---

## 具体例: Weather Agent

```yaml
---
name: weather
description: Use this agent PROACTIVELY when you need to fetch and transform
             weather data for Karachi, Pakistan.
tools: WebFetch, Read, Write
model: haiku
color: green
skills:
  - weather-fetcher
  - weather-transformer
---
```

```markdown
# Weather Agent

You are a specialized weather agent that fetches and transforms weather data.

## Your Task
Execute the weather workflow by following the instructions from your
preloaded skills sequentially:

1. **First**: Follow the `weather-fetcher` skill to fetch temperature
2. **Then**: Follow the `weather-transformer` skill to apply transformations

## Critical Requirements
1. **Sequential Execution**: Complete fetcher before starting transformer
2. **Use Your Skills**: The skill content is preloaded
3. **Data Flow**: Pass the temperature from step 1 to step 2
```

**設計のポイント**:
- `tools` フィールドで使えるツールを明示的に制限
- `model: haiku` で効率化（軽量タスクに高性能モデルは不要）
- `skills` で必要な知識を事前ロード
- 本文で明確なステップと制約を記述

---

## RPI ワークフローのエージェント群

RPI ワークフローでは、役割別に特化したエージェントを定義している:

| エージェント | モデル | 役割 |
|------------|--------|------|
| `requirement-parser` | sonnet | 要件解析・構造化 |
| `product-manager` | opus | PRD 作成・プロダクト分析 |
| `senior-software-engineer` | opus | 技術設計・実装 |
| `technical-cto-advisor` | opus | 戦略的技術判断 |
| `ux-designer` | opus | UX ブリーフ作成 |
| `code-reviewer` | opus | コードレビュー |
| `documentation-analyst-writer` | opus | ドキュメント作成 |
| `constitutional-validator` | opus | 原則への準拠検証 |

### エージェント設計パターン

**簡潔型**（product-manager, senior-software-engineer, ux-designer, code-reviewer）:
```yaml
---
name: product-manager
description: Turns a high-level ask into a crisp, exec-ready PRD
model: opus
---
# PRD rules
- Open with Context & Why Now; Users & JTBD; Success metrics.
- Number functional requirements; each with acceptance criteria.
```
→ 数行で原則と成果物だけを定義。簡潔なほど Claude の遵守率が高い。

**詳細型**（requirement-parser, technical-cto-advisor, constitutional-validator）:
→ 複雑な判断基準やフレームワークが必要な場合は詳細に記述。ただしコンテキスト消費に注意。

---

## Subagent のベストプラクティス

1. **汎用エージェントより機能特化型** — 「Backend Engineer」より「api-design-reviewer」のように具体的に
2. **Skills による Progressive Disclosure** — エージェントに必要な知識だけを事前ロード
3. **ツールの明示的制限** — `tools` フィールドで不要なツールを排除
4. **モデルの適切な選択** — 軽量タスクには `haiku`、重要な判断には `opus`
5. **`PROACTIVELY` は慎重に** — 自動呼び出しが頻発すると予期せぬコンテキスト消費が発生
6. **Task ツールで呼び出し** — Bash 経由での呼び出しは不可

---

## 出典

- [Claude Code Documentation - Sub-agents](https://code.claude.com/docs/en/sub-agents)
