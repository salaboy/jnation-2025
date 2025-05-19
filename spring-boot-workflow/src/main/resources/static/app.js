const stompClient = new StompJs.Client({
});

function connect() {
    console.log("Fetching Server Info")
    fetch("/server-info", {
        method: "GET",
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    }).then((response) => {
        console.log("Fetching Response")
        return response.json();
    }).then((response) => {
        var publicURL = 'ws://' + response.publicIp + '/ws';
        stompClient.brokerURL = publicURL;
        console.log(publicURL);
        console.log("Activating client")
        stompClient.activate();
    }).catch((error) => {
        console.error(`Could not get server-info: ${error}`);
    });

};

stompClient.onConnect = (frame) => {
    setConnected(true);
    console.log('Connected: ' + frame);
    stompClient.subscribe('/topic/events', (event) => {
        console.log(JSON.parse(event.body));
        showEvent(event.body);

    });
};

stompClient.onWebSocketError = (error) => {
    console.error('Error with websocket', error);
};

stompClient.onStompError = (frame) => {
    console.error('Broker reported error: ' + frame.headers['message']);
    console.error('Additional details: ' + frame.body);
};

function setConnected(connected) {
    $("#connect").prop("disabled", connected);
    $("#disconnect").prop("disabled", !connected);
    if (connected) {
        $("#conversation").show();
    }
    else {
        $("#conversation").hide();
    }
    $("#events").html("");
}



function approveOrder(orderId) {
    console.log("Approving Order");
    console.log(orderId);

    //Send Order Approval
    fetch("/order/approve", {
        method: "POST",
        body: JSON.stringify({
            id: orderId
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    });

}

function disconnect() {
    stompClient.deactivate();
    setConnected(false);
    console.log("Disconnected");
}



function createOrderEntry(order) {
    console.log("creating order entry");
    console.log(order);
    var orderEntry = "<div>" +
        "<p>Id: <strong>" + order.order.id + "</strong></p>" +
        "<p>Item: <strong>" + order.order.item + "</strong></p>" +
        "<p>Amount: <strong>" + order.order.amount + "</strong></p>" +
        "<button onclick=\"approveOrder('"+ order.order.id +"')\"> <strong>Approve</strong></button>" +
        "</div>";
    return orderEntry;

}

function showEvent(event) {

    eventObject = JSON.parse(event);
    console.log(eventObject)
    $("#events").append(createOrderEntry(eventObject));


}

$(function () {
    $("form").on('submit', (e) => e.preventDefault());
    $("#disconnect").click(() => disconnect());
});