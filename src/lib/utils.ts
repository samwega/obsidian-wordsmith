// src/lib/utils.ts
import { EditorView } from "@codemirror/view";
import { Editor, Notice, Platform } from "obsidian";
import type TextTransformer from "../main";

/**
 * Logs a standard message to the console if debug mode is enabled.
 * @param plugin The plugin instance to check for debug mode.
 * @param args The message and other data to log.
 */
export function log(plugin: TextTransformer, ...args: unknown[]): void {
	if (!plugin.runtimeDebugMode) return;
	console.log("[WordSmith plugin]", ...args);
}

/**
 * Logs a debug message to the console if debug mode is enabled.
 * @param plugin The plugin instance to check for debug mode.
 * @param args The message and other data to log.
 */
export function logDebug(plugin: TextTransformer, ...args: unknown[]): void {
	if (!plugin.runtimeDebugMode) return;
	console.debug("[WordSmith plugin]", ...args);
}

/**
 * Logs an info message to the console if debug mode is enabled.
 * @param plugin The plugin instance to check for debug mode.
 * @param args The message and other data to log.
 */
export function logInfo(plugin: TextTransformer, ...args: unknown[]): void {
	if (!plugin.runtimeDebugMode) return;
	console.info("[WordSmith plugin]", ...args);
}

/**
 * Logs a warning message to the console if debug mode is enabled.
 * @param plugin The plugin instance to check for debug mode.
 * @param args The message and other data to log.
 */
export function logWarn(plugin: TextTransformer, ...args: unknown[]): void {
	if (!plugin.runtimeDebugMode) return;
	console.warn("[WordSmith plugin]", ...args);
}

/**
 * Retrieves the CodeMirror 6 EditorView instance from an Obsidian Editor.
 * @param editor The Obsidian Editor instance.
 * @returns The EditorView instance if available (CM6), otherwise null (CM5 or unexpected).
 */
export function getCmEditorView(editor: Editor): EditorView | null {
	const cmInstance = editor.cm;
	// Ensure cmInstance is an EditorView, which is the CM6 instance
	// For CM5, cmInstance would be CodeMirror.Editor
	// The check editor.cm instanceof EditorView is a good way to ensure it's CM6
	if (cmInstance && cmInstance instanceof EditorView) {
		return cmInstance;
	}
	return null;
}

/**
 * Formats a Date object into a 'yyyy-mm-dd' string.
 * @param date The Date object to format.
 * @returns The formatted date string.
 */
export function formatDateForFilename(date: Date): string {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Logs an error to the console and displays a user-friendly notice.
 * This function ALWAYS logs to the console, regardless of debug mode.
 * @param error The error object or message to log.
 */
export function logError(error: unknown): void {
	if (Platform.isMobileApp) {
		// No easy way of checking the logs on mobile, thus recommending to
		// retrieve error via running on desktop instead.
		new Notice("Error. For details, run the respective function on the desktop.");
	} else {
		const hotkey = Platform.isMacOS ? "cmd+opt+i" : "ctrl+shift+i";
		new Notice(`Error. Check the console for more details (${hotkey}).`);
	}
	console.error("[WordSmith plugin] error:", error);
}
