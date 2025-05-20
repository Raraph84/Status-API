import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getCheckers, getCheckersServices } from "../../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let checker;
    try {
        checker = (await getCheckers(database, [parseInt(request.urlParams.checkerId)]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!checker) {
        request.end(400, "This checker does not exist");
        return;
    }

    let checkerServices;
    try {
        checkerServices = await getCheckersServices(database, [checker.id], includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { services: checkerServices });
};

export const infos = {
    path: "/checkers/:checkerId/services",
    method: "GET",
    requiresAuth: true
};
