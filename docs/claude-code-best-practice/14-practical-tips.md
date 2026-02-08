# 実践的 Tips とキーワード集

## ワークフローの実践 Tips

### コンテキスト管理

| Tips | 解説 |
|------|------|
| **手動 `/compact` はコンテキスト50%で実行** | 自動コンパクトを待つよりも手動で50%時点で実行した方が品質が高い。コンテキストが枯渇すると Claude の精度が著しく低下する |
| **サブタスクはコンテキスト50%以下で完了** | 1つのタスクがコンテキストの50%以上を消費すると、残りの作業に使える情報が不足する |
| **Status Line でコンテキスト使用量を常に把握** | 設定で Status Line を有効にし、コンテキスト使用量をリアルタイムで確認する |

### ワークフロー設計

| Tips | 解説 |
|------|------|
| **常にプランモードから開始** | いきなり実装に入らず、まず計画を立てる。修正コストが大幅に削減される |
| **小さなタスクにはバニラ Claude Code** | 過剰なワークフロー設計は逆効果。小さなタスクには素のClaude Codeが最適 |
| **コミットは即座に** | タスク完了後すぐにコミット。中間成果物を失わない |
| **CLAUDE.md は150行以下** | 長すぎると Claude の遵守率が低下する |
| **Commands をワークフローのエントリーポイントに** | Agents を直接呼び出すより Commands 経由の方が安定 |
| **汎用エージェントより機能特化型** | "Backend Engineer" より "api-design-reviewer" のように具体的に定義 |

### デバッグ

| Tips | 解説 |
|------|------|
| **`/doctor` で診断** | 設定や環境の問題を自動診断 |
| **バックグラウンドタスクでターミナル実行** | `btw`（background task）でログの可視性を向上。Claude にログを見せつつ作業を続行 |
| **ブラウザ自動化 MCP でコンソール確認** | Claude がブラウザのコンソールログを自分で確認できる |
| **スクリーンショット提供** | 視覚的な問題は言葉より画像で伝える |

---

## ユーティリティ推奨

| ツール | 推奨理由 |
|--------|---------|
| **iTerm** | IDE 内蔵ターミナルはクラッシュ問題がある。iTerm がより安定 |
| **Wispr Flow** | 音声プロンプティングで10倍の生産性。タイピングより速い |
| **claude-code-voice-hooks** | Claude からのフィードバックを音声で受け取る |
| **Git Worktrees** | 並列開発のためのブランチ分離。複数の作業を同時に進行 |

---

## 設定の実践 Tips

### パーミッション設定

```
/config → "don't ask" permission mode
```

`dangerously--skip-permissions` フラグの代わりに `/config` で設定する方が安全。

### defaultMode の推奨

```json
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  }
}
```

> 著者は `bypassPermissions` を settings.json で直接設定することを推奨。
> ただし、これはセキュリティリスクを伴うため、信頼できるプロジェクトでのみ使用すべき。

---

## `/memory` と `/rules` と `constitution.md` の限界

著者の重要な知見:

> `/memory`, `/rules`, `constitution.md` does not guarantee anything

これらのファイルは Claude に対する「参考情報」であり、**100%の遵守を保証するものではない**。
Claude は確率的なモデルであり、特に長いセッションやコンテキストが複雑な場合、指示を逸脱する可能性がある。

**対策**:
- CLAUDE.md は簡潔に保つ（150行以下）
- 重要なルールは繰り返し強調する
- Hooks（exit code 2）で確定的なガードレールを実装
- 定期的な `/compact` でコンテキストの鮮度を保つ

---

## キーワード集

### Claude 公式キーワード

| キーワード | 説明 |
|-----------|------|
| `btw` | Background Task（バックグラウンドタスク）。Claude にバックグラウンドで処理を実行させる |
| `"defaultMode": "bypassPermissions"` | settings.json でパーミッションチェックをスキップする設定 |
| ~~`ultrathink`~~ | 非推奨（deprecated）。以前は Extended Thinking を強制するキーワードだった |

