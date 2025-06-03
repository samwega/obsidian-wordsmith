// src/suggestion-handler.ts
import { EditorSelection, StateEffect, Text, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Editor, Notice, TFile } from "obsidian";

import TextTransformer from "./main";
import {
	SuggestionMark,
	clearAllSuggestionsEffect,
	resolveSuggestionEffect,
	suggestionStateField,
} from "./suggestion-state";
import { getCmEditorView } from "./utils";

const SCROLL_COMFORT_ZONE_PX = 200; // Pixels for yMargin

// Types for better code organization
type SuggestionAction = "accept" | "reject";
type ParagraphRange = { from: number; to: number };
type TextChangeSpec = { from: number; to: number; insert: string };

// Utility functions for common operations
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
	return undefined;
}

function getMarksInRange(marks: SuggestionMark[], range: ParagraphRange): SuggestionMark[] {
	return marks.filter((mark) => {
		if (mark.type === "added") {
			return mark.from >= range.from && mark.from <= range.to;
		}
		return mark.from < range.to && mark.to > range.from;
	});
}

function findNextFocusTarget(
	marks: SuggestionMark[],
	currentSelectionHead: number,
): SuggestionMark | null {
	if (marks.length === 0) return null;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from);
	for (const mark of sortedMarks) {
		if (mark.from > currentSelectionHead) return mark;
	}
	return sortedMarks[0];
}

function findPreviousFocusTarget(
	marks: SuggestionMark[],
	currentSelectionHead: number,
): SuggestionMark | null {
	if (marks.length === 0) return null;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from);
	let foundMark: SuggestionMark | null = null;
	for (let i = sortedMarks.length - 1; i >= 0; i--) {
		const mark = sortedMarks[i];
		if (mark.from < currentSelectionHead) {
			foundMark = mark;
			break;
		}
	}
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
	for (const mark of sortedMarks) {
		if (mark.from >= searchStartPos) return mark;
	}
	return sortedMarks.length > 0 ? sortedMarks[0] : null;
}

function createResolutionTransaction(
	targetMark: SuggestionMark,
	action: SuggestionAction,
	shouldForceResolve: boolean,
): TransactionSpec {
	const textChangeSpec = createTextChangeSpec(targetMark, action);
	let newCursorPosAfterResolve = targetMark.from;

	if (textChangeSpec) {
		if (targetMark.type === "added") {
			newCursorPosAfterResolve = targetMark.from + (textChangeSpec.insert.length ?? 0);
		} else if (targetMark.type === "removed") {
			newCursorPosAfterResolve = targetMark.from;
		}
	}

	const effects: StateEffect<unknown>[] = [resolveSuggestionEffect.of({ id: targetMark.id })];

	if (shouldForceResolve) {
		effects.push(createScrollEffect(newCursorPosAfterResolve));
	}

	const transactionSpec: TransactionSpec = {
		effects,
		selection: EditorSelection.cursor(newCursorPosAfterResolve),
	};

	if (textChangeSpec) {
		transactionSpec.changes = textChangeSpec;
	}

	return transactionSpec;
}

function createBulkResolutionTransaction(
	marks: SuggestionMark[],
	action: SuggestionAction,
	cursorPos: number,
): TransactionSpec {
	const changesArray: TextChangeSpec[] = [];
	const effectsArray: StateEffect<{ id: string }>[] = [];

	// Sort marks by position, but handle overlapping changes carefully
	const sortedMarks = [...marks].sort((a, b) => {
		if (a.from === b.from) {
			// If same start position, process removals before additions
			return a.type === "removed" ? -1 : 1;
		}
		return a.from - b.from;
	});

	let lastChangeEnd = -1;
	let finalCursorPos = cursorPos;

	for (const mark of sortedMarks) {
		effectsArray.push(resolveSuggestionEffect.of({ id: mark.id }));
		const textChange = createTextChangeSpec(mark, action);

		if (
			textChange &&
			!changesArray.some(
				(change) =>
					(textChange.from >= change.from && textChange.from < change.to) ||
					(textChange.to > change.from && textChange.to <= change.to) ||
					(change.from >= textChange.from && change.from < textChange.to) ||
					(change.to > textChange.from && change.to <= textChange.to),
			)
		) {
			changesArray.push(textChange);
		}

		if (textChange) {
			// Ensure changes don't overlap
			if (textChange.from >= lastChangeEnd) {
				lastChangeEnd = textChange.to;

				// Update cursor position based on the last change
				if (mark.type === "added") {
					finalCursorPos = mark.from + (textChange.insert.length ?? 0);
				} else if (mark.type === "removed") {
					finalCursorPos = mark.from;
				}
			}
		}
	}

	const transactionSpec: TransactionSpec = {
		effects: [...effectsArray, createScrollEffect(finalCursorPos)],
		selection: EditorSelection.cursor(finalCursorPos),
	};

	if (changesArray.length > 0) {
		transactionSpec.changes = changesArray;
	}

	return transactionSpec;
}

