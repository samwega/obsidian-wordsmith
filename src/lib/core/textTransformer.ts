// src/lib/core/textTransformer.ts
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { diffWordsWithSpace } from "diff";
import { Editor, Notice, TFile } from "obsidian";

import type TextTransformer from "../../main";
import { CONTEXT_CONTROL_VIEW_TYPE, ContextControlPanel } from "../../ui/context-control-panel";

import { chatCompletionRequest } from "../../llm/chat-completion-handler";
import { geminiRequest } from "../../llm/gemini";
import {
	AITaskScope,
	AITaskType,
	GENERATION_TARGET_CURSOR_MARKER,
	NEWLINE_REMOVE_SYMBOL,
} from "../constants";
import type { AITaskScopeType, AITaskType as AITaskTypeType } from "../constants";
import {
	SuggestionMark,
	clearAllSuggestionsEffect,
	generateSuggestionId,
	setSuggestionsEffect,
	suggestionStateField,
} from "../editor/suggestion-state";
import type { TextTransformerPrompt } from "../settings-data";
import { getCmEditorView, logError } from "../utils";

export interface AssembledContextForLLM {
	customContext?: string;
	referencedNotesContent?: string;
	editorContextContent?: string;
}

export async function gatherContextForAI(
	plugin: TextTransformer,
	cmView: EditorView,
	taskType: AITaskTypeType,
	scopeDetails?: { range: { from: number; to: number }; originalText: string },
): Promise<AssembledContextForLLM> {
	const { app, settings } = plugin;
	const assembledContext: AssembledContextForLLM = {};
	const currentFile = app.workspace.getActiveFile();

	if (settings.useCustomContext) {
		const contextPanelLeaves = app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
		if (
			contextPanelLeaves.length > 0 &&
			contextPanelLeaves[0].view instanceof ContextControlPanel
		) {
			const contextPanel = contextPanelLeaves[0].view;
			const structuredContext = await contextPanel.getStructuredCustomContext();
			if (structuredContext.rawText) {
				assembledContext.customContext = structuredContext.rawText;
			}
			if (structuredContext.referencedNotes && structuredContext.referencedNotes.length > 0) {
				let referencedNotesText = "--- BEGIN REFERENCED NOTES ---\n";
				for (const note of structuredContext.referencedNotes) {
					referencedNotesText += `\n${note.originalWikilink}\n`;
					referencedNotesText += `SourcePath: ${note.sourcePath}\n`;
					referencedNotesText += `Content:\n${note.content}\n`;
				}
				referencedNotesText += "\n--- END REFERENCED NOTES ---";
				assembledContext.referencedNotesContent = referencedNotesText;
			}
		} else if (settings.customContextText) {
			assembledContext.customContext = settings.customContextText;
		}
	}

	const doc = cmView.state.doc;

	if (settings.useHeaderContext && currentFile) {
		const fileCache = app.metadataCache.getFileCache(currentFile);
		const headings = fileCache?.headings ?? [];
		const cursorOffset = cmView.state.selection.main.head;

		let startPos = 0;
		let endPos = doc.length;

		// Find the heading immediately preceding the cursor
		const currentHeading = headings.filter((h) => h.position.start.offset <= cursorOffset).pop();

		if (currentHeading) {
			startPos = currentHeading.position.start.offset;

			// Find the next heading of the same or higher level
			const currentHeadingIndex = headings.findIndex((h) => h === currentHeading);
			const nextHeading = headings
				.slice(currentHeadingIndex + 1)
				.find((h) => h.level <= currentHeading.level);

			if (nextHeading) {
				endPos = nextHeading.position.start.offset;
			}
		}

		let sectionContent = doc.sliceString(startPos, endPos);

		if (taskType === AITaskType.Generation) {
			// Adjust cursor position to be relative to the section start
			const relativeCursorOffset = cursorOffset - startPos;
			const safeCursorOffset = Math.min(relativeCursorOffset, sectionContent.length);
			sectionContent =
				sectionContent.substring(0, safeCursorOffset) +
				GENERATION_TARGET_CURSOR_MARKER +
				sectionContent.substring(safeCursorOffset);
		}

		assembledContext.editorContextContent = `--- Current Note Context (Section) Start ---\nFilename: ${currentFile.name}\n${sectionContent}\n--- Current Note Context (Section) End ---`;
	} else if (settings.useDynamicContext && currentFile) {
		const linesToInclude = settings.dynamicContextLineCount;
		const cursorOffset = cmView.state.selection.main.head;
		let startLineNum: number;
		let endLineNum: number;

		if (taskType === AITaskType.Generation) {
			const cursorLineNum = doc.lineAt(cursorOffset).number;
			startLineNum = Math.max(1, cursorLineNum - linesToInclude);
			endLineNum = Math.min(doc.lines, cursorLineNum + linesToInclude);
		} else if (scopeDetails) {
			const selectionStartLine = doc.lineAt(scopeDetails.range.from).number;
			const selectionEndLine = doc.lineAt(scopeDetails.range.to).number;
			startLineNum = Math.max(1, selectionStartLine - linesToInclude);
			endLineNum = Math.min(doc.lines, selectionEndLine + linesToInclude);
		} else {
			startLineNum = 1;
			endLineNum = doc.lines;
		}

		let dynamicContextAccumulator = "";
		for (let i = startLineNum; i <= endLineNum; i++) {
			const line = doc.line(i);
			let lineText = line.text;

			if (
				taskType === AITaskType.Generation &&
				cursorOffset >= line.from &&
				cursorOffset <= line.to
			) {
				const charPosInLine = cursorOffset - line.from;
				lineText =
					lineText.substring(0, charPosInLine) +
					GENERATION_TARGET_CURSOR_MARKER +
					lineText.substring(charPosInLine);
			}
			dynamicContextAccumulator += lineText;
			if (i < endLineNum) {
				dynamicContextAccumulator += "\n";
			}
		}
		assembledContext.editorContextContent = `--- Current Note Context Start ---\nFilename: ${currentFile.name}\n${dynamicContextAccumulator}\n--- Current Note Context End ---`;
	} else if (settings.useWholeNoteContext && currentFile) {
		let fileContent = await app.vault.cachedRead(currentFile);
		if (taskType === AITaskType.Generation) {
			const cursorOffset = cmView.state.selection.main.head;
			const safeCursorOffset = Math.min(cursorOffset, fileContent.length);
			fileContent =
				fileContent.substring(0, safeCursorOffset) +
				GENERATION_TARGET_CURSOR_MARKER +
				fileContent.substring(safeCursorOffset);
		}
		assembledContext.editorContextContent = `--- Current Note Context Start ---\nFilename: ${currentFile.name}\n${fileContent}\n--- Current Note Context End ---`;
	}

	return assembledContext;
}

