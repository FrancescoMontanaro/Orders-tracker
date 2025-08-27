'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  // Auth context exposes the `login` action and a loading flag
  const { login, loading } = useAuth();
  const router = useRouter();

  // Local controlled inputs and error state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Handle submit (prevent default, clear error, attempt login)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login({ username, password });
      // On success, redirect to the app home
      router.replace('/home');
    } catch (err: any) {
      // Normalize common error shapes (fetch/axios/custom)
      const status =
        err?.status ??
        err?.response?.status ??
        err?.cause?.status ??
        err?.data?.status;

      if (status === 401) {
        setError('Credenziali non valide');
      } else {
        const msg =
          err?.message ??
          err?.response?.data?.detail ??
          err?.response?.data?.message ??
          'Errore durante il login';
        setError(String(msg));
      }
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          {/* Visible text stays in Italian */}
          <CardTitle>Accedi</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit} noValidate>
            {/* Email field (username) */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                aria-invalid={!!error}
              />
            </div>

            {/* Password field */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={!!error}
              />
            </div>

            {/* Error message (Italian UI text) */}
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            {/* Submit button (disabled while loading) */}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Accesso…' : 'Accedi'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}