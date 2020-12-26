console.log("Let's paint together!");

// Global variables
var peer = null;
var conn = null;

var status = document.getElementById("status");
var myId = document.getElementById("my-id");
var partnesId = document.getElementById("partners-id");
var connectButton = document.getElementById("connect-button");
var receivedMessage = document.getElementById("received-messages");
var messageToSend = document.getElementById("message-to-send");
var sendButton = document.getElementById("send-button");

var MY_ID = "";
var PEER_ID = "";

var DRAWING = false;
var DRAWING_DATA = {
    x: 0,
    y: 0,
    colour: "#FF0000",
};

// Happens to all
function init() {
    peer = new Peer(null, {});

    peer.on("open", function (id) {
        if (peer.id === null) {
            console.log("Can't get ID...");
        }
        else {
            console.log("My ID is", peer.id);
            MY_ID = peer.id;
            document.getElementById("my-id").innerHTML = "My ID is " + peer.id;
            document.getElementById("status").innerHTML = "Status: Awaiting connection...";
        }
    });

    // Second move
    peer.on("connection", function (c) {
        conn = c;
        console.log(conn.peer, "connected to you");
        PEER_ID = conn.peer;
        document.getElementById("status").innerHTML = "Status: " + conn.peer + " connected to you";
        ready();
    });

    let localStream = null;
    const startChat = async () => {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true })
        document.querySelector("video#local").srcObject = localStream;
    }
    startChat();
}

// First move
function join() {
    conn = peer.connect(document.getElementById("partners-id").value, {
        reliable: true
    });

    conn.on("open", function () {
        console.log("Connected to", conn.peer);
        PEER_ID = conn.peer;
        document.getElementById("status").innerHTML = "Status: Connected to " + conn.peer;
    });

    conn.on("data", function (data) {
        console.log(conn.peer, "sent you", data);
        addMessage(PEER_ID, data);
    });

    var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    getUserMedia({ video: true, audio: true }, function (stream) {
        var call = peer.call(conn.peer, stream);
        call.on("stream", function (remoteStream) {
            // Show stream in some video/canvas element.
            document.querySelector("video#remote").srcObject = remoteStream;
        });
    }, function (err) {
        console.log("Failed to get local stream", err);
    });
}

// Second move
function ready() {
    conn.on("data", function (data) {
        console.log(conn.peer, "sent you", data);
        addMessage(PEER_ID, data);
    });

    var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    peer.on("call", function (call) {
        getUserMedia({ video: true, audio: true }, function (stream) {
            call.answer(stream); // Answer the call with an A/V stream.
            call.on("stream", function (remoteStream) {
                document.querySelector("video#remote").srcObject = remoteStream;
            });
        }, function (err) {
            console.log('Failed to get local stream', err);
        });
    });
}

// All
function send() {
    var message = document.getElementById("message-to-send").value;
    if (message != "") {
        conn.send(message);
        addMessage(MY_ID, message);
        document.getElementById("message-to-send").value = "";
    }
}

// All
function addMessage(sender, message) {
    var newLiElement = document.createElement("li");
    var newMessage = document.createTextNode(sender + " at " + Date.now() + ": " + message);
    newLiElement.appendChild(newMessage);
    document.getElementById("received-messages").appendChild(newLiElement);
}

function drawLine(x0, y0, x1, y1, colour, emit) {
    var context = document.getElementById("whiteboard").getContext("2d");
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = colour;
    context.lineWidth = 2;
    context.stroke();
    context.closePath();

    if (emit) {
        // TODO: Form data and send it
    }
}

function drawGetX(e) {
    var rect = document.getElementById("whiteboard").getBoundingClientRect();
    return e.clientX - rect.left || e.touches[0].clientX - rect.left;
}

function drawGetY(e) {
    var rect = document.getElementById("whiteboard").getBoundingClientRect();
    return e.clientY - rect.top || e.touches[0].clientY - rect.top;
}

function onMouseDown(e) {
    DRAWING = true;
    DRAWING_DATA.x = drawGetX(e);
    DRAWING_DATA.y = drawGetY(e);
}

function onMouseUp(e) {
    if (!DRAWING) { return; }
    DRAWING = false;
    drawLine(DRAWING_DATA.x, DRAWING_DATA.y, drawGetX(e), drawGetY(e), DRAWING_DATA.colour, true);
}

function onMouseMove(e) {
    if (!DRAWING) { return; }
    drawLine(DRAWING_DATA.x, DRAWING_DATA.y, drawGetX(e), drawGetY(e), DRAWING_DATA.colour, true);
    DRAWING_DATA.x = drawGetX(e);
    DRAWING_DATA.y = drawGetY(e);
}

// FIXME: Get corrent size as column + drawing disapeer after resize
function onResize() {
    document.getElementById("whiteboard").width = document.getElementById("drawing-area").offsetWidth;
    document.getElementById("whiteboard").height = document.getElementById("drawing-area").offsetHeight;
}

window.addEventListener("load", function () {
    document.getElementById("connect-button").addEventListener("click", join);
    document.getElementById("send-button").addEventListener("click", send);
    init();

    document.getElementById("whiteboard").addEventListener("mousedown", onMouseDown, false);
    document.getElementById("whiteboard").addEventListener("mouseup", onMouseUp, false);
    document.getElementById("whiteboard").addEventListener("mouseout", onMouseUp, false);
    document.getElementById("whiteboard").addEventListener("mousemove", onMouseMove, false);

    window.addEventListener("resize", onResize, false);
});
