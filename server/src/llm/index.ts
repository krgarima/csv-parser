import type { Config } from '@config/env';
import { GeminiProvider } from './gemini';
import { MockLLMProvider } from './mock';

export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: (string | number | boolean)[];
  description?: string;
  minItems?: number;
  maxItems?: number;
  additionalProperties?: boolean;
}

export interface LLMProvider {
  /** Free-form text generation. */
  generateText(input: { system: string; user: string; maxTokens?: number }): Promise<string>;

  /** Structured JSON generation. The provider MUST return JSON conforming to the schema. */
  generateJson<T>(input: {
    system: string;
    user: string;
    schema: JsonSchema;
    maxTokens?: number;
  }): Promise<T>;
}

export function createLLMProvider(config: Config): LLMProvider {
  switch (config.LLM_PROVIDER) {
    case 'gemini':
      return new GeminiProvider({
        apiKey: config.LLM_API_KEY,
        model: config.LLM_MODEL || 'gemini-2.5-flash',
      });
    case 'mock':
      return new MockLLMProvider();
  }
}
