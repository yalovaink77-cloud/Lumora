export type NeutralAuthenticatedPrincipal = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export function toNeutralPrincipal(input: {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
}): NeutralAuthenticatedPrincipal {
  return {
    id: input.id,
    email: input.email,
    emailVerified: input.emailVerified,
    name: input.name,
  };
}
