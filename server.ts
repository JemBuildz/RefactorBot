import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Interfaces
interface LogItem {
  agentName: string;
  action: string;
  timestamp: string;
  status: 'info' | 'success' | 'warning' | 'error';
  content?: string;
  metadata?: any;
}

// Robust JSON clean parsing helper
function cleanAndParseJSON(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Attempt markdown block extraction
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        // Continue to other cleaning
      }
    }
    
    // Strip anything before the first '{' and after the last '}'
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidates = trimmed.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidates);
      } catch (e3) {
        // Continue
      }
    }
    
    throw new Error("Unable to parse agent response as valid JSON structure.");
  }
}

// Call local/global Gemini utilizing SDK
async function callGemini(systemPrompt: string, userPrompt: string, model: string = "gemini-3.5-flash") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY on the server. Please add your secret under Settings > Secrets.");
  }
  
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const response = await ai.models.generateContent({
    model: model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.2,
    }
  });

  return response.text || "";
}

// Call Alibaba Qwen API using fetch with user key or environment key
async function callQwen(systemPrompt: string, userPrompt: string, model: string = "qwen-plus", customKey?: string) {
  const apiKey = customKey || process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error("Missing QWEN_API_KEY. Please provide one in the UI or add to the environment.");
  }

  const endpoint = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      input: {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      },
      parameters: {
        result_format: "message"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Qwen API returned error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.output.choices[0].message.content || "";
}

// Generic routing call to either Gemini or Qwen
async function queryLLM(
  systemPrompt: string, 
  userPrompt: string, 
  provider: "gemini" | "qwen", 
  modelName: string, 
  qwenKey?: string
): Promise<string> {
  if (provider === "qwen") {
    return await callQwen(systemPrompt, userPrompt, modelName, qwenKey);
  } else {
    return await callGemini(systemPrompt, userPrompt, modelName);
  }
}

