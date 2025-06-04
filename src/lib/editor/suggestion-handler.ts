// src/lib/editor/suggestion-handler.ts
import { ChangeSet, EditorSelection, StateEffect, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Editor, Notice, TFile } from "obsidian";

import type TextTransformer from "../../main";
import { getCmEditorView } from "../utils";
import {
	ParagraphRange,
	findNextParagraphWithSuggestions,
	findPreviousParagraphWithSuggestions,
	getParagraphBoundaries,
} from "./paragraph-utils";
import {
	SuggestionMark,
	clearAllSuggestionsEffect,
	resolveSuggestionEffect,
	suggestionStateField,
} from "./suggestion-state";

const SCROLL_COMFORT_ZONE_PX = 200;

type SuggestionAction = "accept" | "reject";
export type TextChangeSpec = { from: number; to: number; insert: string }; // Exporting for use in function return type

function showNotice(message: string, duration = 3000): void {
	new Notice(message, duration);
}

function createScrollEffect(position: number): StateEffect<unknown> {
	return EditorView.scrollIntoView(position, {
		y: "nearest",
		yMargin: SCROLL_COMFORT_ZONE_PX,
	});
}

function createTextChangeSpec(
	mark: SuggestionMark,
	action: SuggestionAction,
): TextChangeSpec | undefined {
	if (action === "accept") {
		if (mark.type === "added") {
			const textToInsert =
				mark.isNewlineChange && mark.newlineChar ? mark.newlineChar : (mark.ghostText ?? "");
			return { from: mark.from, to: mark.from, insert: textToInsert };
		}
		if (mark.type === "removed") {
			return { from: mark.from, to: mark.to, insert: "" };
		}
	}
	// If action is "reject", no text change is made based on the mark's content.
	// The mark is simply removed from the state.
	return undefined;
}

function getMarksInRange(
	marks: readonly SuggestionMark[],
	range: ParagraphRange,
): SuggestionMark[] {
	return marks.filter((mark) => {
		if (mark.type === "added") {
			return mark.from >= range.from && mark.from <= range.to;
		}
		// For "removed" marks, check for overlap:
		// mark.from < range.to (mark starts before range ends) AND
		// mark.to > range.from (mark ends after range starts)
		return mark.from < range.to && mark.to > range.from;
	});
}

function findNextFocusTarget(
	marks: readonly SuggestionMark[],
	currentSelectionHead: number,
): SuggestionMark | null {
	if (marks.length === 0) return null;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from);
	for (const mark of sortedMarks) {
		if (mark.from > currentSelectionHead) return mark;
	}
	// If no mark is found after currentSelectionHead, wrap around to the first mark.
	return sortedMarks[0];
}

function findPreviousFocusTarget(
	marks: readonly SuggestionMark[],
	currentSelectionHead: number,
): SuggestionMark | null {
	if (marks.length === 0) return null;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from); // Sort by 'from' ascending
	let foundMark: SuggestionMark | null = null;
	// Iterate backwards through sorted marks
	for (let i = sortedMarks.length - 1; i >= 0; i--) {
		const mark = sortedMarks[i];
		if (mark.from < currentSelectionHead) {
			foundMark = mark;
			break;
		}
	}
	// If no mark is found before currentSelectionHead, wrap around to the last mark.
	return (foundMark || sortedMarks.at(-1)) ?? null;
}

function focusSuggestion(cm: EditorView, targetMark: SuggestionMark): void {
	cm.dispatch({
		selection: EditorSelection.cursor(targetMark.from),
		effects: createScrollEffect(targetMark.from),
	});
}

export function focusNextSuggestionCM6(_plugin: TextTransformer, editor: Editor): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		showNotice("Modern editor version required.");
		return;
	}
	const allMarks = cm.state.field(suggestionStateField, false) || [];
	if (allMarks.length === 0) {
		showNotice("No suggestions to navigate.", 2000);
		return;
	}
	const currentPos = cm.state.selection.main.head;
	const targetMark = findNextFocusTarget(allMarks, currentPos);
	if (targetMark) {
		focusSuggestion(cm, targetMark);
	}
}

