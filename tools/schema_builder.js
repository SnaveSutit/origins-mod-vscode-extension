const fs = require('fs')
const pathjs = require('path')
const yaml = require('js-yaml')
const chokidar = require('chokidar')

const formatJsonOutput = true
const srcSchemaPath = './src/schemas'
const compiledSchemaPath = './schemas'
let compiledSchemas = {}
let referenceErrors = []
// const metaActionSchemasPath = './src/meta_actions'
// const metaConditionSchemasPath = './src/meta_conditions'

class SchemaBuilderError extends Error {
	constructor(...args) {
		super(...args)
		this.name = 'schemaBuilderError'
	}
}

function normalizePath(path) {
	console.log('Normalizing Path: ' + path)
	const p = path.replaceAll('\\', '/')
	console.log('Normalized Path: ' + p)
	return p
}

function movePath(from, to, path) {
	return pathjs.resolve(to, pathjs.relative(from, path))
}

function format(str, dict = {}) {
	const keys = Object.keys(dict).sort((a, b) => b.length - a.length)
	for (const target of keys) str = str.replaceAll('$' + target, dict[target])
	return str
}

async function readYamlFile(path) {
	const stringContent = await fs.promises.readFile(path, { encoding: 'utf-8' })
	return yaml.load(stringContent)
}

async function writeJsonFile(path, obj) {
	await fs.promises.writeFile(path, JSON.stringify(obj, null, formatJsonOutput ? '\t' : null))
}

async function compileImportArrayConditional(stack, schemaPath, schema, args) {
	if (!args.condition)
		throw new SchemaBuilderError(`$IMPORT(${args.format}) missing required parameter "condition"`)
	const replace = args.replace
	const strCondition = JSON.stringify(args.condition)
	const allOfArray = []
	const parsed = pathjs.parse(args.path)
	const thenAdditions = args.thenAdditions
	if (parsed.ext) {
		throw new SchemaBuilderError(
			`$IMPORT(${args.format}) only supports directories. Attempted to import (${args.path})`
		)
	} else {
		await fs.promises.access(args.path)
		console.log(`Importing Directory "${args.path}" into "${parsed.base}"`)
		for (const fileName of await fs.promises.readdir(args.path)) {
			const filePath = pathjs.join(args.path, fileName)
			const parsedFilePath = pathjs.parse(filePath)
			const thisStrCondition = format(
				strCondition,
				Object.assign(
					{ schemaName: parsedFilePath.name },
					typeof replace == 'object' ? replace : {}
				)
			)
			const fileContents = await fs.promises.readFile(filePath, { encoding: 'utf-8' })
			const subSchemaData = yaml.load(fileContents)
			// Don't include unexported files in the allOf array
			if (subSchemaData['$DONT_EXPORT']) continue
			const parsedSchemaPath = pathjs.parse(schemaPath)
			allOfArray.push({
				if: JSON.parse(thisStrCondition),
				then: Object.assign(
					{
						$ref: normalizePath(
							pathjs.relative(parsedSchemaPath.dir, filePath.replace(/(.yml|.yaml)/, '.json'))
						),
					},
					thenAdditions || {}
				),
			})
			await compileSchema(filePath, stack)
		}
	}
	const parentObj = stack[stack.length - 2].value
	const parentArray = stack[stack.length - 3]
	// console.log(parentArray.type)
	if (parentArray.type != 'array') {
		throw new SchemaBuilderError(
			`Expected $IMPORT(${args.format}) in '${schemaPath}' to be inside of an allOf array.`
		)
	}
	const parentObjIndex = parentArray.value.indexOf(parentObj)
	parentArray.value.splice(parentObjIndex, 1)
	parentArray.value.splice(parentObjIndex, 0, ...allOfArray)
}

// Imports the provided files directly into the schema
async function compileImportArrayConditionalUnique(stack, schemaPath, schema, args) {
	if (!args.condition)
		throw new SchemaBuilderError(`$IMPORT(${args.format}) missing required parameter "condition"`)
	const replace = args.replace
	const strCondition = JSON.stringify(args.condition)
	const allOfArray = []
	const parsed = pathjs.parse(args.path)
	const thenAdditions = args.thenAdditions
	if (parsed.ext) {
		throw new SchemaBuilderError(
			`$IMPORT(${args.format}) only supports directories. Attempted to import (${args.path})`
		)
	} else {
		await fs.promises.access(args.path)
		console.log(`Importing Directory "${args.path}" into "${parsed.base}"`)
		for (const fileName of await fs.promises.readdir(args.path)) {
			const filePath = pathjs.join(args.path, fileName)
			const parsedFilePath = pathjs.parse(filePath)
			const fullReplace = Object.assign(
				{
					schemaName: parsedFilePath.name,
					metaParentTitle: schema?.title || getNearestTitle(stack),
					metaParentDescription: schema?.description || getNearestDescription(stack),
					metaParentMarkdownDescription:
						schema?.markdownDescription || getNearestMarkdownDescription(stack),
				},
				typeof replace == 'object' ? replace : {}
			)
			const thisStrCondition = format(strCondition, fullReplace)
			let subSchemaData = await compileSchema(filePath)
			const fileContents = format(JSON.stringify(subSchemaData), fullReplace).replaceAll(
				'\n',
				'\\n'
			)
			subSchemaData = JSON.parse(fileContents)
			allOfArray.push({
				if: JSON.parse(thisStrCondition),
				then: Object.assign(subSchemaData, thenAdditions || {}),
			})
		}
	}
	const parentObj = stack[stack.length - 2].value
	const parentArray = stack[stack.length - 3]
	// console.log(parentArray.type)
	if (parentArray.type != 'array') {
		throw new SchemaBuilderError(
			`Expected $IMPORT(${args.format}) in '${schemaPath}' to be inside of an allOf array.`
		)
	}
	const parentObjIndex = parentArray.value.indexOf(parentObj)
	parentArray.value.splice(parentObjIndex, 1)
	parentArray.value.splice(parentObjIndex, 0, ...allOfArray)
}

