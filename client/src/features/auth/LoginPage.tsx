import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useLogin, useMe } from './useAuth';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof Schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', password: '' },
  });

  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login.mutateAsync(values);
      navigate('/dashboard');
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Login failed';
      setServerError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Log in to your CSV Analytics workspace.</CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 items-stretch">
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? 'Logging in…' : 'Log in'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              No account?{' '}
              <Link to="/signup" className="underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
