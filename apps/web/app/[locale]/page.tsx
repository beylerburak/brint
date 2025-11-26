import { redirect } from "next/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // Always redirect to login in the current locale context
  // If locale is default (en), it will be /login (no prefix)
  // If locale is tr, it will be /tr/login
  if (locale === "en") {
    redirect("/login");
  } else {
    redirect(`/${locale}/login`);
  }
}

