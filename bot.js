require("dotenv").config();
const fs = require("fs");
const {
  Client, GatewayIntentBits, ApplicationCommandType,
  REST, Routes, EmbedBuilder, ApplicationCommandOptionType,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const HOLYGRAIL_CHANNEL_ID = process.env.HOLYGRAIL_CHANNEL_ID;
const ARCHIVE_FILE = "archive.json";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

function loadArchive() {
  if (!fs.existsSync(ARCHIVE_FILE)) return [];
  return JSON.parse(fs.readFileSync(ARCHIVE_FILE, "utf8"));
}

function saveArchive(archive) {
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2));
}

const commands = [
  { name: "Send to HolyGrail", type: ApplicationCommandType.Message },
  {
    name: "holygrail",
    description: "HolyGrail archive commands",
    type: ApplicationCommandType.ChatInput,
    options: [
      {
        name: "random",
        description: "Pull a random HolyGrail moment",
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("Commands registered.");
})();

client.on("interactionCreate", async (interaction) => {
  // --- Right-click "Send to HolyGrail" ---
  if (interaction.isMessageContextMenuCommand() && interaction.commandName === "Send to HolyGrail") {
    const msg = interaction.targetMessage;
    const archive = loadArchive();

    // Duplicate check: has this exact message ID already been archived?
    const alreadyArchived = archive.some((entry) => entry.messageId === msg.id);
    if (alreadyArchived) {
      return interaction.reply({ content: "Already in the Hall of Fame", ephemeral: true });
    }

    const imageAttachment = msg.attachments.find((a) => a.contentType?.startsWith("image"));

    const entry = {
      messageId: msg.id,
      author: msg.author.username,
      avatarURL: msg.author.displayAvatarURL(),
      content: msg.content || "",
      imageURL: imageAttachment ? imageAttachment.url : null,
      timestamp: msg.createdAt.toISOString(),
    };

    archive.push(entry);
    saveArchive(archive);

    const embed = new EmbedBuilder()
      .setAuthor({ name: entry.author, iconURL: entry.avatarURL })
      .setDescription(entry.content || "*[no text content]*")
      .setTimestamp(msg.createdAt)
      .setColor(0xffd700);
    if (entry.imageURL) embed.setImage(entry.imageURL);

    const channel = await client.channels.fetch(HOLYGRAIL_CHANNEL_ID);
    await channel.send({ embeds: [embed] });

    return interaction.reply({ content: "Added to the HolyGrail 🏆", ephemeral: true });
  }

  // --- /holygrail random ---
  if (interaction.isChatInputCommand() && interaction.commandName === "holygrail") {
    if (interaction.options.getSubcommand() === "random") {
      const archive = loadArchive();
      if (archive.length === 0) {
        return interaction.reply({ content: "The archive is empty so far!", ephemeral: true });
      }

      const pick = archive[Math.floor(Math.random() * archive.length)];

      const embed = new EmbedBuilder()
        .setAuthor({ name: pick.author, iconURL: pick.avatarURL })
        .setDescription(pick.content || "*[no text content]*")
        .setTimestamp(new Date(pick.timestamp))
        .setColor(0xffd700)
        .setFooter({ text: "🎲 Random throwback" });
      if (pick.imageURL) embed.setImage(pick.imageURL);

      return interaction.reply({ embeds: [embed] });
    }
  }
});

client.login(TOKEN);
