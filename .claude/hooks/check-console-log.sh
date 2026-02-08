#!/usr/bin/env bash
# Hook: Block Write/Edit if any src/*.ts file contains console.log
# Exit 0 = allow, Exit 2 = block

matches=$(grep -rn 'console\.log' src/**/*.ts 2>/dev/null || true)

if [ -n "$matches" ]; then
  echo "BLOCKED: console.log detected in source files:" >&2
  echo "$matches" >&2
  echo "" >&2
  echo "stdio MCP servers must use console.error instead of console.log." >&2
  exit 2
fi

exit 0
