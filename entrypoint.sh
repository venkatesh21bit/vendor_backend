#!/bin/sh
set -e  # Exit on any error

echo "🚀 ENTRYPOINT: Starting Express.js server..."

# Wait for MongoDB to be ready (if using MongoDB)
if [ -n "$MONGODB_URI" ]; then
    echo "⏳ Waiting for MongoDB connection..."
    # You can add a wait script here if needed
fi

echo "📦 Node.js version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

echo "🌐 Starting server on port ${PORT:-8000}..."
exec npm start
