"use client";

// Copy, under a new key's secret (board 28e). The secret itself is text in
// the dialog, selectable; this only puts it on the clipboard.

import { useState } from "react";
import { CopyIcon } from "./icons";
import { KEY_COPY, KEY_COPY_ICON } from "./styles.ts";

/** Copy; `autoFocus` takes the focus as it appears, as the new key replaces the form it came from. */
export function CopySecret({ text, autoFocus = false }: { text: string; autoFocus?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={KEY_COPY}
      type="button"
      autoFocus={autoFocus}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <CopyIcon className={KEY_COPY_ICON} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
