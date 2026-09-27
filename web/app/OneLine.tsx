"use client";

// A text shown on one line, cut with an ellipsis, with the one expand control
// (More.tsx) right after it: `+ more` opens the rest in place, and `less`, after
// the text's last word, closes it again (boards 10 and 19: every Etymology block).
//
// The whole text is in the HTML, and the toggle is a native `<details>`, so it
// opens with no script. What needs a script is knowing whether the text fits:
// once hydrated, a text that already fits on its line drops the toggle, and a
// resize asks again.

import { useEffect, useRef, useState } from "react";
import { More } from "./More";
import { ONE_LINE, ONE_LINE_MORE, ONE_LINE_MORE_UNNEEDED, ONE_LINE_TEXT } from "./styles.ts";

export function OneLine({ text, lang }: { text: string; lang?: string }) {
  const line = useRef<HTMLParagraphElement>(null);
  const toggle = useRef<HTMLDetailsElement>(null);
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const element = line.current;
    if (element === null) return;
    const measure = () => {
      // Only a closed line can be measured; an open one fits by definition.
      if (toggle.current?.open) return;
      setFits(element.scrollWidth <= element.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // A line closed after a resize, or set in a font that arrived late, is measured again.
    const details = toggle.current;
    details?.addEventListener("toggle", measure);
    void document.fonts.ready.then(measure);
    return () => {
      observer.disconnect();
      details?.removeEventListener("toggle", measure);
    };
  }, []);

  return (
    <div className={ONE_LINE} data-one-line="">
      <p ref={line} className={ONE_LINE_TEXT} lang={lang}>
        {text}
      </p>
      {/* Hidden, not left out, so a resize that cuts the text can bring it back. */}
      <More ref={toggle} className={fits ? ONE_LINE_MORE_UNNEEDED : ONE_LINE_MORE} />
    </div>
  );
}
