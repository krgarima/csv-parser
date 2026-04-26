import { useQuery } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { suggestQuestions, type SuggestedQuestion } from '@/api/ai';
import type { AskResponseSpec } from '@/api/ai';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function SuggestedQuestions({
  datasetId,
  onApply,
}: {
  datasetId: string;
  onApply: (spec: AskResponseSpec) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['suggestions', datasetId],
    queryFn: () => suggestQuestions(datasetId),
    staleTime: 1000 * 60 * 60,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4" />
            Generating starter questions…
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error || !data || data.questions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" />
          Try these questions
        </CardTitle>
        <CardDescription>Click any question to open it in the chart builder.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-3">
        {data.questions.map((q: SuggestedQuestion, i) => (
          <Button
            key={i}
            variant="outline"
            className="h-auto whitespace-normal py-3 text-left justify-start"
            onClick={() =>
              onApply({
                chartType: q.chartType,
                xColumn: q.xColumn,
                yColumn: q.yColumn,
                aggregation: q.aggregation,
              })
            }
          >
            <span className="text-sm">{q.text}</span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
