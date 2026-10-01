#!/bin/sh
# Git's post-checkout hook, run by lefthook (lefthook.yml, ADR 0022). It prepares
# a fresh linked worktree: it links the source file from the main checkout and
# installs dependencies. Every other checkout returns at once.
#
# The one argument is git's first: the previous HEAD.
set -eu

previous_head=$1

# `git worktree add` (and a fresh clone) check out from nothing, so git passes
# the all-zero object id as the previous HEAD. A branch switch never does.
case $previous_head in
  *[!0]*) exit 0 ;;
esac

git_dir=$(git rev-parse --path-format=absolute --git-dir)
common_dir=$(git rev-parse --path-format=absolute --git-common-dir)

# A fresh clone is the main checkout itself: there is nothing to link from.
[ "$git_dir" = "$common_dir" ] && exit 0

main_checkout=$(dirname "$common_dir")
source_file=it-extract.jsonl.gz

if [ -e "$source_file" ] || [ -L "$source_file" ]; then
  :
elif [ -e "$main_checkout/$source_file" ]; then
  ln -s "$main_checkout/$source_file" "$source_file"
else
  echo "set-up-worktree: $main_checkout has no $source_file to link" >&2
fi

pnpm install --frozen-lockfile
