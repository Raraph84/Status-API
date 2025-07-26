import { Pool } from "mysql2/promise";
import { Request } from "raraph84-lib";
import { getPages } from "../../resources";

export const run = async (request: Request, database: Pool) => {
    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (
        typeof request.jsonBody.shortName === "undefined" &&
        typeof request.jsonBody.title === "undefined" &&
        typeof request.jsonBody.url === "undefined" &&
        typeof request.jsonBody.logoUrl === "undefined" &&
        typeof request.jsonBody.domain === "undefined"
    ) {
        request.end(400, "Missing shortName, title, url, logoUrl or domain");
        return;
    }

    let page;
    try {
        page = (await getPages(database, [parseInt(request.urlParams.pageId) || 0]))[0][0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!page) {
        request.end(404, "This page does not exist");
        return;
    }

    let sql = "UPDATE pages ";
    const args = [];

    if (typeof request.jsonBody.shortName !== "undefined") {
        if (typeof request.jsonBody.shortName !== "string") {
            request.end(400, "Short name must be a string");
            return;
        }

        request.jsonBody.shortName = request.jsonBody.shortName.trim();

        if (request.jsonBody.shortName.length < 2 || request.jsonBody.shortName.length > 15) {
            request.end(400, "Short name must be between 2 and 15 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " short_name=?";
        args.push(request.jsonBody.shortName);
    }

    if (typeof request.jsonBody.title !== "undefined") {
        if (typeof request.jsonBody.title !== "string") {
            request.end(400, "Title must be a string");
            return;
        }

        request.jsonBody.title = request.jsonBody.title.trim();

        if (request.jsonBody.title.length < 2 || request.jsonBody.title.length > 50) {
            request.end(400, "Title must be between 2 and 50 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " title=?";
        args.push(request.jsonBody.title);
    }

    if (typeof request.jsonBody.url !== "undefined") {
        if (typeof request.jsonBody.url !== "string") {
            request.end(400, "Url must be a string");
            return;
        }

        request.jsonBody.url = request.jsonBody.url.trim();

        if (request.jsonBody.url.length < 2 || request.jsonBody.url.length > 500) {
            request.end(400, "Url must be between 2 and 500 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " url=?";
        args.push(request.jsonBody.url);
    }

    if (typeof request.jsonBody.logoUrl !== "undefined") {
        if (typeof request.jsonBody.logoUrl !== "string") {
            request.end(400, "Logo url must be a string");
            return;
        }

        request.jsonBody.logoUrl = request.jsonBody.logoUrl.trim();

        if (request.jsonBody.logoUrl.length < 2 || request.jsonBody.logoUrl.length > 500) {
            request.end(400, "Logo url must be between 2 and 500 characters");
            return;
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " logo_url=?";
        args.push(request.jsonBody.logoUrl);
    }

    if (typeof request.jsonBody.domain !== "undefined") {
        if (typeof request.jsonBody.domain !== "string" && request.jsonBody.domain !== null) {
            request.end(400, "Domain must be a string or null");
            return;
        }

        if (request.jsonBody.domain !== null) {
            request.jsonBody.domain = request.jsonBody.domain.trim();

            if (request.jsonBody.domain.length < 2 || request.jsonBody.domain.length > 50) {
                request.end(400, "Domain must be between 2 and 50 characters or null");
                return;
            }
        }

        sql += (!sql.includes("SET") ? "SET" : ",") + " domain=?";
        args.push(request.jsonBody.domain);
    }

    sql += " WHERE page_id=?";
    args.push(page.id);

    try {
        await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
};

export const infos = {
    path: "/pages/:pageId",
    method: "PATCH",
    requiresAuth: true
};
