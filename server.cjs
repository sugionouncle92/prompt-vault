var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "25mb" }));
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  };
  app.get(["/sw.js", "/sw"], (req, res, next) => {
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    next();
  });
  app.get(["/manifest.webmanifest", "/manifest.json"], (req, res, next) => {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    next();
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", appName: "PromptVault" });
  });
  app.post("/api/gemini/optimize", async (req, res) => {
    try {
      const { promptText, targetAI, goal } = req.body;
      if (!promptText || typeof promptText !== "string") {
        return res.status(400).json({ error: "promptText required" });
      }
      const ai = getGeminiClient();
      if (!ai) {
        const varsMatch = promptText.match(/(\[[^\]]+\]|\{[^\}]+\}|\{\{[^\}]+\}\})/g) || [];
        const uniqueVars = Array.from(new Set(varsMatch.map((v) => v.replace(/[\{\}\[\]]/g, ""))));
        return res.json({
          optimizedPrompt: `Act as an expert AI prompt engineer specializing in ${targetAI || "ChatGPT/AI"}.

Context & Role:
${goal ? `Goal: ${goal}
` : ""}You will execute the following instructions precisely with step-by-step reasoning.

Task:
${promptText}

Constraints:
1. Maintain absolute accuracy and follow structure.
2. Output response clearly with headings and actionable sections.
3. Avoid vague fluff.`,
          title: promptText.split("\n")[0].slice(0, 40) || "Optimized Prompt",
          category: "General",
          tags: ["optimized", targetAI ? targetAI.toLowerCase() : "ai"],
          variables: uniqueVars
        });
      }
      const systemInstruction = `You are a world-class Prompt Engineer. Analyze and refine the provided prompt. 
Format response strictly as JSON with the following keys:
- optimizedPrompt (string): Clear, structured, highly effective prompt with context, instructions, role, constraints, and dynamic placeholders like [variable_name].
- title (string): Short descriptive title (3-6 words)
- category (string): Best category (e.g. "Coding & Tech", "Design & Art", "Marketing & Copywriting", "Content & Writing", "Productivity")
- tags (array of strings): 3-5 relevant tags
- variables (array of strings): list of dynamic variables used in the prompt (e.g. ["topic", "audience"])`;
      const userMessage = `Target AI Model: ${targetAI || "General AI"}
User Goal: ${goal || "Optimize prompt for best quality result"}
Original Prompt:
${promptText}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: userMessage,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });
      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch (err) {
      console.error("Optimize prompt error:", err);
      const promptText = req.body.promptText || "";
      return res.json({
        optimizedPrompt: `Role: Expert AI Specialist

Task:
${promptText}

Instructions:
Provide structured, step-by-step output with rationale and key metrics.`,
        title: "Optimized Prompt",
        category: "General",
        tags: ["ai-enhanced"],
        variables: []
      });
    }
  });
  app.post("/api/gemini/test-prompt", async (req, res) => {
    try {
      const { promptText, variables } = req.body;
      if (!promptText) {
        return res.status(400).json({ error: "promptText required" });
      }
      let renderedPrompt = promptText;
      if (variables && typeof variables === "object") {
        Object.entries(variables).forEach(([key, val]) => {
          const strVal = String(val);
          renderedPrompt = renderedPrompt.replace(new RegExp(`\\[${key}\\]`, "gi"), strVal).replace(new RegExp(`\\{${key}\\}`, "gi"), strVal).replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), strVal);
        });
      }
      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          renderedPrompt,
          output: `[SIMULATED GEMINI AI OUTPUT]

Executed prompt:
"${renderedPrompt}"

Result:
This is a simulated AI response preview. (Configure your GEMINI_API_KEY in Secrets for real live Gemini executions!).`
        });
      }
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: renderedPrompt
      });
      return res.json({
        renderedPrompt,
        output: response.text || "No output returned."
      });
    } catch (err) {
      console.error("Test prompt error:", err);
      return res.status(500).json({ error: err.message || "Failed to test prompt" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PromptVault server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
