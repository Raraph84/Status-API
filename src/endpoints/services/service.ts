import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getServices } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let service;
    try {
        service = await getServices(database, [parseInt(request.urlParams.serviceId) || 0], includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!service[0][0]) {
        request.end(400, "This service does not exist");
        return;
    }

    request.end(200, service[(request as any).authenticated ? 0 : 1][0]);
};

export const infos = {
    path: "/services/:serviceId",
    method: "GET",
    requiresAuth: false
};
