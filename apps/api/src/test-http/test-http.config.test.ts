import assert from 'node:assert/strict';
import { test } from 'node:test';

import { areTestHttpRoutesEnabled } from './test-http.config';

test('test HTTP routes require explicit non-production opt-in', () => {
  assert.equal(areTestHttpRoutesEnabled({}), false);
  assert.equal(
    areTestHttpRoutesEnabled({
      NODE_ENV: 'test',
      LUMORA_ENABLE_TEST_HTTP_ROUTES: 'true',
    }),
    true,
  );
});

test('test HTTP routes cannot be enabled in production', () => {
  assert.equal(
    areTestHttpRoutesEnabled({
      NODE_ENV: 'production',
      LUMORA_ENABLE_TEST_HTTP_ROUTES: 'true',
    }),
    false,
  );
});
