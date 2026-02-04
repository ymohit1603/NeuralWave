#!/usr/bin/env node

/**
 * Migration Verification Script
 * Checks if all required files are in place for Next.js deployment
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  // Config files
  'package.json',
  'next.config.ts',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.js',
  
  // App structure
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/providers.tsx',
  'src/app/globals.css',
  'src/app/not-found.tsx',
  
  // Pages
  'src/app/dashboard/page.tsx',
  'src/app/dashboard/settings/page.tsx',
  
  // API routes
  'src/app/api/youtube/extract/route.ts',
  'src/app/api/youtube/download/route.ts',
  
  // Components
  'src/components/pages/Dashboard.tsx',
  'src/components/pages/Landing.tsx',
  'src/components/pages/Settings.tsx',
  'src/components/dashboard/Sidebar.tsx',
  'src/components/dashboard/AudioUploader.tsx',
  'src/components/dashboard/AudioProcessor.tsx',
  
  // Lib
  'src/lib/youtubeExtractor.ts',
  'src/lib/audioProcessor.ts',
  'src/lib/utils.ts',
  
  // Hooks
  'src/hooks/useUserPreferences.ts',
  
  // Public
  'public/favicon.ico',
  
  // Documentation
  'README.md',
  'DEPLOYMENT_GUIDE.md',
  'MIGRATION_SUMMARY.md',
  'TEST_DEPLOYMENT.md',
];

const optionalFiles = [
  '.gitignore',
  'components.json',
];

console.log('🔍 Verifying Next.js Migration...\n');

let allGood = true;
let missingCount = 0;

// Check required files
console.log('📋 Checking required files:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  if (exists) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allGood = false;
    missingCount++;
  }
});

console.log('\n📋 Checking optional files:');
optionalFiles.forEach(file => {
  const exists = fs.existsSync(file);
  if (exists) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ⚠️  ${file} - Optional, but recommended`);
  }
});

// Check package.json for Next.js
console.log('\n📦 Checking package.json:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.dependencies?.next) {
    console.log(`  ✅ Next.js found (${packageJson.dependencies.next})`);
  } else {
    console.log('  ❌ Next.js not found in dependencies');
    allGood = false;
  }
  
  if (packageJson.scripts?.dev === 'next dev') {
    console.log('  ✅ Dev script configured');
  } else {
    console.log('  ❌ Dev script not configured correctly');
    allGood = false;
  }
  
  if (packageJson.scripts?.build === 'next build') {
    console.log('  ✅ Build script configured');
  } else {
    console.log('  ❌ Build script not configured correctly');
    allGood = false;
  }
  
  if (packageJson.scripts?.start === 'next start') {
    console.log('  ✅ Start script configured');
  } else {
    console.log('  ❌ Start script not configured correctly');
    allGood = false;
  }
} catch (error) {
  console.log('  ❌ Error reading package.json:', error.message);
  allGood = false;
}

// Check for old Vite files (should be removed)
console.log('\n🗑️  Checking for old Vite files (should not exist):');
const oldFiles = [
  'vite.config.ts',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
];

let oldFilesFound = false;
oldFiles.forEach(file => {
  const exists = fs.existsSync(file);
  if (exists) {
    console.log(`  ⚠️  ${file} - Old Vite file still exists (can be removed)`);
    oldFilesFound = true;
  }
});

if (!oldFilesFound) {
  console.log('  ✅ No old Vite files found');
}

// Check for 'use client' in client components
console.log('\n🎯 Checking for "use client" directives:');
const clientComponents = [
  'src/components/pages/Dashboard.tsx',
  'src/components/pages/Landing.tsx',
  'src/components/pages/Settings.tsx',
  'src/components/dashboard/Sidebar.tsx',
  'src/components/dashboard/AudioUploader.tsx',
  'src/components/dashboard/AudioProcessor.tsx',
  'src/app/providers.tsx',
];

clientComponents.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes("'use client'") || content.includes('"use client"')) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ⚠️  ${file} - Missing 'use client' directive`);
    }
  }
});

// Summary
console.log('\n' + '='.repeat(60));
if (allGood && missingCount === 0) {
  console.log('✅ Migration verification PASSED!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npm install');
  console.log('   2. Run: npm run dev');
  console.log('   3. Test at http://localhost:3000');
  console.log('   4. Run: npm run build');
  console.log('   5. Deploy to Vercel/Netlify');
  console.log('\n📖 See TEST_DEPLOYMENT.md for detailed instructions');
  process.exit(0);
} else {
  console.log('❌ Migration verification FAILED!');
  console.log(`\n   ${missingCount} required file(s) missing`);
  console.log('\n📝 Please fix the issues above before deploying');
  process.exit(1);
}
