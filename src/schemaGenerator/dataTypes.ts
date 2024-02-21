import { MDFile, pathToUrl, originsRawGithubUrl } from './mdReader'

type IDataTypes =
	| 'Array'
	| 'Boolean'
	| 'Float'
	| 'Integer'
	| 'Object'
	| 'String'
	// Origins-specific
	| 'Action Result'
	| 'Attribute Modifier Operation'
	| 'Attribute Modifier'
	| 'Attributed Attribute Modifier Operation'
	| 'Attributed Attribute Modifier'
	| 'Comparison'
	| 'Container Type'
	| 'Crafting Recipe'
	| 'Damage Source'
	| 'Default Translatable Text Component'
	| 'Destruction Type'
	| 'Entity Type Tag-like'
	| 'Fluid Handling'
	| 'Food Component'
	| 'Hud Render'
	| 'Identifier'
	| 'Ingredient'
	| 'Inventory Type'
	| 'Item Slot'
	| 'Item Stack'
	| 'Key'
	| 'Material'
	| 'NBT'
	| 'Particle Effect'
	| 'Player Ability'
	| 'Positioned Item Stack'
	| 'Process Mode'
	| 'Shape Type'
	| 'Shape'
	| 'Space'
	| 'Stat'
	| 'Status Effect Instance'
	| 'Text Component'
	| 'Vector'

export class DataType {
	public url: string
	private _mdFile: MDFile | undefined
	constructor(public path: string) {
		this.url = pathToUrl(originsRawGithubUrl, path)
	}

	async getMDFile(): Promise<MDFile> {
		if (!this._mdFile) {
			this._mdFile = await new MDFile(this.path).fetchContent()
		}
		return this._mdFile
	}

	get ref() {
		return './' + this.path.replace('.md', '.json')
	}
}

export const ARRAY = new DataType('types/data_types/array.md')
export const BOOLEAN = new DataType('types/data_types/boolean.md')
export const FLOAT = new DataType('types/data_types/float.md')
export const INTEGER = new DataType('types/data_types/integer.md')
export const OBJECT = new DataType('types/data_types/object.md')
export const STRING = new DataType('types/data_types/string.md')
// Origins-specific
export const ACTION_RESULT = new DataType('types/data_types/action_result.md')
export const ATTRIBUTE_MODIFIER_OPERATION = new DataType(
	'types/data_types/attribute_modifier_operation.md'
)
export const ATTRIBUTE_MODIFIER = new DataType('types/data_types/attribute_modifier.md')
export const ATTRIBUTED_ATTRIBUTE_MODIFIER_OPERATION = new DataType(
	'types/data_types/attributed_attribute_modifier_operation.md'
)
export const ATTRIBUTED_ATTRIBUTE_MODIFIER = new DataType(
	'types/data_types/attributed_attribute_modifier.md'
)
export const COMPARISON = new DataType('types/data_types/comparison.md')
export const CONTAINER_TYPE = new DataType('types/data_types/container_type.md')
export const CRAFTING_RECIPE = new DataType('types/data_types/crafting_recipe.md')
export const DAMAGE_SOURCE = new DataType('types/data_types/damage_source.md')
export const DEFAULT_TRANSLATABLE_TEXT_COMPONENT = new DataType(
	'types/data_types/default_translatable_text_component.md'
)
export const DESTRUCTION_TYPE = new DataType('types/data_types/destruction_type.md')
export const ENTITY_TYPE_TAG_LIKE = new DataType('types/data_types/entity_type_taglike.md')
export const FLUID_HANDLING = new DataType('types/data_types/fluid_handling.md')
export const FOOD_COMPONENT = new DataType('types/data_types/food_component.md')
export const HUD_RENDER = new DataType('types/data_types/hud_render.md')
export const IDENTIFIER = new DataType('types/data_types/identifier.md')
export const INGREDIENT = new DataType('types/data_types/ingredient.md')
export const INVENTORY_TYPE = new DataType('types/data_types/inventory_type.md')
export const ITEM_SLOT = new DataType('types/data_types/item_slot.md')
export const ITEM_STACK = new DataType('types/data_types/item_stack.md')
export const KEY = new DataType('types/data_types/key.md')
export const MATERIAL = new DataType('types/data_types/material.md')
export const NBT = new DataType('types/data_types/nbt.md')
export const PARTICLE_EFFECT = new DataType('types/data_types/particle_effect.md')
export const PLAYER_ABILITY = new DataType('types/data_types/player_ability.md')
export const POSITIONED_ITEM_STACK = new DataType('types/data_types/positioned_item_stack.md')
export const PROCESS_MODE = new DataType('types/data_types/process_mode.md')
export const SHAPE_TYPE = new DataType('types/data_types/shape_type.md')
export const SHAPE = new DataType('types/data_types/shape.md')
export const SPACE = new DataType('types/data_types/space.md')
export const STAT = new DataType('types/data_types/stat.md')
export const STATUS_EFFECT_INSTANCE = new DataType('types/data_types/status_effect_instance.md')
export const TEXT_COMPONENT = new DataType('types/data_types/text_component.md')
export const VECTOR = new DataType('types/data_types/vector.md')

export const dataTypes: Record<IDataTypes, DataType> = {
	Array: ARRAY,
	Boolean: BOOLEAN,
	Float: FLOAT,
	Integer: INTEGER,
	Object: OBJECT,
	String: STRING,
	// Origins-specific
	'Action Result': ACTION_RESULT,
	'Attribute Modifier Operation': ATTRIBUTE_MODIFIER_OPERATION,
	'Attribute Modifier': ATTRIBUTE_MODIFIER,
	'Attributed Attribute Modifier Operation': ATTRIBUTED_ATTRIBUTE_MODIFIER_OPERATION,
	'Attributed Attribute Modifier': ATTRIBUTED_ATTRIBUTE_MODIFIER,
	Comparison: COMPARISON,
	'Container Type': CONTAINER_TYPE,
	'Crafting Recipe': CRAFTING_RECIPE,
	'Damage Source': DAMAGE_SOURCE,
	'Default Translatable Text Component': DEFAULT_TRANSLATABLE_TEXT_COMPONENT,
	'Destruction Type': DESTRUCTION_TYPE,
	'Entity Type Tag-like': ENTITY_TYPE_TAG_LIKE,
	'Fluid Handling': FLUID_HANDLING,
	'Food Component': FOOD_COMPONENT,
	'Hud Render': HUD_RENDER,
	Identifier: IDENTIFIER,
	Ingredient: INGREDIENT,
	'Inventory Type': INVENTORY_TYPE,
	'Item Slot': ITEM_SLOT,
	'Item Stack': ITEM_STACK,
	Key: KEY,
	Material: MATERIAL,
	NBT: NBT,
	'Particle Effect': PARTICLE_EFFECT,
	'Player Ability': PLAYER_ABILITY,
	'Positioned Item Stack': POSITIONED_ITEM_STACK,
	'Process Mode': PROCESS_MODE,
	'Shape Type': SHAPE_TYPE,
	Shape: SHAPE,
	Space: SPACE,
	Stat: STAT,
	'Status Effect Instance': STATUS_EFFECT_INSTANCE,
	'Text Component': TEXT_COMPONENT,
	Vector: VECTOR,
}
