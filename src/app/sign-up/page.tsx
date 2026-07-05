import Link from "next/link";
import { SignUpForm } from "@/components/SignUpForm";
import { Card } from "@/components/ui/Card";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  const redirectTo = callbackURL || "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-soft px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="font-display text-2xl mb-1">Create your account</h1>
        <p className="text-sm text-muted mb-6">Start scheduling your construction projects</p>
        <SignUpForm redirectTo={redirectTo} />
        <p className="text-sm text-muted text-center mt-6">
          Already have an account?{" "}
          <Link
            href={`/sign-in${callbackURL ? `?callbackURL=${encodeURIComponent(callbackURL)}` : ""}`}
            className="text-ink font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
