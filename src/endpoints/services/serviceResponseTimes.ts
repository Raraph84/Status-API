import { getConfig, Request } from "raraph84-lib";
import { Pool, RowDataPacket } from "mysql2/promise";
import { getServices } from "../../resources";
const config = getConfig(__dirname + "/../../..");

const smokepingStartTime = new Date(2025, 3 - 1, 24, 2).getTime();
const smokepingStartDay = Math.floor(smokepingStartTime / 1000 / 60 / 60 / 24);

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
                "SELECT * FROM services_daily_statuses WHERE service_id=? AND checker_id=? AND day>=?",
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
                    "SELECT * FROM services_statuses WHERE service_id=? AND checker_id=? AND minute>=?",
                    [service.id, config.dataCheckerId, day * 24 * 60]
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

    let oldResponseTimes;
    try {
        oldResponseTimes = await getOldResponseTimes();
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (service.type !== "server") {
        request.end(200, { responseTimes: oldResponseTimes });
        return;
    }

    let smokeping;
    try {
        [smokeping] = await database.query<RowDataPacket[]>(
            "SELECT start_time, sent, lost, med_response_time FROM services_smokeping WHERE checker_id=? AND service_id=? AND start_time>=?",
            [config.dataCheckerId, service.id, Math.max(startDay * 24 * 60 * 6, smokepingStartTime / 1000 / 10)]
        );
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const responseTimes = [];
    for (let currentDay = startDay; currentDay <= day; currentDay++) {
        if (currentDay < smokepingStartDay) {
            responseTimes.push(oldResponseTimes.find((reponseTime) => reponseTime.day === currentDay));
            continue;
        }

        const startTime = currentDay * 24 * 60 * 6;
        const endTime = (currentDay + 1) * 24 * 60 * 6;

        let sum = 0;
        let sent = 0;
        for (const ping of smokeping) {
            if (ping.start_time < startTime || !ping.med_response_time) continue;
            if (ping.start_time >= endTime) break;
            const count = ping.sent - (ping.lost ?? 0);
            sum += ping.med_response_time * count;
            sent += count;
        }

        const responseTime = sent > 0 ? Math.round(sum / sent) / 100 : null;
        responseTimes.push({ day: currentDay, responseTime });
    }

    request.end(200, { responseTimes });
};

export const infos = {
    path: "/services/:serviceId/responseTimes",
    method: "GET",
    requiresAuth: false
};