function handleResolutionFeedback(cm: EditorView, action: SuggestionAction): void {
	const marksAfterResolution = cm.state.field(suggestionStateField, false) || [];
	if (marksAfterResolution.length === 0) {
		showNotice(`Last suggestion ${action}ed. All suggestions resolved!`);
	} else {
		showNotice(`Suggestion ${action}ed. ${marksAfterResolution.length} remaining.`);
		const nextSuggestionToFocus = findNextSuggestionMark(cm, cm.state.selection.main.head);

		if (nextSuggestionToFocus && cm.state.selection.main.head !== nextSuggestionToFocus.from) {
			focusSuggestion(cm, nextSuggestionToFocus);
		}
	}
}

export function resolveNextSuggestionCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile,
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
	let shouldForceResolve = false;

	if (allMarksInState.length === 1) {
		targetMark = allMarksInState[0];
		shouldForceResolve = true;
	} else {
		const currentSelection = cm.state.selection.main;
		targetMark = findNextSuggestionMark(cm, currentSelection.head);
	}

	if (!targetMark) {
		showNotice("Could not find a suggestion to resolve.");
		return;
	}

	const currentSelection = cm.state.selection.main;
	const effectivelyOnTarget = currentSelection.empty && currentSelection.head === targetMark.from;

	if (!shouldForceResolve && !effectivelyOnTarget) {
		focusSuggestion(cm, targetMark);
		showNotice(`Scrolled to the next suggestion. Press again to ${action}.`);
		return;
	}

	const transactionSpec = createResolutionTransaction(targetMark, action, shouldForceResolve);
	cm.dispatch(cm.state.update(transactionSpec));
	handleResolutionFeedback(cm, action);
}

function getParagraphBoundaries(doc: Text, pos: number): ParagraphRange {
	let lineFrom = doc.lineAt(pos);
	let lineTo = doc.lineAt(pos);

	// Handle empty line case explicitly
	if (lineFrom.text.trim() === "") {
		return { from: lineFrom.from, to: lineFrom.to };
	}

	while (lineFrom.number > 1) {
		const prevLine = doc.line(lineFrom.number - 1);
		if (prevLine.text.trim() === "") break;
		lineFrom = prevLine;
	}
	while (lineTo.number < doc.lines) {
		const nextLine = doc.line(lineTo.number + 1);
		if (nextLine.text.trim() === "") break;
		lineTo = nextLine;
	}
	return { from: lineFrom.from, to: lineTo.to };
}

function* iterateParagraphs(
	doc: Text,
	startPosition = 0,
): Generator<ParagraphRange, void, undefined> {
	let currentPos = startPosition;
	if (currentPos >= doc.length && doc.length > 0) return;

	while (currentPos < doc.length) {
		let paragraphBeginLineNum = -1;
		let firstLineAtCurrentSearch = doc.lineAt(currentPos);

		// Handle empty lines at start
		if (firstLineAtCurrentSearch.text.trim() === "") {
			yield { from: firstLineAtCurrentSearch.from, to: firstLineAtCurrentSearch.to };
			if (firstLineAtCurrentSearch.number < doc.lines) {
				currentPos = doc.line(firstLineAtCurrentSearch.number + 1).from;
				continue;
			}
			return;
		}

		for (let n = firstLineAtCurrentSearch.number; n <= doc.lines; n++) {
			const line = doc.line(n);
			if (currentPos > line.from && currentPos <= line.to && line.text.trim() === "") {
				if (n < doc.lines) {
					currentPos = doc.line(n + 1).from;
					firstLineAtCurrentSearch = doc.lineAt(currentPos);
					continue;
				}
				return;
			}
			if (currentPos > line.to) continue;

			if (line.text.trim() !== "") {
				paragraphBeginLineNum = n;
				break;
			}
			if (n < doc.lines) {
				currentPos = doc.line(n + 1).from;
			} else {
				return;
			}
		}

		if (paragraphBeginLineNum === -1) return;

		const paragraphStartLine = doc.line(paragraphBeginLineNum);
		let paragraphEndLine = paragraphStartLine;

		while (paragraphEndLine.number < doc.lines) {
			const nextLine = doc.line(paragraphEndLine.number + 1);
			if (nextLine.text.trim() === "") break;
			paragraphEndLine = nextLine;
		}

		yield { from: paragraphStartLine.from, to: paragraphEndLine.to };
		currentPos = paragraphEndLine.to + 1;
		if (currentPos >= doc.length && paragraphEndLine.number === doc.lines) return;
	}
}

function findNextParagraphWithSuggestions(
	doc: Text,
	startOffset: number,
	marks: SuggestionMark[],
): ParagraphRange | null {
	const paragraphIterator = iterateParagraphs(doc, startOffset);
	for (const p of paragraphIterator) {
		const marksInThisP = getMarksInRange(marks, p);
		if (marksInThisP.length > 0) {
			return p;
		}
	}
	return null;
}

