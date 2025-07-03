import { getConfig, Request } from "raraph84-lib";
import { Pool, RowDataPacket } from "mysql2/promise";
import { getServices } from "../../resources";
import { orderDataByChecker } from "./serviceUptimes";
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

    const endDay = Math.floor(Date.now() / 1000 / 60 / 60 / 24) + 1;
    const startDay = endDay - 30 * 3;

    const getOldResponseTimes = async () => {
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

        const getTodayResponseTime = async () => {
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

            const checker = orderDataByChecker(statuses).find((checker) => checker.data.length);

            let checks = 0;
            let sum = 0;
            for (const status of checker?.data ?? []) {
                if (status.response_time === null) continue;
                checks += 1;
                sum += status.response_time;
            }

            const responseTime = checks > 0 ? Math.round((sum / checks) * 10) / 10 : null;

            return { day, responseTime };
        };

        const checkers = orderDataByChecker(statuses);

        const responseTimes = [];
        for (let day = startDay; day < endDay - 1; day++) {
            for (const checker of checkers) {
                const status = checker.data.find((status) => status.day === day);
                if (!status || status.response_time === null) continue;
                responseTimes.push({ day, responseTime: status.response_time });
                break;
            }
            if (!responseTimes.find((responseTime) => responseTime.day === day))
                responseTimes.push({ day, responseTime: null });
        }

        responseTimes.push((await getTodayResponseTime()) as RowDataPacket);

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
            "SELECT checker_id, start_time, checks, lost, med_response_time FROM services_smokeping WHERE service_id=? AND start_time>=?",
            [service.id, startDay * 24 * 60 * 6, config.checkerPriorityId]
        );
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    const checkers = orderDataByChecker(smokeping);

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
        for (const checker of checkers) {
            while (checker.next < checker.data.length && checker.data[checker.next].start_time < endTime) {
                const ping = checker.data[checker.next++];
                if (ping.start_time < startTime || !ping.med_response_time) continue;

                const count = ping.checks * 5 - (ping.lost ?? 0);
                sum += ping.med_response_time * count;
                sent += count;
            }
            if (sent > 0) break; // Use only the first checker with data
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
