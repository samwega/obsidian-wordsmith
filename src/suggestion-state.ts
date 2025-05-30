// src/suggestion-state.ts
import { Extension, MapMode, Range, StateEffect, StateField } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { NEWLINE_ADD_SYMBOL } from "./textTransformer";

export interface SuggestionMark {
	id: string;
	from: number;
	to: number; // For "added" type, to will be === from. For "removed", it spans the text.
	type: "added" | "removed";
	ghostText?: string; // Only for "added" type: the text to display as a ghost.
	isNewlineChange?: boolean;
	newlineChar?: "\n" | undefined; // Original newline character, e.g. for re-insertion if a removal is rejected or insertion if 'added' is accepted.
}

export const setSuggestionsEffect = StateEffect.define<SuggestionMark[]>();
export const resolveSuggestionEffect = StateEffect.define<{ id: string }>();
export const clearAllSuggestionsEffect = StateEffect.define<null>();

export const suggestionStateField = StateField.define<SuggestionMark[]>({
	create(): SuggestionMark[] {
		return [];
	},
	update(marks, tr): SuggestionMark[] {
		let newMarks = [...marks];

		if (tr.changes.length > 0) {
			newMarks = newMarks
				.map((mark) => {
					// Determine association for mapping 'from' position.
					// For 'added' marks, if an insertion occurs at their 'from' point (e.g., another 'added' mark is accepted),
					// their 'from' should move to *after* the inserted text. So, assoc = 1.
					// For 'removed' marks, 'from' is the start of a span. assoc = -1 keeps it at the start.
					const fromAssoc = mark.type === "added" ? 1 : -1;
					const from = tr.changes.mapPos(mark.from, fromAssoc, MapMode.TrackDel);

					let to = mark.to; 

					if (mark.type === "removed") {
						// For 'removed' marks, 'to' is the end of a span.
						// If an insertion occurs at 'to', 'to' should move to *after* the insertion. So, assoc = 1.
						const toAssoc = 1;
						const mappedTo = tr.changes.mapPos(mark.to, toAssoc, MapMode.TrackDel);
						if (mappedTo === null) return null; // Entire range including 'to' was deleted in a way that it can't be mapped.
						to = mappedTo;
					} else if (mark.type === "added") {
						// For 'added' marks, 'to' is the same as 'from'.
						if (from !== null) {
							to = from;
						} else {
							// If 'from' became null (e.g., deletion across the mark's point), remove the mark.
							return null;
						}
					}

					if (from === null) {
						return null; // Mark's anchor point 'from' was deleted.
					}
					// For "removed" marks, ensure from < to after mapping. If not, mark is invalid.
					if (mark.type === "removed" && from >= to) {
						return null;
					}

					return { ...mark, from, to };
				})
				.filter(Boolean) as SuggestionMark[];
		}

		for (const effect of tr.effects) {
			if (effect.is(setSuggestionsEffect)) {
				newMarks = effect.value;
			} else if (effect.is(resolveSuggestionEffect)) {
				const idToResolve = effect.value.id;
				newMarks = newMarks.filter((m) => m.id !== idToResolve);
			} else if (effect.is(clearAllSuggestionsEffect)) {
				newMarks = [];
			}
		}
		return newMarks;
	},
});

class GhostTextWidget extends WidgetType {
	private readonly displayText: string;
	private readonly className: string;

	constructor(displayText: string, className: string) {
		super();
		this.displayText = displayText;
		this.className = className;
	}

	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.textContent = this.displayText;
		span.className = this.className;
		span.setAttribute("spellcheck", "false"); // important for visual consistency
		return span;
	}

	override eq(other: GhostTextWidget): boolean {
		return other.displayText === this.displayText && other.className === this.className;
	}

	override ignoreEvent(): boolean {
		// if true, the editor will ignore events targetting this widget.
		// if false, events will be handled by the editor.
		return false;
	}
}

