export type ModelId = 
  | "claude-sonnet-4-5-20250929"
  | "claude-sonnet-4-20250514"
  | "claude-opus-4-5-20251124"
  | "gpt-5.2-pro-2025-12-11"
  | "gpt-5.2-2025-12-11"
  | "gpt-5-pro";

export interface Model {
  id: ModelId;
  name: string;
  provider: "anthropic" | "openai";
  category: "recommended" | "anthropic" | "openai";
}

export const MODELS: Model[] = [
  // Recommended
  {
    id: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    category: "recommended",
  },
  // Anthropic
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    category: "anthropic",
  },
  {
    id: "claude-opus-4-5-20251124",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    category: "anthropic",
  },
  // OpenAI
  {
    id: "gpt-5.2-pro-2025-12-11",
    name: "GPT 5.2 Pro",
    provider: "openai",
    category: "openai",
  },
  {
    id: "gpt-5.2-2025-12-11",
    name: "GPT 5.2",
    provider: "openai",
    category: "openai",
  },
  {
    id: "gpt-5-pro",
    name: "GPT-5 Pro",
    provider: "openai",
    category: "openai",
  },
];

export const DEFAULT_MODEL: ModelId = "claude-sonnet-4-5-20250929";
