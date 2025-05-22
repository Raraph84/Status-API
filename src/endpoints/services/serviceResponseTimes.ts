import { getConfig, Request } from "raraph84-lib";
import { Pool, RowDataPacket } from "mysql2/promise";
import { getServices } from "../../resources";
const config = getConfig(__dirname + "/../../..");

const smokepingStartDay = Math.floor(new Date(2025, 3 - 1, 24, 2).getTime() / 1000 / 60 / 60 / 24);

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
    const endDay = Math.floor(Date.now() / 1000 / 60 / 60 / 24) + 1;
    const startDay = endDay - 30 * 3;

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
            const day = endDay - 1;

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
            const responseTime =
                onlineStatuses.length > 0
                    ? Math.round(
                          (onlineStatuses.reduce((acc, status) => acc + status.response_time, 0) /
                              onlineStatuses.length) *
                              10
                      ) / 10
                    : null;
            return { day, response_time: responseTime };
        };

        statuses.push((await getTodayResponseTime()) as RowDataPacket);

        const responseTimes = [];
        for (let day = startDay; day < endDay; day++) {
            const responseTime = statuses.find((status) => status.day === day)?.response_time ?? null;
            responseTimes.push({ day, responseTime });
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
            "SELECT checker_id, start_time, sent, lost, med_response_time FROM services_smokeping WHERE service_id=? AND start_time>=?",
            [service.id, startDay * 24 * 60 * 6, config.checkerPriorityId]
        );
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const checkers: { checker: number; pings: any[]; next: number }[] = [];
    for (const checker of config.checkerPriorityId) checkers.push({ checker, pings: [], next: 0 });

    for (const ping of smokeping) {
        const checker = checkers.find((checker) => checker.checker === ping.checker_id);
        if (checker) checker.pings.push(ping);
    }

    const checker = checkers.find((checker) => checker.pings.length)!;

    const responseTimes = [];
    for (let day = startDay; day < endDay; day++) {
        if (day < smokepingStartDay) {
            responseTimes.push(oldResponseTimes.find((reponseTime) => reponseTime.day === day));
            continue;
        }

        const startTime = day * 24 * 60 * 6;
        const endTime = (day + 1) * 24 * 60 * 6;

        let sum = 0;
        let sent = 0;

        while (checker.next < checker.pings.length && checker.pings[checker.next].start_time < endTime) {
            const ping = checker.pings[checker.next++];
            if (ping.start_time < startTime || !ping.med_response_time) continue;

            const count = ping.sent - (ping.lost ?? 0);
            sum += ping.med_response_time * count;
            sent += count;
        }

        const responseTime = sent > 0 ? Math.round(sum / sent) / 100 : null;
        responseTimes.push({ day, responseTime });
    }

    request.end(200, { responseTimes });
};

export const infos = {
    path: "/services/:serviceId/responseTimes",
    method: "GET",
    requiresAuth: false
};
