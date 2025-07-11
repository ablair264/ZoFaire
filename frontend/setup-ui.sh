#!/bin/bash

# ZoFaire Frontend Setup Script

echo "🚀 Setting up ZoFaire Frontend with UI Enhancements..."

# Navigate to frontend directory
cd frontend

# Install all dependencies including lottie-react
echo "📦 Installing dependencies..."
npm install

# Copy logos if they exist in the parent directory
if [ -f "../splitfin.png" ]; then
    echo "📋 Copying splitfin.png to public directory..."
    cp ../splitfin.png public/
fi

if [ -f "../splitfin-white.png" ]; then
    echo "📋 Copying splitfin-white.png to public directory..."
    cp ../splitfin-white.png public/
fi

echo "✅ Setup complete!"
echo ""
echo "To start the application, run:"
echo "  npm start"
echo ""
echo "Make sure to place your logo files in the public directory:"
echo "  - public/splitfin.png"
echo "  - public/splitfin-white.png"