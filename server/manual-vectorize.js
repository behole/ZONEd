const SimpleVectorEngine = require('./simpleVectorEngine');
const fs = require('fs');

async function vectorizeAllContent() {
  try {
    console.log('Initializing vector engine...');
    const vectorEngine = new SimpleVectorEngine({
      useOpenAI: false
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    console.log('Reading database...');
    const db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
    
    const allContent = [...(db.content || []), ...(db.notes || [])];
    console.log(`Found ${allContent.length} items to vectorize`);
    
    let synced = 0;
    let failed = 0;
    
    for (let i = 0; i < allContent.length; i++) {
      const item = allContent[i];
      try {
        console.log(`Processing item ${i + 1}/${allContent.length}: ${item.id}`);
        
        // Convert legacy notes to new format if needed
        const contentItem = item.content && !item.type ? {
          ...item,
          id: item.id || Date.now() + Math.random(),
          type: 'text',
          cleanedContent: item.content,
          importanceScore: 1.0,
          submissionCount: 1,
          contextualTags: []
        } : item;
        
        const result = await vectorEngine.addContent(contentItem);
        
        if (result.success) {
          synced++;
          console.log(`✓ Vectorized: ${contentItem.id}`);
        } else {
          failed++;
          console.log(`✗ Failed: ${contentItem.id} - ${result.error}`);
        }
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error.message);
        failed++;
      }
    }
    
    console.log(`\nVectorization complete:`);
    console.log(`- Synced: ${synced}`);
    console.log(`- Failed: ${failed}`);
    console.log(`- Total: ${allContent.length}`);
    
    // Test search
    console.log('\nTesting search...');
    const searchResult = await vectorEngine.semanticSearch('dentist appointment', { limit: 3 });
    console.log('Search results:', searchResult.results?.length || 0, 'found');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

vectorizeAllContent();