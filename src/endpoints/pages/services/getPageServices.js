const { getPages, getPagesServices } = require("../../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let page;
    try {
        page = (await getPages(database, [request.urlParams.pageId]))[0][0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!page) {
        request.end(400, "This page does not exist");
        return;
    }

    let pageServices;
    try {
        pageServices = await getPagesServices(database, [page.id], includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { services: pageServices[request.authenticated ? 0 : 1] });
}

module.exports.infos = {
    path: "/pages/:pageId/services",
    method: "GET",
    requiresAuth: true
}
