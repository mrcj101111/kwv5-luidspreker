const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const ytdl = require('ytdl-core');
const yts = require('yt-search');

// Create client
const client = new Discord.Client();

// Create global queue to populate with songs
const queue = new Map();

client.once('ready', () => {
    console.log('Ready!');
});
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});

// Read messages in channel
client.on("message", async message => {

    // Message should not be bot and should have prefix
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id); // Guild represents an isolated collection of users and channels

    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
        message.delete();
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        message.delete();
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        message.delete();
        return;
    } else {
        message.channel.send("You need to enter a valid command!");
    }
});

// Execute command
async function execute(message, serverQueue) {
    const args = message.content.split(" ");
    const voiceChannel = message.member.voice.channel; // Voice channel of member sending message
    const permissions = voiceChannel.permissionsFor(message.client.user);

    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }

    // const songInfo = await ytdl.getInfo(args[1]);
    const songInfo = await yts(message.content);
    // songInfo.then(data => {
    //     const videos = data.videos.slice(0, 5)
    //     videos.forEach(video => {
    //         // return video
    //         console.log(video)
    //         // console.log(`${video.title} (${video.timestamp}) | ${video.author.name}`)
    //     })
    // })

    const song = {
        title: songInfo.videos[0].title,
        url: songInfo.videos[0].url,
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );

    if (!serverQueue)
        return message.channel.send("There is no song that I could stop!");
    message.channel.messages.fetch().then(data => message.channel.bulkDelete(data))
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        queue.delete(guild.id);
        return;
    }
    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    // console.log(serverQueue.songs)
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

client.login(token);