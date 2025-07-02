# Gemini Code Assistant Project Overview: WordSmith

This document provides a comprehensive overview of the WordSmith Obsidian plugin, generated from the `specification-object.json`.

## Plugin Info

-   **ID**: `wordsmith`
-   **Name**: WordSmith
-   **Version**: `3.2.0+`
-   **Author**: samwega
-   **Description**: An AI-powered writing assistant for Obsidian featuring context-aware, inline, reviewable suggestions, a dynamic provider framework for accessing hundreds of models (including local), and knowledge graph generation.

## Build & Tech Stack

-   **Primary Language**: TypeScript
-   **Build Command**: `node .esbuild.mjs`
-   **Framework**: Obsidian Plugin API
-   **Editor Integration**: CodeMirror 6

## Architecture

The plugin follows a **Layered Service-Oriented Architecture** to ensure high cohesion, low coupling, and maintainability.

-   **UI Layer**: Handles all user interaction (Modals, Views, Settings).
    -   *Key Components*: `main.ts`, `settings.ts`, `context-control-panel.ts`, `ui/modals/*`
-   **Core Logic / Orchestration Layer**: The central nervous system that orchestrates workflows.
    -   *Key Components*: `lib/core/textTransformer.ts`, `lib/core/graphGenerator.ts`, `lib/editor/suggestion-handler.ts`
-   **Service Layer**: Manages application-level resources like AI models and providers.
    -   *Key Components*: `services/ModelService.ts`, `services/CustomProviderService.ts`, `services/FavoritesService.ts`
-   **LLM Communication Layer**: Handles direct communication with AI model APIs.
    -   *Key Components*: `llm/prompt-builder.ts`, `llm/chat-completion-handler.ts`, `llm/gemini.ts`
-   **Editor Integration Layer (CodeMirror 6)**: Interacts directly with the editor state to manage inline suggestions.
    -   *Key Components*: `lib/editor/suggestion-state.ts`

### Key Architectural Principles

-   **Separation of Concerns**: Each module has a single, well-defined responsibility.
-   **Modularity**: Features are encapsulated in their own modules.
-   **State Management**: Centralized settings in `settings-data.ts` and transient editor state via CodeMirror 6 `StateField`.
-   **Extensibility**: A custom provider framework allows for adding new AI services easily.
-   **Performance**: Utilizes techniques like list virtualization and caching for a responsive UI.

## Core Features

### 1. Inline AI Suggestions (Transformation & Generation)

-   **Description**: Users can transform selected text or generate new text at the cursor. Changes are displayed as non-destructive, reviewable inline suggestions (additions in green, removals in red).
-   **Workflow (Transformation)**:
    1.  User triggers `Transform selection/paragraph`.
    2.  `textTransformer.ts` captures text and context.
    3.  The appropriate LLM handler is called.
    4.  The response is diffed against the original text.
    5.  The diff is converted into `SuggestionMark` objects and rendered in the editor via a CodeMirror `StateField` and `ViewPlugin`.
-   **Key Files**: `lib/core/textTransformer.ts`, `lib/editor/suggestion-state.ts`, `ui/modals/custom-prompt-modal.ts`

### 2. Suggestion Management

-   **Description**: A suite of keyboard-driven commands to navigate, accept, and reject suggestions individually or in bulk.
-   **Workflow**:
    1.  User triggers a management command (e.g., `Accept next suggestion`).
    2.  `suggestion-handler.ts` locates the relevant `SuggestionMark`(s) in the state.
    3.  A CodeMirror transaction is dispatched to update the document and remove the suggestion from the state.
-   **Key Files**: `lib/editor/suggestion-handler.ts`

### 3. Dynamic AI Provider Framework

-   **Description**: A robust system to connect to any OpenAI-compatible API, plus native support for Google and Anthropic. It automatically handles model-specific token limits.
-   **Workflow**:
    1.  User adds a provider via the `CustomProviderModal`.
    2.  `CustomProviderService` tests and saves the configuration.
    3.  `ModelService` fetches models from all enabled providers, using a cache for performance.
    4.  The system selects the correct handler (`chat-completion-handler` or `gemini`) for AI requests.
-   **Key Files**: `services/ModelService.ts`, `services/CustomProviderService.ts`, `llm/chat-completion-handler.ts`, `llm/gemini.ts`

### 4. Knowledge Graph Generation

-   **Description**: Generates an Obsidian Canvas file from note content, representing entities and relationships as a visual graph.
-   **Workflow**:
    1.  User triggers `Generate knowledge graph`.
    2.  `graphGenerator.ts` sends a specialized prompt to the LLM, requesting a specific JSON structure.
    3.  The response is validated, and a force-directed layout is calculated using `d3-force`.
    4.  The final `.canvas` JSON is constructed and saved.
-   **Key Files**: `lib/core/graphGenerator.ts`, `llm/prompt-builder.ts`

### 5. Context Control System

-   **Description**: A side panel gives users fine-grained control over the context sent to the AI, including dynamic context (surrounding lines), section context (current Markdown section), full note, and custom text with wikilink support.
-   **Key Files**: `ui/context-control-panel.ts`, `lib/core/textTransformer.ts`

## Data Model

-   **Persistent Settings (`lib/settings-data.ts`)**: The main settings object `TextTransformerSettings` stores user configurations like custom providers, selected model, prompts, and context panel state.
-   **Transient Editor State (`lib/editor/suggestion-state.ts`)**: The `suggestionStateField` (a CodeMirror `StateField`) manages the live array of `SuggestionMark` objects for the active editor, which is not saved between sessions.

## Key Commands

-   `Open AI Context Control Panel`: Opens the main sidebar view.
-   `Transform selection/paragraph`: Applies a transformation prompt to the selected text or current paragraph.
-   `Prompt Based Context Aware Generation at Cursor`: Opens a modal to generate text from a custom prompt.
-   `Generate knowledge graph`: Creates a `.canvas` file from the current note's context.
-   `Accept/Reject/Focus/Clear` commands: A full suite for managing inline suggestions.

## Obsidian Plugin Guidelines Compliance
- `Always use sentence case in UI`
- Use window.setTimeout, window.clearTimeout, window.setInterval, window.clearInterval instead of their versions without window. Use number instead of NodeJs.Timeout.
- Use setHeading instead of a <h1>, <h2>
- Use the appropriate callback type for commands
- Prefer the Vault API over the Adapter API
- Avoid using innerHTML
- No hardcoded styling
- prefer async/await over Promise
- Avoid unnecessary logging to console
- Use createDiv(), createSpan(), createEl(), createFragment() instead.
- Don't detach leaves in onunload
