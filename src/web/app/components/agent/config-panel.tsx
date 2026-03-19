// AI agent config panel — provider, model, API key, skills
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, AlertTriangle, Check, X, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ConfigPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledSkills: string[];
  onSkillsChange: (skills: string[]) => void;
}

interface AiConfigResponse {
  provider: string;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
}

interface OllamaStatus {
  connected: boolean;
  models: string[];
}

interface SkillInfo {
  name: string;
  filename: string;
}

const PROVIDERS = [
  { value: "ollama", label: "Ollama (Local)", requiresKey: false },
  { value: "openai", label: "OpenAI", requiresKey: true },
  { value: "groq", label: "Groq", requiresKey: true },
  { value: "openrouter", label: "OpenRouter", requiresKey: true },
] as const;

const DEFAULT_URLS: Record<string, string> = {
  ollama: "http://localhost:11434/v1",
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

// Suggested models per provider (updated March 2026)
const PROVIDER_MODELS: Record<string, string[]> = {
  ollama: [
    "qwen3:8b", "qwen3:32b", "qwen3-coder:30b", "qwen3.5:9b",
    "llama4:scout", "llama3.3:70b", "mistral-small:24b", "phi4-mini:3.8b",
  ],
  openai: [
    "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano",
    "o3", "o3-mini", "o4-mini", "gpt-4.1",
  ],
  groq: [
    "qwen/qwen3-32b", "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
  ],
  openrouter: [
    "openai/gpt-5.4", "anthropic/claude-sonnet-4.6",
    "deepseek/deepseek-v3.2", "google/gemini-2.5-pro",
    "google/gemini-3-flash-preview", "openai/gpt-5.4-mini",
  ],
};

export function ConfigPanel({
  open,
  onOpenChange,
  enabledSkills,
  onSkillsChange,
}: ConfigPanelProps) {
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  // Load current config
  const { data: config } = useQuery<AiConfigResponse>({
    queryKey: ["agent", "config"],
    queryFn: () => api.get("/api/v2/agent/config"),
  });

  // Check Ollama status
  const { data: ollamaStatus } = useQuery<OllamaStatus>({
    queryKey: ["agent", "status"],
    queryFn: () => api.get("/api/v2/agent/status"),
    refetchInterval: open ? 10000 : false,
  });

  // Load skills list
  const { data: skills } = useQuery<SkillInfo[]>({
    queryKey: ["agent", "skills"],
    queryFn: () => api.get("/api/v2/agent/skills"),
  });

  // Populate form from loaded config
  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setModel(config.model);
      setBaseUrl(config.baseUrl);
    }
  }, [config]);

  // Save config mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { provider, model };
      if (baseUrl && baseUrl !== DEFAULT_URLS[provider]) {
        body.baseUrl = baseUrl;
      }
      if (apiKey) {
        body.apiKey = apiKey;
      }
      return api.put("/api/v2/agent/config", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", "config"] });
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleProviderChange = useCallback((value: string) => {
    setProvider(value);
    setBaseUrl(DEFAULT_URLS[value] || "");
    setApiKey("");
    // Auto-select first suggested model for the new provider
    const models = PROVIDER_MODELS[value];
    if (models?.length) {
      setModel(models[0]);
    } else {
      setModel("");
    }
  }, []);

  const toggleSkill = useCallback(
    (name: string) => {
      if (enabledSkills.includes(name)) {
        onSkillsChange(enabledSkills.filter((s) => s !== name));
      } else {
        onSkillsChange([...enabledSkills, name]);
      }
    },
    [enabledSkills, onSkillsChange]
  );

  const requiresKey = PROVIDERS.find((p) => p.value === provider)?.requiresKey ?? false;
  const isCloud = provider !== "ollama";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:w-[400px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Agent Settings</SheetTitle>
          <SheetDescription>Configure your AI provider and model</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-4">
            {/* Ollama status */}
            {provider === "ollama" && (
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    ollamaStatus?.connected ? "bg-green-500" : "bg-red-500"
                  )}
                />
                <span className="text-muted-foreground">
                  {ollamaStatus?.connected
                    ? `Ollama connected (${ollamaStatus.models.length} model${ollamaStatus.models.length === 1 ? "" : "s"})`
                    : "Ollama not detected"}
                </span>
              </div>
            )}

            {/* Privacy warning for cloud providers */}
            {isCloud && (
              <Alert className="text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                <div className="ml-2">
                  Your messages and query results will be sent to{" "}
                  {PROVIDERS.find((p) => p.value === provider)?.label}.
                  Use Ollama to keep everything local.
                </div>
              </Alert>
            )}

            {/* Provider */}
            <div className="space-y-2">
              <Label className="text-xs">Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label className="text-xs">Model</Label>
              {(() => {
                // Build model list: for Ollama, merge live models with suggestions
                const suggestions = PROVIDER_MODELS[provider] || [];
                const liveModels = provider === "ollama" && ollamaStatus?.models?.length
                  ? ollamaStatus.models
                  : [];
                // Deduplicated, live models first
                const allModels = [...new Set([...liveModels, ...suggestions])];

                return (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {liveModels.length > 0 && suggestions.length > 0 && (
                        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                          Installed
                        </p>
                      )}
                      {liveModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                      {liveModels.length > 0 && suggestions.length > 0 && (
                        <p className="px-2 py-1 mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                          Suggested
                        </p>
                      )}
                      {suggestions
                        .filter((m) => !liveModels.includes(m))
                        .map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label className="text-xs">Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={DEFAULT_URLS[provider]}
                className="text-xs font-mono"
              />
            </div>

            {/* API Key */}
            {requiresKey && (
              <div className="space-y-2">
                <Label className="text-xs">
                  API Key
                  {config?.hasApiKey && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Saved
                    </Badge>
                  )}
                </Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config?.hasApiKey ? "Key saved in keychain" : "Enter API key"}
                />
              </div>
            )}

            {/* Save button */}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !model}
              className="w-full"
              size="sm"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5 mr-2" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-2" />
              )}
              {saved ? "Saved" : "Save Settings"}
            </Button>

            <Separator />

            {/* Skills */}
            <div className="space-y-2">
              <Label className="text-xs">Skills</Label>
              <p className="text-[11px] text-muted-foreground">
                Domain knowledge injected into the agent's context. Disable unused skills to save tokens.
              </p>
              <div className="space-y-1">
                {skills?.map((skill) => {
                  const isActive = enabledSkills.includes(skill.name);
                  return (
                    <button
                      key={skill.name}
                      onClick={() => toggleSkill(skill.name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors",
                        "hover:bg-accent/50",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          isActive ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      />
                      <span className="flex-1 text-left">{skill.name}</span>
                      {isActive ? (
                        <Check className="h-3 w-3 text-primary" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
