const { request } = require("https");
const { pingWithPromise, ping } = require("minecraft-ping-js");
const { REST } = require("@discordjs/rest");
const { getConfig } = require("raraph84-lib");
const Ws = require("ws");
const Config = getConfig(__dirname + "/..");

const checkWebsite = (host) => new Promise((resolve, reject) => {

    let tlsHandshakeAt = 0;
    let firstByteAt = 0;

    const req = request(host);
    req.on("socket", (socket) => {
        socket.on("secureConnect", () => tlsHandshakeAt = Date.now());
    });
    req.on("response", (res) => {
        res.once("readable", () => firstByteAt = Date.now());
        res.on("data", () => { });
        res.on("end", () => {

            if (res.statusCode !== 200) {
                reject("Status code (" + res.statusCode + ") is not 200");
                return;
            }

            resolve(firstByteAt - tlsHandshakeAt);
        });
    });
    req.on("error", (error) => reject(error));
    req.end();
});

const checkApi = (host) => new Promise((resolve, reject) => {

    let tlsHandshakeAt = 0;
    let firstByteAt = 0;

    const req = request(host);
    req.on("socket", (socket) => {
        socket.on("secureConnect", () => tlsHandshakeAt = Date.now());
    });
    req.on("response", (res) => {
        res.once("readable", () => firstByteAt = Date.now());
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {

            try {
                JSON.parse(data);
            } catch (error) {
                reject("Invalid JSON");
                return;
            }

            resolve(firstByteAt - tlsHandshakeAt);
        });
    });
    req.on("error", (error) => reject(error));
    req.end();
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

    pingWithPromise(host.split(":")[0], parseInt(host.split(":")[1]) || 25565)
        .then((res) => resolve(res.ping))
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
