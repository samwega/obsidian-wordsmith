# Text Transformer - AI Writing Assistant for Obsidian

**Current Version:** v1.6.0

Text Transformer is the ultimate AI-powered writing assistant for Obsidian—your all-in-one tool for seamless editing, contextual content generation, and effortless refinement, right inside your notes. It excels at **stylistic improvements**, **proofreading**, **translation**, and **prompt-based generation**—all *context-aware*!

**Review and accept or reject individual AI suggestions inline** directly in your editor. Create custom prompts, leverage multiple AI providers (OpenAI GPT & Google Gemini), and benefit from advanced context control—all fully keyboard-driven.

Initially forked from the excellent and much more focused [obsidian-proofreader](https://github.com/chrisgrieser/obsidian-proofreader) by Christopher Grieser, Text Transformer has evolved into a feature-complete AI writing assistant.

<img alt="Showcase" width=90% src="https://i.imgur.com/92rfV9X.png">

## Table of contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Release History](#release-history)
  - [✨ What's New in v1.6.0 – Enhanced Suggestion Navigation! ✨](#-whats-new-in-v160--enhanced-suggestion-navigation-)
  - [✨ What's New in v1.5.0 - Context Aware Generation at Cursor! ✨](#-whats-new-in-v150---context-aware-generation-at-cursor-)
  - [Minor Versions of v.1.5.x](#minor-versions-of-v15x)
  - [✨ What's New in v1.4.0 - Precision Newline Tracking! ✨](#-whats-new-in-v140---precision-newline-tracking-)
    - [Minor Versions of v.1.4.x](#minor-versions-of-v14x)
  - [✨ What's New in v1.3.0 - Revamped Suggestion Display! ✨](#-whats-new-in-v130---revamped-suggestion-display-)
    - [Minor Versions of v.1.3.x](#minor-versions-of-v13x)
  - [✨ What's New in v1.2.1 & v1.2.2 ✨](#-whats-new-in-v121--v122-)
  - [✨ What's New in v1.2.0 ✨](#-whats-new-in-v120-)
  - [✨ What's New in v1.1.0 ✨](#-whats-new-in-v110-)
  - [✨ What's New in v1.0.0 ✨](#-whats-new-in-v100-)
- [Features](#features)
- [How It Works: Inline Suggestions](#how-it-works-inline-suggestions)
- [AI Providers & Models](#ai-providers--models)
- [Installation & Setup](#installation--setup)
  - [Plugin Installation (via Community Store)](#plugin-installation-via-community-store)
  - [Manual Installation](#manual-installation)
  - [API Key Setup](#api-key-setup)
- [Usage](#usage)
  - [Core Commands](#core-commands)
  - [Managing Suggestions](#managing-suggestions)
  - [Using the AI Context Control Panel](#using-the-ai-context-control-panel)
- [Customizing Prompts](#customizing-prompts)
- [Legacy Text Trasnformer](#legacy-text-trasnformer)
- [Plugin Development](#plugin-development)
- [About the Developer](#about-the-developer)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Release History

### ✨ What's New in v1.6.0 – Enhanced Suggestion Navigation! ✨

This release supercharges your suggestion review workflow, making it faster and more intuitive to manage AI-generated edits and new content.

**Key Features of v1.6.0:**

* **Suggestion Navigation Hotkeys:**
  * Effortlessly cycle through all active AI suggestions in your document using new commands:
    * **"Text Transformer: Focus next suggestion"** – Move your cursor to the start of the next suggestion, making it instantly active for review.
    * **"Text Transformer: Focus previous suggestion"** – Jump back to the previous suggestion with a single keystroke.
  * Both commands support keyboard repeat, enabling rapid traversal through suggestions with your preferred hotkeys (set them in Obsidian’s hotkey settings).
* **Improved Cursor Behavior:**
  * Whenever new suggestions are generated—whether from a text transformation or an ad-hoc prompt—the cursor is now automatically positioned at the very first suggestion, immediately highlighting it for action. This streamlines the accept/reject workflow and eliminates manual cursor adjustment.
* **Refined Keyboard-First Editing:**
  * Combined with dynamic active suggestion highlighting (from v1.5.1), these navigation enhancements make it easier than ever to see, select, and act on the exact change you want—all without leaving the keyboard.
* **Under-the-Hood Improvements:**
  * Minor performance and stability tweaks for smoother suggestion handling.

**Why this matters:**

Text Transformer now offers one of the fastest and most ergonomic AI suggestion review experiences in Obsidian. Quickly navigate, focus, and resolve suggested changes—whether editing, rewriting, or generating new content—keeping you firmly in your creative flow.

### ✨ What's New in v1.5.0 - Context Aware Generation at Cursor! ✨

This major release introduces a powerful new way to interact with AI: **Ad-hoc Contextual Generation directly at your cursor, presented as a suggestion.** Go beyond transforming existing text – now you can generate new content, ideas, or continuations seamlessly within your writing flow.

**Key Features of v1.5.0: Prompt Based Context Aware Generation at Cursor**

*   **New Command: "Generate text with ad-hoc prompt (as suggestion)"**
    *   Trigger this editor command (via hotkey or command palette) to open the new "Context Aware Generator" modal.
    *   Type your specific instruction (e.g., "brainstorm ideas for X," "write an intro paragraph about Y," "explain Z simply") into the modal.
*   **Contextual Awareness for Generation:**
    *   Leverages the settings in your **AI Context Control Panel** (Custom, Dynamic, or Entire Note).
    *   When Dynamic or Entire Note context is active, a special marker (`<<<GENERATION_TARGET_CURSOR_POSITION>>>`) is inserted at your precise cursor location within the context sent to the AI. This tells the AI *exactly* where you intend the new text to be generated.
    *   The AI uses this context and marker to produce more relevant and precisely placed generated content.
*   **Seamless Suggestion Workflow:**
    *   The AI-generated text is inserted directly at your cursor position as a single "added" suggestion.
    *   You can then accept or reject this generated block just like any other Text Transformer suggestion.
    *   The cursor automatically moves to the end of the inserted text.
*   **Modal Enhancements:**
    *   The "Context Aware Generator" modal automatically focuses the prompt input area.
    *   A notice appears if you try to submit an empty prompt.
*   **Streamlined Suggestion Navigation:**
    *   When using "Accept/Reject Next Suggestion," if there's only **one** suggestion in the entire document, it's now resolved immediately without requiring a second key press (the "scroll and press again" step is skipped).
    *   For multiple suggestions, the two-step navigation (scroll to suggestion, then press again to act) remains, ensuring you can clearly target specific suggestions.

**Why this is a game-changer:**

This feature transforms Text Transformer from primarily an editing/refinement tool into a versatile writing partner capable of both **transforming existing text and generating new content with contextual understanding, all within the familiar suggestion-based workflow.** Whether you're stuck, need a creative boost, or want to quickly draft a section, the Context Aware Generator is ready to assist.

### Minor Versions of v.1.5.x

![image](https://github.com/user-attachments/assets/0c2dd6f5-7529-4d08-8fef-5867de130d3d)
![image](https://github.com/user-attachments/assets/464f0e0c-d93c-4aa8-bafa-5ab9655358fe)

* **v1.5.1**—**Dynamic Active Suggestion Highlighting:** Implemented strong visual cues – the suggestion targeted by your cursor (when placed at its beginning) now stands out with significantly increased contrast and a glowing outline, making it unmistakably clear which suggestion you're about to accept or reject.

![image](https://github.com/user-attachments/assets/88076b79-a060-402a-a4cd-61f5ef35adcf)
![image](https://github.com/user-attachments/assets/31800da0-195d-4096-9156-7cdb33cb9213)

### ✨ What's New in v1.4.0 - Precision Newline Tracking! ✨

This update brings a crucial enhancement to how Text Transformer handles changes involving **newlines**, making suggestions more accurate and intuitive, especially for structural edits and reformatting.

* **Enhanced Newline Diffing:**
  * Newlines are now consistently marked with green "↵" (added) and pink "¶" (removed).
  * **Improved Accuracy for Structural Changes:** The underlying diffing mechanism (`jsdiff`) has been switched to `diffWordsWithSpace` and combined with more granular internal processing. This significantly improves the plugin's ability to detect and represent newline additions and removals, even when they are part of larger text blocks or when AI rephrases sentences across line breaks.
  * **Clearer Visuals for Reformatting:** Whether the AI is breaking a long sentence into multiple lines, or merging multiple lines into one, these structural changes involving newlines are now clearly and correctly marked for your review.
* **More Robust Suggestion Handling:**
  * The logic for applying and resolving suggestions involving these new newline markers has been updated for consistency. Accepting an added "↵" correctly inserts a newline, and rejecting a removed "¶" correctly re-inserts the newline.
* **Under-the-Hood Tweaks:** Codebase cleaned with TypeScript typing refinements and removal of unused code.

**Why this matters:** This update solves inconsistent tracking of AI-suggested newlines additions and removals, ensuring you see and control proposed line changes for clarity, conciseness, or restructuring.

#### Minor Versions of v.1.4.x

* **v1.4.1**—**Style no longer hard coded**—you can edit the CSS now.
* **v1.4.2—Adaptive Styling for dark/light themes.**
* * **v1.4.3—Disables spellcheck red squiggle during suggestion**. Suggestion sticks the old and new word together and everything is flagged by spellcheck, so it needed to be disabled.

---

### ✨ What's New in v1.3.0 - Revamped Suggestion Display! ✨

This major update overhauls how AI suggestions are displayed and managed, moving to a more robust and visually integrated system within the Obsidian editor:

* **New Suggestion Engine:**
  * **No More Markdown Markers:** Text Transformer **no longer uses** `==highlight==` for additions or `~~strikethrough~~` for removals in the actual document text.
  * **Direct CodeMirror Decorations:** Suggestions are now rendered using **inline-styled CodeMirror 6 decorations**. This means:
    * Added text is typically shown with a light green background.
    * Removed text is shown with a light pink background and a line-through effect.
    * These styles are applied *visually* without altering the underlying text with special characters, providing a cleaner experience and better theme compatibility.
* **Robust Internal Logic:**
  * The internal state management for suggestions has been rewritten using a CodeMirror `ViewPlugin` for more direct and efficient handling of decorations.
  * Improved error handling and extensive logging have been added for easier debugging and more stable performance.
* **Settings Enhancements:**
  * Settings loading is now more robust, with better migration logic for prompts and ensures default values are correctly applied.
* **Refined User Experience:**
  * Command names have been simplified (e.g., "(CM6)" suffix removed).
  * Notices and messages have been clarified.

#### Minor Versions of v.1.3.x

**v1.3.1**—**AI Model Selector in Side Pane:** Quickly switch your preferred AI model directly from the AI Context Control Panel for even faster workflow adjustments.
**v1.3.2**—Bug fixes.

### ✨ What's New in v1.2.1 & v1.2.2 ✨

These updates brought significant UI enhancements, a new dynamic translator feature, and a powerful new default prompt:

* **Revamped Settings UI:**
  * Implemented a **two-column layout** for Prompt Settings and Prompt Management for a more organized view.
  * Enhanced the overall settings UI with **collapsible sections**, improved styling, and unified API Key and Model settings for better clarity and ease of use.
  * Reordered settings sections for a more logical flow.
* **Dynamic Translator with Language Input:** The "Translate" prompt is now more dynamic, allowing users to specify the target language directly within the prompt flow, and it now includes an input field for the target language.
* **New Default Prompt - "Mind the Context!":** This prompt instructs the model to do what the context says, and revises the text strictly based on the directives provided in the context. For instance, you can add any rule on the fly in the Custom Context box.
* **Bug Fixes:** Addressed issues related to the translator input box display.

### ✨ What's New in v1.2.0 ✨

This version significantly enhanced your control over the AI's context and
streamlined prompt management:

* **Take control of your AI's context with the new Context Control Panel:**
  * **Dynamic Context:** Automatically include surrounding paragraphs for
        richer, more relevant AI suggestions.
  * **Entire Note Context:** Utilize the full content of your current note to
        inform the AI.
  * **Custom Context:** Provide your own specific text snippets through a
        dedicated input area for precise context.
  * *Note: Dynamic and Entire Note context options are mutually exclusive
        to ensure clarity.*
* **New Setting - Dynamic Context Lines:** Fine-tune the amount of surrounding
    text (number of paragraphs) used by the Dynamic Context feature.
* **Prompt Management Update:** Added a helpful note in the settings page
    explaining how to manually edit default prompts by modifying the
    `data.json` file (requires an Obsidian reload after changes).

### ✨ What's New in v1.1.0 ✨

Version 1.1.0 expanded your AI model horizons:

* **Google Gemini Integration:** Connect your Gemini API key to use Google's
    powerful models (including Gemini 2.5 Flash and Pro) for all text
    transformations. This offers greater flexibility in balancing cost, speed,
    and AI capabilities.
* **Seamless Model Selection:** The settings panel was updated to easily switch
    between your preferred OpenAI and Gemini models.

### ✨ What's New in v1.0.0 ✨

Version 1.0.0 marked the initial major transformation from the original
Proofreader plugin, introducing core functionalities that define Text
Transformer today:

* **Introducing the Prompt Palette:** Moved beyond a single proofreading
    instruction to a versatile palette. Users can select from a variety of
    predefined prompts to transform text in multiple ways (e.g., Improve,
    Shorten, Lengthen, Fix Grammar).
* **Custom Prompts Unleashed:** Empowered users to create and save their own
    unique prompts. This allows for a highly personalized AI writing assistant
    tailored to specific needs and styles.
* **Foundation for a Multi-Feature AI Assistant:** This version laid the
    groundwork for Text Transformer to become a comprehensive AI writing tool,
    moving beyond basic proofreading to a wider range of text manipulations.

## Features

Text Transformer empowers you to refine your text directly within Obsidian using a suite of powerful AI capabilities:

* **Versatile Text Transformations via Prompt Palette:** Improve clarity, shorten or lengthen text, fix grammar, simplify language, enhance readability, translate (with dynamic language input), utilize contextual instructions (such as the "Mind the Context!" prompt), and more. Select from a range of built-in prompts or your own creations through an intuitive palette.
* **Inline Suggestion Review:** AI-generated changes appear directly in your editor. Added text is highlighted (e.g., light green), and removed text is displayed with a different background and strike-through (e.g., light pink). You can accept or reject each change individually or in batches.
* **Custom Prompts:** Create and save your own prompts tailored to your specific writing needs and workflows.
  * **Flexible Prompt Management:** Easily enable or disable any default or custom prompt using toggles in the settings.
* **Advanced AI Context Control:** Precisely manage the information sent to the AI for more accurate and relevant transformations:
  * **Dynamic Context:** Automatically include surrounding text from your note. Adjust how many lines above and below the line you're currently on are included.
  * **Entire Note Context:** Use the full content of your current note.
  * **Custom Context:** Paste any specific text into the provided AI Context Control Panel.
  * **Multiple AI Provider Support:** Choose between OpenAI (GPT models) and Google (Gemini models) to best suit your needs for quality, speed, and cost.
* **Ad-hoc Contextual Generation at Cursor:** Instantly generate new text, ideas, or continuations exactly where your cursor is placed, leveraging surrounding context for highly relevant suggestions—all seamlessly inserted as reviewable inline suggestions.
* **Keyboard-First Workflow:** Designed for efficiency, with comprehensive hotkey support for all major actions.
* **Dynamic Active Suggestion Highlighting:** Suggestions targeted by your cursor (when placed at their beginning) are now visually emphasized with increased contrast and a glowing outline, making it easy to see which suggestion you are about to accept or reject.

<img alt="Showcase of model settings" width=90% src="https://i.imgur.com/DbuXLxx.png">

## How It Works: Inline Suggestions

The core strength of Text Transformer lies in its intuitive inline suggestion
system:

1. **Invoke AI:** Select text (or place your cursor in a paragraph) and
    trigger a transformation command via hotkey or the command palette.
2. **Choose Your Prompt:** Select from default or your custom-created prompts
    using the Prompt Palette.
3. **See Instant Changes:** The AI processes your text, and suggestions appear
    directly in your editor – additions are typically highlighted with a light green
    background, and deletions are shown with a light pink background and
    struck through. These are visual cues powered by CodeMirror decorations and do not insert
    special characters like `==` or `~~` into your text.
4. **You're in Control:** Use dedicated commands (and hotkeys) to accept or
    reject each individual suggestion, or accept/reject all suggestions
    within the current selection/paragraph at once.

This seamless process allows for rapid iteration and refinement of your writing
without ever leaving your Obsidian workspace.

<img alt="Showcase of inline suggestions" width=90% src="https://i.imgur.com/q8vaqr8.png">

## AI Providers & Models

Text Transformer supports models from both OpenAI and Google, giving you a choice
based on your preferences for performance and cost.

> [!IMPORTANT]
> This plugin requires an **OpenAI API key** and/or a **Gemini API key**. Usage
> will incur costs with the respective provider (OpenAI or Google) based on
> the amount of text processed.

**Model Options & Estimated Pricing:**

(Prices are estimates per 1 million tokens, roughly equivalent to 750,000
words. Please refer to official OpenAI and Google Gemini pricing pages for the
most up-to-date information. The plugin developer is not responsible for
discrepancies.)

* **OpenAI:** ([Track Usage](https://platform.openai.com/usage))
  * **GPT-4.1:** High intelligence, best for complex literary tasks.
        (Approx. $2 input / $8 output per 1M tokens)
  * **GPT-4.1-mini:** Good balance of intelligence and speed.
        (Approx. $0.40 input / $1.60 output per 1M tokens)
  * **GPT-4.1-nano:** Fastest, most cost-effective for basic proofreading.
        (Approx. $0.10 input / $0.40 output per 1M tokens)
* **Google Gemini:** ([Track Usage](https://makersuite.google.com/app/usage))
  * **Gemini 2.5 Pro:** High intelligence, thorough (can be slower).
        (Approx. $3.50 input / $10.50 output per 1M tokens)
  * **Gemini 2.5 Flash:** Very fast and powerful, great all-rounder.
        (Approx. $0.50 input / $1.50 output per 1M tokens)

**General Guidance:**

* **Intelligence:** Higher intelligence models are generally better for
    creative tasks, nuanced understanding, and complex instructions, but may be
    slower and more expensive.
* **Speed:** Faster models offer quicker turnaround, ideal for iterative
    editing and proofreading.

Choose the model that best fits your task and budget in the plugin settings.

<img alt="Showcase of recommended hotkeys" width=70% src="https://i.imgur.com/l5Qpw2K.png">

## Installation & Setup

### Plugin Installation (via Community Store)

Coming soon! We are working on getting Text Transformer added to the official
Obsidian community plugin store.

In the meantime, please use the [Manual Installation](#manual-installation)
method below.

### Manual Installation

For users who prefer to install manually or are using a version not yet in the
community store:

1. Go to the [Releases page]
    (<https://github.com/samwega/obsidian-text-transformer/releases>) on GitHub.
2. Find the latest release and download the `main.js`, `manifest.json`, and
    `styles.css` files from the "Assets" section.
3. In your Obsidian vault, navigate to the `.obsidian/plugins/` directory.
4. Create a new folder named `text-transformer`.
5. Copy the downloaded `main.js`, `manifest.json`, and `styles.css` files into
    this new `text-transformer` folder.
6. Reload Obsidian (e.g., close and reopen the app, or use the "Reload app
    without saving" command).
7. Go to `Settings` -> `Community plugins`, find "Text Transformer" in your
    list of installed plugins, and enable it.

### API Key Setup

You'll need at least one API key to use Text Transformer.

To get your API key(s):

1. **OpenAI:** (Optional)
    * [Create an OpenAI account](https://auth.openai.com/create-account)
        if you don't have one.
    * Go to your [API keys page](https://platform.openai.com/api-keys).
    * Click `Create new secret key`, name it (e.g., "Obsidian Text
        Transformer"), and copy the key.

2. **Google Gemini:** (Optional)
    * Ensure you have a Google account and visit
        [Google AI Studio](https://aistudio.google.com).
    * Navigate to the [API key page](https://aistudio.google.com/app/apikey)
        (you might need to create a project first).
    * Click `Create API key in new project` or `Create API key` in an
        existing project. Copy the key.

3. In Obsidian, go to `Settings → Text Transformer` and paste your copied
    API key(s) into the respective "OpenAI API Key" and/or "Gemini API Key"
    fields.

> [!TIP]
> It's wise to monitor your API usage to avoid unexpected costs. Links to
> usage dashboards are provided in the
> [AI Providers & Models](#ai-providers--models) section.

## Usage

Text Transformer is designed for a keyboard-centric workflow. Configure your
preferred hotkeys in Obsidian's settings for the commands below.

<img alt="Showcase of recommended hotkeys" width=70% src="https://i.imgur.com/MJX4Lrt.png">

### Core Commands

1. **`Text Transformer: Transform selection/paragraph`**: This is your main
    command.
    * If you have text selected, it will be used for transformation.
    * If no text is selected, the current paragraph (where your cursor is)
        will be targeted.
    * Invoking this command opens the Prompt Palette, allowing you to choose
        from enabled default and custom prompts.
2. **`Text Transformer: Transform full document`**: Applies the chosen prompt to
    the entire content of the current note.
    * *Use with caution for very long documents, as AI quality can sometimes
        degrade with extremely large inputs, and token costs will be higher.*

### Managing Suggestions

Once suggestions are inserted:

* **`Text Transformer: Accept next suggestion`**: Accepts the first AI
    suggestion found after your cursor.
* **`Text Transformer: Reject next suggestion`**: Rejects the first AI
    suggestion found after your cursor.
* **`Text Transformer: Accept suggestions in selection/paragraph`**: Accepts
    all AI suggestions within the current text selection (or the current
    paragraph if nothing is selected).
* **`Text Transformer: Reject suggestions in selection/paragraph`**: Rejects
    all AI suggestions within the current text selection (or current
    paragraph).
* **`Text Transformer: Clear all active suggestions (reject all)`**: Rejects
    all active suggestions in the current document and clears their visual markings.

### Using the AI Context Control Panel

The AI Context Control Panel allows you to manage what contextual information is
sent to the AI with your text.

**How to Open the Panel:**

The AI Context Control Panel is an `ItemView` that typically opens in one of your
Obsidian sidebars. Here’s how to access it:

1. **Plugin Enable State:** Make sure the Text Transformer plugin is enabled in
    `Settings` -> `Community plugins`. The icon and panel will only be
    available if the plugin is active.
2. **Command Palette:** Search in the command palette (usually `Ctrl/Cmd+P`)
    for the command `"Text Transformer: Open AI Context Control Panel"`.

Once the panel is open, you can drag its icon to reorder is, or
drag the panel itself to different parts of your workspace (e.e., left
sidebar, right sidebar, or even as a new tab in the main workspace).

**Panel Options:**

Once open, you can use the toggles for:

* **Dynamic Context:** Toggle on to automatically include a configurable number
    of lines (paragraphs) surrounding your selection/current paragraph as
    context for the AI. Adjust the line count in the plugin settings
    (`Settings → Text Transformer → Dynamic context lines`).
* **Entire Note as Context:** Toggle on to send the entire content of the
    current note as context.
* **Custom Context:** Toggle on and paste any specific text into the provided
    text area to use as context. This overrides Dynamic and Entire Note context
    if active.

## Customizing Prompts

Tailor Text Transformer to your exact needs:

* **Add Custom Prompts:** In plugin settings
    (`Settings → Text Transformer → Prompt Management`), click
    "Add Custom Prompt". Give your prompt a name and provide the instructional
    text for the AI.
* **Manage Prompts:** Enable or disable any default or custom prompt using the
    toggles in the settings.
* **Edit/Delete Custom Prompts:** Use the pencil and trash icons next to your
    custom prompts.
* **Advanced - Modify Default Prompts:** If you need to alter the behavior of
    default prompts, you can find them in
    `[YourVault]/.obsidian/plugins/text-transformer/data.json`. Edit this file
    directly (be cautious!) and reload Obsidian for changes to take effect.
    It's often safer to create a new custom prompt based on a default one.

## Legacy Text Trasnformer

Prior to v1.3.0, Text Transformer used `==highlighted==` additions and `~~struck-through~~` deletions, using the regex based mechanics of Proofreader.

> [!NOTE]
> If you prefer the previous suggestion system, as it allows to use `==highlight==` and `~~strikethrough~~` in other markdown based applications, the last version to use this was **v1.2.2**. You can find it on the [releases page](https://github.com/samwega/obsidian-text-transformer/releases/tag/v1.2.2).

## Plugin Development

```bash
just init   # run once after cloning

just format # run all formatters
just build  # builds the plugin
just check  # runs the pre-commit hook (without committing)
```

> [!NOTE]
> This repository uses a pre-commit hook, which prevents commits that do not
> build or do not pass the required checks.

## About the Developer

Coming soon!
