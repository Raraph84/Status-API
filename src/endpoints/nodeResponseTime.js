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

    const day = Math.floor(Date.now() / 1000 / 60 / 60 / 24);

    const todayResponseTime = async () => {

        const firstMinute = day * 24 * 60;
        const lastMinute = firstMinute + 24 * 60;

        let responseTimes;
        try {
            responseTimes = await query(database, "SELECT Minute, Response_Time FROM Nodes_Response_Times WHERE Node_ID=? && Minute>=? && Minute<?", [node.Node_ID, firstMinute, lastMinute]);
        } catch (error) {
            request.end(500, "Internal server error");
            console.log(`SQL Error - ${__filename} - ${error}`);
            return -1;
        }

        const totalResponseTimes = [];
        for (let minute = firstMinute; minute < lastMinute; minute++) {
            const responseTime = responseTimes.find((responseTime) => responseTime.Minute === minute);
            if (!responseTime) continue;
            totalResponseTimes.push(responseTime.Response_Time);
        }

        if (totalResponseTimes.length < 1) return -1;

        const responseTime = Math.round(totalResponseTimes.reduce((acc, responseTime) => responseTime ? acc + responseTime : acc, 0) / totalResponseTimes.length);

        return responseTime;
    }

    let responseTimes;
    try {
        responseTimes = await query(database, "SELECT Day, Average_Response_Time FROM Nodes_Daily_Response_Times WHERE Node_ID=? && Day>=?", [node.Node_ID, day - 30 * 3 + 1]);
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    responseTimes.push({ Day: day, Average_Response_Time: await todayResponseTime() });

    const days = [];
    for (let currentDay = day - 30 * 3 + 1; currentDay <= day; currentDay++) {
        const responseTime = responseTimes.find((averageResponseTime) => averageResponseTime.Day === currentDay);
        days.push({
            day: currentDay,
            responseTime: responseTime ? responseTime.Average_Response_Time : -1
        });
    }

    request.end(200, { responseTimes: days });
}

module.exports.infos = {
    path: "/nodes/:nodeId/responseTimes",
    method: "GET"
}
