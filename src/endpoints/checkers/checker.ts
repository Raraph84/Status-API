import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getCheckers } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let checker;
    try {
        checker = (await getCheckers(database, [parseInt(request.urlParams.checkerId)], includes))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!checker) {
        request.end(400, "This checker does not exist");
        return;
    }

    request.end(200, checker);
};

export const infos = {
    path: "/checkers/:checkerId",
    method: "GET",
    requiresAuth: true
};
