const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.pool = null;
    this.isPostgres = false;
    this.dbPath = path.join(__dirname, 'db.json');
    this.initializeDatabase();
  }

  async initializeDatabase() {
    // Debug environment variables
    console.log('🔍 Environment check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('- DATABASE_URL preview:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not set');
    
    // Check if we have a DATABASE_URL (PostgreSQL)
    if (process.env.DATABASE_URL) {
      try {
        console.log('🚀 Initializing PostgreSQL connection...');
        
        const poolConfig = {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          // Add connection pool settings for Railway
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        };
        
        console.log('📊 Pool config:', { 
          ssl: poolConfig.ssl, 
          max: poolConfig.max, 
          connectionTimeoutMillis: poolConfig.connectionTimeoutMillis 
        });
        
        this.pool = new Pool(poolConfig);

        // Test the connection with timeout
        console.log('🔗 Testing database connection...');
        const client = await Promise.race([
          this.pool.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000)
          )
        ]);
        
        const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
        console.log('📅 Database time:', result.rows[0].current_time);
        console.log('🗄️ PostgreSQL version:', result.rows[0].postgres_version.split(' ')[0]);
        client.release();
        
        this.isPostgres = true;
        console.log('✅ PostgreSQL connected successfully');
        
        // Create tables if they don't exist
        console.log('🏗️ Creating tables...');
        await this.createTables();
        console.log('✅ Tables created/verified');
        
        // Migrate existing JSON data if needed
        console.log('📦 Checking for JSON migration...');
        await this.migrateFromJSON();
        console.log('✅ Migration check complete');
        
      } catch (error) {
        console.error('❌ PostgreSQL connection failed:');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Full error:', error);
        console.log('⚠️ Falling back to JSON file storage...');
        this.isPostgres = false;
        this.pool = null;
      }
    } else {
      console.log('⚠️ No DATABASE_URL found, using JSON file storage');
      console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('DATA')));
      this.isPostgres = false;
    }
    
    console.log('🏁 Database initialization complete. Using:', this.isPostgres ? 'PostgreSQL' : 'JSON file');
  }

  async createTables() {
    if (!this.isPostgres) return;

    const createContentTable = `
      CREATE TABLE IF NOT EXISTS content (
        id BIGINT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        processed BOOLEAN DEFAULT false,
        content TEXT,
        extracted_content TEXT,
        cleaned_content TEXT,
        chunks JSONB,
        keywords JSONB,
        fingerprint VARCHAR(50),
        metadata JSONB,
        submissions JSONB,
        importance_score DECIMAL,
        submission_patterns JSONB,
        urgency_assessment JSONB,
        contextual_tags JSONB,
        last_submission TIMESTAMPTZ,
        submission_count INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const createNotesTable = `
      CREATE TABLE IF NOT EXISTS notes (
        id BIGINT PRIMARY KEY,
        content TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    try {
      await this.pool.query(createContentTable);
      await this.pool.query(createNotesTable);
      console.log('✅ Database tables created/verified');
    } catch (error) {
      console.error('❌ Error creating tables:', error.message);
      throw error;
    }
  }

  async migrateFromJSON() {
    if (!this.isPostgres) return;

    try {
      // Check if we have existing data in PostgreSQL
      const { rows } = await this.pool.query('SELECT COUNT(*) FROM content');
      const existingCount = parseInt(rows[0].count);

      if (existingCount > 0) {
        console.log(`PostgreSQL already has ${existingCount} content items, skipping migration`);
        return;
      }

      // Check if JSON file exists and has data
      if (!fs.existsSync(this.dbPath)) {
        console.log('No JSON file to migrate from');
        return;
      }

      const jsonData = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      const contentItems = jsonData.content || [];
      const noteItems = jsonData.notes || [];

      if (contentItems.length === 0 && noteItems.length === 0) {
        console.log('No data to migrate from JSON file');
        return;
      }

      console.log(`Migrating ${contentItems.length} content items and ${noteItems.length} notes from JSON to PostgreSQL...`);

      // Migrate content items
      for (const item of contentItems) {
        await this.insertContent(item);
      }

      // Migrate notes
      for (const note of noteItems) {
        await this.insertNote(note);
      }

      console.log('✅ Migration completed successfully');

      // Backup the JSON file
      const backupPath = this.dbPath + '.migrated.' + Date.now();
      fs.copyFileSync(this.dbPath, backupPath);
      console.log(`JSON file backed up to: ${backupPath}`);

    } catch (error) {
      console.error('❌ Migration error:', error.message);
      // Don't throw - continue with empty database
    }
  }

  async insertContent(item) {
    if (this.isPostgres) {
      const query = `
        INSERT INTO content (
          id, type, timestamp, processed, content, extracted_content, 
          cleaned_content, chunks, keywords, fingerprint, metadata,
          submissions, importance_score, submission_patterns, 
          urgency_assessment, contextual_tags, last_submission, submission_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          submissions = EXCLUDED.submissions,
          importance_score = EXCLUDED.importance_score,
          submission_patterns = EXCLUDED.submission_patterns,
          urgency_assessment = EXCLUDED.urgency_assessment,
          contextual_tags = EXCLUDED.contextual_tags,
          last_submission = EXCLUDED.last_submission,
          submission_count = EXCLUDED.submission_count,
          updated_at = NOW()
      `;

      const values = [
        item.id,
        item.type,
        item.timestamp,
        item.processed || false,
        item.content,
        item.extractedContent || null,
        item.cleanedContent || null,
        JSON.stringify(item.chunks || []),
        JSON.stringify(item.keywords || []),
        item.fingerprint || null,
        JSON.stringify(item.metadata || {}),
        JSON.stringify(item.submissions || []),
        item.importanceScore || null,
        JSON.stringify(item.submissionPatterns || {}),
        JSON.stringify(item.urgencyAssessment || {}),
        JSON.stringify(item.contextualTags || []),
        item.lastSubmission || null,
        item.submissionCount || 1
      ];

      await this.pool.query(query, values);
    } else {
      // JSON file fallback
      const db = this.readJSONDB();
      db.content = db.content || [];
      
      const existingIndex = db.content.findIndex(existing => existing.id === item.id);
      if (existingIndex !== -1) {
        db.content[existingIndex] = item;
      } else {
        db.content.push(item);
      }
      
      this.writeJSONDB(db);
    }
  }

  async insertNote(note) {
    if (this.isPostgres) {
      const query = `
        INSERT INTO notes (id, content, timestamp)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          timestamp = EXCLUDED.timestamp
      `;

      const values = [
        note.id || Date.now(),
        note.content,
        note.timestamp
      ];

      await this.pool.query(query, values);
    } else {
      // JSON file fallback
      const db = this.readJSONDB();
      db.notes = db.notes || [];
      db.notes.push(note);
      this.writeJSONDB(db);
    }
  }

  async getAllContent() {
    if (this.isPostgres) {
      const { rows } = await this.pool.query(`
        SELECT 
          id, type, timestamp, processed, content, extracted_content as "extractedContent",
          cleaned_content as "cleanedContent", chunks, keywords, fingerprint, metadata,
          submissions, importance_score as "importanceScore", 
          submission_patterns as "submissionPatterns",
          urgency_assessment as "urgencyAssessment",
          contextual_tags as "contextualTags",
          last_submission as "lastSubmission",
          submission_count as "submissionCount"
        FROM content 
        ORDER BY timestamp DESC
      `);

      return rows.map(row => ({
        ...row,
        chunks: typeof row.chunks === 'string' ? JSON.parse(row.chunks) : row.chunks,
        keywords: typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        submissions: typeof row.submissions === 'string' ? JSON.parse(row.submissions) : row.submissions,
        submissionPatterns: typeof row.submissionPatterns === 'string' ? JSON.parse(row.submissionPatterns) : row.submissionPatterns,
        urgencyAssessment: typeof row.urgencyAssessment === 'string' ? JSON.parse(row.urgencyAssessment) : row.urgencyAssessment,
        contextualTags: typeof row.contextualTags === 'string' ? JSON.parse(row.contextualTags) : row.contextualTags
      }));
    } else {
      const db = this.readJSONDB();
      return db.content || [];
    }
  }

  async getAllNotes() {
    if (this.isPostgres) {
      const { rows } = await this.pool.query('SELECT * FROM notes ORDER BY timestamp DESC');
      return rows;
    } else {
      const db = this.readJSONDB();
      return db.notes || [];
    }
  }

  readJSONDB() {
    try {
      if (fs.existsSync(this.dbPath)) {
        return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading JSON database:', error.message);
    }
    return { notes: [], content: [] };
  }

  writeJSONDB(data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing JSON database:', error.message);
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

module.exports = Database;