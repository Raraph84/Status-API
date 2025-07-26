import { Pool } from "mysql2/promise";
import { Request } from "raraph84-lib";
import { getPages } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let pages;
    try {
        pages = await getPages(database, null, null, null, includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    request.end(200, { pages: pages[0] });
};

export const infos = {
    path: "/pages",
    method: "GET",
    requiresAuth: true
};
