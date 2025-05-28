# WordSmith - AI Writing Assistant for Obsidian

**Current Version:** v1.8.0

WordSmith is the ultimate AI-powered writing assistant for Obsidian—your all-in-one tool for seamless editing, contextual content generation, and effortless refinement, right inside your notes. It excels at **stylistic improvements**, **proofreading**, **translation**, and **prompt-based generation**—all *context-aware*!

**Review and accept or reject individual AI suggestions inline** directly in your editor. Create custom prompts, leverage multiple AI providers (OpenAI GPT & Google Gemini), and benefit from advanced context control—all fully keyboard-driven. WordSmith is free forever! Use your own API keys and only spend how much you use, plus a [coffee for me](https://revolut.me/alexanderglavan) if you love my first plugin!

Initially forked from the excellent and much more focused [obsidian-proofreader](https://github.com/chrisgrieser/obsidian-proofreader) by Christopher Grieser, WordSmith has evolved into a feature-complete AI writing assistant.

![WordSmith suggestions in action](https://github.com/user-attachments/assets/55831bae-bc4b-4a4a-9448-cf1bc1fb5787)

![WordSmith shorten prompt](https://github.com/user-attachments/assets/0ad1de0f-0d62-4710-9afd-26c1d8ba38a5)


## Features

* **Inline AI suggestions**: additions/deletions rendered via CodeMirror decorations, individual accept/reject workflow  
* **Custom & Default Prompt Palette** for text transformation (improve, shorten, lengthen, fix grammar, refine structure, translate, and many more, or user defined ones
* **All Processing and Generation is Context-Aware**—the AI doesn't just receive the selected text to be processed or the prompt: you include as much (or as little) context as you wish  
* **Context control in Side Pane:**
  * Dynamic Context (configurable lines before and after)
  * Whole Note
  * Custom Context (including embedded note linking with [[wikilinks]]!)  
* Ad-hoc **Generation at Cursor** with prompt input, also context aware
* **Keyboard-first workflow**: hotkeys for all main actions and suggestion navigation  
* **Granular suggestion management**: per-suggestion, selection/paragraph, or all  
* **BYOK:** Bring your own API key—only pay what you use  
* Multiple AI provider/model support: *OpenAI (GPT-4.1, mini, nano)*, *Google Gemini 2.5 (Pro, Flash)*  
* **Great Prompt Management Settings UI:** enable/disable prompts or create new one
* Robust error handling, performance, and **Theme-Adaptive Styles** (detects dark/light Obsidian theme)
* **Multilingual**—the AI should autodetect the language from Context, selection and/or ad-hoc prompt, and return suggestions in the same language
* Manual and (planned) community plugin installation  
* **Persistent suggestions** across Obsidian reloads

![WordSmith Settings and Context Side Pane](https://github.com/user-attachments/assets/66408578-1130-4b3f-a7b8-ea6bebe18f85)

## Table of contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

* [Usage](#usage)
  * [Commands:](#commands)
  * [Using the AI Context Control Panel](#using-the-ai-context-control-panel)
  * [Customizing Prompts](#customizing-prompts)
  * [API Key Setup](#api-key-setup)
* [AI Providers & Models](#ai-providers--models)
* [Release History](#release-history)
  * [✨ What's New in v1.8.0 * Persistent Suggestions & Enhanced Prompts! ✨](#-whats-new-in-v180---persistent-suggestions--enhanced-prompts-)
  * [✨ What's New in v1.7.0 * Enhanced Custom Context with Smart Note Linking! ✨](#-whats-new-in-v170---enhanced-custom-context-with-smart-note-linking-)
    * [Minor Versions of v.1.7.x](#minor-versions-of-v17x)
  * [✨ What's New in v1.6.0 – Enhanced Suggestion Navigation! ✨](#-whats-new-in-v160--enhanced-suggestion-navigation-)
    * [Minor Versions of v.1.6.x](#minor-versions-of-v16x)
  * [✨ What's New in v1.5.0 * Context Aware Generation at Cursor! ✨](#-whats-new-in-v150---context-aware-generation-at-cursor-)
    * [Key Features of v1.5.0: Prompt Based Context Aware Generation at Cursor](#key-features-of-v150-prompt-based-context-aware-generation-at-cursor)
  * [Minor Versions of v.1.5.x](#minor-versions-of-v15x)
  * [✨ What's New in v1.4.0 * Precision Newline Tracking! ✨](#-whats-new-in-v140---precision-newline-tracking-)
    * [Minor Versions of v.1.4.x](#minor-versions-of-v14x)
  * [✨ What's New in v1.3.0 * Revamped Suggestion Display! ✨](#-whats-new-in-v130---revamped-suggestion-display-)
    * [Minor Versions of v.1.3.x](#minor-versions-of-v13x)
  * [✨ What's New in v1.2.1 & v1.2.2 ✨](#-whats-new-in-v121--v122-)
  * [✨ What's New in v1.2.0 ✨](#-whats-new-in-v120-)
  * [✨ What's New in v1.1.0 ✨](#-whats-new-in-v110-)
  * [✨ What's New in v1.0.0 ✨](#-whats-new-in-v100-)
* [Installation & Setup](#installation--setup)
  * [Plugin Installation (via Community Store)](#plugin-installation-via-community-store)
  * [Manual Installation](#manual-installation)
* [Legacy Text Transformer (closest to Proofreader)](#legacy-text-transformer-closest-to-proofreader)
* [Plugin Development](#plugin-development)
* [About the Developer](#about-the-developer)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Usage

WordSmith is designed for a keyboard-centric workflow. Configure your
preferred hotkeys in Obsidian's settings for the commands below. In the screenshot you can see a workable suggested setup, but feel free to make it your own:

![image](https://github.com/user-attachments/assets/5c88c1d0-75c3-40f0-bf43-7c3de8f100c1)

Check out the [WordSmith Wiki](https://github.com/samwega/obsidian-wordsmith/wiki) for more advanced user guides.

### Commands

1. `WordSmith: Open Al Context Control Panel`: no need to hotkey this, just trigger it once from the drop-down menu to add it to the Side Panel (then move it wherever)
2. `WordSmith: Transform selection/paragraph`: This is your main command.
    * If you have text selected, it will be used for transformation.
    * If no text is selected, the current paragraph (where your cursor is) will be targeted.
    * Invoking this command opens the Prompt Palette, allowing you to choose from enabled default and custom prompts.
3. `WordSmith: Prompt Based Context Aware Generation at Cursor`: set up your context, type a prompt, et voilà! Type `[[` to include any note in your context.
4. `WordSmith Accept/Reject next suggestion`:  whether your next (highlighted) suggestion is red (to be removed) or green (to be added), you can accept or reject it with these commands
5. `WordSmith Accept/Reject in selection/paragraph`: accept/reject the whole paragraph where the cursor currently is
6. `WordSmith: Focus previous/next suggestion`: moves the cursor at the beginning of the next/previous suggestion, highlighting it (brighter, with glowing border)
7. `WordSmith: Clear all active suggestions (reject all)`: reject all the *remaining* suggestions. Note: suggestions that have already been accepted or rejected will not be undone. You can use Ctrl-Z to undo those.

### Using the AI Context Control Panel

The AI Context Control Panel allows you to manage what contextual information is
sent to the AI with your text.

**How to Open the Panel:**

1. **Plugin Enable State:** Make sure the WordSmith plugin is enabled in
    `Settings` -> `Community plugins`. The icon and panel will only be
    available if the plugin is active.
2. **Command Palette:** Search in the command palette (usually `Ctrl/Cmd+P`)
    for the command `"WordSmith: Open AI Context Control Panel"`.

Once the panel is open, you can drag its icon to reorder is, or
drag the panel itself to different parts of your workspace (e.e., left
sidebar, right sidebar, or even as a new tab in the main workspace).

**Panel Options:**

Once open, you can use the toggles for:

* **Dynamic Context:** Toggle on to automatically include a configurable number
    of lines (paragraphs) surrounding your selection/current paragraph as
    context for the AI. Adjust the line count in the plugin settings
    (`Settings → WordSmith → Dynamic context lines`).
* **Entire Note as Context:** Toggle on to send the entire content of the
    current note as context.
* **Custom Context:** Toggle on and paste any specific text into the provided
    text area to use as context. This overrides Dynamic and Entire Note context
    if active.

### Customizing Prompts

Tailor WordSmith to your exact needs:

* **Add Custom Prompts:** In plugin settings
    (`Settings → WordSmith → Prompt Management`), click
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

### API Key Setup

You'll need at least one API key to use WordSmith. To get your API key(s):

1. **OpenAI:** (Optional)
    * [Create an OpenAI account](https://auth.openai.com/create-account)
        if you don't have one.
    * Go to your [API keys page](https://platform.openai.com/api-keys).
    * Click `Create new secret key`, name it (e.g., "Obsidian WordSmith"), and copy the key.

2. **Google Gemini:** (Optional)
    * Ensure you have a Google account and visit
        [Google AI Studio](https://aistudio.google.com).
    * Navigate to the [API key page](https://aistudio.google.com/app/apikey)
        (you might need to create a project first).
    * Click `Create API key in new project` or `Create API key` in an
        existing project. Copy the key.

3. In Obsidian, go to `Settings → WordSmith` and paste your copied
    API key(s) into the respective "OpenAI API Key" and/or "Gemini API Key"
    fields.

> [!TIP]
> It's wise to monitor your API usage to avoid unexpected costs. Links to
> usage dashboards are provided in the
> [AI Providers & Models](#ai-providers--models) section.

## AI Providers & Models

WordSmith supports models from both OpenAI and Google, giving you a choice
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

## Release History

### ✨ What's New in v1.8.0 - Persistent Suggestions & Enhanced Prompts! ✨

This release brings two major improvements to make your AI writing experience more seamless and powerful:

* **Persistent Suggestions Between Reloads:** Your active AI suggestions are now preserved when you reload Obsidian. Previously, if closing the application while suggestions were active, upon returning, you'd see old and new text mixed together and no way to accept/reject or undo it.
* **Expanded Default Prompts:** A fresh set of carefully crafted default prompts has been added to the collection, giving you more options for text transformation right out of the box. The existing prompts have been recrafted for a more precise output.
* **Moved all styling from JavaScript or HTML to styles.css** - it required some pretty major refactoring of the UI.
* **Replaced use of innerHTML (security risk) with safer DOM API**
* Removed a line which was manually **detaching leaves during the unload process** - an antipattern
* **Fixed a ton of bugs** which were created in the refactoring process

**Ready for Prime Time!:** With this update, I'm finally getting ready to have my very first Plugin—WordSmith—added to the official Obsidian community plugin store. 🤞🏻

### ✨ What's New in v1.7.0 - Enhanced Custom Context with Smart Note Linking! ✨

This upgrade streamlines the process of providing the AI with the precise information needed for optimal results. By integrating seamless note linking into the Custom Context feature, WordSmith now leverages your interconnected notes, making context building faster, more intuitive, and more powerful.

**Key Features of v1.7.0:**

* **Smarter Custom Context Input:** Providing custom instructions or reference material to the AI is now more powerful and intuitive.
* **Easy Note Linking with `[[`:** You can now type `[[` in the "Custom" context box of the WordSmith panel to quickly search for and link any note from your vault, seamlessly integrating with your Obsidian workflow.
* **Full Note Content Embedding:** When you link notes (e.g., `[[My Style Guide]]`) in the custom context, WordSmith will now intelligently fetch their **entire content** and include it as part of the context sent to the AI. This means you can easily reference detailed style guides, extensive notes, or specific information without manual copy-pasting!

#### Minor Versions of v.1.7.x

* **v1.7.1**—*Text Transformer* **Rebranded as WordSmith**. Developers, note that most code still refers to TextTransformer.

### ✨ What's New in v1.6.0 – Enhanced Suggestion Navigation! ✨

This release supercharges your suggestion review workflow, making it faster and more intuitive to manage AI-generated edits and new content.

**Key Features of v1.6.0:**

* **Suggestion Navigation Hotkeys:**
  * Effortlessly cycle through all active AI suggestions in your document using new commands:
  * **"WordSmith: Focus next suggestion"** – Move your cursor to the start of the next suggestion, making it instantly active for review.
  * **"WordSmith: Focus previous suggestion"** – Jump back to the previous suggestion with a single keystroke.
* **Improved Cursor Behavior:**
  * Whenever new suggestions are generated—whether from a text transformation or an ad-hoc prompt—the cursor is now automatically positioned at the very first suggestion, immediately highlighting it for action. This streamlines the accept/reject workflow and eliminates manual cursor adjustment.
* **Refined Keyboard-First Editing:**
  * Combined with dynamic active suggestion highlighting (from v1.5.1), these navigation enhancements make it easier than ever to see, select, and act on the exact change you want—all without leaving the keyboard.
* **Under-the-Hood Improvements:**
  * Removed the legacy toggles in Settings to ask the AI not to modify text in quotation marks ("") and citations (lines starting with >). They were not working at all and required a much more involved implementation. Will add the feature in a future release if people ask for it.
  * Minor performance and stability tweaks for smoother suggestion handling.

**Why this matters:**

WordSmith now offers one of the fastest and most ergonomic AI suggestion review experiences in Obsidian—keeping you firmly in your creative flow.

#### Minor Versions of v.1.6.x

* **v1.6.2**—**Granular Suggestions for Multi-line Generation**: Text generated at the cursor that spans multiple lines is now intelligently split into individual suggestion segments (per line and per newline), allowing for more precise review and control.
* **v1.6.3**—**UI & Workflow Refinements**:
  * **Context Panel**: "Dynamic context lines" input now lives in the AI Context Control side panel, only showing when "Dynamic context" is on.
  * **Removed Legacy Full Document Transform**: This command was adding unnecessary complexity. You may simply Ctrl-A and Transform Selection.
* **v1.6.4**—**Minimalistic Context Control Side Panel**: All the explanations are now tucked away in a collapsible menu. The menu is as minimal as possible, allowing you to make it narrow and gain space. It is more aesthetically pleasing as well.

### ✨ What's New in v1.5.0 - Context Aware Generation at Cursor! ✨

This major release introduces a powerful new way to interact with AI: **Ad-hoc Contextual Generation directly at your cursor, presented as a suggestion.** Go beyond processing existing text – now you can generate new content, ideas, or continuations seamlessly within your writing flow.

#### Key Features of v1.5.0: Prompt Based Context Aware Generation at Cursor

* **New Command: "Generate text with ad-hoc prompt (as suggestion)"**
  * Trigger this editor command (via hotkey or command palette) to open the new "Context Aware Generator" modal.
  * Type your specific instruction (e.g., "brainstorm ideas for X," "write an intro paragraph about Y," "explain Z simply") into the modal.
* **Contextual Awareness for Generation:**
  * Leverages the settings in your **AI Context Control Panel** (Custom, Dynamic, or Entire Note).
  * When Dynamic or Entire Note context is active, a special marker (`<<<GENERATION_TARGET_CURSOR_POSITION>>>`) is inserted at your precise cursor location within the context sent to the AI. This tells the AI *exactly* where you intend the new text to be generated.
  * The AI uses this context and marker to produce more relevant and precisely placed generated content.
* **Seamless Suggestion Workflow:**
  * The AI-generated text is inserted directly at your cursor position as a single "added" suggestion.
  * You can then accept or reject this generated block just like any other WordSmith suggestion.
  * The cursor automatically moves to the end of the inserted text.
* **Modal Enhancements:**
  * The "Context Aware Generator" modal automatically focuses the prompt input area.
  * A notice appears if you try to submit an empty prompt.
* **Streamlined Suggestion Navigation:**
  * When using "Accept/Reject Next Suggestion," if there's only **one** suggestion in the entire document, it's now resolved immediately without requiring a second key press (the "scroll and press again" step is skipped).
  * For multiple suggestions, the two-step navigation (scroll to suggestion, then press again to act) remains, ensuring you can clearly target specific suggestions.

**Why this is a game-changer:**

![WordSmith - Context Side Panel](https://github.com/user-attachments/assets/13481397-c314-4afe-8c36-cbdd2d68228d)

This feature transforms WordSmith from primarily an editing/refinement tool into a versatile writing partner capable of both **transforming existing text and generating new content with contextual understanding, all within the familiar suggestion-based workflow.** Whether you're stuck, need a creative boost, or want to quickly draft a section, the Context Aware Generator is ready to assist.

### Minor Versions of v.1.5.x

![image](https://github.com/user-attachments/assets/0c2dd6f5-7529-4d08-8fef-5867de130d3d)

* **v1.5.1**—**Dynamic Active Suggestion Highlighting:** Implemented strong visual cues – the suggestion targeted by your cursor (when placed at its beginning) now stands out with significantly increased contrast and a glowing outline, making it unmistakably clear which suggestion you're about to accept or reject.

![image](https://github.com/user-attachments/assets/88076b79-a060-402a-a4cd-61f5ef35adcf)

### ✨ What's New in v1.4.0 - Precision Newline Tracking! ✨

This update brings a crucial enhancement to how WordSmith handles changes involving **newlines**, making suggestions more accurate and intuitive, especially for structural edits and reformatting.

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
  * **No More Markdown Markers:** WordSmith **no longer uses** `==highlight==` for additions or `~~strikethrough~~` for removals in the actual document text.
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
  * **Dynamic Context:** Automatically include surrounding paragraphs for richer, more relevant AI suggestions.
  * **Entire Note Context:** Utilize the full content of your current note to inform the AI.
  * **Custom Context:** Provide your own specific text snippets through a dedicated input area for precise context.
  * *Note: Dynamic and Entire Note context options are mutually exclusive to ensure clarity.*
* **New Setting - Dynamic Context Lines:** Fine-tune the amount of surrounding text (number of paragraphs) used by the Dynamic Context feature.
* **Prompt Management Update:** Added a helpful note in the settings page explaining how to manually edit default prompts by modifying the `data.json` file (requires an Obsidian reload after changes).

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
Proofreader plugin, introducing core functionalities that define WordSmith today:

* **Introducing the Prompt Palette:** Moved beyond a single proofreading
    instruction to a versatile palette. Users can select from a variety of
    predefined prompts to transform text in multiple ways (e.g., Improve,
    Shorten, Lengthen, Fix Grammar).
* **Custom Prompts Unleashed:** Empowered users to create and save their own
    unique prompts. This allows for a highly personalized AI writing assistant
    tailored to specific needs and styles.
* **Foundation for a Multi-Feature AI Assistant:** This version laid the
    groundwork for WordSmith to become a comprehensive AI writing tool,
    moving beyond basic proofreading to a wider range of text manipulations.

![Showcase of inline suggestions](https://i.imgur.com/q8vaqr8.png))

## Installation & Setup

### Plugin Installation (via Community Store)

Coming soon! We are working on getting WordSmith added to the official
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
7. Go to `Settings` -> `Community plugins`, find "WordSmith" in your
    list of installed plugins, and enable it.

## Legacy Text Transformer (closest to Proofreader)

Prior to v1.3.0, WordSmith used `==highlighted==` additions and `~~struck-through~~` deletions, using the regex based mechanics of Proofreader.

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
