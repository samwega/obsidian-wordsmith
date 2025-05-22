import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
// src/textTransformer.ts
import * as Diff from "diff"; // Keep this import
import { Editor, Notice, getFrontMatterInfo } from "obsidian";

import { CONTEXT_CONTROL_VIEW_TYPE, ContextControlPanel } from "./context-control-panel";
import TextTransformer from "./main";
import { geminiRequest } from "./providers/gemini";
import { openAiRequest } from "./providers/openai";
import { TextTransformerPrompt } from "./settings";

import {
	SuggestionMark,
	clearAllSuggestionsEffect,
	generateSuggestionId,
	setSuggestionsEffect,
	suggestionStateField,
} from "./suggestion-state";

export const NEWLINE_ADD_SYMBOL = "↵";
export const NEWLINE_REMOVE_SYMBOL = "¶";

function getCmEditorView(editor: Editor): EditorView | null {
	const cmInstance = editor.cm;
	return cmInstance instanceof EditorView ? cmInstance : null;
}

async function validateAndApplyAIDrivenChanges(
	plugin: TextTransformer,
	editor: Editor,
	originalText: string,
	scope: "Document" | "Selection" | "Paragraph",
	promptInfo: TextTransformerPrompt,
	scopeRangeCm: { from: number; to: number },
): Promise<boolean> {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Text Transformer requires a modern editor version. Cannot apply suggestions.");
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

	const { app, settings } = plugin;
	const fileBefore = app.workspace.getActiveFile()?.path;
	const longInput = originalText.length > (settings.longInputThreshold || 1500);
	const veryLongInput = originalText.length > (settings.veryLongInputThreshold || 15000);
	const notifDuration = longInput ? 0 : 4_000;
	let additionalContextForAI = "";

	const contextPanelLeaves = app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
	if (contextPanelLeaves.length > 0) {
		const view = contextPanelLeaves[0].view;
		if (view instanceof ContextControlPanel) {
			const contextPanel = view as ContextControlPanel;
			const customText = contextPanel.getCustomContextText();
			const useWholeNote = contextPanel.getWholeNoteContextState();
			const useDynamic = contextPanel.getDynamicContextState();
			const contextParts: string[] = [];
			const markerStart = "[[[USER_SELECTED_TEXT_STARTING_HERE>>>";
			const markerEnd = "<<<USER_SELECTED_TEXT_ENDING_HERE]]]";

			if (customText)
				contextParts.push(
					`--- Custom User-Provided Context Start ---\n${customText}\n--- Custom User-Provided Context End ---`,
				);
			if (useDynamic) {
				const linesToIncludeAround = plugin.settings.dynamicContextLineCount;
				let selectionStartLine: number;
				let selectionEndLine: number;
				if (scope === "Selection" && editor.somethingSelected()) {
					const sel = editor.listSelections()[0];
					selectionStartLine = Math.min(sel.anchor.line, sel.head.line);
					selectionEndLine = Math.max(sel.anchor.line, sel.head.line);
				} else {
					selectionStartLine = editor.getCursor("from").line;
					selectionEndLine = selectionStartLine;
				}
				const contextStartLine = Math.max(0, selectionStartLine - linesToIncludeAround);
				const contextEndLine = Math.min(
					editor.lastLine(),
					selectionEndLine + linesToIncludeAround,
				);
				const dynamicContextLines: string[] = [];
				for (let i = contextStartLine; i <= contextEndLine; i++)
					dynamicContextLines.push(editor.getLine(i));
				let dynamicContextText = dynamicContextLines.join("\n");
				if (dynamicContextText.includes(originalText))
					dynamicContextText = dynamicContextText.replace(
						originalText,
						`${markerStart}${originalText}${markerEnd}`,
					);
				contextParts.push(
					`--- Dynamic Context Start ---\n${dynamicContextText}\n--- Dynamic Context End ---`,
				);
			} else if (useWholeNote) {
				const currentFile = app.workspace.getActiveFile();
				if (currentFile) {
					const fileContent = await app.vault.cachedRead(currentFile);
					let wholeNoteContext = fileContent;
					if (scope !== "Document" && fileContent.includes(originalText))
						wholeNoteContext = fileContent.replace(
							originalText,
							`${markerStart}${originalText}${markerEnd}`,
						);
					contextParts.push(
						`--- Whole Note Context Start ---\n${wholeNoteContext}\n--- Whole Note Context End ---`,
					);
				}
			}
			if (contextParts.length > 0) additionalContextForAI = contextParts.join("\n\n");
		}
	}

	let initialMsg = `🤖 ${scope} is being text transformed…`;
	if (additionalContextForAI) initialMsg += " (with context)";
	if (longInput)
		initialMsg += `\n\nLarge text, this may take a moment.${veryLongInput ? " (A minute or longer.)" : ""}`;
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
			? await geminiRequest(settings, originalText, currentPrompt, additionalContextForAI)
			: await openAiRequest(settings, originalText, currentPrompt, additionalContextForAI);
	} catch (error) {
		new Notice(`AI request failed: ${error instanceof Error ? error.message : String(error)}`, 0);
		notice.hide();
		return false;
	}

	notice.hide();
	const { newText: newTextFromAI, isOverlength, cost } = response || {};
	if (!newTextFromAI) {
		new Notice("AI did not return new text.", notifDuration);
		return false;
	}
	if (fileBefore !== app.workspace.getActiveFile()?.path) {
		new Notice("⚠️ Active file changed. Aborting.", notifDuration);
		return false;
	}

	const normalizedOriginalText = originalText.replace(/\r\n|\r/g, "\n");
	const normalizedNewTextFromAI = newTextFromAI.replace(/\r\n|\r/g, "\n");

	const diffResult = Diff.diffWordsWithSpace(normalizedOriginalText, normalizedNewTextFromAI);
	if (!diffResult.some((part) => part.added || part.removed)) {
		new Notice("✅ No changes suggested.", notifDuration);
		return false;
	}

	let textToInsertInEditor = "";
	const suggestionMarks: SuggestionMark[] = [];
	let currentOffsetInEditorText = 0; // Tracks position in textToInsertInEditor

	// console.log("--- Diff Result ---");
	for (const part of diffResult) {
		// console.log("Part:", JSON.stringify(part.value), "Added:", part.added, "Removed:", part.removed);
		const partValue = part.value; // No initial normalization here, diffWordsWithSpace should give \n

		if (part.added || part.removed) {
			let currentPosInPartValue = 0;
			while (currentPosInPartValue < partValue.length) {
				const markStartPosInDoc = scopeRangeCm.from + currentOffsetInEditorText;
				let segmentLength = 0;
				let segmentIsNewline = false;

				// Check for newline characters (LF, CR+LF, CR)
				if (partValue.startsWith("\n", currentPosInPartValue)) {
					segmentLength = 1;
					segmentIsNewline = true;
				} else if (partValue.startsWith("\r\n", currentPosInPartValue)) {
					segmentLength = 2;
					segmentIsNewline = true;
				} else if (partValue.startsWith("\r", currentPosInPartValue)) {
					segmentLength = 1;
					segmentIsNewline = true;
				}

				if (segmentIsNewline) {
					const symbolToInsert = part.added ? NEWLINE_ADD_SYMBOL : NEWLINE_REMOVE_SYMBOL;
					textToInsertInEditor += symbolToInsert;
					suggestionMarks.push({
						id: generateSuggestionId(),
						from: markStartPosInDoc,
						to: markStartPosInDoc + symbolToInsert.length,
						type: part.added ? "added" : "removed",
						isNewlineChange: true,
						newlineChar: "\n", // Standardize to LF for resolution
					});
					currentOffsetInEditorText += symbolToInsert.length;
					currentPosInPartValue += segmentLength;
				} else {
					// Find the next newline or end of partValue to define the text segment
					let nextNewlineIndex = Number.POSITIVE_INFINITY;
					["\n", "\r\n", "\r"].forEach((nl) => {
						const idx = partValue.indexOf(nl, currentPosInPartValue);
						if (idx !== -1) nextNewlineIndex = Math.min(nextNewlineIndex, idx);
					});

					const endOfTextSegment =
						nextNewlineIndex === Number.POSITIVE_INFINITY
							? partValue.length
							: nextNewlineIndex;
					const textSegment = partValue.substring(currentPosInPartValue, endOfTextSegment);

					textToInsertInEditor += textSegment;
					suggestionMarks.push({
						id: generateSuggestionId(),
						from: markStartPosInDoc,
						to: markStartPosInDoc + textSegment.length,
						type: part.added ? "added" : "removed",
						// isNewlineChange is false by default
					});
					currentOffsetInEditorText += textSegment.length;
					currentPosInPartValue = endOfTextSegment;
				}
			}
		} else {
			// Unchanged part
			// Normalize newlines in unchanged parts before adding to textToInsertInEditor
			const normalizedUnchangedValue = partValue.replace(/\r\n|\r/g, "\n");
			textToInsertInEditor += normalizedUnchangedValue;
			currentOffsetInEditorText += normalizedUnchangedValue.length;
		}
	}
	// console.log("--- End Diff Result ---");

	cm.dispatch(
		cm.state.update({
			changes: { from: scopeRangeCm.from, to: scopeRangeCm.to, insert: textToInsertInEditor },
			effects: [clearAllSuggestionsEffect.of(null), setSuggestionsEffect.of(suggestionMarks)],
			selection: EditorSelection.cursor(scopeRangeCm.from + textToInsertInEditor.length),
			scrollIntoView: true,
		}),
	);

	if (isOverlength)
		new Notice("Text > AI model max output. Suggestions may be incomplete.", 10_000);
	new Notice(
		`🤖 ${suggestionMarks.length} suggestion${suggestionMarks.length === 1 ? "" : "s"} applied.\nEst. cost: $${cost?.toFixed(4) || "0.0000"}`,
		notifDuration,
	);
	return true;
}