async function compileImportInclude(stack, schemaPath, schema, args) {
	const parsedSchemaPath = pathjs.parse(schemaPath)
	const parsedImportPath = pathjs.parse(args.path)
	if (parsedImportPath.ext && (parsedImportPath.ext == '.yml' || parsedImportPath.ext == '.yaml')) {
		const filePath = pathjs.join(args.path, fileName)
		await compileSchema(filePath, stack)
	} else {
		await fs.promises.access(args.path)
		console.log(`Importing Directory "${args.path}" into "${parsedSchemaPath.base}"`)
		for (const fileName of await fs.promises.readdir(args.path)) {
			const filePath = pathjs.join(args.path, fileName)
			// const parsedFilePath = pathjs.parse(filePath)
			await compileSchema(filePath, stack)
		}
	}
}

async function compileImportCall(stack, schemaPath, schema, args) {
	if (!args.path) throw new SchemaBuilderError('$IMPORT call missing required parameter "path"')
	// const path = args.path
	if (!args.format) throw new SchemaBuilderError('$IMPORT call missing required parameter "format"')
	switch (args.format) {
		case 'arrayConditional':
			await compileImportArrayConditional(stack, schemaPath, schema, args)
			break
		case 'arrayConditionalUnique':
			await compileImportArrayConditionalUnique(stack, schemaPath, schema, args)
			break
		case 'include':
			await compileImportInclude(stack, schemaPath, schema, args)
			break
	}
}

function getNearestTitle(stack) {
	const localStack = [...stack]
	const local = localStack.pop().value.title
	localStack.reverse()
	for (const item of localStack) {
		if (item.type == 'schema' && item.value.title) return item.value.title
	}
	return local
}

function getNearestDescription(stack) {
	const localStack = [...stack]
	const local = localStack.pop().value.description
	localStack.reverse()
	for (const item of localStack) {
		if (item.type == 'schema' && item.value.description) return item.value.description
	}
	return local
}

function getNearestMarkdownDescription(stack) {
	const localStack = [...stack]
	const local = localStack.pop()
	localStack.reverse()
	for (const item of localStack) {
		if (item.type == 'schema' && item.value.markdownDescription)
			return item.value.markdownDescription
	}
}

function getParentSchema(stack, schema) {
	// const reverseStack = [...stack].reverse()
	let schemaId = schema.$id
	// Get the parent schema of this object if it's not a schema
	if (schemaId == undefined) {
		for (const item of stack)
			if (item.type == 'schema') {
				schemaId = item.value.$id
				if (schemaId.includes('actor_action')) {
					console.log(schema)
					process.exit()
				}
				break
			}
	}
	// Get the parent of the schema
	for (const item of stack) {
		if (item.type == 'schema' && item.value.$id != schemaId) return item
	}
}

async function compileDescription(stack, schemaPath, schema, args) {
	const obj = stack[stack.length - 1].value
	const parentSchema = getParentSchema(stack, obj)
	const parsedSchemaPath = pathjs.parse(schemaPath)
	const folderName = pathjs.parse(parsedSchemaPath.dir).base
	const namespace = pathjs.parse(pathjs.parse(parsedSchemaPath.dir).dir).name
	try {
		if (obj.description) {
			obj.description = format(obj.description, {
				parentTitle: parentSchema?.value?.title || getNearestTitle(stack),
				parentDescription: parentSchema?.value?.description || getNearestDescription(stack),
				fileName: parsedSchemaPath.name,
				folderName,
				namespace,
			})
		}
		if (obj.markdownDescription) {
			obj.markdownDescription = format(obj.markdownDescription, {
				parentTitle: parentSchema?.value?.title || getNearestTitle(stack),
				parentDescription:
					parentSchema?.value?.markdownDescription || getNearestMarkdownDescription(stack),
				fileName: parsedSchemaPath.name,
				folderName,
				namespace,
			})
		}
		if (obj.const) {
			obj.const = format(obj.const, {
				fileName: parsedSchemaPath.name,
				folderName,
				namespace,
			})
		}
		if (obj.enum) {
			for (let i = 0; i < obj.enum.length; i++) {
				const v = obj.enum[i]
				if (typeof v == 'string')
					obj.enum[i] = format(v, {
						fileName: parsedSchemaPath.name,
						folderName,
						namespace,
					})
			}
		}
	} catch (e) {
		console.log(parentSchema)
		console.log(obj)
		console.error(e)
		process.exit()
	}
}

