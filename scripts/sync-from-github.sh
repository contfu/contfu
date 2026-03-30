#!/usr/bin/env bash
#
# Merge changes FROM the GitHub mirror into the Forgejo repo.
#
# Creates a PR branch with a merge commit from github/main.
# The first merge uses --allow-unrelated-histories to establish
# a shared ancestor; subsequent merges are normal git merges.
#
# Usage:
#   ./scripts/sync-from-github.sh              # create PR branch with merge
#   ./scripts/sync-from-github.sh --preview    # fetch and show incoming commits
#
# Prerequisites:
#   git remote add github git@github.com:contfu/contfu.git

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONF="$REPO_ROOT/github-mirror.conf"
REMOTE="github"
BRANCH="main"

# --- Helpers ----------------------------------------------------------------

die() { echo "error: $*" >&2; exit 1; }

ensure_remote() {
  if ! git -C "$REPO_ROOT" remote get-url "$REMOTE" &>/dev/null; then
    die "Remote '$REMOTE' not found. Run: git remote add $REMOTE git@github.com:contfu/contfu.git"
  fi
}

ensure_clean() {
  if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
    die "Working tree is dirty. Commit or stash changes first."
  fi
}

has_merge_base() {
  git -C "$REPO_ROOT" merge-base "origin/$BRANCH" "$REMOTE/$BRANCH" &>/dev/null
}

# Build a list of allowed path prefixes from github-mirror.conf
read_allowed_paths() {
  local paths=()
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [ -z "$line" ] && continue
    paths+=("$line")
  done < "$CONF"
  printf '%s\n' "${paths[@]}"
}

# After a merge, revert any changed files that are NOT in the conf.
# This keeps GitHub-only files (LICENSE, README, .github/) from leaking in.
revert_unsynced_files() {
  local allowed
  allowed=$(read_allowed_paths)
  local reverted=0

  # Compare merge result against the first parent (our branch before merge)
  for file in $(git -C "$REPO_ROOT" diff --name-only HEAD^1 HEAD); do
    local dominated=false
    while IFS= read -r prefix; do
      # File matches if it starts with an allowed path
      if [[ "$file" == "$prefix" || "$file" == "$prefix"/* ]]; then
        dominated=true
        break
      fi
    done <<< "$allowed"

    if ! $dominated; then
      echo "  reverting $file (not in github-mirror.conf)"
      git -C "$REPO_ROOT" checkout HEAD^1 -- "$file" 2>/dev/null \
        || git -C "$REPO_ROOT" rm --quiet "$file" 2>/dev/null \
        || true
      reverted=$((reverted + 1))
    fi
  done

  if [ "$reverted" -gt 0 ]; then
    echo "Reverted $reverted file(s) outside github-mirror.conf."
    git -C "$REPO_ROOT" commit --amend --no-edit --quiet
  fi
}

# --- Commands ---------------------------------------------------------------

cmd_preview() {
  ensure_remote

  echo "Fetching $REMOTE..."
  git -C "$REPO_ROOT" fetch "$REMOTE"

  if has_merge_base; then
    local base
    base=$(git -C "$REPO_ROOT" merge-base "origin/$BRANCH" "$REMOTE/$BRANCH")
    echo ""
    echo "Commits on $REMOTE/$BRANCH since last merge:"
    git -C "$REPO_ROOT" log --oneline "$base..$REMOTE/$BRANCH"
    echo ""
    echo "Diff stat:"
    git -C "$REPO_ROOT" diff --stat "$base..$REMOTE/$BRANCH"
  else
    echo ""
    echo "No shared history yet (first sync)."
    echo "Recent commits on $REMOTE/$BRANCH:"
    git -C "$REPO_ROOT" log --oneline "$REMOTE/$BRANCH" -10
  fi
}

cmd_merge() {
  ensure_remote
  ensure_clean

  echo "Fetching $REMOTE..."
  git -C "$REPO_ROOT" fetch "$REMOTE"
  git -C "$REPO_ROOT" fetch origin

  # Ensure we're on latest main
  git -C "$REPO_ROOT" checkout "$BRANCH"
  git -C "$REPO_ROOT" pull --ff-only origin "$BRANCH"

  # Create PR branch
  local pr_branch="sync/from-github-$(date +%Y%m%d)"
  echo "Creating branch $pr_branch..."
  git -C "$REPO_ROOT" checkout -b "$pr_branch"

  # Merge github/main
  local merge_args=("--no-ff" "-m" "merge: sync from GitHub mirror")
  if ! has_merge_base; then
    echo "No shared history — using --allow-unrelated-histories"
    merge_args+=("--allow-unrelated-histories")
  fi

  echo "Merging $REMOTE/$BRANCH..."
  if git -C "$REPO_ROOT" merge "${merge_args[@]}" "$REMOTE/$BRANCH"; then
    echo ""
    echo "Merge completed cleanly."
  else
    echo ""
    echo "Merge has conflicts. Resolve them, then:"
    echo "  git add -A && git commit"
    echo ""
    echo "Conflicting files:"
    git -C "$REPO_ROOT" diff --name-only --diff-filter=U
    exit 1
  fi

  # Revert files outside github-mirror.conf
  revert_unsynced_files

  echo ""
  echo "Branch ready: $pr_branch"
  echo "Review the merge, then push and create a PR."
}

# --- Main -------------------------------------------------------------------

case "${1:-}" in
  --preview)
    cmd_preview
    ;;
  ""|--merge)
    cmd_merge
    ;;
  *)
    echo "Usage: $0 [--merge|--preview]"
    exit 1
    ;;
esac
