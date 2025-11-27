"use client";

import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="bg-background fixed inset-0 flex flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
