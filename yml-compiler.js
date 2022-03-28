const fs = require('fs')
const pathjs = require('path')
const yaml = require('js-yaml')
const chokidar = require('chokidar')

function movePath(from, to, path) {
	return pathjs.resolve(to, pathjs.relative(from, path))
}

function compile() {
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
			obj = yaml.load(fs.readFileSync(file, 'utf-8'))
		} catch (err) {
			console.log(`Failed to read .yml file ${file}.`)
		}
		if (!obj) continue

		const outFile = movePath('./src/schemas/', './schemas/', file).replace('.yml', '.json')
		const outPath = pathjs.parse(outFile)
		// console.log(`${file} -> ${outFile}`)
		try {
			fs.mkdirSync(outPath.dir, { recursive: true })
		} catch (err) {}
		fs.writeFileSync(outFile, JSON.stringify(obj, null, '\t') || '{}')
	}

	console.log('Done!')
}

function main() {
	const watcher = chokidar.watch('./src/schemas/').on('change', () => {
		compile()
	})
}

main()
