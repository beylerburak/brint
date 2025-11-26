import { httpClient } from "@/shared/http";

export default async function HttpDebugPage() {
  const res = await httpClient.get("/health/full");

  return (
    <div style={{ padding: "2rem" }}>
      <h1>HTTP Debug</h1>
      <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "4px" }}>
        {JSON.stringify(res, null, 2)}
      </pre>
    </div>
  );
}

