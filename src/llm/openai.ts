// src/lib/llm/openai.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { GENERATION_TARGET_CURSOR_MARKER } from "../lib/constants";
import type { AssembledContextForLLM } from "../lib/core/textTransformer"; // Added import
import { MODEL_SPECS, TextTransformerPrompt, TextTransformerSettings } from "../lib/settings-data";
import { logError } from "../lib/utils";

/**
 * Sends a request to the OpenAI API.
 * @param settings The plugin settings.
 * @param oldText The original text to be transformed. Empty for generation tasks.
 * @param prompt The prompt detailing the transformation or generation task.
 * @param additionalContextForAI Optional additional context to provide to the AI.
 * @returns A promise that resolves to an object containing the new text,
 *          whether the output might be overlength, and the estimated cost,
 *          or undefined if an error occurs.
 */
export async function openAiRequest(
	settings: TextTransformerSettings,
	oldText: string, // This will be an empty string for generation tasks
	prompt: TextTransformerPrompt,
	assembledContext?: AssembledContextForLLM, // Changed parameter type and name
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.openAiApiKey) {
		new Notice("Please set your OpenAI API key in the plugin settings.");
		return;
	}

	const customContextStart = "--- Custom Context Start ---";
	const customContextEnd = "--- Custom Context End ---";
	// REFERENCED_NOTES_START/END are part of assembledContext.referencedNotesContent if it exists
	// CURRENT_NOTE_CONTEXT_START/END are part of assembledContext.editorContextContent if it exists

	const systemInstructionBuilder: string[] = [
		"--- BEGIN SYSTEM INSTRUCTIONS ---",
		"You are an AI assistant embedded in Obsidian helping with text tasks. Your primary instruction is to fulfill the user's ad-hoc prompt or transformation instruction.",
	];

	// Instructions about context blocks
	if (assembledContext?.customContext) {
		systemInstructionBuilder.push(
			`You will be given 'Custom Context' (marked as '${customContextStart}' and '${customContextEnd}'). Any guidance, instructions, rules, or requests found within this block MUST be strictly obeyed.`,
		);
	}
	if (assembledContext?.referencedNotesContent) {
		systemInstructionBuilder.push(
			`You may also be given 'Referenced Notes' (typically marked with '--- BEGIN REFERENCED NOTES ---' and '--- END REFERENCED NOTES ---'). Treat this as supplementary background information unless instructed otherwise in the 'Custom Context'.`,
		);
	}
	if (assembledContext?.editorContextContent) {
		systemInstructionBuilder.push(
			`Additionally, you will see 'Current Note Context' (typically marked with '--- Current Note Context Start ---' and '--- Current Note Context End ---') which represents content from the current editor.`,
		);
		if (
			oldText === "" &&
			assembledContext.editorContextContent.includes(GENERATION_TARGET_CURSOR_MARKER)
		) {
			// Generation task
			systemInstructionBuilder.push(
				`This 'Current Note Context' contains a marker '${GENERATION_TARGET_CURSOR_MARKER}'. This marker indicates the precise spot where the new text should be generated or inserted.`,
			);
		}
	}

	if (oldText === "") {
		// Further instructions specific to Generation tasks
		systemInstructionBuilder.push(
			"Output ONLY the generated text, without any preambles or explanatory sentences.",
		);
	} else {
		// Further instructions specific to Transformation tasks
		systemInstructionBuilder.push(
			"Apply instructions ONLY to the 'Text to Transform' (which will be provided as the user message). Do not comment on or alter any provided context blocks (Custom Context, Referenced Notes, Current Note Context).",
		);
	}

	systemInstructionBuilder.push("--- END SYSTEM INSTRUCTIONS ---");

	let systemMessageContent = systemInstructionBuilder.join(" ");

	// Append actual context blocks
	if (assembledContext?.customContext) {
		systemMessageContent += `\n\n${customContextStart}\n${assembledContext.customContext}\n${customContextEnd}`;
	}
	if (assembledContext?.referencedNotesContent) {
		systemMessageContent += `\n\n${assembledContext.referencedNotesContent}`; // Already wrapped
	}
	if (assembledContext?.editorContextContent) {
		systemMessageContent += `\n\n${assembledContext.editorContextContent}`; // Already wrapped
	}

	const messages = [
		{ role: "system", content: systemMessageContent },
		{
			role: "user",
			content:
				oldText === ""
					? prompt.text
					: `User's transformation instruction: ${prompt.text}\n\n--- Text to Transform Start ---\n${oldText}\n--- Text to Transform End ---`,
		},
	];

	let response: RequestUrlResponse;
	try {
		response = await requestUrl({
			url: "https://api.openai.com/v1/chat/completions",
			method: "POST",
			contentType: "application/json",
			headers: { authorization: "Bearer " + settings.openAiApiKey },
			body: JSON.stringify({
				model: settings.model,
				messages: messages,
				temperature: prompt.temperature ?? settings.temperature,
				// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
				frequency_penalty: prompt.frequency_penalty ?? settings.frequency_penalty,
				// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
				presence_penalty: prompt.presence_penalty ?? settings.presence_penalty,
				// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
				max_tokens: prompt.max_tokens ?? settings.max_tokens,
			}),
		});
		console.debug("[WordSmith plugin] OpenAI response", response);
	} catch (error) {
		if ((error as { status: number }).status === 401) {
			const msg = "OpenAI API key is not valid. Please verify the key in the plugin settings.";
			new Notice(msg, 6_000);
			return;
		}
		logError(error);
		return;
	}
	const newText = response.json?.choices?.[0].message.content;
	if (!newText) {
		logError(response);
		return;
	}

	const modelSpec = MODEL_SPECS[settings.model];
	const outputTokensUsed = response.json?.usage?.completion_tokens || 0;
	const isOverlength = modelSpec.maxOutputTokens
		? outputTokensUsed >= modelSpec.maxOutputTokens
		: false;
	const inputTokensUsed = response.json?.usage?.prompt_tokens || 0;
	const cost = modelSpec.costPerMillionTokens
		? (inputTokensUsed * modelSpec.costPerMillionTokens.input) / 1e6 +
			(outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6
		: 0;

	return { newText: newText, isOverlength: isOverlength, cost: cost };
}
