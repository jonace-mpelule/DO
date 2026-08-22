import { readFile } from "node:fs/promises";
import { YAML } from "bun";
import { Effect, Schema } from "effect";
import { DoSchema } from "./do-type";
import { DoValidationError, EnvParseError, FileReadError, YamlParseError } from "./errors";


const readTextFile = (path: string) =>
  Effect.tryPromise({
    try: () => readFile(path, "utf-8"),
    catch: (cause) => new FileReadError({ path, cause }),
  });

// YAML folds an indented scalar after `run:` into one space-separated string.
// Treat that convenient DO-file syntax as a literal block so each source line
// remains an individual command. Standard `run: |` and YAML lists are left as-is.
const preserveImplicitRunLines = (text: string) => {
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const match = /^(\s*)run:\s*(#.*)?$/.exec(line);

    if (!match) {
      continue;
    }

    const indentation = match[1]!.length;
    const next = lines
      .slice(index + 1)
      .find((candidate) => candidate.trim() && !candidate.trimStart().startsWith("#"));

    if (
      next &&
      next.length - next.trimStart().length > indentation &&
      !next.trimStart().startsWith("-")
    ) {
      lines[index] = `${match[1]}run: |${match[2] ? ` ${match[2]}` : ""}`;
    }
  }

  return lines.join("\n");
};

export const ParseDoFile = (path: string) =>
  Effect.gen(function* () {
    const text = yield* readTextFile(path);

    const yaml = yield* Effect.try({
      try: () => YAML.parse(preserveImplicitRunLines(text)),
      catch: (cause) => new YamlParseError({path, cause}),
    });

    return yield* Schema.decodeUnknown(DoSchema)(yaml).pipe(
      Effect.mapError((cause) => new DoValidationError({path, cause}))
    )
  });

const stripComment = (line: string) => {
  let quote: "'" | '"' | undefined
  let escaped = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === "\\" && quote === '"') {
      escaped = true
      continue
    }

    if (char === "'" || char === '"') {
      if (quote === char) {
        quote = undefined
      } else if (!quote) {
        quote = char
      }

      continue
    }

    if (char === "#" && !quote) {
      return line.slice(0, i)
    }
  }

  return line
}

const parseValue = (value: string) => {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

export const ParseEnvFile = (path: string) =>
  Effect.gen(function* () {
    const text = yield* readTextFile(path)
    const env: Record<string, string> = {}
    const lines = text.split(/\r?\n/)

    for (let index = 0; index < lines.length; index++) {
      // biome-ignore lint/style/noNonNullAssertion: <"">
      const original = lines[index]!
      let line = stripComment(original).trim()

      if (!line) {
        continue
      }

      // Also allow dotenv-style:
      // export FOO=bar
      if (line.startsWith("export ")) {
        line = line.slice("export ".length).trimStart()
      }

      const equals = line.indexOf("=")

      if (equals <= 0) {
        return yield* Effect.fail(
          new EnvParseError({
            path,
            line: index + 1,
            source: original,
            message: "Expected KEY=value",
          }),
        )
      }

      const key = line.slice(0, equals).trim()

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        return yield* Effect.fail(
          new EnvParseError({
            path,
            line: index + 1,
            source: original,
            message: `Invalid environment variable name "${key}"`,
          }),
        )
      }

      const value = parseValue(line.slice(equals + 1))
      env[key] = value
    }

    return env
  })

export const ParseEnvFiles = (paths: string | ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const files = typeof paths === "string" ? [paths] : paths;
    const env: Record<string, string> = {};

    for (const path of files) {
      Object.assign(env, yield* ParseEnvFile(path));
    }

    return env;
  });
