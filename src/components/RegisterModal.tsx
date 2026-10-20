import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { UserAccount, UserRole } from '../types';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (newUser: UserAccount) => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onRegister }) => {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('SUPERVISOR');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setMsg('Please fill all required fields.');
      return;
    }
    const newUser: UserAccount = {
      name: fullName.trim() || username.trim(),
      role,
      user: username.trim().toLowerCase(),
      pass: password.trim()
    };
    onRegister(newUser);
    setFullName('');
    setUsername('');
    setPassword('');
    setMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 max-w-md w-full p-4 shadow-xl space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Register New User Account
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {msg && (
          <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-2 rounded border border-rose-200 dark:border-rose-800">
            {msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Display Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Duty Officer / Rahul"
              required
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Select Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="SUPERVISOR">Supervisor</option>
              <option value="SECURITY">Security Guard</option>
              <option value="OPERATOR">Operator</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose username"
              required
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set password"
              required
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded text-xs shadow-xs transition"
            >
              Save & Register User
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 rounded text-xs transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
