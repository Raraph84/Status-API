const { createPool } = require("mysql");
const { getConfig, query } = require("raraph84-lib");
const { checkWebsite, checkMinecraft, checkApi, checkWs, checkBot, alert } = require("./src/utils");
const Config = getConfig(__dirname);

const currentDate = Date.now();
const currentMinute = Math.floor(currentDate / 1000 / 60);

const onlineAlerts = [];
const offlineAlerts = [];

const database = createPool(Config.database);
console.log("Connexion à la base de données...");
query(database, "SELECT 1").then(async () => {

    console.log("Connecté à la base de données !");
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
                ...(alwaysDown.length > 0 ? "**Les services toujours hors ligne sont : " + alwaysDown.map((node) => `**\`${node.Name}\`**`).join(", ") + ".**" : [])
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

    database.end();

    console.log("Vérification des statuts des services terminée !");

}).catch((error) => console.log("Impossible de se connecter à la base de données - " + error));

const checkNode = (node) => new Promise((resolve) => {

    if (node.Type === "website") {

        checkWebsite(node.Host).then((responseTime) => {
            nodeOnline(node, responseTime).then(() => resolve());
        }).catch((error) => {
            nodeOffline(node, error).then(() => resolve());
        });

    } else if (node.Type === "minecraft") {

        checkMinecraft(node.Host).then((responseTime) => {
            nodeOnline(node, responseTime).then(() => resolve());
        }).catch((error) => {
            nodeOffline(node, error).then(() => resolve());
        });

    } else if (node.Type === "api") {

        checkApi(node.Host).then((responseTime) => {
            nodeOnline(node, responseTime).then(() => resolve());
        }).catch((error) => {
            nodeOffline(node, error).then(() => resolve());
        });

    } else if (node.Type === "gateway") {

        checkWs(node.Host).then((responseTime) => {
            nodeOnline(node, responseTime).then(() => resolve());
        }).catch((error) => {
            nodeOffline(node, error).then(() => resolve());
        });

    } else if (node.Type === "bot") {

        checkBot(node.Host).then(() => {
            nodeOnline(node, -1).then(() => resolve());
        }).catch((error) => {
            if (error !== "Check failed") nodeOffline(node, error).then(() => resolve());
            else resolve();
        });

    } else resolve();
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
