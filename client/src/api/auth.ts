import { api } from './client';

export interface User {
  id: string;
  email: string;
  createdAt?: string;
}

export async function signup(input: { email: string; password: string }): Promise<User> {
  const { data } = await api.post('/api/auth/signup', input);
  return data.user as User;
}

export async function login(input: { email: string; password: string }): Promise<User> {
  const { data } = await api.post('/api/auth/login', input);
  return data.user as User;
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}

export async function me(): Promise<User> {
  // Side effect: the CSRF middleware on /api/auth issues the csv_csrf cookie
  // on this GET so subsequent mutating requests can attach the X-CSRF-Token header.
  const { data } = await api.get('/api/auth/me');
  return data.user as User;
}
