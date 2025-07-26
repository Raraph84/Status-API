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

    request.jsonBody.name = request.jsonBody.name.trim();

    if (request.jsonBody.name.length < 2 || request.jsonBody.name.length > 50) {
        request.end(400, "Name must be between 2 and 50 characters");
        return;
    }

    if (typeof request.jsonBody.description !== "string") {
        request.end(400, "Description must be a string");
        return;
    }

    request.jsonBody.description = request.jsonBody.description.trim();

    if (request.jsonBody.description.length < 2 || request.jsonBody.description.length > 100) {
        request.end(400, "Description must be between 2 and 100 characters");
        return;
    }

    if (typeof request.jsonBody.location !== "string") {
        request.end(400, "Location must be a string");
        return;
    }

    request.jsonBody.location = request.jsonBody.location.trim();

    if (request.jsonBody.location.length < 2 || request.jsonBody.location.length > 50) {
        request.end(400, "Location must be between 2 and 50 characters");
        return;
    }

    if (typeof request.jsonBody.checkSecond !== "number" || isNaN(request.jsonBody.checkSecond)) {
        request.end(400, "Check second must be a number");
        return;
    }

    if (request.jsonBody.checkSecond < 0 || request.jsonBody.checkSecond > 59) {
        request.end(400, "Check second must be between 0 and 59");
        return;
    }

    let checkerId;
    try {
        checkerId = (
            await database.query<ResultSetHeader>(
                "INSERT INTO checkers (name, description, location, check_second) VALUES (?, ?, ?, ?)",
                [
                    request.jsonBody.name,
                    request.jsonBody.description,
                    request.jsonBody.location,
                    request.jsonBody.checkSecond
                ]
            )
        )[0].insertId;
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    request.end(200, { id: checkerId });
};

export const infos = {
    path: "/checkers",
    method: "POST",
    requiresAuth: true
};
