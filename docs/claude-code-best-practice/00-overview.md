# Claude Code ベストプラクティス - 全体概要

> 出典: [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice)

## リポジトリの目的

Claude Code（Anthropic公式CLI）を最大限に活用するための設定パターン・ワークフロー・アーキテクチャの実践的リファレンス集。
「practice makes claude perfect」をコンセプトに、Skills・Subagents・Hooks・Commands の組み合わせ方を具体的な実装例で示している。

---

## Claude Code の主要コンセプト一覧

| コンセプト | 概要 | 公式ドキュメント |
|-----------|------|----------------|
| **Skills** | 再利用可能な知識・ワークフロー・スラッシュコマンド。オンデマンドで読み込まれ、`/skill-name` で呼び出せる | [Skills](https://code.claude.com/docs/en/skills) |
| **Subagents** | 独立した実行コンテキストで動作し、結果を要約して返す分離されたエージェント | [Subagents](https://code.claude.com/docs/en/sub-agents) |
| **Memory** | CLAUDE.md ファイルと `@path` インポートによる永続的コンテキスト。毎セッション自動読み込み | [Memory](https://code.claude.com/docs/en/memory) |
| **Rules** | `.claude/rules/*.md` に配置するモジュール化されたトピック別指示。フロントマターでパス制限可能 | [Rules](https://code.claude.com/docs/en/memory#modular-rules-with-clauderules) |
| **Hooks** | エージェントループの外側で特定イベントに応じて実行される確定的スクリプト | [Hooks](https://code.claude.com/docs/en/hooks) |
| **MCP Servers** | 外部ツール・データベース・API との Model Context Protocol 接続 | [MCP](https://code.claude.com/docs/en/mcp) |
| **Plugins** | Skills・Subagents・Hooks・MCP をバンドルした配布可能パッケージ | [Plugins](https://code.claude.com/docs/en/plugins) |
| **Marketplaces** | プラグインコレクションのホストと探索 | [Discover Plugins](https://code.claude.com/docs/en/discover-plugins) |
| **Settings** | Claude Code の振る舞いに対する階層的設定システム | [Settings](https://code.claude.com/docs/en/settings) |
| **Permissions** | ツールと操作に対するきめ細かいアクセス制御 | [Permissions](https://code.claude.com/docs/en/iam) |

> **重要な変更点**: Custom slash commands は Skills に統合された。`.claude/commands/` のファイルは引き続き動作するが、Skills（`.claude/skills/`）が推奨される。Skills はサポートファイル・呼び出し制御・サブエージェント実行など追加機能をサポートする。

---

## 各コンセプト間の関係

```
User
  │
  ├── /command-name ──→ Command (.claude/commands/)
  │                        │
  │                        ├── Task tool ──→ Subagent (.claude/agents/)
  │                        │                    │
  │                        │                    └── skills: で Skills を事前ロード
  │                        │
  │                        └── 直接実行（Claude本体が処理）
  │
  ├── /skill-name ────→ Skill (.claude/skills/)
  │
  ├── Hook Events ────→ Hooks (.claude/settings.json → scripts)
  │
  └── MCP Tools ──────→ MCP Servers (.mcp.json)
```

---

## 実践から得られたワークフローの知見

### ワークフロー全般

1. **CLAUDE.md は150行以下に抑える** — 長すぎると Claude の遵守率が低下する（それでも100%保証ではない）
2. **ワークフローには agents ではなく commands を使う** — commands がエントリーポイントとして安定する
3. **汎用エージェント（QA, Backend Engineer等）より、機能特化型サブエージェント + Skills の組み合わせ** — Progressive Disclosure（必要な情報を必要な時だけ開示する設計）が鍵
4. **`/memory`、`/rules`、`constitution.md` は何も保証しない** — あくまで「参考情報」として扱う
5. **手動 `/compact` はコンテキスト使用量50%で実行** — 自動コンパクトを待たず手動で行う方が品質が高い
6. **常にプランモードから開始する** — いきなり実装に入らない
7. **サブタスクはコンテキストの50%以下で完了できるサイズに分割** — コンテキスト枯渇を防ぐ
8. **小さなタスクにはバニラ Claude Code（ワークフローなし）が最適** — 過剰なオーケストレーションは逆効果
9. **タスク完了後は即コミット** — 中間成果物を失わない

### ユーティリティ

| ツール | 用途 |
|--------|------|
| **iTerm ターミナル** | IDE内蔵ターミナルはクラッシュ問題あり。iTerm推奨 |
| **Wispr Flow** | 音声プロンプティングで10倍の生産性 |
| **claude-code-voice-hooks** | Claude からのフィードバックを音声で受け取る |
| **Status Line** | コンテキスト使用量の認識と高速コンパクト判断 |
| **Git Worktrees** | 並列開発のためのブランチ分離 |
| **`/config` don't ask permission mode** | `dangerously--skip-permissions` の代わりに安全な設定方法 |

### デバッグ

1. **`/doctor`** — 設定の診断
2. **バックグラウンドタスクとしてターミナルを実行** — ログの可視性向上
3. **ブラウザ自動化 MCP（Claude in Chrome, Playwright, Chrome DevTools）** — Claude が自分でコンソールログを確認できる
4. **スクリーンショット提供** — 視覚的な問題報告には画像を添付

---

## ドキュメント構成

本ドキュメントは以下のファイルで構成される：

| ファイル | 内容 |
|---------|------|
| [01-claude-md-memory.md](01-claude-md-memory.md) | CLAUDE.md とメモリ管理 |
| [02-skills.md](02-skills.md) | Skills システム |
| [03-subagents.md](03-subagents.md) | Subagents システム |
| [04-hooks.md](04-hooks.md) | Hooks システム |
| [05-commands.md](05-commands.md) | Commands |
| [06-settings.md](06-settings.md) | Settings リファレンス |
| [07-mcp-servers.md](07-mcp-servers.md) | MCP サーバー |
| [08-permissions.md](08-permissions.md) | パーミッション |
| [09-command-skill-agent-architecture.md](09-command-skill-agent-architecture.md) | Command → Agent → Skills アーキテクチャ |
| [10-workflow-rpi.md](10-workflow-rpi.md) | RPI ワークフロー |
| [11-monorepo-patterns.md](11-monorepo-patterns.md) | モノレポでのパターン |
| [12-browser-automation-mcp.md](12-browser-automation-mcp.md) | ブラウザ自動化 MCP 比較 |
| [13-sdk-vs-cli.md](13-sdk-vs-cli.md) | Agent SDK vs CLI |
| [14-practical-tips.md](14-practical-tips.md) | 実践的 Tips とキーワード集 |
