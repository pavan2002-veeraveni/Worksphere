import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import {
  clearStoredTokens,
  getCurrentUser,
  getStoredTokens,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
  RegisterData,
} from '@/lib/auth';
import { clearAuth, setUser } from '@/store/slices/authSlice';

export function useCurrentUser() {
  const dispatch = useDispatch();
  const hasToken = typeof window !== 'undefined' && Boolean(getStoredTokens());

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const user = await getCurrentUser();
      dispatch(setUser(user));
      return user;
    },
    enabled: hasToken,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginApi(email, password),
    onSuccess: (data) => {
      dispatch(setUser(data.user));
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  return useMutation({
    mutationFn: (data: RegisterData) => registerApi(data),
    onSuccess: (data) => {
      dispatch(setUser(data.user));
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  return useMutation({
    mutationFn: () => logoutApi(),
    onSettled: () => {
      clearStoredTokens();
      dispatch(clearAuth());
      queryClient.clear();
    },
  });
}
