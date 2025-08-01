const fs = require('fs');
const path = require('path');

// Create a simple test to add an image record to the database
const dbPath = path.join(__dirname, 'server', 'db.json');

// Read current database
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Copy test image to uploads
const srcImage = path.join(__dirname, 'query.png');
const destImage = path.join(__dirname, 'server', 'uploads', 'test-query.png');

if (fs.existsSync(srcImage)) {
  fs.copyFileSync(srcImage, destImage);
  console.log('✓ Copied test image to uploads directory');
  
  // Create a test image record
  const testImageRecord = {
    id: Date.now(),
    type: 'file',
    filename: 'test-query.png',
    originalName: 'query.png',
    size: fs.statSync(destImage).size,
    mimetype: 'image/png',
    path: destImage,
    timestamp: new Date().toISOString(),
    content: 'Test image upload',
    extractedText: 'Test image',
    processingSuccess: true,
    processingError: null,
    importanceScore: 5,
    submissionCount: 1,
    contextualTags: ['test', 'image'],
    metadata: {
      imageType: 'PNG',
      dimensions: '800x600',
      uploadPath: destImage,
      filename: 'test-query.png',
      originalName: 'query.png'
    },
    chunks: [{
      text: 'Test image',
      index: 0
    }],
    keywords: ['test', 'image'],
    fingerprint: 'test-image-' + Date.now()
  };
  
  // Add to database
  db.content.unshift(testImageRecord);
  
  // Write back to database
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  
  console.log('✓ Added test image record to database');
  console.log('Image record:', {
    id: testImageRecord.id,
    filename: testImageRecord.filename,
    mimetype: testImageRecord.mimetype,
    metadata: testImageRecord.metadata
  });
} else {
  console.log('❌ Source image not found:', srcImage);
}
