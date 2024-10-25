/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (typeof request.jsonBody.type === "undefined") {
        request.end(400, "Missing type");
        return;
    }

    if (typeof request.jsonBody.type !== "string") {
        request.end(400, "Type must be a string");
        return;
    }

    if (!["website", "api", "gateway", "minecraft", "server"].includes(request.jsonBody.type)) {
        request.end(400, "Invalid type");
        return;
    }

    if (typeof request.jsonBody.name === "undefined") {
        request.end(400, "Missing name");
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

    if (typeof request.jsonBody.host === "undefined") {
        request.end(400, "Missing host");
        return;
    }

    if (typeof request.jsonBody.host !== "string") {
        request.end(400, "Host must be a string");
        return;
    }

    if (request.jsonBody.host.length < 2 || request.jsonBody.host.length > 100) {
        request.end(400, "Host must be between 2 and 100 characters");
        return;
    }

    if (typeof request.jsonBody.disabled === "undefined") {
        request.end(400, "Missing disabled");
        return;
    }

    if (typeof request.jsonBody.disabled !== "boolean") {
        request.end(400, "Disabled must be a boolean");
        return;
    }

    let serviceId;
    try {
        serviceId = (await database.query("INSERT INTO services (type, name, host, disabled) VALUES (?, ?, ?, ?)", [request.jsonBody.type, request.jsonBody.name, request.jsonBody.host, request.jsonBody.disabled]))[0].insertId;
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    request.end(200, { id: serviceId });
}

module.exports.infos = {
    path: "/services",
    method: "POST",
    requiresAuth: true
}
