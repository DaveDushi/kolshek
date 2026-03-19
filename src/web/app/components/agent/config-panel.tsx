// AI agent config panel — clean, card-based settings layout
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, X, Loader2, Shield } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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

// Suggested models per provider
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

  const { data: config } = useQuery<AiConfigResponse>({
    queryKey: ["agent", "config"],
    queryFn: () => api.get("/api/v2/agent/config"),
  });

  const { data: ollamaStatus } = useQuery<OllamaStatus>({
    queryKey: ["agent", "status"],
    queryFn: () => api.get("/api/v2/agent/status"),
    refetchInterval: open ? 10000 : false,
  });

  const { data: skills } = useQuery<SkillInfo[]>({
    queryKey: ["agent", "skills"],
    queryFn: () => api.get("/api/v2/agent/skills"),
  });

  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setModel(config.model);
      setBaseUrl(config.baseUrl);
    }
  }, [config]);

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
    // For Ollama, prefer first installed model; fall back to suggested list
    if (value === "ollama" && ollamaStatus?.models?.length) {
      setModel(ollamaStatus.models[0]);
    } else {
      const models = PROVIDER_MODELS[value];
      setModel(models?.length ? models[0] : "");
    }
  }, [ollamaStatus]);

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
      <SheetContent className="w-[380px] sm:w-[420px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="text-base">Settings</SheetTitle>
          <SheetDescription className="text-xs">
            Configure your AI provider and model
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6 space-y-6">
            {/* --- Provider section --- */}
            <section className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Provider
              </p>

              {/* Ollama status indicator */}
              {provider === "ollama" && (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      ollamaStatus?.connected ? "bg-green-500" : "bg-red-500"
                    )}
                  />
                  <span className="text-muted-foreground">
                    {ollamaStatus?.connected
                      ? `Connected (${ollamaStatus.models.length} model${ollamaStatus.models.length === 1 ? "" : "s"})`
                      : "Not detected"}
                  </span>
                </div>
              )}

              {/* Cloud privacy note */}
              {isCloud && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Messages will be sent to {PROVIDERS.find((p) => p.value === provider)?.label}.
                    Use Ollama to keep data local.
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Service</Label>
                  <Select value={provider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="h-9">
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

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  {(() => {
                    const suggestions = PROVIDER_MODELS[provider] || [];
                    const liveModels = provider === "ollama" && ollamaStatus?.models?.length
                      ? ollamaStatus.models
                      : [];

                    return (
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {liveModels.length > 0 && suggestions.length > 0 && (
                            <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                              Installed
                            </p>
                          )}
                          {liveModels.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                          {liveModels.length > 0 && suggestions.length > 0 && (
                            <p className="px-2 py-1 mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                              Suggested
                            </p>
                          )}
                          {suggestions
                            .filter((m) => !liveModels.includes(m))
                            .map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>

                {provider === "ollama" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Base URL</Label>
                    <Input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={DEFAULT_URLS[provider]}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                )}

                {requiresKey && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">API Key</Label>
                      {config?.hasApiKey && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Saved
                        </Badge>
                      )}
                    </div>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={config?.hasApiKey ? "Key saved in keychain" : "Enter API key"}
                      className="h-9"
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !model}
                className="w-full h-9"
                size="sm"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : saved ? (
                  <Check className="h-3.5 w-3.5 mr-2" />
                ) : null}
                {saved ? "Saved" : "Save"}
              </Button>
            </section>

            {/* --- Skills section --- */}
            <section className="space-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  Skills
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Domain knowledge injected into context. Disable unused skills to save tokens.
                </p>
              </div>

              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {skills?.map((skill) => {
                  const isActive = enabledSkills.includes(skill.name);
                  return (
                    <button
                      key={skill.name}
                      onClick={() => toggleSkill(skill.name)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors",
                        "hover:bg-accent/50",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border shrink-0 transition-colors",
                          isActive
                            ? "bg-primary border-primary"
                            : "border-border"
                        )}
                      >
                        {isActive && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className="flex-1 text-left capitalize">{skill.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
