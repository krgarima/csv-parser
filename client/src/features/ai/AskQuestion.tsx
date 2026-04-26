import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { askQuestion, type AskResponseSpec } from '@/api/ai';
import type { AggregationBucket } from '@/api/charts';
import { ChartRenderer } from '@/features/charts/ChartRenderer';

export function AskQuestion({
  datasetId,
  onApplySpec,
}: {
  datasetId: string;
  onApplySpec: (spec: AskResponseSpec) => void;
}) {
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ spec: AskResponseSpec; buckets: AggregationBucket[] } | null>(null);

  const ask = useMutation({
    mutationFn: askQuestion,
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err?.response?.data?.error?.message ?? "I couldn't map that to a chart — try rephrasing.");
      setResult(null);
    },
  });

  const submit = () => {
    if (!question.trim()) return;
    ask.mutate({ datasetId, question: question.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          Ask a question
        </CardTitle>
        <CardDescription>
          Describe a question in plain English. We translate it into a chart spec — the LLM never writes SQL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder='e.g. "revenue by month" or "top categories by total"'
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <Button onClick={submit} disabled={ask.isPending || !question.trim()}>
            {ask.isPending ? 'Thinking…' : 'Ask'}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="font-medium">Interpreted as:</p>
              <p className="text-muted-foreground">
                {result.spec.aggregation === 'count'
                  ? 'count rows'
                  : `${result.spec.aggregation}(${result.spec.yColumn})`}{' '}
                by {result.spec.xColumn}, as a {result.spec.chartType} chart
              </p>
            </div>
            <div className="rounded-md border p-3">
              <ChartRenderer type={result.spec.chartType} buckets={result.buckets} height={240} />
            </div>
            <Button variant="outline" size="sm" onClick={() => onApplySpec(result.spec)}>
              Open in chart builder
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
