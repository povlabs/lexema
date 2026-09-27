// ⌘K / Ctrl+K back to the search field: which keys it takes, what the hint
// says, and when it stands aside. The focusing itself needs a browser; it is
// checked there (see the PR body).

import assert from "node:assert/strict";
import test from "node:test";
import { isApple, isSearchShortcut, shortcutApplies, shortcutLabel, type ShortcutKey } from "../app/searchShortcut.ts";

const key = (overrides: Partial<ShortcutKey>): ShortcutKey => ({
  key: "k",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

test("⌘K on a Mac and Ctrl+K elsewhere, with no other modifier", () => {
  assert.equal(isSearchShortcut(key({ metaKey: true }), true), true);
  assert.equal(isSearchShortcut(key({ key: "K", metaKey: true }), true), true, "caps lock does not matter");
  assert.equal(isSearchShortcut(key({ ctrlKey: true }), true), false, "Ctrl+K on a Mac is left alone");
  assert.equal(isSearchShortcut(key({ ctrlKey: true }), false), true);
  assert.equal(isSearchShortcut(key({ metaKey: true }), false), false, "the Windows key is left alone");
  assert.equal(isSearchShortcut(key({ metaKey: true, shiftKey: true }), true), false);
  assert.equal(isSearchShortcut(key({ ctrlKey: true, altKey: true }), false), false);
  assert.equal(isSearchShortcut(key({ key: "j", metaKey: true }), true), false);
  assert.equal(isSearchShortcut(key({}), true), false, "a plain k is typing");
});

test("the hint names the platform's keys", () => {
  assert.equal(isApple("MacIntel"), true);
  assert.equal(isApple("macOS"), true);
  assert.equal(isApple("iPad"), true);
  assert.equal(isApple("Win32"), false);
  assert.equal(isApple("Linux x86_64"), false);
  assert.equal(shortcutLabel(true), "⌘K");
  assert.equal(shortcutLabel(false), "Ctrl K");
});

test("the shortcut stands aside while a dialog is open or the reader types in another field", () => {
  assert.equal(shortcutApplies({ dialogOpen: false, typingElsewhere: false }), true);
  assert.equal(shortcutApplies({ dialogOpen: true, typingElsewhere: false }), false);
  assert.equal(shortcutApplies({ dialogOpen: false, typingElsewhere: true }), false);
});
