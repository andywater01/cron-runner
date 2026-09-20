# Running CronRunner from source

For contributing, or if you would rather build it yourself than download a binary.

## Requirements

[Bun](https://bun.sh) 1.3 or newer. That is the only prerequisite: Bun is the runtime, the
package manager, the bundler and the test runner. There is no separate Node install, and no
database to set up, since jobs live in a SQLite file that Bun ships with.

## Getting started

```bash
git clone https://github.com/andywater01/cron-runner.git
cd cron-runner
bun install
```

Development runs as two processes. Start each in its own terminal:

```bash
bun run dev:server   # API and scheduler on http://127.0.0.1:4747
bun run dev:web      # UI on http://localhost:5173, proxying /api to the server
```

Open <http://localhost:5173>. The server restarts on save, and the UI hot-reloads.

Set `CRONRUNNER_DATA_DIR=./.cronrunner` to keep development jobs out of your real data
directory:

```bash
CRONRUNNER_DATA_DIR=./.cronrunner bun run dev:server
```

## Checks

```bash
bun run typecheck    # every package, strict
bun test             # 57 tests
bun run lint         # Biome
bun run format       # Biome, writes
```

The test suite points itself at a temporary data directory, so it can never touch your real
jobs, settings or API key.

## Building

```bash
bun run build        # web UI into apps/server/public
bun run compile      # single self-contained binary, apps/server/dist/cronrunner
bun run package      # the full downloadable apps for every platform
bun run icons        # regenerate icons from assets/icon/icon.svg (macOS only)
```

`compile` embeds the whole web UI inside the executable, so the binary runs from anywhere with
nothing beside it. Note that `compile` rewrites `apps/server/src/embedded.gen.ts`; that file is
a build artifact, and the committed copy is an empty placeholder. Restore it before committing:

```bash
git checkout apps/server/src/embedded.gen.ts
```

`package` produces the real downloads: `.dmg` files for macOS, a `.exe` for Windows and a
`.tar.gz` for Linux, each stamped with the version from the root `package.json`. Artifacts for
other platforms can be built from any machine, but they come out plain, because a `.dmg` needs
`hdiutil` and Bun only applies the Windows icon and console settings when compiling on Windows.
The published downloads are built per platform by `.github/workflows/release.yml`.

## Cutting a release

Bump `version` in the root `package.json`, commit, then tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The release workflow builds each platform on its own runner, runs the checks, generates
checksums and publishes a GitHub Release with every file attached.

## Layout

```
packages/shared      zod schemas shared by the server and the UI, the single source of truth
apps/server          Bun daemon: Hono API, croner scheduler, SQLite, LLM providers
apps/web             React 19 + Vite + Tailwind 4 interface
assets/icon          app icon, and the generated .icns / .ico / .png
docs                 PRD, architecture, design system, API and the build plan
```

`docs/ARCHITECTURE.md` explains how the pieces fit together, including the security model and
how packaging works. `docs/PLAN.md` records how the app was built and what each phase verified.
