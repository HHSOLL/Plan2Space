import { AuthCallbackClient } from "../../../components/auth/AuthCallbackClient";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function AuthCallbackPage({ searchParams }: { searchParams?: SearchParams }) {
  return (
    <AuthCallbackClient
      code={firstValue(searchParams?.code)}
      error={firstValue(searchParams?.error)}
      errorDescription={firstValue(searchParams?.error_description)}
      nextPath={firstValue(searchParams?.next)}
    />
  );
}
