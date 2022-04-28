const Ws = require("ws");
const { default: fetch } = require("node-fetch");
const Minecraft = require("minecraft-server-util");
const { REST } = require("@discordjs/rest");
const Config = require("../config.json");
const { query } = require("raraph84-lib");

module.exports.checkWebsite = (host) => new Promise((resolve) => {

    fetch(host).then((res) => {

        if (res.status !== 200) {
            resolve(false);
            return;
        }

        resolve(true);

    }).catch(() => resolve(false));
});

module.exports.checkApi = (host) => new Promise((resolve) => {

    fetch(host).then((res) => {

        res.json()
            .then(() => resolve(true))
            .catch(() => resolve(false));

    }).catch(() => resolve(false));
});

module.exports.checkWs = (host) => new Promise((resolve) => {

    const ws = new Ws(host);

    ws.on("open", () => {
        ws.close();
        resolve(true);
    });

    ws.on("error", () => {
        resolve(false);
    });
});

module.exports.checkBot = (host) => new Promise((resolve, reject) => {

    fetch(host).then((res) => {

        if (res.status !== 200) {
            reject();
            return;
        }

        res.json()
            .then((json) => resolve(json.online))
            .catch(() => reject());

    }).catch(() => reject());
});

module.exports.checkMinecraft = (host) => new Promise((resolve) => {

    Minecraft.statusLegacy(host.split(":")[0], parseInt(host.split(":")[1]) || 25565, { timeout: 10000 })
        .then(() => resolve(true))
        .catch(() => resolve(false));
});

module.exports.alert = async (embed) => {

    const rest = new REST({ version: "9" }).setToken(Config.alertBotToken);

    for (const alertUser of Config.alertUsers) {
        const channel = await rest.post("/users/@me/channels", { body: { recipients: [alertUser] } });
        await rest.post("/channels/" + channel.id + "/messages", { body: { embeds: [embed] } });
    }
}
