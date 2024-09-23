const { getPages } = require("../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let page;
    try {
        page = await getPages(database, request.authenticated ? [request.urlParams.pageId] : null, [request.urlParams.pageId], [request.urlParams.pageId], includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!page[0][0]) {
        request.end(400, "This page does not exist");
        return;
    }

    request.end(200, page[request.authenticated ? 0 : 1][0]);
}

module.exports.infos = {
    path: "/pages/:pageId",
    method: "GET",
    requiresAuth: false
}
