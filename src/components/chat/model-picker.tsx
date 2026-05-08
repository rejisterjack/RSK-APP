'use client';

import { ChevronDown, Cpu, Crown, Lock, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProviderKeys } from '@/hooks/use-provider-keys';
import { cn } from '@/lib/utils';

export interface ModelOption {
  id: string;
  name: string;
  provider: 'openrouter' | 'groq' | 'nvidia' | 'fireworks' | 'cerebras' | 'sambanova' | 'mistral';
  description: string;
  contextWindow: number;
  isFree?: boolean;
  isPremium?: boolean;
  badge?: string;
  requiresKey?: string;
}

/**
 * Complete model catalog — free models are always available,
 * premium models unlock when the user provides their own API key.
 */
export const AVAILABLE_MODELS: ModelOption[] = [
  // ─── OpenRouter Free Models ───────────────────────────────────────────────
  {
    id: 'openrouter/free',
    name: 'Auto (Free Router)',
    provider: 'openrouter',
    description: 'Automatically picks the best free model',
    contextWindow: 200000,
    isFree: true,
    badge: 'Easiest',
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Trinity Large Preview',
    provider: 'openrouter',
    description: '400B MoE, 13B active, great for creative tasks',
    contextWindow: 131000,
    isFree: true,
    badge: 'Recommended',
  },
  {
    id: 'stepfun/step-3.5-flash:free',
    name: 'Step 3.5 Flash',
    provider: 'openrouter',
    description: '196B MoE reasoning model, speed efficient',
    contextWindow: 256000,
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 3 Super 120B',
    provider: 'openrouter',
    description: 'NVIDIA 120B MoE, excellent all-rounder',
    contextWindow: 262144,
    isFree: true,
  },
  {
    id: 'qwen/qwen3-coder:free',
    name: 'Qwen3 Coder 480B',
    provider: 'openrouter',
    description: '480B MoE coding specialist, 262k context',
    contextWindow: 262000,
    isFree: true,
  },
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    name: 'Qwen3 Next 80B',
    provider: 'openrouter',
    description: 'Efficient 80B MoE, 262k context',
    contextWindow: 262144,
    isFree: true,
  },
  {
    id: 'minimax/minimax-m2.5:free',
    name: 'MiniMax M2.5',
    provider: 'openrouter',
    description: 'Strong general-purpose, 196k context',
    contextWindow: 196608,
    isFree: true,
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    name: 'Hermes 3 405B',
    provider: 'openrouter',
    description: 'Massive 405B model, instruction-tuned',
    contextWindow: 131072,
    isFree: true,
  },
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-oss 120B',
    provider: 'openrouter',
    description: "OpenAI's open-weight MoE, 117B params",
    contextWindow: 131072,
    isFree: true,
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    name: 'GLM 4.5 Air',
    provider: 'openrouter',
    description: 'Lightweight agent-focused MoE with thinking mode',
    contextWindow: 131072,
    isFree: true,
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B',
    provider: 'openrouter',
    description: 'Google open-source, 140+ languages, 128k context',
    contextWindow: 131072,
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b:free',
    name: 'Nemotron 3 Nano 30B',
    provider: 'openrouter',
    description: 'NVIDIA MoE, efficient for agentic tasks',
    contextWindow: 256000,
    isFree: true,
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1 24B',
    provider: 'openrouter',
    description: 'Fast Mistral model, good quality',
    contextWindow: 128000,
    isFree: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    description: 'Meta multilingual, powerful but often rate-limited',
    contextWindow: 65536,
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-nano-9b-v2:free',
    name: 'Nemotron Nano 9B v2',
    provider: 'openrouter',
    description: 'Reasoning + non-reasoning unified model',
    contextWindow: 128000,
    isFree: true,
  },
  {
    id: 'liquid/lfm-2.5-1.2b-thinking:free',
    name: 'LFM 2.5 1.2B Thinking',
    provider: 'openrouter',
    description: 'Lightweight reasoning model for RAG',
    contextWindow: 32768,
    isFree: true,
  },
  {
    id: 'liquid/lfm-2.5-1.2b-instruct:free',
    name: 'LFM 2.5 1.2B Instruct',
    provider: 'openrouter',
    description: 'Fast and lightweight',
    contextWindow: 32768,
    isFree: true,
  },
  {
    id: 'qwen/qwen3-4b:free',
    name: 'Qwen3 4B',
    provider: 'openrouter',
    description: 'Compact Qwen3, good for simple tasks',
    contextWindow: 40960,
    isFree: true,
  },
  // ─── Groq Free Models (ultra-fast LPU inference) ──────────────────────────
  // Requires GROQ_API_KEY from https://console.groq.com/keys
  {
    id: 'groq/llama-3.3-70b-versatile',
    name: 'Groq: Llama 3.3 70B',
    provider: 'groq',
    description: 'Ultra-fast 70B model on LPU hardware, best for real-time chat',
    contextWindow: 131072,
    isFree: true,
    badge: 'Fastest',
    requiresKey: 'GROQ_API_KEY',
  },
  {
    id: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Groq: Llama 4 Scout',
    provider: 'groq',
    description: 'Latest Llama 4 MoE, 16 experts, ultra-fast streaming',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'GROQ_API_KEY',
  },
  {
    id: 'groq/qwen/qwen3-32b',
    name: 'Groq: Qwen3 32B',
    provider: 'groq',
    description: 'Strong multilingual model, fast inference',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'GROQ_API_KEY',
  },
  {
    id: 'groq/mixtral-8x7b-32768',
    name: 'Groq: Mixtral 8x7B',
    provider: 'groq',
    description: 'MoE with 32K context, great for long documents',
    contextWindow: 32768,
    isFree: true,
    requiresKey: 'GROQ_API_KEY',
  },

  // ─── NVIDIA NIM Free Models (high-quality DGX Cloud) ──────────────────────
  // Requires NVIDIA_API_KEY from https://build.nvidia.com/settings/api-keys
  {
    id: 'nvidia-nim/nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'NVIDIA: Nemotron 70B',
    provider: 'nvidia',
    description: 'NVIDIA fine-tuned Llama, best for accuracy and reasoning',
    contextWindow: 131072,
    isFree: true,
    badge: 'Smartest',
    requiresKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'nvidia-nim/deepseek-ai/deepseek-r1',
    name: 'NVIDIA: DeepSeek R1',
    provider: 'nvidia',
    description: 'Chain-of-thought reasoning, great for complex analysis',
    contextWindow: 131072,
    isFree: true,
    badge: 'Reasoning',
    requiresKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'nvidia-nim/meta/llama-3.1-70b-instruct',
    name: 'NVIDIA: Llama 3.1 70B',
    provider: 'nvidia',
    description: 'Meta Llama on DGX Cloud, reliable and capable',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'nvidia-nim/mistralai/mixtral-8x22b-instruct-v0.1',
    name: 'NVIDIA: Mixtral 8x22B',
    provider: 'nvidia',
    description: 'Large MoE model, 141B params, strong quality',
    contextWindow: 65536,
    isFree: true,
    requiresKey: 'NVIDIA_API_KEY',
  },

  // ─── Cerebras Free Models (fastest inference on the planet) ────────────────
  // Requires CEREBRAS_API_KEY from https://cloud.cerebras.ai
  {
    id: 'cerebras/llama-4-scout-17b-16e-instruct',
    name: 'Cerebras: Llama 4 Scout',
    provider: 'cerebras',
    description: '~2200 tok/s, Llama 4 MoE on wafer-scale hardware',
    contextWindow: 131072,
    isFree: true,
    badge: 'Fastest',
    requiresKey: 'CEREBRAS_API_KEY',
  },
  {
    id: 'cerebras/gpt-oss-120b',
    name: 'Cerebras: GPT-oss 120B',
    provider: 'cerebras',
    description: 'Ultra-fast OpenAI OSS, excellent reasoning quality',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'CEREBRAS_API_KEY',
  },
  {
    id: 'cerebras/llama3.1-8b',
    name: 'Cerebras: Llama 3.1 8B',
    provider: 'cerebras',
    description: 'Blazing fast 8B model, ~2200 tok/s, great for quick queries',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'CEREBRAS_API_KEY',
  },
  {
    id: 'cerebras/qwen-2.5-coder-32b',
    name: 'Cerebras: Qwen 2.5 Coder 32B',
    provider: 'cerebras',
    description: 'Code-specialist Qwen at extreme speed',
    contextWindow: 131072,
    isFree: true,
    badge: 'Code',
    requiresKey: 'CEREBRAS_API_KEY',
  },

  // ─── SambaNova Free Models (fast Llama & DeepSeek) ────────────────────────
  // Requires SAMBANOVA_API_KEY from https://cloud.sambanova.ai
  {
    id: 'sambanova/DeepSeek-V3.1',
    name: 'SambaNova: DeepSeek V3.1',
    provider: 'sambanova',
    description: 'Latest DeepSeek, top open-source quality, fast inference',
    contextWindow: 131072,
    isFree: true,
    badge: 'Smartest',
    requiresKey: 'SAMBANOVA_API_KEY',
  },
  {
    id: 'sambanova/DeepSeek-R1',
    name: 'SambaNova: DeepSeek R1',
    provider: 'sambanova',
    description: 'Chain-of-thought reasoning on fast hardware',
    contextWindow: 131072,
    isFree: true,
    badge: 'Reasoning',
    requiresKey: 'SAMBANOVA_API_KEY',
  },
  {
    id: 'sambanova/Llama-4-Maverick-17B-128E',
    name: 'SambaNova: Llama 4 Maverick',
    provider: 'sambanova',
    description: 'Latest Llama 4, 128 experts, strong quality',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'SAMBANOVA_API_KEY',
  },
  {
    id: 'sambanova/Meta-Llama-3.3-70B-Instruct',
    name: 'SambaNova: Llama 3.3 70B',
    provider: 'sambanova',
    description: 'Meta Llama 3.3 on fast SambaNova hardware',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'SAMBANOVA_API_KEY',
  },

  // ─── Mistral Free Models (Codestral + Mistral Large) ──────────────────────
  // Requires MISTRAL_API_KEY from https://console.mistral.ai
  {
    id: 'mistral/mistral-large-latest',
    name: 'Mistral: Large',
    provider: 'mistral',
    description: "Mistral's flagship model, strong reasoning and multilingual",
    contextWindow: 131072,
    isFree: true,
    badge: 'Recommended',
    requiresKey: 'MISTRAL_API_KEY',
  },
  {
    id: 'mistral/codestral-latest',
    name: 'Mistral: Codestral',
    provider: 'mistral',
    description: 'Specialized code generation model, 22B params',
    contextWindow: 262144,
    isFree: true,
    badge: 'Code',
    requiresKey: 'MISTRAL_API_KEY',
  },
  {
    id: 'mistral/mistral-small-latest',
    name: 'Mistral: Small',
    provider: 'mistral',
    description: 'Fast and efficient, great for simple tasks',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'MISTRAL_API_KEY',
  },
  {
    id: 'mistral/open-mistral-nemo',
    name: 'Mistral: Nemo',
    provider: 'mistral',
    description: 'Open-weight 12B, multilingual, good for RAG',
    contextWindow: 131072,
    isFree: true,
    requiresKey: 'MISTRAL_API_KEY',
  },

  // ─── OpenRouter Premium Models (require own API key) ──────────────────────
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    description: 'Best coding & analysis model',
    contextWindow: 200000,
    isPremium: true,
    badge: 'Top Tier',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    description: "OpenAI's flagship multimodal model",
    contextWindow: 128000,
    isPremium: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openrouter',
    description: 'Fast and cost-efficient GPT-4o',
    contextWindow: 128000,
    isPremium: true,
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    provider: 'openrouter',
    description: "Google's best via OpenRouter, 2M context",
    contextWindow: 2097152,
    isPremium: true,
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'openrouter',
    description: 'Powerful open-weight model',
    contextWindow: 128000,
    isPremium: true,
  },
  // ─── Fireworks AI Models (require Fireworks key) ──────────────────────────
  {
    id: 'accounts/fireworks/models/llama4-maverick-instruct-basic',
    name: 'Llama 4 Maverick',
    provider: 'fireworks',
    description: 'Latest Llama 4, 1M context',
    contextWindow: 1000000,
    isPremium: true,
    badge: 'New',
  },
  {
    id: 'accounts/fireworks/models/qwq-32b',
    name: 'QwQ 32B',
    provider: 'fireworks',
    description: 'Reasoning model, excellent for analysis',
    contextWindow: 32768,
    isPremium: true,
  },
  {
    id: 'accounts/fireworks/models/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'fireworks',
    description: 'Advanced reasoning chain-of-thought',
    contextWindow: 65536,
    isPremium: true,
  },
  {
    id: 'accounts/fireworks/models/apriel-1.5-15b-thinker',
    name: 'Apriel 1.5 15B Thinker',
    provider: 'fireworks',
    description: 'Free reasoning model on Fireworks',
    contextWindow: 131072,
    isFree: true,
  },
  {
    id: 'accounts/fireworks/models/apriel-1.6-15b-thinker',
    name: 'Apriel 1.6 15B Thinker',
    provider: 'fireworks',
    description: 'Latest free reasoning model on Fireworks',
    contextWindow: 131072,
    isFree: true,
  },
  {
    id: 'accounts/fireworks/models/deepcoder-14b-preview',
    name: 'DeepCoder 14B Preview',
    provider: 'fireworks',
    description: 'Free coding model on Fireworks',
    contextWindow: 32768,
    isFree: true,
  },
  {
    id: 'accounts/fireworks/models/together-moa-1-turbo',
    name: 'Together MoA-1 Turbo',
    provider: 'fireworks',
    description: 'Free mixture-of-agents model',
    contextWindow: 32768,
    isFree: true,
  },
];

