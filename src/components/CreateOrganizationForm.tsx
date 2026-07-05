"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ErrorText } from "@/components/ui/ErrorText";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `org-${Date.now()}`
  );
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: createError } = await authClient.organization.create({
      name,
      slug: slugify(name),
    });

    if (createError || !data) {
      setLoading(false);
      setError(createError?.message ?? "Could not create organization.");
      return;
    }

    await authClient.organization.setActive({ organizationId: data.id });
    setLoading(false);
    router.push("/projects");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="orgName">Company / Team name</Label>
        <Input
          id="orgName"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Construction Co."
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
