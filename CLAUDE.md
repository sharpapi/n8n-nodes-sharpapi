# SharpAPI n8n community nodes

A monorepo of three npm packages, one regular node each, all using one
credential, `sharpApiApi` ("SharpAPI API"):

| Directory | Package | Node |
| --- | --- | --- |
| `packages/invoice-parser` | `@sharpapi/n8n-nodes-invoice-parser` | `sharpApiInvoiceParser` |
| `packages/resume-job-match-score` | `@sharpapi/n8n-nodes-resume-job-match-score` | `sharpApiResumeJobMatchScore` |
| `packages/resume-parser` | `@sharpapi/n8n-nodes-resume-parser` | `sharpApiResumeParser` |

The root is private (npm workspaces) and is never published. From each
package only `dist/`, `package.json`, `README.md`, `CHANGELOG.md`,
`LICENSE.md` and `index.js` reach npm (`files: ["dist"]`); tests and examples
stay at the root.

---

## Where things stand — 2026-11-16

**Why three packages.** n8n's manual review of `@sharpapi/n8n-nodes-sharpapi`
(1.0.4, all three nodes in one package) failed with "[HIGH] Multiple regular
nodes in a single package": n8n allows one regular node per package, plus a
trigger. The reviewer suggested one node with resources and operations; we
split into one package per node instead. Precedent: alephant
(`@alephantai/n8n-nodes-alephant-ai` / `-analytics`) and Mallabe split one
vendor across verified packages.

`@sharpapi/n8n-nodes-sharpapi` (1.0.4, `latest`) stays on npm and is **not**
deprecated, by decision. Its history is the root `CHANGELOG.md`. The unscoped
`n8n-nodes-sharpapi@1.0.1` also still exists.

The three new packages are at 1.0.0 in `package.json`, unpublished.

| Gate | State |
| --- | --- |
| `npm run typecheck` | pass, all three |
| `npm test` | 93 passing, ~2.5s, no network |
| `npm run lint` | **0 errors, 0 warnings**, all three |
| `npm run build` | pass, all three |
| `npm pack --dry-run` | 13 files, ~36 kB unpacked each (plus README, CHANGELOG once committed) |

**One credential across three packages, verified on n8n 2.45.7** with all
three tarballs installed in `~/.n8n/nodes` as a real community install: each
package loads; `/types/credentials.json` lists `sharpApiApi` three times, but
the editor keys credential types by name, so the user sees one; a single saved
credential saves in a workflow with all three nodes, and a CLI execution ran
all three end to end against a local fake SharpAPI with the key sent to
SharpAPI and not to the file download. n8n keeps the *last-loaded* package's
`supportedNodes` for the credential, which only matters to credentials with
`restrictToSupportedNodes` (ours has none) or without a `test` (ours has one).

### Next

1. Commit, push, then first publish of each package: push the tags
   `invoice-parser-v1.0.0`, `resume-job-match-score-v1.0.0`,
   `resume-parser-v1.0.0` by hand (no `npm run release`, which would bump past
   1.0.0). `publish.yml` publishes the version in `package.json`, and needs
   the `NPM_TOKEN` secret for these, as new packages.
2. Configure a trusted publisher on each of the three packages, then delete
   the secret; see *Releasing*.
3. Answer the reviewer and submit the three packages in the n8n portal.
4. Record the verification video against the published versions: install from
   npm, credential test, the main actions, and one node as an AI Agent tool
   with a File URL.

### Open n8n UX guideline items

Not hard requirements, but likely review comments.

- "Simplify Output" strips the job envelope but keeps every field. The UX
  guidelines reserve "Simplify" for at most 10 fields, and want an Output
  option (Simplified / Raw / Selected fields) on AI tool nodes with more.
- Error messages should say what happened and how to fix it, without "fail"
  and friends: `The SharpAPI job failed`, and the `did not say where to collect
  the result` description, which is a raw JSON dump.

### Known, not blocking

- Nothing is known about behaviour on large or low-quality scans. Everything
  tested was a single-page text-layer PDF finishing in under 30 seconds.

