import * as fs from 'fs'
import * as path from 'path'

export interface JsonValidationEntry {
	fileMatch: string[]
	url: string
}

export interface PackageJson {
	name: string
	publisher: string
	activationEvents: string[]
	contributes: {
		jsonValidation: JsonValidationEntry[]
	}
}

// Read from disk at runtime instead of `import packageJson from '../../package.json'`
// so the compiled test's `__dirname` resolves correctly regardless of `outDir`.
export function loadPackageJson(): PackageJson {
	const raw = fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
	return JSON.parse(raw)
}
