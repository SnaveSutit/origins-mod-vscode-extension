// import { dataTypes } from './dataTypes'
import { JSONSchema } from './schema'
import * as fs from 'fs'
import * as terminalkit from 'terminal-kit'
const term = terminalkit.terminal

export const rawGithubUrl = 'https://raw.githubusercontent.com/apace100/origins-docs/latest/docs/'
export const originsDocsUrl = 'https://origins.readthedocs.io/en/latest/'
export const apugliDocsUrl = 'https://apugli.readthedocs.io/en/latest/'
export const epoliDocsUrl = 'https://epoli-docs.readthedocs.io/en/latest/'
export const eggolibDocsUrl = 'https://eggolib.github.io/latest/'
export const skillfulDocsUrl = 'https://skillful-docs.readthedocs.io/en/latest/'
// export const extraoriginsDocsUrl = ''

const linkText = /\[(?<name>[^\n\[]+?)\]\((?<target>[^\n ]+?)\)/

const descriptionRegex = /^#\s+(?<title>.+)(?<description>[^]+?)###\s+.+?$/gm
const fieldTitleRegex = /Field\s*\|\s*Type\s*\|\s*Default\s*\|\s*Description\n-+\|-+\|-+\|-+\n/gm
const fieldCaptureRegex =
	/^(?<field>[^|\n\s]+?)\s*\|\s*(?<type>[^|\n]+?)\s*\|\s*(?<defaultValue>[^|\n]+?)?\s*\|\s*(?<description>[^|\n]+?)$/gm

const valuesTitleRegex = /Value\s+?\| Description\n-+\|-+\n/gm
const valueCaptureRegex = /^(?<value>[^|]+?)\s*\|\s*(?<description>[^|\n]+?)$/gm

export function parseMDUrl(url: string): { name: string; target: string } | undefined {
	const match = url.match(linkText)
	if (!match) return
	return match.groups as { name: string; target: string }
}

export function pathToUrl(from: string, path: string) {
	const url = new URL(path, from)
	return url.href
}

function processDescriptionLinks(description: string, mdFile: MDFile) {
	const links = description.match(linkText)
	if (!links) return description
	for (const link of links) {
		const url = parseMDUrl(link)
		if (!url) continue
		description = description.replace(link, `[${url.name}](${mdFile.docsUrl})`)
	}
	return description
}

export class Field {
	public optional: boolean = false
	public name: string
	public type: string = ''
	public typePath: string = ''
	public defaultValue: undefined | string = undefined
	public mdFile: MDFile

	constructor(
		name: string,
		type: string,
		defaultValue: string,
		public description: string,
		mdFile: MDFile
	) {
		this.name = name.replaceAll('`', '')
		this.description = description.trim()
		this.parseType(type)
		this.parseDefaultValue(defaultValue)
		this.mdFile = mdFile
	}

	private parseType(type: string) {
		if (type.startsWith('[Array')) {
			const type2 = type.split(' of ')[1].trim()
			this.type = 'Array'
			const url = parseMDUrl(type2)
			if (!url) throw new Error(`Failed to parse type '${type2}' for Array field '${this.name}'`)
			this.typePath = url.target
			return
		} else if (type.startsWith('[Object')) {
			this.type = 'Object'
			this.typePath = 'types/data_types/object.md'
			return
		} else if (type === '[Bi-entity Condition Type]') {
			// There is a typo in power_type/particle.md...😔
			this.type = 'bi entity condition type'
			this.typePath = 'types/bientity_condition_types.md'
			return
		} else if (type.includes(' or ')) {
			const types = type.split(' or ')
			if (types.length > 2)
				throw new Error(`Failed to parse type '${type}' for field '${this.name}'`)
			this.type = 'Union'
			this.typePath = types.map(type => parseMDUrl(type)?.target).join(', ')
			return
		}
		const url = parseMDUrl(type)
		if (!url) throw new Error(`Failed to parse type '${type}' for field '${this.name}'`)
		this.type = url.name
		this.typePath = url.target
	}

	private parseDefaultValue(defaultValue: string) {
		if (!defaultValue) return
		if (defaultValue.toLowerCase().includes(`optional`)) {
			this.optional = true
			return
		}
		this.defaultValue = defaultValue.replaceAll('`', '')
	}

	get ref() {
		return './' + this.typePath.replace('.md', '.json')
	}
}

export class MDFile {
	public content: string = ''
	public id: string = ''
	public title: string = ''
	public description: string = ''
	public fields: Field[] = []
	public values: { value: string; description: string }[] = []
	public url: string
	private _docsUrl: string = ''

	constructor(public path: string, docsUrl?: string) {
		this.url = pathToUrl(rawGithubUrl, path)
		this._docsUrl = docsUrl || pathToUrl(originsDocsUrl, path)
	}

	public static fromRawURL(url: string) {
		const path = url.replace(rawGithubUrl, '')
		return new MDFile(path)
	}

	public static fromDocsURL(url: string) {
		let docsUrl: string
		if (url.includes(originsDocsUrl)) docsUrl = originsDocsUrl
		else if (url.includes(apugliDocsUrl)) docsUrl = apugliDocsUrl
		else if (url.includes(epoliDocsUrl)) docsUrl = epoliDocsUrl
		else if (url.includes(eggolibDocsUrl)) docsUrl = eggolibDocsUrl
		else if (url.includes(skillfulDocsUrl)) docsUrl = skillfulDocsUrl
		else throw new Error(`Failed to parse docs url '${url}'`)
		let path = url
			.replace(originsDocsUrl, '')
			.replace(apugliDocsUrl, '')
			.replace(epoliDocsUrl, '')
			.replace(eggolibDocsUrl, '')
			.replace(skillfulDocsUrl, '')

		if (path.endsWith('/')) path = path.slice(0, -1) + '.md'
		return new MDFile(path, docsUrl)
	}

	public static fromFile(path: string) {
		term.gray(`Reading Markdown File `).brightBlue(path).gray('...\n')

		const file = new MDFile(path.replace(/\\/g, '/'))

		file.content = fs.readFileSync(path, 'utf-8')
		if (!file.content || file.content.includes('404: Not Found'))
			throw new Error(`Failed to fetch content of '${file.path}': ${file.content}`)
		file.content = file.content.replace(/\r/g, '')

		try {
			file.id = file.path.split('/').pop()!.replace('.md', '')
			file.captureDescription()
			file.captureFields()
			file.captureValues()
		} catch (e: any) {
			throw new Error(`Failed to parse content of '${file.path}': ${e.message}`)
		}

		return file
	}

	public async fetchContent(): Promise<MDFile> {
		const url = rawGithubUrl + this.path
		// term.gray(`Reading Markdown File `).brightBlue(url).gray('...\n')

		this.content = await fetch(url).then(res => res.text())
		if (!this.content || this.content.includes('404: Not Found'))
			throw new Error(`Failed to fetch content of '${this.path}': ${this.content}`)
		this.content = this.content.replace(/\r/g, '')

		try {
			this.id = this.path.split('/').pop()!.replace('.md', '')
			this.captureDescription()
			this.captureFields()
			this.captureValues()
		} catch (e: any) {
			throw new Error(`Failed to parse content of '${this.path}': ${e.message}`)
		}

		return this
	}

	public getField(name: string) {
		const field = this.fields.find(field => field.name === name)
		if (!field) throw new Error(`No field called '${name}' in '${this.id}' (${this.path})`)
		return field
	}

	private captureDescription() {
		descriptionRegex.lastIndex = 0
		const match = descriptionRegex.exec(this.content)
		if (!match) throw new Error(`Failed to capture description for '${this.path}'`)
		const { title, description } = match.groups!
		this.title = title
		this.description = processDescriptionLinks(description, this)
	}

	private captureFields() {
		fieldTitleRegex.lastIndex = 0
		const locations = this.content.split(fieldTitleRegex)
		if (locations.length < 2) {
			// term.gray(`No fields found for `).cyan(this.path)('\n')
			return
		}
		for (const location of locations) {
			fieldCaptureRegex.lastIndex = 0
			while (!location!.startsWith('\n')) {
				const fieldMatch = fieldCaptureRegex.exec(location!)
				if (!fieldMatch) break
				const { field, type, defaultValue, description } = fieldMatch.groups!
				this.fields.push(
					new Field(field, type, defaultValue, processDescriptionLinks(description, this), this)
				)
			}
		}
		if (!this.fields.length) throw new Error(`Failed to capture fields for '${this.path}'`)
	}

	private captureValues() {
		valuesTitleRegex.lastIndex = 0
		const match = this.content.split(valuesTitleRegex).pop()
		if (match === this.content) {
			// term.gray(`No values found for `).cyan(this.path)('\n')
			return
		}
		valueCaptureRegex.lastIndex = 0
		while (!match!.startsWith('\n')) {
			const valueMatch = valueCaptureRegex.exec(match!)
			if (!valueMatch) break
			const { value, description } = valueMatch.groups!
			this.values.push({ value, description: processDescriptionLinks(description, this) })
		}
		if (!this.values.length) throw new Error(`Failed to capture values for '${this.path}'`)
	}

	get docsUrl() {
		return this._docsUrl + this.path.replace('.md', '')
	}
}
