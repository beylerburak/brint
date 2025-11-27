"use client";

import { LoginForm } from "@/features/auth/components/login-form";

export default function DebugFormsPage() {
  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "2rem" }}>Form Debug</h1>
      <div className="max-w-sm mx-auto mt-10">
        <LoginForm />
      </div>
    </div>
  );
}

