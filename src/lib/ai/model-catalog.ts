export interface CatalogModel {
  id: string;
  name: string;
  description: string;
  tier: 'free' | 'pro';
  contextLength: number;
  strengths: string[];
}

export const MODEL_CATALOG: CatalogModel[] = [
  // Free models (OpenRouter :free suffix)
  {
    id: 'google/gemma-3-12b-it:free',
    name: 'Gemma 3 12B',
    description: 'Fast & reliable',
    tier: 'free',
    contextLength: 128_000,
    strengths: ['Fast', 'Balanced'],
  },
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-OSS 120B',
    description: 'Very capable',
    tier: 'free',
    contextLength: 128_000,
    strengths: ['Reasoning'],
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B',
    description: 'Larger Gemma variant',
    tier: 'free',
    contextLength: 128_000,
    strengths: ['Quality'],
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B',
    description: "Meta's best free model",
    tier: 'free',
    contextLength: 128_000,
    strengths: ['Versatile'],
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-OSS 20B',
    description: 'Smaller & faster',
    tier: 'free',
    contextLength: 128_000,
    strengths: ['Speed'],
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    name: 'Hermes 405B',
    description: 'Very capable but slow',
    tier: 'free',
    contextLength: 128_000,
    strengths: ['Quality'],
  },

  // Pro models (paid on OpenRouter — shown with Pro badge)
  {
    id: 'anthropic/claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: 'Best for reasoning',
    tier: 'pro',
    contextLength: 200_000,
    strengths: ['Reasoning', 'Code'],
  },
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    description: 'OpenAI flagship',
    tier: 'pro',
    contextLength: 128_000,
    strengths: ['Reasoning', 'Versatile'],
  },
  {
    id: 'google/gemini-2.5-pro-preview-06-05',
    name: 'Gemini 2.5 Pro',
    description: "Google's best",
    tier: 'pro',
    contextLength: 1_000_000,
    strengths: ['Context', 'Quality'],
  },
  {
    id: 'deepseek/deepseek-r1-0528',
    name: 'DeepSeek R1',
    description: 'Chain-of-thought reasoning',
    tier: 'pro',
    contextLength: 164_000,
    strengths: ['Reasoning'],
  },
];

export function getFreeModels(): CatalogModel[] {
  return MODEL_CATALOG.filter((m) => m.tier === 'free');
}

export function getProModels(): CatalogModel[] {
  return MODEL_CATALOG.filter((m) => m.tier === 'pro');
}

export function getCatalogModel(modelId: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}
