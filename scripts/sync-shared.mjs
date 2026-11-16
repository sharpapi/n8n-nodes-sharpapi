#!/usr/bin/env node
/**
 * Copies shared/ and LICENSE.md into every package under packages/.
 *
 * Each package must be self-contained: it ships with zero runtime dependencies,
 * so the shared helpers and the credential cannot come from a common package,
 * and n8n-node lint/build only see files inside the package directory. The
 * copies are committed; tests/shared-copies.test.mts fails when one drifts.
 * Edit shared/, never a package's copy, then run `npm run sync`.
 */

import { cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = 'packages';

for (const pkg of readdirSync(PACKAGES_DIR)) {
	const target = join(PACKAGES_DIR, pkg);
	cpSync('shared', target, { recursive: true });
	cpSync('LICENSE.md', join(target, 'LICENSE.md'));
}
