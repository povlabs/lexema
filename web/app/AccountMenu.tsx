"use client";

// The account menu at the right end of the signed-in bar (#190, board 28h):
// a round avatar with the name's first letter, else the email's (we ask no
// provider for a photo), that opens a menu with the name and the email, then
// Dashboard, Settings and Sign out. Base UI's Avatar and Menu (ADR 0010): the
// menu opens and closes on a click and on Escape, the arrow keys move through
// its items, and the focus returns to the avatar when it closes. On a phone
// the ☰ menu (DeveloperPage.tsx) stands in for it.
//
// Sign out posts the bar's sign-out form, as it did from the bar before.

import { Avatar } from "@base-ui/react/avatar";
import { Menu } from "@base-ui/react/menu";
import { DASHBOARD, SETTINGS } from "./dashboardActions.ts";
import { DashboardIcon, SettingsIcon, SignOutIcon } from "./MenuIcons";
import { avatarInitial, type SignedIn } from "./signedIn.ts";
import {
  ACCOUNT_AVATAR,
  ACCOUNT_AVATAR_INITIAL,
  ACCOUNT_MENU,
  ACCOUNT_MENU_EMAIL,
  ACCOUNT_MENU_HEAD,
  ACCOUNT_MENU_ICON,
  ACCOUNT_MENU_ITEM,
  ACCOUNT_MENU_NAME,
  ACCOUNT_MENU_POSITIONER,
  ACCOUNT_MENU_RULE,
  ACCOUNT_MENU_SIGN_OUT,
  ACCOUNT_TRIGGER,
} from "./styles.ts";

/** The avatar and its menu; `signOutForm` is the id of the form Sign out submits. */
export function AccountMenu({ signedIn, signOutForm }: { signedIn: SignedIn; signOutForm: string }) {
  return (
    <Menu.Root>
      <Menu.Trigger className={ACCOUNT_TRIGGER} aria-label="Account">
        <Avatar.Root className={ACCOUNT_AVATAR}>
          <Avatar.Fallback className={ACCOUNT_AVATAR_INITIAL}>{avatarInitial(signedIn)}</Avatar.Fallback>
        </Avatar.Root>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={ACCOUNT_MENU_POSITIONER} side="bottom" align="end" sideOffset={10}>
          <Menu.Popup className={ACCOUNT_MENU}>
            <AccountMenuContent signedIn={signedIn} signOutForm={signOutForm} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** What the open menu holds: the name and the email, then the three items. Drawn inside its `Menu.Popup`. */
export function AccountMenuContent({ signedIn, signOutForm }: { signedIn: SignedIn; signOutForm: string }) {
  return (
    <>
      <div className={ACCOUNT_MENU_HEAD}>
        {signedIn.name !== undefined && <p className={ACCOUNT_MENU_NAME}>{signedIn.name}</p>}
        <p className={signedIn.name === undefined ? ACCOUNT_MENU_NAME : ACCOUNT_MENU_EMAIL}>{signedIn.email}</p>
      </div>
      <Menu.Separator className={ACCOUNT_MENU_RULE} />
      <Menu.LinkItem className={ACCOUNT_MENU_ITEM} href={DASHBOARD}>
        <DashboardIcon className={ACCOUNT_MENU_ICON} />
        Dashboard
      </Menu.LinkItem>
      <Menu.LinkItem className={ACCOUNT_MENU_ITEM} href={SETTINGS}>
        <SettingsIcon className={ACCOUNT_MENU_ICON} />
        Settings
      </Menu.LinkItem>
      <Menu.Item className={ACCOUNT_MENU_SIGN_OUT} nativeButton render={<button type="submit" form={signOutForm} />}>
        <SignOutIcon className={ACCOUNT_MENU_ICON} />
        Sign out
      </Menu.Item>
    </>
  );
}
