// src/lib/constants.ts

/**
 * Symbol used by GhostTextWidget for visual representation of a newline character
 * in an "added" suggestion.
 */
export const NEWLINE_ADD_SYMBOL = "↵";

/**
 * Symbol used by GhostTextWidget for visual representation of a newline character
 * in a "removed" suggestion.
 */
export const NEWLINE_REMOVE_SYMBOL = "¶";

/**
 * Marker inserted into context text to indicate the precise cursor position
 * for generation tasks. LLM prompts are instructed to use this marker.
 */
export const GENERATION_TARGET_CURSOR_MARKER =
	"<<<GENERATION_TARGET_CURSOR_POSITION>>>";

/**
 * Marker inserted before the user's selected text when providing context
 * for transformation tasks.
 */
export const USER_SELECTED_TEXT_START_MARKER =
	"[[[USER_SELECTED_TEXT_STARTING_HERE>>>";

/**
 * Marker inserted after the user's selected text when providing context
 * for transformation tasks.
 */
export const USER_SELECTED_TEXT_END_MARKER =
	"<<<USER_SELECTED_TEXT_ENDING_HERE]]]";
