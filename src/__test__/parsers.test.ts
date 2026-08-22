import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { ParseDoFile, ParseEnvFiles } from "../parsers";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

const makeTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "do-parser-test-"));
  temporaryDirectories.push(directory);
  return directory;
};

describe("DO command parsing", () => {
  test("preserves implicit indented run lines as separate commands", async () => {
    const directory = await makeTemporaryDirectory();
    const path = join(directory, "DO");

    await writeFile(
      path,
      `tasks:
  build:
    run:
      mkdir -p bin
      go build -o ./bin/app ./cmd/app
`,
    );

    const doFile = await Effect.runPromise(ParseDoFile(path));
    const build = doFile.tasks.build;

    expect(typeof build).toBe("object");
    expect(typeof build !== "string" && build?.run).toBe(
      "mkdir -p bin\ngo build -o ./bin/app ./cmd/app\n",
    );
  });

  test("accepts a YAML command list", async () => {
    const directory = await makeTemporaryDirectory();
    const path = join(directory, "DO");

    await writeFile(
      path,
      `tasks:
  build:
    run:
      - mkdir -p bin
      - go build -o ./bin/app ./cmd/app
`,
    );

    const doFile = await Effect.runPromise(ParseDoFile(path));
    const build = doFile.tasks.build;

    expect(typeof build !== "string" && build?.run).toEqual([
      "mkdir -p bin",
      "go build -o ./bin/app ./cmd/app",
    ]);
  });
});

describe("environment file loading", () => {
  test("keeps support for one file", async () => {
    const directory = await makeTemporaryDirectory();
    const path = join(directory, ".env");
    await writeFile(path, "HOST=localhost\n");

    await expect(Effect.runPromise(ParseEnvFiles(path))).resolves.toEqual({
      HOST: "localhost",
    });
  });

  test("merges files in order with later values winning", async () => {
    const directory = await makeTemporaryDirectory();
    const base = join(directory, ".env");
    const override = join(directory, ".env.do");
    await writeFile(base, "HOST=localhost\nPORT=3000\n");
    await writeFile(override, "PORT=4000\nMODE=development\n");

    await expect(
      Effect.runPromise(ParseEnvFiles([base, override])),
    ).resolves.toEqual({
      HOST: "localhost",
      PORT: "4000",
      MODE: "development",
    });
  });
});
