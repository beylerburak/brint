"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const locale = useLocale();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    router.push(`${localePrefix}/login`);
  };

  return (
    <Button onClick={handleLogout} variant="outline">
      Log Out
    </Button>
  );
}

