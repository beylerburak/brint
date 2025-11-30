const { enqueueFacebookPublish } = require('./src/core/queue/publication.queue.js');

async function test() {
  try {
    const job = await enqueueFacebookPublish({
      publicationId: 'cmilxbkhy0001ss2pq38sm2j0',
      workspaceId: 'ws_beyler',
      brandId: 'cmikgul570003jkpr3a0pj09l',
    }, 0);
    console.log('✅ Job re-enqueued:', job.id);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();
