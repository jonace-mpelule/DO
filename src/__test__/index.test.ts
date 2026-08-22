import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

describe("do CLI", () => {
  test("prints help without requiring a DO file", async () => {
    const process = Bun.spawn(
      ["bun", resolve(import.meta.dir, "..", "index.ts"), "--help"],
      { stdout: "pipe", stderr: "pipe" },
    );

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("dof <task>");
  });

  test("runs dependencies and interpolates CLI and loaded env values", async () => {
    const directory = await mkdtemp(join(tmpdir(), "do-cli-test-"));
    temporaryDirectories.push(directory);

    await writeFile(
      join(directory, "DO"),
      `env:
  file:
    - .env
    - .env.do
tasks:
  prepare:
    run:
      - printf prepared
      - printf prepared-list
  dev:
    needs: prepare
    args: [name]
    run:
      printf "result=${"${name}"}-${"${MODE}"}"
      printf "second-command"
`,
    );
    await writeFile(join(directory, ".env"), "MODE=base\n");
    await writeFile(join(directory, ".env.do"), "MODE=local\n");

    const process = Bun.spawn(
      ["bun", resolve(import.meta.dir, "..", "index.ts"), "dev", "--name", "Ada"],
      {
        cwd: directory,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("prepared");
    expect(stdout).toContain("prepared-list");
    expect(stdout).toContain('printf "result=Ada-local"');
    expect(stdout).toContain("result=Ada-local");
    expect(stdout).toContain("second-command");
  });
});
