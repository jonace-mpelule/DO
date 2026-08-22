import { Schema } from "effect";

export const ArgumentSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  default: Schema.optional(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
  ),
  required: Schema.optional(Schema.Boolean),
});

export const ArgumentsSchema = Schema.Union(
  Schema.Array(Schema.String),
  Schema.Record({
    key: Schema.String,
    value: Schema.Union(
      Schema.String,
      Schema.Number,
      Schema.Boolean,
      ArgumentSchema,
    ),
  }),
);

export const CommandsSchema = Schema.Union(
  Schema.String,
  Schema.Array(Schema.String),
);

export const TaskSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  needs: Schema.optional(Schema.String),
  args: Schema.optional(ArgumentsSchema),
  run: CommandsSchema,
});

export const EnvSchema = Schema.Struct({
  file: Schema.Union(Schema.String, Schema.Array(Schema.String)),
});

export const DoSchema = Schema.Struct({
  env: Schema.optional(EnvSchema),
  tasks: Schema.Record({
    key: Schema.String,
    value: Schema.Union(
      Schema.String,
      TaskSchema,
    ),
  }),
});

export type Task = Schema.Schema.Type<typeof TaskSchema>;
export type Argument = Schema.Schema.Type<typeof ArgumentSchema>;
export type Arguments = Schema.Schema.Type<typeof ArgumentsSchema>;
export type Commands = Schema.Schema.Type<typeof CommandsSchema>;
export type DoFile = Schema.Schema.Type<typeof DoSchema>;
