// fix-messages.js
require('dotenv').config();
const mongoose = require('mongoose');

// Use your MONGO_URI from .env
const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGO_URI not found in .env file');
  process.exit(1);
}

console.log('📡 Connecting to MongoDB...');

// Define schema for messages
const messageSchema = new mongoose.Schema({}, { strict: false });
const Message = mongoose.model('Message', messageSchema, 'messages');

async function fixMessages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Add isRead: false to all messages without it
    const result = await Message.updateMany(
      { isRead: { $exists: false } },
      { $set: { isRead: false } }
    );
    console.log(`✅ Updated ${result.modifiedCount} messages with isRead: false`);
    
    // Add readBy array if missing
    const result2 = await Message.updateMany(
      { readBy: { $exists: false } },
      { $set: { readBy: [] } }
    );
    console.log(`✅ Updated ${result2.modifiedCount} messages with readBy: []`);
    
    // Verify the conversation's messages
    const conversationId = '69f5f1295606b8016e830267';
    const messages = await Message.find({ 
      conversationId: new mongoose.Types.ObjectId(conversationId) 
    });
    
    console.log(`\n📊 Messages in conversation with Bright:`);
    if (messages.length === 0) {
      console.log('   No messages found in this conversation');
    } else {
      messages.forEach(m => {
        console.log(`   - "${m.content}": isRead = ${m.isRead !== undefined ? m.isRead : 'missing'}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixMessages();