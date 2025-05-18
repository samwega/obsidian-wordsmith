import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { MODEL_SPECS, ProofreaderSettings } from "src/settings";
import { logError } from "src/utils";
import { ProofreaderPrompt } from "src/settings";

/**
 * Send a request to the Gemini API.
 * Returns: { newText, isOverlength, cost } or undefined on error.
 */
export async function geminiRequest(
  settings: ProofreaderSettings,
  oldText: string,
  prompt: ProofreaderPrompt
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
  if (!settings.geminiApiKey) {
    new Notice("Please set your Gemini API key in the plugin settings.");
    return;
  }

  let response: RequestUrlResponse;
  try {
    // DOCS: https://ai.google.dev/api/rest/v1beta/models/gemini-pro:generateContent
    response = await requestUrl({
      url: "https://generativelanguage.googleapis.com/v1beta/models/" + settings.model + ":generateContent?key=" + settings.geminiApiKey,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt.text + "\n" + oldText }
            ]
          }
        ]
      }),
    });
  } catch (err) {
    logError(err);
    new Notice("Gemini API request failed. Check your API key and model.");
    return;
  }

  // Handle Gemini API response
  const candidates = response.json?.candidates;
  const newText = candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Gemini API does not provide token usage/cost in the same way as OpenAI, so estimate
  const modelSpec = MODEL_SPECS[settings.model];
  const outputTokensUsed = newText.split(/\s+/).length; // crude estimate
  const isOverlength = outputTokensUsed >= modelSpec.maxOutputTokens;
  const cost = (outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6;
  return { newText, isOverlength, cost };
}
