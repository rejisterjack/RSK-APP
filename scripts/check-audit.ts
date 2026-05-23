import 'dotenv/config';

async function main() {
  const { prisma } = await import('../src/lib/db');
  
  // Get the latest chat message audit events
  const logs = await prisma.auditLog.findMany({
    where: { event: 'CHAT_MESSAGE_SENT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      createdAt: true,
      metadata: true,
      userId: true,
      workspaceId: true,
    },
  });
  
  for (const log of logs) {
    const meta = log.metadata as any;
    console.log(`\n[${log.createdAt.toISOString()}]`);
    console.log(`  userId: ${log.userId}`);
    console.log(`  workspaceId: ${log.workspaceId}`);
    console.log(`  metadata:`, JSON.stringify(meta, null, 2));
  }
}

main().catch(console.error);
