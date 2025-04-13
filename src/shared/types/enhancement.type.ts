// src/shared/types/enhancement.type.ts

export enum EnhancementType {
	AddComments = 'AddComments',
	Analyze = 'Analyze',
	Explain = 'Explain',
	AddPathComment = 'AddPathComment',
	// Add more types here later
}

// Type guard function remains the same (it automatically adapts)
export function isValidEnhancementType(value: string): value is EnhancementType {
	return Object.values(EnhancementType).includes(value as EnhancementType);
}