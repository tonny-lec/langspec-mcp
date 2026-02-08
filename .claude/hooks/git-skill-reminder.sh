#!/usr/bin/env bash
# Hook: PreToolUse on Bash
# Detects git operations and reminds to use the appropriate skill/agent.
# Exit 0 = allow (reminder only), Exit 2 = block

# Read tool input from stdin
input=$(cat)
cmd=$(echo "$input" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{try{console.log(JSON.parse(d).command||'')}catch{console.log('')}});
" 2>/dev/null)

# Skip if not a git command
echo "$cmd" | grep -q '^git ' || exit 0

# --- Git Flow operations → git-flow-manager agent ---
if echo "$cmd" | grep -qE 'git (checkout -b |switch -c )(feature|release|hotfix)/'; then
  echo "REMINDER: Git Flow branch creation detected." >&2
  echo "Consider using the 'git-flow-manager' agent (Task tool, subagent_type=git-flow-manager) for proper Git Flow workflow." >&2
  exit 0
fi

if echo "$cmd" | grep -qE 'git merge.*(feature|release|hotfix)/'; then
  echo "REMINDER: Git Flow merge detected." >&2
  echo "Consider using the 'git-flow-manager' agent for merge validation, tagging, and branch cleanup." >&2
  exit 0
fi

# --- Advanced git operations → git-advanced-workflows skill ---
if echo "$cmd" | grep -qE 'git (rebase|cherry-pick|bisect|worktree|reflog|stash|reset --hard|push --force)'; then
  echo "REMINDER: Advanced git operation detected." >&2
  echo "Consider using the 'git-advanced-workflows' skill for guidance on safe execution." >&2
  exit 0
fi

exit 0