// Server API endpoints
app.post("/api/refactor", async (req, res) => {
  const { 
    legacyCode, 
    targetFramework, 
    provider = "gemini", 
    modelName = "gemini-3.5-flash",
    qwenApiKey
  } = req.body;

  if (!legacyCode || !targetFramework) {
    return res.status(400).json({ error: "Missing legacyCode or targetFramework in request query parameters." });
  }

  const stepHistory: LogItem[] = [];
  const logStep = (agentName: string, action: string, status: 'info' | 'success' | 'warning' | 'error', content?: string, metadata?: any) => {
    const item: LogItem = {
      agentName,
      action,
      timestamp: new Date().toLocaleTimeString(),
      status,
      content,
      metadata
    };
    stepHistory.push(item);
    console.log(`[${item.timestamp}] [${agentName}] ${action}`);
  };

  try {
    logStep("System", "Starting RefactorBot Agent Society Workspace...", "info");
    logStep("System", `Target Framework selected: ${targetFramework}. Provider: ${provider}, model: ${modelName}.`, "info");

    const activeProvider = provider === "qwen" ? "qwen" : "gemini";
    const activeModel = modelName;

    // --- AGENT 1: PARSER ---
    logStep("Parser", "Analyzing legacy code structures (variables, imports, flows)...", "info");
    const parserSystem = `You are a Senior Code Parser. Your duty is to read legacy code logic and return a structured analysis of its components.
Extract:
1. Functions (with parameters and descriptions)
2. Classes and their methods
3. Import statements or required modules
4. Key business logic flows, formulas, constraints, and exceptions
5. Key database objects or API routes referenced

You MUST return a perfectly styled valid JSON object adhering EXACTLY to this JSON format:
{
  "imports": ["string"],
  "classes": [{"name": "string", "methods": ["string"]}],
  "functions": [{"name": "string", "parameters": ["string"], "description": "string"}],
  "businessLogic": "string detailed explanation",
  "dependencies": ["string"]
}
Return only JSON. Do not write markdown tags outside, do not write explanations.`;

    const parserResponse = await queryLLM(parserSystem, `Parse this code:\n\n${legacyCode}`, activeProvider, activeModel, qwenApiKey);
    let parsedJson: any = {};
    try {
      parsedJson = cleanAndParseJSON(parserResponse);
      logStep("Parser", "Successfully parsed code components and business logic rules.", "success", JSON.stringify(parsedJson, null, 2), parsedJson);
    } catch (parseErr: any) {
      logStep("Parser", "JSON clean parsing failed. Attempting fuzzy extraction...", "warning", parserResponse);
      parsedJson = { rawResponse: parserResponse, businessLogic: "Extracted structure raw." };
    }

    // --- AGENT 2: ARCHITECT ---
    logStep("Architect", "Designing targeted framework architecture & models...", "info");
    const architectSystem = `You are an expert Software Architect. Your job is to design the architectural structure, file directories, data models, routes/controllers, and packaging dependencies for converting the parsed components to the target framework: ${targetFramework}.
You MUST return a perfectly styled valid JSON object adhering EXACTLY to this JSON format:
{
  "targetFramework": "string",
  "routes": [{"path": "string", "method": "string", "description": "string"}],
  "models": [{"name": "string", "fields": [{"name": "string", "type": "string"}], "description": "string"}],
  "dependencies": ["string"],
  "folderStructure": "string explaining hierarchy",
  "architecturalDecisions": ["string"]
}
Return only JSON. No explanations outside.`;

    const parsedDataStr = JSON.stringify(parsedJson, null, 2);
    const architectResponse = await queryLLM(architectSystem, `Parsed Logic: ${parsedDataStr}\n\nTarget Framework: ${targetFramework}`, activeProvider, activeModel, qwenApiKey);
    let architectJson: any = {};
    try {
      architectJson = cleanAndParseJSON(architectResponse);
      logStep("Architect", `Successfully designed ${targetFramework} models, routes, and layout structures.`, "success", JSON.stringify(architectJson, null, 2), architectJson);
    } catch (archErr: any) {
      logStep("Architect", "JSON clean parse failed. Capturing design text...", "warning", architectResponse);
      architectJson = { rawResponse: architectResponse };
    }

    // --- AGENT 3: DEV WRITING INITIAL CODE ---
    logStep("Dev", `Writing clean ${targetFramework} executable source code files...`, "info");
    const devSystemPrompt = `You are a Senior Software Engineer. Rewrite the source code in ${targetFramework} based on the Architect's Plan and the Parser's extracted logic.
Requirements:
1. Provide fully finished, working, robust implementation of all functions and classes.
2. If there are multiple files, separate them clearly using filenames formatted exactly like:
'// filename: <relative/path/to/file>'
or
'# filename: <relative/path/to/file>'
3. Write realistic functionality, proper types (if TypeScript), or fully typed code, not placeholders.
4. Integrate the dependencies recommended by the Architect.`;

    const devPrompt = `ARCHITECT PLAN:\n${JSON.stringify(architectJson, null, 2)}\n\nPARSED LOGIC:\n${parsedDataStr}\n\nREWRITE ALL AS ${targetFramework} SOURCE FILES.`;
    let generatedCode = await queryLLM(devSystemPrompt, devPrompt, activeProvider, activeModel, qwenApiKey);
    logStep("Dev", "Completed writing initial source file structures.", "success", generatedCode);

    // --- AGENT 4: QA LOOP (UP TO 3 ATTEMPTS) ---
    let approved = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let qaFeedbackStr = "";
    
    while (!approved && attempts < MAX_ATTEMPTS) {
      attempts++;
      logStep("QA", `Reviewing generated source code files (Attempt ${attempts} / ${MAX_ATTEMPTS})...`, "info");

      const qaSystem = `You are a strict, world-class QA Engineer and code reviewer. Your job is to check the generated target code for syntax correctness, logical equivalence to the legacy rules, missing dependencies, database errors, or missing edge case exceptions.
You MUST return a perfectly styled valid JSON object adhering EXACTLY to this JSON format:
{
  "approved": boolean,
  "feedback": "string high level feedback",
  "critiques": ["string details of failures"],
  "testSuggestions": ["string test scenarios"]
}
Return only JSON. If approved is false, you must detail exactly what critiques and flaws need addressing.`;

      const qaPrompt = `ORIGINAL LOGIC:\n${parsedDataStr}\n\nGENERATED TARGET CODE:\n${generatedCode}`;
      const qaResponse = await queryLLM(qaSystem, qaPrompt, activeProvider, activeModel, qwenApiKey);
      
      let qaJson: any = {};
      try {
        qaJson = cleanAndParseJSON(qaResponse);
      } catch (e) {
        // If it isn't JSON, lets evaluate it as failed raw or default approved based on text containing positive cues
        const textApproval = qaResponse.toLowerCase().includes('"approved": true') || qaResponse.toLowerCase().includes('approved: true');
        qaJson = {
          approved: textApproval,
          feedback: "Parsed raw text evaluation.",
          critiques: textApproval ? [] : ["Response format error. Review instructions carefully."],
          testSuggestions: ["Standard API smoke testing."]
        };
      }

      if (qaJson.approved === true) {
        approved = true;
        logStep("QA", "Code verified! No major syntax, logical, or import failures detected.", "success", JSON.stringify(qaJson, null, 2), qaJson);
        break;
      } else {
        logStep("QA", `Code Rejected: ${qaJson.feedback}`, "error", JSON.stringify(qaJson, null, 2), qaJson);
        qaFeedbackStr = JSON.stringify(qaJson, null, 2);

        if (attempts < MAX_ATTEMPTS) {
          // --- AGENT 5: REVIEWER MEDIATION ---
          logStep("Reviewer", "QA rejected the code. Mediating conflicts and generating specific fix plans...", "info");
          const reviewerSystem = `You are a Principal Software Architect and Mediator. Review the QA critiques/failures and the generated source code. Write a clear, surgical, files-specific correction briefing instructing the Developer Agent exactly how to fix the code.`;
          
          const reviewerPrompt = `QA CRITIQUE:\n${qaFeedbackStr}\n\nCURRENT SOURCE CODE:\n${generatedCode}`;
          const reviewerPlan = await queryLLM(reviewerSystem, reviewerPrompt, activeProvider, activeModel, qwenApiKey);
          
          logStep("Reviewer", "Surgical mediation advice delivered to Dev.", "warning", reviewerPlan);

          // Dev rewrite
          logStep("Dev", "Re-synthesizing code with Reviewer instructions and QA corrections...", "info");
          const rewritePrompt = `ARCHITECT PLAN:\n${JSON.stringify(architectJson, null, 2)}\n\nPARSED LOGIC:\n${parsedDataStr}\n\nPREVIOUS GENERATED CODE:\n${generatedCode}\n\nREVIEWER SURGICAL REMEDIATION GUIDE:\n${reviewerPlan}\n\nQA CRITIQUE REASONS:\n${qaFeedbackStr}\n\nPLEASE GENEROUSLY REWRITE AND CORRECT ALL PROBLEMS. Return complete updated code files.`;
          
          generatedCode = await queryLLM(devSystemPrompt, rewritePrompt, activeProvider, activeModel, qwenApiKey);
          logStep("Dev", "Successfully completed rewritten source files.", "success", generatedCode);
        }
      }
    }

    // --- FINAL LOGS & SAVING ---
    if (approved) {
      logStep("System", "RefactorBot multi-agent transaction successful! Production-ready code delivered.", "success");
    } else {
      logStep("System", "RefactorBot finished but warning: max review attempts exceeded. Code outputs may need manual audit.", "warning");
    }

    return res.json({
      success: true,
      approved,
      steps: stepHistory,
      outputCode: generatedCode,
      parsedData: parsedJson,
      architectPlan: architectJson
    });

  } catch (error: any) {
    logStep("System", `Critical interruption: ${error.message || error}`, "error");
    return res.status(500).json({
      success: false,
      error: error.message || String(error),
      steps: stepHistory
    });
  }
});

// Vite & Static file Serving setup
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("Vite loading development middleware Mode (SPA mode enabled)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RefactorBot custom server listening on port ${PORT}`);
  });
};

startServer();