function getChatCompletionsRequestOptions(plugin: TextTransformer): {
	apiUrl: string;
	apiKey: string;
	modelId: string;
	additionalHeaders?: Record<string, string>;
} | null {
	const { settings } = plugin;
	const { customProviders, selectedModelId } = settings;

	if (!selectedModelId) {
		new Notice("No model selected. Please select a model in the WordSmith context panel.", 6000);
		return null;
	}

	const [providerName, modelApiId] = selectedModelId.split("//");
	if (!providerName || !modelApiId) {
		new Notice(`Invalid selected model ID format: ${selectedModelId}. Please re-select.`, 6000);
		return null;
	}

	const provider = customProviders.find((p) => p.name === providerName);
	if (!provider || !provider.isEnabled) {
		new Notice(
			`Provider "${providerName}" not found or is disabled. Please check WordSmith settings.`,
			6000,
		);
		return null;
	}

	const chatOptions: ReturnType<typeof getChatCompletionsRequestOptions> = {
		apiUrl: `${provider.endpoint}/chat/completions`,
		apiKey: provider.apiKey,
		modelId: modelApiId,
	};

	if (provider.name.toLowerCase().includes("openrouter")) {
		chatOptions.additionalHeaders = {
			"HTTP-Referer": plugin.manifest.id,
			"X-Title": plugin.manifest.name,
		};
	}

	return chatOptions;
}

