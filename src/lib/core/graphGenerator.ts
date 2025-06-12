// src/lib/core/graphGenerator.ts
import {
	SimulationNodeDatum,
	forceCenter,
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
} from "d3-force";
import { App, Editor, Notice, normalizePath } from "obsidian";
import { geminiRequest } from "../../llm/gemini";
import { openAiRequest } from "../../llm/openai";
import { openRouterRequest } from "../../llm/openrouter";
import type TextTransformer from "../../main";
import { SingleInputModal } from "../../ui/modals/single-input-modal";

import { buildGraphPrompt } from "../../llm/prompt-builder";
import type { GraphCanvasMetadata, LlmKnowledgeGraph } from "../graph/types";
import { GEMINI_MODELS, MODEL_SPECS } from "../settings-data";
import { formatDateForFilename, getCmEditorView, logError } from "../utils"; // MODIFIED: Import formatDateForFilename
import { gatherContextForAI } from "./textTransformer";

const CANVAS_NODE_WIDTH = 400;
const CANVAS_NODE_PADDING = 30; // Internal padding of a canvas node
const D3_SIMULATION_TICKS = 300;
const CANVAS_COLLISION_PADDING = 50;
const INITIAL_SPREAD_FACTOR = 1000;

// Define a new type for nodes that includes layout properties
type LayoutNode = LlmKnowledgeGraph["nodes"][number] & {
	width: number;
	height: number;
	x?: number;
	y?: number;
};

/**
 * Calculates the required height of a node by rendering its text in an off-screen div.
 * @param text The text content of the node.
 * @param width The fixed width of the node.
 * @returns The calculated scrollHeight of the rendered text.
 */
function calculateNodeHeight(text: string, width: number): number {
	const tempDiv = document.createElement("div");

	// Style the div to precisely mimic a canvas node's content area
	tempDiv.style.visibility = "hidden";
	tempDiv.style.position = "absolute";
	tempDiv.style.left = "-9999px"; // Move it far off-screen
	tempDiv.style.width = `${width - CANVAS_NODE_PADDING * 2}px`; // Account for horizontal padding
	tempDiv.style.padding = `${CANVAS_NODE_PADDING}px`;
	tempDiv.style.boxSizing = "content-box"; // Padding is outside the width
	tempDiv.style.wordWrap = "break-word";
	tempDiv.style.whiteSpace = "pre-wrap"; // Respect newlines and spaces

	// Use Obsidian's CSS variables to approximate the font styles
	tempDiv.style.fontFamily = "var(--font-text)";
	tempDiv.style.fontSize = "var(--font-text-size)";
	tempDiv.style.lineHeight = "var(--line-height-normal)";

	// Replace markdown headers with styled divs for more accurate measurement
	const htmlContent = text
		.replace(
			/^## (.*)$/gm,
			'<div style="font-size: var(--h2-size); font-weight: var(--h2-weight); margin-bottom: 0.5em;">$1</div>',
		)
		.replace(/\n\n/g, "<p></p>"); // Simulate paragraph breaks

	tempDiv.innerHTML = htmlContent;

	document.body.appendChild(tempDiv);
	const height = tempDiv.scrollHeight;
	document.body.removeChild(tempDiv);

	return Math.max(height, 60); // Ensure a minimum height
}

/**
 * Prompts the user for a base name for the canvas file using a modal.
 * The default value will be today's date in 'yyyy-mm-dd ' format.
 * @param app The Obsidian App instance.
 * @returns A promise that resolves with the entered name, or null if cancelled.
 */
function promptForBaseName(app: App): Promise<string | null> {
	return new Promise((resolve) => {
		const defaultDateName = `${formatDateForFilename(new Date())} `; // MODIFIED: Use utility function

		new SingleInputModal(
			app,
			"Enter a name for the knowledge graph canvas",
			"My Knowledge Graph", // Placeholder text
			defaultDateName, // Initial value in the input field
			(result) => resolve(result),
			() => resolve(null),
		).open();
	});
}

/**
 * Validates the JSON response from the LLM against the LlmKnowledgeGraph interface.
 * @param data The parsed JSON data.
 * @returns The validated data if successful, otherwise throws an error.
 */
