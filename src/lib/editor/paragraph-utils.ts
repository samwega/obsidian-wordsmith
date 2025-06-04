// src/lib/editor/paragraph-utils.ts
import type { Text } from "@codemirror/state";
import type { SuggestionMark } from "./suggestion-state";

export interface ParagraphRange {
	from: number;
	to: number;
}

/**
 * Determines the boundaries of a paragraph containing a given position.
 * Paragraphs are defined as sequences of non-empty lines separated by empty lines.
 * @param doc The CodeMirror document.
 * @param pos The position within the document.
 * @returns A ParagraphRange object with `from` and `to` offsets.
 */
export function getParagraphBoundaries(doc: Text, pos: number): ParagraphRange {
	let lineFrom = doc.lineAt(pos);
	let lineTo = doc.lineAt(pos);

	// Handle empty line case explicitly: the paragraph is just that empty line.
	if (lineFrom.text.trim() === "") {
		return { from: lineFrom.from, to: lineFrom.to };
	}

	// Expand upwards to the start of the paragraph
	while (lineFrom.number > 1) {
		const prevLine = doc.line(lineFrom.number - 1);
		if (prevLine.text.trim() === "") break; // Stop at empty line
		lineFrom = prevLine;
	}

	// Expand downwards to the end of the paragraph
	while (lineTo.number < doc.lines) {
		const nextLine = doc.line(lineTo.number + 1);
		if (nextLine.text.trim() === "") break; // Stop at empty line
		lineTo = nextLine;
	}
	return { from: lineFrom.from, to: lineTo.to };
}

/**
 * Iterates over paragraphs in the document starting from a given position.
 * Yields ParagraphRange objects for each paragraph.
 * Handles empty lines as individual paragraphs.
 * @param doc The CodeMirror document.
 * @param startPosition The character offset from which to start iterating. Defaults to 0.
 */
export function* iterateParagraphs(
	doc: Text,
	startPosition = 0,
): Generator<ParagraphRange, void, undefined> {
	let currentPos = startPosition;
	if (currentPos >= doc.length && doc.length > 0) return; // Past end of document

	while (currentPos < doc.length) {
		let paragraphBeginLineNum = -1;
		let firstLineAtCurrentSearch = doc.lineAt(currentPos);

		// Handle initial empty lines: each is a paragraph
		if (firstLineAtCurrentSearch.text.trim() === "") {
			yield { from: firstLineAtCurrentSearch.from, to: firstLineAtCurrentSearch.to };
			if (firstLineAtCurrentSearch.number < doc.lines) {
				currentPos = doc.line(firstLineAtCurrentSearch.number + 1).from;
				continue;
			}
			return; // End of document
		}

		// Find the start of the next non-empty paragraph block
		for (let n = firstLineAtCurrentSearch.number; n <= doc.lines; n++) {
			const line = doc.line(n);
			// Skip if currentPos is already past this line (e.g., after yielding an empty line)
			if (currentPos > line.to) continue;

			if (line.text.trim() !== "") {
				paragraphBeginLineNum = n;
				break;
			}
			// If it's an empty line and we're looking for a non-empty block,
			// yield the empty line and advance currentPos.
			yield { from: line.from, to: line.to };
			if (n < doc.lines) {
				currentPos = doc.line(n + 1).from;
				firstLineAtCurrentSearch = doc.lineAt(currentPos); // Re-evaluate for next iteration
				if (firstLineAtCurrentSearch.text.trim() !== "") {
					// Found start of non-empty block
					paragraphBeginLineNum = firstLineAtCurrentSearch.number;
					break;
				}
				// If still empty, the outer loop will handle it or this inner loop continues
			} else {
				return; // End of document
			}
		}

		if (paragraphBeginLineNum === -1) return; // No more non-empty paragraphs

		const paragraphStartLine = doc.line(paragraphBeginLineNum);
		let paragraphEndLine = paragraphStartLine;

		// Expand downwards to find the end of this non-empty paragraph block
		while (paragraphEndLine.number < doc.lines) {
			const nextLine = doc.line(paragraphEndLine.number + 1);
			if (nextLine.text.trim() === "") break; // End of block
			paragraphEndLine = nextLine;
		}

		yield { from: paragraphStartLine.from, to: paragraphEndLine.to };
		currentPos = paragraphEndLine.to + 1; // Move to position after this paragraph
		if (currentPos >= doc.length && paragraphEndLine.number === doc.lines) return; // Reached end
	}
}

/**
 * Finds the next paragraph (from a start offset) that contains suggestion marks.
 * @param doc The CodeMirror document.
 * @param startOffset The character offset from which to start searching.
 * @param marks An array of suggestion marks.
 * @returns The ParagraphRange of the next paragraph with suggestions, or null if none found.
 */
export function findNextParagraphWithSuggestions(
	doc: Text,
	startOffset: number,
	marks: readonly SuggestionMark[], // Use ReadonlyArray for safety
): ParagraphRange | null {
	const paragraphIterator = iterateParagraphs(doc, startOffset);
	for (const p of paragraphIterator) {
		const marksInThisP = marks.filter((mark) => {
			// Check if mark overlaps with paragraph p
			if (mark.type === "added") {
				// "added" marks are points
				return mark.from >= p.from && mark.from <= p.to;
			}
			// "removed" marks are ranges
			return mark.from < p.to && mark.to > p.from;
		});
		if (marksInThisP.length > 0) {
			return p;
		}
	}
	return null;
}

/**
 * Finds the previous paragraph (before an end offset) that contains suggestion marks.
 * @param doc The CodeMirror document.
 * @param endOffset The character offset before which to search.
 * @param marks An array of suggestion marks.
 * @returns The ParagraphRange of the previous paragraph with suggestions, or null if none found.
 */
export function findPreviousParagraphWithSuggestions(
	doc: Text,
	endOffset: number,
	marks: readonly SuggestionMark[], // Use ReadonlyArray for safety
): ParagraphRange | null {
	let lastParagraphWithSuggestions: ParagraphRange | null = null;
	const preParagraphIterator = iterateParagraphs(doc, 0); // Iterate from the beginning
	for (const p of preParagraphIterator) {
		if (p.from >= endOffset) break; // Stop if paragraph starts at or after endOffset

		const marksInThisP = marks.filter((mark) => {
			if (mark.type === "added") {
				return mark.from >= p.from && mark.from <= p.to;
			}
			return mark.from < p.to && mark.to > p.from;
		});
		if (marksInThisP.length > 0) {
			lastParagraphWithSuggestions = p; // Keep track of the latest one found before endOffset
		}
	}
	return lastParagraphWithSuggestions;
}
