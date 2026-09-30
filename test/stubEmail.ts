// The `EMAIL` binding for tests (#215): it keeps every message it is handed
// and sends none, so no test reaches Cloudflare Email Service.

import type { EmailBinding, EmailMessage } from "../src/email/send.js";

export class StubEmail implements EmailBinding {
  readonly sent: EmailMessage[] = [];
  /** While set, every send fails as Email Service fails one, with this code. */
  failing: string | undefined;

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    if (this.failing !== undefined) throw Object.assign(new Error("Email Service refused the message."), { code: this.failing });
    this.sent.push(message);
    return { messageId: `msg_test_${this.sent.length}` };
  }

  /** The subject of each message sent, in order. */
  subjects(): string[] {
    return this.sent.map((message) => message.subject);
  }
}
