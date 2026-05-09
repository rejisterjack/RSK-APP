'use client';

import { Check, ChevronDown, Cpu, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ModelOption {
  id: string;
  name: string;
  provider: ProviderId;
  description: string;
  contextWindow: number;
  badge?: string;
}

export type ProviderId =
  | 'openrouter'
  | 'groq'
  | 'cerebras'
  | 'sambanova'
  | 'nvidia'
  | 'mistral'
  | 'fireworks';

interface ProviderInfo {
  id: ProviderId;
  name: string;
  icon: React.ReactNode;
  gradient: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'groq',
    name: 'Groq',
    icon: <Cpu className="h-3.5 w-3.5" />,
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    icon: <Cpu className="h-3.5 w-3.5" />,
    gradient: 'from-red-500 to-rose-600',
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    icon: <Cpu className="h-3.5 w-3.5" />,
    gradient: 'from-teal-500 to-cyan-600',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    icon: <Cpu className="h-3.5 w-3.5" />,
    gradient: 'from-green-500 to-emerald-600',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    icon: <Cpu className="h-3.5 w-3.5" />,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    gradient: 'from-orange-500 to-red-600',
  },
];

export const AVAILABLE_MODELS: ModelOption[] = [
  // ─── Groq ──────────────────────────────────────────────────────────────────
  {
    id: 'groq/llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    description: 'Ultra-fast 70B, best for real-time chat',
    contextWindow: 131072,
    badge: 'Fastest',
  },
  {
    id: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout',
    provider: 'groq',
    description: 'Latest Llama 4 MoE, ultra-fast streaming',
    contextWindow: 131072,
  },
  {
    id: 'groq/qwen/qwen3-32b',
    name: 'Qwen3 32B',
    provider: 'groq',
    description: 'Strong multilingual, fast inference',
    contextWindow: 131072,
  },
  {
    id: 'groq/mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'groq',
    description: 'MoE with 32K context',
    contextWindow: 32768,
  },

  // ─── OpenRouter ────────────────────────────────────────────────────────────
  {
    id: 'minimax/minimax-m2.5:free',
    name: 'MiniMax M2.5',
    provider: 'openrouter',
    description: 'Strong general-purpose, 196k context',
    contextWindow: 196608,
    badge: 'Recommended',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Gemma 4 26B',
    provider: 'openrouter',
    description: 'Latest Google open-source',
    contextWindow: 131072,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B',
    provider: 'openrouter',
    description: 'Larger Google model, strong reasoning',
    contextWindow: 131072,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 3 Super 120B',
    provider: 'openrouter',
    description: 'NVIDIA 120B MoE, excellent all-rounder',
    contextWindow: 262144,
  },
  {
    id: 'nvidia/nemotron-nano-9b-v2:free',
    name: 'Nemotron Nano 9B',
    provider: 'openrouter',
    description: 'Reasoning + non-reasoning unified',
    contextWindow: 128000,
  },
  {
    id: 'liquid/lfm-2.5-1.2b-instruct:free',
    name: 'LFM 2.5 1.2B',
    provider: 'openrouter',
    description: 'Fast and lightweight',
    contextWindow: 32768,
  },
  {
    id: 'liquid/lfm-2.5-1.2b-thinking:free',
    name: 'LFM 2.5 Thinking',
    provider: 'openrouter',
    description: 'Lightweight reasoning model',
    contextWindow: 32768,
  },
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-oss 120B',
    provider: 'openrouter',
    description: "OpenAI's open-weight MoE",
    contextWindow: 131072,
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-oss 20B',
    provider: 'openrouter',
    description: 'Smaller OpenAI OSS model',
    contextWindow: 131072,
  },

  // ─── Cerebras ──────────────────────────────────────────────────────────────
  {
    id: 'cerebras/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout',
    provider: 'cerebras',
    description: '~2200 tok/s on wafer-scale hardware',
    contextWindow: 131072,
    badge: 'Fastest',
  },
  {
    id: 'cerebras/gpt-oss-120b',
    name: 'GPT-oss 120B',
    provider: 'cerebras',
    description: 'Ultra-fast OpenAI OSS',
    contextWindow: 131072,
  },
  {
    id: 'cerebras/llama3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'cerebras',
    description: '~2200 tok/s, great for quick queries',
    contextWindow: 131072,
  },
  {
    id: 'cerebras/qwen-2.5-coder-32b',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'cerebras',
    description: 'Code-specialist at extreme speed',
    contextWindow: 131072,
    badge: 'Code',
  },

  // ─── SambaNova ─────────────────────────────────────────────────────────────
  {
    id: 'sambanova/DeepSeek-V3.1',
    name: 'DeepSeek V3.1',
    provider: 'sambanova',
    description: 'Top open-source quality, fast',
    contextWindow: 131072,
    badge: 'Smartest',
  },
  {
    id: 'sambanova/DeepSeek-R1',
    name: 'DeepSeek R1',
    provider: 'sambanova',
    description: 'Chain-of-thought reasoning',
    contextWindow: 131072,
  },
  {
    id: 'sambanova/Llama-4-Maverick-17B-128E',
    name: 'Llama 4 Maverick',
    provider: 'sambanova',
    description: 'Latest Llama 4, 128 experts',
    contextWindow: 131072,
  },
  {
    id: 'sambanova/Meta-Llama-3.3-70B-Instruct',
    name: 'Llama 3.3 70B',
    provider: 'sambanova',
    description: 'Meta Llama 3.3 on fast hardware',
    contextWindow: 131072,
  },

  // ─── NVIDIA NIM ────────────────────────────────────────────────────────────
  {
    id: 'nvidia-nim/nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Nemotron 70B',
    provider: 'nvidia',
    description: 'Best for accuracy and reasoning',
    contextWindow: 131072,
    badge: 'Smartest',
  },
  {
    id: 'nvidia-nim/deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'nvidia',
    description: 'Chain-of-thought reasoning',
    contextWindow: 131072,
  },
  {
    id: 'nvidia-nim/meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'nvidia',
    description: 'Reliable and capable',
    contextWindow: 131072,
  },
  {
    id: 'nvidia-nim/mistralai/mixtral-8x22b-instruct-v0.1',
    name: 'Mixtral 8x22B',
    provider: 'nvidia',
    description: 'Large MoE, 141B params',
    contextWindow: 65536,
  },

  // ─── Mistral ───────────────────────────────────────────────────────────────
  {
    id: 'mistral/mistral-large-latest',
    name: 'Mistral Large',
    provider: 'mistral',
    description: 'Flagship model, strong reasoning',
    contextWindow: 131072,
    badge: 'Recommended',
  },
  {
    id: 'mistral/codestral-latest',
    name: 'Codestral',
    provider: 'mistral',
    description: 'Code generation specialist, 22B',
    contextWindow: 262144,
    badge: 'Code',
  },
  {
    id: 'mistral/mistral-small-latest',
    name: 'Mistral Small',
    provider: 'mistral',
    description: 'Fast and efficient',
    contextWindow: 131072,
  },
  {
    id: 'mistral/open-mistral-nemo',
    name: 'Mistral Nemo',
    provider: 'mistral',
    description: 'Open-weight 12B, good for RAG',
    contextWindow: 131072,
  },

  // ─── Fireworks ─────────────────────────────────────────────────────────────
  {
    id: 'accounts/fireworks/models/apriel-1.6-15b-thinker',
    name: 'Apriel 1.6 15B',
    provider: 'fireworks',
    description: 'Latest free reasoning model',
    contextWindow: 131072,
  },
  {
    id: 'accounts/fireworks/models/apriel-1.5-15b-thinker',
    name: 'Apriel 1.5 15B',
    provider: 'fireworks',
    description: 'Free reasoning model',
    contextWindow: 131072,
  },
  {
    id: 'accounts/fireworks/models/deepcoder-14b-preview',
    name: 'DeepCoder 14B',
    provider: 'fireworks',
    description: 'Free coding model',
    contextWindow: 32768,
  },
  {
    id: 'accounts/fireworks/models/together-moa-1-turbo',
    name: 'Together MoA-1',
    provider: 'fireworks',
    description: 'Free mixture-of-agents model',
    contextWindow: 32768,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getProvider(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

function formatCtx(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}k`;
  return `${tokens}`;
}

// ─── Model Picker ───────────────────────────────────────────────────────────

interface ModelPickerProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelPicker({
  selectedModel,
  onModelChange,
  disabled = false,
  className,
}: ModelPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderId | null>(null);

  const currentModel = useMemo(
    () => AVAILABLE_MODELS.find((m) => m.id === selectedModel) ?? AVAILABLE_MODELS[0],
    [selectedModel]
  );

  const provider = getProvider(currentModel.provider);

  const activeProviderId = activeProvider ?? currentModel.provider;
  const providerModels = useMemo(
    () => AVAILABLE_MODELS.filter((m) => m.provider === activeProviderId),
    [activeProviderId]
  );

  return (
    <div className={cn('flex items-center', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="h-9 gap-2 px-3 rounded-xl text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 border border-white/5 transition-colors"
          >
            <div
              className={cn(
                'flex items-center justify-center h-5 w-5 rounded-md bg-gradient-to-br text-white',
                provider.gradient
              )}
            >
              {provider.icon}
            </div>
            <span className="hidden sm:inline text-xs font-medium max-w-[100px] truncate">
              {currentModel.name}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 p-0 glass-panel border border-white/10 shadow-2xl rounded-2xl overflow-hidden"
        >
          {/* Provider tabs */}
          <div className="flex gap-1 p-2 border-b border-border/20 overflow-x-auto scrollbar-none">
            {PROVIDERS.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setActiveProvider(p.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer',
                  activeProviderId === p.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center h-4 w-4 rounded bg-gradient-to-br text-white',
                    p.gradient
                  )}
                >
                  {p.icon}
                </div>
                {p.name}
              </button>
            ))}
          </div>

          {/* Model list */}
          <div className="max-h-64 overflow-y-auto p-1.5">
            {providerModels.map((model) => (
              <button
                type="button"
                key={model.id}
                onClick={() => {
                  onModelChange(model.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer',
                  selectedModel === model.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={cn('font-medium', selectedModel === model.id && 'text-primary')}>
                    {model.name}
                  </span>
                  {model.badge && (
                    <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {model.badge}
                    </span>
                  )}
                  {selectedModel === model.id && (
                    <Check className="h-3.5 w-3.5 ml-auto text-primary" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{model.description}</span>
                  <span className="shrink-0 opacity-60">{formatCtx(model.contextWindow)} ctx</span>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Model Badge ────────────────────────────────────────────────────────────

interface ModelBadgeProps {
  modelId: string;
  className?: string;
}

export function ModelBadge({ modelId, className }: ModelBadgeProps): React.ReactElement | null {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (!model) return null;

  const provider = getProvider(model.provider);

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
      <div
        className={cn(
          'flex items-center justify-center h-3.5 w-3.5 rounded bg-gradient-to-br text-white',
          provider.gradient
        )}
      >
        {provider.icon}
      </div>
      <span className="truncate max-w-[100px]">{model.name}</span>
    </span>
  );
}

export default ModelPicker;