interface ModelPickerProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k`;
  return `${tokens}`;
}

function getProviderIcon(provider: ModelOption['provider']) {
  switch (provider) {
    case 'openrouter':
      return <Sparkles className="h-4 w-4 text-yellow-500" />;
    case 'fireworks':
      return <Sparkles className="h-4 w-4 text-orange-500" />;
    case 'groq':
      return <Cpu className="h-4 w-4 text-purple-500" />;
    case 'nvidia':
      return <Cpu className="h-4 w-4 text-green-600" />;
    case 'cerebras':
      return <Cpu className="h-4 w-4 text-red-500" />;
    case 'sambanova':
      return <Cpu className="h-4 w-4 text-teal-500" />;
    case 'mistral':
      return <Cpu className="h-4 w-4 text-blue-500" />;
    default:
      return <Cpu className="h-4 w-4" />;
  }
}

export function ModelPicker({
  selectedModel,
  onModelChange,
  disabled = false,
  className,
}: ModelPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { has: hasKey } = useProviderKeys();

  // Determine which providers have custom API keys set
  const hasOpenRouterKey = hasKey('openrouter');
  const hasFireworksKey = hasKey('fireworks');
  const hasGroqKey = hasKey('groq');
  const hasNvidiaKey = hasKey('nvidia');
  const hasCerebrasKey = hasKey('cerebras');
  const hasSambanovaKey = hasKey('sambanova');
  const hasMistralKey = hasKey('mistral');

  const visibleModels = useMemo(() => {
    return AVAILABLE_MODELS.filter((model) => {
      // Provider-locked models require their specific key
      if (model.requiresKey) {
        const keyMap: Record<string, boolean> = {
          GROQ_API_KEY: hasGroqKey,
          NVIDIA_API_KEY: hasNvidiaKey,
          CEREBRAS_API_KEY: hasCerebrasKey,
          SAMBANOVA_API_KEY: hasSambanovaKey,
          MISTRAL_API_KEY: hasMistralKey,
        };
        return keyMap[model.requiresKey] ?? false;
      }

      // Free models without requiresKey are always available
      if (model.isFree) return true;

      // Premium models require the corresponding API key
      if (model.isPremium) {
        return model.provider === 'openrouter' ? hasOpenRouterKey : hasFireworksKey;
      }

      return false;
    });
  }, [
    hasOpenRouterKey,
    hasFireworksKey,
    hasGroqKey,
    hasNvidiaKey,
    hasCerebrasKey,
    hasSambanovaKey,
    hasMistralKey,
  ]);

  const currentModel = visibleModels.find((m) => m.id === selectedModel) || visibleModels[0];

  const freeModels = visibleModels.filter((m) => m.isFree && !m.requiresKey);
  const groqModels = visibleModels.filter((m) => m.provider === 'groq');
  const cerebrasModels = visibleModels.filter((m) => m.provider === 'cerebras');
  const sambanovaModels = visibleModels.filter((m) => m.provider === 'sambanova');
  const nvidiaModels = visibleModels.filter((m) => m.provider === 'nvidia');
  const mistralModels = visibleModels.filter((m) => m.provider === 'mistral');
  const premiumOpenRouterModels = visibleModels.filter(
    (m) => m.provider === 'openrouter' && m.isPremium
  );
  const fireworksModels = visibleModels.filter((m) => m.provider === 'fireworks');

  const hasPremiumModels = premiumOpenRouterModels.length > 0 || fireworksModels.length > 0;

  // Count how many providers are locked
  const lockedProviders: string[] = [];
  if (!hasOpenRouterKey) lockedProviders.push('OpenRouter Premium');
  if (!hasGroqKey) lockedProviders.push('Groq');
  if (!hasCerebrasKey) lockedProviders.push('Cerebras');
  if (!hasSambanovaKey) lockedProviders.push('SambaNova');
  if (!hasNvidiaKey) lockedProviders.push('NVIDIA NIM');
  if (!hasMistralKey) lockedProviders.push('Mistral');
  if (!hasFireworksKey) lockedProviders.push('Fireworks AI');

  const renderModelItem = (model: ModelOption) => (
    <DropdownMenuItem
      key={model.id}
      onClick={() => {
        onModelChange(model.id);
        setOpen(false);
      }}
      className={cn(
        'flex flex-col items-start gap-1 py-2 cursor-pointer',
        selectedModel === model.id && 'bg-accent'
      )}
    >
      <div className="flex items-center gap-2 w-full">
        <span className="font-medium">{model.name}</span>
        {model.isFree && (
          <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">
            Free
          </span>
        )}
        {model.isPremium && (
          <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Crown className="h-2.5 w-2.5" />
            Premium
          </span>
        )}
        {model.badge && (
          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
            {model.badge}
          </span>
        )}
        {selectedModel === model.id && <Sparkles className="h-3 w-3 ml-auto text-primary" />}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{model.description}</span>
        <span>·</span>
        <span>{formatContextWindow(model.contextWindow)} context</span>
      </div>
    </DropdownMenuItem>
  );

  const renderGroup = (label: string, models: ModelOption[]) => {
    if (models.length === 0) return null;
    return (
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
        {models.map(renderModelItem)}
      </DropdownMenuGroup>
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn('h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground', className)}
        >
          {getProviderIcon(currentModel.provider)}
          <span className="max-w-[120px] truncate hidden sm:inline">{currentModel.name}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          {currentModel.isFree && (
            <span className="ml-1 text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
              Free
            </span>
          )}
          {currentModel.isPremium && (
            <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
              Premium
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[70vh] overflow-y-auto glass-panel border-border/30 shadow-2xl rounded-2xl"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Select Model
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Free tier models — always visible */}
        {renderGroup('Free Models', freeModels)}

        {/* Groq models — ultra-fast LPU inference */}
        {groqModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {renderGroup('Groq (Ultra-Fast)', groqModels)}
          </>
        )}

        {/* Cerebras models — fastest inference on the planet */}
        {cerebrasModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {renderGroup('Cerebras (Fastest)', cerebrasModels)}
          </>
        )}

        {/* SambaNova models — fast Llama & DeepSeek */}
        {sambanovaModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {renderGroup('SambaNova (Fast + Smart)', sambanovaModels)}
          </>
        )}

        {/* NVIDIA models — high-quality DGX Cloud */}
        {nvidiaModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {renderGroup('NVIDIA NIM (High Quality)', nvidiaModels)}
          </>
        )}

        {/* Mistral models — Codestral + Large */}
        {mistralModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {renderGroup('Mistral AI (General + Code)', mistralModels)}
          </>
        )}

        {/* Premium models — visible only with API keys */}
        {hasPremiumModels && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Crown className="h-3 w-3" />
              Premium Models (Your API Key)
            </DropdownMenuLabel>
          </>
        )}

        {premiumOpenRouterModels.length > 0 &&
          renderGroup('OpenRouter Premium', premiumOpenRouterModels)}

        {fireworksModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {renderGroup('Fireworks AI', fireworksModels)}
          </>
        )}

        {/* Locked provider hint */}
        {lockedProviders.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground/70 mb-0.5">Unlock more models</p>
                <p>
                  Add your API keys in the{' '}
                  <span className="text-primary font-medium">API Keys</span> settings to access{' '}
                  {lockedProviders.join(', ')} models.
                </p>
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ModelBadgeProps {
  modelId: string;
  className?: string;
}

export function ModelBadge({ modelId, className }: ModelBadgeProps): React.ReactElement | null {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (!model) return null;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
      {getProviderIcon(model.provider)}
      <span className="truncate max-w-[100px]">{model.name}</span>
      {model.isFree && (
        <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1 rounded">
          Free
        </span>
      )}
      {model.isPremium && (
        <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 rounded">
          Premium
        </span>
      )}
    </span>
  );
}

export default ModelPicker;
