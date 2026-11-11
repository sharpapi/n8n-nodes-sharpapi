# @sharpapi/n8n-nodes-sharpapi

The SharpAPI n8n community node package: one npm package, one node per SharpAPI
endpoint, one shared credential, `sharpApiApi` ("SharpAPI API"). The repo root
**is** the package. Only `dist/`, `package.json`, `README.md`, `LICENSE.md` and
`index.js` reach npm (`files: ["dist"]`); tests and examples stay in the repo.

---

## Where things stand — 2026-11-11

Published once as the unscoped `n8n-nodes-sharpapi@1.0.1` (2026-11-02, with
provenance, maintainer `makowskid`), then renamed to
`@sharpapi/n8n-nodes-sharpapi`, published as 1.0.2 and 1.0.3 (`latest`). The
working tree adds the File URL input type for AI Agent tool use, unreleased.
The repo is
`github.com/sharpapi/n8n-nodes-sharpapi` (public); CI is green on Ubuntu.

| Gate | State |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 81 passing, ~2s, no network |
| `npm run lint` | **0 errors, 0 warnings** |
| `npm run build` | pass |
| `npm pack --dry-run` | 22 files, ~41 kB unpacked |
| `npm run dev` (Node 24) | n8n 2.45.7 starts with the package linked |

Verified by hand on n8n 2.32.6, back when each node shipped as its own package
with the same node code: nodes appear in the panel and are findable by
"resume", "invoice", "cv" and "curriculum"; icons render on both themes;
credential **Test** succeeds with a valid key and fails clearly with an invalid
one; `Read/Write Files from Disk` → node returns structured JSON; all three are
offered as AI Agent tools. Repeat once against this package.

### Next

1. Release 1.0.4 (File URL input), then record the n8n verification video
   against exactly that version: install from npm, credential test, the main
   actions, and one node used as an AI Agent tool with a File URL.
2. If not done yet: move to a trusted publisher and delete the `NPM_TOKEN`
   secret; see *Releasing*.
3. Retire the unscoped `n8n-nodes-sharpapi`: deprecate it pointing at the
   scoped name, or unpublish it, which npm allows only within 72 hours of
   creation (until 2026-11-05 14:50 UTC) and which frees the name for anyone.

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

```bash
npm run setup       # npm install --ignore-scripts, see below
npm run typecheck   # tsc --noEmit over nodes/ and credentials/
npm test            # vitest, ~2s, no network
npm run lint        # n8n-node lint, must stay completely empty
npm run build       # n8n-node build, then copy-codex.mjs
npm run dev         # Node 24: local n8n with the package linked, rebuilds on change
```

## Layout

```
nodes/shared/              GenericFunctions, Languages, Config: shared by every node
nodes/<NodeClass>/         one node: .node.ts, .node.json codex, icon pair
credentials/               the one credential and its icon pair
copy-codex.mjs             build step, see below
.github/workflows/         publish.yml, the tag-triggered provenance publish
tests/                     vitest suite, .mts on purpose, see below
examples/                  workflows linked from the README, credentials stripped
```

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
nodes/SharpApiResumeParser/resume-parser.svg                  light theme
nodes/SharpApiResumeParser/resume-parser.dark.svg             dark theme
nodes/SharpApiInvoiceParser/invoice-parser.svg / .dark.svg
nodes/SharpApiResumeJobMatchScore/resume-job-match-score.svg / .dark.svg
credentials/sharpapi.svg / .dark.svg                          the SharpAPI brand
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
omits packages. Check `ls node_modules/.bin | wc -l` (43 when complete) before
believing an install worked.

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

**Shared runtime code lives in `nodes/shared/`.** Every other directory under
`nodes/` is a node; `copy-codex.mjs` and the invariants test both rely on that.
Each node declares its own `ENDPOINT`.

**Keep collection options alphabetical by display name.** n8n's lint rule
requires it.

**Do not turn `declaration` or `incremental` back on.** `*.credentials.d.ts`
fails the community package scan's filename rule, and the incremental cache
either ships as 211 kB of dead weight or, if relocated outside `dist`, survives
`rm -rf dist` and makes the next build emit nothing at all.

**Example workflows use the published node type,** `@sharpapi/n8n-nodes-sharpapi.<nodeName>`.
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
npm run release      # lints, builds, bumps, changelogs, commits, tags, pushes
```

**First publish uses a token, later ones use OIDC.** An npm trusted publisher
can only be configured on a package that already exists, so the first release
needs an `NPM_TOKEN` repository secret (granular, read and write, bypass 2FA,
short expiry). Then configure the trusted publisher (owner `sharpapi`, repo
`n8n-nodes-sharpapi`, workflow `publish.yml`), delete the secret, revoke the
token, and set *Require two-factor authentication and disallow tokens*.

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

Copy a node folder under `nodes/` and rename the class, file names, `name`,
icon files and `ENDPOINT`. Then:

1. Add `dist/nodes/<NodeClass>/<NodeClass>.node.js` to `n8n.nodes` in
   `package.json`, and any new keywords.
2. Update the codex `.node.json`: `node` is `@sharpapi/n8n-nodes-sharpapi.<nodeName>`,
   plus `categories` and `alias`, the only search terms besides the display name.
3. Add a README section and an example workflow in `examples/`, linked from
   the README.
4. Bump the "ships three nodes" count in `tests/package-invariants.test.mts`.

Things to get right in the node itself:

- Send `language` only when the endpoint actually reads it.
- Accepted formats in the README must match the server's `mimes:` validation
  rule, or users hit a 422 on a format the README promised.
- An endpoint that returns several results per file emits each as its own item.
- Verify field names and validation against the SharpAPI backend's
  FormRequests, not the Postman collections, which are stale in places.
