// src/textTransformer.ts
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { diffWordsWithSpace } from "diff";
import { Editor, Notice } from "obsidian"; // Removed getFrontMatterInfo

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
const GENERATION_TARGET_CURSOR_MARKER = "<<<GENERATION_TARGET_CURSOR_POSITION>>>";

function getCmEditorView(editor: Editor): EditorView | null {
	const cmInstance = editor.cm;
	return cmInstance instanceof EditorView ? cmInstance : null;
}

export async function generateTextAndApplyAsSuggestionCM6(
	plugin: TextTransformer,
	editor: Editor,
	userPromptText: string,
): Promise<void> {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Text Transformer requires a modern editor version. Cannot apply suggestions.");
		return;
	}

	const existingSuggestions = cm.state.field(suggestionStateField, false);
	if (existingSuggestions && existingSuggestions.length > 0) { 
		new Notice(
			"There are already active suggestions. Please accept or reject them first.",
			6000,
		);
		return;
	}

	const { app, settings } = plugin;
	let additionalContextForAI = "";
	const contextParts: string[] = [];
	const currentFile = app.workspace.getActiveFile();
	const cursorOffset = cm.state.selection.main.head; 

	const contextPanelLeaves = app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
	if (contextPanelLeaves.length > 0) {
		const view = contextPanelLeaves[0].view;
		if (view instanceof ContextControlPanel) {
			const contextPanel = view as ContextControlPanel;
			const customContext = contextPanel.getCustomContextText();
			const useDynamic = contextPanel.getDynamicContextState();
			const useWholeNote = contextPanel.getWholeNoteContextState();

			if (customContext) {
				contextParts.push(
					`--- Custom Context Start ---
${customContext}
--- Custom Context End ---`
				);
			}

			if (useDynamic) {
				const linesToInclude = plugin.settings.dynamicContextLineCount;
				const doc = cm.state.doc;
				const cursorLineNum = doc.lineAt(cursorOffset).number;
				const startLineNum = Math.max(1, cursorLineNum - linesToInclude);
				const endLineNum = Math.min(doc.lines, cursorLineNum + linesToInclude);
				
				let finalDynamicContext = "";
				for (let i = startLineNum; i <= endLineNum; i++) {
					const line = doc.line(i);
					const lineText = line.text;
					const lineStartOffset = line.from;
					const lineEndOffset = line.to;

					if (cursorOffset >= lineStartOffset && cursorOffset <= lineEndOffset) {
						const charPosInLine = cursorOffset - lineStartOffset;
						finalDynamicContext += lineText.substring(0, charPosInLine) + GENERATION_TARGET_CURSOR_MARKER + lineText.substring(charPosInLine);
					} else {
						finalDynamicContext += lineText;
					}
					if (i < endLineNum) {
						finalDynamicContext += "\n"; 
					}
				}
				contextParts.push(
					`--- Dynamic Context Start ---
${finalDynamicContext}
--- Dynamic Context End ---`
				);

			} else if (useWholeNote && currentFile) {
				let fileContent = await app.vault.cachedRead(currentFile);
				const safeCursorOffset = Math.min(cursorOffset, fileContent.length);
				fileContent = fileContent.substring(0, safeCursorOffset) + GENERATION_TARGET_CURSOR_MARKER + fileContent.substring(safeCursorOffset);
				contextParts.push(
					`--- Entire Note Context Start ---
${fileContent}
--- Entire Note Context End ---`
				);
			}
		}
	}

	if (contextParts.length > 0) {
		additionalContextForAI = contextParts.join(`

`);
	}
	
	const adHocPrompt: TextTransformerPrompt = {
		id: "ad-hoc-generation",
		name: "Ad-hoc Generation",
		text: userPromptText,
        isDefault: false, 
        enabled: true,
        showInPromptPalette: false,
	};

	const notice = new Notice("🤖 Generating text via ad-hoc prompt...", 0);
	let response;
	try {
		const oldTextForAI = ""; 
		response = settings.model.startsWith("gemini-")
			? await geminiRequest(settings, oldTextForAI, adHocPrompt, additionalContextForAI, true)
			: await openAiRequest(settings, oldTextForAI, adHocPrompt, additionalContextForAI);
	} catch (error) {
		new Notice(`AI request failed: ${error instanceof Error ? error.message : String(error)}`, 6000);
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
	let textToInsertInDocument = "";
	let currentParseOffsetInGeneratedText = 0;
	let currentInsertOffsetInDocument = 0;


	while (currentParseOffsetInGeneratedText < normalizedGeneratedText.length) {
		const markStartInDoc = cursorOffset + currentInsertOffsetInDocument;
		let segmentLengthInGeneratedText = 0;
		let textSegmentForDocument = "";
		let isNewlineSegment = false;

		if (normalizedGeneratedText.startsWith("\n", currentParseOffsetInGeneratedText)) {
			isNewlineSegment = true;
			textSegmentForDocument = NEWLINE_ADD_SYMBOL; 
			segmentLengthInGeneratedText = 1; 
		} else {
			let nextNewlineIndex = normalizedGeneratedText.indexOf("\n", currentParseOffsetInGeneratedText);
			if (nextNewlineIndex === -1) {
				nextNewlineIndex = normalizedGeneratedText.length;
			}
			textSegmentForDocument = normalizedGeneratedText.substring(currentParseOffsetInGeneratedText, nextNewlineIndex);
			segmentLengthInGeneratedText = textSegmentForDocument.length;
		}
		
		if (textSegmentForDocument.length > 0) { 
			textToInsertInDocument += textSegmentForDocument;
			const commonMarkProps = {
				id: generateSuggestionId(),
				from: markStartInDoc,
				to: markStartInDoc + textSegmentForDocument.length,
				type: "added" as const,
				isNewlineChange: isNewlineSegment,
			};
		
			const mark: SuggestionMark = isNewlineSegment
				? {
					  ...commonMarkProps,
					  newlineChar: "\n" as const, 
				  }
				: commonMarkProps; 
		
			marksToApply.push(mark);
			currentInsertOffsetInDocument += textSegmentForDocument.length;
		}
		currentParseOffsetInGeneratedText += segmentLengthInGeneratedText;
	}
	
	cm.dispatch(
		cm.state.update({
			changes: { from: cursorOffset, to: cursorOffset, insert: textToInsertInDocument },
			effects: [
                clearAllSuggestionsEffect.of(null), 
                setSuggestionsEffect.of(marksToApply)
            ],
			selection: marksToApply.length > 0 ? EditorSelection.cursor(marksToApply[0].from) : EditorSelection.cursor(cursorOffset + textToInsertInDocument.length),
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
	scope: "Selection" | "Paragraph", // "Document" scope removed
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
					`--- Custom User-Provided Context Start ---
${customText}
--- Custom User-Provided Context End ---`
				);
			if (useDynamic) {
				const linesToIncludeAround = plugin.settings.dynamicContextLineCount;
				let selectionStartLine: number;
				let selectionEndLine: number;

				// For dynamic context, scopeRangeCm already defines the selection or paragraph
                const fromPos = editor.offsetToPos(scopeRangeCm.from);
                const toPos = editor.offsetToPos(scopeRangeCm.to);
				selectionStartLine = fromPos.line;
				selectionEndLine = toPos.line;
				
				const contextStartLine = Math.max(0, selectionStartLine - linesToIncludeAround);
				const contextEndLine = Math.min(
					editor.lastLine(),
					selectionEndLine + linesToIncludeAround,
				);
				const dynamicContextLines: string[] = [];
				for (let i = contextStartLine; i <= contextEndLine; i++)
					dynamicContextLines.push(editor.getLine(i));
				let dynamicContextText = dynamicContextLines.join("\n");
				// Mark the original text within the dynamic context
				if (dynamicContextText.includes(originalText)) 
					dynamicContextText = dynamicContextText.replace(
						originalText,
						`${markerStart}${originalText}${markerEnd}`,
					);
				contextParts.push(
					`--- Dynamic Context Start ---
${dynamicContextText}
--- Dynamic Context End ---`
				);
			} else if (useWholeNote) {
				const currentFile = app.workspace.getActiveFile();
				if (currentFile) {
					const fileContent = await app.vault.cachedRead(currentFile);
					let wholeNoteContext = fileContent;
					// Mark the original text within the whole note context
					if (fileContent.includes(originalText))
						wholeNoteContext = wholeNoteContext.replace(
							originalText,
							`${markerStart}${originalText}${markerEnd}`,
						);
					contextParts.push(
						`--- Whole Note Context Start ---
${wholeNoteContext}
--- Whole Note Context End ---`
					);
				}
			}
			if (contextParts.length > 0) additionalContextForAI = contextParts.join("\n\n");
		}
	}

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
			? await geminiRequest(settings, originalText, currentPrompt, additionalContextForAI)
			: await openAiRequest(settings, originalText, currentPrompt, additionalContextForAI);
	} catch (error) {
		new Notice(`AI request failed: ${error instanceof Error ? error.message : String(error)}`, 6000);
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

	const diffResult = diffWordsWithSpace(normalizedOriginalText, normalizedNewTextFromAI);
	if (!diffResult.some((part) => part.added || part.removed)) {
		new Notice("✅ No changes suggested.", notifDuration);
		return false;
	}

	let textToInsertInEditor = ""; 
	const suggestionMarksToApply: SuggestionMark[] = []; 
	let currentOffsetInEditorText = 0; 

	for (const part of diffResult) {
		const partValue = part.value; 

		if (part.added || part.removed) {
			let currentPosInPartValue = 0;
			while (currentPosInPartValue < partValue.length) {
				const markStartPosInDoc = scopeRangeCm.from + currentOffsetInEditorText; 
				let segmentLengthFromDiff = 0; 
				let textSegmentForEditor = ""; 

				if (partValue.startsWith("\n", currentPosInPartValue)) {
					segmentLengthFromDiff = 1;
					textSegmentForEditor = part.added ? NEWLINE_ADD_SYMBOL : NEWLINE_REMOVE_SYMBOL;
				} else if (partValue.startsWith("\r\n", currentPosInPartValue)) {
					segmentLengthFromDiff = 2; 
					textSegmentForEditor = part.added ? NEWLINE_ADD_SYMBOL : NEWLINE_REMOVE_SYMBOL;
				} else if (partValue.startsWith("\r", currentPosInPartValue)) {
					segmentLengthFromDiff = 1;
					textSegmentForEditor = part.added ? NEWLINE_ADD_SYMBOL : NEWLINE_REMOVE_SYMBOL;
				}


				if (textSegmentForEditor === NEWLINE_ADD_SYMBOL || textSegmentForEditor === NEWLINE_REMOVE_SYMBOL) {
					textToInsertInEditor += textSegmentForEditor;
					suggestionMarksToApply.push({
						id: generateSuggestionId(),
						from: markStartPosInDoc,
						to: markStartPosInDoc + textSegmentForEditor.length,
						type: part.added ? "added" : "removed",
						isNewlineChange: true,
						newlineChar: "\n", 
					});
					currentOffsetInEditorText += textSegmentForEditor.length;
					currentPosInPartValue += segmentLengthFromDiff;
				} else { 
					let nextNewlineIndexInDiffPart = Number.POSITIVE_INFINITY;
					["\n", "\r\n", "\r"].forEach((nl) => {
						const idx = partValue.indexOf(nl, currentPosInPartValue);
						if (idx !== -1) nextNewlineIndexInDiffPart = Math.min(nextNewlineIndexInDiffPart, idx);
					});

					const endOfTextSegmentInDiffPart =
						nextNewlineIndexInDiffPart === Number.POSITIVE_INFINITY
							? partValue.length
							: nextNewlineIndexInDiffPart;
					
					textSegmentForEditor = partValue.substring(currentPosInPartValue, endOfTextSegmentInDiffPart);

					textToInsertInEditor += textSegmentForEditor;
					suggestionMarksToApply.push({
						id: generateSuggestionId(),
						from: markStartPosInDoc,
						to: markStartPosInDoc + textSegmentForEditor.length,
						type: part.added ? "added" : "removed",
					});
					currentOffsetInEditorText += textSegmentForEditor.length;
					currentPosInPartValue = endOfTextSegmentInDiffPart;
				}
			}
		} else { 
			const normalizedUnchangedValue = partValue.replace(/\r\n|\r/g, "\n");
			textToInsertInEditor += normalizedUnchangedValue;
			currentOffsetInEditorText += normalizedUnchangedValue.length;
		}
	}
    
	cm.dispatch(
		cm.state.update({
			changes: { from: scopeRangeCm.from, to: scopeRangeCm.to, insert: textToInsertInEditor },
			effects: [
                clearAllSuggestionsEffect.of(null), 
                setSuggestionsEffect.of(suggestionMarksToApply) 
            ],
			selection: suggestionMarksToApply.length > 0 ? EditorSelection.cursor(suggestionMarksToApply[0].from) : EditorSelection.cursor(scopeRangeCm.from + textToInsertInEditor.length),
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

// textTransformerDocumentCM6 has been removed

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
	await validateAndApplyAIDrivenChanges(plugin, editor, originalText, textScope, prompt, rangeCm);
}