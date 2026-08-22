#!/usr/bin/env bun

import { argv } from "bun";
import { Effect } from "effect";
import packageJson from "../package.json";
import { parseCliArguments, validateCliArguments } from "./arguments";
import { formatError, MissingTargetError } from "./errors";
import { ParseDoFile, ParseEnvFiles } from "./parsers";
import { runTarget } from "./target";

export const Runner = () =>
  Effect.gen(function* () {
    const targetName = argv[2];

    if (targetName === "--version" || targetName === "-v") {
      yield* Effect.sync(() => console.log(packageJson.version));
      return;
    }

    if (targetName === "--help" || targetName === "-h") {
      yield* Effect.sync(() => {
        console.log(`dof ${packageJson.version}

Usage:
  dof <task> [--argument value | --argument=value]
  do-file <task> [--argument value | --argument=value]

The command reads tasks from a DO file in the current directory.`);
      });
      return;
    }

    if (!targetName) {
      return yield* Effect.fail(new MissingTargetError());
    }

    const doFile = yield* ParseDoFile("./DO");

    const cliArguments = yield* parseCliArguments(argv.slice(3));
    yield* validateCliArguments(doFile, targetName, cliArguments);

    const env = doFile.env ? yield* ParseEnvFiles(doFile.env.file) : {};

    yield* runTarget(doFile, targetName, env, cliArguments);
  });

const program = Runner().pipe(
  Effect.catchAll((error) =>
    Effect.sync(() => {
      console.error(`\nerror: ${formatError(error)}`);
      process.exitCode = 1;
    }),
  ),
);

void Effect.runPromise(program);
