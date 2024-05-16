/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    let service;
    try {
        [service] = await database.query("SELECT * FROM services WHERE service_id=?", [request.urlParams.serviceId]);
        service = service[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (!service) {
        request.end(400, "This service does not exist");
        return;
    }

    const day = Math.floor(Date.now() / 1000 / 60 / 60 / 24);

    let statuses;
    try {
        [statuses] = await database.query("SELECT * FROM services_daily_statuses WHERE service_id=? && day>=?", [service.service_id, day - 30 * 3 + 1]);
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const getTodayResponseTime = async () => {

        const [statuses] = await database.query("SELECT * FROM services_statuses WHERE service_id=? && minute>=? && minute<?", [service.service_id, day * 24 * 60, (day + 1) * 24 * 60]);

        const onlineStatuses = statuses.filter((status) => status.online);
        return onlineStatuses.length > 0 ? Math.round(onlineStatuses.reduce((acc, status) => acc + status.response_time, 0) / onlineStatuses.length) : -1;
    };

    let todayResponseTime;
    try {
        todayResponseTime = await getTodayResponseTime();
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    statuses.push({ day, response_time: todayResponseTime });

    const responseTimes = [];
    for (let currentDay = day - 30 * 3 + 1; currentDay <= day; currentDay++) {
        responseTimes.push({
            day: currentDay,
            responseTime: statuses.find((status) => status.day === currentDay)?.response_time || -1
        });
    }

    request.end(200, { responseTimes });
}

module.exports.infos = {
    path: "/nodes/:serviceId/responseTimes",
    method: "GET"
}
