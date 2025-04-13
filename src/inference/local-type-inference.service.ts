// File: src/inference/local-type-inference.service.ts

/**
 * Recursively determines the TypeScript type of a given value.
 * Handles primitive types, arrays, objects, functions, Date instances, and potential date strings.
 *
 * @param {any} value - The value whose type is to be determined.
 * @returns {string} - A string representing the TypeScript type of the given value.
 */
function getType(value: any): string {
    if (value === null) {
        return "null";
    } else if (value === undefined) {
        // Represent undefined explicitly, although less common in JSON
        return "undefined";
    } else if (typeof value === "function") {
        // Functions aren't typical in data structures like JSON, but handle for completeness
        return "Function";
    } else if (Array.isArray(value)) {
        if (value.length === 0) {
            return "Array<any>"; // Or perhaps "unknown[]" or "any[]" based on preference
        }
        // Infer type from elements, handling potentially mixed types
        const uniqueTypes = new Set(value.map((item) => getType(item)));
        // Sort for consistent output if multiple types are present
        return `Array<${Array.from(uniqueTypes).sort().join(" | ")}>`;
    } else if (value instanceof Date) {
        return "Date";
    } else if (typeof value === "string") {
        // Basic check for ISO 8601 Date string format
        // Note: This is a simple heuristic and might misclassify strings that coincidentally match
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) {
            return "Date"; // Suggest Date if it looks like an ISO string
        }
        return "string";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        // Ensure it's a plain object, not null or an array
        return getInterface(value);
    }
    // Fallback for primitive types like number, boolean, bigint, symbol
    return typeof value;
}

/**
 * Constructs a TypeScript interface representation (as a string) for a given object.
 * This function recursively calls getType to handle nested structures.
 *
 * @param {object} obj - The object to convert into a TypeScript interface string.
 * @returns {string} - A formatted string representing the TypeScript type interface of the object.
 */
function getInterface(obj: object): string {
    const properties = Object.entries(obj).map(
        // Recursively get type for each property value
        ([key, val]) => `  ${key}: ${getType(val)};` // Indent properties
    );
    // Sort properties alphabetically for consistent output
    properties.sort();
    // Format as an inline object type definition
    return `{\n${properties.join("\n")}\n}`;
}

/**
 * Infers TypeScript interface definitions from sample data (e.g., parsed JSON).
 * Handles single objects or arrays of objects, merging properties and types found across all items.
 *
 * @param {string} interfaceName - The desired name for the root TypeScript interface.
 * @param {any} data - The sample data (object or array of objects) to analyze.
 * @returns {string} - A formatted string representing the generated TypeScript interface.
 * @throws {Error} If the input data is not an object or an array of objects.
 */
export function inferTypesFromData(interfaceName: string, data: any): string {
    // Validate input data structure
    const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
    const isArrayOfObjects = Array.isArray(data) && data.every(item => typeof item === 'object' && item !== null);

    if (!isObject && !isArrayOfObjects) {
        throw new Error("Invalid input data: Must be a single object or an array of objects.");
    }
    if (Array.isArray(data) && data.length === 0) {
        console.warn("[Inference] Input data is an empty array. Generating an empty interface.");
        return `interface ${interfaceName} {}\n`;
    }


    // Normalize data to always be an array for consistent processing
    const normalizedData = Array.isArray(data) ? data : [data];
    // Use a Map to store types for each key, preserving insertion order for keys if needed later,
    // but sorting keys alphabetically before output for consistency.
    const typeDefinitions: Map<string, Set<string>> = new Map();

    // Iterate through each item in the normalized data array
    normalizedData.forEach((item) => {
        // Ensure item is a valid object before processing its entries
        if (typeof item === 'object' && item !== null) {
            // Iterate through each key-value pair in the object
            Object.entries(item).forEach(([key, value]) => {
                const valueType = getType(value); // Infer type of the value
                // Initialize the Set for this key if it doesn't exist yet
                if (!typeDefinitions.has(key)) {
                    typeDefinitions.set(key, new Set());
                }
                // Add the inferred type to the Set for this key
                typeDefinitions.get(key)?.add(valueType);
            });
        } else {
            console.warn("[Inference] Skipping non-object item in array:", item);
        }
    });

    // Construct the interface string lines
    const lines: string[] = [`interface ${interfaceName} {`];
    // Get keys and sort them alphabetically for consistent interface property order
    const sortedKeys = Array.from(typeDefinitions.keys()).sort();

    // Add each property definition to the interface lines
    sortedKeys.forEach((key) => {
        const typesSet = typeDefinitions.get(key);
        if (typesSet) {
            // Get unique types, sort them, and join with " | " for union types
            const types = Array.from(typesSet).sort().join(" | ");
            lines.push(`  ${key}: ${types};`); // Add indented property line
        }
    });

    lines.push("}"); // Closing brace for the interface
    return lines.join("\n"); // Join lines into a single string
}