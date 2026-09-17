import * as assert from 'assert'
import * as path from 'path'
import * as vscode from 'vscode'

// second_power.json / example_power.json used to reproduce a schema bug where
// `bientity_condition`/`bientity_action` resolved through a $ref chain whose target
// stored its `required`/`properties`/`allOf` keywords as bare `{ "$ref": ... }`
// objects instead of real arrays/objects - invalid outside a generic "JSON Reference"
// document, so VS Code's JSON schema engine silently ignored them. That's fixed
// upstream as of the current `yarn update-schemas` pull - these two tests now assert
// the correct (positive) behavior and act as a regression guard.
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../test-workspace/data/testpack')
const SETTLE_MS = 2000

async function openAndSettle(relPath: string): Promise<vscode.TextDocument> {
	const uri = vscode.Uri.file(path.join(WORKSPACE_ROOT, relPath))
	const doc = await vscode.workspace.openTextDocument(uri)
	await vscode.window.showTextDocument(doc)
	await new Promise(r => setTimeout(r, SETTLE_MS))
	return doc
}

function offsetAfter(text: string, needle: string): number {
	const idx = text.indexOf(needle)
	assert.ok(idx !== -1, `expected to find ${JSON.stringify(needle)} in document text`)
	return idx + needle.length
}

async function completionLabelsAt(doc: vscode.TextDocument, offset: number): Promise<string[]> {
	const list = (await vscode.commands.executeCommand(
		'vscode.executeCompletionItemProvider',
		doc.uri,
		doc.positionAt(offset)
	)) as vscode.CompletionList
	return list.items.map(item => (typeof item.label === 'string' ? item.label : item.label.label))
}

suite('live JSON schema behavior for bi-entity fields', () => {
	test('control: a well-formed schema path offers completions', async function () {
		this.timeout(10000)
		const doc = await openAndSettle('powers/control_condition_power.json')
		const offset = offsetAfter(doc.getText(), '"condition": {')

		const labels = await completionLabelsAt(doc, offset)
		assert.ok(
			labels.includes('type'),
			`expected "type" in completions, got ${JSON.stringify(labels)}`
		)
		assert.ok(
			labels.includes('inverted'),
			`expected "inverted" in completions, got ${JSON.stringify(labels)}`
		)
	})

	test('apoli:action_on_being_used bientity_condition offers the condition base fields', async function () {
		this.timeout(10000)
		const doc = await openAndSettle('power/second_power.json')
		const offset = offsetAfter(doc.getText(), '"bientity_condition": {')

		const labels = await completionLabelsAt(doc, offset)
		assert.ok(
			labels.includes('inverted'),
			`expected "inverted" in completions, got ${JSON.stringify(labels)}`
		)
		assert.ok(
			labels.includes('type'),
			`expected "type" in completions, got ${JSON.stringify(labels)}`
		)
	})

	test('sync:action_on_death bientity_action offers exactly its "type" field', async function () {
		this.timeout(10000)
		const doc = await openAndSettle('powers/example_power.json')
		const offset = offsetAfter(doc.getText(), '"bientity_action": {')

		const labels = await completionLabelsAt(doc, offset)
		assert.deepStrictEqual(
			labels,
			['type'],
			`expected exactly ["type"], got ${JSON.stringify(labels)}`
		)
	})
})

suite('vendored schema self-reference integrity', () => {
	// power.json's `power_type` property (nested under bientity_action ->
	// actor_action -> action -> power_type) still contains a malformed
	// `{ "$ref": "#/" }` - a self-reference to the document root, which is invalid
	// (a "/" pointer fragment doesn't resolve). It used to make VS Code report a
	// document-wide "$ref '/' ... can not be resolved" error that suppressed
	// required-field validation everywhere; that symptom is gone as of the latest
	// `yarn update-schemas` pull (validation works again - see the test below), so
	// this is now cosmetic. Still worth fixing upstream in
	// https://github.com/SnaveSutit/origins-mod-json-schemas so it doesn't regress.
	function findRootSelfRefs(node: unknown, path: string, out: string[]): void {
		if (Array.isArray(node)) {
			node.forEach((item, i) => findRootSelfRefs(item, `${path}/${i}`, out))
		} else if (node && typeof node === 'object') {
			for (const [key, value] of Object.entries(node)) {
				if (key === '$ref' && (value === '#' || value === '#/')) {
					out.push(path)
				} else {
					findRootSelfRefs(value, `${path}/${key}`, out)
				}
			}
		}
	}

	test('known issue (cosmetic): power.json contains one self-referencing "#/" $ref', () => {
		const schemaPath = path.resolve(__dirname, '../../../schemas/power.json')
		const schema = JSON.parse(require('fs').readFileSync(schemaPath, 'utf8'))
		const hits: string[] = []
		findRootSelfRefs(schema, '#', hits)

		assert.deepStrictEqual(
			hits,
			[
				'#/allOf/0/then/properties/bientity_action/allOf/0/allOf/0/then/properties/action/allOf/0/allOf/80/then/properties/power_type/allOf/0',
			],
			`expected the known self-ref to still be present, got ${JSON.stringify(hits)}. ` +
				'If this is now empty, the self-ref was cleaned up upstream - update this test to assert that.'
		)
	})

	test('required-field validation works despite the self-ref above', async function () {
		this.timeout(10000)
		const doc = await openAndSettle('powers/control_condition_power.json')
		const diagnostics = vscode.languages.getDiagnostics(doc.uri)

		assert.ok(
			diagnostics.some(d => d.message.includes('Missing property')),
			`expected a missing-"type" diagnostic, got ${JSON.stringify(diagnostics.map(d => d.message))}`
		)
	})
})
