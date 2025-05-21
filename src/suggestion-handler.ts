// src/suggestion-handler.ts
import { Editor, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorSelection, TransactionSpec, StateEffect, Text } from "@codemirror/state";

import { suggestionStateField, resolveSuggestionEffect, SuggestionMark, clearAllSuggestionsEffect } from "./suggestion-state";

function getCmEditorView(editor: Editor): EditorView | null {
	// @ts-expect-error: editor.cm
	const cmInstance = editor.cm;
	return cmInstance instanceof EditorView ? cmInstance : null;
}

// This was the findNextSuggestionMark when things were working without the loop after TypeError fix
function findNextSuggestionMark(cm: EditorView, fromPos?: number): SuggestionMark | null {
	const marks = cm.state.field(suggestionStateField, false);
	if (!marks || marks.length === 0) return null;

	const searchStartPos = fromPos !== undefined ? fromPos : cm.state.selection.main.head;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from);

	for (const mark of sortedMarks) {
		if (mark.from >= searchStartPos) return mark;
	}
	return sortedMarks.length > 0 ? sortedMarks[0] : null;
}


function isPositionVisible(cm: EditorView, pos: number): boolean {
	const coords = cm.coordsAtPos(pos);
	if (!coords) {
		// console.warn(`TextTransformer: coordsAtPos(${pos}) returned null.`); // Optional: for debugging visibility issues
		return false;
	}
	const scrollDOM = cm.scrollDOM;
	return coords.top >= 0 && coords.bottom <= scrollDOM.clientHeight &&
	coords.left >= 0 && coords.right <= scrollDOM.clientWidth &&
	coords.top < scrollDOM.clientHeight && coords.bottom > 0;
}

export function resolveNextSuggestionCM6(editor: Editor, action: 'accept' | 'reject'): void {
	const cm = getCmEditorView(editor);
	if (!cm) { new Notice("Modern editor version required."); return; }

	const currentMarksInState = cm.state.field(suggestionStateField, false);
	if (!currentMarksInState || currentMarksInState.length === 0) {
		new Notice("No suggestions to resolve.", 3000);
		return;
	}

	const currentSelection = cm.state.selection.main;
	let targetMark = findNextSuggestionMark(cm, currentSelection.head);

	if (!targetMark) {
		new Notice("Could not find a next suggestion.", 3000);
		return;
	}

	// If the cursor is empty and already at the start of the found mark,
	// we assume we are "on" it, possibly due to a previous scroll action by this command.
	// In this case, we bypass the visibility check to avoid getting stuck
	// if isPositionVisible has issues (e.g., coordsAtPos returns null or inaccurate values after scroll).
	const effectivelyOnTarget = currentSelection.empty && currentSelection.head === targetMark.from;

	if (!effectivelyOnTarget && !isPositionVisible(cm, targetMark.from)) {
		cm.dispatch({
			effects: EditorView.scrollIntoView(targetMark.from, { y: "center" }),
						selection: EditorSelection.cursor(targetMark.from)
		});
		new Notice(`Scrolled to the next suggestion. Press again to ${action}.`, 3000);
		return;
	}

	let textChangeSpec: { from: number; to: number; insert: string } | undefined = undefined;
	let newCursorPosAfterResolve = targetMark.from;

	if (action === 'accept') {
		if (targetMark.type === 'removed') {
			textChangeSpec = { from: targetMark.from, to: targetMark.to, insert: "" };
		}
	} else { // action === 'reject'
		if (targetMark.type === 'added') {
			textChangeSpec = { from: targetMark.from, to: targetMark.to, insert: "" };
		} else { // type === 'removed' (and action is 'reject')
			newCursorPosAfterResolve = targetMark.to;
		}
	}

	const transactionSpec: TransactionSpec = {
		effects: resolveSuggestionEffect.of({ id: targetMark.id })
	};

	if (textChangeSpec) {
		transactionSpec.changes = textChangeSpec;
		newCursorPosAfterResolve = textChangeSpec.from; // For deletions, cursor goes to start of deleted region
	}
	// For accept 'added', cursor stays at targetMark.from (original start of added text)
	// For reject 'removed', cursor moves to targetMark.to (original end of removed text)
	// This logic seems fine for advancing.

	transactionSpec.selection = EditorSelection.cursor(newCursorPosAfterResolve);

	cm.dispatch(cm.state.update(transactionSpec));

	const marksAfterResolution = cm.state.field(suggestionStateField, false) || [];

	if (marksAfterResolution.length === 0) {
		new Notice(`Last suggestion ${action}ed. All suggestions resolved!`, 3000);
	} else {
		new Notice(`Suggestion ${action}ed. ${marksAfterResolution.length} remaining.`, 3000);

		// Find the next suggestion using the updated cm.state and cursor position
		const nextSuggestionToFocus = findNextSuggestionMark(cm, cm.state.selection.main.head);

		if (nextSuggestionToFocus) {
			// Auto-focus or scroll to the next suggestion
			// The 'effectivelyOnTarget' bypass is not used here as this is proactive focusing,
			// not a response to "press again".
			if (!isPositionVisible(cm, nextSuggestionToFocus.from)) {
				cm.dispatch({
					effects: EditorView.scrollIntoView(nextSuggestionToFocus.from, { y: "center", yMargin: 50 }),
								selection: EditorSelection.cursor(nextSuggestionToFocus.from)
				});
			} else {
				cm.dispatch({
					selection: EditorSelection.cursor(nextSuggestionToFocus.from)
				});
			}
		}
	}
}

