import { Pool } from "mysql2/promise";
import { Request } from "raraph84-lib";
import { getPages } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let page;
    try {
        page = await getPages(database, request.metadata.authenticated ? [parseInt(request.urlParams.pageId) || 0] : null, [request.urlParams.pageId], [request.urlParams.pageId], includes);
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!page[0][0]) {
        request.end(400, "This page does not exist");
        return;
    }

    request.end(200, page[request.metadata.authenticated ? 0 : 1][0]);
};

export const infos = {
    path: "/pages/:pageId",
    method: "GET",
    requiresAuth: false
};