export async function textTransformerDocumentCM6(
	plugin: TextTransformer,
	editor: Editor,
	prompt?: TextTransformerPrompt,
): Promise<void> {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Modern editor version required.");
		return;
	}
	const fullDocText = editor.getValue();
	const fmInfo = getFrontMatterInfo(fullDocText);
	const bodyTextOffsetStart = fmInfo.contentStart || 0;
	const bodyText = fullDocText.substring(bodyTextOffsetStart);
	const usePrompt =
		prompt ||
		plugin.settings.prompts.find((p) => p.id === plugin.settings.defaultPromptId) ||
		plugin.settings.prompts.find((p) => p.enabled) ||
		plugin.settings.prompts[0];
	if (!usePrompt) {
		new Notice("No prompt for document transformation.");
		return;
	}
	await validateAndApplyAIDrivenChanges(plugin, editor, bodyText, "Document", usePrompt, {
		from: bodyTextOffsetStart,
		to: bodyTextOffsetStart + bodyText.length,
	});
}

export async function textTransformerTextCM6(
	plugin: TextTransformer,
	editor: Editor,
	prompt: TextTransformerPrompt,
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
		while (paraStartLine.number > 1 && doc.line(paraStartLine.number - 1).text.trim() !== "") {
			paraStartLine = doc.line(paraStartLine.number - 1);
		}
		while (
			paraEndLine.number < doc.lines &&
			doc.line(paraEndLine.number + 1).text.trim() !== ""
		) {
			paraEndLine = doc.line(paraEndLine.number + 1);
		}
		rangeCm = { from: paraStartLine.from, to: paraEndLine.to };
		originalText = cm.state.sliceDoc(rangeCm.from, rangeCm.to);
		textScope = "Paragraph";
	} else {
		originalText = cm.state.sliceDoc(currentCmSelection.from, currentCmSelection.to);
		textScope = "Selection";
		rangeCm = { from: currentCmSelection.from, to: currentCmSelection.to };
	}
	if (!prompt) {
		new Notice("No prompt for text transformation.");
		return;
	}
	await validateAndApplyAIDrivenChanges(plugin, editor, originalText, textScope, prompt, rangeCm);
}
