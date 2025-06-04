// src/lib/editor/suggestion-handler.ts
import { EditorSelection, StateEffect, TransactionSpec } from "@codemirror/state";
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
type TextChangeSpec = { from: number; to: number; insert: string };

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

function getMarksInRange(
	marks: readonly SuggestionMark[],
	range: ParagraphRange,
): SuggestionMark[] {
	return marks.filter((mark) => {
		if (mark.type === "added") {
			return mark.from >= range.from && mark.from <= range.to;
		}
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
	return sortedMarks[0];
}

function findPreviousFocusTarget(
	marks: readonly SuggestionMark[],
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
			newCursorPosAfterResolve = targetMark.from + (textChangeSpec.insert?.length ?? 0);
		} else if (targetMark.type === "removed") {
			newCursorPosAfterResolve = targetMark.from;
		}
	} else if (action === "reject") {
		newCursorPosAfterResolve = targetMark.from;
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
	marksToResolve: readonly SuggestionMark[],
	action: SuggestionAction,
	// doc: Text, // doc is not used here
): TransactionSpec {
	const changesArray: TextChangeSpec[] = [];
	const effectsArray: StateEffect<{ id: string }>[] = [];

	const sortedMarks = [...marksToResolve].sort((a, b) => {
		if (a.from !== b.from) return a.from - b.from;
		if (a.type === "removed" && b.type === "added") return -1;
		if (a.type === "added" && b.type === "removed") return 1;
		return 0;
	});

	let finalCursorPos = sortedMarks[0]?.from ?? 0;

	for (const mark of sortedMarks) {
		effectsArray.push(resolveSuggestionEffect.of({ id: mark.id }));
		const textChange = createTextChangeSpec(mark, action);
		if (textChange) {
			changesArray.push(textChange);
			if (mark === sortedMarks.at(-1)) {
				if (mark.type === "added") {
					finalCursorPos = textChange.from + (textChange.insert?.length ?? 0);
				} else if (mark.type === "removed") {
					finalCursorPos = textChange.from;
				}
			}
		} else if (action === "reject" && mark === sortedMarks.at(-1)) {
			finalCursorPos = mark.from;
		}
	}

	const transactionSpec: TransactionSpec = {
		effects: [...effectsArray.reverse(), createScrollEffect(finalCursorPos)],
		selection: EditorSelection.cursor(finalCursorPos),
	};

	if (changesArray.length > 0) {
		transactionSpec.changes = changesArray;
	}

	return transactionSpec;
}

function handleResolutionFeedback(
	cm: EditorView,
	action: SuggestionAction,
	resolvedMarkFrom: number,
): void {
	const marksAfterResolution = cm.state.field(suggestionStateField, false) || [];
	if (marksAfterResolution.length === 0) {
		showNotice(`Last suggestion ${action}ed. All suggestions resolved!`);
	} else {
		showNotice(`Suggestion ${action}ed. ${marksAfterResolution.length} remaining.`);
		const nextSuggestionToFocus = findNextSuggestionMark(cm, resolvedMarkFrom);

		if (nextSuggestionToFocus) {
			const mainSelection = cm.state.selection.main;
			if (mainSelection.head !== nextSuggestionToFocus.from || marksAfterResolution.length > 0) {
				focusSuggestion(cm, nextSuggestionToFocus);
			}
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
	let shouldForceResolve = allMarksInState.length === 1;

	const currentSelection = cm.state.selection.main;
	targetMark = findNextSuggestionMark(cm, currentSelection.head);

	if (!targetMark) {
		showNotice("Could not find a suggestion to resolve. Attempting to use the first available.");
		targetMark = allMarksInState[0];
		if (!targetMark) {
			showNotice("No suggestions available to resolve.");
			return;
		}
		shouldForceResolve = true;
	}

	const effectivelyOnTarget = currentSelection.empty && currentSelection.head === targetMark.from;

	if (!shouldForceResolve && !effectivelyOnTarget) {
		focusSuggestion(cm, targetMark);
		showNotice(`Scrolled to the next suggestion. Press again to ${action}.`);
		return;
	}
	const resolvedMarkOriginalFrom = targetMark.from;

	const transactionSpec = createResolutionTransaction(targetMark, action, shouldForceResolve);
	cm.dispatch(cm.state.update(transactionSpec));
	handleResolutionFeedback(cm, action, resolvedMarkOriginalFrom);
}

function handleParagraphNavigationAndGetScope(
	cm: EditorView,
	initialSelection: EditorSelection,
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

	const mainSelection = initialSelection.main;
	if (mainSelection.empty) {
		isOperatingOnIdentifiedParagraph = true;
		operationRange = getParagraphBoundaries(doc, mainSelection.head);
	} else {
		isOperatingOnIdentifiedParagraph = false;
		operationRange = { from: mainSelection.from, to: mainSelection.to };
	}

	const marksInCurrentScope = getMarksInRange(allMarks, operationRange);

	if (marksInCurrentScope.length === 0) {
		const nextParagraphWithSuggestions = findNextParagraphWithSuggestions(
			doc,
			operationRange.to + 1,
			allMarks,
		);
		if (nextParagraphWithSuggestions) {
			showNotice(
				`No suggestions in current ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"}. Moved to next paragraph with suggestions. Press again to ${action} all in this paragraph.`,
				4000,
			);
			focusSuggestion(cm, { from: nextParagraphWithSuggestions.from } as SuggestionMark);
			return null;
		}

		const prevParagraphWithSuggestions = findPreviousParagraphWithSuggestions(
			doc,
			operationRange.from,
			allMarks,
		);
		if (prevParagraphWithSuggestions) {
			showNotice(
				`No suggestions in current ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} or following. Moved to a previous paragraph with suggestions. Press again to ${action} all in this paragraph.`,
				4000,
			);
			focusSuggestion(cm, { from: prevParagraphWithSuggestions.from } as SuggestionMark);
			return null;
		}
		showNotice(
			`No suggestions found in the current ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} or any other paragraph.`,
			4000,
		);
		return null;
	}
	return { operationRange, marksInScope: marksInCurrentScope, isOperatingOnIdentifiedParagraph };
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

	const currentSelection = EditorSelection.create([cm.state.selection.main]);
	const scopeResult = handleParagraphNavigationAndGetScope(cm, currentSelection, allMarks, action);

	if (!scopeResult) {
		return;
	}

	const { operationRange, marksInScope, isOperatingOnIdentifiedParagraph } = scopeResult;

	if (marksInScope.length === 0) {
		const message = isOperatingOnIdentifiedParagraph
			? "Target paragraph has no suggestions."
			: "No suggestions found in the current selection.";
		showNotice(message);
		return;
	}

	const transactionSpec = createBulkResolutionTransaction(marksInScope, action);
	cm.dispatch(cm.state.update(transactionSpec));

	const noticeMessage = `${marksInScope.length} suggestion(s) in ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} ${action}ed.`;
	showNotice(noticeMessage);

	const remainingMarksAfterOp = cm.state.field(suggestionStateField, false) || [];
	if (remainingMarksAfterOp.length === 0 && marksInScope.length > 0) {
		showNotice("All suggestions resolved!", 2000);
	} else if (remainingMarksAfterOp.length > 0) {
		const nextSuggestion = findNextSuggestionMark(cm, operationRange.from);
		if (nextSuggestion) {
			focusSuggestion(cm, nextSuggestion);
		}
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
		selection: EditorSelection.create([cm.state.selection.main]),
	};

	cm.dispatch(cm.state.update(transactionSpec));
	showNotice("All active suggestions cleared (changes rejected).");
}
