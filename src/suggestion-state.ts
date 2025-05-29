// src/suggestion-state.ts
import { Extension, MapMode, Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view"; // Removed WidgetType

export interface SuggestionMark {
	id: string;
	from: number;
	to: number;
	type: "added" | "removed";
	isNewlineChange?: boolean;
	newlineChar?: "\n";
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
			console.error("WordSmith ViewPlugin: Error in constructor computeDecorations:", e);
			this.decorations = Decoration.none;
		}
	}

	update(update: ViewUpdate): void {
		let needsRecompute = false;

		if (!update) {
			if (this.decorations.size > 0) {
				this.decorations = Decoration.none;
			}
			return;
		}

		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			needsRecompute = true;
		}

		if (update.startState) {
			const prevMarks = update.startState.field(suggestionStateField, false);
			if (prevMarks !== update.state.field(suggestionStateField, false)) {
				needsRecompute = true;
			}
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
				this.decorations = Decoration.none;
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
			let className = "";

			if (mark.type === "added") {
				className = "text-transformer-added";
			} else if (mark.type === "removed") {
				className = "text-transformer-removed";
			}

			if (!className) {
				console.warn("WordSmith ViewPlugin: Mark with unknown type skipped:", mark);
				continue;
			}

			if (isSelectionEmpty && cursorPos === mark.from) {
				className += ` ${className}-active`;
			}

			if (mark.from >= mark.to) {
				console.warn("WordSmith ViewPlugin: Invalid mark range (from >= to), skipping:", mark);
				continue;
			}
			if (mark.from < 0 || mark.to > view.state.doc.length) {
				console.warn("WordSmith ViewPlugin: Mark range out of bounds, skipping:", mark);
				continue;
			}

			try {
				const decorationInstance = Decoration.mark({
					attributes: {
						class: className,
						spellcheck: "false",
					},
				}).range(mark.from, mark.to);
				activeDecorations.push(decorationInstance);
			} catch (e) {
				console.error(
					`WordSmith ViewPlugin: ERROR creating decoration for Mark ID ${mark.id}. Class: ${className} Error:`,
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
