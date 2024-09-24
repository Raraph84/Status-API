const { getServices } = require("../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let services;
    try {
        services = await getServices(database, null, includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { services: services[0] });
}

module.exports.infos = {
    path: "/services",
    method: "GET",
    requiresAuth: true
}
