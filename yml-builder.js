const fs = require('fs')
const pathjs = require('path')
const yaml = require('js-yaml')
const chokidar = require('chokidar')

function movePath(from, to, path) {
	return pathjs.resolve(to, pathjs.relative(from, path))
}

const metaActionFolder = './src/meta_actions/'
const metaConditionFolder = './src/meta_conditions/'

const if_else = `
  - if:
      properties:
        type:
          oneOf:
            - const: apoli:$metaName
            - const: origins:$metaName
    then:
      $ref: ./$names/$metaName.json`

function compile() {
	const metaActions = fs.readdirSync(metaActionFolder).map(f => pathjs.join(metaActionFolder, f))
	const metaConditions = fs
		.readdirSync(metaConditionFolder)
		.map(f => pathjs.join(metaConditionFolder, f))

	const files = []
	function recurse(path) {
		const filenames = fs.readdirSync(path)

		for (const name of filenames) {
			const localPath = pathjs.join(path, name)
			const stat = fs.lstatSync(localPath)
			if (stat.isFile()) {
				files.push(localPath)
				continue
			}
			recurse(localPath)
		}
	}
	recurse('./src/schemas/')
	console.log('Converting Schemas...')
	fs.rmSync('./schemas/', { recursive: true, force: true })

	for (const file of files) {
		let obj
		try {
			let content = fs.readFileSync(file, 'utf-8')
			let parsed = pathjs.parse(file)

			let metaMatch = content.match(/- INCLUDE: ?(.+)/)
			if (metaMatch) {
				content = content.replace(metaMatch[0], '')
				let optionsPath = metaMatch[1]
				let options = fs.readdirSync(optionsPath).map(f => pathjs.join(optionsPath, f))

				for (const option of options) {
					let parsedOption = pathjs.parse(option)
					// Add the if_else statement for this action/condition to the parent
					content += if_else
						.replaceAll('$metaName', parsedOption.name)
						.replaceAll('$name', parsed.name)
				}
			}

			metaMatch = content.match('- INCLUDE_META_ACTIONS')
			if (metaMatch) {
				content = content.replace(metaMatch[0], '')

				for (const metaAction of metaActions) {
					let parsedMetaAction = pathjs.parse(metaAction)
					// Add the if_else statement for this meta action to the parent action
					content += if_else
						.replaceAll('$metaName', parsedMetaAction.name)
						.replaceAll('$name', parsed.name)
					// Add this meta action's file to the parent action's action folder
					try {
						let metaContent = fs
							.readFileSync(metaAction, { encoding: 'utf-8' })
							.replaceAll('$ACTION_TYPE$', parsed.name)
							.replaceAll('$CONDITION_TYPE$', parsed.name.replace('action', 'condition'))
						let thisDir = pathjs.join('./schemas/', parsed.name + 's')
						try {
							fs.mkdirSync(thisDir, { recursive: true })
						} catch (e) {}
						fs.writeFileSync(
							pathjs.join(thisDir, parsedMetaAction.name + '.json'),
							JSON.stringify(yaml.load(metaContent), null, '\t')
						)
					} catch (e) {
						console.error(e)
					}
				}
			}

			metaMatch = content.match('- INCLUDE_META_CONDITIONS')
			if (metaMatch) {
				content = content.replace('- INCLUDE_META_CONDITIONS', '')

				for (const metaCondition of metaConditions) {
					let parsedMetaConditions = pathjs.parse(metaCondition)
					// Add the if_else statement for this meta action to the parent action
					content += if_else
						.replaceAll('$metaName', parsedMetaConditions.name)
						.replaceAll('$name', parsed.name)
					// Add this meta action's file to the parent action's action folder
					try {
						let metaContent = fs
							.readFileSync(metaCondition, { encoding: 'utf-8' })
							.replaceAll('$ACTION_TYPE$', parsed.name)
							.replaceAll('$CONDITION_TYPE$', parsed.name.replace('action', 'condition'))
						let thisDir = pathjs.join('./schemas/', parsed.name + 's')
						try {
							fs.mkdirSync(thisDir, { recursive: true })
						} catch (e) {}
						fs.writeFileSync(
							pathjs.join(thisDir, parsedMetaConditions.name + '.json'),
							JSON.stringify(yaml.load(metaContent), null, '\t')
						)
					} catch (e) {
						console.error(e)
					}
				}
			}

			obj = yaml.load(content)
		} catch (e) {
			console.log(`Failed to read .yml file ${file}.`)
			console.error(e)
		}
		if (!obj) continue

		const outFile = movePath('./src/schemas/', './schemas/', file).replace('.yml', '.json')
		const outPath = pathjs.parse(outFile)
		// console.log(`${file} -> ${outFile}`)
		try {
			fs.mkdirSync(outPath.dir, { recursive: true })
		} catch (e) {}

		fs.writeFileSync(outFile, JSON.stringify(obj, null, '\t') || '{}')
	}

	console.log('Done!')
}

function main() {
	compile()

	if (process.argv.find(v => v === '--once')) process.exit()

	console.log('Watching for changes...')
	const watcher = chokidar.watch('./src/schemas/').on('change', () => {
		compile()
		console.log('Watching for changes...')
	})
}

main()
