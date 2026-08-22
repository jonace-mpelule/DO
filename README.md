# do

`do` is a small YAML task runner for commands you use repeatedly in a project. A
`DO` file can contain simple commands, documented tasks, task dependencies,
declared arguments, and variables loaded from a dotenv-style file.

## Install

`do-file` is the npm package name; `do` is the command it installs. Bun is
required to run it.

```bash
npm install --global do-file
```

You can also install it globally with Bun:

```bash
bun install --global do-file
```

Confirm the command is available:

```bash
do --help
```

> Until the first npm release is published, run `bun run build` and then
> `npm install --global .` from the repository root.

Run a task from the directory containing your `DO` file with
`do <task> [arguments]`.

## Development

Install dependencies and run the source version:

```bash
bun install
bun run src/index.ts <task> [arguments]
```

Create the publishable executable with `bun run build`. `npm pack` and
`npm publish` build it automatically, while the publish lifecycle also runs the
type-check and tests.

## Publish to npm

The package is published as `do-file`, but its `bin` mapping installs the command
as `do`. The npm package name and executable name do not need to match.

```bash
npm login
npm publish
```

Package names are first-come, first-served. Verify `do-file` again immediately
before the first publish. For later releases, change the version first, for
example with `npm version patch`, and publish the new version.

If another globally installed package already provides a `do` executable, the
package names can coexist but their global command aliases will conflict.

## Quick start

Create a file named `DO` in the project root:

```yaml
env:
  file: .env.do

tasks:
  install: bun install

  dev:
    description: Start the development server
    needs: install
    args:
      name:
        description: Name shown by the development server
        default: developer
      port:
        description: Port to listen on
        required: true
    run: echo "Starting ${name} on ${HOST}:${port}"
```

Create the explicitly loaded environment file:

```dotenv
HOST=127.0.0.1
port=3000
```

Then run:

```bash
do dev --name Ada
do dev --name="Ada Lovelace" --port=4000
```

The first command uses `port=3000` from `.env.do`. The second command overrides
it with the inline value `4000`.

## Tasks

A task can be a command string:

```yaml
tasks:
  test: bun test
```

Or it can use the expanded form:

```yaml
tasks:
  check:
    description: Run all checks
    needs: generate
    run: bun test
```

`needs` names another task that must finish successfully first. Dependency
cycles and missing dependencies are reported as errors.

## Arguments and variables

Declare required arguments as a list:

```yaml
tasks:
  greet:
    args: [name]
    run: echo "Hello ${name}"
```

```bash
do greet --name Ada
```

Use a mapping to provide defaults or argument metadata:

```yaml
tasks:
  serve:
    args:
      host: localhost
      port:
        description: HTTP port
        default: 3000
      token:
        description: API token
        required: true
    run: server --host "${host}" --port "${port}" --token "${token}"
```

Both CLI forms are accepted:

```bash
do serve --token secret
do serve --token=secret --port=8080
```

Arguments declared by a task dependency are also accepted when running the
parent task. Unknown arguments and arguments without values are rejected, which
helps catch typos.

Variable values use this precedence, from highest to lowest:

1. Inline CLI argument (`--name value` or `--name=value`)
2. Variable from the configured env file
3. Default declared under `args`

Every `${name}` placeholder must resolve. Interpolation intentionally does not
read the runner's global process environment. Only inline arguments, the env
file selected by `env.file`, and defaults in the `DO` file are interpolation
sources.

Values are inserted into the command before it is passed to the shell. Quote
placeholders when they may contain spaces, and treat values supplied to tasks as
trusted shell input.

## Environment files

Environment loading is opt-in and local to the `DO` file:

```yaml
env:
  file: .env.do
```

The file accepts `KEY=value`, comments, quoted values, and optional dotenv-style
`export` prefixes:

```dotenv
# Used by DO tasks
API_URL=https://api.example.com
APP_NAME="Example App"
export LOG_LEVEL=debug
```

Loaded values are available both to `${KEY}` interpolation and to the child
command's environment. The runner does not automatically load `.env`; name the
file explicitly in `env.file`.

## Complete example

```yaml
env:
  file: .env.do

tasks:
  generate: bun run generate

  dev:
    description: Generate code, then start the app
    needs: generate
    args:
      app: web
      port:
        required: true
    run: bun run dev --app "${app}" --port "${port}" --api "${API_URL}"

  deploy:
    args: [environment]
    run: ./scripts/deploy.sh "${environment}"
```

```bash
do dev --port 3000
do deploy --environment production
```