export async function generateTextAndApplyAsSuggestionCM6(
	plugin: TextTransformer,
	editor: Editor,
	userPromptText: string,
): Promise<void> {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("WordSmith requires a modern editor version.");
		return;
	}

	const existingSuggestions = cm.state.field(suggestionStateField, false);
	if (existingSuggestions && existingSuggestions.length > 0) {
		new Notice("There are already active suggestions. Please accept or reject them first.", 6000);
		return;
	}

	const { settings } = plugin;
	const { customProviders, selectedModelId } = settings;
	if (!selectedModelId) {
		new Notice("No model selected. Please select one in the context panel.", 6000);
		return;
	}
	const [providerName, modelApiId] = selectedModelId.split("//");
	const provider = customProviders.find((p) => p.name === providerName);
	if (!provider || !provider.isEnabled) {
		new Notice(`Provider "${providerName}" is not configured or disabled.`, 6000);
		return;
	}

	const cursorOffset = cm.state.selection.main.head;
	const additionalContextForAI = await gatherContextForAI(plugin, cm, AITaskType.Generation);

	const adHocPrompt: TextTransformerPrompt = {
		id: "ad-hoc-generation",
		name: "Ad-hoc Generation",
		text: userPromptText,
		isDefault: false,
		enabled: true,
	};

	const notice = new Notice("🤖 Generating text...", 0);
	try {
		let response: { newText: string } | undefined;

		const isGeminiProvider = provider.endpoint.includes("generativelanguage.googleapis.com");
		if (isGeminiProvider) {
			response = await geminiRequest(plugin, {
				settings,
				prompt: adHocPrompt,
				isGenerationTask: true,
				provider,
				modelApiId,
				assembledContext: additionalContextForAI,
			});
		} else {
			const requestOptions = getChatCompletionsRequestOptions(plugin);
			if (!requestOptions) {
				notice.hide();
				return;
			}
			response = await chatCompletionRequest(plugin, {
				settings,
				prompt: adHocPrompt,
				isGenerationTask: true,
				assembledContext: additionalContextForAI,
				...requestOptions,
			});
		}

		notice.hide();
		const { newText: generatedText } = response || {};

		if (!generatedText) {
			new Notice("AI did not return any generated text.", 5000);
			return;
		}

		const normalizedGeneratedText = generatedText.replace(/\r\n|\r/g, "\n");
		const marksToApply: SuggestionMark[] = [];
		let currentParseOffsetInGeneratedText = 0;

		while (currentParseOffsetInGeneratedText < normalizedGeneratedText.length) {
			let ghostTextSegment = "";
			let isNewlineSegment = false;

			if (normalizedGeneratedText.startsWith("\n", currentParseOffsetInGeneratedText)) {
				isNewlineSegment = true;
				ghostTextSegment = "\n";
				currentParseOffsetInGeneratedText += 1;
			} else {
				let nextNewlineIndex = normalizedGeneratedText.indexOf(
					"\n",
					currentParseOffsetInGeneratedText,
				);
				if (nextNewlineIndex === -1) nextNewlineIndex = normalizedGeneratedText.length;
				ghostTextSegment = normalizedGeneratedText.substring(
					currentParseOffsetInGeneratedText,
					nextNewlineIndex,
				);
				currentParseOffsetInGeneratedText = nextNewlineIndex;
			}

			if (ghostTextSegment.length > 0) {
				marksToApply.push({
					id: generateSuggestionId(),
					from: cursorOffset,
					to: cursorOffset,
					type: "added",
					ghostText: ghostTextSegment,
					isNewlineChange: isNewlineSegment,
					newlineChar: isNewlineSegment ? "\n" : undefined,
				});
			}
		}

		cm.dispatch({
			effects: [clearAllSuggestionsEffect.of(null), setSuggestionsEffect.of(marksToApply)],
			selection:
				marksToApply.length > 0
					? EditorSelection.cursor(marksToApply[0].from)
					: EditorSelection.cursor(cursorOffset),
			scrollIntoView: true,
		});

		new Notice("✅ Ad-hoc generation complete.", 5000);
	} catch (error) {
		notice.hide();
		logError(error);
	}
}

/**
 * Handles the API request for an AI transformation.
 * @returns The AI's response or undefined if the request fails pre-flight checks.
 */