function getParagraphBoundaries(doc: Text, pos: number): { from: number; to: number } {
	let lineFrom = doc.lineAt(pos);
	let lineTo = doc.lineAt(pos);

	// Find the start of the paragraph
	while (lineFrom.number > 1) {
		const prevLine = doc.line(lineFrom.number - 1);
		if (prevLine.text.trim() === "") {
			break;
		}
		lineFrom = prevLine;
	}

	// Find the end of the paragraph
	while (lineTo.number < doc.lines) {
		const nextLine = doc.line(lineTo.number + 1);
		if (nextLine.text.trim() === "") {
			break;
		}
		lineTo = nextLine;
	}
	return { from: lineFrom.from, to: lineTo.to };
}

export function resolveSuggestionsInSelectionCM6(editor: Editor, action: 'accept' | 'reject'): void {
	const cm = getCmEditorView(editor);
	if (!cm) { new Notice("Modern editor version required."); return; }

	let currentSelection = cm.state.selection.main;
	let isParagraphSelection = false;

	if (currentSelection.empty) {
		const paragraph = getParagraphBoundaries(cm.state.doc, currentSelection.head);
		currentSelection = EditorSelection.range(paragraph.from, paragraph.to);
		isParagraphSelection = true;
		if (currentSelection.empty && (paragraph.from !== paragraph.to)) { // If paragraph is not empty but selection is, it means it's a single line.
			// This case should ideally be handled by getParagraphBoundaries returning non-empty from/to for a single line.
			// However, if it still results in an empty selection for a valid line, we might need to adjust.
			// For now, we assume getParagraphBoundaries correctly identifies single-line paragraphs.
		} else if (paragraph.from === paragraph.to) { // Truly empty paragraph or at doc start/end
            new Notice("Cursor is in an empty line or paragraph. Nothing to select.", 3000);
            return;
        }
	}

	const allMarks = cm.state.field(suggestionStateField, false);
	if (!allMarks || allMarks.length === 0) { new Notice("No suggestions found in the document.", 3000); return; }

	const marksInScope = allMarks.filter(mark =>
		mark.from < currentSelection.to && mark.to > currentSelection.from
	);

	if (marksInScope.length === 0) {
		const message = isParagraphSelection ?
			"No suggestions found in the current paragraph." :
			"No suggestions found in the current selection.";
		new Notice(message, 3000); return;
	}

	const changesArray: { from: number; to: number; insert: string }[] = [];
	const effectsArray: StateEffect<{ id: string; }>[] = marksInScope.map(mark => resolveSuggestionEffect.of({ id: mark.id }));
	const sortedMarksInScope = [...marksInScope].sort((a, b) => b.from - a.from); // Sort descending for safe deletions

	for (const mark of sortedMarksInScope) {
		if (action === 'accept') {
			if (mark.type === 'removed') {
				changesArray.push({ from: mark.from, to: mark.to, insert: "" });
			}
		} else { // action === 'reject'
			if (mark.type === 'added') {
				changesArray.push({ from: mark.from, to: mark.to, insert: "" });
			}
		}
	}

	const transactionSpec: TransactionSpec = {
		effects: effectsArray,
		// Preserve original cursor if it was a paragraph selection, otherwise restore to start of original selection
		selection: EditorSelection.cursor(isParagraphSelection ? cm.state.selection.main.head : currentSelection.from)
	};
	if (changesArray.length > 0) {
		transactionSpec.changes = changesArray;
	}
	cm.dispatch(cm.state.update(transactionSpec));
	
	const noticeMessage = `${marksInScope.length} suggestion(s) in ${isParagraphSelection ? 'paragraph' : 'selection'} ${action}ed.`;
	new Notice(noticeMessage, 3000);
	
	const remainingMarksAfterOp = cm.state.field(suggestionStateField, false) || [];
	if (remainingMarksAfterOp.length === 0 && marksInScope.length > 0) {
		new Notice(`All suggestions resolved!`, 2000);
	}
}

export function clearAllActiveSuggestionsCM6(editor: Editor): void {
	const cm = getCmEditorView(editor);
	if (!cm) { new Notice("Modern editor version required."); return; }

	const marks = cm.state.field(suggestionStateField, false);
	if (!marks || marks.length === 0) { new Notice("No suggestions to clear.", 3000); return; }

	const changesArray: { from: number; to: number; insert: string }[] = [];
	const sortedMarks = [...marks].sort((a,b) => b.from - a.from); // Sort descending for safe deletions

	for (const mark of sortedMarks) {
		if (mark.type === 'added') { // Clearing suggestions means rejecting additions
			changesArray.push({ from: mark.from, to: mark.to, insert: "" });
		}
	}

	const transactionSpec: TransactionSpec = {
		effects: clearAllSuggestionsEffect.of(null) // This will remove all marks from state
	};
	if (changesArray.length > 0) {
		const firstChangeFrom = Math.min(...changesArray.map(c => c.from));
		transactionSpec.selection = EditorSelection.cursor(firstChangeFrom);
		transactionSpec.changes = changesArray;
	} else {
		// If no text changes (e.g., all suggestions were 'removed' type), preserve selection
		transactionSpec.selection = cm.state.selection;
	}
	cm.dispatch(cm.state.update(transactionSpec));
	new Notice("All active suggestions cleared (changes rejected).", 3000);
}
