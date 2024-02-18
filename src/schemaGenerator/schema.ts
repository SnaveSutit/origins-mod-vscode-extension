import { MDFile } from './mdReader'

type SimpleSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'

type DateAndTimeStringFormat = 'date-time' | 'time' | 'date' | 'duration'
type EmailStringFormat = 'email' | 'idn-email'
type HostnameStringFormat = 'hostname' | 'idn-hostname'
type IPAddressStringFormat = 'ipv4' | 'ipv6'
type ResourceIDStringFormat = 'uuid' | 'uri' | 'uri-reference' | 'iri' | 'iri-reference'
type URITemplateStringFormat = 'uri-template'
type JSONPointerStringFormat = 'json-pointer'
type RegexStringFormat = 'regex'
type StringFormat =
	| DateAndTimeStringFormat
	| EmailStringFormat
	| HostnameStringFormat
	| IPAddressStringFormat
	| ResourceIDStringFormat
	| URITemplateStringFormat
	| JSONPointerStringFormat
	| RegexStringFormat

type StringContentEncodingType =
	| '7bit'
	| '8bit'
	| 'binary'
	| 'quoted-printable'
	| 'base16'
	| 'base32'
	| 'base64'

export type JSONSchema = {
	$schema?: 'https://json-schema.org/draft-07/schema'
	/**
	 * Extra property added specifically for this project.
	 * Should link to the documentation for the schema.
	 */
	$docsUrl?: string
	$id?: string
	$ref?: string
	/**
	 * The $comment keyword is strictly intended for adding comments to a schema.
	 * Its value must always be a string.
	 * Unlike the annotations title, description, and examples, JSON schema implementations aren't allowed to attach any meaning or behavior to it whatsoever, and may even strip them at any time.
	 * Therefore, they are useful for leaving notes to future editors of a JSON schema, but should not be used to communicate to users of the schema.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/comments#comments
	 */
	$comment?: string
	/**
	 * The `title` and `description` keywords must be strings.
	 * A "title" will preferably be short, whereas a "description" will provide a more lengthy explanation about the purpose of the data described by the schema.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/annotations#annotations
	 */
	title?: string
	/**
	 * The `title` and `description` keywords must be strings.
	 * A "title" will preferably be short, whereas a "description" will provide a more lengthy explanation about the purpose of the data described by the schema.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/annotations#annotations
	 */
	description?: string
	/**
	 * A fancier version of `description` for VSCode that supports markdown.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/annotations#annotations
	 */
	markdownDescription?: string
	/**
	 * The `default` keyword specifies a default value.
	 * This value is not used to fill in missing values during the validation process.
	 * Non-validation tools such as documentation generators or form generators may use this value to give hints to users about how to use a value.
	 * However, `default` is typically used to express that if a value is missing, then the value is semantically the same as if the value was present with the default value.
	 * The value of `default` should validate against the schema in which it resides, but that isn't required.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/annotations#annotations
	 */
	default?: any
	/**
	 * The boolean keywords `readOnly` and `writeOnly` are typically used in an API context.
	 * `readOnly` indicates that a value should not be modified.
	 * It could be used to indicate that a PUT request that changes a value would result in a 400 Bad Request response.
	 * `writeOnly` indicates that a value may be set, but will remain hidden.
	 * In could be used to indicate you can set a value with a PUT request, but it would not be included when retrieving that record with a GET request.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/annotations#annotations
	 */
	readOnly?: boolean
	/**
	 * The boolean keywords `readOnly` and `writeOnly` are typically used in an API context.
	 * `readOnly` indicates that a value should not be modified.
	 * It could be used to indicate that a PUT request that changes a value would result in a 400 Bad Request response.
	 * `writeOnly` indicates that a value may be set, but will remain hidden.
	 * In could be used to indicate you can set a value with a PUT request, but it would not be included when retrieving that record with a GET request.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/annotations#annotations
	 */
	writeOnly?: boolean
	/**
	 * The `examples` keyword is a place to provide an array of `examples` that validate against the schema.
	 * This isn't used for validation, but may help with explaining the effect and purpose of the schema to a reader.
	 * Each entry should validate against the schema in which it resides, but that isn't strictly required.
	 * There is no need to duplicate the default value in the `examples` array, since `default` will be treated as another example.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/annotations#annotations
	 */
	examples?: any[]
	/**
	 * The `enum` keyword is used to restrict a value to a fixed set of values.
	 * It must be an array with at least one element, where each element is unique.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/enum#enumerated-values
	 */
	enum?: Array<number | string>
	/**
	 * The const keyword is used to restrict a value to a single value.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/const#constant-values
	 */
	const?: number | string
	/**
	 * The type of the schema.
	 */
	type?: SimpleSchemaType | SimpleSchemaType[]

	/**
	 * The `dependencies` keyword is used to require specific properties or apply a schema when another property is present.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/conditionals#dependentRequired
	 */
	dependancies?: Record<string, string[] | JSONSchema>

	// Composition
	/**
	 * To validate against `allOf`, the given data must be valid against all of the given subschemas.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/combining#allOf
	 */
	allOf?: JSONSchema[]
	/**
	 * To validate against `anyOf`, the given data must be valid against any (one or more) of the given subschemas.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/combining#anyof
	 */
	anyOf?: JSONSchema[]
	/**
	 * To validate against `oneOf`, the given data must be valid against exactly one of the given subschemas.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/combining#oneOf
	 */
	oneOf?: JSONSchema[]
	/**
	 * The `not` keyword declares that an instance validates if it doesn't validate against the given subschema.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/combining#not
	 */
	not?: JSONSchema

	// Conditional
	/**
	 * The `if`, `then` and `else` keywords allow the application of a subschema based on the outcome of another schema, much like the if/then/else constructs you've probably seen in traditional programming languages.
	 * - If `if` is valid, `then` must also be valid (and `else` is ignored.) If `if` is invalid, `else` must also be valid (and `then` is ignored).
	 * - If `then` or `else` is not defined, `if` behaves as if they have a value of true.
	 * - If `then` and/or `else` appear in a schema without `if`, `then` and `else` are ignored.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/conditionals#if-then-else
	 */
	if?: JSONSchema
	/**
	 *
	 *
	 * https://json-schema.org/understanding-json-schema/reference/conditionals#if-then-else
	 */
	then?: JSONSchema
	/**
	 *
	 *
	 * https://json-schema.org/understanding-json-schema/reference/conditionals#if-then-else
	 */
	else?: JSONSchema
	/**
	 * The properties (key-value pairs) on an object are defined using the `properties` keyword.
	 * The value of properties is an object, where each key is the name of a property and each value is a schema used to validate that property.
	 * Any property that doesn't match any of the property names in the `properties` keyword is ignored by this keyword.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/object#properties
	 */
	properties?: Record<string, JSONSchema>
	/**
	 * Sometimes you want to say that, given a particular kind of property name, the value should match a particular schema.
	 * That's where `patternProperties` comes in: it maps regular expressions to schemas.
	 * If a property name matches the given regular expression, the property value must validate against the corresponding schema.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/object#pattern-properties
	 */
	patternProperties?: Record<string, JSONSchema>
	/**
	 * The value of the `additionalProperties` keyword is a schema that will be used to validate any properties in the instance that are not matched by properties or ``patternProperties``.
	 * Setting the `additionalProperties` schema to `false` means no additional properties will be allowed.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/object#additionalproperties
	 */
	additionalProperties?: false | JSONSchema
	/**
	 * By default, the `properties` defined by the properties keyword are not required.
	 * However, one can provide a list of required properties using the `required` keyword.
	 * The `required` keyword takes an array of zero or more strings.
	 * Each of these strings must be unique.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/object#required
	 */
	required?: string[]
	/**
	 * The names of properties can be validated against a schema, irrespective of their values.
	 * This can be useful if you don't want to enforce specific properties, but you want to make sure that the names of those properties follow a specific convention.
	 * You might, for example, want to enforce that all names are valid ASCII tokens so they can be used as attributes in a particular programming language.
	 *
	 * ```
	 * {
	 * 	"type": "object",
	 * 	"propertyNames": {
	 * 		"pattern": "^[A-Za-z_][A-Za-z0-9_]*$"
	 * 	}
	 * }
	 * ```
	 *
	 * https://json-schema.org/understanding-json-schema/reference/object#property-names
	 */
	propertyNames?: JSONSchema
	/**
	 * The minimum number of properties that can be present in the object.
	 * Must be a non-negative integer.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/object#size
	 */
	minProperties?: number
	/**
	 * The maximum number of properties that can be present in the object.
	 * Must be a non-negative integer.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/object#size
	 */
	maxProperties?: number
	/**
	 * The `items` keyword by itself is a schema used to validate all of the items in the array.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#items
	 *
	 * The `items` keyword can also be used to control whether it's valid to have additional items in a tuple beyond what is defined in `prefixItems`.
	 * The value of the `items` keyword is a schema that all additional items must pass in order for the keyword to validate.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#additional-items
	 */
	items?: JSONSchema | false
	/**
	 * `prefixItems` is an array, where each item is a schema that corresponds to each index of the document's array.
	 * That is, an array where the first element validates the first element of the input array, the second element validates the second element of the input array, etc.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#tupleValidation
	 */
	prefixItems?: JSONSchema[]
	/**
	 * While the `items` schema must be valid for every item in the array, the `contains` schema only needs to validate against one or more items in the array.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#contains
	 */
	contains?: JSONSchema
	/**
	 * `minContains` and `maxContains` can be used with `contains` to further specify how many times a schema matches a `contains` constraint.
	 * These keywords can be any non-negative number including zero.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#mincontains-maxcontains
	 */
	minContains?: number
	/**
	 * `minContains` and `maxContains` can be used with `contains` to further specify how many times a schema matches a `contains` constraint.
	 * These keywords can be any non-negative number including zero.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#mincontains-maxcontains
	 */
	maxContains?: number
	/**
	 * The length of the array can be specified using the `minItems` and `maxItems` keywords.
	 * The value of each keyword must be a non-negative number.
	 * These keywords work whether doing list validation or tuple-validation.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#length
	 */
	minItems?: number
	/**
	 * The length of the array can be specified using the `minItems` and `maxItems` keywords.
	 * The value of each keyword must be a non-negative number.
	 * These keywords work whether doing list validation or tuple-validation.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#length
	 */
	maxItems?: number
	/**
	 * A schema can ensure that each of the items in an array is unique.
	 * Simply set the `uniqueItems` keyword to true.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/array#uniqueItems
	 */
	uniqueItems?: boolean
	/**
	 * The minimum length of the string.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/string#length
	 */
	minLength?: number
	/**
	 * The maximum length of the string.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/string#length
	 */
	maxLength?: number
	/**
	 * A Regex pattern that the string must match.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/string#regexp
	 */
	pattern?: string
	/**
	 * The format keyword allows for basic semantic identification of certain kinds of string values that are commonly used.
	 * For example, because JSON doesn't have a "DateTime" type, dates need to be encoded as strings.
	 * format allows the schema author to indicate that the string value should be interpreted as a date.
	 * By default, format is just an annotation and does not effect validation.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/string#format
	 */
	format?: StringFormat
	/**
	 * The contentMediaType keyword specifies the MIME type of the contents of a string, as described in RFC 2046.
	 * There is a list of MIME types officially registered by the IANA, but the set of types supported will be application and operating system dependent.
	 * Mozilla Developer Network also maintains a shorter list of MIME types that are important for the web
	 *
	 * https://json-schema.org/understanding-json-schema/reference/non_json_data#contentmediatype
	 */
	contentMediaType?: 'text/html' | 'application/xml' | string
	/**
	 * The contentEncoding keyword specifies the encoding used to store the contents, as specified in RFC 2054, part 6.1 and RFC 4648.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/non_json_data#contentencoding
	 */
	contentEncoding?: StringContentEncodingType
	/**
	 * Restricts the value to be a multiple of the number provided
	 * It must be a positive number.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/numeric#multiples
	 */
	multipleOf?: number
	/**
	 * The minimum value of the number.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/numeric#range
	 */
	minimum?: number
	/**
	 * The number must be greater than and not equal to this value.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/numeric#range
	 */
	exclusiveMinimum?: number
	/**
	 * The maximum value of the number.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/numeric#range
	 */
	maximum?: number
	/**
	 * The number must be less than and not equal to this value.
	 *
	 * https://json-schema.org/understanding-json-schema/reference/numeric#range
	 */
	exclusiveMaximum?: number
} & (
	| {
			/**
			 * Objects are the mapping type in JSON.
			 * They map "keys" to "values".
			 * In JSON, the "keys" must always be strings.
			 * Each of these pairs is conventionally referred to as a "property".
			 *
			 * https://json-schema.org/understanding-json-schema/reference/object#object
			 */
			type: 'object'
	  }
	| {
			/**
			 * Arrays are used for ordered elements.
			 * In JSON, each element in an array may be of a different type.
			 *
			 * https://json-schema.org/understanding-json-schema/reference/array#array
			 */
			type: 'array'
	  }
	| {
			type: 'string'
	  }
	| {
			/**
			 * https://json-schema.org/understanding-json-schema/reference/numeric#numeric-types
			 */
			type: 'number' | 'integer'
	  }
	| {
			/**
			 * The `boolean` type matches only two special values: `true` and `false`.
			 * Note that values that evaluate to `true` or `false`, such as `1` and `0`, are not accepted by the schema.
			 *
			 * https://json-schema.org/understanding-json-schema/reference/boolean#boolean
			 */
			type: 'boolean'
	  }
	| {
			/**
			 * When a schema specifies a type of `null`, it has only one acceptable value: `null`.
			 * It's important to remember that in JSON, `null` isn't equivalent to something being absent.
			 *
			 * https://json-schema.org/understanding-json-schema/reference/null#null
			 */
			type: 'null'
	  }
	| {
			type?: undefined
	  }
)
