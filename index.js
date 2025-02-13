const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const schedule = require('node-schedule');
const token = process.env.DISCORD_TOKEN; // Store your token in Replit secrets
const leaderboardChannelId = '1249720217660031016';
const channelIds = ['616950964431093761', '619846700915228673', '501001154851897354', '689765145563365407', '695214936443322439'];
const allowedUserIds = ['586463558427213834', '387912099520577547']; // Allowed user IDs for commands

let lastLeaderboardMessageId;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// MongoDB model
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

const reactionSchema = new mongoose.Schema({
  userId: String,
  count: Number,
});

const Reaction = mongoose.model('Reaction', reactionSchema);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  startLeaderboardUpdate();
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.emoji.name === 'haha' && channelIds.includes(reaction.message.channel.id)) {
    const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
    const messageAuthorId = message.author.id;

    try {
      const userReaction = await Reaction.findOne({ userId: messageAuthorId });
      if (userReaction) {
        userReaction.count += 1;
        await userReaction.save();
      } else {
        const newUserReaction = new Reaction({ userId: messageAuthorId, count: 1 });
        await newUserReaction.save();
      }
      console.log(`[ ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' })} ] Found Message | Send to database, update the leaderboard.`);
    } catch (error) {
      console.error('Error processing reaction:', error);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (!allowedUserIds.includes(message.author.id)) return;

  if (message.content.toLowerCase() === 'cleardb') {
    if (message.member.permissions.has('ADMINISTRATOR')) { // Ensure only admins can clear the database
      await clearDatabase();
      message.channel.send('Database cleared successfully.');
    } else {
      message.channel.send('You do not have permission to clear the database.');
    }
  }

  if (message.content.toLowerCase() === 'reload') {
    await updateLeaderboard();
  }
});

async function updateLeaderboard() {
  try {
    const leaderboardChannel = await client.channels.fetch(leaderboardChannelId);

    // Delete the previous leaderboard message if it exists
    if (lastLeaderboardMessageId) {
      try {
        const previousMessage = await leaderboardChannel.messages.fetch(lastLeaderboardMessageId);
        if (previousMessage) await previousMessage.delete();
      } catch (err) {
        if (err.code !== 10008) { // Ignore "Unknown Message" error
          console.error('Error deleting previous leaderboard message:', err);
        }
      }
    }

    const topUsers = await Reaction.find().sort({ count: -1 }).limit(10);

    const descriptions = await Promise.all(
      topUsers.map(async (user, index) => {
        const member = await client.users.fetch(user.userId);
        const rankEmojis = [':first_place:', ':second_place:', ':third_place:', '🏅'];
        const rankEmoji = rankEmojis[index] || '🏅';
        const hahaEmoji = '<:haha:487642499104374784>'; // Replace with your actual emoji ID
        return `${rankEmoji} ${index + 1}. ${member.username} - ${user.count}x ${hahaEmoji}`;
      })
    );

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'N E T I Z Ξ N | Server HaHa HiHi.', iconURL: 'https://cdn.discordapp.com/icons/274510773194063872/a_c058ecc8ecbb4394d96acf23a85f04a5', url: 'https://discord.gg/netizen' })
      .setTitle('Top Global Penghibur')
      .setDescription(descriptions.join('\n\n'))
      .setColor(generateRandomColor()) // Set a random color
      .setThumbnail('https://cdn.discordapp.com/icons/274510773194063872/a_c058ecc8ecbb4394d96acf23a85f04a5') // Set the thumbnail image
      .setFooter({ text: `Latest Updated - ${new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Jakarta' })}` });

    const newMessage = await leaderboardChannel.send({ embeds: [embed] });
    lastLeaderboardMessageId = newMessage.id; // Store the ID of the new leaderboard message
  } catch (error) {
    console.error('Error updating leaderboard:', error);
  }
}

function startLeaderboardUpdate() {
  updateLeaderboard();
  setInterval(updateLeaderboard, 24 * 60 * 60 * 1000); // Update every 24 hours

  schedule.scheduleJob('0 0 * * *', async () => { // Reload every day at midnight
    await updateLeaderboard();
  });

  schedule.scheduleJob('0 0 1 1 *', async () => { // Reset annually on January 1st
    try {
      await Reaction.deleteMany({});
      console.log(`[ ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' })} ] Leaderboard reset.`);
    } catch (error) {
      console.error('Error resetting leaderboard:', error);
    }
  });
}

async function clearDatabase() {
  try {
    await Reaction.deleteMany({});
    console.log('Database cleared successfully.');
  } catch (error) {
    console.error('Error clearing database:', error);
  }
}

function generateRandomColor() {
  let color = Math.floor(Math.random() * 16777215).toString(16);
  while (color.length < 6) {
    color = '0' + color;
  }
  return '#' + color;
}

client.login(token);
