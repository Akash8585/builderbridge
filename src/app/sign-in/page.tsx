import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { SignInForm } from "@/components/SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  const redirectTo = callbackURL || "/projects";
  const signUpHref = `/sign-up${callbackURL ? `?callbackURL=${encodeURIComponent(callbackURL)}` : ""}`;

  return (
    <AuthShell
      title="Sign in"
      description="Welcome back. Use Google or your email to open BuilderBridge."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={signUpHref} className="font-semibold text-ink underline-offset-2 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <SignInForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