export function focusPreviousSuggestionCM6(_plugin: TextTransformer, editor: Editor): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		showNotice("Modern editor version required.");
		return;
	}
	const allMarks = cm.state.field(suggestionStateField, false) || [];
	if (allMarks.length === 0) {
		showNotice("No suggestions to navigate.", 2000);
		return;
	}
	const currentPos = cm.state.selection.main.head;
	const targetMark = findPreviousFocusTarget(allMarks, currentPos);
	if (targetMark) {
		focusSuggestion(cm, targetMark);
	}
}

function findNextSuggestionMark(cm: EditorView, fromPos?: number): SuggestionMark | null {
	const marks = cm.state.field(suggestionStateField, false);
	if (!marks || marks.length === 0) return null;

	const searchStartPos = fromPos !== undefined ? fromPos : cm.state.selection.main.head;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from);

	// Find the first mark at or after searchStartPos
	for (const mark of sortedMarks) {
		if (mark.from >= searchStartPos) return mark;
	}
	// If no mark is found at or after searchStartPos, wrap around to the first mark in the document
	return sortedMarks.length > 0 ? sortedMarks[0] : null;
}

function createResolutionTransaction(
	targetMark: SuggestionMark,
	action: SuggestionAction,
	shouldForceResolve: boolean, // This seems to control scrolling, not used for cursor logic directly
): TransactionSpec {
	const textChangeSpec = createTextChangeSpec(targetMark, action);
	let newCursorPosAfterResolve = targetMark.from; // Default to mark's start

	if (textChangeSpec) {
		// If a change is made (typically on "accept")
		if (targetMark.type === "added") {
			// Cursor goes after the inserted text
			newCursorPosAfterResolve = targetMark.from + (textChangeSpec.insert?.length ?? 0);
		} else if (targetMark.type === "removed") {
			// Cursor stays at the beginning of the removed range
			newCursorPosAfterResolve = targetMark.from;
		}
	} // If "rejecting", or "accepting" something that results in no change, cursor stays at targetMark.from.

	const effects: StateEffect<unknown>[] = [resolveSuggestionEffect.of({ id: targetMark.id })];

	// shouldForceResolve seems to be for when it's the last suggestion or explicitly navigating.
	// The scroll effect uses the calculated newCursorPosAfterResolve.
	if (shouldForceResolve) {
		effects.push(createScrollEffect(newCursorPosAfterResolve));
	}

	const transactionSpec: TransactionSpec = {
		effects,
		// Selection is crucial: refers to coordinates *after* the change (if any) is applied.
		// CodeMirror handles this mapping for single changes in a transaction.
		selection: EditorSelection.cursor(newCursorPosAfterResolve),
	};

	if (textChangeSpec) {
		transactionSpec.changes = textChangeSpec;
	}

	return transactionSpec;
}

/**
 * Prepares the components for a bulk suggestion resolution transaction.
 * Calculates text changes and effects, and determines key original document
 * positions for later cursor mapping.
 * @param marksToResolve The suggestion marks to be resolved.
 * @param action The action to perform ('accept' or 'reject').
 * @returns An object containing changes, effects, and original document positions for cursor logic.
 */
