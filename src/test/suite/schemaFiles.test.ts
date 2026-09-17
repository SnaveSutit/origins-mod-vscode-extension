import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { loadPackageJson } from '../packageJson'

const packageJson = loadPackageJson()
const EXTENSION_ROOT = path.resolve(__dirname, '../../..')
const SCHEMAS_ROOT = path.join(EXTENSION_ROOT, 'schemas')

// Keywords that can appear at the root of a valid JSON Schema. Some of these
// schemas compose entirely with `allOf`/`$ref` and never declare a top-level
// `type` or `properties`.
const SCHEMA_ROOT_KEYWORDS = [
	'$schema',
	'type',
	'properties',
	'allOf',
	'anyOf',
	'oneOf',
	'$ref',
	'if',
	'not',
]

function listJsonFiles(dir: string): string[] {
	const files: string[] = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			files.push(...listJsonFiles(fullPath))
		} else if (entry.isFile() && entry.name.endsWith('.json')) {
			files.push(fullPath)
		}
	}
	return files
}

function collectRefs(node: unknown, refs: string[]): void {
	if (Array.isArray(node)) {
		for (const item of node) collectRefs(item, refs)
	} else if (node && typeof node === 'object') {
		for (const [key, value] of Object.entries(node)) {
			if (key === '$ref' && typeof value === 'string') {
				refs.push(value)
			} else {
				collectRefs(value, refs)
			}
		}
	}
}

suite('vendored JSON schemas', () => {
	test('schemas/ directory was vendored', () => {
		assert.ok(fs.existsSync(SCHEMAS_ROOT), 'schemas/ is missing - run `yarn update-schemas`')
	})

	test('every jsonValidation entry resolves to a bundled schema file', () => {
		for (const entry of packageJson.contributes.jsonValidation) {
			assert.ok(
				entry.url.startsWith('./schemas/'),
				`${entry.url} should be a local ./schemas/ path`
			)
			const filePath = path.join(EXTENSION_ROOT, entry.url)
			assert.ok(fs.existsSync(filePath), `${entry.url} does not exist on disk`)
		}
	})

	const jsonFiles = listJsonFiles(SCHEMAS_ROOT)

	test('at least one schema file was vendored', () => {
		assert.ok(jsonFiles.length > 0, 'schemas/ contains no .json files - run `yarn update-schemas`')
	})

	test('every vendored schema file is valid JSON and looks like a schema', () => {
		for (const filePath of jsonFiles) {
			const relativePath = path.relative(EXTENSION_ROOT, filePath)
			let body: unknown
			assert.doesNotThrow(() => {
				body = JSON.parse(fs.readFileSync(filePath, 'utf8'))
			}, `${relativePath} is not valid JSON`)
			assert.strictEqual(typeof body, 'object')
			assert.notStrictEqual(body, null)
			assert.ok(
				SCHEMA_ROOT_KEYWORDS.some(keyword => keyword in (body as object)),
				`${relativePath} does not look like a JSON Schema document`
			)
		}
	})

	// The schemas are bundled (via @apidevtools/json-schema-ref-parser) from
	// upstream's multi-file tree specifically because VS Code's local
	// (file://) JSON schema resolver breaks on cross-file relative $refs once
	// a dispatcher schema has more than ~10 allOf/if-then branches (see
	// microsoft/vscode#7730, #92348). If a file-path $ref shows up here, the
	// bundling step didn't fully dereference something, and VS Code will
	// silently fail to load part of the schema in the real editor.
	test('every $ref is a local pointer - none reference another file', () => {
		for (const filePath of jsonFiles) {
			const relativePath = path.relative(EXTENSION_ROOT, filePath)
			const body = JSON.parse(fs.readFileSync(filePath, 'utf8'))
			const refs: string[] = []
			collectRefs(body, refs)

			for (const ref of refs) {
				assert.ok(ref.startsWith('#'), `${relativePath} has a non-local $ref: ${ref}`)
			}
		}
	})
})
