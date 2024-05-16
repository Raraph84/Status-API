/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    let node;
    try {
        [node] = await database.query("SELECT * FROM Nodes WHERE Node_ID=?", [request.urlParams.nodeId]);
        node = node[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (!node) {
        request.end(400, "This node does not exist");
        return;
    }

    const day = Math.floor(Date.now() / 1000 / 60 / 60 / 24);

    let statuses;
    try {
        [statuses] = await database.query("SELECT * FROM services_daily_statuses WHERE service_id=? && day>=?", [node.Node_ID, day - 30 * 3 + 1]);
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const getTodayUptime = async () => {

        const [statuses] = await database.query("SELECT * FROM services_statuses WHERE service_id=? && minute>=? && minute<?", [node.Node_ID, day * 24 * 60, (day + 1) * 24 * 60]);

        return statuses.length > 0 ? Math.round(statuses.filter((status) => status.online).length / statuses.length * 100 * 100) / 100 : -1;
    };

    let todayUptime;
    try {
        todayUptime = await getTodayUptime();
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    statuses.push({ day, uptime: todayUptime });

    const uptimes = [];
    for (let currentDay = day - 30 * 3 + 1; currentDay <= day; currentDay++) {
        uptimes.push({
            day: currentDay,
            uptime: statuses.find((status) => status.day === currentDay)?.uptime || -1
        });
    }

    request.end(200, { uptimes });
}

module.exports.infos = {
    path: "/nodes/:nodeId/uptimes",
    method: "GET"
}
