const { Pool } = require('./server/node_modules/pg');

async function clearDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('❌ No DATABASE_URL found');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🗑️ Clearing database...');
    
    // Drop all tables
    await pool.query('DROP TABLE IF EXISTS content CASCADE');
    await pool.query('DROP TABLE IF EXISTS notes CASCADE');
    
    console.log('✅ Database cleared successfully');
    console.log('💡 Restart your server to recreate tables');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await pool.end();
  }
}

clearDatabase();
