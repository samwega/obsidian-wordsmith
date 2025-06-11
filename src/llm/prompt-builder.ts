// src/lib/llm/prompt-builder.ts

import { GENERATION_TARGET_CURSOR_MARKER } from "../lib/constants";
import type { AssembledContextForLLM } from "../lib/core/textTransformer";
import type { TextTransformerPrompt } from "../lib/settings-data";

/**
 * Defines the structured output of the prompt builder.
 */
export interface PromptComponents {
	/** High-level instructions for the AI's role and how to interpret the context. */
	systemInstructions: string;
	/** The specific user task, e.g., the ad-hoc generation prompt or the transformation instruction with the text to transform. */
	userContent: string;
	/** The fully formatted string containing all provided context blocks (Custom, Referenced, Editor). */
	contextBlock: string;
}

/**
 * Builds the distinct components of an LLM prompt based on the task and provided context.
 * This centralizes the logic, which can then be formatted by callers for specific API requirements.
 *
 * @param assembledContext The context gathered from the UI and editor.
 * @param prompt The user's specific prompt object.
 * @param isGenerationTask A flag indicating if the task is generation or transformation.
 * @param oldText The original text for transformation tasks.
 * @returns A `PromptComponents` object containing the structured parts of the prompt.
 */
export function buildPromptComponents(
	assembledContext: AssembledContextForLLM | undefined,
	prompt: TextTransformerPrompt,
	isGenerationTask: boolean,
	oldText: string,
): PromptComponents {
	// --- 1. Build System Instructions ---
	const systemInstructionBuilder: string[] = [
		"--- BEGIN SYSTEM INSTRUCTIONS ---",
		"You are an AI assistant embedded in Obsidian helping with text tasks. Your primary instruction is to fulfill the user's ad-hoc prompt or transformation instruction.",
	];

	if (assembledContext?.customContext) {
		systemInstructionBuilder.push(
			"You will be given 'Custom Context'. Any guidance, instructions, rules, or requests found within this block MUST be strictly obeyed.",
		);
	}
	if (assembledContext?.referencedNotesContent) {
		systemInstructionBuilder.push(
			"You may also be given 'Referenced Notes'. Treat this as supplementary background information unless instructed otherwise in the 'Custom Context'.",
		);
	}
	if (assembledContext?.editorContextContent) {
		systemInstructionBuilder.push(
			"Additionally, you will see 'Current Note Context' which represents content from the current editor.",
		);
		if (
			isGenerationTask &&
			assembledContext.editorContextContent.includes(GENERATION_TARGET_CURSOR_MARKER)
		) {
			systemInstructionBuilder.push(
				`This 'Current Note Context' contains a marker '${GENERATION_TARGET_CURSOR_MARKER}'. This marker indicates the precise spot where the new text should be generated or inserted.`,
			);
		}
	}

	if (isGenerationTask) {
		systemInstructionBuilder.push(
			"Output the generated text ONLY, without any preambles, tags or explanatory sentences.",
		);
	} else {
		systemInstructionBuilder.push(
			"Apply instructions ONLY to the 'Text to Transform' (which will be provided as the user message). Do not comment on or alter any provided context blocks (Custom Context, Referenced Notes, Current Note Context).",
		);
	}
	systemInstructionBuilder.push("--- END SYSTEM INSTRUCTIONS ---");
	const systemInstructions = systemInstructionBuilder.join(" ");

	// --- 2. Build User Content ---
	const userContent = isGenerationTask
		? prompt.text
		: `User's transformation instruction: ${prompt.text}\n\n--- Text to Transform Start ---\n${oldText}\n--- Text to Transform End ---`;

	// --- 3. Build Combined Context Block ---
	const contextBlockBuilder: string[] = [];
	if (assembledContext?.customContext) {
		contextBlockBuilder.push(
			`--- Custom Context Start ---\n${assembledContext.customContext}\n--- Custom Context End ---`,
		);
	}
	if (assembledContext?.referencedNotesContent) {
		contextBlockBuilder.push(assembledContext.referencedNotesContent);
	}
	if (assembledContext?.editorContextContent) {
		contextBlockBuilder.push(assembledContext.editorContextContent);
	}
	const contextBlock = contextBlockBuilder.join("\n\n");

	return { systemInstructions, userContent, contextBlock };
}

