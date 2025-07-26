import { Pool, ResultSetHeader } from "mysql2/promise";
import { Request } from "raraph84-lib";

export const run = async (request: Request, database: Pool) => {
    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (typeof request.jsonBody.name !== "string") {
        request.end(400, "Name must be a string");
        return;
    }

    if (request.jsonBody.name.length < 2 || request.jsonBody.name.length > 50) {
        request.end(400, "Name must be between 2 and 50 characters");
        return;
    }

    let groupId;
    try {
        groupId = (
            await database.query<ResultSetHeader>("INSERT INTO groups (name) VALUES (?)", [request.jsonBody.name])
        )[0].insertId;
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    request.end(200, { id: groupId });
};

export const infos = {
    path: "/groups",
    method: "POST",
    requiresAuth: true
};
