import { Pool } from "mysql2/promise";
import { Request } from "raraph84-lib";
import { getPages, getPagesServices } from "../../../resources";

export const run = async (request: Request, database: Pool) => {
    const includes = request.searchParams.get("includes")?.toLowerCase().split(",") || [];

    let page;
    try {
        page = (await getPages(database, [parseInt(request.urlParams.pageId) || 0]))[0][0];
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

    request.end(200, { services: pageServices[request.metadata.authenticated ? 0 : 1] });
};

export const infos = {
    path: "/pages/:pageId/services",
    method: "GET",
    requiresAuth: true
};
