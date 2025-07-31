const Database = require('./database');

class DatabaseCleanup {
  constructor() {
    this.database = new Database();
  }

  async analyzeContent() {
    console.log('🔍 Analyzing database content...');
    
    const allContent = await this.database.getAllContent();
    console.log(`📊 Total content items: ${allContent.length}`);
    
    // Categorize content
    const categories = {
      valuable: [],
      test: [],
      trash: [],
      questionable: []
    };
    
    allContent.forEach(item => {
      // Identify test/trash content
      if (this.isTestContent(item)) {
        categories.test.push(item);
      } else if (this.isTrashContent(item)) {
        categories.trash.push(item);
      } else if (this.isQuestionableContent(item)) {
        categories.questionable.push(item);
      } else {
        categories.valuable.push(item);
      }
    });
    
    console.log('\n📋 Content Analysis:');
    console.log(`✅ Valuable content: ${categories.valuable.length}`);
    console.log(`🧪 Test content: ${categories.test.length}`);
    console.log(`🗑️ Trash content: ${categories.trash.length}`);
    console.log(`❓ Questionable content: ${categories.questionable.length}`);
    
    return categories;
  }
  
  isTestContent(item) {
    const testIndicators = [
      // Content indicators
      item.content === '[Shortcut]',
      item.content === '',
      item.content === 'test',
      item.content === 'Test',
      item.content === 'testing',
      
      // Title indicators
      item.metadata?.title === 'Shared via iOS Shortcut',
      item.metadata?.title === 'Shared URL',
      item.metadata?.title === 'Shared Text',
      item.metadata?.title === 'Test',
      
      // Source indicators
      item.metadata?.sharedVia === 'ios_shortcut' && item.content.length < 10,
      item.metadata?.shareMethod === 'ios_get_request' && item.content === '[Shortcut]',
      
      // Empty or minimal content
      item.content.length < 5 && !item.metadata?.url,
      
      // Obvious test patterns
      item.content.toLowerCase().includes('test content'),
      item.content.toLowerCase().includes('sample data'),
    ];
    
    return testIndicators.some(indicator => indicator);
  }
  
  isTrashContent(item) {
    const trashIndicators = [
      // Failed extractions with no useful data
      item.metadata?.extractionQuality === 'failed' && !item.metadata?.url,
      
      // Empty content with no metadata
      !item.content && !item.extractedContent && !item.metadata?.url,
      
      // Duplicate placeholder content
      item.content === '[Text]',
      item.content === '[URL]',
      item.content === '[Title]',
      
      // Failed processing
      item.processed === false && item.error,
      
      // Very old test entries (if timestamp exists)
      item.metadata?.shareMethod === 'test' || item.metadata?.source === 'test'
    ];
    
    return trashIndicators.some(indicator => indicator);
  }
  
  isQuestionableContent(item) {
    const questionableIndicators = [
      // Short content that might be accidental
      item.content.length < 20 && item.type === 'text' && !item.metadata?.url,
      
      // Failed URL extractions but might have value
      item.metadata?.extractionQuality === 'failed_with_fallback' && item.content.length < 50,
      
      // iOS sharing attempts with minimal content
      item.metadata?.sharedVia === 'ios_shortcut' && item.content.length < 30,
      
      // No importance score (might be old format)
      !item.importanceScore && !item.submissionCount
    ];
    
    return questionableIndicators.some(indicator => indicator);
  }
  
