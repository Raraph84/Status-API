import { getConfig, Request } from "raraph84-lib";
import { Pool, RowDataPacket } from "mysql2/promise";
import { getServices } from "../../resources";
const config = getConfig(__dirname + "/../../..");

const smokepingStartDay = Math.floor(new Date(2025, 5 - 1, 13, 2).getTime() / 1000 / 60 / 60 / 24);

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

    const endDay = Math.floor(Date.now() / 1000 / 60 / 60 / 24) + 1;
    const startDay = endDay - 30 * 3;

    const getOldUptimes = async () => {
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

        const getTodayUptime = async () => {
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
            const uptime =
                statuses.length > 0 ? Math.round((onlineStatuses.length / statuses.length) * 100 * 1000) / 1000 : null;
            return { day, uptime };
        };

        statuses.push((await getTodayUptime()) as RowDataPacket);

        const uptimes = [];
        for (let day = startDay; day < endDay; day++) {
            const uptime = statuses.find((status) => status.day === day)?.uptime ?? null;
            uptimes.push({ day, uptime });
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
            [service.id, startDay * 24 * 60 * 6, config.checkerPriorityId]
        );
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const checkers = orderDataByChecker(smokeping);

    const uptimes = [];
    for (let day = startDay; day < endDay; day++) {
        if (day < smokepingStartDay) {
            uptimes.push(oldUptimes.find((uptime) => uptime.day === day));
            continue;
        }

        const startTime = day * 24 * 60 * 6;
        const endTime = (day + 1) * 24 * 60 * 6;

        let checks = 0;
        let ups = 0;
        const times = new Set();

        for (const checker of checkers) {
            while (checker.next < checker.data.length && checker.data[checker.next].start_time < endTime) {
                const ping = checker.data[checker.next++];
                if (ping.start_time < startTime) continue;

                const psent = ping.sent / (service.type === "server" ? 5 : 1);
                const pdowns = ping.downs ?? 0;
                for (let i = 0; i < ping.duration; i++) {
                    if (times.has(ping.start_time + i)) continue;
                    checks++;
                    if (i / ping.duration >= pdowns / psent) ups++;
                    times.add(ping.start_time + i);
                }
            }
        }

        const uptime = checks > 0 ? Math.round((ups / checks) * 100 * 1000) / 1000 : null;
        uptimes.push({ day, uptime });
    }

    request.end(200, { uptimes });
};

export const infos = {
    path: "/services/:serviceId/uptimes",
    method: "GET",
    requiresAuth: false
};

export const orderDataByChecker = (data: any[]): { checker: number; data: any[]; next: number }[] => {
    const checkers: { checker: number; data: any[]; next: number }[] = [];
    for (const checker of config.checkerPriorityId) checkers.push({ checker, data: [], next: 0 });

    for (const element of data) {
        const checker = checkers.find((checker) => checker.checker === element.checker_id);
        if (checker) checker.data.push(element);
    }

    return checkers;
};
