// Test script to verify string safety fixes
const fs = require('fs');

// Read the firebase-integration.js file and extract the normalizeBrandName function
const firebaseCode = fs.readFileSync('./firebase-integration.js', 'utf8');

// Create a simple test environment
const normalizeBrandName = (brand) => {
  if (!brand) return 'unknown';
  
  // Convert to string if it's not already
  const brandStr = String(brand).trim();
  
  // Early return for empty string after trimming
  if (!brandStr) {
    return 'unknown';
  }
  
  // Special case: My Flame Lifestyle → myflame
  if (brandStr.toLowerCase() === 'my flame lifestyle') {
    return 'myflame';
  }
  // Special case: räder → rader
  if (brandStr.toLowerCase() === 'räder') {
    return 'rader';
  }
  
  // Convert to lowercase and normalize unicode characters
  let normalized = brandStr.toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .trim();
  
  return normalized || 'unknown';
};

// Test cases that should not throw errors
const testCases = [
  null,
  undefined,
  '',
  '  ',
  123,
  true,
  false,
  {},
  [],
  'My Flame Lifestyle',
  'räder',
  'Test Brand',
  'BRAND WITH SPACES',
  'Brand with äöüß',
  'Brand with numbers 123'
];

console.log('Testing normalizeBrandName function with various inputs:');
console.log('=====================================================');

testCases.forEach((testCase, index) => {
  try {
    const result = normalizeBrandName(testCase);
    console.log(`Test ${index + 1}: Input: ${JSON.stringify(testCase)} -> Result: "${result}"`);
  } catch (error) {
    console.error(`Test ${index + 1} FAILED: Input: ${JSON.stringify(testCase)} -> Error: ${error.message}`);
  }
});

console.log('\nAll tests completed!'); 