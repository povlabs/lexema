// ⌘K on a Mac, Ctrl+K elsewhere: focus the search field and select its text,
// on the home page and on a result. The key test and when to stand aside are
// here, apart from the field, so they can be checked without a browser.

/** The parts of a key event the shortcut reads. */
export interface ShortcutKey {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Whether a platform string names a Mac (or an iPad with a keyboard, which uses ⌘). */
export const isApple = (platform: string): boolean => /mac|iphone|ipad|ipod/i.test(platform);

/** ⌘K on Apple platforms, Ctrl+K elsewhere, with no other modifier. */
export function isSearchShortcut(event: ShortcutKey, apple: boolean): boolean {
  if (event.key.toLowerCase() !== "k" || event.altKey || event.shiftKey) return false;
  return apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/** The hint in the bar: `⌘K`, or `Ctrl K`. */
export const shortcutLabel = (apple: boolean): string => (apple ? "⌘K" : "Ctrl K");

/** What the shortcut needs to know about where focus is. */
export interface ShortcutContext {
  /** A dialog is open, such as the report box: the shortcut is its keys' business. */
  dialogOpen: boolean;
  /** Focus is in some other text field, where the reader is typing. */
  typingElsewhere: boolean;
}

/** Whether the shortcut takes the key, or leaves it where the reader is. */
export const shortcutApplies = ({ dialogOpen, typingElsewhere }: ShortcutContext): boolean =>
  !dialogOpen && !typingElsewhere;
