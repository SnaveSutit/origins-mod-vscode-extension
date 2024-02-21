import * as fs from 'fs'
import { MDFile, apugliDocsUrl, originsDocsUrl } from './schemaGenerator/mdReader'
import { JSONSchema, SimpleSchemaType } from './schemaGenerator/schema'
// const docsPath = 'D:/github-repos/origins-docs/docs/types'
// const docsUrl = `${originsDocsUrl}types`
const docsPath = 'D:/github-repos/apugli-docs/docs/types'
const docsUrl = `${apugliDocsUrl}types`
const outDir = './debug_out'

function attemptToMapType(
	name: string,
	property: NonNullable<JSONSchema['properties']>[string] & { type?: string },
	mdFile: MDFile
) {
	const field = mdFile.getField(name)
	let type = property.type?.toLowerCase()
	if (!type) return
	let match: RegExpMatchArray | null
	let plural = false

	if (name.endsWith('s')) {
		const singular = mdFile.getField(name.slice(0, -1))
		if (singular) {
			plural = true
			name = name.slice(0, -1)
			type = singular.type.toLowerCase()
		}
	}

	if (name === 'entity_type' || name === 'entity_id') {
		if (type.includes('identifier')) {
			name = name.toLowerCase()
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/entity_identifier)'
		}
	} else if (name === 'tag') {
		if (type.includes('nbt') || field?.description.includes('NBT')) {
			delete property.type
			property.$ref = '$ref(apoli:types/nbt)'
		} else {
			delete property.type
			property.$ref = '$ref(apoli:types/identifier)'
		}
	} else if (name === 'key') {
		if (type.includes('key')) {
			delete property.type
			property.$ref = '$ref(apoli:types/key)'
		}
	} else if (name === 'particle') {
		if (type.includes('particle effect')) {
			delete property.type
			property.$ref = '$ref(apoli:types/particle_effect)'
		} else if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/particle_identifier)'
		}
	} else if (name === 'sound') {
		if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/sound_identifier)'
		} else if (type.includes('weighted sound event')) {
			delete property.type
			property.$ref = '$ref(apugli:types/weighted_sound_event)'
		}
	} else if (name === 'effect') {
		if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/status_effect_identifier)'
		}
	} else if (name === 'damage_type') {
		if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/damage_source)'
		}
	} else if (name === 'shape') {
		if (type === 'string') {
			delete property.type
			property.$ref = '$ref(apoli:types/shape)'
		}
	} else if (name === 'space') {
		if (type === 'string') {
			delete property.type
			property.$ref = '$ref(apoli:types/space)'
		}
	} else if (name === 'side') {
		if (type === 'string') {
			delete property.type
			property.$ref = '$ref(apoli:types/side)'
		}
	} else if (name === 'texture_location') {
		if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/texture_location)'
		}
	} else if (name === 'hud_render') {
		if (type.includes('hud render')) {
			delete property.type
			property.$ref = '$ref(apoli:types/hud_render)'
		}
	} else if (name === 'slot') {
		if (type === 'string') {
			delete property.type
			property.$ref = '$ref(apoli:types/slot)'
		}
	} else if (
		(match = name.match(/(bientity|entity|block|damage|item|fluid|biome)_(action|condition)/)) ||
		(match = type.match(/(bientity|entity|block|damage|item|fluid|biome)[_ ](action|condition)/))
	) {
		delete property.type
		property.$ref = `$ref(apoli:${match[0].replaceAll(' ', '_')})`
	} else if (type.includes('identifier')) {
		delete property.type
		property.$ref = `$ref(apoli:types/identifier)`
	} else if (type === 'float') {
		property.type = 'number'
		if (property.default) property.default = Number(property.default)
	} else if (type === 'integer' && property.default !== undefined) {
		property.default = Number(property.default)
	} else if (type === 'attribute modifier') {
		delete property.type
		property.$ref = `$ref(apoli:types/attribute_modifier)`
	} else if (type === 'space') {
		delete property.type
		property.$ref = `$ref(apoli:types/space)`
	} else if (type === 'boolean' && typeof property.default === 'string') {
		property.default = property.default === 'true'
	} else if (type === 'comparison') {
		delete property.type
		property.$ref = '$ref(apoli:types/comparison)'
	} else if (type === 'vector') {
		delete property.type
		property.$ref = '$ref(apoli:types/vector)'
	} else if (type.includes('food component')) {
		delete property.type
		property.$ref = '$ref(apoli:types/food_component)'
	} else if (type.includes('item stack')) {
		delete property.type
		property.$ref = '$ref(apoli:types/item_stack)'
	} else if (
		name === 'items' &&
		type === 'array' &&
		field?.subTypes.find(s => s.name.toLowerCase().match(/identifier|identifiers/))
	) {
		property.type = 'array'
		property.items = {
			$ref: '$ref(apoli:types/autocomplete_helpers/item_identifier)',
		}
	} else if (
		name === 'item_tags' &&
		type === 'array' &&
		field?.subTypes.find(s => s.name.toLowerCase().match(/identifier|identifiers/))
	) {
		property.type = 'array'
		property.items = {
			$ref: '$ref(apoli:types/identifier)',
		}
	} else if (type === 'string') {
		const matches = field?.description.matchAll(/`"?(.+?)"?`/g)
		const values: string[] = []
		if (matches) {
			for (const value of matches) {
				values.push(value[1])
			}
			property.enum = values
		}
	}

	if (plural) {
		const oldProperty = JSON.parse(JSON.stringify(property))
		for (const key of Object.keys(property)) {
			delete property[key]
		}
		property.type = 'array'
		property.items = oldProperty
	}
}

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
		schema.$docsUrl = `${docsUrl}${file.replace(docsPath, '').replace('.md', '')}/`
		if (mdFile.fields.length > 0) {
			schema.type = 'object'
			schema.$IGNORED_PROPERTIES = []
			schema.required = []
			schema.properties = {}
			for (const field of mdFile.fields) {
				if (field.depreciated) {
					schema.$IGNORED_PROPERTIES.push(field.name)
					continue
				}

				const property: NonNullable<JSONSchema['properties']>[string] = {}
				property.type = field.type.toLowerCase() as SimpleSchemaType

				if (!field.optional) {
					if (field.defaultValue === undefined) {
						schema.required.push(field.name)
					} else {
						property.default = field.defaultValue
					}
				}

				attemptToMapType(field.name, property as any, mdFile)

				schema.properties[field.name] = property
			}
			if (schema.required.length === 0) delete schema.required
			if (schema.$IGNORED_PROPERTIES.length === 0) delete schema.$IGNORED_PROPERTIES
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
