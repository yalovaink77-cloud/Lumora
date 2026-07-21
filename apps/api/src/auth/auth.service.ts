import { Injectable, OnModuleInit } from '@nestjs/common';

import type { AuthRuntimeConfig } from '@lumora/auth';

import { createAuthRuntimeModule, type LumoraAuth } from './auth.runtime';

@Injectable()
export class AuthService implements OnModuleInit {
  private authInstance: LumoraAuth | undefined;
  private validatedConfig: AuthRuntimeConfig | undefined;

  async onModuleInit(): Promise<void> {
    const authRuntime = await createAuthRuntimeModule();
    this.validatedConfig = authRuntime.validateAuthRuntimeConfig(process.env);
  }

  async getAuth(): Promise<LumoraAuth> {
    if (!this.authInstance) {
      const authRuntime = await createAuthRuntimeModule();

      if (!this.validatedConfig) {
        this.validatedConfig = authRuntime.validateAuthRuntimeConfig(process.env);
      }

      this.authInstance = authRuntime.createAuth(this.validatedConfig);
    }

    return this.authInstance;
  }

  getValidatedConfig(): AuthRuntimeConfig | undefined {
    return this.validatedConfig;
  }
}
