import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const containerName = `lumora-auth-test-${randomUUID()}`;
const databaseName = "lumora_auth_test";
const databaseUser = "lumora_auth_test";
const databasePassword = randomBytes(24).toString("base64url");
const postgresImage = "postgres:16-alpine";
let containerStarted = false;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}.`,
    );
  }
}

function output(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        `${command} failed with exit code ${result.status}.`,
    );
  }

  return result.stdout.trim();
}

function removeContainer() {
  if (!containerStarted) {
    return;
  }

  spawnSync("docker", ["rm", "--force", containerName], {
    stdio: "ignore",
  });
  containerStarted = false;
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function waitForPostgres() {
  const timeoutAt = Date.now() + 30_000;

  while (Date.now() < timeoutAt) {
    const result = spawnSync(
      "docker",
      [
        "exec",
        containerName,
        "pg_isready",
        "-U",
        databaseUser,
        "-d",
        databaseName,
      ],
      {
        stdio: "ignore",
      },
    );

    if (result.status === 0) {
      return;
    }

    sleep(250);
  }

  throw new Error(
    "Disposable PostgreSQL did not become ready within 30 seconds.",
  );
}

process.once("SIGINT", () => {
  removeContainer();
  process.exit(130);
});
process.once("SIGTERM", () => {
  removeContainer();
  process.exit(143);
});

try {
  output("docker", ["info", "--format", "{{.ServerVersion}}"]);
  run("docker", [
    "run",
    "--rm",
    "--detach",
    "--name",
    containerName,
    "--env",
    `POSTGRES_USER=${databaseUser}`,
    "--env",
    `POSTGRES_PASSWORD=${databasePassword}`,
    "--env",
    `POSTGRES_DB=${databaseName}`,
    "--publish",
    "127.0.0.1::5432",
    postgresImage,
  ]);
  containerStarted = true;
  waitForPostgres();

  const publishedPort = output("docker", ["port", containerName, "5432/tcp"])
    .split(":")
    .at(-1);

  if (!publishedPort) {
    throw new Error("Docker did not publish the disposable PostgreSQL port.");
  }

  const databaseUrl =
    `postgresql://${databaseUser}:${encodeURIComponent(databasePassword)}` +
    `@127.0.0.1:${publishedPort}/${databaseName}?schema=public`;
  const testEnvironment = {
    ...process.env,
    AUTH_TEST_DATABASE_URL: databaseUrl,
    DATABASE_URL: databaseUrl,
  };

  run("pnpm", ["build"], {
    env: testEnvironment,
  });
  run("pnpm", ["--filter", "@lumora/database", "exec", "prisma", "validate"], {
    env: testEnvironment,
  });
  run(
    "pnpm",
    ["--filter", "@lumora/database", "exec", "prisma", "migrate", "deploy"],
    {
      env: testEnvironment,
    },
  );
  run(
    "pnpm",
    ["--filter", "@lumora/database", "exec", "prisma", "migrate", "status"],
    {
      env: testEnvironment,
    },
  );
  run(
    "pnpm",
    ["--filter", "@lumora/api", "run", "test:auth:postgres:runtime"],
    {
      env: testEnvironment,
    },
  );
  run(
    "pnpm",
    ["--filter", "@lumora/api", "run", "test:family:postgres:runtime"],
    {
      env: testEnvironment,
    },
  );
} finally {
  removeContainer();
}
