import { prisma } from "../src/lib/prisma.js";

async function main() {
  console.log("Checking activity_events table...\n");

  const count = await prisma.activityEvent.count();
  console.log(`Total events: ${count}\n`);

  if (count > 0) {
    const recentEvents = await prisma.activityEvent.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, email: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
      },
    });

    console.log("Recent events:");
    recentEvents.forEach((event, index) => {
      console.log(`\n${index + 1}. ${event.type}`);
      console.log(`   Created: ${event.createdAt.toISOString()}`);
      console.log(`   Actor: ${event.actorType} (${event.source})`);
      console.log(`   User: ${event.user?.email || "N/A"}`);
      console.log(`   Workspace: ${event.workspace?.name || "N/A"}`);
      console.log(`   Scope: ${event.scopeType || "N/A"} (${event.scopeId || "N/A"})`);
    });
  } else {
    console.log("No events found. Try logging in with Google or Magic Link.");
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

