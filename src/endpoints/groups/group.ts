import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getGroups } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let group;
    try {
        group = (await getGroups(database, [parseInt(request.urlParams.groupId) || 0], includes))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!group) {
        request.end(400, "This group does not exist");
        return;
    }

    request.end(200, group);
};

export const infos = {
    path: "/groups/:groupId",
    method: "GET",
    requiresAuth: true
};
