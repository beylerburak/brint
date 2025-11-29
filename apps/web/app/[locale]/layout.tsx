import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/shared/i18n/locales";
import { AuthProvider } from "@/features/auth/context/auth-context";
import { WorkspaceProvider } from "@/features/space/context/workspace-context";
import { PermissionProvider } from "@/permissions";
import { ProtectedLayout } from "@/components/protected-layout";
import { SpaceGuard } from "@/features/space/components/space-guard";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Providing all messages to the client
  // Make sure to pass the locale explicitly
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        <WorkspaceProvider params={{ locale }}>
          <PermissionProvider>
            <ProtectedLayout>
              <SpaceGuard>
                {children}
              </SpaceGuard>
            </ProtectedLayout>
          </PermissionProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
