import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { login, logout, me, signup, type User } from '@/api/auth';

const ME_KEY = ['me'];

export function useMe() {
  return useQuery<User | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await me();
      } catch {
        return null;
      }
    },
    retry: false,
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: signup,
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.clear();
    },
  });
}
