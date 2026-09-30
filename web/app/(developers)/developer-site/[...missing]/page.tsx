// Any developer-site path no other page matches (#171). Every named route wins
// over a catch-all, so this only ever answers a miss, with the group's own
// not-found.tsx inside the developer layout.
import { notFound } from "next/navigation";

export default function Page(): never {
  notFound();
}