## Ground rules

**Zero runtime dependencies.** `n8n-workflow` is a peer dependency, present in
`devDependencies` only for building. Test dependencies are dev-only and never
ship, because `files` is `dist` alone.

**Node code must not touch environment variables or the file system.** n8n
verification forbids it, and its lint rules allow imports of `n8n-workflow` and
little else under `nodes/` and `credentials/`. Tests may.

**Everything user-facing stays in English** — parameter labels, descriptions,
error messages, README.

**Secrets never reach git.** `.env` is gitignored. Never echo an API key into a
terminal, a log or a commit.

**Nothing leaves this machine without being asked for.** No `npm publish`, no
`gh repo create`, no push.

## Workflow

At the root, every script fans out to all three packages:

```bash
npm run setup       # npm install --ignore-scripts, see below
npm run sync        # copy shared/ and LICENSE.md into every package
npm run typecheck   # tsc --noEmit, per package
npm test            # vitest over all packages, ~2.5s, no network
npm run lint        # n8n-node lint, per package, must stay completely empty
npm run build       # n8n-node build, then copy-codex.mjs, per package
```

Inside `packages/<dir>/`, `npm run dev` (Node 24) starts a local n8n with that
package linked, and `npm run release` releases it.

## Layout

```
shared/                    the ONLY place to edit shared files; `npm run sync` copies it into each package
  nodes/shared/            GenericFunctions, Languages, Config
  credentials/             the one credential and its brand icon pair
  copy-codex.mjs           build step, see below
  eslint.config.mjs  tsconfig.json  index.js
packages/<dir>/            one publishable package
  nodes/<NodeClass>/       its node: .node.ts, .node.json codex, icon pair
  nodes/shared/ credentials/ copy-codex.mjs ...   committed copies from shared/
  package.json .release-it.json .auto-changelog README.md CHANGELOG.md
scripts/sync-shared.mjs    the copy step
.github/workflows/         ci.yml; publish.yml, tag-triggered, routes by tag prefix
tests/                     vitest suite for all packages, .mts on purpose, see below
examples/<dir>.json        one workflow per package, linked from its README
CHANGELOG.md               history of @sharpapi/n8n-nodes-sharpapi, before the split
```

**Why copies, not a shared package or symlinks.** A shared package would be a
runtime dependency, which verification forbids. Symlinks break Windows
checkouts and look odd to reviewers browsing GitHub. With committed copies each
package directory is a complete, standalone n8n package, which is what
`n8n-node lint` in strict mode and `no-credential-reuse` expect. The invariants
test fails when a copy differs from `shared/`, and CI runs `npm run sync` and
then `git diff --exit-code`.

## Icons

**Format.** SVG or PNG. `IconFile` in n8n-workflow is
`` `file:${string}.svg` `` or `` `file:${string}.png` ``. Use SVG; every n8n
scaffold and every first-party node does.

**Size.** No enforced dimensions — the lint rules check existence and the
`file:` protocol, nothing else. What matters is a **square `viewBox`**, because
n8n scales the icon into a square slot and a non-square canvas is the usual
cause of a distorted icon. n8n's own scaffolds use `viewBox="0 0 24 24"` and
`"0 0 40 40"`; the placeholder is `0 0 60 60`. Any square value is fine. A test
asserts squareness on every SVG beside a node or the credential.

**Placement.** Replace the placeholder files in place. An icon path resolves
relative to the file declaring it, so each pair sits beside its declaration:

```
packages/resume-parser/nodes/SharpApiResumeParser/resume-parser.svg       light theme
packages/resume-parser/nodes/SharpApiResumeParser/resume-parser.dark.svg  dark theme
packages/invoice-parser/nodes/SharpApiInvoiceParser/invoice-parser.svg / .dark.svg
packages/resume-job-match-score/nodes/SharpApiResumeJobMatchScore/resume-job-match-score.svg / .dark.svg
shared/credentials/sharpapi.svg / .dark.svg                               the SharpAPI brand
```

The credential belongs to the service, not to a node, hence the brand icon.

