import type { JsonSchema, LLMProvider } from './index';

/**
 * Deterministic mock for tests and dev when no API key is available.
 *
 * The mock parses the user prompt for column metadata lines (the format the
 * AI service produces, e.g. "- revenue (number, 0 nulls, samples: ...)")
 * and returns specs that reference REAL dataset columns. Without that, every
 * AI flow would fail the column-allowlist validator downstream.
 */
export class MockLLMProvider implements LLMProvider {
  async generateText(input: { system: string; user: string }): Promise<string> {
    return `[mock] Echoing context: ${input.user.slice(0, 80)}...`;
  }

  async generateJson<T>(input: { system: string; user: string; schema: JsonSchema }): Promise<T> {
    const columns = parseColumnsFromPrompt(input.user);
    const numericCols = columns.filter((c) => c.type === 'number');
    const nonNumericCols = columns.filter((c) => c.type !== 'number');
    const xName = nonNumericCols[0]?.name ?? columns[0]?.name ?? 'mock_x';
    const yName = numericCols[0]?.name ?? null;

    const required = input.schema.required ?? [];

    // ask_spec — chart spec with x/y/agg/type
    if (required.includes('chartType') && required.includes('xColumn')) {
      return {
        chartType: 'bar',
        xColumn: xName,
        yColumn: yName,
        aggregation: yName ? 'sum' : 'count',
      } as T;
    }

    // suggest_questions — array of questions, each a complete chart spec
    if (input.schema.type === 'object' && input.schema.properties?.questions) {
      return {
        questions: [
          {
            text: `Top ${xName} by ${yName ?? 'count'}`,
            chartType: 'bar',
            xColumn: xName,
            yColumn: yName,
            aggregation: yName ? 'sum' : 'count',
          },
          {
            text: `${yName ?? 'count'} trend over time`,
            chartType: 'line',
            xColumn: xName,
            yColumn: yName,
            aggregation: yName ? 'avg' : 'count',
          },
          {
            text: `Distribution by ${xName}`,
            chartType: 'pie',
            xColumn: xName,
            yColumn: null,
            aggregation: 'count',
          },
        ],
      } as T;
    }

    // explain_chart — summary + followUp
    if (required.includes('summary')) {
      return {
        summary:
          '[mock] This chart shows a meaningful trend. Replace with a real LLM provider for production-quality narration.',
        followUp: 'What would the breakdown look like by another dimension?',
      } as T;
    }

    return {} as T;
  }
}

interface ParsedColumn {
  name: string;
  type: 'number' | 'date' | 'text';
}

function parseColumnsFromPrompt(prompt: string): ParsedColumn[] {
  const matches = [...prompt.matchAll(/^- (\S+?) \((number|date|text)/gm)];
  return matches.map((m) => ({ name: m[1]!, type: m[2]! as ParsedColumn['type'] }));
}