function createBulkResolutionComponents(
	marksToResolve: readonly SuggestionMark[],
	action: SuggestionAction,
): {
	changes: TextChangeSpec[];
	effects: StateEffect<{ id: string }>[];
	lastChangeOriginalFrom: number | null;
	lastChangeInsertionLength: number | null;
	fallbackOriginalCursorPos: number | null;
} {
	const changesArray: TextChangeSpec[] = [];
	const effectsArray: StateEffect<{ id: string }>[] = [];

	// Sort marks: by 'from' position, then 'removed' before 'added' at the same position.
	// This order is generally preferred for applying changes.
	const sortedMarks = [...marksToResolve].sort((a, b) => {
		if (a.from !== b.from) return a.from - b.from;
		if (a.type === "removed" && b.type === "added") return -1;
		if (a.type === "added" && b.type === "removed") return 1;
		return 0;
	});

	let lastChangeOriginalFrom: number | null = null;
	let lastChangeInsertionLength: number | null = null;

	for (const mark of sortedMarks) {
		effectsArray.push(resolveSuggestionEffect.of({ id: mark.id }));
		const textChange = createTextChangeSpec(mark, action); // textChange.{from,to,insert} are relative to original doc
		if (textChange) {
			changesArray.push(textChange);
			if (action === "accept") {
				// Track the 'from' and 'insert.length' of the latest change being made.
				lastChangeOriginalFrom = textChange.from;
				lastChangeInsertionLength = textChange.insert?.length ?? 0;
			}
		}
	}

	let fallbackOriginalCursorPos: number | null = null;
	if (sortedMarks.length > 0) {
		// As a fallback, target the start of the first mark in the processed batch.
		fallbackOriginalCursorPos = sortedMarks[0].from;
	}

	return {
		changes: changesArray,
		effects: effectsArray.reverse(), // Effects (mark removals) can often be processed in reverse
		lastChangeOriginalFrom,
		lastChangeInsertionLength,
		fallbackOriginalCursorPos,
	};
}

function handleResolutionFeedback(
	cm: EditorView,
	action: SuggestionAction,
	resolvedMarkFrom: number, // Original 'from' of the resolved mark/set of marks
): void {
	const marksAfterResolution = cm.state.field(suggestionStateField, false) || [];
	if (marksAfterResolution.length === 0) {
		showNotice(`Last suggestion ${action}ed. All suggestions resolved!`);
	} else {
		showNotice(`Suggestion ${action}ed. ${marksAfterResolution.length} remaining.`);
		// Try to find the next suggestion at or after where the last one was.
		const nextSuggestionToFocus = findNextSuggestionMark(cm, resolvedMarkFrom);

		if (nextSuggestionToFocus) {
			const mainSelection = cm.state.selection.main;
			// Only refocus if cursor isn't already there, or if there are other marks,
			// to avoid redundant scrolling if only one mark was resolved and it was the last.
			if (mainSelection.head !== nextSuggestionToFocus.from || marksAfterResolution.length > 0) {
				focusSuggestion(cm, nextSuggestionToFocus);
			}
		}
	}
}

export function resolveNextSuggestionCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile, // Not used, consider removing if not planned for future
	action: SuggestionAction,
): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		showNotice("Modern editor version required.");
		return;
	}

	const allMarksInState = cm.state.field(suggestionStateField, false);
	if (!allMarksInState || allMarksInState.length === 0) {
		showNotice("No suggestions to resolve.");
		return;
	}

	let targetMark: SuggestionMark | null;
	// shouldForceResolve true if it's the last mark, implies scrolling should occur.
	let shouldForceResolve = allMarksInState.length === 1;

	const currentSelection = cm.state.selection.main;
	targetMark = findNextSuggestionMark(cm, currentSelection.head);

	if (!targetMark) {
		// This case should ideally not be hit if allMarksInState.length > 0 due to wrap-around in findNextSuggestionMark.
		// However, as a safeguard:
		showNotice("Could not find a suggestion to resolve. Attempting to use the first available.");
		targetMark = allMarksInState[0]; // Default to the very first mark
		if (!targetMark) {
			// Should be impossible if allMarksInState is not empty
			showNotice("No suggestions available to resolve.");
			return;
		}
		shouldForceResolve = true; // Force scroll if we had to pick the first one manually
	}

	// effectivelyOnTarget: cursor is exactly at the start of the target suggestion.
	const effectivelyOnTarget = currentSelection.empty && currentSelection.head === targetMark.from;

	// If not already on target and not forcing (i.e., multiple suggestions exist and we just found the next one),
	// first focus it. The user then presses again to resolve.
	if (!shouldForceResolve && !effectivelyOnTarget) {
		focusSuggestion(cm, targetMark);
		showNotice(`Scrolled to the next suggestion. Press again to ${action}.`);
		return;
	}

	// If we are here, either it's the last suggestion, or we were already on target. Resolve it.
	const resolvedMarkOriginalFrom = targetMark.from;

	const transactionSpec = createResolutionTransaction(targetMark, action, shouldForceResolve);
	cm.dispatch(cm.state.update(transactionSpec));
	handleResolutionFeedback(cm, action, resolvedMarkOriginalFrom);
}

