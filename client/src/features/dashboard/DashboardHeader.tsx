import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogout, useMe } from '@/features/auth/useAuth';

export function DashboardHeader() {
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <header className="border-b bg-background">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/dashboard" className="font-semibold tracking-tight">
          CSV Analytics
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {user && (
            <span>
              Hi, <span className="text-foreground font-medium">{user.name ?? user.email}</span>
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()} className="gap-1">
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