async function checkIfRefValid(stack, schemaPath, referencedPath) {
	if (referencedPath.startsWith('#')) return
	const obj = stack[stack.length - 2].value
	if (obj.$ignoreInvalidRef) {
		obj.$ignoreInvalidRef = undefined
		return
	}
	// console.log(schemaPath, referencedPath)
	const parsedSchemaPath = pathjs.parse(schemaPath)
	// console.log(pathjs.relative(srcSchemaPath, schemaPath))
	const reference = pathjs.resolve(parsedSchemaPath.dir, referencedPath)
	// console.log(reference)
	let fileFound = false
	await fs.promises
		.access(reference.replace('.json', '.yml'))
		.then(v => {
			fileFound = true
		})
		.catch(e => {})
	await fs.promises
		.access(reference.replace('.json', '.yaml'))
		.then(v => {
			fileFound = true
		})
		.catch(e => {})
	if (!fileFound)
		referenceErrors.push(
			`Invalid $ref target in ${schemaPath}:\n\t'${reference}' (${referencedPath})`
		)
}

async function compileSchema(schemaPath, previousStack = []) {
	// Don't compile things that have already been compiled
	if (compiledSchemas[schemaPath]) return compiledSchemas[schemaPath]

	const schema = await readYamlFile(schemaPath).catch(e => {
		if (e instanceof yaml.YAMLException) {
			console.log(`Failed to parse YAML file ${schemaPath}`)
			throw e
		}
	})
	// Update schema ID
	schema['$id'] = normalizePath(
		'https://snavesutit.github.io/origins-mod-schemas/schemas/' +
			pathjs.relative(srcSchemaPath, schemaPath).replace(/(.yml|.yaml)/, '.json')
	)

	const addonCalls = []

	async function recurse(obj, stack) {
		if (obj == null || obj == undefined) return
		if (Array.isArray(obj)) {
			for (const item of obj) {
				if (Array.isArray(item) || typeof item == 'object') {
					stack.push({ type: 'array', value: item })
					await recurse(item, stack)
					stack.pop()
				}
			}
		} else {
			// let descriptionFound = false
			for (const [k, v] of Object.entries(obj)) {
				// Actual compilation/custom language logic happens here
				switch (k) {
					case '$IMPORT':
						stack.push({ type: 'object', value: v })
						addonCalls.push([compileImportCall, [...stack], schemaPath, schema, v])
						stack.pop()
						return
					case 'description':
					case 'markdownDescription':
						if (typeof v != 'string') break
						// if (descriptionFound) break
						addonCalls.push([compileDescription, [...stack], schemaPath, schema, v])
						// descriptionFound = true
						break
					case '$ref':
						stack.push({ type: 'object', value: v })
						addonCalls.push([checkIfRefValid, [...stack], schemaPath, v])
						stack.pop()
						break
				}

				if (Array.isArray(v) || typeof v == 'object') {
					stack.push({ type: 'array', value: v })
					await recurse(v, stack)
					stack.pop()
				}
			}
		}
	}

	await recurse(schema, [...previousStack, { type: 'schema', value: schema }])

	for (const [func, ...args] of addonCalls) {
		await func(...args)
	}

	compiledSchemas[schemaPath] = schema
	// Don't export schemas with the $DONT_EXPORT flag set to true
	if (schema['$DONT_EXPORT']) return schema

	let outputFilePath = movePath(srcSchemaPath, compiledSchemaPath, schemaPath).replace(
		/(.yml|.yaml)/,
		'.json'
	)
	const parsedOutputFilePath = pathjs.parse(outputFilePath)
	await fs.promises.mkdir(parsedOutputFilePath.dir, { recursive: true })
	await writeJsonFile(outputFilePath, schema)
	return schema
}

async function buildSchemas() {
	compiledSchemas = []
	referenceErrors = []

	await fs.promises.rm(compiledSchemaPath, { recursive: true })
	await fs.promises.mkdir(compiledSchemaPath, { recursive: true })

	const fileNames = await fs.promises.readdir(srcSchemaPath)
	for (const fileName of fileNames) {
		const filePath = pathjs.join(srcSchemaPath, fileName)
		const parsed = pathjs.parse(filePath)
		if (parsed.ext == '.yml') {
			await compileSchema(filePath)
		}
	}
	for (const error of referenceErrors) console.error(error)
}

async function safeBuild() {
	await buildSchemas().catch(e => {
		if (e.name == 'schemaBuilderError') {
			console.log(e.message)
		} else {
			console.error(e)
		}
	})
}

let building = false
async function main() {
	await safeBuild()

	if (process.argv.find(v => v === '--once')) process.exit()

	console.log('Watching for changes...')
	const watcher = chokidar.watch('./src/schemas/').on('change', async () => {
		if (building) return
		building = true
		await safeBuild()
		building = false
		console.log('Watching for changes...')
	})
}

main()
