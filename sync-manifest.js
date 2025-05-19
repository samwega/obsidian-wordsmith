import fs from "node:fs";
import path from "node:path";

const packageJsonPath = path.resolve(__dirname, "package.json");
const manifestJsonPath = path.resolve(__dirname, "manifest.json");

try {
	// Read package.json
	const packageJsonData = fs.readFileSync(packageJsonPath, "utf8");
	const packageJson = JSON.parse(packageJsonData);

	// Read manifest.json
	const manifestJsonData = fs.readFileSync(manifestJsonPath, "utf8");
	const manifestJson = JSON.parse(manifestJsonData);

	// Update manifest.json fields from package.json
	manifestJson.name = packageJson.name;
	manifestJson.version = packageJson.version;
	manifestJson.author = packageJson.author;
	// You might want to keep the original description if it's more specific to the plugin

	// Write the updated manifest.json back to the file
	fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2), "utf8");
} catch (error) {
	console.error("Error updating manifest.json:", error);
	process.exit(1); // Exit with an error code to indicate failure
}
