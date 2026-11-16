#!/usr/bin/env node
/**
 * Copies the codex file into dist after `n8n-node build`.
 *
 * The build command only copies `**\/*.{png,svg}` and `**\/__schema__\/**\/*.json`
 * into dist, so a `<Node>.node.json` sitting beside its node is silently left
 * behind. n8n reads that file to populate the node's categories and its node
 * panel search aliases, and it reads only that file: the `codex` field on the
 * node description is ignored (verified against n8n 2.32.6, where a search term
 * present only in an inline alias returned nothing).
 *
 * Without this step the node still works, but it is unfindable by anything
 * other than the words in its display name.
 */

import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const NODES_DIR = 'nodes';
const DIST_NODES_DIR = join('dist', 'nodes');

let copied = 0;

for (const nodeDir of readdirSync(NODES_DIR)) {
	const source = join(NODES_DIR, nodeDir);
	const target = join(DIST_NODES_DIR, nodeDir);

	if (!existsSync(target)) continue;

	for (const file of readdirSync(source)) {
		if (!file.endsWith('.node.json')) continue;
		copyFileSync(join(source, file), join(target, file));
		copied += 1;
	}
}

if (copied === 0) {
	console.error('No codex file was copied. The node would not be findable by search.');
	process.exit(1);
}
