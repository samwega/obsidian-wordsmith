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
