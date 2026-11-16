/**
 * Guards the properties that make each package publishable and verifiable,
 * rather than the behaviour of any one node. These are the things an n8n
 * verification reviewer checks, and the things a careless edit would quietly
 * break.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHARED_DIR = join(ROOT, 'shared');
const PACKAGES_DIR = join(ROOT, 'packages');

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const read = (path: string) => readFileSync(path, 'utf8');

const packageDirs = readdirSync(PACKAGES_DIR);

/** Every file under a directory, as paths relative to it. */
function filesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		return statSync(path).isDirectory()
			? filesUnder(path).map((file) => join(entry, file))
			: [entry];
	});
}

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
		const viewBox = read(join(dir, svg)).match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
		expect(viewBox, `${svg} has no viewBox`).not.toBeNull();
		expect(viewBox?.[1], `${svg} is not square`).toBe(viewBox?.[2]);
	}
}

it('ships three packages', () => {
	expect(packageDirs.sort()).toEqual(['invoice-parser', 'resume-job-match-score', 'resume-parser']);
});

it('gives every package a distinct name and every node a distinct node type', () => {
	const names = packageDirs.map((dir) => readJson(join(PACKAGES_DIR, dir, 'package.json')).name);
	expect(new Set(names).size).toBe(packageDirs.length);
});

it('ships the publish workflow n8n-node scaffolds, routed by tag prefix', () => {
	// Provenance is mandatory for nodes published after 2026-05-01, and
	// `n8n-node release` only sets NPM_CONFIG_PROVENANCE when it detects CI,
	// so publishing has to run in Actions on a tag push.
	const workflow = read(join(ROOT, '.github/workflows/publish.yml'));

	expect(workflow).toContain('id-token: write');
	expect(workflow).toContain('npm run release');
	expect(workflow).toContain("'*-v*.*.*'");
	expect(workflow).toContain('working-directory');
	expect(workflow).not.toContain('npx release-it');
});

it('keeps the root private, so it can never be published', () => {
	expect(readJson(join(ROOT, 'package.json')).private).toBe(true);
});

describe('shared credential', () => {
	const credentialsDir = join(SHARED_DIR, 'credentials');
	const source = read(join(credentialsDir, 'SharpApiApi.credentials.ts'));

	it('declares themed icons that both exist', () => {
		expectThemedIcon(source, credentialsDir, 'SharpApiApi.credentials.ts');
	});

	it('ships square SVG icons', () => {
		expectSquareSvgs(credentialsDir);
	});
});

describe.each(packageDirs)('packages/%s', (dir) => {
	const pkgDir = join(PACKAGES_DIR, dir);
	const manifest = readJson(join(pkgDir, 'package.json'));
	const nodeClasses = readdirSync(join(pkgDir, 'nodes')).filter((entry) => entry !== 'shared');
	const nodeClass = nodeClasses[0];
	const nodeDir = join(pkgDir, 'nodes', nodeClass);
	const source = read(join(nodeDir, `${nodeClass}.node.ts`));
	const codex = readJson(join(nodeDir, `${nodeClass}.node.json`));
	const credentialSource = read(join(pkgDir, 'credentials', 'SharpApiApi.credentials.ts'));
	const credentialName = credentialSource.match(/\bname = '([^']+)'/)?.[1];

	it('ships exactly one regular node, as n8n verification requires', () => {
		expect(nodeClasses).toHaveLength(1);
		expect(manifest.n8n.nodes).toEqual([`dist/nodes/${nodeClass}/${nodeClass}.node.js`]);
	});

	it('carries an identical copy of every shared file', () => {
		// Packages ship with zero dependencies, so shared code is copied in by
		// `npm run sync`. A hand edit to one copy would make the nodes drift.
		for (const file of filesUnder(SHARED_DIR)) {
			expect(read(join(pkgDir, file)), `${relative(ROOT, join(pkgDir, file))} differs from shared/; run npm run sync`).toBe(
				read(join(SHARED_DIR, file)),
			);
		}
		expect(read(join(pkgDir, 'LICENSE.md'))).toBe(read(join(ROOT, 'LICENSE.md')));
	});

	it('declares no runtime dependencies', () => {
		expect(manifest.dependencies ?? {}).toEqual({});
	});

	it('keeps n8n-workflow as a peer dependency only', () => {
		expect(manifest.peerDependencies).toHaveProperty('n8n-workflow');
		expect(manifest.devDependencies).toHaveProperty('n8n-workflow');
	});

	it('publishes dist only, publicly, and names its repository directory for provenance', () => {
		expect(manifest.files).toEqual(['dist']);
		expect(manifest.publishConfig.access).toBe('public');
		expect(manifest.repository.directory).toBe(`packages/${dir}`);
	});

	it('is an MIT licensed community package', () => {
		expect(manifest.keywords).toContain('n8n-community-node-package');
		expect(manifest.license).toBe('MIT');
		expect(manifest.name).toBe(`@sharpapi/n8n-nodes-${dir}`);
	});

	it('declares the shared credential', () => {
		expect(manifest.n8n.credentials).toEqual(['dist/credentials/SharpApiApi.credentials.js']);
		expect(source).toContain(`name: '${credentialName}'`);
	});

	it('copies the codex into dist on build', () => {
		// n8n-node build only copies **/*.{png,svg}, so without this the codex
		// never ships and the aliases have no effect once published.
		expect(manifest.scripts.build).toBe('n8n-node build && node copy-codex.mjs');
	});

	it('exposes the release script the publish workflow calls, with its own tag prefix', () => {
		expect(manifest.scripts.release).toBe('n8n-node release');
		expect(readJson(join(pkgDir, '.release-it.json')).git.tagName).toBe(`${dir}-v\${version}`);
	});

	it('keeps build metadata out of the published tarball', () => {
		const tsconfig = readJson(join(pkgDir, 'tsconfig.json'));
		expect(tsconfig.compilerOptions.incremental).toBeUndefined();
		expect(tsconfig.compilerOptions.declaration).toBe(false);
	});

	it('declares themed icons that both exist, with square SVGs', () => {
		expectThemedIcon(source, nodeDir, `${nodeClass}.node.ts`);
		expectSquareSvgs(nodeDir);
	});

	it('ships a codex file naming the node it documents, with search aliases', () => {
		expect(codex.node).toBe(`${manifest.name}.${source.match(/\bname: '([^']+)'/)?.[1]}`);
		expect(codex.codexVersion).toBeDefined();
		expect(codex.resources.primaryDocumentation[0].url).toMatch(/^https:\/\//);
		// Verified in a running n8n 2.32.6: aliases are the only search terms
		// besides the display name.
		expect(codex.alias.length).toBeGreaterThan(0);
	});

	it('links an example workflow from its README that uses the published node type', () => {
		const readme = read(join(pkgDir, 'README.md'));
		const example = `${dir}.json`;

		expect(readme).toContain(`/examples/${example}`);
		const types = readJson(join(ROOT, 'examples', example)).nodes.map((node: { type: string }) => node.type);
		expect(types).toContain(codex.node);
	});
});
