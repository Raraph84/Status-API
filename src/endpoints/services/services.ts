import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getServices } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let services;
    try {
        services = await getServices(database, null, includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { services: services[0] });
};

export const infos = {
    path: "/services",
    method: "GET",
    requiresAuth: true
};
