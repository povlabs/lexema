"use client";

// A text shown on one line, cut with an ellipsis, with a small `+ more` that
// opens the rest in place and `less` that closes it again (boards 10 and 19:
// every Etymology block).
//
// The whole text is in the HTML, and the toggle is a native `<details>`, so it
// opens with no script. What needs a script is knowing whether the text fits:
// once hydrated, a text that already fits on its line drops the toggle, and a
// resize asks again.

import { useEffect, useRef, useState } from "react";
import { MORE_CLOSED, MORE_OPEN, ONE_LINE, ONE_LINE_TEXT, ONE_LINE_TOGGLE, ONE_LINE_TOGGLE_SUMMARY } from "./styles.ts";

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
    return () => observer.disconnect();
  }, []);

  return (
    <div className={ONE_LINE} data-one-line="">
      <p ref={line} className={ONE_LINE_TEXT} lang={lang}>
        {text}
      </p>
      <details ref={toggle} className={ONE_LINE_TOGGLE} hidden={fits}>
        <summary className={ONE_LINE_TOGGLE_SUMMARY}>
          <span className={MORE_CLOSED}>+ more</span>
          <span className={MORE_OPEN}>less</span>
        </summary>
      </details>
    </div>
  );
}
