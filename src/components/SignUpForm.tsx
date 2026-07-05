"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ErrorText } from "@/components/ui/ErrorText";

export function SignUpForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogle() {
    // #region agent log
    fetch("http://127.0.0.1:7600/ingest/68e6e7cf-5da8-4f72-982e-1527774b51c8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ed1ad1" },
      body: JSON.stringify({
        sessionId: "ed1ad1",
        location: "SignUpForm.tsx:handleGoogle",
        message: "Google button clicked",
        data: { hypothesisId: "H1", redirectTo, time: Date.now() },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    await authClient.signIn.social({ provider: "google", callbackURL: redirectTo });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Contractor"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <div className="relative py-2 text-center">
        <span className="bg-canvas px-2 text-xs text-muted-soft relative z-10">or</span>
        <div className="absolute inset-x-0 top-1/2 h-px bg-hairline" />
      </div>
      <Button type="button" variant="secondary" className="w-full" onClick={handleGoogle}>
        Continue with Google
      </Button>
    </form>
  );
}
