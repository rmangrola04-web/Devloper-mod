// Pure in-memory session interfaces (No localStorage or sessionStorage used)
export interface AuthSession {
  user: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'SECURITY' | 'OPERATOR';
  name: string;
}

export const DEFAULT_SESSION: AuthSession = {
  user: 'admin',
  role: 'ADMIN',
  name: 'Admin Officer'
};
