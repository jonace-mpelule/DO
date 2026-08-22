import { Effect } from "effect";
import { interpolateCommand } from "./arguments";
import type { DoFile } from "./do-type";
import {
  type CommandFailedError,
  type CommandStartError,
  DependencyCycleError,
  type MissingArgumentError,
  MissingDependencyError,
  TargetNotFoundError,
  type UnresolvedVariableError,
} from "./errors";
import { type Environment, runCommand } from "./runner";

export const runTarget = (
  doFile: DoFile,
  targetName: string,
  env: Environment,
  cliArguments: Environment = {},
  stack: ReadonlyArray<string> = [],
): Effect.Effect<
  void,
  | TargetNotFoundError
  | MissingDependencyError
  | DependencyCycleError
  | CommandStartError
  | CommandFailedError
  | MissingArgumentError
  | UnresolvedVariableError
> =>
  Effect.gen(function* () {
    if (stack.includes(targetName)) {
      return yield* Effect.fail(
        new DependencyCycleError({
          targets: [...stack, targetName],
        }),
      );
    }

    const target = doFile.tasks[targetName];

    if (!target) {
      return yield* Effect.fail(
        new TargetNotFoundError({
          target: targetName,
        }),
      );
    }

    const nextStack = [...stack, targetName];

    if (typeof target !== "string" && target.needs) {
      const dependency = doFile.tasks[target.needs];

      if (!dependency) {
        return yield* Effect.fail(
          new MissingDependencyError({
            target: targetName,
            dependency: target.needs,
          }),
        );
      }

      yield* runTarget(doFile, target.needs, env, cliArguments, nextStack);
    }

    if (typeof target !== "string" && target.description) {
      yield* Effect.sync(() => {
        console.log(target.description);
      });
    }

    const run = typeof target === "string" ? target : target.run;
    const commandTemplates = typeof run !== "string"
      ? run
      : run.includes("\n")
        ? run.split(/\r?\n/).map((command) => command.trim()).filter(Boolean)
        : [run];

    for (const commandTemplate of commandTemplates) {
      const command = yield* interpolateCommand(
        commandTemplate,
        targetName,
        target,
        env,
        cliArguments,
      );

      yield* Effect.sync(() => {
        console.log(`\n$ ${command}`);
      });

      yield* runCommand(command, env);
    }
  });
