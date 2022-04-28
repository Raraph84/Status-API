const { query } = require("raraph84-lib");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql").Pool} database 
 */
module.exports.run = async (request, database) => {

    const unit = request.urlParams.unit.toLowerCase();
    if (unit !== "minutes" && unit !== "day" && unit !== "week" && unit !== "month") {
        request.end(400, "Invalid unit");
        return;
    }

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
        const lastMinute = firstMinute + 24 * 60 / 2 - 1;

        let statuses;
        try {
            statuses = await query(database, "SELECT Minute, Online FROM Nodes_Statuses WHERE Node_ID=? && Minute>=? && Minute<=?", [node.Node_ID, firstMinute, lastMinute]);
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

        let uptime = totalStatuses.reduce((acc, status) => status ? acc + 1 : acc, 0) / totalStatuses.length * 100;
        uptime = Math.round(uptime * 100) / 100;

        return uptime;
    }

    if (unit === "minutes") {

        const minute = Math.floor(Date.now() / 1000 / 60 / 2);
        const firstMinute = minute - 24 * 60 / 2;
        const lastMinute = firstMinute + 24 * 60 / 2 - 1;

        let statuses;
        try {
            statuses = await query(database, "SELECT Minute, Online FROM Nodes_Statuses WHERE Node_ID=? && Minute>=? && Minute<=?", [node.Node_ID, firstMinute, lastMinute]);
        } catch (error) {
            request.end(500, "Internal server error");
            console.log(`SQL Error - ${__filename} - ${error}`);
            return;
        }

        const minutes = [];
        for (let minute = firstMinute; minute < lastMinute; minute++) {
            const status = statuses.find((status) => status.Minute === minute);
            minutes.push({
                minute: minute,
                online: status ? (status.Online ? "online" : "offline") : "unknown"
            });
        }

        request.end(200, { minutes: minutes });
    }
}

module.exports.infos = {
    path: "/nodes/:nodeId/uptime/:unit",
    method: "GET"
}