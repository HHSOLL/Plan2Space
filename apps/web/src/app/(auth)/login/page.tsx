import { LoginForm } from "../../../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Login</h1>
      <LoginForm />
    </div>
  );
}