### コミュニティキーワード

| キーワード | 説明 |
|-----------|------|
| **Agentic Workflow** | エージェントが自律的にツールを使いタスクを完了するワークフロー |
| **AI Slop** | AI が生成する低品質・無意味なコンテンツ。過剰な説明、不要なコメント、冗長なコード |
| **Closing the Loop** | タスク完了後の検証まで含めた一連のプロセスを閉じること |
| **Context Bloat** | コンテキストウィンドウが不要な情報で膨らんだ状態 |
| **Context Engineering** | Claude に最適なコンテキスト（CLAUDE.md、Skills、Rules）を設計する技術 |
| **Context Rot** | 長いセッションで初期の指示が薄れ、Claude の精度が低下する現象 |
| **Dumb Zone** | コンテキストが枯渇し、Claude が「バカになる」領域 |
| **Hallucination** | Claude が存在しない情報を生成する現象 |
| **Harness** | Claude Code のエージェントループを制御するフレームワーク |
| **One Shot** | 1回のプロンプトでタスクを完了させること |
| **Orchestration** | 複数のエージェント/ツールを連携させてワークフローを実行 |
| **Progressive Disclosure** | 必要な情報を必要な時にだけ開示する設計パターン。Skills の核心概念 |
| **Rate Limit Jail** | API のレート制限に引っかかった状態 |
| **Scaffolding** | Claude に提供する構造化されたテンプレートやフレームワーク |
| **Slot Machine Method** | Save → Run → Revert → Retry のサイクル。うまくいくまで繰り返す |
| **Stop** | Claude に作業を停止させるコマンド/仕組み |
| **The Holy Trinity** | Skills + Agents + Hooks の3つ組。Claude Code のカスタマイズの核心 |
| **Token Burn** | トークンの無駄遣い。不要な処理でトークンを消費すること |
| **Vibe Coding** | 厳密な指示なしに Claude と「雰囲気」でコーディングする手法 |

---

## 外部ワークフローリファレンス

リポジトリが紹介する外部ワークフロー:

| ワークフロー | 説明 |
|------------|------|
| **RPI** | Research → Plan → Implement。本リポジトリの主要ワークフロー |
| **Boris Feb26 workflow** | Claude Code 作者 Boris Cherny の2026年2月時点のワークフロー |
| **Ralph plugin with sandbox** | サンドボックス付きプラグインワークフロー |
| **HumanLayer RPI** | HumanLayer による RPI の拡張版（ACE-FCA） |
| **AgentOs** | Brian Casel のエージェント OS。2026年時点では「overkill」との評価 |
| **Github Speckit** | GitHub 公式のスペック管理ツール |
| **GSD** | Get Shit Done。シンプルなタスク完了ワークフロー |
| **OpenSpec OPSX** | Fission AI のオープンスペック定義 |
| **Superpowers** | obra のスーパーパワーフレームワーク |
| **Andrej Karpathy Workflow** | AI 研究者 Andrej Karpathy のワークフロー |

---

## Context Engineering のリソース

| リソース | 説明 |
|---------|------|
| [HumanLayer - Writing a good Claude.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) | CLAUDE.md の書き方ガイド |
| [Claude.md for larger monorepos](reports/claude-md-for-larger-mono-repos.md) | モノレポでの CLAUDE.md 設計 |

---

## Claude Code 機能のインスピレーション

| 機能 | インスピレーション元 |
|------|-------------------|
| **Claude Code Tasks** | [Beads (Steve Yegge)](https://github.com/steveyegge/beads) からインスピレーションを受けた |
| **Ralph Plugin** | Geoffrey Huntley による Claude Code プラグインの先駆け |

---

## 出典

- リポジトリの README.md（MY EXPERIENCE セクション）
- リポジトリの CLAUDE.md
