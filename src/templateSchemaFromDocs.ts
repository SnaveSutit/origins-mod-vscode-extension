import * as fs from 'fs'
import { MDFile } from './schemaGenerator/mdReader'
import { JSONSchema, SimpleSchemaType } from './schemaGenerator/schema'
const docsPath = 'D:/github-repos/origins-docs/docs/types'
const outDir = './debug_out'

function main() {
	function recurse(path: string, files: string[] = []) {
		fs.readdirSync(path).forEach(file => {
			const filePath = `${path}/${file}`
			if (file.endsWith('data_types')) return
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
		schema.$schema = 'https://json-schema.org/draft-07/schema#'
		schema.$docsUrl = `https://origins.readthedocs.io/en/latest/types${file
			.replace(docsPath, '')
			.replace('.md', '')}/`
		if (mdFile.fields.length > 0) {
			schema.type = 'object'
			schema.required = []
			schema.properties = {}
			for (const field of mdFile.fields) {
				const property: NonNullable<JSONSchema['properties']>[string] = {}
				property.type = field.type.toLowerCase() as SimpleSchemaType

				if (!field.optional) {
					if (field.defaultValue === undefined) {
						schema.required.push(field.name)
					} else {
						property.default = field.defaultValue
					}
				}

				schema.properties[field.name] = property
			}
			if (schema.required.length === 0) delete schema.required
		} else if (mdFile.values.length > 0) {
			schema.type = 'string'
			schema.enum = mdFile.values.map(v => v.value)
		}

		const outPath = file.replace(docsPath, outDir).replace('.md', '.json')
		fs.mkdirSync(outPath.replace(/\/[^/]+$/, ''), { recursive: true })
		fs.writeFileSync(outPath, JSON.stringify(schema, null, '\t'))
	}
}

main()
