// Re-vendors ./schemas from the `schemas` branch of
// https://github.com/SnaveSutit/origins-mod-json-schemas (that branch is a
// build output, published by that repo's own CI on every push to main).
//
// That repo bundles each entry-point schema into a self-contained file
// (only local `#/...` refs, no cross-file $refs) under `schemas/bundled/`
// in its own build, specifically so local (file://) consumers like this
// extension don't hit VS Code's longstanding bug where relative $ref chains
// resolve against the wrong base directory once a dispatcher schema has more
// than ~10 allOf/if-then branches (microsoft/vscode#7730, #92348). This
// script just copies that already-bundled output - see that repo's
// src/bundleSchemas.ts for the bundling logic itself.
//
// Run with `yarn update-schemas` after the upstream schemas change.
'use strict'

const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const REPO_URL = 'https://github.com/SnaveSutit/origins-mod-json-schemas.git'
const BRANCH = 'schemas'
const DEST = path.resolve(__dirname, '..', 'schemas')

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'origins-mod-json-schemas-'))

try {
	execFileSync('git', ['clone', '--branch', BRANCH, '--depth', '1', REPO_URL, tmpDir], {
		stdio: 'inherit',
	})

	const bundledDir = path.join(tmpDir, 'bundled')
	if (!fs.existsSync(bundledDir)) {
		throw new Error(`${bundledDir} does not exist - has the schemas repo's bundling step run yet?`)
	}

	fs.rmSync(DEST, { recursive: true, force: true })
	fs.cpSync(bundledDir, DEST, { recursive: true })
	console.log(`Updated ${path.relative(process.cwd(), DEST)} from ${REPO_URL}@${BRANCH} (bundled/)`)
} finally {
	fs.rmSync(tmpDir, { recursive: true, force: true })
}
