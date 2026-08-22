/** biome-ignore-all lint/complexity/noBannedTypes: <"explanation"> */
import { Data } from "effect";

export class FileReadError extends Data.TaggedError("FileReaderError")<{
  path: string;
  cause: unknown;
}> {}

export class YamlParseError extends Data.TaggedError("YamlParserError")<{
  path: string;
  cause: unknown;
}> {}

export class DoValidationError extends Data.TaggedError("DoValidationError")<{
  path: string;
  cause: unknown;
}> {}

export class EnvParseError extends Data.TaggedError("EnvParseError")<{
  path: string;
  line: number;
  source: string;
  message: string;
}> {}

export class MissingTargetError extends Data.TaggedError(
  "MissingTargetError",
)<{}> {}

export class InvalidArgumentError extends Data.TaggedError(
  "InvalidArgumentError",
)<{
  argument: string;
  message: string;
}> {}

export class UnknownArgumentError extends Data.TaggedError(
  "UnknownArgumentError",
)<{
  target: string;
  argument: string;
}> {}

export class MissingArgumentError extends Data.TaggedError(
  "MissingArgumentError",
)<{
  target: string;
  argument: string;
}> {}

export class UnresolvedVariableError extends Data.TaggedError(
  "UnresolvedVariableError",
)<{
  target: string;
  variable: string;
}> {}

export class TargetNotFoundError extends Data.TaggedError(
  "TargetNotFoundError",
)<{
  target: string;
}> {}

export class MissingDependencyError extends Data.TaggedError(
  "MissingDependencyError",
)<{
  target: string;
  dependency: string;
}> {}

export class DependencyCycleError extends Data.TaggedError(
  "DependencyCycleError",
)<{
  targets: ReadonlyArray<string>;
}> {}

export class CommandStartError extends Data.TaggedError("CommandStartError")<{
  command: string;
  cause: unknown;
}> {}

export class CommandFailedError extends Data.TaggedError("CommandFailedError")<{
  command: string;
  exitCode: number | null;
  signal: string | null;
}> {}


export const formatError = (error: unknown): string => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("_tag" in error)
  ) {
    return String(error)
  }

  switch (error._tag) {
    case "MissingTargetError":
      return "No target specified"

    case "InvalidArgumentError": {
      const e = error as InvalidArgumentError
      return `${e.message}: ${e.argument}`
    }

    case "UnknownArgumentError": {
      const e = error as UnknownArgumentError
      return `Target "${e.target}" does not declare argument "--${e.argument}"`
    }

    case "MissingArgumentError": {
      const e = error as MissingArgumentError
      return `Target "${e.target}" requires argument "--${e.argument}"`
    }

    case "UnresolvedVariableError": {
      const e = error as UnresolvedVariableError
      return `Target "${e.target}" cannot resolve variable "${e.variable}"`
    }

    case "TargetNotFoundError": {
      const e = error as TargetNotFoundError
      return `Target "${e.target}" does not exist`
    }

    case "MissingDependencyError": {
      const e = error as MissingDependencyError

      return (
        `Target "${e.target}" requires ` +
        `"${e.dependency}", but that target does not exist`
      )
    }

    case "DependencyCycleError": {
      const e = error as DependencyCycleError

      return (
        "Circular target dependency: " +
        e.targets.join(" -> ")
      )
    }

    case "CommandFailedError": {
      const e = error as CommandFailedError

      return (
        `Command failed with exit code ` +
        `${e.exitCode ?? "unknown"}:\n` +
        `  ${e.command}`
      )
    }

    case "CommandStartError": {
      const e = error as CommandStartError
      return `Could not start command:\n  ${e.command}`
    }

    case "FileReadError":
      return `Could not read file`

    case "YamlParseError":
      return `Invalid YAML in DO file`

    case "DoValidationError":
      return `Invalid DO file structure`

    case "EnvParseError": {
      const e = error as EnvParseError

      return (
        `${e.path}:${e.line}: ${e.message}\n` +
        `  ${e.source}`
      )
    }

    default:
      return String(error)
  }
}
