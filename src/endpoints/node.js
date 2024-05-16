/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    let service;
    try {
        [service] = await database.query("SELECT * FROM services WHERE service_id=?", [request.urlParams.serviceId]);
        service = service[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (!service) {
        request.end(400, "This service does not exist");
        return;
    }

    let lastEvent;
    try {
        [lastEvent] = await database.query("SELECT * FROM services_events WHERE service_id=? ORDER BY minute DESC LIMIT 1", [service.service_id]);
        lastEvent = lastEvent[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    request.end(200, {
        id: service.service_id,
        name: service.name,
        online: !!lastEvent?.online || false,
        disabled: !!service.disabled
    });
}

module.exports.infos = {
    path: "/services/:serviceId",
    method: "GET"
}
