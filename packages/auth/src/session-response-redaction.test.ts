import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sessionResponseRedaction } from './session-response-redaction.js';

test('redacts token fields from Better Auth JSON responses and preserves cookies', async () => {
  const response = new Response(
    JSON.stringify({
      token: 'raw-session-token',
      user: {
        id: 'user-id',
      },
      session: {
        token: 'nested-session-token',
        expiresAt: '2026-07-28T00:00:00.000Z',
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'better-auth.session_token=signed-cookie; HttpOnly; SameSite=Lax',
      },
      status: 200,
    },
  );

  const result = await sessionResponseRedaction.onResponse(response);

  assert.ok(result);
  assert.deepEqual(await result.response.json(), {
    user: {
      id: 'user-id',
    },
    session: {
      expiresAt: '2026-07-28T00:00:00.000Z',
    },
  });
  assert.equal(
    result.response.headers.get('set-cookie'),
    'better-auth.session_token=signed-cookie; HttpOnly; SameSite=Lax',
  );
});

test('does not replace non-JSON Better Auth responses', async () => {
  const response = new Response('redirect', {
    headers: {
      'Content-Type': 'text/plain',
    },
  });

  assert.equal(await sessionResponseRedaction.onResponse(response), undefined);
});
