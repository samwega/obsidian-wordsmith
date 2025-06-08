// src/lib/llm/gemini.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { GENERATION_TARGET_CURSOR_MARKER } from "../lib/constants";
import type { AssembledContextForLLM } from "../lib/core/textTransformer";
import {
	GEMINI_MODEL_ID_MAP,
	MODEL_SPECS,
	TextTransformerPrompt,
	TextTransformerSettings,
} from "../lib/settings-data";
import { logError } from "../lib/utils";

/**
 * Sends a request to the Google Gemini API.
 * @param settings The plugin settings.
 * @param oldText The original text to be transformed. Empty for generation tasks.
 * @param prompt The prompt detailing the transformation or generation task.
 * @param additionalContextForAI Optional additional context to provide to the AI.
 * @param isGenerationTask Flag indicating if this is a text generation task.
 * @returns A promise that resolves to an object containing the new text,
 *          whether the output might be overlength, and the estimated cost,
 *          or undefined if an error occurs.
 */
export async function geminiRequest(
	plugin: { runtimeDebugMode: boolean }, // Added plugin argument
	settings: TextTransformerSettings,
	oldText: string, // This will be an empty string for generation tasks
	prompt: TextTransformerPrompt,
	assembledContext?: AssembledContextForLLM, // Changed parameter type and name
	isGenerationTask = false,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.geminiApiKey) {
		new Notice("Please set your Gemini API key in the plugin settings.");
		return;
	}

	let fullPrompt = "";
	const customContextStart = "--- Custom Context Start ---";
	const customContextEnd = "--- Custom Context End ---";
	// REFERENCED_NOTES_START/END are part of assembledContext.referencedNotesContent if it exists
	// CURRENT_NOTE_CONTEXT_START/END are part of assembledContext.editorContextContent if it exists

	if (isGenerationTask) {
		fullPrompt =
			"You are an AI assistant embedded in Obsidian, tasked with generating text based on a user prompt. Your primary instruction is to fulfill the user's ad-hoc prompt. ";

		if (assembledContext?.customContext) {
			fullPrompt += `You will be given \'Custom Context\' (marked as \'${customContextStart}\' and \'${customContextEnd}\'). Any guidance, instructions, rules, or requests found within this block MUST be strictly obeyed and are considered as important as the user\'s ad-hoc prompt. `;
		}
		if (assembledContext?.referencedNotesContent) {
			fullPrompt += `You may also be given \'Referenced Notes\' (typically marked with \'--- BEGIN REFERENCED NOTES ---\' and \'--- END REFERENCED NOTES ---\'). Treat this as supplementary background information unless instructed otherwise in the \'Custom Context\'. `;
		}
		if (assembledContext?.editorContextContent) {
			fullPrompt += `Additionally, you will see \'Current Note Context\' (typically marked with \'--- Current Note Context Start ---\' and \'--- Current Note Context End ---\') which represents content from the current editor. `;
			if (assembledContext.editorContextContent.includes(GENERATION_TARGET_CURSOR_MARKER)) {
				fullPrompt += `This \'Current Note Context\' contains a marker \'${GENERATION_TARGET_CURSOR_MARKER}\'. This marker indicates the precise spot where the new text should be generated or inserted. `;
			}
		}

		fullPrompt +=
			"Output ONLY the generated text, without any preambles or explanatory sentences. ";

		// Append actual context blocks
		if (assembledContext?.customContext) {
			fullPrompt += `\n\n${customContextStart}\n${assembledContext.customContext}\n${customContextEnd}`;
		}
		if (assembledContext?.referencedNotesContent) {
			fullPrompt += `\n\n${assembledContext.referencedNotesContent}`; // Already wrapped
		}
		if (assembledContext?.editorContextContent) {
			fullPrompt += `\n\n${assembledContext.editorContextContent}`; // Already wrapped
		}

		fullPrompt += `\n\nUser's ad-hoc prompt: ${prompt.text}\n\nGenerate text to fulfill this prompt. Output ONLY the generated text.`;
	} else {
		// Transformation logic
		fullPrompt = "You are an AI assistant. You will be provided with a 'Text to Transform'. ";

		if (assembledContext?.customContext) {
			fullPrompt += `You will also be given \'Custom Context\' (marked as \'${customContextStart}\' and \'${customContextEnd}\'). Any guidance, instructions, rules, or requests contained in this block MUST be strictly obeyed and are as important as the main \'User\'s instruction\'. `;
		}
		if (assembledContext?.referencedNotesContent) {
			fullPrompt += `You may also be given \'Referenced Notes\' (typically marked with \'--- BEGIN REFERENCED NOTES ---\' and \'--- END REFERENCED NOTES ---\'). Treat this as background information for the transformation unless instructed otherwise in the \'Custom Context\'. `;
		}
		if (assembledContext?.editorContextContent) {
			fullPrompt += `Additionally, \'Current Note Context\' (typically marked with \'--- Current Note Context Start ---\' and \'--- Current Note Context End ---\') provides surrounding content from the editor for awareness. `;
		}
		fullPrompt +=
			"Apply instructions ONLY to the 'Text to Transform'. Do not comment on or alter any provided context blocks (Custom Context, Referenced Notes, Current Note Context). ";

		// Append actual context blocks
		if (assembledContext?.customContext) {
			fullPrompt += `\n\n${customContextStart}\n${assembledContext.customContext}\n${customContextEnd}`;
		}
		if (assembledContext?.referencedNotesContent) {
			fullPrompt += `\n\n${assembledContext.referencedNotesContent}`; // Already wrapped
		}
		if (assembledContext?.editorContextContent) {
			// Note: The 'oldText' parameter is the specific text to transform.
			// The 'editorContextContent' is the broader surrounding context.
			// We display editorContextContent for awareness.
			fullPrompt += `\n\n${assembledContext.editorContextContent}`; // Already wrapped
		}

		fullPrompt += `\n\nUser's instruction: ${prompt.text}`;
		fullPrompt += `\n\n--- Text to Transform Start ---\n${oldText}\n--- Text to Transform End ---`;
		fullPrompt += "\n\nTransformed text:";
	}

	let response: RequestUrlResponse;
	try {
		const actualModelId = GEMINI_MODEL_ID_MAP[settings.model] || settings.model;
		const requestBody: {
			contents: Array<{ parts: Array<{ text: string }> }>;
			generationConfig: {
				temperature: number;
				thinkingConfig?: { thinkingBudget: number };
			};
			// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
			tool_config: {
				// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
				function_calling_config: { mode: string };
			};
		} = {
			contents: [
				{
					parts: [{ text: fullPrompt }],
				},
			],
			generationConfig: {
				temperature: settings.temperature,
			},
			// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
			tool_config: {
				// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
				function_calling_config: { mode: "NONE" },
			},
		};

		if (actualModelId.includes("flash")) {
			requestBody.generationConfig.thinkingConfig = {
				thinkingBudget: isGenerationTask ? 1 : 0,
			};
		}
		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Gemini Request Body:", requestBody);
		}

		response = await requestUrl({
			url:
				"https://generativelanguage.googleapis.com/v1beta/models/" +
				actualModelId +
				":generateContent?key=" +
				settings.geminiApiKey,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify(requestBody),
		});
		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Gemini Response:", response);
		}
	} catch (err) {
		console.error("Gemini API error:", err);
		if (err && typeof err === "object" && "response" in err) {
			console.error("Gemini API error response:", (err as { response?: unknown }).response);
		}
		logError(err);
		new Notice("Gemini API request failed. Check your API key and model.");
		return;
	}

	const candidates = response.json?.candidates;
	let newText = candidates?.[0]?.content?.parts?.[0]?.text || "";
	if (newText.startsWith("Generated text:")) {
		newText = newText.substring("Generated text:".length).trimStart();
	}
	if (newText.startsWith("Transformed text:")) {
		newText = newText.substring("Transformed text:".length).trimStart();
	}

	const modelSpec = MODEL_SPECS[settings.model];
	const outputTokensUsed =
		response.json?.usageMetadata?.candidatesTokenCount ||
		(newText.split(/\s+/).length > 0 ? newText.split(/\s+/).length : 0);
	const inputTokensUsed =
		response.json?.usageMetadata?.promptTokenCount ||
		(fullPrompt.split(/\s+/).length > 0 ? fullPrompt.split(/\s+/).length : 0);

	const isOverlength = modelSpec.maxOutputTokens
		? outputTokensUsed >= modelSpec.maxOutputTokens
		: false;

	const cost = modelSpec.costPerMillionTokens
		? (inputTokensUsed * modelSpec.costPerMillionTokens.input) / 1e6 +
			(outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6
		: 0;

	return { newText, isOverlength, cost };
}
