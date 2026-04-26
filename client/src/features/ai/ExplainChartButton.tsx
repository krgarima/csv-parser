import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explainChart } from '@/api/ai';

export function ExplainChartButton({ chartId }: { chartId: string }) {
  const [open, setOpen] = useState(false);

  const explain = useMutation({
    mutationFn: () => explainChart(chartId),
  });

  const onClick = () => {
    if (!explain.data && !explain.isPending) explain.mutate();
    setOpen((o) => !o);
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={onClick} className="gap-2 self-start">
        <Sparkles className="h-3.5 w-3.5" />
        {explain.isPending ? 'Thinking…' : open ? 'Hide explanation' : 'Explain this chart'}
      </Button>
      {open && explain.data && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
          <p>{explain.data.explanation.summary}</p>
          <p className="text-muted-foreground italic">
            Try asking: <span className="font-medium not-italic">{explain.data.explanation.followUp}</span>
          </p>
        </div>
      )}
      {open && explain.error && (
        <p className="text-sm text-destructive">
          Couldn't generate an explanation right now. Try again in a moment.
        </p>
      )}
    </div>
  );
}
