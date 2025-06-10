// src/lib/llm/chat-completion-handler.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { GENERATION_TARGET_CURSOR_MARKER } from "../lib/constants";
import type { AssembledContextForLLM } from "../lib/core/textTransformer";
import { MODEL_SPECS, TextTransformerPrompt, TextTransformerSettings } from "../lib/settings-data";
import { logError } from "../lib/utils";
import type TextTransformer from "../main";

interface ChatCompletionOptions {
	apiUrl: string;
	apiKey: string;
	modelId: string;
	additionalHeaders?: Record<string, string>;
	additionalRequestBodyParams?: Record<string, unknown>;
}

/**
 * A generic handler for chat completion APIs that follow the OpenAI format.
 * @param plugin The main plugin instance.
 * @param settings The plugin settings.
 * @param oldText The original text to be transformed. Empty for generation tasks.
 * @param prompt The prompt detailing the transformation or generation task.
 * @param assembledContext Optional assembled context to provide to the AI.
 * @param isGenerationTask Flag indicating if this is a text generation task.
 * @param options Provider-specific options like API URL, key, and model ID.
 * @returns A promise that resolves to an object containing the new text,
 *          whether the output might be overlength, and the estimated cost,
 *          or undefined if an error occurs.
 */
export async function chatCompletionRequest(
	plugin: TextTransformer,
	settings: TextTransformerSettings,
	oldText: string,
	prompt: TextTransformerPrompt,
	assembledContext: AssembledContextForLLM | undefined,
	isGenerationTask: boolean,
	options: ChatCompletionOptions,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	const customContextStart = "--- Custom Context Start ---";
	const customContextEnd = "--- Custom Context End ---";

	const systemInstructionBuilder: string[] = [
		"--- BEGIN SYSTEM INSTRUCTIONS ---",
		"You are an AI assistant embedded in Obsidian helping with text tasks. Your primary instruction is to fulfill the user's ad-hoc prompt or transformation instruction.",
	];

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

	let systemMessageContent = systemInstructionBuilder.join(" ");

	if (assembledContext?.customContext) {
		systemMessageContent += `\n\n${customContextStart}\n${assembledContext.customContext}\n${customContextEnd}`;
	}
	if (assembledContext?.referencedNotesContent) {
		systemMessageContent += `\n\n${assembledContext.referencedNotesContent}`;
	}
	if (assembledContext?.editorContextContent) {
		systemMessageContent += `\n\n${assembledContext.editorContextContent}`;
	}

	const messages = [
		{ role: "system", content: systemMessageContent },
		{
			role: "user",
			content: isGenerationTask
				? prompt.text
				: `User's transformation instruction: ${prompt.text}\n\n--- Text to Transform Start ---\n${oldText}\n--- Text to Transform End ---`,
		},
	];

	const requestBody = {
		model: options.modelId,
		messages: messages,
		temperature: settings.temperature,
		// biome-ignore lint/style/useNamingConvention: API requires snake_case
		frequency_penalty: prompt.frequency_penalty ?? settings.frequency_penalty,
		// biome-ignore lint/style/useNamingConvention: API requires snake_case
		presence_penalty: prompt.presence_penalty ?? settings.presence_penalty,
		// biome-ignore lint/style/useNamingConvention: API requires snake_case
		max_tokens: prompt.max_tokens ?? settings.max_tokens,
		...(options.additionalRequestBodyParams || {}),
	};

	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Chat Completion Request Body:", requestBody);
	}

	let response: RequestUrlResponse;
	try {
		response = await requestUrl({
			url: options.apiUrl,
			method: "POST",
			contentType: "application/json",
			headers: {
				authorization: `Bearer ${options.apiKey}`,
				...options.additionalHeaders,
			},
			body: JSON.stringify(requestBody),
		});
		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Chat Completion Response:", response);
		}
	} catch (error) {
		if ((error as { status: number }).status === 401) {
			const msg = "API key is not valid. Please verify the key in the plugin settings.";
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

	return { newText, isOverlength, cost };
}
