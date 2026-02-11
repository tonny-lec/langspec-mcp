# Git Workflow

## Git Flow ブランチモデル

- **`main`** — 本番リリース用。直接コミット禁止
- **`develop`** — 統合ブランチ。feature ブランチのマージ先
- **`feature/<issue番号>-<slug>`** — 機能開発。develop から分岐、develop へマージ
- **`release/<version>`** — リリース準備。develop → main へマージ
- **`hotfix/<slug>`** — 緊急修正。main から分岐、main + develop へマージ

## 開発フロー

1. **Plan mode** で計画立案 → タスクごとに GitHub Issue を作成 (`github-issues` スキル or `refine-issue` エージェント)
2. **Issue ごとに feature ブランチ作成** — `git-flow-manager` エージェントを使用
3. **実装 → テスト → コミット** — develop へ PR 作成
4. **PR マージ** — squash or merge commit

## スキル/エージェント使い分け

| ツール | 用途 |
|--------|------|
| **`git-advanced-workflows` スキル** | rebase, cherry-pick, bisect, worktree, reflog 等の高度なGit操作時に参照 |
| **`git-flow-manager` エージェント** | feature/release/hotfix ブランチの作成・マージ・PR生成 (Task tool, subagent_type=git-flow-manager) |
| **`github-issues` スキル** | Issue 作成・更新・ラベル管理 |
| **`refine-issue` エージェント** | 要件を AC/技術考慮/エッジケース/NFR に整理 |

## トリガー

- PreToolUse フック (`git-skill-reminder.sh`) が git コマンドを検出し、適切なスキル/エージェントの使用をリマインド
- ブランチ作成・マージ → git-flow-manager
- rebase/cherry-pick/bisect/stash/reflog → git-advanced-workflows
