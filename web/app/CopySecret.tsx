"use client";

// Copy, beside a new key's secret (board 29). The secret itself is in the
// server's HTML, selectable without a script; this only puts it on the
// clipboard.

import { useState } from "react";
import { CopyIcon } from "./icons";
import { KEY_COPY, KEY_COPY_ICON } from "./styles.ts";

export function CopySecret({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={KEY_COPY}
      type="button"
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