/**
 * Builds the LLM prompt for knowledge graph generation.
 * @param assembledContext The context gathered from the UI and editor.
 * @returns A `PromptComponents` object containing the structured parts of the prompt.
 */
export function buildGraphPrompt(
	assembledContext: AssembledContextForLLM | undefined,
): PromptComponents {
	const userInstruction = `### CORE DIRECTIVE
You are a Knowledge Graph Extraction Expert. Your sole task is to analyze the provided text(s), extract the most essential concepts and output a valid JSON object representing a knowledge graph of its main entities and their relationships. The entities/concepts should be selected to help elucidate the subject matter.

### OUTPUT FORMAT SPECIFICATION
Your entire output MUST be a single, raw, and valid JSON object. Do not include any explanatory text or markdown backticks. The JSON object must strictly adhere to the following TypeScript interface:
\`\`\`typescript
interface KnowledgeGraph {
  nodes: {
    id: string;      // A unique, machine-readable, lower-case, snake_case identifier for the node.
    label: string;   // The clean, human-readable name of the entity.
    description: string; // A description, definition or summary of the entity based on the provided text. This can be shorter or longer, what matters is that the overall graph is truly helpful in understanding the material.
  }[];
  edges: {
    source: string;  // The \`id\` of the source node.
    target: string;  // The \`id\` of the target node.
    label: string;   // A brief, verb-phrase label for the relationship.
  }[];
}
\`\`\`

### RULES AND CONSTRAINTS
1.  **Strict JSON Only**: Your response MUST begin with \`{\` and end with \`}\`.
2.  **Focus on Significance**: Extract only the most important entities and relationships.
3.  **Node Creation Mandate**: For every relationship you identify in an \`edge\`, you **MUST** create a corresponding \`node\` for both its \`source\` and its \`target\`.
4.  **Referential Integrity**: All \`source\` and \`target\` IDs in the \`edges\` array **MUST** correspond to a valid \`id\` in the \`nodes\` array. Do not create edges that point to non-existent nodes.
5.  **No External Information**: Derive all information exclusively from the provided text context.
6.  **Graph Structure**: The output must represent a graph, not necessarily a tree. Cycles and many-to-many connections are permitted.
7.  **Unique IDs**: All node \`id\`s must be unique.

### EXAMPLE
**GIVEN INPUT TEXT**: Socrates was a Greek philosopher known for the Socratic method. His student, Plato, documented his life.
**EXPECTED JSON OUTPUT**:
\`\`\`json
{
  "nodes": [
    {
      "id": "socrates",
      "label": "Socrates",
      "description": "A Greek philosopher known for developing the Socratic method. His life and philosophy are primarily known through the writings of his student, Plato."
    },
    {
      "id": "plato",
      "label": "Plato",
      "description": "A student of Socrates who documented his teacher's life and philosophical methods."
    },
    {
      "id": "socratic_method",
      "label": "Socratic Method",
      "description": "A form of cooperative argumentative dialogue used to stimulate critical thinking, associated with Socrates."
    }
  ],
  "edges": [
    {
      "source": "socrates",
      "target": "socratic_method",
      "label": "is known for"
    },
    {
      "source": "plato",
      "target": "socrates",
      "label": "was a student of"
    }
  ]
}
\`\`\``;

	const contextBlockBuilder: string[] = [];
	if (assembledContext?.customContext) {
		contextBlockBuilder.push(
			`--- Custom Context Start ---\n${assembledContext.customContext}\n--- Custom Context End ---`,
		);
	}
	if (assembledContext?.referencedNotesContent) {
		contextBlockBuilder.push(assembledContext.referencedNotesContent);
	}
	if (assembledContext?.editorContextContent) {
		contextBlockBuilder.push(assembledContext.editorContextContent);
	}
	const contextBlock = contextBlockBuilder.join("\n\n");

	return {
		systemInstructions: "You are a highly intelligent Knowledge Graph Extraction Engine.",
		userContent: userInstruction,
		contextBlock,
	};
}