**The artwork.** Node icons are line glyphs on a transparent background:
document with a person, a receipt, and the document with a check badge. Ink is
`#1E293B` (light) / `#E2E8F0` (dark); the accent is the SharpAPI brand blue,
`#0080FF` (light) / `#4DA6FF` (dark). The credential icon is the SharpAPI logo,
the `#API` frame from the platform's `public/logo.svg`, rebuilt as pure paths:
that file sets the text live in Nunito, which n8n would not have, so the
letters were converted to outlines from Nunito Regular (OFL, Google Fonts) at
the exact size and position in `logo.svg`. It is padded like the platform's
`logo600-square-transparent.png`.

**Which variant is which.** `light` is the icon used in the **light** theme, so
it wants darker ink; `dark` is for the dark theme and wants lighter ink. n8n's
own example makes this explicit: light uses `stroke="darkblue"`, dark uses
`stroke="aquamarine"`.

**The two files must genuinely differ.** `icon-validation` raises
`lightDarkSame` if `light` and `dark` resolve to the same path.

**Do not go back to a single icon file.** It only warns rather than errors, but
a themed pair is what makes lint output completely empty, and empty lint is
worth keeping for the verification review.

`n8n-node build` copies `**/*.{png,svg}` into `dist`, so both variants ship with
no extra step.

## Things that will trip you up

**Install with `--ignore-scripts`, locally and in CI.** `n8n-workflow` pulls
`isolated-vm` 6.1.2 through `@n8n/expression-runtime`. It ships prebuilds for
Node 22 and 24 only, and its source build fails against Node 26's V8 headers
(reproduced in Docker). Node 26 is the current LTS, so `lts/*` in the
workflows picks it, and a plain `npm ci` dies on its first step. Nothing here
evaluates n8n expressions, so skipping the build is safe. `npm run setup`
does this locally; both workflows run `npm ci --ignore-scripts`.

**Lint fails falsely in a directory just below `/`.** The `no-credential-reuse`
rule finds `package.json` by walking up from the node file, and its loop stops
before checking a directory directly under the root. In `/w` it never reads
`/w/package.json` and reports `sharpApiApi` as another package's credential.
GitHub's `/home/runner/work/<repo>/<repo>` and any normal checkout are deep
enough; use a deep path for Docker rehearsals.

**Installs are slow, and must not be interrupted or parallelised.** `@n8n/node-cli`
pulls roughly 700 MB. Killing an install mid-flight leaves `node_modules/.bin`
unlinked, so `npm run lint` fails with `n8n-node: command not found` even
though everything looks installed. The next install layers on top and silently
omits packages. Check `ls node_modules/.bin | wc -l` (50 when complete) before
believing an install worked. Everything hoists to the root `node_modules`;
packages have none of their own.

**`npm run dev` needs Node 24.** It runs `npx n8n@latest`, which refuses Node
22 (`.nvmrc` says 24, so `nvm use`). If n8n then crashes with `Could not
initialize the vm expression engine`, the npx cache holds an `isolated-vm`
compiled for another Node version: its `build/` wins over the bundled prebuilds.
Delete the stale `~/.npm/_npx/<hash>/node_modules/isolated-vm/build`, or the
whole `<hash>` directory, and rerun.

**Do not put comments in `eslint.config.mjs`.** `"strict": true` in the `n8n`
block requires it byte identical to the default, and `n8n-node lint` refuses to
run otherwise. Explanations belong in this file.

**Tests are `.mts`, and must stay that way.** `n8n-node lint` runs `eslint .`,
and the config applies n8n's community node rules to every `**/*.ts` in the
repo. A `.ts` test importing `vitest` or `node:fs` fails lint, and the config
cannot be changed under strict mode. The config does not match `.mts`, so ESLint
skips the tests while they keep their types.

**The codex file has to be copied into `dist` by hand.** `n8n-node build`
copies only `**/*.{png,svg}` and `**/__schema__/**/*.json`, so `copy-codex.mjs`
runs after it. Without that, a node is unfindable by anything except the words
in its display name. The `codex` field on the node description is **not** a
substitute: the type accepts it and n8n ignores it. Verified on 2.32.6, where a
term present only in an inline alias returned nothing.

