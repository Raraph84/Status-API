const { getServices } = require("../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (typeof request.jsonBody.type === "undefined"
        && typeof request.jsonBody.name === "undefined"
        && typeof request.jsonBody.host === "undefined"
        && typeof request.jsonBody.protocol === "undefined"
        && typeof request.jsonBody.disabled === "undefined") {
        request.end(400, "Missing type, name, host, protocol or disabled");
        return;
    }

    let service;
    try {
        service = (await getServices(database, [request.urlParams.serviceId]))[0][0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!service) {
        request.end(400, "This service does not exist");
        return;
    }

    let sql = "UPDATE services ";
    const args = [];

    if (typeof request.jsonBody.type !== "undefined") {

        if (typeof request.jsonBody.type !== "string") {
            request.end(400, "Type must be a string");
            return;
        }

        if (!["website", "api", "gateway", "minecraft", "server"].includes(request.jsonBody.type)) {
            request.end(400, "Invalid type");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " type=?";
        args.push(request.jsonBody.type);
    }

    if (typeof request.jsonBody.name !== "undefined") {

        if (typeof request.jsonBody.name !== "string") {
            request.end(400, "Name must be a string");
            return;
        }

        if (request.jsonBody.name.length < 2 || request.jsonBody.name.length > 50) {
            request.end(400, "Name must be between 2 and 50 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " name=?";
        args.push(request.jsonBody.name);
    }

    if (typeof request.jsonBody.host !== "undefined") {

        if (typeof request.jsonBody.host !== "string") {
            request.end(400, "Host must be a string");
            return;
        }

        if (request.jsonBody.host.length < 2 || request.jsonBody.host.length > 100) {
            request.end(400, "Host must be between 2 and 100 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " host=?";
        args.push(request.jsonBody.host);
    }

    if (typeof request.jsonBody.protocol !== "undefined") {

        if (typeof request.jsonBody.protocol !== "number") {
            request.end(400, "Protocol must be a number");
            return;
        }

        if (![0, 4, 6].includes(request.jsonBody.protocol)) {
            request.end(400, "Protocol must be a 0, 4 or 6");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " protocol=?";
        args.push(request.jsonBody.protocol);
    }

    if (typeof request.jsonBody.disabled !== "undefined") {

        if (typeof request.jsonBody.disabled !== "boolean") {
            request.end(400, "Disabled must be a boolean");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " disabled=?";
        args.push(request.jsonBody.disabled);
    }

    sql += " WHERE service_id=?";
    args.push(service.id);

    try {
        await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
}

module.exports.infos = {
    path: "/services/:serviceId",
    method: "PATCH",
    requiresAuth: true
}
