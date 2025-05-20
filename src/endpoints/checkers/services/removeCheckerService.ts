import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getCheckers, getServices } from "../../../resources";

export const run = async (request: Request, database: Pool) => {
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

    let service;
    try {
        service = (await getServices(database, [parseInt(request.urlParams.serviceId)]))[0][0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!service) {
        request.end(400, "This service does not exist");
        return;
    }

    try {
        await database.query("DELETE FROM checkers_services WHERE checker_id=? && service_id=?", [
            checker.id,
            service.id
        ]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
};

export const infos = {
    path: "/checkers/:checkerId/services/:serviceId",
    method: "DELETE",
    requiresAuth: true
};
