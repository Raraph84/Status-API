const { getPages, getServices } = require("../../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    let page;
    try {
        page = (await getPages(database, [request.urlParams.pageId], null, null, ["services"]))[0][0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!page) {
        request.end(400, "This page does not exist");
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

    const pageService = page.services.find((pageService) => pageService.service === service.id);
    if (!pageService) {
        request.end(400, "This service is already not linked to this page");
        return;
    }

    try {
        await database.query("DELETE FROM pages_services WHERE page_id=? && service_id=?", [page.id, service.id]);
        await database.query("UPDATE pages_services SET position=position-1 WHERE page_id=? && position>?", [page.id, pageService.position]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
}

module.exports.infos = {
    path: "/pages/:pageId/services/:serviceId",
    method: "DELETE",
    requiresAuth: true
}
