import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { after, before, test } from 'node:test';

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to resolve an available port.'));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

let child: ChildProcess | undefined;
let baseUrl = '';
let childOutput = '';

async function waitForServerReady(timeoutMs = 20000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);

      if (response.status === 200) {
        return;
      }
    } catch {
      // Server not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Compiled API did not become ready in time.\nChild output:\n${childOutput}`,
  );
}

before(async () => {
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;

  child = spawn('node', ['dist/main.js'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      BETTER_AUTH_SECRET: 'unit-test-secret-value-with-32-chars-minimum',
      BETTER_AUTH_URL: baseUrl,
      AUTH_TRUSTED_ORIGINS: baseUrl,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://lumora:lumora@127.0.0.1:5432/lumora?schema=public',
      LUMORA_ENABLE_TEST_HTTP_ROUTES: 'true',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    childOutput += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    childOutput += chunk.toString();
  });

  await waitForServerReady();
});

after(() => {
  if (child?.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch {
        // Process already exited.
      }
    }
  }
});

test('GET /health remains reachable while auth is configured', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = (await response.json()) as {
    status: string;
    checks: { database: string };
  };

  assert.equal(response.status, 200);
  assert.equal(body.status, 'degraded');
  assert.equal(body.checks.database, 'error');
});

test('GET /auth/me rejects unauthenticated requests with HTTP 401', async () => {
  const response = await fetch(`${baseUrl}/auth/me`);

  assert.equal(response.status, 401);
});

test('Better Auth route prefix responds on /api/auth/ok', async () => {
  const response = await fetch(`${baseUrl}/api/auth/ok`);

  assert.equal(response.status, 200);
});

test('POST /api/auth/sign-up/email reaches Better Auth with a finite JSON response', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
    },
    body: JSON.stringify({
      name: 'Body Test User',
      email: 'not-an-email',
      password: 'ValidPassword123!',
    }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  const responseText = await response.text();

  assert.equal(response.status, 400);
  assert.ok(responseText.length > 0, 'expected a non-empty response body');
  assert.doesNotThrow(() => JSON.parse(responseText), 'expected structured JSON from Better Auth');

  const payload = JSON.parse(responseText) as { code?: string; message?: string };
  assert.equal(payload.code, 'VALIDATION_ERROR');
  assert.match(payload.message ?? '', /email/i);
});

test('POST /__test/echo-json parses JSON for normal Nest routes', async () => {
  const response = await fetch(`${baseUrl}/__test/echo-json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hello: 'world',
    }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    received: {
      hello: 'world',
    },
  });
});
