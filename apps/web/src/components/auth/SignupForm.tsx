"use client";

import { useState } from "react";
import { useAuthStore } from "../../lib/stores/useAuthStore";

export function SignupForm() {
  const { signup, isLoading, error } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void signup(email, password, name || undefined);
      }}
    >
      <label className="block text-sm font-medium text-stone-700">
        Name
        <input
          type="text"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          placeholder="Your name"
        />
      </label>
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
          placeholder="Create a password"
        />
      </label>
      {error ? <div className="text-xs text-rose-600">{error}</div> : null}
      <button
        type="submit"
        disabled={isLoading || !email || !password}
        className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50 disabled:opacity-40"
      >
        {isLoading ? "Creating..." : "Create account"}
      </button>
    </form>
  );
}
