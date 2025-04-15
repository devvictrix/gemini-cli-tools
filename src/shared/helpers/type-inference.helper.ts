// File: src/shared/helpers/type-inference.helper.ts

/**
 * Recursively determines the TypeScript type of a given value.
 * Handles primitive types, arrays, objects, functions, Date instances, and potential date strings.
 *
 * @param {any} value - The value whose type is to be determined.
 * @returns {string} - A string representing the TypeScript type of the given value.
 * @warning The detection of date strings using regex is a heuristic and may misclassify
 *          strings that coincidentally match the ISO 8601 format.
 * @warning This function does not handle circular references in objects. Processing data
 *          with circular references will likely result in a 'Maximum call stack size exceeded' error.
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
        // Basic check for ISO 8601 Date string format (heuristic)
        // Note: This is a simple heuristic and might misclassify strings that coincidentally match
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) {
            return "Date"; // Suggest Date if it looks like an ISO string
        }
        return "string";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        // Ensure it's a plain object, not null or an array
        // Potential stack overflow here if obj has circular references
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
 * @warning This function does not handle circular references. If 'obj' contains circular
 *          references, this may lead to infinite recursion and stack overflow.
 */
function getInterface(obj: object): string {
    const properties = Object.entries(obj).map(
        // Recursively get type for each property value
        ([key, val]) => `  ${key}: ${getType(val)};` // Indent properties // Recursive call
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
 *                     It's assumed this data is JSON-like (no functions, Maps, Sets, etc. handled specifically).
 * @returns {string} - A formatted string representing the generated TypeScript interface.
 * @throws {Error} If the input data is not a single object or an array of objects.
 * @note This service is primarily designed for JSON data. Support for other formats like YAML
 *       would require adding specific parsers.
 * @warning Does not handle circular references within the data structure.
 * @warning Date string detection is based on a simple regex heuristic.
 */
export function inferTypesFromData(interfaceName: string, data: any): string {
    // Validate input data structure
    const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
    const isArrayOfObjects = Array.isArray(data) && data.every(item => typeof item === 'object' && item !== null);

    if (!isObject && !isArrayOfObjects) {
        // If the data is not an object or an array of objects, throw an error to indicate invalid input.
        // This is important for preventing unexpected behavior and ensuring that the function receives the correct type of data.
        throw new Error("Invalid input data: Must be a single object or an array of objects.");
    }
    if (Array.isArray(data) && data.length === 0) {
        // If the data is an empty array, log a warning to the console and return an empty interface definition.
        // This is useful for informing the user that the function is processing an empty array and generating an empty interface.
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
            // If an item in the array is not an object, log a warning to the console.
            // This helps to identify potential issues with the input data and prevents the function from crashing.
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