async function fetchAiTransformation(
	plugin: TextTransformer,
	prompt: TextTransformerPrompt,
	originalText: string,
	assembledContext: AssembledContextForLLM,
): Promise<{ newText: string } | undefined> {
	const { settings } = plugin;
	const { customProviders, selectedModelId } = settings;

	if (!selectedModelId) {
		new Notice("No model selected. Please select one in the context panel.", 6000);
		return;
	}
	const [providerName, modelApiId] = selectedModelId.split("//");
	const provider = customProviders.find((p) => p.name === providerName);
	if (!provider || !provider.isEnabled) {
		new Notice(`Provider "${providerName}" is not configured or disabled.`, 6000);
		return;
	}

	const isGeminiProvider = provider.endpoint.includes("generativelanguage.googleapis.com");
	if (isGeminiProvider) {
		return geminiRequest(plugin, {
			settings,
			prompt,
			isGenerationTask: false,
			provider,
			modelApiId,
			oldText: originalText,
			assembledContext,
		});
	}

	const requestOptions = getChatCompletionsRequestOptions(plugin);
	if (!requestOptions) {
		return;
	}
	return chatCompletionRequest(plugin, {
		settings,
		prompt,
		isGenerationTask: false,
		oldText: originalText,
		assembledContext,
		...requestOptions,
	});
}

/**
 * Diffs the AI's response with the original text and applies the changes as suggestions in the editor.
 */
function applyTransformationAsSuggestions(
	cm: EditorView,
	originalText: string,
	newText: string,
	scopeRangeCm: { from: number; to: number },
): void {
	const normalizedOriginalText = originalText.replace(/\r\n|\r/g, "\n");
	const normalizedNewText = newText.replace(/\r\n|\r/g, "\n");

	const diffResult = diffWordsWithSpace(normalizedOriginalText, normalizedNewText);
	if (!diffResult.some((part) => part.added || part.removed)) {
		new Notice("✅ No changes suggested by AI.", 4000);
		return;
	}

	const suggestionMarksToApply: SuggestionMark[] = [];
	let currentOffsetInOriginalDocSegment = 0;

	for (const part of diffResult) {
		const partValue = part.value;

		if (part.added) {
			let currentPosInPartValue = 0;
			while (currentPosInPartValue < partValue.length) {
				const markAnchorPosInDoc = scopeRangeCm.from + currentOffsetInOriginalDocSegment;
				let ghostTextSegment = "";
				let isNewlineSeg = false;

				if (partValue.startsWith("\n", currentPosInPartValue)) {
					ghostTextSegment = "\n";
					isNewlineSeg = true;
					currentPosInPartValue += 1;
				} else {
					const nextNewlineIndex = partValue.indexOf("\n", currentPosInPartValue);
					const endOfTextSegment =
						nextNewlineIndex === -1 ? partValue.length : nextNewlineIndex;
					ghostTextSegment = partValue.substring(currentPosInPartValue, endOfTextSegment);
					currentPosInPartValue = endOfTextSegment;
				}

				if (ghostTextSegment.length > 0) {
					suggestionMarksToApply.push({
						id: generateSuggestionId(),
						from: markAnchorPosInDoc,
						to: markAnchorPosInDoc,
						type: "added",
						ghostText: ghostTextSegment,
						isNewlineChange: isNewlineSeg,
						newlineChar: isNewlineSeg ? "\n" : undefined,
					});
				}
			}
		} else if (part.removed) {
			let currentPosInPartValue = 0;
			while (currentPosInPartValue < partValue.length) {
				const markStartPosInDoc = scopeRangeCm.from + currentOffsetInOriginalDocSegment;
				let removedTextSegment = "";
				let isNewlineSeg = false;

				if (partValue.startsWith("\n", currentPosInPartValue)) {
					removedTextSegment = "\n";
					isNewlineSeg = true;
					currentPosInPartValue += 1;
				} else {
					const nextNewlineIndex = partValue.indexOf("\n", currentPosInPartValue);
					const endOfTextSegment =
						nextNewlineIndex === -1 ? partValue.length : nextNewlineIndex;
					removedTextSegment = partValue.substring(currentPosInPartValue, endOfTextSegment);
					currentPosInPartValue = endOfTextSegment;
				}

				if (removedTextSegment.length > 0) {
					const markEndPosInDoc = markStartPosInDoc + removedTextSegment.length;
					suggestionMarksToApply.push({
						id: generateSuggestionId(),
						from: markStartPosInDoc,
						to: markEndPosInDoc,
						type: "removed",
						isNewlineChange: isNewlineSeg,
						newlineChar: isNewlineSeg ? "\n" : undefined,
						ghostText: isNewlineSeg ? NEWLINE_REMOVE_SYMBOL : "",
					});
					currentOffsetInOriginalDocSegment += removedTextSegment.length;
				}
			}
		} else {
			currentOffsetInOriginalDocSegment += partValue.length;
		}
	}

	cm.dispatch({
		effects: [
			clearAllSuggestionsEffect.of(null),
			setSuggestionsEffect.of(suggestionMarksToApply),
		],
		selection:
			suggestionMarksToApply.length > 0
				? EditorSelection.cursor(suggestionMarksToApply[0].from)
				: EditorSelection.cursor(scopeRangeCm.from),
		scrollIntoView: true,
	});

	new Notice(
		`✅ ${suggestionMarksToApply.length} suggestion${suggestionMarksToApply.length === 1 ? "" : "s"} applied.`,
		5000,
	);
}

