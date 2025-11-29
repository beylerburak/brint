import { appConfig } from "@/shared/config";
import { logger } from "@/shared/utils/logger";

export default function ConfigDebugPage() {
  logger.debug("CONFIG:", appConfig);

  return (
    <div>
      <h1>Config Debug</h1>
      <pre>{JSON.stringify(appConfig, null, 2)}</pre>
    </div>
  );
}

