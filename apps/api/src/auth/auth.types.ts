export type AuthenticatedPrincipal = {
  id: string;
  email: string;
  name: string;
};

export const AUTH_PRINCIPAL_KEY = 'lumoraAuthenticatedPrincipal';
