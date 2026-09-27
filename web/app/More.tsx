// The one expand control on a result (design-system-manifest.md § "Layout"):
// a small accent `+ more` right after what shows, and, once open, `less` at the
// very end of everything. No count.
//
// It is a native `<details>` placed after all the content it reveals, which
// sits beside it rather than inside it and is shown by CSS once it is open. So
// closed, with the rest hidden, the control follows the last thing that shows;
// open, it follows the last thing of all. The whole content is in the HTML,
// and it opens with no script.

import type { Ref } from "react";
import { MORE_CLOSED, MORE_OPEN, MORE_SUMMARY } from "./styles.ts";

/** `open` starts it open, as when the search hit something it reveals. */
export function More({
  className,
  open,
  ref,
}: {
  className: string;
  open?: boolean;
  ref?: Ref<HTMLDetailsElement>;
}) {
  return (
    <details ref={ref} className={className} open={open}>
      <summary className={MORE_SUMMARY}>
        <span className={MORE_CLOSED}>+ more</span>
        <span className={MORE_OPEN}>less</span>
      </summary>
    </details>
  );
}
