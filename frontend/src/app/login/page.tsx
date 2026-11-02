'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cloud, Eye, EyeOff, Lock, LogIn } from 'lucide-react';
import { apiRequest, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@mylibrary.local');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ accessToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setToken(res.accessToken);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Não foi possível entrar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading">
        <div className="brand-header">
          <div className="brand-icon">
            <Cloud size={24} />
          </div>
          <div>
            <h1 id="login-heading" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              MyLibrary Cloud
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Acesse sua nuvem pessoal de arquivos e documentos
            </p>
          </div>
        </div>

        {error && (
          <div className="alert-banner alert-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              E-mail de acesso
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Senha
            </label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className="form-input"
                autoComplete="current-password"
                enterKeyHint="done"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
            disabled={loading}
          >
            <LogIn size={18} />
            {loading ? 'Autenticando...' : 'Entrar na Nuvem'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.1rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Lock size={15} style={{ flexShrink: 0, color: 'var(--accent)' }} />
          <span>
            Ambiente privado protegido por autenticação JWT. Conta inicial:{' '}
            <strong>admin@mylibrary.local</strong> / <strong>admin123</strong>
          </span>
        </div>
      </section>
    </main>
  );
}
