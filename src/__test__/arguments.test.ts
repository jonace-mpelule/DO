import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  collectArgumentNames,
  interpolateCommand,
  parseCliArguments,
  validateCliArguments,
} from "../arguments";
import type { DoFile, Task } from "../do-type";

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);
const runError = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.flip(effect));

describe("CLI arguments", () => {
  test("parses spaced and equals forms", async () => {
    expect(
      run(parseCliArguments(["--name", "Ada Lovelace", "--port=3000"])),
    ).resolves.toEqual({ name: "Ada Lovelace", port: "3000" });
  });

  test("requires every option to have a value", async () => {
    expect(runError(parseCliArguments(["--name"]))).resolves.toMatchObject({
      _tag: "InvalidArgumentError",
    });
  });
});

describe("task argument interpolation", () => {
  const task: Task = {
    args: {
      name: { default: "world" },
      port: { required: true },
    },
    run: "echo ${name} on ${port} (${MODE})",
  };

  test("uses CLI, then the loaded env file, then declared defaults", async () => {
    expect(
      run(
        interpolateCommand(
          task.run,
          "dev",
          task,
          { name: "from-env", port: "4000", MODE: "local" },
          { name: "from-cli" },
        ),
      ),
    ).resolves.toBe("echo from-cli on 4000 (local)");
  });

  test("does not fall back to the process environment", async () => {
    const noArguments: Task = { run: "echo ${HOME}" };
    expect(
      runError(interpolateCommand(noArguments.run, "dev", noArguments, {}, {})),
    ).resolves.toMatchObject({
      _tag: "UnresolvedVariableError",
      variable: "HOME",
    });
  });

  test("reports a required value before running the command", async () => {
    expect(
      runError(interpolateCommand(task.run, "dev", task, {}, {})),
    ).resolves.toMatchObject({
      _tag: "MissingArgumentError",
      argument: "port",
    });
  });
});

describe("dependency arguments", () => {
  const doFile: DoFile = {
    tasks: {
      dev: { needs: "prepare", run: "echo ready" },
      prepare: { args: ["name"], run: "echo ${name}" },
    },
  };

  test("allows arguments declared by a dependency", async () => {
    expect([...collectArgumentNames(doFile, "dev")]).toEqual(["name"]);
    expect(
      run(validateCliArguments(doFile, "dev", { name: "Ada" })),
    ).resolves.toBeUndefined();
  });

  test("rejects undeclared CLI arguments", async () => {
     expect(
      runError(validateCliArguments(doFile, "dev", { typo: "Ada" })),
    ).resolves.toMatchObject({
      _tag: "UnknownArgumentError",
      argument: "typo",
    });
  });
});
