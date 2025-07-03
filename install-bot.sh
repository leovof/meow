#!/bin/bash

echo "🔧 Starting WhatsApp Bot Installer..."

# Step 1: Update and install dependencies
echo "📦 Updating system and installing Node.js..."
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git unzip wget ffmpeg

# Step 2: Install required NPM packages
echo "📦 Installing NPM packages..."
npm install @whiskeysockets/baileys pino qrcode-terminal yt-search ytdl-core axios

# Step 3: Install PM2 globally
echo "⚙️ Installing PM2..."
sudo npm install -g pm2

# Step 4: Setup PM2 startup
pm2 startup
pm2 save

echo "✅ Installation complete!"
echo "📂 Navigate to your bot folder and run: pm2 start index.js --name whatsapp-bot"
