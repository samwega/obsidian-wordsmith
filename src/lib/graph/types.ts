// src/lib/graph/types.ts

/**
 * The validated structure of the JSON object returned by the LLM.
 */
export interface LlmKnowledgeGraph {
	nodes: {
		id: string; // A unique, machine-readable, snake_case identifier.
		label: string; // The human-readable name of the entity.
		description: string; // A concise summary of the entity.
	}[];
	edges: {
		source: string; // Must match a node.id
		target: string; // Must match a node.id
		label: string; // A brief, human-readable label for the relationship.
	}[];
}

/**
 * Metadata to be embedded as frontmatter in the generated .canvas file.
 * Contains a snapshot of the generation context and model details.
 */
export interface GraphCanvasMetadata {
	version: string; // The WordSmith plugin version.
	createdAt: string; // ISO 8601 timestamp of generation.
	modelProvider: string; // The provider used (e.g., 'openai', 'gemini').
	modelId: string; // The specific model ID from settings.
	contextSnapshot: {
		resolvedWikilinks: string[]; // An array of file paths.
		customContextText: string | null;
	};
}
