import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getCheckers } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let checkers;
    try {
        checkers = await getCheckers(database, null, includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { checkers });
};

export const infos = {
    path: "/checkers",
    method: "GET",
    requiresAuth: true
};
