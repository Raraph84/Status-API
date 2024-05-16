/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    let node;
    try {
        [node] = await database.query("SELECT * FROM Nodes WHERE Node_ID=?", [request.urlParams.id]);
        node = node[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (!node) {
        request.end(400, "This node does not exist");
        return;
    }

    let lastEvent;
    try {
        [lastEvent] = await database.query("SELECT * FROM services_events WHERE service_id=? ORDER BY minute DESC LIMIT 1", [node.Node_ID]);
        lastEvent = lastEvent[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    request.end(200, {
        id: node.Node_ID,
        name: node.Name,
        online: !!lastEvent?.online || false,
        disabled: !!node.Disabled
    });
}

module.exports.infos = {
    path: "/nodes/:id",
    method: "GET"
}
