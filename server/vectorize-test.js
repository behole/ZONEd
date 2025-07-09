const SimpleVectorEngine = require('./simpleVectorEngine');
const fs = require('fs');

async function testVectorization() {
  try {
    console.log('Initializing vector engine...');
    const vectorEngine = new SimpleVectorEngine({
      useOpenAI: false
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Reading database...');
    const db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
    
    if (db.content && db.content.length > 0) {
      const firstItem = db.content[0];
      console.log('Vectorizing first item:', firstItem.id);
      
      const result = await vectorEngine.addContent(firstItem);
      console.log('Result:', result);
      
      // Test search
      console.log('Testing search...');
      const searchResult = await vectorEngine.semanticSearch('test', { limit: 5 });
      console.log('Search result:', searchResult);
    } else {
      console.log('No content found in database');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testVectorization();