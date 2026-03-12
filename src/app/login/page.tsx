'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Wrong password');
        setPassword('');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1c1c1e]">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-6 p-8"
      >
        {/* H logo */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="116" y="100" width="58" height="312" rx="29" fill="#e8e8ee" />
          <rect x="338" y="100" width="58" height="312" rx="29" fill="#a0a0b0" />
          <rect
            x="148"
            y="228"
            width="216"
            height="50"
            rx="25"
            fill="#c0c0cc"
            transform="rotate(-6 256 253)"
          />
        </svg>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder=""
          autoFocus
          className="w-48 px-4 py-2.5 text-center text-sm bg-white/[0.06] border border-white/[0.08] rounded-xl text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
          style={{ letterSpacing: '0.2em' }}
        />

        {error && (
          <span className="text-xs text-red-400/70">{error}</span>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="px-6 py-2 text-xs font-medium tracking-widest uppercase text-white/50 hover:text-white/80 transition-colors disabled:opacity-30"
        >
          {loading ? '...' : 'Enter'}
        </button>
      </form>
    </div>
  );
}
