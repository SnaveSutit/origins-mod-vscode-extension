import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as pathjs from 'path'
import { JSONSchemaPreProcessorAdditions, type JSONSchema } from './schema'
import { MDFile } from './mdReader'
import * as chokidar from 'chokidar'
import * as terminalkit from 'terminal-kit'
const term = terminalkit.terminal

const SRC_DIR = 'src/schemas/'.replace(/\//g, pathjs.sep)
const OUT_DIR = 'schemas/'.replace(/\//g, pathjs.sep)

function collectPropertyObjects(
	schema: JSONSchema,
	objects: Array<NonNullable<(JSONSchema & { type: 'object' })['properties']>>
) {
	if (Array.isArray(schema)) {
		for (const item of schema) {
			collectPropertyObjects(item, objects)
		}
	} else if (typeof schema === 'object') {
		if (schema.properties) {
			objects.push(schema.properties)
		}
		for (const val of Object.values(schema)) {
			collectPropertyObjects(val, objects)
		}
	}
	return objects
}

async function processSchemaProperties(schema: JSONSchema, path: string) {
	if (schema.$docsUrl) {
		let mdFile: MDFile
		try {
			mdFile = await MDFile.fromDocsURL(schema.$docsUrl).fetchContent()
		} catch (e) {
			term.brightRed(`Failed to read ${schema.$docsUrl}:\n  ${e}\n`)
			return
		}

		const propertyObjects = collectPropertyObjects(schema, [])

		if (mdFile.fields.length > 0) {
			if (schema.type !== 'object') {
				term
					.brightRed('Schema ')
					.brightYellow(path)
					.brightRed(' is not an object, but has fields in ')
					.brightYellow(mdFile.path)('\n')
			}
			const foundFields: string[] = []
			for (const propObj of propertyObjects) {
				for (const field of mdFile.fields) {
					if (!propObj[field.name]) continue
					foundFields.push(field.name)
					propObj[field.name].description = field.description
				}
			}
			// for (const prop in contents.properties) {
			// 	if (!mdFile.fields.find(f => f.name === prop)) {
			// 		term
			// 			.brightRed('Found extra field ')
			// 			.brightYellow(prop)
			// 			.brightRed(' in ')
			// 			.brightYellow(mdFile.path)('\n')
			// 	}
			// }
			for (const field of mdFile.fields) {
				if (!foundFields.includes(field.name)) {
					term
						.brightRed('Field ')
						.brightYellow(field.name)
						.brightRed(' is missing from ')
						.brightYellow(path)('\n')
				}
			}
		}
	}
}

function processImportFilesIntoArray(
	layer: JSONSchema,
	options: ProcessSchemaOptions,
	importOptions: JSONSchemaPreProcessorAdditions['$IMPORT'] & { type: 'import_files_into_array' }
) {
	const path = SRC_DIR + importOptions.path.replace(/\$ref\((.+)\)/, '$1').replace(':', '/')
	const stringStructure = JSON.stringify(importOptions.schemaStructure)

	if (layer[importOptions.output_key] === undefined) {
		throw new Error(
			`$IMPORT: output_key '${importOptions.output_key}' not found in schema:\n  ${layer}`
		)
	}

	let files: string[] = []
	try {
		files = fsSync.readdirSync(path).filter(f => f.endsWith('.json'))
	} catch (e) {
		throw new Error(`Failed to process $IMPORT while trying to read directory:\n  ${e}`)
	}

	for (const file of files) {
		const fileName = file.replace('.json', '')
		const outFilePath = (path + '/' + file).replace(SRC_DIR, OUT_DIR)
		const refPath = pathjs
			.relative(pathjs.dirname(options.outPath), outFilePath)
			.replace(/\\/g, '/')
		const structure = stringStructure
			.replace(/\$\$fileRef/g, refPath)
			.replace(/\$\$fileName/g, fileName)

		layer[importOptions.output_key].push(JSON.parse(structure))
	}

	layer.$IMPORT = undefined
}

function processSchemaLayer(layer: JSONSchema, options: ProcessSchemaOptions) {
	if (layer.$IMPORT) {
		switch (layer.$IMPORT.type) {
			case 'import_files_into_array':
				processImportFilesIntoArray(layer, options, layer.$IMPORT)
				break
		}
	}
}

interface ProcessSchemaOptions {
	schemaPath: string
	outPath: string
}

function processSchema(schema: JSONSchema, options: ProcessSchemaOptions) {
	if (Array.isArray(schema)) {
		for (const item of schema) {
			processSchema(item, options)
		}
	} else if (typeof schema === 'object') {
		processSchemaLayer(schema, options)
		for (const val of Object.values(schema)) {
			processSchema(val, options)
		}
	}
}

async function build(schemasToBuild: string[]) {
	const fileIOQueue: Array<{ path: string; content: string }> = []

	for (const schemaPath of schemasToBuild) {
		const outPath = schemaPath.replace(SRC_DIR, OUT_DIR)
		const fileName = pathjs.basename(outPath)
		term.brightCyan(`\nProcessing `).brightBlue(fileName).gray(` (${outPath})`)('\n')

		const contents: JSONSchema = await fs.readFile(schemaPath, 'utf-8').then(JSON.parse)

		processSchema(contents, { schemaPath, outPath })
		await processSchemaProperties(contents, schemaPath)

		let strContents = JSON.stringify(contents, null, '\t')
		strContents = strContents.replace(/\$ref\((.+?)\)/gm, substring => {
			substring = substring.slice(5, -1)
			let srcPath = SRC_DIR + substring.replace(':', pathjs.sep) + '.json'
			let subOutPath = srcPath.replace(SRC_DIR, OUT_DIR)

			if (!fsSync.existsSync(srcPath)) {
				term
					.brightRed('Unknown schema ')
					.brightRed('$ref(')
					.brightYellow(substring)
					.brightRed(') referenced in ')
					.brightYellow(schemaPath)('\n')
				return substring
			}

			subOutPath = pathjs.relative(pathjs.dirname(outPath), subOutPath)
			return pathjs.normalize(subOutPath).replace(/\\/g, '/')
		})

		fileIOQueue.push({ path: outPath, content: strContents })
	}

	for (const { path, content } of fileIOQueue) {
		await fs.mkdir(pathjs.dirname(path), { recursive: true })
		await fs.writeFile(path, content)
	}
}

async function main() {
	// await fs.writeFile('debug-out.json', JSON.stringify(schemas, null, '\t'))

	const schemasToBuild: string[] = []
	async function recurse(path: string) {
		for (const file of await fs.readdir(path)) {
			const filePath = pathjs.join(path, file)
			if (filePath.endsWith('.json')) {
				schemasToBuild.push(filePath)
			} else if ((await fs.stat(filePath)).isDirectory()) {
				await recurse(filePath)
			}
		}
	}
	await recurse(SRC_DIR)

	const watcher = chokidar.watch(SRC_DIR)
	const deleteQueue: string[] = []
	const buildQueue: string[] = []
	watcher
		.on('add', async path => {
			if (path.endsWith('.json')) {
				buildQueue.push(path)
			}
		})
		.on('change', async path => {
			if (path.endsWith('.json')) {
				buildQueue.push(path)
			}
		})
		.on('unlink', async path => {
			if (path.endsWith('.json')) {
				const outPath = path.replace(SRC_DIR, OUT_DIR)
				if (fsSync.existsSync(outPath)) {
					deleteQueue.push(outPath)
				}
			}
		})

	let working = false
	let lastBuildErrored = false
	setInterval(async () => {
		if (working) return

		if (deleteQueue.length > 0) {
			const path = deleteQueue.shift()!
			term.brightRed('Deleting ').brightYellow(path)('\n')
			working = true
			await fs.unlink(path)
			term.brightGreen('Watching for changes...\n')
			working = false
		}

		if (buildQueue.length > 0) {
			let paths = buildQueue.splice(0)
			working = true

			if (lastBuildErrored) {
				for (const [dir, files] of Object.entries(watcher.getWatched())) {
					for (const file of files) {
						if (file.endsWith('.json')) {
							paths.push(pathjs.join(dir, file))
						}
					}
				}
				lastBuildErrored = false
			}

			await build(paths).catch(e => {
				term.brightRed('Failed to build schemas:\n  ').brightRed(e)('\n')
				lastBuildErrored = true
			})
			term.brightGreen('Watching for changes...\n')
			working = false
		}
	}, 250)
}

void main()
