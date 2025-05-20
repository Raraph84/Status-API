const { getCheckers, getServices } = require("../../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    let checker;
    try {
        checker = (await getCheckers(database, [request.urlParams.checkerId]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!checker) {
        request.end(400, "This checker does not exist");
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

    try {
        await database.query("DELETE FROM checkers_services WHERE checker_id=? && service_id=?", [checker.id, service.id]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
}

module.exports.infos = {
    path: "/checkers/:checkerId/services/:serviceId",
    method: "DELETE",
    requiresAuth: true
}
