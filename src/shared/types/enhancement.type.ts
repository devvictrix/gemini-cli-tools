// File: src/shared/types/enhancement.type.ts

export enum EnhancementType {
	AddComments = 'AddComments',
	Analyze = 'Analyze',
	Explain = 'Explain',
	AddPathComment = 'AddPathComment',
	Consolidate = 'Consolidate',
	SuggestImprovements = 'SuggestImprovements', // New
	GenerateDocs = 'GenerateDocs',             // New
	InferFromData = 'InferFromData',           // New (based on provided code)
	// Add more types here later
}

// Type guard function remains the same
export function isValidEnhancementType(value: string): value is EnhancementType {
	return Object.values(EnhancementType).includes(value as EnhancementType);
}