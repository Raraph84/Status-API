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
        request.end(404, "This service does not exist");
        return;
    }

    const endDay = Math.floor(Date.now() / 1000 / 60 / 60 / 24) + 1;
    const startDay = endDay - 30 * 3;

    if (service.type !== "server") {
        const getOldUptimes = async () => {
            let statuses;
            try {
                [statuses] = await database.query<RowDataPacket[]>(
                    "SELECT * FROM services_daily_statuses WHERE service_id=? AND day>=?",
                    [service.id, startDay]
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
                        "SELECT * FROM services_statuses WHERE service_id=? AND minute>=?",
                        [service.id, day * 24 * 60]
                    );
                } catch (error) {
                    console.log(`SQL Error - ${__filename} - ${error}`);
                    throw error;
                }

                const checkers = orderDataByChecker(statuses);

                let checks = 0;
                let ups = 0;
                const minutes = new Set();
                for (const checker of checkers) {
                    for (const status of checker.data) {
                        if (minutes.has(status.minute)) continue;
                        checks += 1;
                        if (status.online) ups += 1;
                        minutes.add(status.minute);
                    }
                }

                const uptime = checks > 0 ? Math.round((ups / checks) * 100 * 1000) / 1000 : null;

                return { day, uptime };
            };

            const checkers = orderDataByChecker(statuses);

            const uptimes = [];
            for (let day = startDay; day < endDay - 1; day++) {
                for (const checker of checkers) {
                    const status = checker.data.find((status) => status.day === day);
                    if (!status || status.uptime === null) continue;
                    uptimes.push({ day, uptime: status.uptime });
                    break;
                }
                if (!uptimes.find((uptime) => uptime.day === day)) uptimes.push({ day, uptime: null });
            }

            uptimes.push((await getTodayUptime()) as RowDataPacket);

            return uptimes;
        };

        let oldUptimes;
        try {
            oldUptimes = await getOldUptimes();
        } catch (error) {
            request.end(500, "Internal server error");
            return;
        }

        request.end(200, { uptimes: oldUptimes });
        return;
    }

    let smokeping;
    try {
        [smokeping] = await database.query<RowDataPacket[]>(
            "SELECT checker_id, start_time, duration, checks, downs FROM services_smokeping WHERE service_id=? AND start_time>=?",
            [service.id, startDay * 24 * 60 * 6]
        );
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const days: { [key: number]: { [key: number]: any[] } } = {};
    for (let day = startDay; day < endDay; day++) days[day] = {};
    for (const ping of smokeping) {
        const day = days[Math.floor(ping.start_time / (24 * 60 * 6))];
        if (!day) continue;
        if (day[ping.start_time]) day[ping.start_time].push(ping);
        else day[ping.start_time] = [ping];
    }

    const uptimes: { day: number; uptime: number | null }[] = [];
    for (const day in days) {
        let checks = 0;
        let ups = 0;

        for (const time in days[day]) {
            const pings = days[day][time];
            const cchecks = pings.reduce((acc, ping) => acc + ping.checks, 0) / pings.length;
            if (pings.filter((ping) => ping.downs).length > 1)
                ups += cchecks - pings.reduce((acc, ping) => acc + ping.downs, 0) / pings.length;
            else ups += cchecks;
            checks += cchecks;
        }

        const uptime = checks > 0 ? Math.round((ups / checks) * 100 * 1000) / 1000 : null;
        uptimes.push({ day: parseInt(day), uptime });
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
