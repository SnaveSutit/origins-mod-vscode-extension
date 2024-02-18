import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as pathjs from 'path'
import { type JSONSchema } from './schema'
import { MDFile } from './mdReader'
import * as chokidar from 'chokidar'
import * as terminalkit from 'terminal-kit'
const term = terminalkit.terminal

const SRC_DIR = 'src/schemas/'.replace(/\//g, pathjs.sep)
const OUT_DIR = 'schemas/'.replace(/\//g, pathjs.sep)

// import './definitions/json'

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
			const paths = buildQueue.splice(0)
			working = true
			await build(paths)
			term.brightGreen('Watching for changes...\n')
			working = false
		}
	}, 250)
}

async function build(schemasToBuild: string[]) {
	for (const schemaPath of schemasToBuild) {
		const outPath = schemaPath.replace(SRC_DIR, OUT_DIR)
		const fileName = pathjs.basename(outPath)
		term.brightCyan(`\nProcessing `).brightBlue(fileName).gray(` (${outPath})`)('\n')

		const contents: JSONSchema = await fs.readFile(schemaPath, 'utf-8').then(JSON.parse)

		if (contents.$docsUrl) {
			let mdFile: MDFile
			try {
				mdFile = await MDFile.fromDocsURL(contents.$docsUrl).read()
			} catch (e) {
				term.brightRed(`Failed to read ${contents.$docsUrl}:\n  ${e}\n`)
				continue
			}

			const propertyObjects: Array<NonNullable<(JSONSchema & { type: 'object' })['properties']>> =
				[]
			function getPropertyObjects(from: JSONSchema) {
				if (Array.isArray(from)) {
					for (const item of from) {
						getPropertyObjects(item)
					}
				} else if (typeof from === 'object') {
					if (from.properties) {
						propertyObjects.push(from.properties)
					}
					for (const val of Object.values(from)) {
						getPropertyObjects(val)
					}
				}
			}
			getPropertyObjects(contents)
			// console.log(propertyObjects)

			if (mdFile.fields.length > 0) {
				if (contents.type === 'object' && contents.properties) {
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
								.brightYellow(schemaPath)('\n')
						}
					}
				}
			}
		}

		let strContents = JSON.stringify(contents, null, '\t')

		strContents = strContents.replace(/\$\((.+?)\)/gm, substring => {
			substring = substring.slice(2, -1)

			let srcPath = SRC_DIR + substring.replace(':', pathjs.sep) + '.json'
			let subOutPath = srcPath.replace(SRC_DIR, OUT_DIR)
			if (!fsSync.existsSync(srcPath)) {
				term
					.brightRed('Unknown $ref ')
					.brightRed('$(')
					.brightYellow(substring)
					.brightRed(') in ')
					.brightYellow(schemaPath)('\n')
				return substring
			}

			subOutPath = pathjs.relative(pathjs.dirname(outPath), subOutPath)
			return pathjs.normalize(subOutPath).replace(/\\/g, '/')
		})

		await fs.mkdir(pathjs.dirname(outPath), { recursive: true })
		await fs.writeFile(outPath, strContents)
	}
}

void main()
