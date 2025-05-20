# Text Transformer - AI Writing Assistant for Obsidian

**Current Version:** 1.2.1

Transform your writing in Obsidian with Text Transformer, an AI-powered
assistant. **Review and accept/reject AI suggestions inline**, similar to track
changes, directly in your editor. Supports custom prompts, multiple AI
providers (OpenAI GPT & Google Gemini), advanced context control, and is fully
keyboard-driven.

Initially forked from the excellent Obsidian Proofreader by Christopher Grieser,
Text Transformer has evolved into a feature-complete AI writing assistant.
If you're looking for a more focused proofreading tool, please check out the
original [obsidian-proofreader](https://github.com/chrisgrieser/obsidian-proofreader).

<img alt="Showcase" width=70% src="https://github.com/user-attachments/assets/fa77eb97-61b9-4102-b8b2-e7c385868363">
<img alt="Showcase" width=70% src="https://i.imgur.com/3raRn13.png">

## ✨ What's New in v1.2.0 ✨

This version significantly enhances your control over the AI's context and
streamlines prompt management:

*   **Take control of your AI's context with the new Context Control Panel:**
    *   **Dynamic Context:** Automatically include surrounding paragraphs for
        richer, more relevant AI suggestions.
    *   **Entire Note Context:** Utilize the full content of your current note to
        inform the AI.
    *   **Custom Context:** Provide your own specific text snippets through a
        dedicated input area for precise context.
    *   *Note: Dynamic and Entire Note context options are mutually exclusive
        to ensure clarity.*
*   **New Setting - Dynamic Context Lines:** Fine-tune the amount of surrounding
    text (number of paragraphs) used by the Dynamic Context feature.
*   **Prompt Management Update:** Added a helpful note in the settings page
    explaining how to manually edit default prompts by modifying the
    `data.json` file (requires an Obsidian reload after changes).

## Table of contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Release History](#release-history)
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
- [Visual Appearance of Changes](#visual-appearance-of-changes)
- [Plugin Development](#plugin-development)
- [About the Developer](#about-the-developer)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Release History

### ✨ What's New in v1.1.0 ✨

Version 1.1.0 expanded your AI model horizons:

*   **Google Gemini Integration:** Connect your Gemini API key to use Google's
    powerful models (including Gemini 2.5 Flash and Pro) for all text
    transformations. This offers greater flexibility in balancing cost, speed,
    and AI capabilities.
*   **Seamless Model Selection:** The settings panel was updated to easily switch
    between your preferred OpenAI and Gemini models.

### ✨ What's New in v1.0.0 ✨

Version 1.0.0 marked the initial major transformation from the original
Proofreader plugin, introducing core functionalities that define Text
Transformer today:

*   **Introducing the Prompt Palette:** Moved beyond a single proofreading
    instruction to a versatile palette. Users can select from a variety of
    predefined prompts to transform text in multiple ways (e.g., Improve,
    Shorten, Lengthen, Fix Grammar).
*   **Custom Prompts Unleashed:** Empowered users to create and save their own
    unique prompts. This allows for a highly personalized AI writing assistant
    tailored to specific needs and styles.
*   **Foundation for a Multi-Feature AI Assistant:** This version laid the
    groundwork for Text Transformer to become a comprehensive AI writing tool,
    moving beyond basic proofreading to a wider range of text manipulations.

## Features

Text Transformer empowers you to refine your text directly within Obsidian using
a suite of powerful AI capabilities:

*   **Versatile Text Transformations via Prompt Palette:** Improve clarity,
    shorten or lengthen text, fix grammar, simplify language, enhance
    readability, translate, and more. Select from a range of built-in prompts
    or your own creations through an intuitive palette.
*   **Inline Suggestion Review:** AI-generated changes are displayed directly in
    your editor as `==highlights==` (additions) and `~~strikethroughs~~`
    (removals). Accept or reject each change individually or in batches.
*   **Custom Prompts:** Go beyond the defaults! Create and save your own prompts
    tailored to your specific writing needs and workflows.
*   **Advanced AI Context Control:** Precisely control the information sent to
    the AI for more accurate and relevant transformations:
    *   **Dynamic Context:** Automatically include surrounding text from your note.
    *   **Entire Note Context:** Use the full content of your current note.
    *   **Custom Context:** Paste specific text snippets into the AI Context
        Control Panel.
    *   Adjust the scope of Dynamic Context with the "Dynamic context lines"
        setting.
*   **Flexible Prompt Management:** Easily enable/disable default and custom
    prompts. For advanced customization, default prompts can be modified by
    editing the `data.json` file in the plugin's directory (reload Obsidian
    after editing).
*   **Multiple AI Provider Support:** Choose between OpenAI (GPT models) and
    Google (Gemini models) to best suit your needs for quality, speed, and
    cost.
*   **Keyboard-First Workflow:** Designed for efficiency with comprehensive
    hotkey support for all major actions.
*   **Process Entire Documents or Paragraphs:** Apply transformations to
    selected text, the current paragraph, or the entire document.

## How It Works: Inline Suggestions

The core strength of Text Transformer lies in its intuitive inline suggestion
system:

1.  **Invoke AI:** Select text (or place your cursor in a paragraph) and
    trigger a transformation command via hotkey or the command palette.
2.  **Choose Your Prompt:** Select from default or your custom-created prompts
    using the Prompt Palette.
3.  **See Instant Changes:** The AI processes your text, and suggestions appear
    directly in your editor – additions are highlighted (`==like this==`) and
    deletions are struck through (`~~like this~~`).
4.  **You're in Control:** Use dedicated commands (and hotkeys) to accept or
    reject each individual suggestion, or accept/reject all suggestions
    within the current selection/paragraph at once.

This seamless process allows for rapid iteration and refinement of your writing
without ever leaving your Obsidian workspace.

<img alt="Showcase of inline suggestions" width=90% src="https://i.imgur.com/wpFvjlq.png">

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

*   **OpenAI:** ([Track Usage](https://platform.openai.com/usage))
    *   **GPT-4.1:** High intelligence, best for complex literary tasks.
        (Approx. $2 input / $8 output per 1M tokens)
    *   **GPT-4.1-mini:** Good balance of intelligence and speed.
        (Approx. $0.40 input / $1.60 output per 1M tokens)
    *   **GPT-4.1-nano:** Fastest, most cost-effective for basic proofreading.
        (Approx. $0.10 input / $0.40 output per 1M tokens)
*   **Google Gemini:** ([Track Usage](https://makersuite.google.com/app/usage))
    *   **Gemini 2.5 Pro:** High intelligence, thorough (can be slower).
        (Approx. $3.50 input / $10.50 output per 1M tokens)
    *   **Gemini 2.5 Flash:** Very fast and powerful, great all-rounder.
        (Approx. $0.50 input / $1.50 output per 1M tokens)

**General Guidance:**

*   **Intelligence:** Higher intelligence models are generally better for
    creative tasks, nuanced understanding, and complex instructions, but may be
    slower and more expensive.
*   **Speed:** Faster models offer quicker turnaround, ideal for iterative
    editing and proofreading.

Choose the model that best fits your task and budget in the plugin settings.

<img alt="Showcase of model settings" width=90% src="https://i.imgur.com/CP311N9.png">

## Installation & Setup

### Plugin Installation (via Community Store)

Coming soon! We are working on getting Text Transformer added to the official
Obsidian community plugin store.

In the meantime, please use the [Manual Installation](#manual-installation)
method below.

### Manual Installation

For users who prefer to install manually or are using a version not yet in the
community store:

1.  Go to the [Releases page]
    (https://github.com/samwega/obsidian-text-transformer/releases) on GitHub.
2.  Find the latest release and download the `main.js`, `manifest.json`, and
    `styles.css` (if present) files from the "Assets" section.
3.  In your Obsidian vault, navigate to the `.obsidian/plugins/` directory.
4.  Create a new folder named `text-transformer`.
5.  Copy the downloaded `main.js`, `manifest.json`, and `styles.css` files into
    this new `text-transformer` folder.
6.  Reload Obsidian (e.g., close and reopen the app, or use the "Reload app
    without saving" command).
7.  Go to `Settings` -> `Community plugins`, find "Text Transformer" in your
    list of installed plugins, and enable it.

### API Key Setup

You'll need at least one API key to use Text Transformer.

To get your API key(s):

1.  **OpenAI:** (Optional)
    *   [Create an OpenAI account](https://auth.openai.com/create-account)
        if you don't have one.
    *   Go to your [API keys page](https://platform.openai.com/api-keys).
    *   Click `Create new secret key`, name it (e.g., "Obsidian Text
        Transformer"), and copy the key.

2.  **Google Gemini:** (Optional)
    *   Ensure you have a Google account and visit
        [Google AI Studio](https://aistudio.google.com).
    *   Navigate to the [API key page](https://aistudio.google.com/app/apikey)
        (you might need to create a project first).
    *   Click `Create API key in new project` or `Create API key` in an
        existing project. Copy the key.

3.  In Obsidian, go to `Settings → Text Transformer` and paste your copied
    API key(s) into the respective "OpenAI API Key" and/or "Gemini API Key"
    fields.

> [!TIP]
> It's wise to monitor your API usage to avoid unexpected costs. Links to
> usage dashboards are provided in the
> [AI Providers & Models](#ai-providers--models) section.

## Usage

Text Transformer is designed for a keyboard-centric workflow. Configure your
preferred hotkeys in Obsidian's settings for the commands below.

<img alt="Showcase of recommended hotkeys" width=70% src="https://i.imgur.com/UvprMpv.png">

### Core Commands

1.  **`Text Transformer: Transform selection/paragraph`**: This is your main
    command.
    *   If you have text selected, it will be used for transformation.
    *   If no text is selected, the current paragraph (where your cursor is)
        will be targeted.
    *   Invoking this command opens the Prompt Palette, allowing you to choose
        from enabled default and custom prompts.
2.  **`Text Transformer: Transform full document`**: Applies the chosen prompt to
    the entire content of the current note.
    *   *Use with caution for very long documents, as AI quality can sometimes
        degrade with extremely large inputs, and token costs will be higher.*

### Managing Suggestions

Once suggestions are inserted:

*   **`Text Transformer: Accept next suggestion`**: Accepts the first AI
    suggestion found after your cursor.
*   **`Text Transformer: Reject next suggestion`**: Rejects the first AI
    suggestion found after your cursor.
*   **`Text Transformer: Accept suggestions in selection/paragraph`**: Accepts
    all AI suggestions within the current text selection (or the current
    paragraph if nothing is selected).
*   **`Text Transformer: Reject suggestions in selection/paragraph`**: Rejects
    all AI suggestions within the current text selection (or current
    paragraph).

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
*   **Dynamic Context:** Toggle on to automatically include a configurable number
    of lines (paragraphs) surrounding your selection/current paragraph as
    context for the AI. Adjust the line count in the plugin settings
    (`Settings → Text Transformer → Dynamic context lines`).
*   **Entire Note as Context:** Toggle on to send the entire content of the
    current note as context.
*   **Custom Context:** Toggle on and paste any specific text into the provided
    text area to use as context. This overrides Dynamic and Entire Note context
    if active.

## Customizing Prompts

Tailor Text Transformer to your exact needs:

*   **Add Custom Prompts:** In plugin settings
    (`Settings → Text Transformer → Prompt Management`), click
    "Add Custom Prompt". Give your prompt a name and provide the instructional
    text for the AI.
*   **Manage Prompts:** Enable or disable any default or custom prompt using the
    toggles in the settings.
*   **Edit/Delete Custom Prompts:** Use the pencil and trash icons next to your
    custom prompts.
*   **Advanced - Modify Default Prompts:** If you need to alter the behavior of
    default prompts, you can find them in
    `[YourVault]/.obsidian/plugins/text-transformer/data.json`. Edit this file
    directly (be cautious!) and reload Obsidian for changes to take effect.
    It's often safer to create a new custom prompt based on a default one.

## Visual Appearance of Changes

To make the `==highlighted==` additions and `~~struck-through~~` deletions more
visually distinct (like traditional track changes), you can add the following
CSS snippet to your Obsidian vault. (Learn
[How to add CSS snippets](https://help.obsidian.md/How+to/Add+custom+styles#CSS+snippets)).

```css
.cm-strikethrough {
	text-decoration: none !important; /* Removes default strikethrough */
	background-color: var(--color-red-translucent) !important;
	border-radius: 3px !important;
	/* color: white !important; */ /* Optional: contrast text color */
}

.cm-s-obsidian span.cm-highlight,
.markdown-rendered mark {
	background-color: var(--color-green-translucent) !important;
	border-radius: 3px !important;
	/* color: white !important; */ /* Optional: contrast text color */
}
```
*(Note: I've updated the CSS to use translucent theme colors which often look
better, and added `.markdown-rendered mark` for consistency in reading view,
but users can customize colors as they like).*

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
