/**
 * Guards the properties that make the generated package publishable and
 * verifiable, rather than the behaviour of any one node. These are the things
 * an n8n verification reviewer checks, and the things a careless spec edit
 * would quietly break.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREDENTIALS_DIR = join(PKG_DIR, 'credentials');

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson(join(PKG_DIR, 'package.json'));

// Every directory under nodes/ is a node, except the shared runtime helpers.
const nodeClasses = readdirSync(join(PKG_DIR, 'nodes')).filter((entry) => entry !== 'shared');
const nodeDirOf = (nodeClass: string) => join(PKG_DIR, 'nodes', nodeClass);
const codexOf = (nodeClass: string) =>
	readJson(join(nodeDirOf(nodeClass), `${nodeClass}.node.json`));

const credentialFile = readdirSync(CREDENTIALS_DIR).find((entry) =>
	entry.endsWith('.credentials.ts'),
) as string;
const credentialSource = readFileSync(join(CREDENTIALS_DIR, credentialFile), 'utf8');
const credentialName = credentialSource.match(/\bname = '([^']+)'/)?.[1];

/** Asserts a file declares a themed icon pair and that both files sit beside it. */
function expectThemedIcon(source: string, dir: string, label: string) {
	const declared = source.match(
		/icon(?:: Icon)?\s*[:=]\s*\{ light: 'file:([^']+)', dark: 'file:([^']+)' \}/,
	);

	expect(declared, `${label} does not declare a themed icon`).not.toBeNull();

	const [, light, dark] = declared as RegExpMatchArray;
	expect(light).not.toBe(dark); // n8n rejects light and dark pointing at one file
	expect(readdirSync(dir)).toContain(light);
	expect(readdirSync(dir)).toContain(dark);
}

/** Asserts every SVG in a directory has a square viewBox, so n8n does not distort it. */
function expectSquareSvgs(dir: string) {
	const svgs = readdirSync(dir).filter((file) => file.endsWith('.svg'));
	expect(svgs.length).toBeGreaterThan(0);

	for (const svg of svgs) {
		const viewBox = readFileSync(join(dir, svg), 'utf8').match(
			/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/,
		);
		expect(viewBox, `${svg} has no viewBox`).not.toBeNull();
		expect(viewBox?.[1], `${svg} is not square`).toBe(viewBox?.[2]);
	}
}

it('ships three nodes', () => {
	expect(nodeClasses).toHaveLength(3);
});

