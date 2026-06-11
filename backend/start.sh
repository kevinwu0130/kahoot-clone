#!/bin/sh
set -e

echo "Patching Prisma schema for PostgreSQL..."
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

echo "Generating Prisma client..."
npx prisma generate

echo "Pushing schema to database..."
npx prisma db push --skip-generate --accept-data-loss

echo "Seeding admin user..."
node prisma/seed.js

echo "Starting server..."
node src/app.js
