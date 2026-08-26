/**
 * Loads .env values without overriding variables that are already set in the
 * system environment. Expo config imports this before reading env vars.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");

  lines.forEach((line) => {
    // Skip comments and empty lines
    if (!line || line.trim().startsWith("#")) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes

      // Only set if not already defined in environment
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Expose the API base URL to the frontend bundle when provided.
if (process.env.API_BASE_URL && !process.env.EXPO_PUBLIC_API_BASE_URL) {
  process.env.EXPO_PUBLIC_API_BASE_URL = process.env.API_BASE_URL;
}
