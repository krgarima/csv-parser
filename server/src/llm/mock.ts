import type { JsonSchema, LLMProvider } from './index';

/**
 * Deterministic mock for tests and dev when no API key is available.
 * Returns reasonable shapes for the three AI use cases this app has.
 */
export class MockLLMProvider implements LLMProvider {
  async generateText(input: { system: string; user: string }): Promise<string> {
    return `[mock] Echoing context: ${input.user.slice(0, 80)}...`;
  }

  async generateJson<T>(input: { system: string; user: string; schema: JsonSchema }): Promise<T> {
    // Heuristic: detect by required fields in the schema what shape to return.
    const required = input.schema.required ?? [];

    // ask_spec / chart spec
    if (required.includes('chartType') && required.includes('xColumn')) {
      return {
        chartType: 'bar',
        xColumn: '__MOCK_X__',
        yColumn: '__MOCK_Y__',
        aggregation: 'sum',
      } as T;
    }

    // suggest_questions: { questions: [{ text, ... }] }
    if (input.schema.type === 'object' && input.schema.properties?.questions) {
      return {
        questions: [
          { text: 'Which category has the highest total?', chartType: 'bar' },
          { text: 'How does the metric trend over time?', chartType: 'line' },
          { text: "What's the share of each segment?", chartType: 'pie' },
        ],
      } as T;
    }

    // explain_chart: { summary, followUp }
    if (required.includes('summary')) {
      return {
        summary: '[mock] This chart shows a meaningful trend. Replace with a real LLM for production.',
        followUp: 'What would the breakdown look like by another dimension?',
      } as T;
    }

    // Fallback: empty object shaped like the schema.
    return {} as T;
  }
}
