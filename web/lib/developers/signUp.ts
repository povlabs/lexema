// Whether the developer site takes new developers, for the page being rendered
// (#610): the parsed `DEVELOPER_SIGN_UP` (worker/developers/signUp.ts). The
// pages read this once and hand it down, so a closed site draws no sign-in.
import { env } from "cloudflare:workers";
import { parseSignUp, type SignUp } from "@/worker/developers/signUp.ts";

export const developerSignUp = (): SignUp => parseSignUp(env.DEVELOPER_SIGN_UP);
