import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getGroups, getGroupsServices } from "../../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let group;
    try {
        group = (await getGroups(database, [parseInt(request.urlParams.groupId) || 0]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!group) {
        request.end(404, "This group does not exist");
        return;
    }

    let services;
    try {
        services = await getGroupsServices(database, [group.id], includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { services });
};

export const infos = {
    path: "/groups/:groupId/services",
    method: "GET",
    requiresAuth: true
};
