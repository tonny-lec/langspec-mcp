# Agent SDK vs CLI システムプロンプト比較

## 概要

同じメッセージ（例: "What is the capital of Norway?"）を **Claude Agent SDK** と **Claude CLI (Claude Code)** に送った場合、付随するシステムプロンプトは根本的に異なる。
CLI はモジュラーなシステムプロンプトアーキテクチャを使い、SDK はデフォルトで最小限のプロンプトを使用する。

**結論: 同一出力の保証はない。**

---

## システムプロンプトの構成比較

### Claude CLI（Claude Code）

**モジュラーアーキテクチャ**: ~269トークンのベースプロンプト + 条件付きでロードされる追加コンテキスト。

| コンポーネント | 説明 | ロード |
|--------------|------|--------|
| Base System Prompt | コアの指示と振る舞い | 常時（~269トークン） |
| Tool Instructions | 18以上の組み込みツール | 常時 |
| Coding Guidelines | コードスタイル、書式、セキュリティ | 常時 |
| Safety Rules | 拒否ルール、注入防御、危害防止 | 常時 |
| Response Style | トーン、冗長性、説明の深さ | 常時 |
| Environment Context | 作業ディレクトリ、git状態、プラットフォーム | 常時 |
| Project Context | CLAUDE.md、設定、Hooks | 条件付き |
| Subagent Prompts | Plan/Explore/Task エージェント | 条件付き |
| Security Review | セキュリティ指示（~2,610トークン） | 条件付き |

**特徴**:
- 110以上のシステムプロンプト文字列が条件付きでロード
- CLAUDE.md ファイルを作業ディレクトリから自動ロード
- インタラクティブモードでセッション永続的なコンテキスト

### Claude Agent SDK（デフォルト）

**最小限のシステムプロンプト。**

| コンポーネント | 説明 | トークン影響 |
|--------------|------|------------|
| Essential Tool Instructions | 明示的に提供されたツールのみ | 最小 |
| Basic Safety | 最小限の安全指示 | 最小 |

**特徴**:
- コーディングガイドラインやスタイル設定なし
- プロジェクトコンテキストなし（明示的設定が必要）
- 広範なツール記述なし

---

## 送信されるものの比較

### CLI 経由

```
System Prompt: [modular, ~269+ base tokens]
├── Base system prompt (~269 tokens)
├── Tool instructions (Write, Read, Edit, Bash, Grep, Glob, etc.)
├── Git safety protocols
├── Code reference guidelines
├── Professional objectivity instructions
├── Security and injection defense rules
├── Environment context (OS, directory, date)
├── CLAUDE.md content (if present) [conditional]
├── MCP tool descriptions (if configured) [conditional]
├── Plan/Explore mode prompts [conditional]
└── Session/conversation context

User Message: "What is the capital of Norway?"
```

### Agent SDK（デフォルト）経由

```
System Prompt: [minimal]
├── Essential tool instructions (if any tools provided)
└── Basic operational context

User Message: "What is the capital of Norway?"
```

### Agent SDK（`claude_code` preset）経由

```typescript
const response = await query({
  prompt: "What is the capital of Norway?",
  options: {
    systemPrompt: {
      type: "preset",
      preset: "claude_code"
    }
  }
});
```

→ CLI とほぼ同じシステムプロンプトだが、**CLAUDE.md は `settingSources` を設定しない限りロードされない**。

---

## カスタマイズ方法

### CLI

| 方法 | コマンド | 効果 |
|------|---------|------|
| プロンプト追加 | `claude -p "..." --append-system-prompt "..."` | デフォルトを保持して指示を追加 |
| プロンプト置換 | `claude -p "..." --system-prompt "..."` | システムプロンプトを完全置換 |
| プロジェクトコンテキスト | CLAUDE.md ファイル | 自動ロード、永続的 |
| 出力スタイル | `/output-style [name]` | 定義済みスタイルを適用 |

### Agent SDK