**Shared runtime code lives in `shared/nodes/shared/`**, and each package has a
copy at `nodes/shared/`. Every other directory under a package's `nodes/` is
its node; `copy-codex.mjs` and the invariants test both rely on that. Each node
declares its own `ENDPOINT`. Editing a package's copy instead of `shared/` is
undone by the next `npm run sync` and fails the tests until then.

**All three packages define the same credential, `sharpApiApi`, on purpose.**
It lets one saved key serve every SharpAPI node; see *Where things stand* for
what was verified. Keep the credential identical everywhere (sync guarantees
it), and never give it `restrictToSupportedNodes`: n8n keeps only the
last-loaded package's `supportedNodes`, so the restriction would lock out the
other two nodes.

**Keep collection options alphabetical by display name.** n8n's lint rule
requires it.

**Do not turn `declaration` or `incremental` back on.** `*.credentials.d.ts`
fails the community package scan's filename rule, and the incremental cache
either ships as 211 kB of dead weight or, if relocated outside `dist`, survives
`rm -rf dist` and makes the next build emit nothing at all.

**Example workflows use the published node type,** `@sharpapi/n8n-nodes-<dir>.<nodeName>`.
A node loaded from a custom extensions directory registers as
`CUSTOM.<nodeName>` instead, so an example built in a local n8n needs its type
rewritten before it is committed. The Read file step points at a placeholder
path, `/path/to/<document>.pdf`.

**AI Agent tools never see binary data.** n8n starts a tool node with an item
holding only the arguments the model chose (`{json: {}}` when it chose none),
not the trigger's item, so `assertBinaryData` fails even when the chat upload
sits right there on the Chat Trigger as `data0`. Verified on n8n 2.45 with Agent
3.1. That is why every node has the File URL input type, which is how a tool
gets its file. The download uses `httpRequest`, never the authenticated
helper, so the SharpAPI key is not sent to the file's host; a test pins that.
`examples/sample-invoice.pdf` is a fictional invoice, served from GitHub raw
for tool demos. Nothing but workflow JSON in `examples/` counts as an example.

**Do not poll the `status_url` the API advertises.** It is the 5-segment generic
URL, and segment count is what decides whether `result` comes back decoded — at
5 it does not, you get an escaped JSON string. The nodes build
`{baseUrl}{endpoint}/job/status/{job_id}` instead, which is 7 segments and
returns real objects and arrays. `/job/result/{uuid}` is a decoy: it returns a
string for non-marketplace keys and 404s until the job succeeds, so it cannot
drive a polling loop.

`GenericFunctions.parseResult` still exists as a safety net for the one path
that can still yield a string: the fallback that follows `status_url` when no
`job_id` comes back.

## Releasing

Publishing runs from GitHub Actions, never from a laptop: `n8n-node release`
only sets `NPM_CONFIG_PROVENANCE` when it detects CI, and n8n has required
provenance for community nodes since 2026-05-01.

```bash
# on main, clean tree
cd packages/resume-parser
npm run release      # lints, builds, bumps, changelogs, commits, tags, pushes
```

