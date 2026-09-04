import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [fileNumber, setFileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const loggedInUser = await login(fileNumber.trim(), password);
      navigate(loggedInUser.must_change_password ? '/change-password' : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-bg-img" />
      <div className="login-bg-overlay" />
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="Nyandarua County" />
          <h2>Nyandarua County Registry System</h2>
          <p>Staff Login</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-file">File Number</label>
            <input
              id="login-file"
              type="text"
              value={fileNumber}
              onChange={(e) => setFileNumber(e.target.value)}
              placeholder="Enter your file number"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-pass">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-pass"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#185FA5', fontSize: 17,
                }}
                aria-label="Toggle password visibility"
              >
                {showPw ? '\u{1F441}' : '\u{1F441}\u{FE0F}'}
              </button>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <div className="err-msg">{error}</div>}
        </form>
        <p style={{ fontSize: 11, color: '#888', marginTop: 14, textAlign: 'center' }}>
          Default password: your ID Number (or File Number if no ID on record)
        </p>
      </div>
    </div>
  );
}
