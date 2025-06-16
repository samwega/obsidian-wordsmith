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
 * Defines the parameters for building a knowledge graph prompt.
 */
export interface BuildGraphPromptParams {
	assembledContext?: AssembledContextForLLM;
}

/**
 * Defines the parameters for building a standard generation or transformation prompt.
 */
export interface BuildPromptParams {
	prompt: TextTransformerPrompt;
	isGenerationTask: boolean;
	assembledContext?: AssembledContextForLLM;
	oldText?: string;
}

/**
 * Builds the LLM prompt for knowledge graph generation.
 * @param params The consolidated parameters for the prompt.
 * @returns A `PromptComponents` object containing the structured parts of the prompt.
 */
export function buildGraphPrompt(params: BuildGraphPromptParams): PromptComponents {
	const { assembledContext } = params;
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
2.  **Focus on Significance**: Extract only the most important entities and relationships to build a useful, insightful graph.
3.  **Node Creation Mandate**: For every relationship you identify in an \`edge\`, you **MUST** create a corresponding \`node\` for both its \`source\` and its \`target\`.
4.  **Referential Integrity**: All \`source\` and \`target\` IDs in the \`edges\` array **MUST** correspond to a valid \`id\` in the \`nodes\` array. Do not create edges that point to non-existent nodes.
5.  **No External Information**: Derive all information exclusively from the provided text context.
6.  **Graph Structure**: The output must represent a graph, not necessarily a tree. Cycles and many-to-many connections are permitted.
7.  **Unique IDs**: All node \`id\`s must be unique.

### CONTEXT ANALYSIS
The following text blocks are your source material.
- **ABSOLUTE PRIORITY**: Your output **MUST** always be valid JSON conforming to the specified interface. This rule is unbreakable.
- **Custom Context Guidance**: If a 'Custom Context' block is provided, use the instructions within it to guide **what** you extract (e.g., "focus on philosophical concepts," "ignore personal names") and the **style** of the descriptions. These instructions should influence the content of the graph, not its fundamental JSON structure.
- **Source Material**: If provided, use the 'Current Note Context' and 'Referenced Notes' as the primary source material from which to extract entities and relationships, according to the guidance you receive.

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

/**
 * Builds the distinct components of an LLM prompt based on the task and provided context.
 * This centralizes the logic, which can then be formatted by callers for specific API requirements.
 *
 * @param params The consolidated parameters for the prompt.
 * @returns A `PromptComponents` object containing the structured parts of the prompt.
 */
export function buildPromptComponents(params: BuildPromptParams): PromptComponents {
	const {
		prompt,
		isGenerationTask,
		assembledContext,
		oldText = "", // Provide a safe default
	} = params;

	// --- SPECIAL CASE: Graph Generation ---
	if (prompt.id === "graph-generation") {
		// --- FIX: Conditionally add assembledContext to avoid exactOptionalPropertyTypes error ---
		const graphComponents = buildGraphPrompt({
			...(assembledContext && { assembledContext }),
		});
		return {
			systemInstructions: graphComponents.systemInstructions,
			userContent: prompt.text,
			contextBlock: graphComponents.contextBlock,
		};
	}

	// --- GENERIC TASK PROMPT BUILDING ---

	// --- 1. Build System Instructions ---
	const systemInstructionBuilder: string[] = [];
	systemInstructionBuilder.push(
		"# CORE IDENTITY & DIRECTIVE: Your core identity is an AI assistant integrated into the Obsidian application. Your core directive is to follow all instructions precisely to help the user. For each specific task, you MUST adopt the task-oriented role defined in the user's prompt (e.g., '[AI ROLE]: Professional Editor').",
	);

	const contextRules: string[] = [];
	if (assembledContext?.customContext) {
		contextRules.push(
			"1. You will be given 'Custom Context'. Any guidance, instructions, or rules in this block MUST be strictly obeyed above all else.",
		);
	}
	if (assembledContext?.referencedNotesContent) {
		contextRules.push(
			"2. You may see 'Referenced Notes'. Treat this as supplementary background information unless the 'Custom Context' says otherwise.",
		);
	}
	if (assembledContext?.editorContextContent) {
		contextRules.push(
			`3. You may see 'Current Note Context'. This is content from the note the user is currently editing.`,
		);
		if (
			isGenerationTask &&
			assembledContext.editorContextContent?.includes(GENERATION_TARGET_CURSOR_MARKER)
		) {
			contextRules.push(
				`   - The marker '${GENERATION_TARGET_CURSOR_MARKER}' indicates the current cursor position within that context, it is where your output will be inserted.`,
			);
		}
	}

	if (contextRules.length > 0) {
		systemInstructionBuilder.push("\n# CONTEXT RULES");
		systemInstructionBuilder.push(...contextRules);
	}

	if (isGenerationTask) {
		systemInstructionBuilder.push("\n# TASK: Fulfill the user's generation request.");
		systemInstructionBuilder.push("\n# OUTPUT FORMAT");
		systemInstructionBuilder.push("1. Output the generated text ONLY.");
		systemInstructionBuilder.push("2. Do NOT repeat the user's prompt or instructions.");
		systemInstructionBuilder.push(
			"3. Do NOT include any preambles, apologies, or explanatory sentences.",
		);
	} else {
		systemInstructionBuilder.push("\n# TASK: Fulfill the user's transformation instruction.");
		systemInstructionBuilder.push("\n# OUTPUT FORMAT");
		systemInstructionBuilder.push(
			"1. Apply instructions ONLY to the 'Text to Transform', which will be in the user message.",
		);
		systemInstructionBuilder.push(
			"2. Do not comment on or alter any provided context blocks (Custom Context, Referenced Notes, Current Note Context).",
		);
		systemInstructionBuilder.push("3. Output ONLY the transformed text.");
	}
	const systemInstructions = systemInstructionBuilder.join("\n");

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
