// src/lib/core/text-transformer.ts
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { diffWordsWithSpace } from "diff";
import { Editor, Notice, TFile } from "obsidian";

import { geminiRequest } from "../../llm/gemini";
import { openAiRequest } from "../../llm/openai";
import type TextTransformer from "../../main";
import { CONTEXT_CONTROL_VIEW_TYPE, ContextControlPanel } from "../../ui/context-control-panel";
import type { TextTransformerPrompt } from "../settings-data";

import { GENERATION_TARGET_CURSOR_MARKER, NEWLINE_REMOVE_SYMBOL } from "../constants";
import {
	SuggestionMark,
	clearAllSuggestionsEffect,
	generateSuggestionId,
	setSuggestionsEffect,
	suggestionStateField,
} from "../editor/suggestion-state";
import { getCmEditorView } from "../utils";

export interface AssembledContextForLLM {
	customContext?: string;
	referencedNotesContent?: string;
	editorContextContent?: string;
}

/**
 * Gathers context from the ContextControlPanel settings and the current document state.
 * @param plugin The TextTransformer plugin instance.
 * @param cmView The CodeMirror EditorView instance.
 * @param taskType Specifies if the task is 'generation' or 'transformation', affecting marker usage.
 * @param scopeDetails Optional details about the current selection or paragraph for transformation tasks.
 * @returns A promise that resolves to a string containing the formatted context for the AI.
 */