function findPreviousParagraphWithSuggestions(
	doc: Text,
	endOffset: number,
	marks: SuggestionMark[],
): ParagraphRange | null {
	let lastParagraphWithSuggestions: ParagraphRange | null = null;
	const preParagraphIterator = iterateParagraphs(doc, 0);
	for (const p of preParagraphIterator) {
		if (p.from >= endOffset) break;
		const marksInThisP = getMarksInRange(marks, p);
		if (marksInThisP.length > 0) {
			lastParagraphWithSuggestions = p;
		}
	}
	return lastParagraphWithSuggestions;
}

function handleParagraphNavigation(
	cm: EditorView,
	operationRange: ParagraphRange,
	marks: SuggestionMark[],
	action: SuggestionAction,
): { newRange: ParagraphRange | null; cursorPos: number } | null {
	const doc = cm.state.doc;
	const marksInParagraph = getMarksInRange(marks, operationRange);

	// Special handling for empty lines
	const currentLine = doc.lineAt(operationRange.from);
	if (currentLine.text.trim() === "") {
		const nextParagraph = findNextParagraphWithSuggestions(doc, operationRange.to + 1, marks);
		if (nextParagraph) {
			showNotice(
				`Empty line. Moved to next paragraph with suggestions. Press again to ${action} all in this paragraph.`,
				4000,
			);
			focusSuggestion(cm, { from: nextParagraph.from, to: nextParagraph.to } as SuggestionMark);
			return { newRange: nextParagraph, cursorPos: nextParagraph.from };
		}
	}

	if (marksInParagraph.length === 0) {
		const nextParagraph = findNextParagraphWithSuggestions(doc, operationRange.to + 1, marks);
		if (nextParagraph) {
			showNotice(
				`No suggestions in current paragraph. Moved to next paragraph with suggestions. Press again to ${action} all in this paragraph.`,
				4000,
			);
			focusSuggestion(cm, { from: nextParagraph.from, to: nextParagraph.to } as SuggestionMark);
			return { newRange: nextParagraph, cursorPos: nextParagraph.from };
		}

		const prevParagraph = findPreviousParagraphWithSuggestions(doc, operationRange.from, marks);
		if (prevParagraph) {
			showNotice(
				`No suggestions in current paragraph or following. Moved to a previous paragraph with suggestions. Press again to ${action} all in this paragraph.`,
				4000,
			);
			focusSuggestion(cm, { from: prevParagraph.from, to: prevParagraph.to } as SuggestionMark);
			return { newRange: prevParagraph, cursorPos: prevParagraph.from };
		}

		showNotice("No suggestions found in the current paragraph or any other paragraph.", 4000);
		return null;
	}

	return { newRange: operationRange, cursorPos: operationRange.from };
}

export function resolveSuggestionsInSelectionCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile,
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

	const doc = cm.state.doc;
	const currentSelection = cm.state.selection.main;
	const cursorOriginalPos = currentSelection.head;

	let operationRange: ParagraphRange;
	let isOperatingOnIdentifiedParagraph = false;

	if (currentSelection.empty) {
		isOperatingOnIdentifiedParagraph = true;
		operationRange = getParagraphBoundaries(doc, cursorOriginalPos);
	} else {
		operationRange = { from: currentSelection.from, to: currentSelection.to };
	}

	const navigationResult = handleParagraphNavigation(cm, operationRange, allMarks, action);
	if (!navigationResult) return;

	const { newRange, cursorPos } = navigationResult;
	if (!newRange) return;

	const marksInScope = getMarksInRange(allMarks, newRange);
	if (marksInScope.length === 0) {
		const message = isOperatingOnIdentifiedParagraph
			? "Target paragraph has no suggestions. Cursor moved if another paragraph with suggestions was found."
			: "No suggestions found in the current selection.";
		showNotice(message);
		return;
	}

	const transactionSpec = createBulkResolutionTransaction(marksInScope, action, cursorPos);
	cm.dispatch(cm.state.update(transactionSpec));

	const noticeMessage = `${marksInScope.length} suggestion(s) in ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} ${action}ed.`;
	showNotice(noticeMessage);

	const remainingMarksAfterOp = cm.state.field(suggestionStateField, false) || [];
	if (remainingMarksAfterOp.length === 0 && marksInScope.length > 0) {
		showNotice("All suggestions resolved!", 2000);
	}
}

export function clearAllActiveSuggestionsCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile,
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

	const transactionSpec: TransactionSpec = {
		effects: clearAllSuggestionsEffect.of(null),
		selection: cm.state.selection,
	};

	cm.dispatch(cm.state.update(transactionSpec));
	showNotice("All active suggestions cleared (changes rejected).");
}
