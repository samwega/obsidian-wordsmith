// src/suggestion-state.ts
import { Extension, MapMode, Range, StateEffect, StateField } from "@codemirror/state"; // Added Extension
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view"; // Added WidgetType

export interface SuggestionMark {
	id: string;
	from: number;
	to: number;
	type: "added" | "removed";
	isNewlineChange?: boolean;
	newlineChar?: "\n";
}

// This symbol is used for display purposes within Decoration.replace for generated newlines
const NEWLINE_DISPLAY_SYMBOL_FOR_ADDED_GENERATED_NEWLINE = "↵";


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
					const from = tr.changes.mapPos(mark.from, -1, MapMode.TrackDel);
					const to = tr.changes.mapPos(mark.to, 1, MapMode.TrackDel);
					if (from === null || to === null || from >= to) {
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

class SuggestionViewPluginClass {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = Decoration.none;
		try {
			// Initial computation of decorations
			this.decorations = this.computeDecorations(view);
		} catch (e) {
			console.error("TextTransformer ViewPlugin: Error in constructor computeDecorations:", e);
			this.decorations = Decoration.none;
		}
	}

	update(update: ViewUpdate): void {
		let needsRecompute = false;

		if (!update) { // Defensive, might not be hit in typical CM usage
			if (this.decorations.size > 0) {
				this.decorations = Decoration.none;
			}
			return;
		}

		// Reasons to recompute decorations:
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			needsRecompute = true;
		}

		// Check if the suggestionStateField itself has changed
		if (update.startState) {
			const prevMarks = update.startState.field(suggestionStateField, false);
			const currentMarks = update.state.field(suggestionStateField, false);
			if (prevMarks !== currentMarks) {
				needsRecompute = true;
			}
		} else {
			// No startState, likely initial creation. If there are marks, compute.
			const currentMarks = update.state.field(suggestionStateField, false);
			if (currentMarks && currentMarks.length > 0) {
				needsRecompute = true;
			}
		}

		// Check if any of our specific effects were dispatched (might be redundant if state also changed, but safe)
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
				console.error("TextTransformer ViewPlugin: Error in update computeDecorations:", e);
				this.decorations = Decoration.none; // Fallback
			}
		}
	}

	computeDecorations(view: EditorView): DecorationSet {
		if (!view || !view.state) {
			return Decoration.none;
		}

		const marks = view.state.field(suggestionStateField, false);
		const cursorPos = view.state.selection.main.head; // Get current cursor position
		const isSelectionEmpty = view.state.selection.main.empty; // Check if it's a cursor, not a range selection

		if (!marks || marks.length === 0) {
			return Decoration.none;
		}

		const activeDecorations: Range<Decoration>[] = [];
		for (const mark of marks) {
			let className = ""; 

			if (mark.type === "added") {
				className = "text-transformer-added";
			} else if (mark.type === "removed") {
				className = "text-transformer-removed";
			}

			if (!className) {
				console.warn("TextTransformer ViewPlugin: Mark with unknown type skipped:", mark);
				continue;
			}

			// Check if this mark is "active" (cursor at the beginning and no range selection)
			if (isSelectionEmpty && cursorPos === mark.from) {
				className += ` ${className}-active`; // e.g., "text-transformer-added text-transformer-added-active"
			}

			// Validate mark range
			if (mark.from >= mark.to) {
				console.warn(
					"TextTransformer ViewPlugin: Invalid mark range (from >= to), skipping:",
					mark,
				);
				continue;
			}
			if (mark.from < 0 || mark.to > view.state.doc.length) {
				console.warn("TextTransformer ViewPlugin: Mark range out of bounds, skipping:", mark);
				continue;
			}
			
			const actualTextInDoc = view.state.doc.sliceString(mark.from, mark.to);

			try {
				if (mark.isNewlineChange && mark.type === "added" && actualTextInDoc === "\n") {
					// This is an "added" newline suggestion where the document contains an actual '\n'.
					// We want to display it as NEWLINE_DISPLAY_SYMBOL_FOR_ADDED_GENERATED_NEWLINE.
					const widgetEl = document.createElement("span");
					widgetEl.className = className; // Apply suggestion styling
					widgetEl.textContent = NEWLINE_DISPLAY_SYMBOL_FOR_ADDED_GENERATED_NEWLINE;

					const replaceDeco = Decoration.replace({
						widget: new class extends WidgetType {
							constructor(readonly el: HTMLElement) { super(); }
							toDOM() { return this.el; }
							override eq(other: this) { return other.el.className === this.el.className && other.el.textContent === this.el.textContent; }
							override ignoreEvent() { return false; }
						}(widgetEl),
					});
					activeDecorations.push(replaceDeco.range(mark.from, mark.to));
				} else {
					// All other cases:
					// - Regular text suggestions (added/removed)
					// - Newline suggestions from textTransformation (where "↵" or "¶" symbols are already in the document text)
					// - "removed" newline suggestions (which implies the "¶" symbol is in the doc or it's a diff calculation detail)
					const decorationInstance = Decoration.mark({
						attributes: {
							class: className,
							spellcheck: "false",
						},
					}).range(mark.from, mark.to);
					activeDecorations.push(decorationInstance);
				}
			} catch (e) {
				console.error(
					`TextTransformer ViewPlugin: ERROR creating decoration for Mark ID ${mark.id}. Class: ${className} Error:`,
					e,
				);
			}
		}

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