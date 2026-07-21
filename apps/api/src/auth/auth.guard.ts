import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { createBetterAuthNodeModule } from './auth.runtime';
import { AUTH_PRINCIPAL_KEY } from './auth.types';
import { toAuthenticatedPrincipal } from './auth.runtime';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      [AUTH_PRINCIPAL_KEY]?: ReturnType<typeof toAuthenticatedPrincipal>;
    }>();

    const auth = await this.authService.getAuth();
    const { fromNodeHeaders } = await createBetterAuthNodeModule();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    request[AUTH_PRINCIPAL_KEY] = toAuthenticatedPrincipal(session.user);
    return true;
  }
}
