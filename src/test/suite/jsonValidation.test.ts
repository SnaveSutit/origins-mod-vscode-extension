import * as assert from 'assert'
import minimatch from 'minimatch'
import { loadPackageJson, JsonValidationEntry } from '../packageJson'

const packageJson = loadPackageJson()

// The extension supports both singular and plural data folder names for most
// power/origin types (eg. `data/*/origin/` and `data/*/origins/`). Both must
// point at the same schema or one of them will silently go unvalidated.
const SINGULAR_TO_PLURAL: Record<string, string> = {
	badge: 'badges',
	global_power: 'global_powers',
	origin: 'origins',
	origin_layer: 'origin_layers',
	power: 'powers',
	skill_tree: 'skill_trees',
}

function getEntries(): JsonValidationEntry[] {
	return packageJson.contributes.jsonValidation
}

function findEntryForFolder(folder: string): JsonValidationEntry | undefined {
	return getEntries().find(entry =>
		entry.fileMatch.some(pattern => pattern.includes(`/${folder}/`))
	)
}

suite('package.json jsonValidation', () => {
	test('every entry has at least one fileMatch pattern', () => {
		for (const entry of getEntries()) {
			assert.ok(
				Array.isArray(entry.fileMatch) && entry.fileMatch.length > 0,
				`entry for ${entry.url} has no fileMatch patterns`
			)
			for (const pattern of entry.fileMatch) {
				assert.strictEqual(typeof pattern, 'string')
				assert.ok(pattern.length > 0)
			}
		}
	})

	test('every entry points at a bundled schema under ./schemas/', () => {
		for (const entry of getEntries()) {
			assert.ok(
				entry.url.startsWith('./schemas/'),
				`${entry.url} should be a local ./schemas/ path, not a remote URL`
			)
		}
	})

	test('singular and plural data folders share the same schema', () => {
		for (const [singular, plural] of Object.entries(SINGULAR_TO_PLURAL)) {
			const singularEntry = findEntryForFolder(singular)
			const pluralEntry = findEntryForFolder(plural)
			assert.ok(singularEntry, `no jsonValidation entry matches data/*/${singular}/`)
			assert.ok(pluralEntry, `no jsonValidation entry matches data/*/${plural}/`)
			assert.strictEqual(
				singularEntry!.url,
				pluralEntry!.url,
				`data/*/${singular}/ and data/*/${plural}/ map to different schemas`
			)
		}
	})

	test('activationEvents cover every jsonValidation fileMatch folder', () => {
		const activationEvents: string[] = packageJson.activationEvents
		for (const entry of getEntries()) {
			for (const pattern of entry.fileMatch) {
				assert.ok(
					activationEvents.includes(`workspaceContains:${pattern}`),
					`no activationEvent for fileMatch pattern ${pattern}`
				)
			}
		}
	})

	test('fileMatch patterns match the folder they are named after', () => {
		const samplePaths: Record<string, string> = {
			badges: 'data/mypack/badges/example.json',
			badge: 'data/mypack/badge/example.json',
			global_powers: 'data/mypack/global_powers/example.json',
			global_power: 'data/mypack/global_power/example.json',
			keybindings: 'data/mypack/keybindings/example.json',
			keybinds: 'data/mypack/keybinds/example.json',
			origin_layers: 'data/mypack/origin_layers/example.json',
			origin_layer: 'data/mypack/origin_layer/example.json',
			origins: 'data/mypack/origins/example.json',
			origin: 'data/mypack/origin/example.json',
			powers: 'data/mypack/powers/example.json',
			power: 'data/mypack/power/example.json',
			skill_trees: 'data/mypack/skill_trees/example.json',
			skill_tree: 'data/mypack/skill_tree/example.json',
		}

		for (const [folder, samplePath] of Object.entries(samplePaths)) {
			const entry = findEntryForFolder(folder)
			assert.ok(entry, `no jsonValidation entry matches data/*/${folder}/`)
			const matched = entry!.fileMatch.some(pattern => minimatch(samplePath, pattern))
			assert.ok(matched, `${samplePath} did not match any fileMatch pattern for data/*/${folder}/`)
		}
	})

	test('fileMatch patterns do not cross-match unrelated folders', () => {
		const originEntry = findEntryForFolder('origins')
		assert.ok(originEntry)
		const unrelatedPath = 'data/mypack/powers/example.json'
		const matched = originEntry!.fileMatch.some(pattern => minimatch(unrelatedPath, pattern))
		assert.strictEqual(matched, false, `origins fileMatch unexpectedly matched ${unrelatedPath}`)
	})
})