  async previewCleanup() {
    const categories = await this.analyzeContent();
    
    console.log('\n🔍 CLEANUP PREVIEW:');
    console.log('\n🗑️ WILL DELETE (Test Content):');
    categories.test.forEach(item => {
      console.log(`  - ID: ${item.id} | Content: "${item.content.substring(0, 50)}..." | Type: ${item.type}`);
    });
    
    console.log('\n🗑️ WILL DELETE (Trash Content):');
    categories.trash.forEach(item => {
      console.log(`  - ID: ${item.id} | Content: "${item.content.substring(0, 50)}..." | Error: ${item.error || 'N/A'}`);
    });
    
    console.log('\n❓ QUESTIONABLE (Review Needed):');
    categories.questionable.forEach(item => {
      console.log(`  - ID: ${item.id} | Content: "${item.content.substring(0, 50)}..." | Type: ${item.type} | Length: ${item.content.length}`);
    });
    
    console.log('\n✅ WILL KEEP (Valuable Content):');
    categories.valuable.forEach(item => {
      console.log(`  - ID: ${item.id} | Content: "${item.content.substring(0, 50)}..." | Type: ${item.type} | Score: ${item.importanceScore || 'N/A'}`);
    });
    
    const toDelete = categories.test.length + categories.trash.length;
    console.log(`\n📊 SUMMARY:`);
    console.log(`  - Will delete: ${toDelete} items`);
    console.log(`  - Will keep: ${categories.valuable.length} items`);
    console.log(`  - Need review: ${categories.questionable.length} items`);
    
    return categories;
  }
  
  async performCleanup(categories, options = {}) {
    const { deleteTest = true, deleteTrash = true, deleteQuestionable = false } = options;
    
    let deletedCount = 0;
    
    if (deleteTest) {
      console.log('\n🧪 Deleting test content...');
      for (const item of categories.test) {
        try {
          await this.deleteContentItem(item.id);
          deletedCount++;
          console.log(`  ✅ Deleted test item: ${item.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to delete ${item.id}:`, error.message);
        }
      }
    }
    
    if (deleteTrash) {
      console.log('\n🗑️ Deleting trash content...');
      for (const item of categories.trash) {
        try {
          await this.deleteContentItem(item.id);
          deletedCount++;
          console.log(`  ✅ Deleted trash item: ${item.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to delete ${item.id}:`, error.message);
        }
      }
    }
    
    if (deleteQuestionable) {
      console.log('\n❓ Deleting questionable content...');
      for (const item of categories.questionable) {
        try {
          await this.deleteContentItem(item.id);
          deletedCount++;
          console.log(`  ✅ Deleted questionable item: ${item.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to delete ${item.id}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} items.`);
    
    // Show final stats
    const finalContent = await this.database.getAllContent();
    console.log(`📊 Database now contains ${finalContent.length} items.`);
    
    return deletedCount;
  }
  
  async deleteContentItem(id) {
    if (this.database.isPostgres) {
      await this.database.pool.query('DELETE FROM content WHERE id = $1', [id]);
    } else {
      // JSON file fallback
      const db = this.database.readJSONDB();
      db.content = db.content.filter(item => item.id !== id);
      this.database.writeJSONDB(db);
    }
  }
  
  async close() {
    await this.database.close();
  }
}

// CLI interface
async function main() {
  const cleanup = new DatabaseCleanup();
  
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'preview' || !command) {
      // Preview mode (default)
      console.log('🔍 PREVIEW MODE - No changes will be made');
      await cleanup.previewCleanup();
      console.log('\n💡 To perform cleanup, run: node cleanup-database.js clean');
      
    } else if (command === 'clean') {
      // Actual cleanup
      console.log('🧹 CLEANUP MODE - Changes will be made!');
      const categories = await cleanup.analyzeContent();
      
      // Ask for confirmation
      console.log('\n⚠️ This will permanently delete test and trash content.');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await cleanup.performCleanup(categories, {
        deleteTest: true,
        deleteTrash: true,
        deleteQuestionable: false // Keep questionable items for manual review
      });
      
    } else if (command === 'clean-all') {
      // Aggressive cleanup including questionable items
      console.log('🧹 AGGRESSIVE CLEANUP MODE - Including questionable content!');
      const categories = await cleanup.analyzeContent();
      
      console.log('\n⚠️ This will delete test, trash, AND questionable content.');
      console.log('Press Ctrl+C to cancel, or wait 10 seconds to continue...');
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      await cleanup.performCleanup(categories, {
        deleteTest: true,
        deleteTrash: true,
        deleteQuestionable: true
      });
      
    } else {
      console.log('Usage:');
      console.log('  node cleanup-database.js preview    # Preview what will be deleted');
      console.log('  node cleanup-database.js clean      # Delete test and trash content');
      console.log('  node cleanup-database.js clean-all  # Delete everything including questionable');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await cleanup.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseCleanup;