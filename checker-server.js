const { createPool } = require("mysql");
const { REST } = require("@discordjs/rest");
const { getConfig, TaskManager, query, WebSocketServer, randomString } = require("raraph84-lib");
const Config = getConfig(__dirname);

const tasks = new TaskManager();

const database = createPool(Config.database);
tasks.addTask((resolve, reject) => {
    console.log("Connexion à la base de données...");
    query(database, "SELECT 1").then(() => {
        console.log("Connecté à la base de données !");
        resolve();
    }).catch((error) => {
        console.log("Impossible de se connecter à la base de données - " + error);
        reject();
    });
}, (resolve) => database.end(() => resolve()));

const checking = [];

const server = new WebSocketServer(Config.port);
server.on("connection", (/** @type {import("raraph84-lib/src/WebSocketClient")} */ client) => {
    setTimeout(() => {
        if (!client.infos.logged)
            client.close("Please login");
    }, 10 * 1000);
});
server.on("command", (commandName, /** @type {import("raraph84-lib/src/WebSocketClient")} */ client, message) => {

    if (commandName === "LOGIN") {

        if (client.infos.logged) {
            client.close("Already logged");
            return;
        }

        if (typeof message.token !== "string") {
            client.close("Token must be a string");
            return;
        }

        if (message.token !== Config.clientToken) {
            client.close("Invalid token");
            return;
        }

        client.infos.logged = true;
        client.emitEvent("LOGGED");

        console.log("Client connecté");

    } else if (commandName === "HEARTBEAT") {

        if (!client.infos.logged) {
            client.close("Please login");
            return;
        }

        if (!client.infos.waitingHeartbeat) {
            client.close("Useless heartbeat");
            return;
        }

        client.infos.waitingHeartbeat = false;

    } else if (commandName === "NODE_CHECKED") {

        if (!client.infos.logged) {
            client.close("Please login");
            return;
        }

        if (typeof message.nonce !== "string") {
            client.close("Nonce must be a string");
            return;
        }

        const check = checking.find((check) => check.nonce === message.nonce);
        if (!check) {
            client.close("Invalid nonce");
            return;
        }

        check.callback(message);
        checking.splice(checking.indexOf(check), 1);

    } else
        client.close("Invalid command");
});
server.on("close", (/** @type {import("raraph84-lib/src/WebSocketClient")} */ client) => {
    if (client.infos.logged)
        console.log("Client déconnecté");
});
let heartbeatInterval;
tasks.addTask((resolve, reject) => {
    console.log("Lancement du serveur sur le port " + Config.port + "...");
    server.listen(Config.port).then(() => {
        heartbeatInterval = setInterval(() => {

            server.clients.filter((client) => client.infos.logged).forEach((client) => {
                client.infos.waitingHeartbeat = true;
                client.emitEvent("HEARTBEAT");
            });

            setTimeout(() => {
                server.clients.filter((client) => client.infos.waitingHeartbeat).forEach((client) => {
                    client.close("Please respond to heartbeat");
                });
            }, 10 * 1000);

        }, 30 * 1000);
        console.log("Serveur lancé !");
        resolve();
    }).catch((error) => {
        console.log("Impossible de lancer le serveur - " + error);
        reject();
    });
}, (resolve) => { clearInterval(heartbeatInterval); server.close().then(() => resolve()); });

let onlineAlerts = [];
let offlineAlerts = [];
let currentDate = 0;
let currentMinute = 0;

let checkerInterval;
tasks.addTask((resolve) => {
    checkerInterval = setInterval(async () => {

        onlineAlerts = [];
        offlineAlerts = [];
        currentDate = Date.now();
        currentMinute = Math.floor(currentDate / 1000 / 60);

        console.log("Vérification des statuts des services...");

        let nodes;
        try {
            nodes = await query(database, "SELECT * FROM Nodes WHERE Disabled=0");
        } catch (error) {
            console.log(`SQL Error - ${__filename} - ${error}`);
            return;
        }

        await Promise.all(nodes.map((node) => checkNode(node)));

        if (onlineAlerts.length > 0) {
            let alwaysDown;
            try {
                alwaysDown = await query(database, "SELECT Nodes.* FROM Nodes_Events INNER JOIN Nodes ON Nodes.Node_ID=Nodes_Events.Node_ID WHERE (Nodes_Events.Node_ID, Minute) IN (SELECT Node_ID, MAX(Minute) AS Minute FROM Nodes_Events GROUP BY Node_ID) && Online=0 && Disabled=0");
            } catch (error) {
                console.log(`SQL Error - ${__filename} - ${error}`);
                return;
            }
            await alert({
                title: `Service${onlineAlerts.length > 1 ? "s" : ""} En Ligne`,
                description: [
                    ...onlineAlerts.map((node) => `:warning: **Le service **\`${node.Name}\`** est de nouveau en ligne.**`),
                    ...(alwaysDown.length > 0 ? ["**Les services toujours hors ligne sont : " + alwaysDown.map((node) => `**\`${node.Name}\`**`).join(", ") + ".**"] : [])
                ].join("\n"),
                timestamp: new Date(currentMinute * 1000 * 60),
                color: "65280"
            });
        }

        if (offlineAlerts.length > 0) {
            await alert({
                title: `Service${offlineAlerts.length > 1 ? "s" : ""} Hors Ligne`,
                description: offlineAlerts.map((node) => `:warning: **Le service **\`${node.Name}\`** est hors ligne.**\n${node.error}`).join("\n"),
                timestamp: new Date(currentMinute * 1000 * 60),
                color: "16711680"
            });
        }

        console.log("Vérification des statuts des services terminée !");

    }, 5 * 60 * 1000);
    resolve();
}, (resolve) => { clearInterval(checkerInterval); resolve(); });

tasks.run();

const checkNode = (node) => new Promise((resolve) => {

    const client = server.clients.find((client) => client.infos.logged);
    if (!client) {
        resolve();
        return;
    }

    const nonce = randomString(32);

    checking.push({
        nonce,
        callback: (response) => {
            if (node.Type !== "bot") {
                if (response.online)
                    nodeOnline(node, response.responseTime).then(() => resolve());
                else
                    nodeOffline(node, response.error).then(() => resolve());
            } else {
                if (response.online)
                    nodeOnline(node, -1).then(() => resolve());
                else {
                    if (error !== "Check failed") nodeOffline(node, response.error).then(() => resolve());
                    else resolve();
                }
            }
            resolve();
        }
    });

    client.emitEvent("CHECK_NODE", { type: node.Type, host: node.Host, nonce });
});

const getLastStatus = async (node) => {

    let lastStatus;
    try {
        lastStatus = (await query(database, "SELECT * FROM Nodes_Events WHERE Node_ID=? ORDER BY Minute DESC LIMIT 1", [node.Node_ID]))[0];
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
    }

    return lastStatus ? !!lastStatus.Online : false;
}

