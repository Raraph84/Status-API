const { default: fetch } = require("node-fetch");
const Ws = require("ws");
const { status } = require("minecraft-server-util");
const { REST } = require("@discordjs/rest");
const { getConfig } = require("raraph84-lib");
const Config = getConfig(__dirname + "/..");

const checkWebsite = (host) => new Promise((resolve, reject) => {

    const startTime = Date.now();

    fetch(host).then((res) => {

        if (res.status !== 200) {
            reject("Status code (" + res.status + ") is not 200");
            return;
        }

        resolve(Date.now() - startTime);

    }).catch((error) => reject(error));
});

const checkApi = (host) => new Promise((resolve, reject) => {

    const startTime = Date.now();

    fetch(host).then((res) => {

        res.json()
            .then(() => resolve(Date.now() - startTime))
            .catch(() => reject("Invalid JSON"));

    }).catch((error) => reject(error));
});

const checkWs = (host) => new Promise((resolve, reject) => {

    const startTime = Date.now();

    const ws = new Ws(host);

    ws.on("open", () => {
        resolve(Date.now() - startTime);
        ws.close();
    });

    ws.on("error", (error) => {
        reject(error);
    });
});

const checkBot = (host) => new Promise((resolve, reject) => {

    fetch(host).then((res) => {

        if (res.status !== 200) {
            reject("Check failed");
            return;
        }

        res.json().then((json) => {

            if (json.online) resolve();
            else reject("Bot offline");

        }).catch(() => reject("Check failed"));

    }).catch(() => reject("Check failed"));
});

const checkMinecraft = (host) => new Promise((resolve, reject) => {

    const startTime = Date.now();

    status(host.split(":")[0], parseInt(host.split(":")[1]) || 25565, { timeout: 10000 })
        .then(() => resolve(Date.now() - startTime))
        .catch((error) => reject(error));
});

const alert = async (embed) => {

    const rest = new REST({ version: "9" }).setToken(Config.alertBotToken);

    for (const alertUser of Config.alertUsers) {
        const channel = await rest.post("/users/@me/channels", { body: { recipients: [alertUser] } });
        await rest.post("/channels/" + channel.id + "/messages", { body: { embeds: [embed] } });
    }
}

module.exports = {
    checkWebsite,
    checkApi,
    checkWs,
    checkBot,
    checkMinecraft,
    alert
}