**Each package releases on its own, routed by tag prefix.** `.release-it.json`
in each package sets `git.tagName` to `<dir>-v${version}` (and `tagMatch`, so
`requireCommits` and the bump only look at that package's tags). `n8n-node
release` passes no tag name on the command line, so the file wins.
`publish.yml` triggers on `*-v*.*.*`, strips the suffix to find
`packages/<dir>`, checks the tag matches that `package.json` version, and runs
`npm run release` there, which in CI is lint, build, `npm publish` with
provenance. The old bare tags (`1.0.0` … `1.0.4`) belong to
`@sharpapi/n8n-nodes-sharpapi` and no longer trigger anything.

**The local release asks questions.** release-it's `-n` here is not
non-interactive, so expect prompts. Rehearsed in a scratch clone with a bare
remote: the version bump touches only the package's `package.json` (the root
lockfile stays valid for `npm ci`), and `CHANGELOG.md` is committed with it
because it is already tracked. release-it stages with `git add . --update`,
which skips untracked files, so never delete a package's `CHANGELOG.md`.

**Changelogs are per package.** `.auto-changelog` sets `tagPrefix` and
`tagPattern` to the package's prefix and `appendGitLog: "-- ."`, which limits
the log to commits touching that package. Known cosmetic flaw: the newest
heading's compare link points at the bare version (`1.0.2`), not
`<dir>-v1.0.2`.

**A brand-new package's first version is published by tagging by hand.**
`npm run release` always bumps, so to publish the 1.0.0 already in
`package.json`, push `git tag <dir>-v1.0.0` instead; CI publishes what
`package.json` says.

**First publish uses a token, later ones use OIDC.** An npm trusted publisher
can only be configured on a package that already exists, so the first release
of each package needs an `NPM_TOKEN` repository secret (granular, read and
write, bypass 2FA, short expiry). Then configure a trusted publisher on **each**
package (owner `sharpapi`, repo `n8n-nodes-sharpapi`, workflow `publish.yml`;
one workflow serves all three), delete the secret, revoke the token, and set
*Require two-factor authentication and disallow tokens*.

**Keep `publishConfig.access: public` in `package.json`.** The first publish
(1.0.0, 2026-11-02) failed with `Can't generate provenance for new or private
package, you must set access to public`. `n8n-node release` runs a bare
`npm publish`, so the setting has to live in `package.json`. Version 1.0.0 was
tagged but never reached npm.

**Bypass-2FA tokens lose direct publish around January 2027.** GitHub's
2026-07-31 changelog: they will only be able to `npm stage publish`, which a
maintainer approves with 2FA. Trusted publishers created after 2026-09-03
default to stage-only too; tick *allow `npm publish`* when adding one, or
`publish.yml` will need `npm stage publish` plus a manual approval.

**`release-it` must stay a dev dependency.** `n8n-node release` runs it via
`npm exec`, which otherwise downloads whatever release-it is newest. The
GitHub Release step needs `GITHUB_TOKEN`: run `GITHUB_TOKEN=$(gh auth token)
npm run release`.

**The branch must be `main`.** `n8n-node release` passes
`--git.requireBranch main` to release-it on the command line, which no config
file can override, so on any other branch the local release refuses to run.
`ci.yml` and the README's example links assume `main` too.

The tag push triggers `.github/workflows/publish.yml`, which publishes with
provenance. Do not replace that workflow with a hand-written one — an earlier
attempt called `npx release-it` with no `release-it` dependency and no config.

## Adding an endpoint

One endpoint is one new package: n8n verification allows one regular node per
package. Copy a directory under `packages/` and, inside it, rename the node
folder, class, file names, `name`, icon files and `ENDPOINT`. Then:

1. In its `package.json`: `name` (`@sharpapi/n8n-nodes-<dir>`), `version`
   1.0.0, `description`, `keywords`, `repository.directory`, and the
   `n8n.nodes` path.
2. In `.release-it.json` and `.auto-changelog`: the `<dir>-v` prefix
   everywhere. Reset `CHANGELOG.md` to the one-paragraph stub.
3. Update the codex `.node.json`: `node` is `@sharpapi/n8n-nodes-<dir>.<nodeName>`,
   plus `categories` and `alias`, the only search terms besides the display name.
4. Write its README, add `examples/<dir>.json` and link it from that README.
   List the package in the root README.
5. Add the directory to the "ships three packages" list in
   `tests/package-invariants.test.mts`, then `npm run setup` so the workspace
   is linked.
6. First publish: tag by hand, then a trusted publisher; see *Releasing*.

Things to get right in the node itself:

- Send `language` only when the endpoint actually reads it.
- Accepted formats in the README must match the server's `mimes:` validation
  rule, or users hit a 422 on a format the README promised.
- An endpoint that returns several results per file emits each as its own item.
- Verify field names and validation against the SharpAPI backend's
  FormRequests, not the Postman collections, which are stale in places.
