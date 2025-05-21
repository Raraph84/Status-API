import { getConfig, Request } from "raraph84-lib";
import { Pool, RowDataPacket } from "mysql2/promise";
import { getServices } from "../../resources";
const config = getConfig(__dirname + "/../../..");

const smokepingStartTime = new Date(2025, 5 - 1, 13, 2).getTime();
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

    const getOldUptimes = async () => {
        let statuses;
        try {
            [statuses] = await database.query<RowDataPacket[]>(
                "SELECT * FROM services_daily_statuses WHERE service_id=? AND checker_id=? AND day>=?",
                [service.id, config.dataCheckerId, day - 30 * 3 + 1]
            );
        } catch (error) {
            console.log(`SQL Error - ${__filename} - ${error}`);
            throw error;
        }

        const getTodayUptime = async () => {
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
            return statuses.length > 0
                ? Math.round((onlineStatuses.length / statuses.length) * 100 * 1000) / 1000
                : null;
        };

        const todayUptime = await getTodayUptime();
        statuses.push({ day, uptime: todayUptime } as RowDataPacket);

        const uptimes = [];
        for (let currentDay = day - 30 * 3 + 1; currentDay <= day; currentDay++) {
            uptimes.push({
                day: currentDay,
                uptime: statuses.find((status) => status.day === currentDay)?.uptime ?? null
            });
        }

        return uptimes;
    };

    let oldUptimes;
    try {
        oldUptimes = await getOldUptimes();
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (service.type !== "server") {
        request.end(200, { uptimes: oldUptimes });
        return;
    }

    let smokeping;
    try {
        [smokeping] = await database.query<RowDataPacket[]>(
            "SELECT checker_id, start_time, duration, sent, downs FROM services_smokeping WHERE service_id=? AND start_time>=?",
            [service.id, Math.max(startDay * 24 * 60 * 6, smokepingStartTime / 1000 / 10), config.checkerPriorityId]
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

    const uptimes = [];
    for (let currentDay = startDay; currentDay <= day; currentDay++) {
        if (currentDay < smokepingStartDay) {
            uptimes.push(oldUptimes.find((uptime) => uptime.day === currentDay));
            continue;
        }

        const startTime = currentDay * 24 * 60 * 6;
        const endTime = (currentDay + 1) * 24 * 60 * 6;

        let checks = 0;
        let downs = 0;
        const times = new Set();

        for (const checker of checkers) {
            while (checker.next < checker.pings.length && checker.pings[checker.next].start_time < endTime) {
                const ping = checker.pings[checker.next++];
                if (ping.start_time < startTime) continue;

                const psent = ping.sent / (service.type === "server" ? 5 : 1);
                const pdowns = ping.downs ?? 0;
                for (let i = 0; i < ping.duration; i++) {
                    if (times.has(ping.start_time + i)) continue;
                    checks++;
                    if (i / ping.duration < pdowns / psent) downs++;
                    times.add(ping.start_time + i);
                }
            }
        }

        const uptime = checks > 0 ? Math.round(((checks - downs) / checks) * 100 * 1000) / 1000 : null;
        uptimes.push({ day: currentDay, uptime });
    }

    request.end(200, { uptimes });
};

export const infos = {
    path: "/services/:serviceId/uptimes",
    method: "GET",
    requiresAuth: false
};
