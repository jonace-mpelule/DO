import { spawn } from "node:child_process";
import { Effect } from "effect";
import { CommandFailedError, CommandStartError } from "./errors";

export type Environment = Readonly<Record<string, string>>;

export const runCommand = (command: string, envs: Environment) =>
  Effect.async<void, CommandStartError | CommandFailedError>((resume) => {
    let settled = false;

    const complete = (
      effect: Effect.Effect<void, CommandStartError | CommandFailedError>,
    ) => {
      if (settled) {
        return;
      }
      settled = true;
      resume(effect);
    };

    let child: ReturnType<typeof spawn>;

    try {
      child = spawn(command, {
        shell: true,
        stdio: "inherit",
        env: {
          ...process.env,
          ...envs,
        },
      });
    } catch (cause) {
      complete(
        Effect.fail(
          new CommandStartError({
            command,
            cause,
          }),
        ),
      );

      return;
    }

    child.once("error", (cause) => {
      complete(
        Effect.fail(
          new CommandStartError({
            command,
            cause,
          }),
        ),
      );
    });

    child.once("close", (exitCode, signal) => {
      if (exitCode === 0) {
        complete(Effect.succeed(undefined));
        return;
      }

      complete(
        Effect.fail(
          new CommandFailedError({
            command,
            exitCode,
            signal,
          }),
        ),
      );
    });

    return Effect.sync(() => {
      if (!settled && !child.killed) {
        child.kill("SIGTERM");
      }
    });
  });
