import { Pool } from "mysql2/promise";
import { Request } from "raraph84-lib";
import { getCheckers } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (
        typeof request.jsonBody.name === "undefined" &&
        typeof request.jsonBody.description === "undefined" &&
        typeof request.jsonBody.location === "undefined" &&
        typeof request.jsonBody.checkSecond === "undefined"
    ) {
        request.end(400, "Missing name, description, location or checkSecond");
        return;
    }

    let checker;
    try {
        checker = (await getCheckers(database, [parseInt(request.urlParams.checkerId) || 0]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!checker) {
        request.end(404, "This checker does not exist");
        return;
    }

    let sql = "UPDATE checkers ";
    const args = [];

    if (typeof request.jsonBody.name !== "undefined") {
        if (typeof request.jsonBody.name !== "string") {
            request.end(400, "Name must be a string");
            return;
        }

        request.jsonBody.name = request.jsonBody.name.trim();

        if (request.jsonBody.name.length < 2 || request.jsonBody.name.length > 50) {
            request.end(400, "Name must be between 2 and 50 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " name=?";
        args.push(request.jsonBody.name);
    }

    if (typeof request.jsonBody.description !== "undefined") {
        if (typeof request.jsonBody.description !== "string") {
            request.end(400, "Description must be a string");
            return;
        }

        request.jsonBody.description = request.jsonBody.description.trim();

        if (request.jsonBody.description.length < 2 || request.jsonBody.description.length > 100) {
            request.end(400, "Description must be between 2 and 100 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " description=?";
        args.push(request.jsonBody.description);
    }

    if (typeof request.jsonBody.location !== "undefined") {
        if (typeof request.jsonBody.location !== "string") {
            request.end(400, "Location must be a string");
            return;
        }

        request.jsonBody.location = request.jsonBody.location.trim();

        if (request.jsonBody.location.length < 2 || request.jsonBody.location.length > 50) {
            request.end(400, "Location must be between 2 and 50 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " location=?";
        args.push(request.jsonBody.location);
    }

    if (typeof request.jsonBody.checkSecond !== "undefined") {
        if (typeof request.jsonBody.checkSecond !== "number" || isNaN(request.jsonBody.checkSecond)) {
            request.end(400, "Check second must be a number");
            return;
        }

        if (request.jsonBody.checkSecond < 0 || request.jsonBody.checkSecond > 59) {
            request.end(400, "Check second must be between 0 and 59");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " check_second=?";
        args.push(request.jsonBody.checkSecond);
    }

    sql += " WHERE checker_id=?";
    args.push(checker.id);

    try {
        await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
};

export const infos = {
    path: "/checkers/:checkerId",
    method: "PATCH",
    requiresAuth: true
};