export async function textTransformerTextCM6(
	plugin: TextTransformer,
	editor: Editor,
	prompt: TextTransformerPrompt,
	file: TFile,
): Promise<void> {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Modern editor version required.");
		return;
	}
	if (editor.listSelections().length > 1) {
		new Notice("Multiple selections are not yet supported.", 4000);
		return;
	}

	const existingSuggestions = cm.state.field(suggestionStateField, false);
	if (existingSuggestions && existingSuggestions.length > 0) {
		new Notice("There are already active suggestions. Please accept or reject them first.", 6000);
		return;
	}

	// 1. Determine Scope
	let originalText: string;
	let textScope: AITaskScopeType;
	let rangeCm: { from: number; to: number };
	const currentCmSelection = cm.state.selection.main;

	if (currentCmSelection.empty) {
		const doc = cm.state.doc;
		const cursorLine = doc.lineAt(currentCmSelection.head);
		let paraStartLine = cursorLine;
		let paraEndLine = cursorLine;

		if (cursorLine.text.trim() === "") {
			paraStartLine = cursorLine;
			paraEndLine = cursorLine;
		} else {
			while (paraStartLine.number > 1 && doc.line(paraStartLine.number - 1).text.trim() !== "") {
				paraStartLine = doc.line(paraStartLine.number - 1);
			}
			while (
				paraEndLine.number < doc.lines &&
				doc.line(paraEndLine.number + 1).text.trim() !== ""
			) {
				paraEndLine = doc.line(paraEndLine.number + 1);
			}
		}
		rangeCm = { from: paraStartLine.from, to: paraEndLine.to };
		originalText = cm.state.sliceDoc(rangeCm.from, rangeCm.to);
		textScope = AITaskScope.Paragraph;
	} else {
		originalText = cm.state.sliceDoc(currentCmSelection.from, currentCmSelection.to);
		textScope = AITaskScope.Selection;
		rangeCm = { from: currentCmSelection.from, to: currentCmSelection.to };
	}

	if (originalText.trim() === "") {
		new Notice(`${textScope} is empty.`);
		return;
	}

	// 2. Prepare and Orchestrate
	const notice = new Notice(`🤖 Transforming ${textScope.toLowerCase()}...`, 0);
	const fileBeforePath = file.path;

	try {
		const currentPrompt: TextTransformerPrompt = { ...prompt };
		if (currentPrompt.id === "translate") {
			currentPrompt.text = currentPrompt.text.replace(
				"{language}",
				plugin.settings.translationLanguage?.trim() || "English",
			);
		}

		const additionalContextForAI = await gatherContextForAI(
			plugin,
			cm,
			AITaskType.Transformation,
			{
				range: rangeCm,
				originalText,
			},
		);

		const response = await fetchAiTransformation(
			plugin,
			currentPrompt,
			originalText,
			additionalContextForAI,
		);

		notice.hide();

		if (fileBeforePath !== plugin.app.workspace.getActiveFile()?.path) {
			new Notice("⚠️ Active file changed during transformation. Aborting.", 5000);
			return;
		}

		const { newText: newTextFromAI } = response || {};
		if (!newTextFromAI) {
			new Notice("AI did not return new text.", 5000);
			return;
		}

		applyTransformationAsSuggestions(cm, originalText, newTextFromAI, rangeCm);
	} catch (error) {
		notice.hide();
		logError(error);
	}
}
