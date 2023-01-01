const fs = require('fs')
const pathjs = require('path')
const yaml = require('js-yaml')
const chokidar = require('chokidar')

const formatJsonOutput = true
const srcSchemaPath = './src/schemas'
const compiledSchemaPath = './schemas'
let compiledSchemas = {}
// const metaActionSchemasPath = './src/meta_actions'
// const metaConditionSchemasPath = './src/meta_conditions'

class SchemaBuilderError extends Error {
	constructor(...args) {
		super(...args)
		this.name = 'schemaBuilderError'
	}
}

function cleanPath(path) {
	return path.replaceAll('\\', '/')
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

async function compileImportAllOfIfThen(call) {
	if (!call.args.condition)
		throw new SchemaBuilderError(
			`$IMPORT call with format "${call.args.format}" missing required parameter "condition"`
		)
	const replace = call.args.replace
	const strCondition = JSON.stringify(call.args.condition)
	const allOfArray = []
	const parsed = pathjs.parse(call.args.path)
	if (parsed.ext) {
		throw new SchemaBuilderError(
			`$IMPORT allOfIfThen only supports directories. Attempted to import (${call.args.path})`
		)
	} else {
		await fs.promises.access(call.args.path)
		console.log(`Importing Directory "${call.args.path}" into "${call.parsed.base}"`)
		for (const fileName of await fs.promises.readdir(call.args.path)) {
			const filePath = pathjs.join(call.args.path, fileName)
			const parsedFilePath = pathjs.parse(filePath)
			const thisStrCondition = format(
				strCondition,
				Object.assign(
					{ schemaName: parsedFilePath.name },
					typeof replace == 'object' ? replace : {}
				)
			)
			allOfArray.push({
				if: JSON.parse(thisStrCondition),
				then: {
					$ref: cleanPath(
						pathjs.relative(call.parsed.dir, filePath.replace(/(.yml|.yaml)/, '.json'))
					),
				},
			})
			await compileSchema(filePath)
		}
	}
	const parentObj = call.stack[call.stack.length - 2]
	parentObj['$IMPORT'] = undefined
	parentObj['allOf'] = allOfArray
}

// Imports the provided files directly into the schema
async function compileImportAllOfIfThenUnique(call) {
	if (!call.args.condition)
		throw new SchemaBuilderError(
			`$IMPORT call with format "${call.args.format}" missing required parameter "condition"`
		)
	const replace = call.args.replace
	const strCondition = JSON.stringify(call.args.condition)
	const allOfArray = []
	const parsed = pathjs.parse(call.args.path)
	if (parsed.ext) {
		throw new SchemaBuilderError(
			`$IMPORT allOfIfThen only supports directories. Attempted to import (${call.args.path})`
		)
	} else {
		await fs.promises.access(call.args.path)
		console.log(`Importing Directory "${call.args.path}" into "${call.parsed.base}"`)
		for (const fileName of await fs.promises.readdir(call.args.path)) {
			const filePath = pathjs.join(call.args.path, fileName)
			const parsedFilePath = pathjs.parse(filePath)
			const fullReplace = Object.assign(
				{ schemaName: parsedFilePath.name },
				typeof replace == 'object' ? replace : {}
			)
			const fileContents = format(
				await fs.promises.readFile(filePath, { encoding: 'utf-8' }),
				fullReplace
			)
			const thisStrCondition = format(strCondition, fullReplace)
			allOfArray.push({
				if: JSON.parse(thisStrCondition),
				then: yaml.load(fileContents),
			})
			// await compileSchema(filePath)
		}
	}
	const parentObj = call.stack[call.stack.length - 2]
	parentObj['$IMPORT'] = undefined
	parentObj['allOf'] = allOfArray
}

async function compileImportInclude(call) {
	const parsed = pathjs.parse(call.args.path)
	if (parsed.ext && (parsed.ext == '.yml' || parsed.ext == '.yaml')) {
		const filePath = pathjs.join(call.args.path, fileName)
		await compileSchema(filePath)
	} else {
		await fs.promises.access(call.args.path)
		console.log(`Importing Directory "${call.args.path}" into "${call.parsed.base}"`)
		for (const fileName of await fs.promises.readdir(call.args.path)) {
			const filePath = pathjs.join(call.args.path, fileName)
			// const parsedFilePath = pathjs.parse(filePath)
			await compileSchema(filePath)
		}
	}
}

async function compileImportCall(call) {
	if (!call.args.path)
		throw new SchemaBuilderError('$IMPORT call missing required parameter "path"')
	// const path = call.args.path
	if (!call.args.format)
		throw new SchemaBuilderError('$IMPORT call missing required parameter "format"')
	switch (call.args.format) {
		case 'allOfIfThen': {
			await compileImportAllOfIfThen(call)
			break
		}
		case 'allOfIfThenUnique': {
			await compileImportAllOfIfThenUnique(call)
			break
		}
		case 'include': {
			await compileImportInclude(call)
			break
		}
	}
}

async function compileSchema(path) {
	// Don't compile things that have already been compiled
	if (compiledSchemas[path]) return compiledSchemas[path]

	const parsed = pathjs.parse(path)
	const schema = await readYamlFile(path)

	const importCalls = []

	function recurse(stack) {
		let obj = stack[stack.length - 1]
		if (obj == null || obj == undefined) return
		if (Array.isArray(obj)) {
			for (const item of obj) {
				if (Array.isArray(item) || typeof item == 'object') {
					stack.push(item)
					recurse(stack)
					stack.pop()
				}
			}
		} else {
			for (const [k, v] of Object.entries(obj)) {
				if (k == '$IMPORT') {
					stack.push(v)
					importCalls.push({
						stack: [...stack],
						parsed,
						args: v,
					})
					stack.pop()
					return
				}
				if (Array.isArray(v) || typeof v == 'object') {
					stack.push(v)
					recurse(stack)
					stack.pop()
				}
			}
		}
	}

	recurse([schema])

	for (const call of importCalls) {
		await compileImportCall(call)
	}

	compiledSchemas[path] = schema
	// Don't export schemas with the $DONT_EXPORT flag set to true
	if (schema['$DONT_EXPORT']) return schema

	let outputFilePath = movePath(srcSchemaPath, compiledSchemaPath, path).replace(
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
