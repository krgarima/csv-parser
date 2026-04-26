import { GoogleGenAI } from '@google/genai';
import type { JsonSchema, LLMProvider } from './index';
import { logger } from '@lib/logger';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(input: { apiKey: string; model: string }) {
    this.client = new GoogleGenAI({ apiKey: input.apiKey });
    this.model = input.model;
  }

  async generateText(input: { system: string; user: string; maxTokens?: number }): Promise<string> {
    const result = await this.client.models.generateContent({
      model: this.model,
      contents: input.user,
      config: {
        systemInstruction: input.system,
        maxOutputTokens: input.maxTokens ?? 512,
        temperature: 0.4,
      },
    });
    return result.text ?? '';
  }

  async generateJson<T>(input: {
    system: string;
    user: string;
    schema: JsonSchema;
    maxTokens?: number;
  }): Promise<T> {
    const result = await this.client.models.generateContent({
      model: this.model,
      contents: input.user,
      config: {
        systemInstruction: input.system,
        responseMimeType: 'application/json',
        responseSchema: input.schema as object,
        maxOutputTokens: input.maxTokens ?? 1024,
        temperature: 0.2,
      },
    });
    const text = result.text ?? '';
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      logger.warn({ err, text }, 'Gemini returned non-JSON response');
      throw new Error('LLM returned malformed JSON');
    }
  }
}
