const { query } = require("raraph84-lib");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql").Pool} database 
 */
module.exports.run = async (request, database) => {

    let node;
    try {
        node = (await query(database, "SELECT * FROM Nodes WHERE Node_ID=?", [request.urlParams.id]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (!node) {
        request.end(400, "This node does not exist");
        return;
    }

    let lastStatus;
    try {
        lastStatus = (await query(database, "SELECT * FROM Nodes_Events WHERE Node_ID=? ORDER BY Minute DESC LIMIT 1", [node.Node_ID]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    request.end(200, {
        id: node.Node_ID,
        name: node.Name,
        online: lastStatus && lastStatus.Online,
        disabled: !!node.Disabled
    });
}

module.exports.infos = {
    path: "/nodes/:id",
    method: "GET"
}
