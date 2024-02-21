// import { dataTypes } from './dataTypes'
import { JSONSchema } from './schema'
import * as fs from 'fs'
import * as terminalkit from 'terminal-kit'
const term = terminalkit.terminal

export const originsRawGithubUrl =
	'https://raw.githubusercontent.com/apace100/origins-docs/latest/docs/'
export const apugliRawGithubUrl =
	'https://raw.githubusercontent.com/MerchantPug/apugli-docs/1.20/docs/'
export const epoliRawGithubUrl = ''
export const eggolibRawGithubUrl = ''
export const skillfulRawGithubUrl = ''

export const originsDocsUrl = 'https://origins.readthedocs.io/en/latest/'
export const apugliDocsUrl = 'https://apugli.readthedocs.io/en/latest/'
export const epoliDocsUrl = 'https://epoli-docs.readthedocs.io/en/latest/'
export const eggolibDocsUrl = 'https://eggolib.github.io/latest/'
export const skillfulDocsUrl = 'https://skillful-docs.readthedocs.io/en/latest/'

const linkText = /\[(?<name>[^\n\[]+?)\]\((?<target>[^\n ]+?)\)/g

const descriptionRegex = /^#\s+(?<title>.+)(?<description>[^]+?)###\s+.+?$/gm
const fieldTitleRegex = /Field\s*\|\s*Type\s*\|\s*Default\s*\|\s*Description\n-+\|-+\|-+\|-+\n/gm
const fieldCaptureRegex =
	/^(?<field>[^|\n\s]+?)\s*\|\s*(?<type>[^|\n]+?)\s*\|\s*(?<defaultValue>[^|\n]+?)?\s*\|\s*(?<description>[^|\n]+?)$/gm

const valuesTitleRegex = /Value\s+?\| Description\n-+\|-+\n/gm
const valueCaptureRegex = /^(?<value>[^|]+?)\s*\|\s*(?<description>[^|\n]+?)$/gm

export function parseMDLink(url: string): { name: string; target: string } | undefined {
	linkText.lastIndex = 0
	const match = linkText.exec(url)
	if (!match) return
	return match.groups as { name: string; target: string }
}

export function pathToUrl(from: string, path: string) {
	const url = new URL(path, from)
	return url.href
}

function processDescriptionLinks(description: string, mdFile: MDFile) {
	let link = linkText.exec(description)

	while (link) {
		// term.brightRed(link[0])('\n')
		const { name } = link.groups!
		// term.brightGreen(`[${name}](${mdFile.docsUrl})`)('\n')
		description = description.replace(link[0], `[${name}](${mdFile.docsUrl})`)
		link = linkText.exec(description)
	}

	return description
}

export class Field {
	public optional: boolean = false
	public name: string
	public type: string = ''
	public typePath: string = ''
	public defaultValue: undefined | string = undefined
	public depreciated: boolean = false
	public mdFile: MDFile
	public subTypes: Array<{ name: string; target: string }> = []

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
		const url = parseMDLink(type)
		if (!url) {
			term.brightRed('Failed to parse type ')(type).brightRed(' for field ')(this.name)('\n')
			this.type = type.trim().replaceAll(/(?:^[\"\[]|[\"\]]$)/g, '')
			return
		}
		this.type = url.name.trim().replaceAll(/(?:^\"|\"$)/g, '')
		if (url.name.toLowerCase() === 'array') {
			for (const subType of type.matchAll(linkText)) {
				const subTypeUrl = parseMDLink(subType[0])
				if (!subTypeUrl)
					throw new Error(`Failed to parse sub type '${subType[0]}' for Array field '${this.name}'`)
				this.subTypes.push({ name: subTypeUrl.name, target: subTypeUrl.target })
			}
		}
		this.typePath = url.target
	}

	private parseDefaultValue(defaultValue: string) {
		if (!defaultValue) return
		if (defaultValue.toLowerCase().includes(`optional`)) {
			this.optional = true
			return
		}
		if (defaultValue?.toLowerCase().includes('deprecated')) {
			this.depreciated = true
			return
		}
		this.defaultValue = defaultValue
			.replaceAll('`', '')
			.trim()
			.replaceAll(/(?:^\"|\"$)/g, '')
			.trim()
		// console.log(this.defaultValue)
	}

	// get ref() {
	// 	return './' + this.typePath.replace('.md', '.json')
	// }
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
	private _rawUrl: string = ''

	constructor(public path: string, docsUrl?: string, rawUrl?: string) {
		this._rawUrl = rawUrl || pathToUrl(originsRawGithubUrl, path)
		this.url = pathToUrl(this._rawUrl, path)
		this._docsUrl = docsUrl || pathToUrl(originsDocsUrl, path)
	}

	public static fromRawURL(url: string) {
		if (url.startsWith(originsRawGithubUrl)) {
			const path = url.replace(originsRawGithubUrl, '')
			return new MDFile(path, originsDocsUrl, originsRawGithubUrl)
		} else if (url.startsWith(apugliRawGithubUrl)) {
			const path = url.replace(apugliRawGithubUrl, '')
			return new MDFile(path, apugliDocsUrl, apugliRawGithubUrl)
		} else if (url.startsWith(epoliRawGithubUrl)) {
			const path = url.replace(epoliRawGithubUrl, '')
			return new MDFile(path, epoliDocsUrl, epoliRawGithubUrl)
		} else if (url.startsWith(eggolibRawGithubUrl)) {
			const path = url.replace(eggolibRawGithubUrl, '')
			return new MDFile(path, eggolibDocsUrl, eggolibRawGithubUrl)
		} else if (url.startsWith(skillfulRawGithubUrl)) {
			const path = url.replace(skillfulRawGithubUrl, '')
			return new MDFile(path, skillfulDocsUrl, skillfulRawGithubUrl)
		} else throw new Error(`Failed to parse raw url '${url}'`)
	}

	public static fromDocsURL(url: string) {
		let docsUrl, rawUrl: string
		if (url.includes(originsDocsUrl)) {
			docsUrl = originsDocsUrl
			rawUrl = originsRawGithubUrl
		} else if (url.includes(apugliDocsUrl)) {
			docsUrl = apugliDocsUrl
			rawUrl = apugliRawGithubUrl
		} else if (url.includes(epoliDocsUrl)) {
			docsUrl = epoliDocsUrl
			rawUrl = epoliRawGithubUrl
		} else if (url.includes(eggolibDocsUrl)) {
			docsUrl = eggolibDocsUrl
			rawUrl = eggolibRawGithubUrl
		} else if (url.includes(skillfulDocsUrl)) {
			docsUrl = skillfulDocsUrl
			rawUrl = skillfulRawGithubUrl
		} else throw new Error(`Failed to parse docs url '${url}'`)
		let path = url
			.replace(originsDocsUrl, '')
			.replace(apugliDocsUrl, '')
			.replace(epoliDocsUrl, '')
			.replace(eggolibDocsUrl, '')
			.replace(skillfulDocsUrl, '')

		if (path.endsWith('/')) path = path.slice(0, -1) + '.md'
		return new MDFile(path, docsUrl, rawUrl)
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
		const url = this._rawUrl + this.path
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
		// if (!field) throw new Error(`No field called '${name}' in '${this.id}' (${this.path})`)
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
