import { Module } from "@nestjs/common";
import { FamilyApplicationService } from "@lumora/family";
import { PrismaFamilyRepository } from "@lumora/database";

import { AuthModule } from "../auth/auth.module";
import { createAuthRuntimeModule } from "../auth/auth.runtime";
import { CanonicalEmailAdapter } from "./canonical-email.adapter";
import { FAMILY_APPLICATION_SERVICE } from "./family.constants";
import { FamilyController } from "./family.controller";
import { FamilyInvitationController } from "./family-invitation.controller";
import { NodeInvitationSecretAdapter } from "./node-invitation-secret.adapter";

@Module({
  imports: [AuthModule],
  controllers: [FamilyController, FamilyInvitationController],
  providers: [
    {
      provide: FAMILY_APPLICATION_SERVICE,
      useFactory: async () => {
        const { canonicalizeEmail } = await createAuthRuntimeModule();

        return new FamilyApplicationService(
          new PrismaFamilyRepository(),
          new CanonicalEmailAdapter(canonicalizeEmail),
          new NodeInvitationSecretAdapter(),
        );
      },
    },
  ],
})
export class FamilyModule {}
