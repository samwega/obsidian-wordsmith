// src/llm/gemini.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { AssembledContextForLLM } from "../lib/core/textTransformer";
import type {
	CustomProvider,
	TextTransformerPrompt,
	TextTransformerSettings,
} from "../lib/settings-data";
import { logError } from "../lib/utils";
import type TextTransformer from "../main";
import { buildPromptComponents } from "./prompt-builder";

export async function geminiRequest(
	plugin: TextTransformer,
	settings: TextTransformerSettings,
	oldText: string,
	prompt: TextTransformerPrompt,
	assembledContext: AssembledContextForLLM | undefined,
	isGenerationTask: boolean,
	provider: CustomProvider,
	modelApiId: string,
): Promise<{ newText: string } | undefined> {
	if (!provider.apiKey) {
		new Notice("Gemini API key is missing for the selected provider.", 6000);
		return;
	}

	const { systemInstructions, userContent, contextBlock } = buildPromptComponents(
		assembledContext,
		prompt,
		isGenerationTask,
		oldText,
	);

	const fullPrompt = [systemInstructions, contextBlock, userContent].filter(Boolean).join("\n\n");

	// Strip "google/" prefix from model ID if present, as Gemini API expects just the model name
	const cleanModelId = modelApiId.startsWith("google/") ? modelApiId.slice(7) : modelApiId;
	const requestUrlString = `${provider.endpoint}/${cleanModelId}:generateContent?key=${provider.apiKey}`;

	const requestBody = {
		contents: [{ parts: [{ text: fullPrompt }] }],
		generationConfig: {
			temperature: settings.temperature,
			maxOutputTokens: settings.max_tokens,
		},
		safetySettings: [
			{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
			{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
			{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
			{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
		],
	};

	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Gemini Request Body:", requestBody);
		console.debug("[WordSmith plugin] Gemini Request URL:", requestUrlString);
	}

	let response: RequestUrlResponse;
	try {
		response = await requestUrl({
			url: requestUrlString,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify(requestBody),
		});

		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Gemini Response:", response);
		}
	} catch (error) {
		logError(error);
		return;
	}

	const newText = response.json?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (newText === undefined) {
		logError(response.json || "Gemini response was empty or malformed.");
		return;
	}

	return { newText };
}
