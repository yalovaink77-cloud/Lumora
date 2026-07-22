/**
 * In-memory process-lifetime disclosure continuation (ADR-019 / ADR-020).
 * Informational gate only; never persisted to storage or the server.
 */

export type DisclosureProcessState = {
  /** Principal id for which the user continued in this process, if any. */
  continuedForPrincipalId: string | null;
};

export function createInitialDisclosureProcessState(): DisclosureProcessState {
  return { continuedForPrincipalId: null };
}

export function hasContinuedDisclosure(
  state: DisclosureProcessState,
  principalId: string,
): boolean {
  return state.continuedForPrincipalId === principalId;
}

export function continueDisclosureForPrincipal(
  principalId: string,
): DisclosureProcessState {
  return { continuedForPrincipalId: principalId };
}

export function resetDisclosureProcessState(): DisclosureProcessState {
  return createInitialDisclosureProcessState();
}