function handleParagraphNavigationAndGetScope(
	cm: EditorView,
	initialSelection: EditorSelection, // Pass the whole EditorSelection
	allMarks: readonly SuggestionMark[],
	action: SuggestionAction,
): {
	operationRange: ParagraphRange;
	marksInScope: SuggestionMark[];
	isOperatingOnIdentifiedParagraph: boolean;
} | null {
	const doc = cm.state.doc;
	let operationRange: ParagraphRange;
	let isOperatingOnIdentifiedParagraph: boolean;

	const mainSelRange = initialSelection.main; // Use the main range from the passed selection
	if (mainSelRange.empty) {
		isOperatingOnIdentifiedParagraph = true;
		operationRange = getParagraphBoundaries(doc, mainSelRange.head);
	} else {
		isOperatingOnIdentifiedParagraph = false;
		operationRange = { from: mainSelRange.from, to: mainSelRange.to };
	}

	const marksInCurrentScope = getMarksInRange(allMarks, operationRange);

	if (marksInCurrentScope.length === 0) {
		// Try to find next paragraph with suggestions
		const nextParagraphWithSuggestions = findNextParagraphWithSuggestions(
			doc,
			operationRange.to + 1, // Start search after current scope
			allMarks,
		);
		if (nextParagraphWithSuggestions) {
			showNotice(
				`No suggestions in current ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"}. Moved to next paragraph with suggestions. Press again to ${action} all in this paragraph.`,
				4000,
			);
			// Focus on the start of that paragraph (as a SuggestionMark-like object for focusSuggestion)
			focusSuggestion(cm, {
				from: nextParagraphWithSuggestions.from,
			} as SuggestionMark);
			return null; // Indicate navigation occurred, no immediate operation
		}

		// If no next, try previous
		const prevParagraphWithSuggestions = findPreviousParagraphWithSuggestions(
			doc,
			operationRange.from, // Search before current scope's start
			allMarks,
		);
		if (prevParagraphWithSuggestions) {
			showNotice(
				`No suggestions in current ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} or following. Moved to a previous paragraph with suggestions. Press again to ${action} all in this paragraph.`,
				4000,
			);
			focusSuggestion(cm, {
				from: prevParagraphWithSuggestions.from,
			} as SuggestionMark);
			return null; // Indicate navigation occurred
		}

		// No suggestions anywhere relevant
		showNotice(
			`No suggestions found in the current ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} or any other paragraph.`,
			4000,
		);
		return null;
	}
	// Found suggestions in the current scope
	return {
		operationRange,
		marksInScope: marksInCurrentScope,
		isOperatingOnIdentifiedParagraph,
	};
}

export function resolveSuggestionsInSelectionCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile, // Not used currently
	action: SuggestionAction,
): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		showNotice("Modern editor version required.");
		return;
	}

	const allMarks = cm.state.field(suggestionStateField, false);
	if (!allMarks || allMarks.length === 0) {
		showNotice("No suggestions found in the document.");
		return;
	}

	// Important: Capture the selection state *before* any potential navigation.
	const currentSelectionState = cm.state.selection;
	const scopeResult = handleParagraphNavigationAndGetScope(
		cm,
		currentSelectionState,
		allMarks,
		action,
	);

	if (!scopeResult) {
		// Navigation occurred or no relevant suggestions found; message already shown.
		return;
	}

	const { operationRange, marksInScope, isOperatingOnIdentifiedParagraph } = scopeResult;

	// This check is technically redundant if handleParagraphNavigationAndGetScope ensures marksInScope > 0
	// when returning a non-null result, but it's a good safeguard.
	if (marksInScope.length === 0) {
		const message = isOperatingOnIdentifiedParagraph
			? "Target paragraph has no suggestions."
			: "No suggestions found in the current selection.";
		showNotice(message);
		return;
	}

	const components = createBulkResolutionComponents(marksInScope, action);

	let finalMappedCursorPos: number;
	const originalDocLength = cm.state.doc.length;
	// Create a ChangeSet from the collected changes to map positions.
	// All `components.changes` have `from`/`to` relative to the original document.
	const changeSet = ChangeSet.of(components.changes, originalDocLength);

	if (
		action === "accept" &&
		components.lastChangeOriginalFrom !== null &&
		components.lastChangeInsertionLength !== null
	) {
		// If accepting and there were actual changes:
		// Map the 'from' position of the last text change through the ChangeSet.
		// `assoc = 1` biases the mapped position to be *after* an insertion at that point.
		const mappedBasePos = changeSet.mapPos(components.lastChangeOriginalFrom, 1);
		// Add the length of the text inserted by that last change.
		finalMappedCursorPos = mappedBasePos + components.lastChangeInsertionLength;
	} else if (components.fallbackOriginalCursorPos !== null) {
		// For 'reject' action, or 'accept' with no effective text changes:
		// Map the fallback position (e.g., start of the first mark in scope).
		// If rejecting, `components.changes` is empty, so `changeSet.mapPos` is an identity map.
		finalMappedCursorPos = changeSet.mapPos(components.fallbackOriginalCursorPos, 1);
	} else {
		// Absolute fallback: Should not be reached if marksInScope is non-empty.
		// Map the current cursor position (though it might not be ideal).
		finalMappedCursorPos = changeSet.mapPos(cm.state.selection.main.head, 1);
	}

	// Determine the length of the document *after* all changes are applied.
	const newDocLength = changeSet.newLength;
	// Strictly clamp the final cursor position to be within the new document bounds.
	finalMappedCursorPos = Math.max(0, Math.min(finalMappedCursorPos, newDocLength));

	const transactionSpec: TransactionSpec = {
		effects: [...components.effects, createScrollEffect(finalMappedCursorPos)],
		selection: EditorSelection.cursor(finalMappedCursorPos),
	};

	if (components.changes.length > 0) {
		transactionSpec.changes = components.changes;
	}

	cm.dispatch(cm.state.update(transactionSpec));

	const noticeMessage = `${marksInScope.length} suggestion(s) in ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} ${action}ed.`;
	showNotice(noticeMessage);

	const remainingMarksAfterOp = cm.state.field(suggestionStateField, false) || [];
	if (remainingMarksAfterOp.length === 0 && marksInScope.length > 0) {
		showNotice("All suggestions resolved!", 2000);
	} else if (remainingMarksAfterOp.length > 0) {
		// Focus next available suggestion, starting search from the beginning of the resolved range.
		const nextSuggestion = findNextSuggestionMark(cm, operationRange.from);
		if (nextSuggestion) {
			focusSuggestion(cm, nextSuggestion);
		}
	}
}

export function clearAllActiveSuggestionsCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile, // Not used
): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		showNotice("Modern editor version required.");
		return;
	}

	const marks = cm.state.field(suggestionStateField, false);
	if (!marks || marks.length === 0) {
		showNotice("No suggestions to clear.");
		return;
	}

	// Clearing all suggestions implies rejecting them, so no text changes.
	// The selection should remain where it is.
	const transactionSpec: TransactionSpec = {
		effects: clearAllSuggestionsEffect.of(null),
		// Preserve current selection.
		selection: EditorSelection.create([cm.state.selection.main]),
	};

	cm.dispatch(cm.state.update(transactionSpec));
	showNotice("All active suggestions cleared (changes rejected).");
}
