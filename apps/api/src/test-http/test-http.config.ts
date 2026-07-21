export function areTestHttpRoutesEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    environment.NODE_ENV !== 'production' &&
    environment.LUMORA_ENABLE_TEST_HTTP_ROUTES === 'true'
  );
}
