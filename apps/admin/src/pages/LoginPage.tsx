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
    <div className="min-h-screen bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-white/20 items-center justify-center text-3xl mb-4">
            💊
          </div>
          <h1 className="text-2xl font-bold text-white">United Pharmacy</h1>
          <p className="text-white/70 mt-1">Admin Portal</p>
        </div>

        {/* Form card */}
        <div className="card p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Sign In to Admin Panel
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email or Phone
              </label>
              <input
                className="input"
                type="text"
                placeholder="admin@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/60 text-sm mt-6">
          United Pharmacy Driver Operations Platform
        </p>
      </div>
    </div>
  );
}
