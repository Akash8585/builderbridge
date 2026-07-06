import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isEmailConfigured } from "@/lib/email";
import { NotificationToggle } from "@/components/NotificationToggle";
import { Card } from "@/components/ui/Card";

export default async function SettingsPage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, emailNotificationsEnabled: true },
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">Settings</h1>
      <p className="text-sm text-muted mb-8">
        {dbUser.name} · {dbUser.email}
      </p>

      <Card className="p-6">
        <h2 className="text-sm font-semibold mb-4">Notifications</h2>
        <NotificationToggle initialEnabled={dbUser.emailNotificationsEnabled} />
        {!isEmailConfigured() && (
          <p className="text-xs text-muted-soft mt-4 border-t border-hairline-soft pt-4">
            Email sending isn&apos;t configured on this server yet (no <code>RESEND_API_KEY</code>) — notifications
            are currently skipped regardless of this setting.
          </p>
        )}
      </Card>
    </div>
  );
}
