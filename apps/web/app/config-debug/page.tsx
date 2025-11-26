import { appConfig } from "@/shared/config";

export default function ConfigDebugPage() {
  console.log("CONFIG:", appConfig);

  return (
    <div>
      <h1>Config Debug</h1>
      <pre>{JSON.stringify(appConfig, null, 2)}</pre>
    </div>
  );
}