async function gatherContextForAI(
	plugin: TextTransformer,
	cmView: EditorView,
	taskType: "generation" | "transformation",
	scopeDetails?: { range: { from: number; to: number }; originalText: string },
): Promise<AssembledContextForLLM> {
	const { app } = plugin;
	const assembledContext: AssembledContextForLLM = {};
	const currentFile = app.workspace.getActiveFile();

	const contextPanelLeaves = app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
	if (contextPanelLeaves.length > 0) {
		const view = contextPanelLeaves[0].view;
		// Type assertion to ContextControlPanel after checking instance type
		if (view instanceof ContextControlPanel) {
			const contextPanel = view; // Now correctly typed

			// 1. Custom Context
			if (contextPanel.getCustomContextState()) {
				const structuredContext = await contextPanel.getStructuredCustomContext();
				if (structuredContext.rawText) {
					// The LLM-specific functions will wrap the entire additionalContextForAI
					// with the Custom User-Provided Context Start/End delimiters.
					// So, we just push the rawText here.
					assembledContext.customContext = structuredContext.rawText;
				}

				if (structuredContext.referencedNotes && structuredContext.referencedNotes.length > 0) {
					let referencedNotesText = "--- BEGIN REFERENCED NOTES ---\n";
					for (const note of structuredContext.referencedNotes) {
						// Using note.originalWikilink to accurately represent what the user typed,
						// including any alias.
						referencedNotesText += `\n${note.originalWikilink}\n`;
						referencedNotesText += `SourcePath: ${note.sourcePath}\n`;
						referencedNotesText += `Content:\n${note.content}\n`;
					}
					referencedNotesText += "\n--- END REFERENCED NOTES ---";
					assembledContext.referencedNotesContent = referencedNotesText;
				}
			}

			const useDynamic = contextPanel.getDynamicContextState();
			const useWholeNote = contextPanel.getWholeNoteContextState();
			const doc = cmView.state.doc;

			// 2. Dynamic Context or Whole Note Context
			if (useDynamic && currentFile) {
				const linesToInclude = plugin.settings.dynamicContextLineCount;
				const cursorOffset = cmView.state.selection.main.head;

				let startLineNum: number;
				let endLineNum: number;

				if (taskType === "generation") {
					const cursorLineNum = doc.lineAt(cursorOffset).number;
					startLineNum = Math.max(1, cursorLineNum - linesToInclude);
					endLineNum = Math.min(doc.lines, cursorLineNum + linesToInclude);
				} else if (scopeDetails) {
					const selectionStartLine = doc.lineAt(scopeDetails.range.from).number;
					const selectionEndLine = doc.lineAt(scopeDetails.range.to).number;
					startLineNum = Math.max(1, selectionStartLine - linesToInclude);
					endLineNum = Math.min(doc.lines, selectionEndLine + linesToInclude);
				} else {
					// Should not happen for transformation if scopeDetails is always provided
					startLineNum = 1;
					endLineNum = doc.lines;
				}

				let dynamicContextAccumulator = "";
				for (let i = startLineNum; i <= endLineNum; i++) {
					const line = doc.line(i);
					let lineText = line.text;

					if (
						taskType === "generation" &&
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
				// Use "Current Note Context" label
				// For transformation tasks, textToMark (the selected text) is NOT marked here anymore.
				// It's passed separately as 'oldText' to the LLM.
				assembledContext.editorContextContent = `--- Current Note Context Start ---\nFilename: ${currentFile.name}\n${dynamicContextAccumulator}\n--- Current Note Context End ---`;
			} else if (useWholeNote && currentFile) {
				let fileContent = await app.vault.cachedRead(currentFile);

				if (taskType === "generation") {
					const cursorOffset = cmView.state.selection.main.head;
					const safeCursorOffset = Math.min(cursorOffset, fileContent.length);
					fileContent =
						fileContent.substring(0, safeCursorOffset) +
						GENERATION_TARGET_CURSOR_MARKER +
						fileContent.substring(safeCursorOffset);
				}
				// For transformation tasks, scopeDetails.originalText (the selected text) is NOT marked here anymore.
				// It's passed separately as 'oldText' to the LLM.
				// Use "Current Note Context" label
				assembledContext.editorContextContent = `--- Current Note Context Start ---\nFilename: ${currentFile.name}\n${fileContent}\n--- Current Note Context End ---`;
			}
		}
	}
	return assembledContext;
}

export async function generateTextAndApplyAsSuggestionCM6(
	plugin: TextTransformer,
	editor: Editor,
	userPromptText: string,
): Promise<void> {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("WordSmith requires a modern editor version. Cannot apply suggestions.");
		return;
	}

	const currentFile = plugin.app.workspace.getActiveFile();
	if (!currentFile) {
		new Notice("WordSmith: No active file to generate suggestions for.", 5000);
		return;
	}

	const existingSuggestions = cm.state.field(suggestionStateField, false);
	if (existingSuggestions && existingSuggestions.length > 0) {
		new Notice("There are already active suggestions. Please accept or reject them first.", 6000);
		return;
	}

	const { settings } = plugin;
	const cursorOffset = cm.state.selection.main.head;

	const additionalContextForAI = await gatherContextForAI(plugin, cm, "generation");

	const adHocPrompt: TextTransformerPrompt = {
		id: "ad-hoc-generation",
		name: "Ad-hoc Generation",
		text: userPromptText,
		isDefault: false,
		enabled: true,
		// showInPromptPalette defaults to true if undefined, but not relevant here
	};

	const notice = new Notice("🤖 Generating text via ad-hoc prompt...", 0);
	let response: { newText: string; isOverlength: boolean; cost: number } | undefined;
	try {
		const oldTextForAI = "";
		response = settings.model.startsWith("gemini-")
			? await geminiRequest(settings, oldTextForAI, adHocPrompt, additionalContextForAI, true)
			: await openAiRequest(settings, oldTextForAI, adHocPrompt, additionalContextForAI);
	} catch (error) {
		new Notice(
			`AI request failed: ${error instanceof Error ? error.message : String(error)}`,
			6000,
		);
		notice.hide();
		return;
	} finally {
		notice.hide();
	}

	const { newText: generatedText, cost, isOverlength } = response || {};

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
			ghostTextSegment = "\n"; // The actual character for the ghost text logic
			currentParseOffsetInGeneratedText += 1;
		} else {
			let nextNewlineIndex = normalizedGeneratedText.indexOf(
				"\n",
				currentParseOffsetInGeneratedText,
			);
			if (nextNewlineIndex === -1) {
				nextNewlineIndex = normalizedGeneratedText.length;
			}
			ghostTextSegment = normalizedGeneratedText.substring(
				currentParseOffsetInGeneratedText,
				nextNewlineIndex,
			);
			currentParseOffsetInGeneratedText = nextNewlineIndex;
		}

		if (ghostTextSegment.length > 0) {
			marksToApply.push({
				id: generateSuggestionId(),
				from: cursorOffset, // All segments of generated text are anchored at the initial cursor
				to: cursorOffset, // For "added" type, `to` is same as `from`
				type: "added",
				ghostText: ghostTextSegment,
				isNewlineChange: isNewlineSegment,
				newlineChar: isNewlineSegment ? "\n" : undefined,
			});
		}
	}

	cm.dispatch(
		cm.state.update({
			changes: { from: cursorOffset, to: cursorOffset, insert: "" }, // No initial change to document
			effects: [clearAllSuggestionsEffect.of(null), setSuggestionsEffect.of(marksToApply)],
			selection:
				marksToApply.length > 0
					? EditorSelection.cursor(marksToApply[0].from)
					: EditorSelection.cursor(cursorOffset),
			scrollIntoView: true,
		}),
	);

	if (isOverlength) {
		new Notice("Generated text might be incomplete due to model limits.", 10000);
	}

	let successMessage = `✅ Ad-hoc generation complete. ${marksToApply.length} suggestion segment${marksToApply.length === 1 ? "" : "s"} created.`;
	if (cost !== undefined) {
		successMessage += ` Est. cost: $${cost.toFixed(4)}`;
	}
	new Notice(successMessage, 5000);
}

