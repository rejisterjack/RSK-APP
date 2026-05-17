import pg from 'pg';

async function testConnection() {
  console.log('--- RAW PG DRIVER TEST ---');
  const dbs = ['postgres', 'ragdb', 'rag-starter-kit', 'rsk'];
  
  for (const dbName of dbs) {
    const url = `postgresql://postgres:postgres@localhost:5432/${dbName}?sslmode=disable`;
    console.log(`\nTesting connection to "${dbName}"...`);
    const pool = new pg.Pool({ connectionString: url });
    
    try {
      const client = await pool.connect();
      console.log(`[PG] Success! Connected to database "${dbName}"`);
      
      const res = await client.query('SELECT 1 as val');
      console.log(`[PG] Query result:`, res.rows);
      
      // Let's query active databases to see what databases are available!
      if (dbName === 'postgres') {
        const dbsRes = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
        const activeDbs = dbsRes.rows.map(r => r.datname);
        console.log(`[PG] Available Databases in system:`, activeDbs);
      }
      
      client.release();
      await pool.end();
    } catch (err: any) {
      console.error(`[PG] Failed for "${dbName}":`, err.message || err);
      try { await pool.end(); } catch {}
    }
  }
}

testConnection().catch(console.error);
