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
CONF="$REPO_ROOT/github-mirror.conf"
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

  # Bring both remotes up to date
  echo "Fetching origin and $REMOTE..."
  git -C "$REPO_ROOT" fetch origin
  git -C "$REPO_ROOT" fetch "$REMOTE"

  # Abort if GitHub has commits not yet in Forgejo — sync-from-github must run first
  local incoming
  incoming=$(git -C "$REPO_ROOT" rev-list "origin/$BRANCH..$REMOTE/$BRANCH" --count)
  if [ "$incoming" -gt 0 ]; then
    echo ""
    echo "error: $REMOTE/$BRANCH has $incoming commit(s) not in origin/$BRANCH."
    echo "Run ./scripts/sync-from-github.sh first, then re-run this script."
    echo ""
    git -C "$REPO_ROOT" log --oneline "origin/$BRANCH..$REMOTE/$BRANCH"
    exit 1
  fi

  # Always sync from origin/main, never from the working tree
  SOURCE_REF="origin/$BRANCH"
  echo "Source: $SOURCE_REF ($(git -C "$REPO_ROOT" rev-parse --short "$SOURCE_REF"))"

  # Create worktree if it doesn't exist
  if [ ! -d "$WORKTREE" ]; then
    echo "Creating worktree at $WORKTREE from $REMOTE/$BRANCH..."
    git -C "$REPO_ROOT" worktree add "$WORKTREE" "$REMOTE/$BRANCH" --detach
  else
    # Update to latest remote
    echo "Updating worktree to $REMOTE/$BRANCH..."
    git -C "$WORKTREE" checkout --detach "$REMOTE/$BRANCH"
  fi

  # Export origin/main into a temp directory so we always sync the right content
  TMPDIR_EXPORT=$(mktemp -d)
  trap 'rm -rf "$TMPDIR_EXPORT"' EXIT
  git -C "$REPO_ROOT" archive "$SOURCE_REF" | tar -x -C "$TMPDIR_EXPORT"

  # Read config and sync each path from the export
  echo "Syncing paths from config..."
  local synced=0

  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    line="${line%%#*}"
    line="$(echo "$line" | xargs)" # trim whitespace
    [ -z "$line" ] && continue

    local src="$TMPDIR_EXPORT/$line"
    local dst="$WORKTREE/$line"

    if [ -d "$src" ]; then
      # Remove stale subdirectories that no longer exist in source before rsyncing,
      # since rsync --delete won't remove non-empty directories.
      if [ -d "$dst" ]; then
        find "$dst" -mindepth 1 -maxdepth 1 -type d | while read -r subdir; do
          local name
          name=$(basename "$subdir")
          if [ ! -d "$src/$name" ]; then
            echo "  removing stale dir: $line/$name"
            rm -rf "$subdir"
          fi
        done
      fi
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
      echo "  warning: $line does not exist in $SOURCE_REF, skipping"
    fi
  done < "$CONF"

  echo "Synced $synced paths."

  # Detect public packages in Forgejo not listed in github-mirror.conf
  check_missing_packages

  # Validate workspace resolution before committing
  echo "Validating workspace resolution (bun install)..."
  local install_out
  if ! install_out=$(bun install --cwd "$WORKTREE" 2>&1); then
    echo ""
    echo "error: bun install failed in worktree — likely a missing package in github-mirror.conf or Dockerfile."
    echo "$install_out"
    exit 1
  fi
  echo "$install_out" | tail -3

  # Show summary
  echo ""
  echo "--- Changes in worktree ---"
  git -C "$WORKTREE" add -A
  git -C "$WORKTREE" diff --cached --stat
  echo ""
  echo "Worktree ready at: $WORKTREE"
  echo "Review changes, then commit and push manually."
}

# Warn about public packages in Forgejo that aren't listed in github-mirror.conf
check_missing_packages() {
  local allowed
  allowed=$(read_allowed_paths)
  local warned=0

  # Scan all package.json files one level deep under packages/
  while IFS= read -r pkg_json; do
    local dir
    dir=$(dirname "$pkg_json")
    local rel
    rel="${dir#$TMPDIR_EXPORT/}"

    # Skip if already covered by an entry in the conf
    local covered=false
    while IFS= read -r prefix; do
      if [[ "$rel" == "$prefix" || "$rel" == "$prefix"/* ]]; then
        covered=true
        break
      fi
    done <<< "$allowed"
    $covered && continue

    # Check if it looks like a public package (has a repository field pointing to github)
    if grep -q '"repository"' "$pkg_json" && grep -q 'github.com/contfu' "$pkg_json"; then
      local pkg_name
      pkg_name=$(grep '"name"' "$pkg_json" | head -1 | sed 's/.*"name": *"\([^"]*\)".*/\1/')
      echo "  warning: public package $pkg_name ($rel) is not in github-mirror.conf"
      warned=$((warned + 1))
    fi
  done < <(find "$TMPDIR_EXPORT/packages" -name "package.json" -not -path "*/node_modules/*")

  if [ "$warned" -gt 0 ]; then
    echo "  → Add missing paths to github-mirror.conf and re-run."
  fi
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
