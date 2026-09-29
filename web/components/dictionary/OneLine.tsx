"use client";

// A text shown on one line, cut with an ellipsis, with the one expand control
// (More.tsx) right after it: `+ more` opens the rest in place, and `less`, after
// the text's last word, closes it again (boards 10 and 19: every Etymology block).
//
// The whole text is in the HTML, and the line is Base UI's collapsible, open
// or closed. What needs measuring is whether the text fits: a text that already
// fits on its line drops the control, and a resize asks again.

import { Collapsible } from "@base-ui/react/collapsible";
import { useEffect, useId, useRef, useState } from "react";
import { More } from "./More";
import { ONE_LINE, ONE_LINE_MORE, ONE_LINE_MORE_UNNEEDED, ONE_LINE_TEXT } from "@/components/shared/styles.ts";

export function OneLine({ text, lang }: { text: string; lang?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const element = line.current;
    const block = root.current;
    if (element === null || block === null) return;
    const measure = () => {
      // Only a closed line can be measured; an open one fits by definition.
      if (block.hasAttribute("data-open")) return;
      setFits(element.scrollWidth <= element.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // A line closed after a resize, or set in a font that arrived late, is measured again.
    const toggled = new MutationObserver(measure);
    toggled.observe(block, { attributeFilter: ["data-open"] });
    void document.fonts.ready.then(measure);
    return () => {
      observer.disconnect();
      toggled.disconnect();
    };
  }, []);

  return (
    <Collapsible.Root ref={root} className={ONE_LINE} data-one-line="">
      <p ref={line} id={id} className={ONE_LINE_TEXT} lang={lang}>
        {text}
      </p>
      {/* Hidden, not left out, so a resize that cuts the text can bring it back. */}
      <More className={fits ? ONE_LINE_MORE_UNNEEDED : ONE_LINE_MORE} controls={id} />
    </Collapsible.Root>
  );
}
