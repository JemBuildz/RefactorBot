import { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Cpu, 
  Compass, 
  Code, 
  Eye, 
  ShieldAlert, 
  Play, 
  Pause, 
  RefreshCw, 
  Copy, 
  Check, 
  Terminal, 
  FileCode, 
  Settings, 
  HelpCircle, 
  ChevronRight, 
  ArrowRight, 
  Sparkles, 
  Database, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  FastForward, 
  AlertTriangle,
  Github
} from "lucide-react";
import { LEGACY_TEMPLATES, LegacyTemplate } from "./templates";

// Define structured item types matching our API
interface LogItem {
  agentName: string;
  action: string;
  timestamp: string;
  status: 'info' | 'success' | 'warning' | 'error';
  content?: string;
  metadata?: any;
}

interface RefactorResponse {
  success: boolean;
  approved: boolean;
  steps: LogItem[];
  outputCode: string;
  parsedData: any;
  architectPlan: any;
  error?: string;
}

interface ExtractedFile {
  name: string;
  code: string;
}

// Extract filenames and code segments from monolithic text file formatting
function extractFilesFromCode(rawCode: string): ExtractedFile[] {
  if (!rawCode) return [];
  const files: ExtractedFile[] = [];
  const lines = rawCode.split('\n');
  
  let currentFileName = "refactored_source.txt";
  let currentFileLines: string[] = [];
  
  // Matches templates like "// filename: app/main.py" or "# filename: src/index.ts"
  const fileHeaderReg = /^(?:\/\/|#|--|)\s*filename:\s*(.*)$/i;

  for (const line of lines) {
    const match = line.match(fileHeaderReg);
    if (match) {
      if (currentFileLines.length > 0) {
        files.push({
          name: currentFileName.trim(),
          code: currentFileLines.join('\n').trim()
        });
        currentFileLines = [];
      }
      currentFileName = match[1].trim();
    } else {
      currentFileLines.push(line);
    }
  }
  
  if (currentFileLines.length > 0 || files.length === 0) {
    files.push({
      name: currentFileName.trim(),
      code: currentFileLines.join('\n').trim()
    });
  }
  
  return files;
}

export default function App() {
  // Main States
  const [legacyCode, setLegacyCode] = useState<string>(LEGACY_TEMPLATES[0].code);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);
  const [targetFramework, setTargetFramework] = useState<string>("FastAPI + Pydantic");
  const [provider, setProvider] = useState<"gemini" | "qwen">("gemini");
  const [modelName, setModelName] = useState<string>("gemini-3.5-flash");
  const [qwenApiKey, setQwenApiKey] = useState<string>(() => localStorage.getItem("qwen_api_key") || "");
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Execution states
  const [isRefactoring, setIsRefactoring] = useState<boolean>(false);
  const [rawResponseData, setRawResponseData] = useState<RefactorResponse | null>(null);
  const [refactorError, setRefactorError] = useState<string | null>(null);

  // Playback & Animation step states
  const [displayedSteps, setDisplayedSteps] = useState<LogItem[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1500); // ms delay
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Result Visual Tabs
  const [activeResultTab, setActiveResultTab] = useState<'code' | 'architect' | 'parser' | 'logs'>('code');
  const [activeFileTab, setActiveFileTab] = useState<string>("");

  // Save key on change
  const handleSaveQwenKey = (val: string) => {
    setQwenApiKey(val);
    localStorage.setItem("qwen_api_key", val);
  };

  // Preload code when template drops
  const handleSelectTemplate = (idx: number) => {
    setSelectedTemplateIndex(idx);
    setLegacyCode(LEGACY_TEMPLATES[idx].code);
    setTargetFramework(LEGACY_TEMPLATES[idx].frameworkSuggestions[0]);
  };

  // Execute multi-agent refactoring loop on server
  const handleInitiateRefactor = async () => {
    setIsRefactoring(true);
    setRefactorError(null);
    setRawResponseData(null);
    setDisplayedSteps([]);
    setCurrentStepIndex(-1);
    setIsPlaybackPlaying(false);

    try {
      const res = await fetch("/api/refactor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          legacyCode,
          targetFramework,
          provider,
          modelName,
          qwenApiKey: provider === "qwen" ? qwenApiKey : undefined
        })
      });

      const data: RefactorResponse = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "An error occurred inside the agent society session.");
      }

      setRawResponseData(data);
      
      // Start replaying steps to user elegantly
      if (data.steps && data.steps.length > 0) {
        setDisplayedSteps([]);
        setCurrentStepIndex(0);
        setIsPlaybackPlaying(true);
      }
    } catch (err: any) {
      setRefactorError(err.message || String(err));
    } finally {
      setIsRefactoring(false);
    }
  };

  // Auto-play stepping logic
  useEffect(() => {
    if (isPlaybackPlaying && rawResponseData?.steps) {
      const steps = rawResponseData.steps;

      if (currentStepIndex < steps.length) {
        timerRef.current = setTimeout(() => {
          setDisplayedSteps(prev => [...prev, steps[currentStepIndex]]);
          
          // Select default file tabs if we reached dev or completion
          const currentStep = steps[currentStepIndex];
          if (currentStep.agentName === "Dev" && currentStep.status === "success") {
            const files = extractFilesFromCode(currentStep.content || "");
            if (files.length > 0) {
              setActiveFileTab(files[0].name);
            }
          }

          setCurrentStepIndex(prev => prev + 1);
        }, playbackSpeed);
      } else {
        setIsPlaybackPlaying(false);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaybackPlaying, currentStepIndex, rawResponseData, playbackSpeed]);

  // Command handlers for replaying manual steps
  const handlePause = () => setIsPlaybackPlaying(false);
  const handlePlay = () => {
    if (!rawResponseData?.steps) return;
    if (currentStepIndex >= rawResponseData.steps.length) {
      // restart
      setDisplayedSteps([]);
      setCurrentStepIndex(0);
    }
    setIsPlaybackPlaying(true);
  };
  const handleSkipToEnd = () => {
    if (!rawResponseData?.steps) return;
    setIsPlaybackPlaying(false);
    setDisplayedSteps(rawResponseData.steps);
    setCurrentStepIndex(rawResponseData.steps.length);
    
    // Auto select first file
    const files = extractFilesFromCode(rawResponseData.outputCode || "");
    if (files.length > 0) {
      setActiveFileTab(files[0].name);
    }
  };
  const handleResetPlayback = () => {
    setIsPlaybackPlaying(false);
    setDisplayedSteps([]);
    setCurrentStepIndex(0);
  };

  // Helper copy content
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Extracted files computed properties
  const currentFiles = rawResponseData?.outputCode ? extractFilesFromCode(rawResponseData.outputCode) : [];
  
  // Set tab active source files
  useEffect(() => {
    if (currentFiles.length > 0 && !activeFileTab) {
      setActiveFileTab(currentFiles[0].name);
    }
  }, [currentFiles, activeFileTab]);

  // Identify active agent based on the latest displayed step
  const latestStep = displayedSteps.length > 0 ? displayedSteps[displayedSteps.length - 1] : null;
  const activeAgent = latestStep ? latestStep.agentName : isRefactoring ? "Parser" : "None";

  // Framework choices list
  const frameworks = [
    "FastAPI + Pydantic",
    "Express + NestJS + TypeScript",
    "Flask + SQLAlchemy",
    "Go + Gin + Gorm",
    "Rust + Axum + Serde",
    "Spring Boot + Spring Web"
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* HEADER SECTION */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 to-cyan-400 p-2 rounded-xl text-slate-950 shadow-lg shadow-indigo-500/20">
            <Bot className="w-6 h-6 stroke-[1.8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans font-bold tracking-tight text-lg text-white">RefactorBot</h1>
              <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-900/50">
                Agent Society
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Autonomous multi-agent code structure modernization engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-lg border transition-all flex items-center gap-2 text-xs font-mono ${
              isSettingsOpen 
                ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300' 
                : 'border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>LLM config</span>
          </button>
          
          <a 
            href="https://github.com/your-username/refactor-bot-society" 
            target="_blank" 
            rel="noreferrer"
            className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-xs font-mono hidden md:flex items-center gap-2"
          >
            <Github className="w-4 h-4" />
            <span>GitHub pkg</span>
          </a>
        </div>
      </header>

      {/* SETTINGS POPDOWN / DRAWER */}
      {isSettingsOpen && (
        <div className="bg-slate-900/90 border-b border-slate-800 p-5 px-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
          <div>
            <h3 className="text-white text-xs font-bold uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              1. Provider Select
            </h3>
            <p className="text-xs text-slate-400 mb-3">Choose the backend LLM engine powering the 5 agents.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setProvider("gemini"); setModelName("gemini-3.5-flash"); }}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  provider === "gemini" 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Google Gemini
                <span className="block text-[9px] opacity-75 font-mono">Injected automatically</span>
              </button>
              <button
                type="button"
                onClick={() => { setProvider("qwen"); setModelName("qwen-plus"); }}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  provider === "qwen" 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Alibaba Qwen
                <span className="block text-[9px] opacity-75 font-mono">Requires API Key</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-white text-xs font-bold uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              2. Model Selection
            </h3>
            <p className="text-xs text-slate-400 mb-3">Select the active parameter size context for generated responses.</p>
            {provider === "gemini" ? (
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 text-slate-200"
              >
                <option value="gemini-3.5-flash">gemini-3.5-flash (Standard & Rapid)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Advanced Coding/Reasoning)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Cost-efficient)</option>
              </select>
            ) : (
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 text-slate-200"
              >
                <option value="qwen-plus">qwen-plus (Premium quality)</option>
                <option value="qwen-max">qwen-max (Large reasoning power)</option>
                <option value="qwen-turbo">qwen-turbo (Ultrafast processing)</option>
              </select>
            )}
          </div>

          <div>
            <h3 className="text-white text-xs font-bold uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              3. Qwen API Credentials
            </h3>
            <p className="text-xs text-slate-400 mb-3">Paste your Alibaba DashScope API key (stored locally inside your browser).</p>
            <div className="relative">
              <input
                type="password"
                placeholder="your_qwen_api_key_here"
                value={qwenApiKey}
                onChange={(e) => handleSaveQwenKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 pr-10 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
              <span className="absolute right-3 top-2 text-[10px] text-slate-500 uppercase font-mono">
                {qwenApiKey ? 'Saved' : 'Empty'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* WORKING AREA */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        
        {/* LEFT COLUMN: SETUP & LEGACY SOURCE (LG: 5 spans) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* TOOL PLANNER CARD */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-xl">
            <h2 className="text-white text-xs uppercase tracking-wider font-mono font-bold mb-3 flex items-center gap-1.5 text-indigo-400">
              <Bot className="w-4 h-4" />
              1. Setup Refactoring Target
            </h2>
            
            <div className="space-y-3.5 text-xs">
              {/* Presets Grid */}
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1.5">Load Legacy Code Sample:</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEGACY_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => handleSelectTemplate(idx)}
                      className={`text-left p-2 rounded-lg border transition-all transition-duration-150 ${
                        selectedTemplateIndex === idx 
                          ? 'border-indigo-500 bg-indigo-950/20 text-white' 
                          : 'border-slate-800/80 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold truncate">{tmpl.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{tmpl.language}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Framework & Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-slate-400 font-mono text-[11px] mb-1">Target Modern Framework:</label>
                  <select
                    value={targetFramework}
                    onChange={(e) => setTargetFramework(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 text-white font-mono"
                  >
                    {frameworks.map(fw => (
                      <option key={fw} value={fw}>{fw}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    disabled={isRefactoring || (provider === "qwen" && !qwenApiKey)}
                    onClick={handleInitiateRefactor}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                      isRefactoring 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                        : (provider === "qwen" && !qwenApiKey)
                        ? 'bg-slate-900 border border-dashed border-red-900 text-red-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:shadow-indigo-500/30'
                    }`}
                  >
                    {isRefactoring ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Agents Collabing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-300" />
                        <span>Assemble & Refactor</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {provider === "qwen" && !qwenApiKey && (
                <div className="p-2 border border-red-950 bg-red-950/20 text-red-300 rounded-lg text-[10px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Alibaba Qwen selected, please enter an API Key in LLM Configuration.</span>
                </div>
              )}
            </div>
          </div>

          {/* LEGACY CODE WORKSPACE */}
          <div className="flex-1 bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden flex flex-col shadow-xl min-h-[300px]">
            <div className="bg-slate-950 px-4 py-2 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-xs font-bold text-slate-200">legacy_source_code</span>
                <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-amber-400 border border-slate-800">
                  {LEGACY_TEMPLATES[selectedTemplateIndex]?.language || 'Source'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Editable</p>
            </div>
            
            <textarea
              value={legacyCode}
              onChange={(e) => setLegacyCode(e.target.value)}
              className="flex-1 p-4 w-full bg-slate-950/40 text-slate-300 font-mono text-xs focus:outline-none resize-none overflow-y-auto leading-relaxed border-0 focus:ring-0"
              placeholder="// Paste your old, legacy code or formulas here..."
              spellCheck={false}
            />
          </div>

        </div>

        {/* RIGHT COLUMN: REFACTOR AGENTS ROOM & TRANSITION VIEWS (LG: 7 spans) */}
        <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden">
          
          {/* SIMULATION BOARD / AGENT SOCIETY DIRECTORY */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-white text-xs uppercase tracking-wider font-mono font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                2. Cybernetic Agent Society Board
              </h2>
              {rawResponseData && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Playback:</span>
                  <div className="bg-slate-950 rounded-lg p-0.5 border border-slate-800 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleResetPlayback}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900"
                      title="Reset playback"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    {isPlaybackPlaying ? (
                      <button
                        type="button"
                        onClick={handlePause}
                        className="py-1 px-2 rounded bg-indigo-950 text-indigo-300 hover:bg-indigo-900 text-[10px] uppercase font-mono font-bold flex items-center gap-1"
                      >
                        <Pause className="w-3 h-3 text-indigo-400" /> Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePlay}
                        disabled={!rawResponseData}
                        className="py-1 px-2 rounded bg-emerald-950 text-emerald-300 hover:bg-emerald-900 text-[10px] uppercase font-mono font-bold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 text-emerald-400" /> Play
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSkipToEnd}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900"
                      title="Skip to End"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Complete Agents Circle / Link Grid */}
            <div className="grid grid-cols-5 gap-2.5">
              {/* Parser Agent */}
              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                activeAgent === "Parser" 
                  ? 'border-cyan-500 bg-cyan-950/20 text-cyan-200' 
                  : (displayedSteps.some(s => s.agentName === "Parser" && s.status === "success")
                    ? 'border-emerald-900 bg-slate-950 text-slate-400' 
                    : 'border-slate-800/80 bg-slate-950/40 text-slate-500')
              }`}>
                <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center mb-1 text-xs font-bold ${
                  activeAgent === "Parser" ? 'bg-cyan-500/20 ring-2 ring-cyan-500 animate-pulse' : 'bg-slate-900'
                }`}>
                  <Cpu className={`w-4 h-4 ${activeAgent === "Parser" ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <div className="text-[10px] font-bold font-mono">1. Parser</div>
                <div className="text-[8px] opacity-75 leading-none">Extracted AST</div>
              </div>

              {/* Architect Agent */}
              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                activeAgent === "Architect" 
                  ? 'border-emerald-500 bg-emerald-950/20 text-emerald-200' 
                  : (displayedSteps.some(s => s.agentName === "Architect" && s.status === "success")
                    ? 'border-emerald-900 bg-slate-950 text-slate-400' 
                    : 'border-slate-800/80 bg-slate-950/40 text-slate-500')
              }`}>
                <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center mb-1 text-xs font-bold ${
                  activeAgent === "Architect" ? 'bg-emerald-500/20 ring-2 ring-emerald-500 animate-pulse' : 'bg-slate-900'
                }`}>
                  <Compass className={`w-4 h-4 ${activeAgent === "Architect" ? 'text-emerald-400' : 'text-slate-400'}`} />
                </div>
                <div className="text-[10px] font-bold font-mono">2. Architect</div>
                <div className="text-[8px] opacity-75 leading-none">Endpoint Plan</div>
              </div>

              {/* Dev Agent */}
              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                activeAgent === "Dev" 
                  ? 'border-purple-500 bg-purple-950/20 text-purple-200' 
                  : (displayedSteps.some(s => s.agentName === "Dev" && s.status === "success")
                    ? 'border-emerald-900 bg-slate-950 text-slate-400' 
                    : 'border-slate-800/80 bg-slate-950/40 text-slate-500')
              }`}>
                <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center mb-1 text-xs font-bold ${
                  activeAgent === "Dev" ? 'bg-purple-500/20 ring-2 ring-purple-500 animate-pulse' : 'bg-slate-900'
                }`}>
                  <Code className={`w-4 h-4 ${activeAgent === "Dev" ? 'text-purple-400' : 'text-slate-400'}`} />
                </div>
                <div className="text-[10px] font-bold font-mono">3. Dev</div>
                <div className="text-[8px] opacity-75 leading-none">Code Draft</div>
              </div>

              {/* QA Agent */}
              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                activeAgent === "QA" 
                  ? 'border-amber-500 bg-amber-950/20 text-amber-200' 
                  : (displayedSteps.some(s => s.agentName === "QA" && s.status === "success" && s.metadata?.approved)
                    ? 'border-emerald-900 bg-slate-950 text-slate-400' 
                    : (displayedSteps.some(s => s.agentName === "QA" && s.status === "error") 
                      ? 'border-red-950 bg-red-950/10 text-red-400'
                      : 'border-slate-800/80 bg-slate-950/40 text-slate-500'))
              }`}>
                <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center mb-1 text-xs font-bold ${
                  activeAgent === "QA" ? 'bg-amber-500/20 ring-2 ring-amber-500 animate-pulse' : 'bg-slate-900'
                }`}>
                  <Eye className={`w-4 h-4 ${activeAgent === "QA" ? 'text-amber-400' : 'text-slate-400'}`} />
                </div>
                <div className="text-[10px] font-bold font-mono">4. QA</div>
                <div className="text-[8px] opacity-75 leading-none">Audit & Gates</div>
              </div>

              {/* Reviewer Agent */}
              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                activeAgent === "Reviewer" 
                  ? 'border-rose-500 bg-rose-950/20 text-rose-200' 
                  : (displayedSteps.some(s => s.agentName === "Reviewer")
                    ? 'border-yellow-950 bg-slate-950 text-slate-400 font-medium' 
                    : 'border-slate-800/80 bg-slate-950/40 text-slate-500')
              }`}>
                <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center mb-1 text-xs font-bold ${
                  activeAgent === "Reviewer" ? 'bg-rose-500/20 ring-2 ring-rose-500 animate-pulse' : 'bg-slate-900'
                }`}>
                  <ShieldAlert className={`w-4 h-4 ${activeAgent === "Reviewer" ? 'text-rose-400' : 'text-slate-400'}`} />
                </div>
                <div className="text-[10px] font-bold font-mono">5. Review</div>
                <div className="text-[8px] opacity-75 leading-none">Mediate Fixes</div>
              </div>
            </div>

            {/* Delay Speed controller */}
            {rawResponseData && (
              <div className="mt-3 py-1.5 px-3 bg-slate-950/60 rounded-lg flex items-center justify-between text-[11px] text-slate-400 font-mono border border-slate-900">
                <span className="flex items-center gap-1 text-indigo-300">
                  <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  {currentStepIndex >= rawResponseData.steps.length 
                    ? 'Simulation complete.' 
                    : `Step ${Math.min(currentStepIndex + 1, rawResponseData.steps.length)} of ${rawResponseData.steps.length} playing`}
                </span>
                <div className="flex items-center gap-2">
                  <span>Speed:</span>
                  <button 
                    type="button"
                    onClick={() => setPlaybackSpeed(3000)} 
                    className={`px-1.5 py-0.5 rounded ${playbackSpeed === 3000 ? 'bg-indigo-600 text-white' : 'hover:text-white'}`}
                  >
                    Slow
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setPlaybackSpeed(1500)} 
                    className={`px-1.5 py-0.5 rounded ${playbackSpeed === 1500 ? 'bg-indigo-600 text-white' : 'hover:text-white'}`}
                  >
                    1x
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setPlaybackSpeed(500)} 
                    className={`px-1.5 py-0.5 rounded ${playbackSpeed === 500 ? 'bg-indigo-600 text-white' : 'hover:text-white'}`}
                  >
                    Fast
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ACTIVE THOUGHT CHAT STREAM PANEL */}
          <div className="flex-1 min-h-[380px] bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden flex flex-col shadow-xl">
            
            {/* Header */}
            <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                Multi-Agent Workspace Stream
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {displayedSteps.length} logs rendered
              </span>
            </div>

            {/* Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px] leading-relaxed select-text bg-slate-950/10">
              
              {/* Default Empty Workspace State */}
              {displayedSteps.length === 0 && !isRefactoring && !refactorError && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                    <Bot className="w-8 h-8 text-slate-400 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-400 mb-1">Society Workspace Offline</h4>
                  <p className="max-w-[340px] text-[11px] text-slate-500">
                    Click <strong className="text-slate-300">"Assemble & Refactor"</strong> above. Five autonomous AI specialists will collaborate, debug, and deliver clean code structures.
                  </p>
                </div>
              )}

              {/* Server loading state */}
              {isRefactoring && (
                <div className="p-4 border border-dashed border-indigo-900 bg-indigo-950/10 rounded-lg flex items-center gap-3 text-indigo-300">
                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs">Assembling Multi-Agent State Board...</h5>
                    <p className="text-[10px] text-slate-400">The server is running the 3-turn interactive QA negotiation with the Gemini model. This takes about 5-10 seconds.</p>
                  </div>
                </div>
              )}

              {/* Server failures errors */}
              {refactorError && (
                <div className="p-4 border border-red-950 bg-red-950/20 text-red-300 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Society System Interrupted: Server Error</span>
                  </div>
                  <p className="text-[11px] text-slate-400 bg-slate-950/50 p-2 rounded border border-slate-900 whitespace-pre-wrap">{refactorError}</p>
                  <p className="text-[10px] text-slate-500">Tip: Check if your server has access to process.env.GEMINI_API_KEY, or switch models in the LLM config panel.</p>
                </div>
              )}

              {/* Chronological Step Iteration */}
              {displayedSteps.map((step, idx) => {
                const isSystem = step.agentName === "System";
                const isParser = step.agentName === "Parser";
                const isArchitect = step.agentName === "Architect";
                const isDev = step.agentName === "Dev";
                const isQA = step.agentName === "QA";
                const isReviewer = step.agentName === "Reviewer";

                const agentColors: Record<string, string> = {
                  System: "text-slate-400 bg-slate-900 border-slate-800",
                  Parser: "text-cyan-400 bg-cyan-950/20 border-cyan-900/50",
                  Architect: "text-emerald-400 bg-emerald-950/20 border-emerald-900/50",
                  Dev: "text-purple-400 bg-purple-950/20 border-purple-900/50",
                  QA: "text-amber-400 bg-amber-950/20 border-amber-900/50",
                  Reviewer: "text-rose-400 bg-rose-950/20 border-rose-900/50"
                };

                return (
                  <div key={`${step.timestamp}-${idx}`} className={`border rounded-lg overflow-hidden animate-slideUp ${agentColors[step.agentName] || 'border-slate-800 bg-slate-950'}`}>
                    
                    {/* Log Card header */}
                    <div className="px-3 py-1.5 flex items-center justify-between bg-black/30 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        {isSystem && <Bot className="w-3.5 h-3.5 text-slate-400" />}
                        {isParser && <Cpu className="w-3.5 h-3.5 text-cyan-400" />}
                        {isArchitect && <Compass className="w-3.5 h-3.5 text-emerald-400" />}
                        {isDev && <Code className="w-3.5 h-3.5 text-purple-400" />}
                        {isQA && <Eye className="w-3.5 h-3.5 text-amber-400" />}
                        {isReviewer && <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}

                        <span className="font-bold text-[11px] tracking-wide uppercase">{step.agentName}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-slate-500">{step.timestamp}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {step.status === "success" && <span className="text-[9px] text-emerald-400 uppercase font-bold">✅ Success</span>}
                        {step.status === "warning" && <span className="text-[9px] text-yellow-400 uppercase font-bold">⚠️ Warning</span>}
                        {step.status === "error" && <span className="text-[9px] text-rose-400 uppercase font-bold">❌ rejected</span>}
                      </div>
                    </div>

                    {/* Log text content */}
                    <div className="p-3 text-slate-300">
                      <p className="font-semibold text-slate-100 text-xs mb-1.5">{step.action}</p>
                      
                      {step.content && (
                        <details className="mt-2 text-[10px]" open={step.status === "error" || isParser || isArchitect}>
                          <summary className="cursor-pointer text-slate-400 hover:text-slate-200 select-none pb-1 bg-black/20 p-1.5 rounded flex items-center justify-between">
                            <span>Details Output Content</span>
                            <ChevronRight className="w-3 h-3 transform transition-transform group-open:rotate-90" />
                          </summary>
                          <pre className="mt-2 p-2 bg-slate-950 text-slate-300 overflow-x-auto rounded border border-white/5 leading-normal max-h-52 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                            {step.content}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INTERACTIVE SOURCE RESULTS BLOCK */}
          {rawResponseData && displayedSteps.length === rawResponseData.steps.length && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl animate-fadeIn">
              
              {/* Multi-pane Tabs selector layout */}
              <div className="bg-slate-950 border-b border-slate-800 flex items-center justify-between px-3">
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setActiveResultTab('code')}
                    className={`py-2 px-3 text-xs font-bold font-mono transition-all border-b-2 flex items-center gap-1.5 ${
                      activeResultTab === 'code' 
                        ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Refactored Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab('architect')}
                    className={`py-2 px-3 text-xs font-bold font-mono transition-all border-b-2 flex items-center gap-1.5 ${
                      activeResultTab === 'architect' 
                        ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    Target Blueprint
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab('parser')}
                    className={`py-2 px-3 text-xs font-bold font-mono transition-all border-b-2 flex items-center gap-1.5 ${
                      activeResultTab === 'parser' 
                        ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    Parser JSON
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyText(
                    activeResultTab === 'code' 
                      ? rawResponseData.outputCode 
                      : (activeResultTab === 'architect' 
                        ? JSON.stringify(rawResponseData.architectPlan, null, 2) 
                        : JSON.stringify(rawResponseData.parsedData, null, 2))
                  )}
                  className="py-1 px-2.5 rounded hover:bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-all active:scale-95"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Pane details */}
              <div className="p-4 bg-slate-950/30">
                
                {/* 1. CODE PANE */}
                {activeResultTab === 'code' && (
                  <div className="space-y-4">
                    {/* Multi-Files select sub-tabs */}
                    {currentFiles.length > 1 && (
                      <div className="flex flex-wrap gap-1 border-b border-slate-800 bg-slate-950 p-1 rounded-lg">
                        {currentFiles.map(file => (
                          <button
                            key={file.name}
                            type="button"
                            onClick={() => setActiveFileTab(file.name)}
                            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                              activeFileTab === file.name 
                                ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                          >
                            <FileCode className="w-3 h-3 inline mr-1 text-inherit" />
                            {file.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Rendering code block text */}
                    <div className="relative rounded-lg overflow-hidden border border-slate-800">
                      <div className="bg-slate-950 px-3 py-1 bg-black/40 text-[9px] font-mono text-slate-400 border-b border-slate-800/80 flex justify-between items-center">
                        <span>{activeFileTab || 'refactored_code'}</span>
                        <span>{targetFramework} code file</span>
                      </div>
                      <pre className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto leading-relaxed max-h-[460px] overflow-y-auto text-emerald-100/90 whitespace-pre scrollbar-thin">
                        {currentFiles.find(f => f.name === activeFileTab)?.code || rawResponseData.outputCode}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 2. ARCHITECT PLAN PANE */}
                {activeResultTab === 'architect' && (
                  <div className="space-y-4 font-mono text-[11px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Folder suggestions structure */}
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                        <h4 className="text-white font-bold leading-normal border-b border-slate-800 pb-1.5 mb-2 text-indigo-400 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-emerald-400" /> Suggested Folder Layout:
                        </h4>
                        <pre className="whitespace-pre-wrap text-slate-300 leading-normal max-h-56 overflow-y-auto leading-relaxed">
                          {rawResponseData.architectPlan?.folderStructure || "Inherited default structural layouts."}
                        </pre>
                      </div>

                      {/* Routes or Interfaces */}
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                        <h4 className="text-white font-bold leading-normal border-b border-slate-800 pb-1.5 mb-2 text-indigo-400 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-cyan-400" /> Targets Endpoints/Routes:
                        </h4>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {rawResponseData.architectPlan?.routes?.map((route: any) => (
                            <div key={route.path} className="p-1.5 rounded bg-black/40 border border-white/5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold text-emerald-400 px-1 bg-emerald-950/20 rounded">{route.method}</span>
                                <span className="font-bold text-slate-200">{route.path}</span>
                              </div>
                              <p className="text-[10px] opacity-75 mt-1">{route.description}</p>
                            </div>
                          )) || "No routes needed for this library type."}
                        </div>
                      </div>

                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                      <h4 className="text-white font-bold leading-normal border-b border-slate-800 pb-1.5 mb-2 text-indigo-400 flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-purple-400" /> Target Entities & Models:
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto">
                        {rawResponseData.architectPlan?.models?.map((model: any) => (
                          <div key={model.name} className="p-2 bg-black/40 rounded border border-white/5 text-[10px]">
                            <div className="font-bold text-slate-200 mb-1">{model.name}</div>
                            <div className="space-y-1 pl-2">
                              {model.fields?.map((f: any) => (
                                <div key={f.name} className="flex justify-between hover:bg-white/5 p-0.5">
                                  <span>{f.name}</span>
                                  <span className="opacity-75 font-bold font-mono">{f.type}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )) || "No complex database models declared."}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. PARSER JSON PANE */}
                {activeResultTab === 'parser' && (
                  <div className="space-y-4 font-mono text-[11px]">
                    <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                      <h4 className="text-white font-bold leading-normal border-b border-slate-800 pb-1.5 mb-2 text-indigo-400">
                        Extracted Business Rules & Formulas:
                      </h4>
                      <p className="text-slate-300 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {rawResponseData.parsedData?.businessLogic || "Core functional loops parsed."}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-[10px]">
                        <h4 className="text-white font-bold font-mono leading-normal border-b border-slate-800 pb-1.5 mb-2 text-cyan-400">Functions Extracted:</h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {rawResponseData.parsedData?.functions?.map((f: any) => (
                            <div key={f.name} className="p-1 rounded bg-black/20 mb-1">
                              <strong>{f.name}</strong>
                              <div className="opacity-75">Params: {f.parameters?.join(', ')}</div>
                            </div>
                          )) || <div className="text-slate-500">None detected.</div>}
                        </div>
                      </div>

                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-[10px]">
                        <h4 className="text-white font-bold font-mono leading-normal border-b border-slate-800 pb-1.5 mb-2 text-emerald-400">Classes Extracted:</h4>
                        <div className="max-h-40 overflow-y-auto">
                          {rawResponseData.parsedData?.classes?.map((c: any) => (
                            <div key={c.name} className="p-1 rounded bg-black/20 mb-1">
                              <strong>{c.name}</strong>
                              <div className="opacity-75">Methods: {c.methods?.join(', ')}</div>
                            </div>
                          )) || <div className="text-slate-500">None detected.</div>}
                        </div>
                      </div>

                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-[10px]">
                        <h4 className="text-white font-bold font-mono leading-normal border-b border-slate-800 pb-1.5 mb-2 text-purple-400">Legacy Imports:</h4>
                        <div className="max-h-40 overflow-y-auto text-slate-300">
                          {rawResponseData.parsedData?.imports?.map((imp: string) => (
                            <div key={imp} className="p-1 border-b border-white/5 truncate">{imp}</div>
                          )) || <div className="text-slate-500">None detected.</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 mt-8 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="font-mono">
          RefactorBot System Society Core v1.0.0 (Global AI Hackathon, Track 3 Submission package)
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Server Online</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Gemini 3.5 Embedded</span>
          </span>
        </div>
      </footer>

    </div>
  );
}
