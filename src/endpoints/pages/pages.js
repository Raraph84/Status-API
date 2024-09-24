const { getPages } = require("../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let pages;
    try {
        pages = await getPages(database, null, null, null, includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { pages: pages[0] });
}

module.exports.infos = {
    path: "/pages",
    method: "GET",
    requiresAuth: true
}
