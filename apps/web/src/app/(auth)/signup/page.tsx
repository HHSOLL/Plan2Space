import { SignupForm } from "../../../components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Sign Up</h1>
      <SignupForm />
    </div>
  );
}
