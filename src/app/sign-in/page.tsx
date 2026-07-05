import Link from "next/link";
import { SignInForm } from "@/components/SignInForm";
import { Card } from "@/components/ui/Card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  const redirectTo = callbackURL || "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-soft px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="font-display text-2xl mb-1">Welcome back</h1>
        <p className="text-sm text-muted mb-6">Sign in to BuilderBridge</p>
        <SignInForm redirectTo={redirectTo} />
        <p className="text-sm text-muted text-center mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href={`/sign-up${callbackURL ? `?callbackURL=${encodeURIComponent(callbackURL)}` : ""}`}
            className="text-ink font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
