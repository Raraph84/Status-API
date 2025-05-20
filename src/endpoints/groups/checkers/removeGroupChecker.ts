import { Request } from "raraph84-lib";
import { Pool } from "mysql2/promise";
import { getGroups, getCheckers } from "../../../resources";

export const run = async (request: Request, database: Pool) => {
    let group;
    try {
        group = (await getGroups(database, [parseInt(request.urlParams.groupId) || 0]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!group) {
        request.end(404, "This group does not exist");
        return;
    }

    let checker;
    try {
        checker = (await getCheckers(database, [parseInt(request.urlParams.checkerId) || 0]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!checker) {
        request.end(400, "This checker does not exist");
        return;
    }

    try {
        await database.query("DELETE FROM groups_checkers WHERE group_id=? AND checker_id=?", [group.id, checker.id]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
};

export const infos = {
    path: "/groups/:groupId/checkers/:checkerId",
    method: "DELETE",
    requiresAuth: true
};
