// src/lib/llm/openai.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { GENERATION_TARGET_CURSOR_MARKER } from "../lib/constants";
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
	additionalContextForAI?: string,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.openAiApiKey) {
		new Notice("Please set your OpenAI API key in the plugin settings.");
		return;
	}

	const customContextLabelStart = "--- Custom User-Provided Context Start ---";
	const customContextLabelEnd = "--- Custom User-Provided Context End ---";

	let systemMessageContent =
		"You are an AI assistant embedded in Obsidian helping with text tasks.";

	if (oldText === "" && additionalContextForAI?.includes(GENERATION_TARGET_CURSOR_MARKER)) {
		// Generation task with cursor marker and potential custom context
		systemMessageContent +=
			" The user wants to generate new text. " +
			`The provided context (marked as ${customContextLabelStart} and ${customContextLabelEnd}) may contain a marker '${GENERATION_TARGET_CURSOR_MARKER}'. ` +
			"This marker indicates the precise spot in the context where the user's cursor is, and thus where the new text should be generated or inserted. " +
			`Focus on fulfilling the user's ad-hoc prompt. If '${customContextLabelStart}' and '${customContextLabelEnd}' are present, any instructions contained within them MUST be strictly obeyed and are considered as important as the user's ad-hoc prompt. If more context is provided, it should inform the response. Output ONLY the generated text, without any preambles.`;
	} else if (oldText === "") {
		// Generation task without cursor marker, potential custom context handled later
		systemMessageContent +=
			" The user wants to generate new text. " +
			`Focus on fulfilling the user\'s ad-hoc prompt as the primary instruction. If \'${customContextLabelStart}\' and \'${customContextLabelEnd}\' are present, any instructions contained within them MUST be strictly obeyed and are considered as important as the user\'s ad-hoc prompt. `; // Custom context instructions added if context exists
	} else {
		// Transformation task
		systemMessageContent += " You are provided with text to transform. ";
		if (additionalContextForAI) {
			systemMessageContent += `You will also be given 'Custom User-Provided Context' (marked as ${customContextLabelStart} and ${customContextLabelEnd}). Any instructions, rules, or requests found within this Custom User-Provided Context MUST be strictly obeyed and are as important as the main 'User\'s transformation instruction'. Both sets of instructions should be applied ONLY to the user-provided 'Text to Transform'. Do not comment on or alter the Custom User-Provided Context itself; it is for your awareness and to provide supplementary directives. `;
		} else {
			systemMessageContent += `Your task is to apply the \'User\\\'s transformation instruction\' ONLY to the user-provided text. `;
		}
	}

	// Append the actual custom context if it exists
	if (additionalContextForAI) {
		systemMessageContent += `\n\n${customContextLabelStart}\n${additionalContextForAI}\n${customContextLabelEnd}`;
	}

	// Append the user's ad-hoc prompt or transformation instruction
	if (oldText === "") {
		// Generation tasks
		if (additionalContextForAI) {
			// additionalContextForAI is present for generation
			systemMessageContent += `\n\nUser's ad-hoc prompt: ${prompt.text}\n\nGenerate text to fulfill this prompt, considering the provided context and the ${GENERATION_TARGET_CURSOR_MARKER} marker if present. Output ONLY the generated text.`;
		} else {
			systemMessageContent += `\n\nUser's ad-hoc prompt: ${prompt.text}\n\nGenerate text to fulfill this prompt. Output ONLY the generated text.`;
		}
	} else {
		// Transformation tasks
		systemMessageContent += `\n\nUser's transformation instruction: ${prompt.text}\n\nApply this instruction ONLY to the user-provided text that follows.`;
	}

	const messages = [
		{ role: "system", content: systemMessageContent },
		{ role: "user", content: oldText === "" ? prompt.text : oldText },
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
