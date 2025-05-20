const { getCheckers } = require("../../resources");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let checker;
    try {
        checker = (await getCheckers(database, [request.urlParams.checkerId], includes))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!checker) {
        request.end(400, "This checker does not exist");
        return;
    }

    request.end(200, checker);
}

module.exports.infos = {
    path: "/checkers/:checkerId",
    method: "GET",
    requiresAuth: true
}
