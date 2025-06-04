// src/lib/editor/suggestion-state.ts
import {
	Extension,
	MapMode,
	Range,
	StateEffect,
	StateField,
} from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { NEWLINE_ADD_SYMBOL, NEWLINE_REMOVE_SYMBOL } from "../constants";

export interface SuggestionMark {
	id: string;
	from: number;
	to: number; // For "added" type, to will be === from. For "removed", it spans the text.
	type: "added" | "removed";
	ghostText?: string; // For "added" type OR for "removed" newlines (e.g., "¶")
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
					const from = tr.changes.mapPos(mark.from, 1, MapMode.TrackDel);
					let to = mark.to;

					if (mark.type === "removed") {
						const toAssoc = -1;
						const mappedTo = tr.changes.mapPos(
							mark.to,
							toAssoc,
							MapMode.TrackDel,
						);
						if (mappedTo === null) return null;
						to = mappedTo;
					} else if (mark.type === "added") {
						if (from !== null) {
							to = from;
						} else {
							return null;
						}
					}

					if (from === null) {
						return null;
					}
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
		span.setAttribute("spellcheck", "false");
		return span;
	}

	override eq(other: GhostTextWidget): boolean {
		return (
			other.displayText === this.displayText &&
			other.className === this.className
		);
	}

	override ignoreEvent(): boolean {
		return false;
	}
}

class SuggestionViewPluginClass {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = Decoration.none;
		try {
			this.decorations = this.computeDecorations(view);
		} catch (e) {
			console.error(
				"WordSmith ViewPlugin: Error in constructor computeDecorations:",
				e,
			);
			this.decorations = Decoration.none;
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
				console.error(
					"WordSmith ViewPlugin: Error in update computeDecorations:",
					e,
				);
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
		let isInsideConsecutiveAddedBlockAtCursor = false;
		let consecutiveAddedBlockFromPos = -1;

		for (const mark of marks) {
			let baseClassName = "";
			let isActive = false;

			if (mark.type === "added") {
				baseClassName = "text-transformer-added";
				const isCursorCurrentlyAtThisMarkFrom =
					isSelectionEmpty && cursorPos === mark.from;

				if (isCursorCurrentlyAtThisMarkFrom) {
					if (
						isInsideConsecutiveAddedBlockAtCursor &&
						mark.from === consecutiveAddedBlockFromPos
					) {
						isActive = false;
					} else {
						isActive = true;
						isInsideConsecutiveAddedBlockAtCursor = true;
						consecutiveAddedBlockFromPos = mark.from;
					}
				} else {
					isActive = false;
					if (
						mark.from !== consecutiveAddedBlockFromPos ||
						!isInsideConsecutiveAddedBlockAtCursor
					) {
						isInsideConsecutiveAddedBlockAtCursor = false;
						consecutiveAddedBlockFromPos = -1;
					}
				}

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

				const displayText = mark.isNewlineChange
					? NEWLINE_ADD_SYMBOL
					: (mark.ghostText ?? "");
				let effectiveClassName = baseClassName;
				if (isActive) {
					effectiveClassName += ` ${baseClassName}-active`;
				}
				// For added newline symbols, ensure they don't get unintended background from the text block.
				if (mark.isNewlineChange) {
					effectiveClassName += " newline-symbol-indicator";
				}

				try {
					const widgetDecoration = Decoration.widget({
						widget: new GhostTextWidget(displayText, effectiveClassName),
						side: 1,
						block: false,
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
				isInsideConsecutiveAddedBlockAtCursor = false;
				consecutiveAddedBlockFromPos = -1;

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

				let effectiveClassName = baseClassName;
				if (isActive) {
					effectiveClassName += ` ${baseClassName}-active`;
				}

				if (
					mark.isNewlineChange &&
					mark.ghostText === NEWLINE_REMOVE_SYMBOL
				) {
					// Add newline-symbol-indicator for specific styling (e.g., no strikethrough)
					// The base classes (text-transformer-removed [-active]) provide background/color/active effects.
					const symbolWidgetClassName = `${effectiveClassName} newline-symbol-indicator`;
					try {
						const widgetDecoration = Decoration.widget({
							widget: new GhostTextWidget(
								NEWLINE_REMOVE_SYMBOL,
								symbolWidgetClassName,
							),
							side: 1,
							block: false,
						}).range(mark.from);
						activeDecorations.push(widgetDecoration);
					} catch (e) {
						console.error(
							`WordSmith ViewPlugin: ERROR creating 'removed newline' (¶) widget decoration for Mark ID ${mark.id}. Class: ${symbolWidgetClassName} Error:`,
							e,
						);
					}
				} else {
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
				}
			} else {
				console.warn(
					"WordSmith ViewPlugin: Mark with unknown type skipped:",
					mark,
				);
				isInsideConsecutiveAddedBlockAtCursor = false;
				consecutiveAddedBlockFromPos = -1;
			}
		}

		activeDecorations.sort((a, b) => a.from - b.from);
		return Decoration.set(activeDecorations, true);
	}
}

const suggestionViewPlugin = ViewPlugin.fromClass(SuggestionViewPluginClass, {
	decorations: (pluginInstance: SuggestionViewPluginClass): DecorationSet => {
		return pluginInstance?.decorations || Decoration.none;
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