const nodeOnline = async (node, responseTime) => {

    if (!await getLastStatus(node)) {

        try {
            await query(database, "INSERT INTO Nodes_Events VALUES (?, ?, 1)", [node.Node_ID, currentMinute]);
        } catch (error) {
            console.log(`SQL Error - ${__filename} - ${error}`);
        }

        onlineAlerts.push(node);
    }

    try {
        await query(database, "INSERT INTO Nodes_Statuses VALUES (?, ?, 1)", [node.Node_ID, currentMinute]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
    }

    if (responseTime >= 0) {
        try {
            await query(database, "INSERT INTO Nodes_Response_Times VALUES (?, ?, ?)", [node.Node_ID, currentMinute, responseTime]);
        } catch (error) {
            console.log(`SQL Error - ${__filename} - ${error}`);
        }
    }

    await updateDailyUptime(node);
    await updateDailyResponseTime(node);
}

const nodeOffline = async (node, error) => {

    if (await getLastStatus(node)) {

        try {
            await query(database, "INSERT INTO Nodes_Events VALUES (?, ?, 0)", [node.Node_ID, currentMinute]);
        } catch (error) {
            console.log(`SQL Error - ${__filename} - ${error}`);
        }

        offlineAlerts.push({ ...node, error });
    }

    try {
        await query(database, "INSERT INTO Nodes_Statuses VALUES (?, ?, 0)", [node.Node_ID, currentMinute]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
    }

    await updateDailyUptime(node);
    await updateDailyResponseTime(node);
}

const updateDailyUptime = async (node) => {

    const day = Math.floor(currentDate / 1000 / 60 / 60 / 24) - 1;
    const firstMinute = day * 24 * 60;

    let lastDailyUptime;
    try {
        lastDailyUptime = (await query(database, "SELECT * FROM Nodes_Daily_Uptimes WHERE Node_ID=? ORDER BY Day DESC LIMIT 1", [node.Node_ID]))[0];
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (lastDailyUptime && lastDailyUptime.Day === day)
        return;

    let statuses;
    try {
        statuses = await query(database, "SELECT Minute, Online FROM Nodes_Statuses WHERE Node_ID=? && Minute>=?", [node.Node_ID, firstMinute]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const totalStatuses = [];
    for (let minute = firstMinute; minute < firstMinute + 24 * 60; minute++) {
        const status = statuses.find((status) => status.Minute === minute);
        if (!status) continue;
        totalStatuses.push(status.Online);
    }

    if (totalStatuses.length < 1) return;

    const uptime = Math.round(totalStatuses.reduce((acc, status) => status ? acc + 1 : acc, 0) / totalStatuses.length * 100 * 100) / 100;

    try {
        await query(database, "INSERT INTO Nodes_Daily_Uptimes VALUES (?, ?, ?)", [node.Node_ID, day, uptime]);
        await query(database, "DELETE FROM Nodes_Statuses WHERE Node_ID=? && Minute<?", [node.Node_ID, firstMinute]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
    }
}

const updateDailyResponseTime = async (node) => {

    const day = Math.floor(currentDate / 1000 / 60 / 60 / 24) - 1;
    const firstMinute = day * 24 * 60;

    let lastDailyResponseTime;
    try {
        lastDailyResponseTime = (await query(database, "SELECT * FROM Nodes_Daily_Response_Times WHERE Node_ID=? ORDER BY Day DESC LIMIT 1", [node.Node_ID]))[0];
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (lastDailyResponseTime && lastDailyResponseTime.Day === day)
        return;

    let responseTimes;
    try {
        responseTimes = await query(database, "SELECT Minute, Response_Time FROM Nodes_Response_Times WHERE Node_ID=? && Minute>=?", [node.Node_ID, firstMinute]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const totalResponseTimes = [];
    for (let minute = firstMinute; minute < firstMinute + 24 * 60; minute++) {
        const responseTime = responseTimes.find((responseTime) => responseTime.Minute === minute);
        if (!responseTime) continue;
        totalResponseTimes.push(responseTime.Response_Time);
    }

    if (totalResponseTimes.length < 1) return;

    const averageResponseTime = Math.round(totalResponseTimes.reduce((acc, responseTime) => acc + responseTime, 0) / totalResponseTimes.length);

    try {
        await query(database, "INSERT INTO Nodes_Daily_Response_Times VALUES (?, ?, ?)", [node.Node_ID, day, averageResponseTime]);
        await query(database, "DELETE FROM Nodes_Response_Times WHERE Node_ID=? && Minute<?", [node.Node_ID, firstMinute]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
    }
}

const alert = async (embed) => {

    const rest = new REST({ version: "9" }).setToken(Config.alertBotToken);

    for (const alertUser of Config.alertUsers) {
        const channel = await rest.post("/users/@me/channels", { body: { recipients: [alertUser] } });
        await rest.post("/channels/" + channel.id + "/messages", { body: { embeds: [embed] } });
    }
}
