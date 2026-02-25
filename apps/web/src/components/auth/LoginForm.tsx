"use client";

import { useState } from "react";
import { useAuthStore } from "../../lib/stores/useAuthStore";

export function LoginForm() {
  const { login, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void login(email, password);
      }}
    >
      <label className="block text-sm font-medium text-stone-700">
        Email
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Password
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          placeholder="••••••••"
        />
      </label>
      {error ? <div className="text-xs text-rose-600">{error}</div> : null}
      <button
        type="submit"
        disabled={isLoading || !email || !password}
        className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50 disabled:opacity-40"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
