import { post, get } from './api';
import type { AuthTokens, User } from '@/types';

const TOKEN_KEY = 'auth_tokens';

export function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  document.cookie = 'ws_authenticated=1; path=/; SameSite=Lax';
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('current_org_id');
  document.cookie = 'ws_authenticated=; path=/; Max-Age=0';
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: User; tokens: AuthTokens }> {
  const response = await post<{ user: User; tokens: AuthTokens }>('/auth/login', {
    email,
    password,
  });
  if (response.success && response.data) {
    setStoredTokens(response.data.tokens);
    return response.data;
  }
  throw new Error(response.error?.message || 'Login failed');
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export async function register(
  data: RegisterData,
): Promise<{ user: User; tokens: AuthTokens }> {
  const response = await post<{ user: User; tokens: AuthTokens }>(
    '/auth/register',
    data,
  );
  if (response.success && response.data) {
    setStoredTokens(response.data.tokens);
    return response.data;
  }
  throw new Error(response.error?.message || 'Registration failed');
}

export async function logout(): Promise<void> {
  try {
    await post('/auth/logout');
  } finally {
    clearStoredTokens();
  }
}

export async function getCurrentUser(): Promise<User> {
  const response = await get<User>('/auth/me');
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error?.message || 'Failed to fetch current user');
}
