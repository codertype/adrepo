#!/bin/bash

echo "🚀 Building Amrit Dairy for VPS deployment..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the frontend using VPS-compatible vite config
echo "🏗️ Building frontend..."
npx vite build --config vite.vps.config.ts

# Build the backend using VPS-compatible server entry point
echo "🏗️ Building backend..."
npx esbuild server/vps-index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist --target=node18

# Copy additional files needed for production
echo "📋 Copying additional files..."
cp package.json dist/
# Note: .env should NOT be copied to dist to prevent accidental secret exposure
# Environment variables must be configured separately on the VPS

# Create VPS-specific package.json with complete dependencies
echo "📝 Creating VPS package.json..."
node -e "
const pkg = require('./package.json');
const vpsPackage = {
  name: 'amrit-dairy-vps',
  version: '1.0.0',
  main: 'vps-index.js',
  scripts: {
    start: 'NODE_ENV=production node vps-index.js',
    pm2: 'pm2 start vps-index.js --name amrit-dairy',
    'db:push': 'drizzle-kit push'
  },
  dependencies: {
    ...pkg.dependencies,
    'drizzle-kit': pkg.devDependencies['drizzle-kit']
  }
};
require('fs').writeFileSync('dist/package.json', JSON.stringify(vpsPackage, null, 2));
console.log('✅ Created production package.json with complete dependencies and db:push script');
"

# Copy drizzle configuration for database setup
echo "📋 Copying database configuration..."
cp drizzle.config.ts dist/

echo "✅ Build complete! Files are ready in the 'dist' directory."
echo "📁 Upload the 'dist' directory contents to your VPS at /var/www/amrit-dairy/"
echo "🔧 Don't forget to:"
echo "   1. Create .env file with your configuration"
echo "   2. Run 'npm install --production' on VPS"
echo "   3. Set up Nginx reverse proxy"
echo "   4. Configure SSL certificate"