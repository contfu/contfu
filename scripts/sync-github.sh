#!/usr/bin/env bash
#
# Sync public code from the Forgejo repo to the GitHub mirror worktree.
#
# Usage:
#   ./scripts/sync-github.sh          # sync to .worktrees/github-mirror
#   ./scripts/sync-github.sh --diff   # show diff after sync (no commit)
#   ./scripts/sync-github.sh --clean  # remove the worktree
#
# Prerequisites:
#   git remote add github git@github.com:contfu/contfu.git

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONF="$SCRIPT_DIR/github-mirror.conf"
WORKTREE="$REPO_ROOT/.worktrees/github-mirror"
REMOTE="github"
BRANCH="main"

# --- Helpers ----------------------------------------------------------------

die() { echo "error: $*" >&2; exit 1; }

ensure_remote() {
  if ! git -C "$REPO_ROOT" remote get-url "$REMOTE" &>/dev/null; then
    die "Remote '$REMOTE' not found. Run: git remote add $REMOTE git@github.com:contfu/contfu.git"
  fi
}

# --- Commands ---------------------------------------------------------------

cmd_clean() {
  if [ -d "$WORKTREE" ]; then
    echo "Removing worktree at $WORKTREE"
    git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
    echo "Done."
  else
    echo "No worktree to clean."
  fi
}

cmd_sync() {
  ensure_remote

  echo "Fetching $REMOTE..."
  git -C "$REPO_ROOT" fetch "$REMOTE"

  # Create worktree if it doesn't exist
  if [ ! -d "$WORKTREE" ]; then
    echo "Creating worktree at $WORKTREE from $REMOTE/$BRANCH..."
    git -C "$REPO_ROOT" worktree add "$WORKTREE" "$REMOTE/$BRANCH" --detach
  else
    # Update to latest remote
    echo "Updating worktree to $REMOTE/$BRANCH..."
    git -C "$WORKTREE" checkout --detach "$REMOTE/$BRANCH"
  fi

  # Read config and sync each path
  echo "Syncing paths from config..."
  local synced=0

  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    line="${line%%#*}"
    line="$(echo "$line" | xargs)" # trim whitespace
    [ -z "$line" ] && continue

    local src="$REPO_ROOT/$line"
    local dst="$WORKTREE/$line"

    if [ -d "$src" ]; then
      # Directory: rsync with --delete to clean up removed files
      mkdir -p "$dst"
      rsync -a --delete \
        --exclude 'node_modules' \
        --exclude '.svelte-kit' \
        --exclude 'dist' \
        --exclude 'build' \
        --exclude 'private/' \
        --exclude 'tsconfig.tsbuildinfo' \
        "$src/" "$dst/"
      synced=$((synced + 1))
    elif [ -f "$src" ]; then
      # Single file: copy
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
      synced=$((synced + 1))
    else
      echo "  warning: $line does not exist, skipping"
    fi
  done < "$CONF"

  echo "Synced $synced paths."

  # Show summary
  echo ""
  echo "--- Changes in worktree ---"
  git -C "$WORKTREE" add -A
  git -C "$WORKTREE" diff --cached --stat
  echo ""
  echo "Worktree ready at: $WORKTREE"
  echo "Review changes, then commit and push manually."
}

# --- Main -------------------------------------------------------------------

case "${1:-}" in
  --clean)
    cmd_clean
    ;;
  --diff)
    cmd_sync
    echo ""
    echo "--- Full diff ---"
    git -C "$WORKTREE" diff --cached
    ;;
  ""|--sync)
    cmd_sync
    ;;
  *)
    echo "Usage: $0 [--sync|--diff|--clean]"
    exit 1
    ;;
esac