function validateLlmResponse(data: unknown): LlmKnowledgeGraph {
	if (typeof data !== "object" || data === null) {
		throw new Error("LLM response is not a valid object.");
	}

	const graph = data as LlmKnowledgeGraph;

	if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
		throw new Error("LLM response must contain 'nodes' and 'edges' arrays.");
	}

	const nodeIds = new Set<string>();
	for (const node of graph.nodes) {
		if (
			typeof node.id !== "string" ||
			!node.id ||
			typeof node.label !== "string" ||
			!node.label ||
			typeof node.description !== "string"
		) {
			throw new Error("Invalid node structure in LLM response.");
		}
		if (nodeIds.has(node.id)) {
			throw new Error(`Duplicate node ID found: ${node.id}`);
		}
		nodeIds.add(node.id);
	}

	for (const edge of graph.edges) {
		if (
			typeof edge.source !== "string" ||
			!edge.source ||
			typeof edge.target !== "string" ||
			!edge.target ||
			typeof edge.label !== "string"
		) {
			throw new Error("Invalid edge structure in LLM response.");
		}
		if (!nodeIds.has(edge.source)) {
			throw new Error(`Edge source ID '${edge.source}' does not exist in nodes.`);
		}
		if (!nodeIds.has(edge.target)) {
			throw new Error(`Edge target ID '${edge.target}' does not exist in nodes.`);
		}
	}

	return graph;
}

/**
 * Identifies the node(s) with the most connections and assigns a random color.
 * @param edges The list of edges from the graph data.
 * @returns An object containing the set of hub node IDs and the chosen color.
 */
function determineHubNodesAndColor(edges: LlmKnowledgeGraph["edges"]): {
	hubNodeIds: Set<string>;
	hubColor: string | null;
} {
	if (edges.length === 0) {
		return { hubNodeIds: new Set(), hubColor: null };
	}

	const connectionCounts = new Map<string, number>();
	for (const edge of edges) {
		connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
		connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
	}

	let maxConnections = 0;
	for (const count of connectionCounts.values()) {
		if (count > maxConnections) {
			maxConnections = count;
		}
	}

	if (maxConnections === 0) {
		return { hubNodeIds: new Set(), hubColor: null };
	}

	const hubNodeIds = new Set<string>();
	for (const [id, count] of connectionCounts.entries()) {
		if (count === maxConnections) {
			hubNodeIds.add(id);
		}
	}

	// Obsidian's standard canvas color palette (1-6)
	const obsidianPaletteColors = ["1", "2", "3", "4", "5", "6"];
	const hubColor = obsidianPaletteColors[Math.floor(Math.random() * obsidianPaletteColors.length)];

	return { hubNodeIds, hubColor };
}

/**
 * Calculates node positions using d3-force simulation, now aware of node sizes.
 * @param nodesWithDimensions The graph nodes with pre-calculated width and height.
 * @param edges The edges of the graph.
 * @returns The graph nodes with added x and y properties.
 */
function calculateLayout(
	nodesWithDimensions: LayoutNode[],
	edges: LlmKnowledgeGraph["edges"],
): LayoutNode[] {
	// Assign initial random positions for a wider, "pre-expanded" spread
	nodesWithDimensions.forEach((node) => {
		node.x = (Math.random() - 0.5) * INITIAL_SPREAD_FACTOR;
		node.y = (Math.random() - 0.5) * INITIAL_SPREAD_FACTOR;
	});

	const links = edges.map((e) => ({ ...e }));

	const simulation = forceSimulation(nodesWithDimensions)
		.force(
			"link",
			forceLink(links)
				.id((d: SimulationNodeDatum) => (d as LayoutNode).id)
				.distance(350)
				.strength(0.6),
		)
		.force("charge", forceManyBody().strength(-2500))
		.force("center", forceCenter(0, 0).strength(0.05))
		.force(
			"collide",
			forceCollide<LayoutNode>()
				.radius(
					(d) =>
						Math.sqrt((d.width / 2) ** 2 + (d.height / 2) ** 2) + CANVAS_COLLISION_PADDING,
				)
				.strength(1),
		)
		.stop();

	for (let i = 0; i < D3_SIMULATION_TICKS; ++i) {
		simulation.tick();
	}

	return nodesWithDimensions;
}

/**
 * Constructs the Obsidian Canvas JSON string from the layout data.
 * @param nodesWithLayout The nodes with calculated x/y coordinates.
 * @param edges The original edges from the LLM response.
 * @param hubNodeIds A set of node IDs to be colored.
 * @param hubColor The color to apply to hub nodes.
 * @returns A stringified JSON object representing the canvas.
 */
