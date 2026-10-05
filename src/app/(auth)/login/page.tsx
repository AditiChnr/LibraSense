'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { LogIn, BookOpen, AlertCircle, Sparkles } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('from') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Firebase Auth Client sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // 2. Sync session cookie with server API
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, uid: userCredential.user.uid }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Redirect to target path
      router.push(data.user.role === 'admin' ? '/admin' : redirectPath);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const msg = err instanceof Error ? err.message : 'Invalid credentials';
      setError(msg);
      setLoading(false);
    }
  };

  const handleQuickSeed = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/seed');
      if (res.ok) {
        alert('Database seeded with demo users and floors!');
      } else {
        alert('Seed failed or already seeded.');
      }
    } catch {
      alert('Error triggering seed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-2">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">LibraSense</h1>
        <p className="text-sm text-slate-400">Smart Library Seat & Study Management System</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@librasense.edu"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-indigo-600/20 flex justify-center items-center space-x-2 text-sm"
        >
          <LogIn className="w-4 h-4" />
          <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
        </button>
      </form>

      {/* Quick Demo Autofill Helpers */}
      <div className="border-t border-slate-800 pt-4 space-y-2">
        <p className="text-xs text-slate-500 text-center font-medium">Quick Demo Accounts:</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setEmail('student@librasense.edu');
              setPassword('studentPass123!');
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-lg text-center transition"
          >
            Demo Student
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail('admin@librasense.edu');
              setPassword('adminPass123!');
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-lg text-center transition"
          >
            Demo Admin
          </button>
        </div>
        <button
          type="button"
          onClick={handleQuickSeed}
          className="w-full text-xs text-indigo-400 hover:text-indigo-300 pt-2 flex items-center justify-center space-x-1"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Initialize / Seed Demo Database</span>
        </button>
      </div>

      {/* Footer Link */}
      <div className="text-center text-xs text-slate-500 pt-2">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-indigo-400 hover:underline font-medium">
          Register Student Account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
