import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadDataset } from '@/api/datasets';

export function UploadCard() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  const upload = useMutation({
    mutationFn: uploadDataset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['datasets'] });
      setName('');
      if (inputRef.current) inputRef.current.value = '';
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err?.response?.data?.error?.message ?? 'Upload failed');
    },
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    upload.mutate({ file, name: name.trim() || undefined });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a CSV</CardTitle>
        <CardDescription>
          Drop a CSV file (≤10MB, ≤50,000 rows). We'll detect column types and let you build charts.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Optional name (defaults to filename)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {upload.isPending ? 'Uploading…' : 'Choose CSV'}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onPick}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
