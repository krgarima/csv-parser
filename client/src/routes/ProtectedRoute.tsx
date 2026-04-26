import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '@/features/auth/useAuth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
