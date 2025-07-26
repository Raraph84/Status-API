import { Pool } from "mysql2/promise";
import { Request } from "raraph84-lib";
import { getGroups } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (typeof request.jsonBody.name === "undefined") {
        request.end(400, "Missing name");
        return;
    }

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

    if (typeof request.jsonBody.name !== "string") {
        request.end(400, "Name must be a string");
        return;
    }

    request.jsonBody.name = request.jsonBody.name.trim();

    if (request.jsonBody.name.length < 2 || request.jsonBody.name.length > 50) {
        request.end(400, "Name must be between 2 and 50 characters");
        return;
    }

    try {
        await database.query("UPDATE groups SET name=? WHERE group_id=?", [request.jsonBody.name, group.id]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
};

export const infos = {
    path: "/groups/:groupId",
    method: "PATCH",
    requiresAuth: true
};