function constructCanvasJson(
	nodesWithLayout: LayoutNode[],
	edges: LlmKnowledgeGraph["edges"],
	hubNodeIds: Set<string>,
	hubColor: string | null,
): string {
	const nodeMap = new Map(nodesWithLayout.map((node) => [node.id, node]));

	const canvasNodes = nodesWithLayout.map((node) => {
		const canvasNode: {
			id: string;
			x: number;
			y: number;
			width: number;
			height: number;
			type: "text";
			text: string;
			color?: string;
		} = {
			id: node.id,
			x: node.x ?? 0,
			y: node.y ?? 0,
			width: node.width,
			height: node.height,
			type: "text",
			text: `## ${node.label}\n\n${node.description}`,
		};

		if (hubColor && hubNodeIds.has(node.id)) {
			canvasNode.color = hubColor;
		}

		return canvasNode;
	});

	const canvasEdges = edges.map((edge, index) => {
		const sourceNode = nodeMap.get(edge.source);
		const targetNode = nodeMap.get(edge.target);

		let fromSide: "top" | "bottom" | "left" | "right" = "bottom";
		let toSide: "top" | "bottom" | "left" | "right" = "top";

		if (sourceNode && targetNode) {
			const dx = (targetNode.x ?? 0) - (sourceNode.x ?? 0);
			const dy = (targetNode.y ?? 0) - (sourceNode.y ?? 0);

			if (Math.abs(dx) > Math.abs(dy)) {
				// More horizontal than vertical
				if (dx > 0) {
					fromSide = "right";
					toSide = "left";
				} else {
					fromSide = "left";
					toSide = "right";
				}
			} else if (dy > 0) {
				// More vertical than horizontal
				fromSide = "bottom";
				toSide = "top";
			} else {
				fromSide = "top";
				toSide = "bottom";
			}
		}

		return {
			id: `edge_${index}_${Date.now()}`,
			fromNode: edge.source,
			fromSide,
			toNode: edge.target,
			toSide,
			label: edge.label,
		};
	});

	return JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }, null, 2);
}

/**
 * Generates a unique filename for the canvas.
 * The input `baseName` is expected to potentially start with the date.
 * @param baseName The user-provided base name (e.g., "2024-07-30 My Graph").
 * @returns A unique filename string (e.g., "2024-07-30-My-Graph--123456.canvas").
 */
function generateUniqueFilename(baseName: string): string {
	// Sanitize the baseName: remove illegal characters and replace spaces with hyphens.
	// Trim leading/trailing spaces from the baseName to handle the default 'yyyy-mm-dd ' correctly.
	const sanitizedName = baseName
		.trim()
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.replace(/\s+/g, "-");
	const uniqueId = Date.now().toString().slice(-6); // Last 6 digits of timestamp for uniqueness

	// The date prefix is now part of the baseName if the user kept the default.
	// Only append the unique identifier.
	return `${sanitizedName}--${uniqueId}.canvas`;
}

/**
 * Main orchestrator function to generate and create a knowledge graph canvas.
 * @param plugin The main plugin instance.
 * @param editor The active editor instance.
 */
