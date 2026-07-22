export type AuthenticatedPrincipal = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export const AUTH_PRINCIPAL_KEY = 'lumoraAuthenticatedPrincipal';
