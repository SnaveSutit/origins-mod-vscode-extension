import * as assert from 'assert'
import * as vscode from 'vscode'
import { loadPackageJson } from '../packageJson'

const packageJson = loadPackageJson()
const EXTENSION_ID = `${packageJson.publisher}.${packageJson.name}`

suite('Extension activation', () => {
	test('extension is present', () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID)
		assert.ok(extension, `extension ${EXTENSION_ID} is not installed in the test host`)
	})

	test('extension activates without throwing', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID)
		assert.ok(extension)
		await extension!.activate()
		assert.strictEqual(extension!.isActive, true)
	})
})
