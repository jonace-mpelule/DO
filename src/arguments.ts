import { Effect } from "effect";
import type { Arguments, DoFile, Task } from "./do-type";
import {
  InvalidArgumentError,
  MissingArgumentError,
  UnknownArgumentError,
  UnresolvedVariableError,
} from "./errors";
import type { Environment } from "./runner";

const argumentName = /^[A-Za-z_][A-Za-z0-9_]*$/;

type ArgumentDefinition = {
  readonly defaultValue?: string;
  readonly required: boolean;
};

const normalizeArguments = (
  args: Arguments | undefined,
): Readonly<Record<string, ArgumentDefinition>> => {
  if (!args) {
    return {};
  }

  if (Array.isArray(args)) {
    return Object.fromEntries(
      args.map((name) => [name, { required: true }]),
    );
  }

  return Object.fromEntries(
    Object.entries(args).map(([name, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [
          name,
          { defaultValue: String(value), required: false },
        ];
      }

      return [
        name,
        {
          defaultValue:
            value.default === undefined ? undefined : String(value.default),
          required: value.required ?? value.default === undefined,
        },
      ];
    }),
  );
};

const taskArguments = (task: string | Task | undefined) =>
  typeof task === "string" || !task
    ? {}
    : normalizeArguments(task.args);

export const collectArgumentNames = (
  doFile: DoFile,
  targetName: string,
): ReadonlySet<string> => {
  const names = new Set<string>();
  const visited = new Set<string>();

  const visit = (name: string) => {
    if (visited.has(name)) {
      return;
    }
    visited.add(name);

    const task = doFile.tasks[name];
    for (const argument of Object.keys(taskArguments(task))) {
      names.add(argument);
    }

    if (typeof task !== "string" && task?.needs) {
      visit(task.needs);
    }
  };

  visit(targetName);
  return names;
};

export const parseCliArguments = (
  tokens: ReadonlyArray<string>,
): Effect.Effect<Environment, InvalidArgumentError> =>
  Effect.gen(function* () {
    const values: Record<string, string> = {};

    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]!;

      if (!token.startsWith("--") || token === "--") {
        return yield* Effect.fail(
          new InvalidArgumentError({
            argument: token,
            message: "Expected an argument in the form --name value or --name=value",
          }),
        );
      }

      const equals = token.indexOf("=");
      const name = token.slice(2, equals === -1 ? undefined : equals);

      if (!argumentName.test(name)) {
        return yield* Effect.fail(
          new InvalidArgumentError({
            argument: token,
            message: "Invalid argument name",
          }),
        );
      }

      if (equals !== -1) {
        values[name] = token.slice(equals + 1);
        continue;
      }

      const value = tokens[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return yield* Effect.fail(
          new InvalidArgumentError({
            argument: token,
            message: "Missing value for argument",
          }),
        );
      }

      values[name] = value;
      index++;
    }

    return values;
  });

export const validateCliArguments = (
  doFile: DoFile,
  targetName: string,
  cliArguments: Environment,
): Effect.Effect<void, UnknownArgumentError> => {
  const declared = collectArgumentNames(doFile, targetName);

  for (const name of Object.keys(cliArguments)) {
    if (!declared.has(name)) {
      return Effect.fail(
        new UnknownArgumentError({ target: targetName, argument: name }),
      );
    }
  }

  return Effect.void;
};

export const interpolateCommand = (
  command: string,
  targetName: string,
  task: string | Task,
  env: Environment,
  cliArguments: Environment,
): Effect.Effect<
  string,
  MissingArgumentError | UnresolvedVariableError
> =>
  Effect.gen(function* () {
    const definitions = taskArguments(task);
    const values: Record<string, string> = {};

    for (const [name, definition] of Object.entries(definitions)) {
      const value =
        cliArguments[name] ?? env[name] ?? definition.defaultValue;

      if (value === undefined && definition.required) {
        return yield* Effect.fail(
          new MissingArgumentError({ target: targetName, argument: name }),
        );
      }

      if (value !== undefined) {
        values[name] = value;
      }
    }

    for (const [name, value] of Object.entries(env)) {
      values[name] ??= value;
    }
    for (const [name, value] of Object.entries(cliArguments)) {
      values[name] = value;
    }

    let unresolved: string | undefined;
    const interpolated = command.replace(/\$\{([^}]*)\}/g, (_, name: string) => {
      if (!argumentName.test(name) || values[name] === undefined) {
        unresolved ??= name;
        return `\${${name}}`;
      }
      return values[name];
    });

    if (unresolved !== undefined) {
      return yield* Effect.fail(
        new UnresolvedVariableError({
          target: targetName,
          variable: unresolved,
        }),
      );
    }

    return interpolated;
  });