describe('package', () => {
	it('declares no runtime dependencies', () => {
		expect(manifest.dependencies ?? {}).toEqual({});
	});

	it('keeps n8n-workflow as a peer dependency only', () => {
		expect(manifest.peerDependencies).toHaveProperty('n8n-workflow');
		expect(manifest.devDependencies).toHaveProperty('n8n-workflow');
		expect(manifest.dependencies?.['n8n-workflow']).toBeUndefined();
	});

	it('publishes dist only', () => {
		expect(manifest.files).toEqual(['dist']);
	});

	it('carries the keyword n8n requires for community packages', () => {
		expect(manifest.keywords).toContain('n8n-community-node-package');
	});

	it('is MIT licensed, as n8n verification requires', () => {
		expect(manifest.license).toBe('MIT');
	});

	it('points its n8n entry paths at every node the build will produce', () => {
		expect([...manifest.n8n.nodes].sort()).toEqual(
			nodeClasses.map((nodeClass) => `dist/nodes/${nodeClass}/${nodeClass}.node.js`).sort(),
		);
	});

	it('declares one credential, matching the file that defines it', () => {
		expect(manifest.n8n.credentials).toEqual([
			`dist/credentials/${credentialFile.replace('.ts', '.js')}`,
		]);
	});

	it('ships the polling helper once, shared by every node', () => {
		// The helper is the single source of truth for every node's runtime
		// behaviour. A per-node copy would drift, and the polling tests, which
		// drive the Resume Parser, would stop describing the other nodes.
		expect(readdirSync(join(PKG_DIR, 'nodes/shared'))).toContain('GenericFunctions.ts');

		for (const nodeClass of nodeClasses) {
			expect(readdirSync(nodeDirOf(nodeClass))).not.toContain('GenericFunctions.ts');
		}
	});

	it('carries a build step that copies the codex into dist', () => {
		// n8n-node build only copies **/*.{png,svg}, so without this the codex
		// never ships and the aliases have no effect once published. The codex
		// field on the node description is NOT a substitute: n8n ignores it.
		expect(manifest.scripts.build).toContain('copy-codex.mjs');
		expect(() => readFileSync(join(PKG_DIR, 'copy-codex.mjs'), 'utf8')).not.toThrow();
	});

	it('ships the publish workflow n8n-node scaffolds, not a hand-rolled one', () => {
		// Provenance is mandatory for nodes published after 2026-05-01, and
		// `n8n-node release` only sets NPM_CONFIG_PROVENANCE when it detects CI,
		// so publishing has to run in Actions on a tag push.
		const workflow = readFileSync(join(PKG_DIR, '.github/workflows/publish.yml'), 'utf8');

		expect(workflow).toContain('id-token: write');
		expect(workflow).toContain('npm run release');
		expect(workflow).toContain('tags:');
		// release-it is invoked by the CLI, never directly: it is not a dependency
		// here and there is no .release-it config to drive it.
		expect(workflow).not.toContain('npx release-it');
	});

	it('exposes the release script the publish workflow calls', () => {
		expect(manifest.scripts.release).toBe('n8n-node release');
	});

	it('keeps build metadata out of the published tarball', () => {
		// An incremental build wrote dist/tsconfig.tsbuildinfo, 211 kB of cache in
		// a 35 kB package, and `files: ["dist"]` shipped all of it.
		const tsconfig = readJson(join(PKG_DIR, 'tsconfig.json'));
		expect(tsconfig.compilerOptions.incremental).toBeUndefined();
	});

	it('ships an ESLint flat config, which n8n-node lint refuses to run without', () => {
		expect(() => readFileSync(join(PKG_DIR, 'eslint.config.mjs'), 'utf8')).not.toThrow();
	});

	it('ships an example workflow per node in the repo, linked from the README', () => {
		// n8n verification asks for example workflows in the docs.
		const readme = readFileSync(join(PKG_DIR, 'README.md'), 'utf8');
		const examples = readdirSync(join(PKG_DIR, 'examples'));

		expect(examples).toHaveLength(nodeClasses.length);
		for (const example of examples) {
			expect(readme).toContain(`/examples/${example}`);
			for (const node of readJson(join(PKG_DIR, 'examples', example)).nodes) {
				expect(node.type).not.toMatch(/^CUSTOM\./);
			}
		}
	});
});

describe('credential', () => {
	it('declares themed icons that both exist', () => {
		expectThemedIcon(credentialSource, CREDENTIALS_DIR, credentialFile);
	});

	it('ships square SVG icons', () => {
		expectSquareSvgs(CREDENTIALS_DIR);
	});
});

describe.each(nodeClasses)('%s', (nodeClass) => {
	const source = readFileSync(join(nodeDirOf(nodeClass), `${nodeClass}.node.ts`), 'utf8');

	it('uses the shared credential', () => {
		expect(source).toContain(`name: '${credentialName}'`);
	});

	it('declares themed icons that both exist', () => {
		expectThemedIcon(source, nodeDirOf(nodeClass), `${nodeClass}.node.ts`);
	});

	it('ships square SVG icons', () => {
		expectSquareSvgs(nodeDirOf(nodeClass));
	});

	it('ships a codex file naming the node it documents', () => {
		const codex = codexOf(nodeClass);

		expect(codex.node.startsWith(`${manifest.name}.`)).toBe(true);
		expect(source).toContain(`name: '${codex.node.split('.')[1]}'`);
		expect(codex.codexVersion).toBeDefined();
		expect(codex.resources.primaryDocumentation[0].url).toMatch(/^https:\/\//);
	});

	it('declares search aliases, which is the only thing node panel search reads', () => {
		// Verified in a running n8n 2.32.6: searching "cv" surfaced nothing before
		// these existed, even though the Resume Parser description says "CVs".
		const codex = codexOf(nodeClass);

		expect(Array.isArray(codex.alias)).toBe(true);
		expect(codex.alias.length).toBeGreaterThan(0);
	});
});

it('gives every node a distinct node name', () => {
	const names = nodeClasses.map((nodeClass) => codexOf(nodeClass).node);
	expect(new Set(names).size).toBe(nodeClasses.length);
});
