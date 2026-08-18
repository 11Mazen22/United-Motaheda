import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/lib/api';
import { adminSocket } from '@/lib/socket';
import { useAdminStore } from '@/stores/admin.store';
import { showToast } from '@/components/Toast';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAdminStore((s) => s.setAuth);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await adminApi.login(identifier, password);
      if (res.user?.role !== 'admin' && res.user?.role !== 'ADMIN') {
        showToast('Access denied — admin credentials required', 'error');
        return;
      }
      setAuth(res.token, res.user);
      adminSocket.connect();
      navigate('/');
    } catch (err: any) {
      showToast(
        err?.response?.data?.message ?? 'Login failed. Check your credentials.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pharmacy-canvas dark:bg-slate-900 flex items-center justify-center p-4 font-sans font-medium">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-pharmacy-primary items-center justify-center text-3xl mb-4 shadow-lg shadow-pharmacy-primary/30">
            💊
          </div>
          <h1 className="text-2xl font-bold text-pharmacy-ink dark:text-white">United Pharmacy</h1>
          <p className="text-pharmacy-inkSoft dark:text-gray-400 mt-1">Admin Operations</p>
        </div>

        {/* Form card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm border border-pharmacy-line dark:border-slate-700">
          <h2 className="text-xl font-bold text-pharmacy-ink dark:text-white mb-6 text-center">
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-pharmacy-inkSoft dark:text-gray-300 mb-1.5">
                Email or Phone
              </label>
              <input
                className="w-full border border-pharmacy-line dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-pharmacy-canvas dark:bg-slate-900 text-pharmacy-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-pharmacy-primary/50 focus:border-pharmacy-primary transition-all placeholder:text-pharmacy-inkFaint"
                type="text"
                placeholder="admin@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-pharmacy-inkSoft dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  className="w-full border border-pharmacy-line dark:border-slate-600 rounded-xl px-4 py-2.5 pr-10 text-sm bg-pharmacy-canvas dark:bg-slate-900 text-pharmacy-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-pharmacy-primary/50 focus:border-pharmacy-primary transition-all placeholder:text-pharmacy-inkFaint"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pharmacy-inkFaint hover:text-pharmacy-inkSoft"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pharmacy-primary hover:bg-pharmacy-primaryDark text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-60 transition-colors shadow-md shadow-pharmacy-primary/20"
            >
              {loading ? 'Signing in…' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
