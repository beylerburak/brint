import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env first, then apps/api/.env if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { prisma } from '../src/lib/prisma.js';

async function main() {
  // Try both 'beyler' and 'ws_beyler' as slug
  const slugs = ['beyler', 'ws_beyler'];
  
  for (const slug of slugs) {
    const ws = await prisma.workspace.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    
    if (ws) {
      console.log(JSON.stringify(ws, null, 2));
      await prisma.$disconnect();
      return;
    }
  }
  
  console.log('Workspace not found with slugs:', slugs);
  await prisma.$disconnect();
}

main().catch(console.error);

