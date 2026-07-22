import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
  AuthRuntimeConfig,
  EmailVerificationPrincipal,
  InMemoryVerificationEmailCaptureAdapter,
  VerificationEmailDeliveryInput,
} from '@lumora/auth';

import { createAuthRuntimeModule, type LumoraAuth } from './auth.runtime';

@Injectable()
export class AuthService implements OnModuleInit {
  private authInstance: LumoraAuth | undefined;
  private validatedConfig: AuthRuntimeConfig | undefined;
  private captureAdapter: InMemoryVerificationEmailCaptureAdapter | undefined;

  async onModuleInit(): Promise<void> {
    await this.ensureConfig();
  }

  async getAuth(): Promise<LumoraAuth> {
    if (!this.authInstance) {
      const authRuntime = await createAuthRuntimeModule();
      const config = await this.ensureConfig();
      this.authInstance = authRuntime.createAuth(config);
    }

    return this.authInstance;
  }

  getValidatedConfig(): AuthRuntimeConfig | undefined {
    return this.validatedConfig;
  }

  async requestEmailVerification(
    principal: EmailVerificationPrincipal,
  ): Promise<{ status: 'accepted' }> {
    const authRuntime = await createAuthRuntimeModule();

    return authRuntime.issueAuthenticatedSelfVerification({
      auth: await this.getAuth(),
      principal,
    });
  }

  async confirmEmailVerification(
    principal: EmailVerificationPrincipal,
    token: string,
  ): Promise<{ status: 'verified' }> {
    const authRuntime = await createAuthRuntimeModule();
    const config = await this.ensureConfig();

    return authRuntime.confirmAuthenticatedEmailVerification({
      auth: await this.getAuth(),
      principal,
      secret: config.secret,
      token,
    });
  }

  getCapturedVerificationEmails(): readonly VerificationEmailDeliveryInput[] {
    if (process.env.NODE_ENV !== 'test' || !this.captureAdapter) {
      return [];
    }

    return this.captureAdapter.messages;
  }

  clearCapturedVerificationEmails(): void {
    if (process.env.NODE_ENV === 'test') {
      this.captureAdapter?.clear();
    }
  }

  async runCanonicalEmailPreflight(): Promise<void> {
    const authRuntime = await createAuthRuntimeModule();
    await authRuntime.preflightCanonicalUserEmails();
  }

  private async ensureConfig(): Promise<AuthRuntimeConfig> {
    if (this.validatedConfig) {
      return this.validatedConfig;
    }

    const authRuntime = await createAuthRuntimeModule();
    this.captureAdapter =
      this.captureAdapter ??
      new authRuntime.InMemoryVerificationEmailCaptureAdapter();
    this.validatedConfig = authRuntime.validateAuthRuntimeConfig(process.env, {
      captureAdapter: this.captureAdapter,
    });

    return this.validatedConfig;
  }
}
