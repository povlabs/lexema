#!/bin/sh
# Git's post-checkout hook, run by lefthook (lefthook.yml, ADR 0022). It prepares
# a fresh linked worktree: it links the main checkout's source cache,
# `.data/source/` (src/source/sourceCache.ts), so a file one checkout fetched
# from povlabs/lexema-data is not fetched again, and installs dependencies.
# Every other checkout returns at once.
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
source_cache=.data/source

# The main checkout's cache is made when it is missing, so the first fetch from
# any checkout lands where every other one reads.
if [ ! -e "$source_cache" ] && [ ! -L "$source_cache" ]; then
  mkdir -p "$main_checkout/$source_cache" .data
  ln -s "$main_checkout/$source_cache" "$source_cache"
fi

pnpm install --frozen-lockfile
