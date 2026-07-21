import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { SignUpForm } from "@/components/SignUpForm";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  const redirectTo = callbackURL || "/projects";
  const signInHref = `/sign-in${callbackURL ? `?callbackURL=${encodeURIComponent(callbackURL)}` : ""}`;

  return (
    <AuthShell
      title="Sign up"
      description="Create an account to schedule projects, run weekly plans, and use Agent."
      footer={
        <>
          Already have an account?{" "}
          <Link href={signInHref} className="font-semibold text-ink underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
