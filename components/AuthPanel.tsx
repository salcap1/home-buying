"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AuthMode = "sign_in" | "create";

type AuthPanelProps = {
  brandName: string;
  tagline: string;
  busy?: boolean;
  error?: string;
  onSubmit: (input: { mode: AuthMode; password: string }) => Promise<void> | void;
};

export function AuthPanel({ brandName, tagline, busy, error, onSubmit }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError("");
    if (mode === "create") {
      if (password.length < 8) {
        setLocalError("Use at least 8 characters");
        return;
      }
      if (password !== confirm) {
        setLocalError("Passwords do not match");
        return;
      }
    }
    await onSubmit({ mode, password });
  }

  return (
    <div className="auth-panel">
      <header className="auth-brand">
        <p className="auth-kicker">{tagline}</p>
        <h1 className="auth-title">{brandName}</h1>
      </header>

      <p className="auth-copy">
        {mode === "sign_in"
          ? "Enter your password to open your board."
          : "One password, one board — no email or username."}
      </p>

      <div className="auth-tabs" role="tablist" aria-label="Account">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign_in"}
          className={mode === "sign_in" ? "is-active" : undefined}
          onClick={() => {
            setMode("sign_in");
            setLocalError("");
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          className={mode === "create" ? "is-active" : undefined}
          onClick={() => {
            setMode("create");
            setLocalError("");
          }}
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <Label htmlFor="workspace-password">Password</Label>
          <Input
            id="workspace-password"
            type="password"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
            placeholder={mode === "create" ? "At least 8 characters" : undefined}
          />
        </div>
        {mode === "create" ? (
          <div className="auth-field">
            <Label htmlFor="workspace-password-confirm">Confirm password</Label>
            <Input
              id="workspace-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              required
            />
          </div>
        ) : null}
        {localError || error ? (
          <p className="auth-error" role="alert">
            {localError || error}
          </p>
        ) : null}
        <Button type="submit" className="auth-submit" disabled={busy || !password}>
          {busy ? "Working…" : mode === "create" ? "Create account" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
