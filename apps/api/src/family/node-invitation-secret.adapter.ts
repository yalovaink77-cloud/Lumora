import { createHash, randomBytes } from "node:crypto";

import type {
  InvitationSecretDigest,
  InvitationSecretPort,
} from "@lumora/family";

export class NodeInvitationSecretAdapter implements InvitationSecretPort {
  async generateSecret(): Promise<string> {
    return randomBytes(32).toString("base64url");
  }

  async digestSecret(secret: string): Promise<InvitationSecretDigest> {
    return Uint8Array.from(
      createHash("sha256").update(secret, "utf8").digest(),
    ) as InvitationSecretDigest;
  }
}
