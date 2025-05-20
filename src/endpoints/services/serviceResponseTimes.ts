import { getConfig, Request } from "raraph84-lib";
import { Pool, RowDataPacket } from "mysql2/promise";
import { getServices } from "../../resources";
const config = getConfig(__dirname + "/../../..");

export const run = async (request: Request, database: Pool) => {
    let service;
    try {
        service = (await getServices(database, [parseInt(request.urlParams.serviceId) || 0]))[0][0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!service) {
        request.end(400, "This service does not exist");
        return;
    }

    const day = Math.floor(Date.now() / 1000 / 60 / 60 / 24);
    const startDay = day - 30 * 3 + 1;

    const getOldResponseTimes = async () => {
        let statuses;
        try {
            [statuses] = await database.query<RowDataPacket[]>(
                "SELECT * FROM services_daily_statuses WHERE service_id=? && checker_id=? && day>=?",
                [service.id, config.dataCheckerId, startDay]
            );
        } catch (error) {
            console.log(`SQL Error - ${__filename} - ${error}`);
            throw error;
        }

        const getTodayResponseTime = async () => {
            let statuses;
            try {
                [statuses] = await database.query<RowDataPacket[]>(
                    "SELECT * FROM services_statuses WHERE service_id=? && checker_id=? && minute>=? && minute<?",
                    [service.id, config.dataCheckerId, day * 24 * 60, (day + 1) * 24 * 60]
                );
            } catch (error) {
                console.log(`SQL Error - ${__filename} - ${error}`);
                throw error;
            }

            const onlineStatuses = statuses.filter((status) => status.online);
            return onlineStatuses.length > 0
                ? Math.round(
                      (onlineStatuses.reduce((acc, status) => acc + status.response_time, 0) / onlineStatuses.length) *
                          10
                  ) / 10
                : null;
        };

        const todayResponseTime = await getTodayResponseTime();
        statuses.push({ day, response_time: todayResponseTime } as RowDataPacket);

        const responseTimes = [];
        for (let currentDay = startDay; currentDay <= day; currentDay++) {
            responseTimes.push({
                day: currentDay,
                responseTime: statuses.find((status) => status.day === currentDay)?.response_time ?? null
            });
        }

        return responseTimes;
    };

    if (service.type !== "server") {
        let responseTimes;
        try {
            responseTimes = await getOldResponseTimes();
        } catch (error) {
            request.end(500, "Internal server error");
            return;
        }

        request.end(200, { responseTimes });
        return;
    }

    let smokeping;
    try {
        [smokeping] = await database.query<RowDataPacket[]>(
            "SELECT * FROM services_smokeping WHERE checker_id=? AND service_id=? AND start_time>=?",
            [config.dataCheckerId, service.id, startDay * 24 * 60 * 6]
        );
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const responseTimes = [];
    for (let currentDay = startDay; currentDay <= day; currentDay++) {
        const startTime = currentDay * 24 * 60 * 6;
        const endTime = (currentDay + 1) * 24 * 60 * 6;

        let sum = 0;
        let count = 0;
        for (const ping of smokeping) {
            if (ping.start_time < startTime || !ping.med_response_time) continue;
            if (ping.start_time >= endTime) break;
            const c = ping.sent - (ping.lost ?? 0);
            sum += ping.med_response_time * c;
            count += c;
        }

        const responseTime = count > 0 ? Math.round(sum / count) / 100 : null;
        responseTimes.push({ day: currentDay, responseTime });
    }

    request.end(200, { responseTimes });
};

export const infos = {
    path: "/services/:serviceId/responseTimes",
    method: "GET",
    requiresAuth: false
};