async function validateAndApplyAIDrivenChanges(
	plugin: TextTransformer,
	editor: Editor,
	originalText: string,
	scope: "Selection" | "Paragraph",
	promptInfo: TextTransformerPrompt,
	scopeRangeCm: { from: number; to: number },
	file: TFile,
): Promise<boolean> {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("WordSmith requires a modern editor version. Cannot apply suggestions.");
		return false;
	}

	if (originalText.trim() === "") {
		new Notice(`${scope} is empty.`);
		return false;
	}

	const existingSuggestions = cm.state.field(suggestionStateField, false);
	if (existingSuggestions && existingSuggestions.length > 0) {
		new Notice(
			`${scope} already has active suggestions. Please accept or reject them first.`,
			6000,
		);
		return false;
	}

	const { settings } = plugin;
	const fileBeforePath = file.path;
	const longInput = originalText.length > (settings.longInputThreshold || 1500);
	const veryLongInput = originalText.length > (settings.veryLongInputThreshold || 15000);
	const notifDuration = longInput ? 0 : 4_000;

	const additionalContextForAI = await gatherContextForAI(plugin, cm, "transformation", {
		range: scopeRangeCm,
		originalText,
	});

	let initialMsg = `🤖 ${scope} is being text transformed…`;
	if (additionalContextForAI) initialMsg += " (with context)";
	if (longInput)
		initialMsg += `

Large text, this may take a moment.${veryLongInput ? " (A minute or longer.)" : ""}`;
	const notice = new Notice(initialMsg, longInput ? 0 : 4000);

	const currentPrompt: TextTransformerPrompt = { ...promptInfo };
	if (currentPrompt.id === "translate") {
		currentPrompt.text = currentPrompt.text.replace(
			"{language}",
			plugin.settings.translationLanguage?.trim() || "target language",
		);
	}

	type ResponseType = Awaited<ReturnType<typeof geminiRequest>>;
	let response: ResponseType;
	try {
		response = settings.model.startsWith("gemini-")
			? await geminiRequest(settings, originalText, currentPrompt, additionalContextForAI, false)
			: await openAiRequest(settings, originalText, currentPrompt, additionalContextForAI);
	} catch (error) {
		new Notice(
			`AI request failed: ${error instanceof Error ? error.message : String(error)}`,
			6000,
		);
		notice.hide();
		return false;
	}

	notice.hide();
	const { newText: newTextFromAI, isOverlength, cost } = response || {};
	if (!newTextFromAI) {
		new Notice("AI did not return new text.", notifDuration);
		return false;
	}
	if (fileBeforePath !== plugin.app.workspace.getActiveFile()?.path) {
		new Notice("⚠️ Active file changed. Aborting.", notifDuration);
		return false;
	}

	const normalizedOriginalText = originalText.replace(/\r\n|\r/g, "\n");
	const normalizedNewTextFromAI = newTextFromAI.replace(/\r\n|\r/g, "\n");

	const diffResult = diffWordsWithSpace(normalizedOriginalText, normalizedNewTextFromAI);
	if (!diffResult.some((part) => part.added || part.removed)) {
		new Notice("✅ No changes suggested.", notifDuration);
		return false;
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
					ghostTextSegment = "\n"; // Actual char for ghost text logic
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
						to: markAnchorPosInDoc, // `to` is same as `from` for "added" type
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
						ghostText: isNewlineSeg ? NEWLINE_REMOVE_SYMBOL : "", // Assign symbol for removed newlines
					});
					currentOffsetInOriginalDocSegment += removedTextSegment.length;
				}
			}
		} else {
			// Unchanged part
			currentOffsetInOriginalDocSegment += partValue.length;
		}
	}

	cm.dispatch(
		cm.state.update({
			changes: {
				from: scopeRangeCm.from,
				to: scopeRangeCm.from,
				insert: "",
			}, // No change to document text itself
			effects: [
				clearAllSuggestionsEffect.of(null), // Clear any previous suggestions
				setSuggestionsEffect.of(suggestionMarksToApply), // Apply new suggestions
			],
			selection:
				suggestionMarksToApply.length > 0
					? EditorSelection.cursor(suggestionMarksToApply[0].from)
					: EditorSelection.cursor(scopeRangeCm.from), // Fallback selection
			scrollIntoView: true,
		}),
	);

	if (isOverlength)
		new Notice("Text > AI model max output. Suggestions may be incomplete.", 10_000);
	new Notice(
		`🤖 ${suggestionMarksToApply.length} suggestion${suggestionMarksToApply.length === 1 ? "" : "s"} applied.
Est. cost: $${cost?.toFixed(4) || "0.0000"}`,
		notifDuration,
	);
	return true;
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
		new Notice("Multiple selections not yet supported.");
		return;
	}

	let originalText: string;
	let textScope: "Selection" | "Paragraph";
	let rangeCm: { from: number; to: number };
	const currentCmSelection = cm.state.selection.main;

	if (currentCmSelection.empty) {
		const doc = cm.state.doc;
		const cursorLine = doc.lineAt(currentCmSelection.head);
		let paraStartLine = cursorLine;
		let paraEndLine = cursorLine;

		// Expand upwards to the start of the paragraph
		// Skips initial empty lines if cursor is on one, then finds non-empty block
		if (cursorLine.text.trim() === "") {
			// If on an empty line, paragraph is just that line
			paraStartLine = cursorLine;
			paraEndLine = cursorLine;
		} else {
			while (paraStartLine.number > 1 && doc.line(paraStartLine.number - 1).text.trim() !== "") {
				paraStartLine = doc.line(paraStartLine.number - 1);
			}
			// Expand downwards to the end of the paragraph
			while (
				paraEndLine.number < doc.lines &&
				doc.line(paraEndLine.number + 1).text.trim() !== ""
			) {
				paraEndLine = doc.line(paraEndLine.number + 1);
			}
		}
		rangeCm = { from: paraStartLine.from, to: paraEndLine.to };
		originalText = cm.state.sliceDoc(rangeCm.from, rangeCm.to);
		textScope = "Paragraph";
	} else {
		originalText = cm.state.sliceDoc(currentCmSelection.from, currentCmSelection.to);
		textScope = "Selection";
		rangeCm = { from: currentCmSelection.from, to: currentCmSelection.to };
	}
	await validateAndApplyAIDrivenChanges(
		plugin,
		editor,
		originalText,
		textScope,
		prompt,
		rangeCm,
		file,
	);
}