class SuggestionViewPluginClass {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = Decoration.none; // Initialize safely
		try {
			this.decorations = this.computeDecorations(view);
		} catch (e) {
			console.error("WordSmith ViewPlugin: Error in constructor computeDecorations:", e);
			this.decorations = Decoration.none; // Fallback
		}
	}

	update(update: ViewUpdate): void {
		let needsRecompute = false;

		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			needsRecompute = true;
		}

		if (
			update.startState.field(suggestionStateField, false) !==
			update.state.field(suggestionStateField, false)
		) {
			needsRecompute = true;
		}

		if (
			update.transactions.some((tr) =>
				tr.effects.some(
					(e) =>
						e.is(setSuggestionsEffect) ||
						e.is(resolveSuggestionEffect) ||
						e.is(clearAllSuggestionsEffect),
				),
			)
		) {
			needsRecompute = true;
		}

		if (needsRecompute) {
			try {
				this.decorations = this.computeDecorations(update.view);
			} catch (e) {
				console.error("WordSmith ViewPlugin: Error in update computeDecorations:", e);
				this.decorations = Decoration.none; // Fallback
			}
		}
	}

	computeDecorations(view: EditorView): DecorationSet {
		if (!view || !view.state) {
			return Decoration.none;
		}

		const marks = view.state.field(suggestionStateField, false);
		const cursorPos = view.state.selection.main.head;
		const isSelectionEmpty = view.state.selection.main.empty;

		if (!marks || marks.length === 0) {
			return Decoration.none;
		}

		const activeDecorations: Range<Decoration>[] = [];
		for (const mark of marks) {
			let baseClassName = "";
			let isActive = false;

			if (mark.type === "added") {
				baseClassName = "text-transformer-added";
				isActive = isSelectionEmpty && cursorPos === mark.from;

				if (mark.from < 0 || mark.from > view.state.doc.length) {
					console.warn(
						"WordSmith ViewPlugin: 'added' Mark 'from' out of bounds, skipping:",
						mark,
					);
					continue;
				}
				if (typeof mark.ghostText === "undefined") {
					console.warn(
						"WordSmith ViewPlugin: 'added' Mark missing ghostText, skipping:",
						mark,
					);
					continue;
				}

				const displayText = mark.isNewlineChange ? NEWLINE_ADD_SYMBOL : (mark.ghostText ?? "");
				const effectiveClassName = isActive
					? `${baseClassName} ${baseClassName}-active`
					: baseClassName;

				try {
					const widgetDecoration = Decoration.widget({
						widget: new GhostTextWidget(displayText, effectiveClassName),
						side: 1, // Positive side for insertions
						block: false, // Ensure all "added" suggestions are inline
					}).range(mark.from);
					activeDecorations.push(widgetDecoration);
				} catch (e) {
					console.error(
						`WordSmith ViewPlugin: ERROR creating 'added' widget decoration for Mark ID ${mark.id}. Class: ${effectiveClassName} Error:`,
						e,
					);
				}
			} else if (mark.type === "removed") {
				baseClassName = "text-transformer-removed";
				isActive = isSelectionEmpty && cursorPos === mark.from;

				if (mark.from >= mark.to) {
					console.warn(
						"WordSmith ViewPlugin: 'removed' Mark invalid range (from >= to), skipping:",
						mark,
					);
					continue;
				}
				if (mark.from < 0 || mark.to > view.state.doc.length) {
					console.warn(
						"WordSmith ViewPlugin: 'removed' Mark range out of bounds, skipping:",
						mark,
					);
					continue;
				}

				const effectiveClassName = isActive
					? `${baseClassName} ${baseClassName}-active`
					: baseClassName;

				try {
					const markDecoration = Decoration.mark({
						attributes: {
							class: effectiveClassName,
							spellcheck: "false",
						},
					}).range(mark.from, mark.to);
					activeDecorations.push(markDecoration);
				} catch (e) {
					console.error(
						`WordSmith ViewPlugin: ERROR creating 'removed' mark decoration for Mark ID ${mark.id}. Class: ${effectiveClassName} Error:`,
						e,
					);
				}
			} else {
				console.warn("WordSmith ViewPlugin: Mark with unknown type skipped:", mark);
			}
		}

		activeDecorations.sort((a, b) => a.from - b.from);

		const decoSet = Decoration.set(activeDecorations, true);
		return decoSet;
	}
}

const suggestionViewPlugin = ViewPlugin.fromClass(SuggestionViewPluginClass, {
	decorations: (pluginInstance: SuggestionViewPluginClass): DecorationSet => {
		if (pluginInstance?.decorations) {
			return pluginInstance.decorations;
		}
		return Decoration.none;
	},
});

export const textTransformerSuggestionExtensions = (): Extension[] => {
	return [suggestionStateField, suggestionViewPlugin];
};

let _suggestionIdCounter = 0;
export function generateSuggestionId(): string {
	_suggestionIdCounter++;
	return `tt-suggestion-${_suggestionIdCounter}`;
}