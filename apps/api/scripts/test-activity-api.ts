import { prisma } from "../src/lib/prisma.js";

async function main() {
  console.log("Finding a workspace with activity events...\n");

  // Find a workspace that has activity events
  const event = await prisma.activityEvent.findFirst({
    where: {
      workspaceId: { not: null },
    },
    include: {
      workspace: {
        select: { id: true, name: true },
      },
    },
  });

  if (!event || !event.workspaceId) {
    console.log("No workspace with activity events found.");
    console.log("Please create some activity events first (login, invite, etc.)");
    return;
  }

  const workspaceId = event.workspaceId;
  const workspaceName = event.workspace?.name || workspaceId;

  console.log(`Found workspace: ${workspaceName}`);
  console.log(`Workspace ID: ${workspaceId}\n`);
  console.log("Test the API endpoint with:\n");
  console.log(`curl -H "Authorization: Bearer YOUR_TOKEN" \\`);
  console.log(`     -H "X-Workspace-Id: ${workspaceId}" \\`);
  console.log(`     "http://localhost:3001/workspaces/${workspaceId}/activity?limit=10"`);
  console.log("\nOr with query parameters:");
  console.log(`curl -H "Authorization: Bearer YOUR_TOKEN" \\`);
  console.log(`     -H "X-Workspace-Id: ${workspaceId}" \\`);
  console.log(`     "http://localhost:3001/workspaces/${workspaceId}/activity?limit=10&includeSystemEvents=false"`);
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

