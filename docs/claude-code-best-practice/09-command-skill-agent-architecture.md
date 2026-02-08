# Command → Agent → Skills アーキテクチャ

## 概要

リポジトリが提唱する中核的なアーキテクチャパターン。
**Command**（エントリーポイント）→ **Agent**（ワークフロー実行）→ **Skills**（ドメイン知識注入）の3層構造で、関心の分離と再利用性を実現する。

---

## 各コンポーネントの役割

| コンポーネント | 役割 | 例 |
|--------------|------|-----|
| **Command** | エントリーポイント、ユーザーインタラクション | `/weather-orchestrator` |
| **Agent** | ワークフローをオーケストレーション。事前ロードされた Skills で動作 | `weather` agent |
| **Skills** | エージェント起動時に注入されるドメイン知識 | `weather-fetcher`, `weather-transformer` |

---

## フロー図

```
User
  │
  ▼
┌──────────────────────┐
│  /weather-orchestrator │  ← Command (Entry point)
│  Command               │
│  (ユーザーとの対話)     │
└──────────────────────┘
  │
  │ Task tool invocation
  ▼
┌──────────────────────┐
│  weather               │  ← Agent (Orchestrator)
│  Agent                 │
│                        │
│  skills:               │  ← Skills が事前ロード
│  - weather-fetcher     │
│  - weather-transformer │
└──────────────────────┘
  │
  ├──────────────────────┐
  ▼                      ▼
┌─────────────┐  ┌──────────────────┐
│ weather-    │  │ weather-         │
│ fetcher     │  │ transformer      │
│ Skill       │  │ Skill            │
│ (知識)      │  │ (知識)           │
└─────────────┘  └──────────────────┘
  │                      │
  ▼                      ▼
  wttr.in API         input.md → 変換 → output.md
  (温度取得)          (ルール適用)
```

---

## 実装の具体例: Weather System

### 1. Command（エントリーポイント）

**ファイル**: `.claude/commands/weather-orchestrator.md`

```yaml
---
description: Fetch and transform weather data for Karachi
model: haiku
---
```

**役割**:
- ユーザーに温度単位（摂氏/華氏）を質問
- weather Agent を Task ツールで呼び出し
- 結果をユーザーに表示

**核心**: Command は**ユーザーインタラクションと委譲**に専念し、実処理はしない。

### 2. Agent（オーケストレーター）

**ファイル**: `.claude/agents/weather.md`

```yaml
---
name: weather
description: Use this agent PROACTIVELY when you need to fetch and
             transform weather data for Karachi, Pakistan.
tools: WebFetch, Read, Write
model: haiku
color: green
skills:
  - weather-fetcher
  - weather-transformer
---
```

**役割**:
- `skills` フィールドで `weather-fetcher` と `weather-transformer` を事前ロード
- スキルの指示に従って順次実行
- Step 1: 温度取得 → Step 2: 変換・出力

**核心**: Agent は**スキルの知識を使ったワークフロー実行**に専念。

### 3. Skills（ドメイン知識）

**ファイル**: `.claude/skills/weather-fetcher/SKILL.md` & `weather-transformer/SKILL.md`

**weather-fetcher**: wttr.in API から温度を取得する手順
**weather-transformer**: 入力ファイルの変換ルールを適用して結果を書き出す手順

**核心**: Skills は**手順書・知識ベース**として機能。実行主体ではなく、エージェントへの情報提供。

### 4. Data Files（データ）

| ファイル | 目的 |
|---------|------|
| `weather-orchestration/input.md` | 変換ルール（例: "add +20 in the result"） |
| `weather-orchestration/output.md` | 変換結果の出力先 |

---

## 実行フローの時系列

```
1. User: /weather-orchestrator
2. Command: 「摂氏/華氏どちらですか?」（AskUserQuestion）
3. User: 「摂氏」
4. Command: Task(subagent_type="weather", prompt="...")
5. Agent 起動: weather-fetcher, weather-transformer のスキルが注入
6. Agent Step 1 (weather-fetcher): WebFetch → wttr.in → 26°C 取得
7. Agent Step 2 (weather-transformer):
   - Read: input.md → "add +20"
   - 計算: 26 + 20 = 46
   - Write: output.md に結果出力
8. Agent → Command に結果を返す
9. Command: ユーザーに結果サマリを表示
```

---

## このパターンが有効な理由

### 1. Progressive Disclosure（段階的開示）

スキルの全文は Agent が起動した時点でのみロードされる。Command のコンテキストにはスキルの詳細は含まれない。
→ 不要な情報でコンテキストを汚染しない。

### 2. Single Execution Context（単一実行コンテキスト）

Agent は1つの実行コンテキスト内で複数のスキルを使う。スキルは別々のエージェントとしては実行されない。
→ データの受け渡しが自然（変数として保持）。

### 3. Clean Separation（明確な関心の分離）

- **Command**: What to do（何をするか）
- **Agent**: How to orchestrate（どう連携するか）
- **Skills**: What to know（何を知るべきか）

### 4. Reusability（再利用性）

- `weather-fetcher` スキルは別の Agent でも再利用可能
- Command を変えれば別のインタラクションパターンでも同じ Agent を使える
- スキルの組み合わせで新しいワークフローを構築可能

---

## 使うべき場面

- **マルチステップワークフロー** — 複数の処理を順次実行
- **ドメイン固有の知識注入** — 特定の API 仕様やルールが必要
- **順次タスク** — 前のステップの結果が次のステップの入力になる
- **再利用可能なコンポーネント** — 同じスキルを複数のワークフローで使いたい

---

## Agent-Skills パターンの設計原則

```yaml
# Agent 定義での Skills 事前ロード
---
name: weather
skills:
  - weather-fetcher       # 起動時にフルコンテンツが注入
  - weather-transformer   # 起動時にフルコンテンツが注入
---
```

1. **Skills は事前ロードされる**: フルコンテンツが Agent のコンテキストに注入
2. **Agent はスキルの知識を使う**: 動的な呼び出しではなく、参考資料として利用
3. **動的な呼び出しはない**: スキルは別々に呼び出されるのではなく、事前に注入された情報
4. **単一の実行コンテキスト**: すべての処理が1つの Agent のコンテキスト内で完結

---

## 出典

- リポジトリの Weather System 実装
- `weather-orchestration/weather-orchestration-architecture.md`
