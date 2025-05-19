# Text Transformer - AI Writing Assistant for Obsidian

**Current Version:** 1.0.0

[NOTE: the README is still in the process of being rewritten from the original,
and may not yet accurately reflect the latest changes.]

A powerful AI writing assistant plugin for Obsidian, transforming selected text
using both Default and Custom prompts. Individual changes can be accepted or
rejected directly in the editor, similar to the suggested changes feature in
word processing apps. Supports GPT 4.1, and Gemini 2.5 models. Fully keyboard driven.

Initially forked from the excellent Obsidian Proofreader by Christopher Grieser,
Text Transformer is now developing to be a feature complete AI writing assistant.
If you are looking for a more focused proofreading tool, please check out the
original [obsidian-proofreader](https://github.com/chrisgrieser/obsidian-proofreader).

<img alt="Showcase" width=70% src="https://github.com/user-attachments/assets/fa77eb97-61b9-4102-b8b2-e7c385868363">

## Table of contents

<!-- toc -->

* [Features](#features)
* [Installation & setup](#installation--setup)
  * [Plugin installation](#plugin-installation)
  * [Get an OpenAI API key](#get-an-openai-api-key)
* [Usage](#usage)
* [Visual appearance of the changes](#visual-appearance-of-the-changes)
* [Testimonials](#testimonials)
* [Plugin development](#plugin-development)
* [About the developer](#about-the-developer)

<!-- tocstop -->

## Features

* Send selected text to the AI and let it transform it. You can review, accept, or
  reject each suggestion individually (using hotkeys), or in batch, making it easy
  to maintain control over your document's content and quality.
* Suggested changes are inserted directly into the text: Additions as `==highlights==`
  and removals as `~~strikethroughs~~`.
* Customizable and feature rich. Create your own custom prompts!
* This process streamlines editing, allowing you to quickly address grammar, style,
  structure, and clarity issues directly within your workflow.
* The inline system is deeply integrated: you simply press the Hotkey to open the
  command palette, where you can issue AI-powered writing commands such as:
  * Improve, Shorten, Lengthen
  * Fix grammar, syntax and punctuation
  * Simplify language
  * Enhance readability
  * Refine Structure
  * Any custom command you've created
  * Translate to any language

> [!NOTE]
> This plugin requires an **OpenAI API key** or **Gemini API key** and incurs costs
> at OpenAI or Google based on usage. Network requests are made when running the
> proofreading command.

Estimated pricing for the [OpenAI models](https://platform.openai.com/docs/models/)
You can track your usage costs [on this page](https://platform.openai.com/usage).

Estimated pricing for the [Gemini models](https://ai.google.dev/gemini-api/docs/pricing)
You can track your usage costs [on this page](https://makersuite.google.com/app/usage).

The plugin developer is not responsible if the actual costs differ.

The following prices are estimates per 1000 tokens or 750 words:
GPT 4.1 - intelligence = 4, speed = 3. Price = $0.01
GPT 4.1 mini - intelligence = 3, speed = 4. Price = $0.002
GPT 4.1 nano - intelligence = 2, speed = 5. Price = $0.0005
Gemini 2.5 Flash - intelligence = 3, speed = 5. Price = $0.0005
Gemini 2.5 Pro - intelligence = 4, speed = thinking. Price = $0.011
Use GPT 4.1 for the best literary results.
Nano and Mini should be sufficient for basic text proofreading.
Gemini 2.5 Flash is very fast and powerful.Gemini 2.5 Pro is a thinking model,
slow and powerful (probably not needed).

## Installation & setup

### Plugin installation

[Install in Obsidian](https://obsidian.md/plugins?id=text-transformer)

### Get an OpenAI API key

1. [Create an OpenAI account](https://auth.openai.com/create-account).
2. Go to [this site](https://platform.openai.com/api-keys), and click `Create
new secret key`.
3. Copy the API key.
4. In Obsidian, go to `Settings → Text Transformer` and paste your API key there.

> [!TIP]
> The usage costs should not be very high, nonetheless you can track them
> [on this page](https://platform.openai.com/usage).

## Usage

1. Use the command `Proofread selection/paragraph`. This will open a dropdown menu
   from which you can select any of the prompts. Select the one you want to be applied
   to the selected text. If there is no selection, the command will check the current
   paragraph.

   * Alternatively, you can also check the whole document with `Proofread full document`.
   However, note that the quality of AI suggestions tends to decrease when
   proofreading too much text at once.
2. The changes are automatically inserted.
3. Accept/reject changes with the `Accept suggestions in selection/paragraph` command.
   Same as the proofreading command, the `accept` and `reject` commands affect the
   current paragraph if there is no selection. Alternatively, you can also only
   accept/reject the next suggestion after your cursor via `Accept next suggestion`.

## Visual appearance of the changes

You can add the following CSS snippet to make highlights and strikethroughs
appear like suggested changes, similar to the screenshot further above. ([How
to add CSS snippets.](https://help.obsidian.md/snippets))

```css
.cm-strikethrough {
	text-decoration: none !important; /* Removes the strikethrough line */
	background-color: var(--color-red) !important;
	border-radius: 3px !important; /* Adds slightly rounded corners */
	/* Optional: change text color for better contrast: */
	color: white !important;
}

.cm-s-obsidian span.cm-highlight {
	background-color: rgba(var(--color-green-rgb), 35%);
	border-radius: 3px !important;
	color: white !important;
}
```

## Testimonials

> I was paying $29 a month for type.ai until today, your plugin made me cancel
> the subscription, because the only feature I wanted from there was this
> granular diffing which no other app offered, until Proofreader.
>
> [@samwega](https://github.com/chrisgrieser/obsidian-proofreader/discussions/1#discussioncomment-12972780)

## Plugin development

```bash
just init   # run once after cloning

just format # run all formatters
just build  # builds the plugin
just check  # runs the pre-commit hook (without committing)
```

> [!NOTE]
> This repo uses a pre-commit hook, which prevents commits that do not build
> or do not pass the checks.

## About the developer

Coming soon!
