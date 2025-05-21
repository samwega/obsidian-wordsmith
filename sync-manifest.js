import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, "package.json");
const manifestJsonPath = path.resolve(__dirname, "manifest.json");

try {
	// Read package.json
	const packageJsonData = fs.readFileSync(packageJsonPath, "utf8");
	const packageJson = JSON.parse(packageJsonData);

	// Read manifest.json
	const manifestJsonData = fs.readFileSync(manifestJsonPath, "utf8");
	const manifestJson = JSON.parse(manifestJsonData);

	// Update manifest.json fields
	manifestJson.name = packageJson.name;
	manifestJson.version = packageJson.version;
	manifestJson.author = packageJson.author;
	manifestJson.description = packageJson.description;
	manifestJson.authorUrl = "https://github.com/samwega";
	manifestJson.helpUrl = "https://github.com/samwega/obsidian-text-transformer#readme";
	if (manifestJson.fundingUrl) {
		delete manifestJson.fundingUrl;
	}

	// Write the updated manifest.json back to the file
	fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2), "utf8");
    console.log("manifest.json updated successfully!");
} catch (error) {
	console.error("Error updating manifest.json:", error);
	process.exit(1);
}