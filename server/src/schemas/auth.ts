import { z } from 'zod';

export const SignupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;