export async function generateGraphAndCreateCanvas(
	plugin: TextTransformer,
	editor: Editor,
): Promise<void> {
	const { app, settings, manifest } = plugin;
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("WordSmith requires a modern editor version.");
		return;
	}

	const baseName = await promptForBaseName(app);
	if (!baseName) {
		new Notice("Canvas generation cancelled.");
		return;
	}

	const notice = new Notice("Gathering context and preparing graph data...", 0);

	// 1. Gather Context & Build Prompt
	const gatheredContext = await gatherContextForAI(plugin, cm, "generation");
	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Graph Generation: Gathered Context", gatheredContext);
	}

	const promptComponents = buildGraphPrompt(gatheredContext);
	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Graph Generation: Prompt Components", promptComponents);
	}

	const adHocPrompt: (typeof plugin.settings.prompts)[number] = {
		id: "graph-generation",
		name: "Graph Generation",
		text: promptComponents.userContent,
		isDefault: false,
		enabled: true,
	};

	// 2. Execute LLM Request
	let response: { newText: string; isOverlength: boolean; cost: number } | undefined;
	try {
		let modelProvider: "openrouter" | "gemini" | "openai";
		if (MODEL_SPECS[settings.model].apiId.includes("/")) {
			modelProvider = "openrouter";
		} else if ((GEMINI_MODELS as readonly string[]).includes(settings.model)) {
			modelProvider = "gemini";
		} else {
			modelProvider = "openai";
		}

		if (modelProvider === "openrouter") {
			response = await openRouterRequest(
				plugin,
				settings,
				"",
				adHocPrompt,
				gatheredContext,
				true,
			);
		} else if (modelProvider === "gemini") {
			response = await geminiRequest(plugin, settings, "", adHocPrompt, gatheredContext, true);
		} else {
			response = await openAiRequest(plugin, settings, "", adHocPrompt, gatheredContext, true);
		}
	} catch (error) {
		notice.hide();
		logError(error);
		return;
	}

	if (!response?.newText) {
		notice.hide();
		new Notice("AI did not return any data for the graph.", 6000);
		return;
	}

	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Graph Generation: Raw LLM Response Text", response.newText);
	}

	// 3. Parse, Validate, and Layout
	let validatedGraph: LlmKnowledgeGraph;
	let nodesWithLayout: LayoutNode[];
	try {
		notice.setMessage("Parsing and validating graph data...");

		// Sanitize the LLM response by extracting the JSON block if it's wrapped in markdown
		const rawResponseText = response.newText.trim();
		const jsonRegex = /```json\n([\s\S]*?)\n```/; // Matches a JSON block wrapped in ```json
		const match = rawResponseText.match(jsonRegex);
		// If there's a match, use the captured group; otherwise, use the raw text.
		const jsonToParse = match ? match[1] : rawResponseText;

		const parsedJson = JSON.parse(jsonToParse);
		validatedGraph = validateLlmResponse(parsedJson);

		if (plugin.runtimeDebugMode) {
			console.debug(
				"[WordSmith plugin] Graph Generation: Validated Graph Object",
				validatedGraph,
			);
		}

		notice.setMessage("Measuring text and preparing nodes...");
		const nodesWithDimensions: LayoutNode[] = validatedGraph.nodes.map((node) => {
			const nodeText = `## ${node.label}\n\n${node.description}`;
			return {
				...node,
				width: CANVAS_NODE_WIDTH,
				height: calculateNodeHeight(nodeText, CANVAS_NODE_WIDTH),
			};
		});

		notice.setMessage("Calculating graph layout...");
		nodesWithLayout = calculateLayout(nodesWithDimensions, validatedGraph.edges);
	} catch (error) {
		notice.hide();
		new Notice(
			`Failed to process graph data: ${error instanceof Error ? error.message : "Unknown error"}`,
			8000,
		);
		console.error("WordSmith Graph Generation Error:", error);
		console.error("Invalid LLM Response:", response.newText);
		return;
	}

	// 4. Construct Canvas, Save, and Embed
	notice.setMessage("Saving canvas and embedding link...");
	const { hubNodeIds, hubColor } = determineHubNodesAndColor(validatedGraph.edges);
	const canvasJsonString = constructCanvasJson(
		nodesWithLayout,
		validatedGraph.edges,
		hubNodeIds,
		hubColor,
	);
	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Graph Generation: Final Canvas JSON", canvasJsonString);
	}

	const finalFilename = generateUniqueFilename(baseName);
	const filePath = normalizePath(`${settings.graphAssetPath}/${finalFilename}`);

	try {
		// Ensure the directory exists
		if (!(await app.vault.adapter.exists(settings.graphAssetPath))) {
			await app.vault.createFolder(settings.graphAssetPath);
		}

		const newFile = await app.vault.create(filePath, canvasJsonString);

		const metadata: GraphCanvasMetadata = {
			version: manifest.version,
			createdAt: new Date().toISOString(),
			modelProvider: (() => {
				if (MODEL_SPECS[settings.model].apiId.includes("/")) {
					return "openrouter";
				}
				if ((GEMINI_MODELS as readonly string[]).includes(settings.model)) {
					return "gemini";
				}
				return "openai";
			})(),
			modelId: settings.model,
			contextSnapshot: {
				resolvedWikilinks: gatheredContext.referencedNotesContent
					? ((
							await plugin.getContextPanel()?.getStructuredCustomContext()
						)?.referencedNotes.map((n) => n.sourcePath) ?? [])
					: [],
				customContextText: gatheredContext.customContext ?? null,
			},
		};

		await app.fileManager.processFrontMatter(newFile, (frontmatter) => {
			Object.assign(frontmatter, metadata);
		});

		editor.replaceSelection(`\n![[${newFile.path}]]\n`);
		notice.hide();
		new Notice(`✅ Knowledge graph '${finalFilename}' created and embedded.`, 5000);
	} catch (error) {
		notice.hide();
		logError(error);
		new Notice("Failed to save the canvas file.", 6000);
	}
}
