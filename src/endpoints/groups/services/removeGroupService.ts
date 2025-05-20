import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getGroups, getServices } from "../../../resources";

export const run = async (request: Request, database: Pool) => {
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

    try {
        await database.query("DELETE FROM groups_services WHERE group_id=? AND service_id=?", [group.id, service.id]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
};

export const infos = {
    path: "/groups/:groupId/services/:serviceId",
    method: "DELETE",
    requiresAuth: true
};