| 方法 | 設定 | 効果 |
|------|------|------|
| カスタムプロンプト | `systemPrompt: "..."` | デフォルトを完全置換（ツール情報が失われる） |
| Preset + 追加 | `systemPrompt: { type: "preset", preset: "claude_code", append: "..." }` | CLI 機能を保持 + カスタム指示 |
| CLAUDE.md ロード | `settingSources: ["project"]` | プロジェクトレベルの指示をロード |
| 出力スタイル | `settingSources: ["user"]` or `["project"]` | 保存済みスタイルをロード |

---

## 機能比較

| 機能 | CLI デフォルト | SDK デフォルト | SDK + Preset |
|------|-------------|-------------|-------------|
| ツール指示 | 完全 | 最小 | 完全 |
| コーディングガイドライン | Yes | No | Yes |
| 安全ルール | Yes | 基本的 | Yes |
| CLAUDE.md 自動ロード | Yes | No | No* |
| プロジェクトコンテキスト | 自動 | No | No* |

*`settingSources: ["project"]` で明示的設定が必要

---

## 決定論性の保証

### 結論: 保証なし

Claude Messages API は**再現性のための seed パラメータを提供しない**。これは根本的なアーキテクチャ上の制限。

### 同一出力を妨げる要因

| 要因 | 説明 | 制御可能? |
|------|------|---------|
| 異なるシステムプロンプト | CLI vs SDK のデフォルトが異なる | Yes（設定で） |
| 浮動小数点演算 | 並列ハードウェアの特性 | No |
| MoE ルーティング | Mixture-of-Experts アーキテクチャの変動 | No |
| バッチ処理/スケジューリング | クラウドインフラの違い | No |
| 数値精度 | 推論エンジンの変動 | No |
| モデルスナップショット | バージョン更新/変更 | No |

`temperature=0.0`（greedy decoding）でも**完全な決定論性は保証されない**。

---

## 最大限の一貫性を得る方法

### Agent SDK 側

```typescript
const response = await query({
  prompt: "What is the capital of Norway?",
  options: {
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: "Your additional instructions"
    },
    temperature: 0,
    model: "claude-sonnet-4-20250514",
    settingSources: ["project", "user"]
  }
});
```

### CLI 側

```bash
claude -p "What is the capital of Norway?" \
  --model claude-sonnet-4-20250514 \
  --temperature 0
```

**それでも保証はない。**

---

## 実践的な推奨事項

### インターフェースの使い分け

| ユースケース | 推奨 | 理由 |
|------------|------|------|
| インタラクティブ開発 | CLI | 完全なツール群、プロジェクトコンテキスト |
| プログラマティック統合 | SDK | きめ細かい制御、組み込み |
| 一貫した API レスポンス | SDK + カスタムプロンプト | システムプロンプトの制御 |
| バッチ処理 | SDK | 自動化パイプラインに適合 |
| 単発タスク | CLI | 素早いセットアップ、即座のコンテキスト |

### 設計上の推奨

1. **ビット完全な再現性に依存しない** — 出力の軽微な変動に耐えるアプリケーション設計
2. **構造化出力とバリデーション** — JSON スキーマ検証で一貫性を確保
3. **結果のキャッシュ** — 可能な場合は結果をキャッシュ
4. **複数生成 + コンセンサス** — 一貫性が重要な場合

---

## トークン影響

| 設定 | アーキテクチャ | 備考 |
|------|-------------|------|
| SDK（最小） | 最小デフォルト | タスクに使えるコンテキストが最大 |
| SDK（preset） | モジュラー（~269+ base） | CLI と同等 |
| CLI（デフォルト） | モジュラー（~269+ base） | 追加コンテキストが条件付き |
| CLI（MCP あり） | モジュラー + MCP | MCP ツール記述で大幅にトークン増加 |

---

## 出典

- [Modifying System Prompts - Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk#modifying-system-prompts)
- [Claude Code CLI Reference](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/cli)
- [GitHub Issue #3370: Non-deterministic output](https://github.com/anthropics/claude-code/issues/3370)
