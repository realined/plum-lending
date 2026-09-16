import { ArrowRight, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";
export function LoginScreen({
  password,
  busy,
  error,
  onPasswordChange,
  onSignIn,
}: {
  password: string;
  busy: string | null;
  error: string;
  onPasswordChange: (value: string) => void;
  onSignIn: () => void;
}) {
  return (
    <main className="login-screen">
      <div className="login-card">
        <Brand />
        <p className="eyebrow">SECURE WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to your lending intelligence workspace.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSignIn();
          }}
        >
          <label htmlFor="password">Administrator password</label>
          <input
            autoFocus
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
          />
          <button className="primary" disabled={Boolean(busy)}>
            Sign in <ArrowRight size={16} />
          </button>
        </form>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <small>
          <ShieldCheck size={14} /> Credentials stay on your server.
        </small>
      </div>
    </main>
  );
}
