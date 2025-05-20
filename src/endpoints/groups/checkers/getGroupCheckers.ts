import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getGroups, getGroupsCheckers } from "../../../resources";

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

    let checkers;
    try {
        checkers = await getGroupsCheckers(database, [group.id], includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { checkers });
};

export const infos = {
    path: "/groups/:groupId/checkers",
    method: "GET",
    requiresAuth: true
};
