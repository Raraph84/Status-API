const { getServices } = require("../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let service;
    try {
        service = await getServices(database, [request.urlParams.serviceId], includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!service[0][0]) {
        request.end(400, "This service does not exist");
        return;
    }

    request.end(200, service[request.authenticated ? 0 : 1][0]);
}

module.exports.infos = {
    path: "/services/:serviceId",
    method: "GET",
    requiresAuth: false
}
