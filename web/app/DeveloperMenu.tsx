"use client";

// The ☰ menu, on a phone only (boards `VDNSE` and `j6UaW`): the bar's pages,
// one a row, then the menu's foot. Open, it fills the screen under its own
// copy of the bar, with × where the ☰ was.
//
// Base UI's dialog supplies the behaviour (ADR 0010), as the full-screen sheet
// it is: the ☰ opens it, × and Escape close it, the focus stays inside while
// it is open, and it returns to the ☰ when it closes.

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { CloseIcon, MenuIcon } from "./MenuIcons";
import {
  DEV_MENU_BAR,
  DEV_MENU_CLOSE,
  DEV_MENU_ICON,
  DEV_MENU_LINK,
  DEV_MENU_LINKS,
  DEV_MENU_PANEL,
  DEV_MENU_TOGGLE,
} from "./styles.ts";

/** A page the ☰ menu names; `current` marks the one being read. */
export interface DeveloperMenuLink {
  label: string;
  href: string;
  current: boolean;
}

/**
 * `name` is the site's name as the bar draws it; `links` and `children`, the
 * foot, are what a signed-in bar changes (board `j6UaW`): the dashboard and its
 * settings first among the links, and the account's email and Sign out as the foot.
 */
export function DeveloperMenu({ name, links, children }: { name: ReactNode; links: readonly DeveloperMenuLink[]; children: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={DEV_MENU_TOGGLE} aria-label="Menu">
        <MenuIcon className={DEV_MENU_ICON} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup className={DEV_MENU_PANEL} aria-label="Menu">
          <DeveloperMenuContent name={name} links={links}>
            {children}
          </DeveloperMenuContent>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** What the open menu holds: its copy of the bar with ×, the links, then the foot. Drawn inside its `Dialog.Popup`. */
export function DeveloperMenuContent({ name, links, children }: { name: ReactNode; links: readonly DeveloperMenuLink[]; children: ReactNode }) {
  return (
    <>
      <div className={DEV_MENU_BAR}>
        {name}
        <Dialog.Close className={DEV_MENU_CLOSE} aria-label="Close menu">
          <CloseIcon className={DEV_MENU_ICON} />
        </Dialog.Close>
      </div>
      <nav aria-label="Menu">
        <ul className={DEV_MENU_LINKS}>
          {links.map((link) => (
            <li key={link.href}>
              <a className={DEV_MENU_LINK} href={link.href} aria-current={link.current ? "page" : undefined}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </>
  );
}
