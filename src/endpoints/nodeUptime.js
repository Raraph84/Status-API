const { query } = require("raraph84-lib");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql").Pool} database 
 */
module.exports.run = async (request, database) => {

    let node;
    try {
        node = (await query(database, "SELECT * FROM Nodes WHERE Node_ID=?", [request.urlParams.nodeId]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (!node) {
        request.end(400, "This node does not exist");
        return;
    }

    const todayUptime = async () => {

        const day = Math.floor(Date.now() / 1000 / 60 / 60 / 24);
        const firstMinute = day * 24 * 60 / 2;
        const lastMinute = firstMinute + 24 * 60 / 2;

        let statuses;
        try {
            statuses = await query(database, "SELECT Minute, Online FROM Nodes_Statuses WHERE Node_ID=? && Minute>=? && Minute<?", [node.Node_ID, firstMinute, lastMinute]);
        } catch (error) {
            request.end(500, "Internal server error");
            console.log(`SQL Error - ${__filename} - ${error}`);
            return -1;
        }

        const totalStatuses = [];
        for (let minute = firstMinute; minute < lastMinute; minute++) {
            const status = statuses.find((status) => status.Minute === minute);
            if (!status) continue;
            totalStatuses.push(status.Online);
        }

        if (totalStatuses.length < 1) return -1;

        const uptime = Math.round(totalStatuses.reduce((acc, status) => status ? acc + 1 : acc, 0) / totalStatuses.length * 100 * 100) / 100;

        return uptime;
    }

    const day = Math.floor(Date.now() / 1000 / 60 / 60 / 24);

    let uptimes;
    try {
        uptimes = await query(database, "SELECT Day, Online_Ratio FROM Nodes_Daily_Uptimes WHERE Node_ID=? && Day>=?", [node.Node_ID, day - 30 * 3 + 1]);
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    uptimes.push({ Day: day, Online_Ratio: await todayUptime() });

    const totalUptimes = [];
    for (let currentDay = day - 30 * 3 + 1; currentDay <= day; currentDay++) {
        const uptime = uptimes.find((uptime) => uptime.Day === currentDay);
        totalUptimes.push({
            day: currentDay,
            onlineRatio: uptime ? uptime.Online_Ratio : -1
        });
    }

    request.end(200, { uptimes: totalUptimes });
}

module.exports.infos = {
    path: "/nodes/:nodeId/uptime",
    method: "GET"
}