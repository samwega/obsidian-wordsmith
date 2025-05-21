// src/suggestion-handler.ts
import { Editor, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorSelection, TransactionSpec, StateEffect, Text } from "@codemirror/state";

import { suggestionStateField, resolveSuggestionEffect, SuggestionMark, clearAllSuggestionsEffect } from "./suggestion-state";

function getCmEditorView(editor: Editor): EditorView | null {
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
		newCursorPosAfterResolve = textChangeSpec.from; 
	}
	
	transactionSpec.selection = EditorSelection.cursor(newCursorPosAfterResolve);
	cm.dispatch(cm.state.update(transactionSpec));

	const marksAfterResolution = cm.state.field(suggestionStateField, false) || [];

	if (marksAfterResolution.length === 0) {
		new Notice(`Last suggestion ${action}ed. All suggestions resolved!`, 3000);
	} else {
		new Notice(`Suggestion ${action}ed. ${marksAfterResolution.length} remaining.`, 3000);
		const nextSuggestionToFocus = findNextSuggestionMark(cm, cm.state.selection.main.head);
		if (nextSuggestionToFocus) {
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

// Assuming original getParagraphBoundaries works as intended for defining the "current" paragraph.
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

// Helper to iterate through content paragraphs in the document.
// A "content paragraph" is one or more consecutive non-empty lines.
// It yields {from, to} for each content paragraph.
function* iterateParagraphs(doc: Text, startPosition: number = 0): Generator<{ from: number; to: number; }, void, undefined> {
    let currentPos = startPosition;
    // Ensure startPosition is not past the document end if doc has content
    if (currentPos >= doc.length && doc.length > 0) return; 

    while (currentPos < doc.length) {
        let line = doc.lineAt(currentPos);

        // 1. Advance to find the start of the next actual content paragraph
        // This loop finds the first non-empty line at or after currentPos.
        let paragraphBeginLineNum = -1;
        for (let n = line.number; n <= doc.lines; n++) {
            const l = doc.line(n);
            // Check if currentPos is beyond this line's start; if so, this line can't be the start
            // unless currentPos was *on* this line.
            if (l.from > currentPos && n > line.number) { // Optimization: if l.from is already past currentPos, use l.from for next iteration.
                 // This condition is mainly for the first line. If currentPos is in the middle of line `n`,
                 // then line `n` is still the one we are interested in.
            } else if (currentPos > l.to) { // currentPos is after line l.
                 continue;
            }


            if (l.text.trim() !== "") {
                paragraphBeginLineNum = n;
                break;
            }
        }

        if (paragraphBeginLineNum === -1) return; // No more non-empty lines found

        const paragraphStartLine = doc.line(paragraphBeginLineNum);
        let paragraphEndLine = paragraphStartLine;

        // 2. Find the end of this content paragraph
        while (paragraphEndLine.number < doc.lines) {
            const nextLine = doc.line(paragraphEndLine.number + 1);
            if (nextLine.text.trim() === "") {
                break; // Empty line marks the end of the current paragraph
            }
            paragraphEndLine = nextLine;
        }

        yield {
            from: paragraphStartLine.from,
            to: paragraphEndLine.to
        };

        // 3. Prepare for the next iteration: move currentPos to the start of the line AFTER this paragraph
        currentPos = paragraphEndLine.to + 1; // Position after the paragraph just yielded
        if (currentPos >= doc.length) return; // Reached end of document
    }
}


export function resolveSuggestionsInSelectionCM6(editor: Editor, action: 'accept' | 'reject'): void {
	const cm = getCmEditorView(editor);
	if (!cm) { new Notice("Modern editor version required."); return; }

	const allMarks = cm.state.field(suggestionStateField, false);
	if (!allMarks || allMarks.length === 0) { 
        new Notice("No suggestions found in the document.", 3000); 
        return; 
    }

	const doc = cm.state.doc;
	let currentSelection = cm.state.selection.main;
	const cursorOriginalPos = currentSelection.head; 

	let paragraphToOperateOn: { from: number; to: number } | null = null;
	let finalCursorPos = cursorOriginalPos; 
	let isOperatingOnIdentifiedParagraph = false; // True if we found a paragraph via cycling logic

	if (!currentSelection.empty) {
		// User has selected text. Operate strictly on this selection.
		paragraphToOperateOn = { from: currentSelection.from, to: currentSelection.to };
		finalCursorPos = currentSelection.from; // Cursor to start of original selection
	} else {
		// Cursor is empty: paragraph mode with cycling.
		isOperatingOnIdentifiedParagraph = true;
        // Define the paragraph where the cursor currently is. This is our logical "start".
		const paragraphAtCursor = getParagraphBoundaries(doc, cursorOriginalPos);
		let pToProcess: { from: number, to: number } | null = null;

		// Pass 1: Search from the current paragraph (or where it starts) to the end of the document.
		let iterator = iterateParagraphs(doc, paragraphAtCursor.from);
		for (const p of iterator) {
			const marksInP = allMarks.filter(mark => mark.from < p.to && mark.to > p.from);
			if (marksInP.length > 0) {
				pToProcess = p;
				break;
			}
		}

		// Pass 2: If not found in Pass 1, search from the document start up to (but not including) the initial paragraph.
		// This pass is skipped if the initial paragraph was the very first one (paragraphAtCursor.from === 0),
		// as Pass 1 would have covered the whole document.
		if (!pToProcess && paragraphAtCursor.from > 0) {
			iterator = iterateParagraphs(doc, 0);
			for (const p of iterator) {
				if (p.from >= paragraphAtCursor.from) { // Stop if we reach the paragraph where the cursor initially was
					break;
				}
				const marksInP = allMarks.filter(mark => mark.from < p.to && mark.to > p.from);
				if (marksInP.length > 0) {
					pToProcess = p;
					break;
				}
			}
		}
		
		paragraphToOperateOn = pToProcess;

		if (paragraphToOperateOn) {
            // Determine final cursor position
			if (paragraphToOperateOn.from === paragraphAtCursor.from && paragraphToOperateOn.to === paragraphAtCursor.to) {
				finalCursorPos = cursorOriginalPos; // Resolved in original paragraph, restore cursor
			} else {
				finalCursorPos = paragraphToOperateOn.from; // Resolved in a new paragraph, cursor to its start
			}
		} else {
			// No paragraph with suggestions found after cycling.
            // Check if the cursor was initially in a visually empty paragraph region.
            const initialParagraphContent = doc.sliceString(paragraphAtCursor.from, paragraphAtCursor.to).trim();
            if (initialParagraphContent === "") {
                 new Notice("Cursor is in an empty paragraph. No suggestions found elsewhere in the document.", 4000);
            } else {
                 new Notice("No suggestions found in the current paragraph or elsewhere in the document.", 4000);
            }
			return;
		}
	}

	if (!paragraphToOperateOn) {
        // This should ideally be caught by the logic above.
        // If explicit selection, it means the selection itself was empty or invalid.
        // If paragraph mode, means something went wrong with cycling or paragraph identification.
        new Notice("Could not determine a paragraph or selection to process.", 3000);
		return;
	}

	const marksInScope = allMarks.filter(mark =>
		mark.from < paragraphToOperateOn!.to && mark.to > paragraphToOperateOn!.from
	);

	if (marksInScope.length === 0) {
        // This should not happen if paragraphToOperateOn was found by the cycling logic,
        // as that logic already filters for paragraphs with marks.
        // If it was an explicit selection, this is the original "no suggestions in selection".
		const message = isOperatingOnIdentifiedParagraph ?
			"Error: Target paragraph has no suggestions after selection." : // Should not be reached
			"No suggestions found in the current selection.";
		new Notice(message, 3000); 
        return;
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
		selection: EditorSelection.cursor(finalCursorPos)
	};
	if (changesArray.length > 0) {
		transactionSpec.changes = changesArray;
	}
	cm.dispatch(cm.state.update(transactionSpec));
	
	const noticeMessage = `${marksInScope.length} suggestion(s) in ${isOperatingOnIdentifiedParagraph ? 'paragraph' : 'selection'} ${action}ed.`;
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
	const sortedMarks = [...marks].sort((a,b) => b.from - a.from); 

	for (const mark of sortedMarks) {
		if (mark.type === 'added') { 
			changesArray.push({ from: mark.from, to: mark.to, insert: "" });
		}
	}

	const transactionSpec: TransactionSpec = {
		effects: clearAllSuggestionsEffect.of(null) 
	};
	if (changesArray.length > 0) {
		const firstChangeFrom = Math.min(...changesArray.map(c => c.from));
		transactionSpec.selection = EditorSelection.cursor(firstChangeFrom);
		transactionSpec.changes = changesArray;
	} else {
		transactionSpec.selection = cm.state.selection;
	}
	cm.dispatch(cm.state.update(transactionSpec));
	new Notice("All active suggestions cleared (changes rejected).", 3000);
}