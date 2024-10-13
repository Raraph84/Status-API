const { getPages, getServices } = require("../../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (typeof request.jsonBody.displayName === "undefined" && typeof request.jsonBody.position === "undefined") {
        request.end(400, "Nothing to update");
        return;
    }

    if (typeof request.jsonBody.displayName !== "undefined" && (typeof request.jsonBody.displayName !== "string" && request.jsonBody.displayName !== null)) {
        request.end(400, "Display name must be a string or null");
        return;
    }

    if (typeof request.jsonBody.displayName === "string" && (request.jsonBody.displayName.length < 2 || request.jsonBody.displayName.length > 50)) {
        request.end(400, "Display name must be between 2 and 50 characters");
        return;
    }

    if (typeof request.jsonBody.position !== "undefined" && typeof request.jsonBody.position !== "number") {
        request.end(400, "Position must be a number");
        return;
    }

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
        request.end(400, "This service is not linked to this page");
        return;
    }

    if (typeof request.jsonBody.position !== "undefined" && (request.jsonBody.position < 1 || request.jsonBody.position > page.services.length)) {
        request.end(400, "Position must be between 1 and the number of services");
        return;
    }

    if (typeof request.jsonBody.displayName !== "undefined") {
        try {
            await database.query("UPDATE pages_services SET display_name=? WHERE page_id=? && service_id=?", [request.jsonBody.displayName, page.id, service.id]);
        } catch (error) {
            console.log(`SQL Error - ${__filename} - ${error}`);
            request.end(500, "Internal server error");
            return;
        }
    }

    if (typeof request.jsonBody.position !== "undefined") {
        try {
            await database.query("UPDATE pages_services SET position=position-1 WHERE page_id=? && position>? && position<=?", [page.id, pageService.position, request.jsonBody.position]);
            await database.query("UPDATE pages_services SET position=position+1 WHERE page_id=? && position>=? && position<?", [page.id, request.jsonBody.position, pageService.position]);
            await database.query("UPDATE pages_services SET position=? WHERE page_id=? && service_id=?", [request.jsonBody.position, page.id, service.id]);
        } catch (error) {
            console.log(`SQL Error - ${__filename} - ${error}`);
            request.end(500, "Internal server error");
            return;
        }
    }

    request.end(204);
}

module.exports.infos = {
    path: "/pages/:pageId/services/:serviceId",
    method: "PATCH",
    requiresAuth: true
}
