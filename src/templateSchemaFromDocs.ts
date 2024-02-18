import * as fs from 'fs'
import { MDFile } from './schemaGenerator/mdReader'
import { JSONSchema, SimpleSchemaType } from './schemaGenerator/schema'
const docsPath = 'D:/github-repos/origins-docs/docs/types'
const outDir = './debug_out'

function main() {
	function recurse(path: string, files: string[] = []) {
		fs.readdirSync(path).forEach(file => {
			const filePath = `${path}/${file}`
			if (fs.statSync(filePath).isDirectory()) {
				recurse(filePath, files)
			} else {
				files.push(filePath)
			}
		})
		return files
	}
	const files = recurse(docsPath)
	for (const file of files) {
		const schema: JSONSchema = {}
		const mdFile = MDFile.fromFile(file)
		if (mdFile.fields.length > 0) {
			schema.type = 'object'
			schema.properties = {}
			for (const field of mdFile.fields) {
				const property: NonNullable<JSONSchema['properties']>[string] = {}
				property.type = field.type.toLowerCase() as SimpleSchemaType

				schema.properties[field.name] = property
			}
		}

		const outPath = file.replace(docsPath, outDir).replace('.md', '.json')
		fs.mkdirSync(outPath.replace(/\/[^/]+$/, ''), { recursive: true })
		fs.writeFileSync(outPath, JSON.stringify(schema, null, '\t'))
	}
}

main()
