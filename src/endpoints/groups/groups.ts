import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getGroups } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let groups;
    try {
        groups = await getGroups(database, null, includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { groups });
};

export const infos = {
    path: "/groups",
    method: "GET",
    requiresAuth: true
};
