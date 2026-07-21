import type { BetterAuthPlugin } from 'better-auth';

function redactTokenFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactTokenFields);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'token')
      .map(([key, fieldValue]) => [key, redactTokenFields(fieldValue)]),
  );
}

export const sessionResponseRedaction = {
  id: 'lumora-session-response-redaction',
  async onResponse(response) {
    if (!response.headers.get('content-type')?.includes('application/json')) {
      return;
    }

    const body = (await response.clone().json()) as unknown;
    const headers = new Headers(response.headers);
    headers.delete('content-length');

    return {
      response: new Response(JSON.stringify(redactTokenFields(body)), {
        headers,
        status: response.status,
        statusText: response.statusText,
      }),
    };
  },
} satisfies BetterAuthPlugin;
