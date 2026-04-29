import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
