// ===== BUILD SCRIPT FOR VERCEL =====
// Replaces Supabase credentials with environment variables
// This script runs during Vercel build process

const fs = require('fs');
const path = require('path');

// Read the template file
const templatePath = path.join(__dirname, 'js', 'eventhive-supabase.template.js');
const outputPath = path.join(__dirname, 'js', 'eventhive-supabase.js');

// Get environment variables (Vercel will provide these)
// For local development, these can be in .env.local file
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Only fail in production (Vercel) - allow local dev to use template
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (isVercel && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.error('ERROR: Supabase credentials not found in environment variables!');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  WARNING: Supabase credentials not found in environment variables!');
  console.warn('   For local development, create .env.local with:');
  console.warn('   NEXT_PUBLIC_SUPABASE_URL=your_url');
  console.warn('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key');
  console.warn('   Using template file as fallback...');
  
  // For local dev without env vars, just copy template (will need manual edit)
  const template = fs.readFileSync(templatePath, 'utf8');
  fs.writeFileSync(outputPath, template, 'utf8');
  console.log('✅ Template file copied (update credentials manually for local dev)');
  return;
}

// Read template
let template = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders
template = template.replace('{{SUPABASE_URL}}', SUPABASE_URL);
template = template.replace('{{SUPABASE_ANON_KEY}}', SUPABASE_ANON_KEY);

// Write output
fs.writeFileSync(outputPath, template, 'utf8');

console.log('✅ Supabase credentials injected successfully');
console.log(`   URL: ${SUPABASE_URL.substring(0, 30)}...`);

