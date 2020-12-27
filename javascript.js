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
var CONNECTED = false;

var DRAWING = false;
var DRAWING_DATA = {
    x: 0,
    y: 0,
    colour: "#FF0000",
};

const PROTOCOL = {
    TEXT_MESSAGE: 0,
    DRAWING: 1,
    CANVAS_SETTINGS_INIT: 2,
    CANVAS_SETTINGS_FINAL: 3,
};

// Happens to all
function init() {
    document.getElementById("message-to-send").setAttribute("disabled", "disabled");
    document.getElementById("send-button").setAttribute("disabled", "disabled");

    document.getElementById("whiteboard").style.display = "none";

    peer = new Peer(null, {});

    peer.on("open", function (id) {
        if (peer.id === null) {
            console.log("Can't get ID...");
        }
        else {
            console.log("My ID is", peer.id);
            MY_ID = peer.id;
            document.getElementById("my-id").value = peer.id;
            document.getElementById("status").innerHTML = "Waiting";
        }
    });

    // Second move
    peer.on("connection", function (c) {
        conn = c;
        console.log(conn.peer, "connected to you");
        PEER_ID = conn.peer;
        CONNECTED = true;
        document.getElementById("status").innerHTML = conn.peer + " connected to you";

        document.getElementById("partners-id").setAttribute("disabled", "disabled");
        document.getElementById("connect-button").setAttribute("disabled", "disabled");
        document.getElementById("message-to-send").removeAttribute("disabled");
        document.getElementById("send-button").removeAttribute("disabled");
        ready();
    });

    // Open my/local webcam
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
        CONNECTED = true;
        document.getElementById("status").innerHTML = "Connected to " + conn.peer;

        document.getElementById("partners-id").setAttribute("disabled", "disabled");
        document.getElementById("connect-button").setAttribute("disabled", "disabled");
        document.getElementById("message-to-send").removeAttribute("disabled");
        document.getElementById("send-button").removeAttribute("disabled");
    });

    conn.on("data", function (data) {
        console.log(conn.peer, "sent you", data);
        handleReceivedData(data);
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
    sendCanvasSize(document.getElementById("drawing-area").offsetWidth, 
            document.getElementById("drawing-area").offsetHeight, PROTOCOL.CANVAS_SETTINGS_INIT, "second");

    conn.on("data", function (data) {
        console.log(conn.peer, "sent you", data);
        handleReceivedData(data);
    });

    // Start peers/remote A+V
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
function sendTextMessage() {
    var message = document.getElementById("message-to-send").value;
    if (message != "") {
        conn.send(preparePacketForSending(PROTOCOL.TEXT_MESSAGE, message));
        addMessage(MY_ID, message);
        document.getElementById("message-to-send").value = "";
    }
}

// All
function addMessage(sender, message) {
    var newLiElement = document.createElement("li");
    var newMessage = document.createTextNode(sender + " at " + Date() + ": " + message);
    newLiElement.appendChild(newMessage);
    document.getElementById("received-messages").appendChild(newLiElement);
    scrollChatDown();
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
        var dataToSend = {
            x0: x0,
            y0: y0,
            x1: x1,
            y1: y1,
            colour: "#FF0000",
        };
        console.log(dataToSend);
        conn.send(preparePacketForSending(PROTOCOL.DRAWING, dataToSend));
    }
}

function preparePacketForSending(protocol, payload) {
    return data = {
        protocol: protocol,
        payload: payload
    };
}

function handleReceivedData(data) {
    switch (data["protocol"]) {
        case PROTOCOL.TEXT_MESSAGE:
            console.log("Text");
            addMessage(PEER_ID, data["payload"]);
            break;
        case PROTOCOL.DRAWING:
            console.log("Drawing...");
            drawLine(data["payload"]["x0"], data["payload"]["y0"], data["payload"]["x1"], data["payload"]["y1"], data["payload"]["colour"], false);
            break;
        case PROTOCOL.CANVAS_SETTINGS_INIT:
            console.log("Canvas negotiation...");
            var smallestW = (data["payload"]["canvasWidth"] <= document.getElementById("drawing-area").offsetWidth) ? data["payload"]["canvasWidth"] : document.getElementById("drawing-area").offsetWidth;
            var smallestH = (data["payload"]["canvasHeight"] <= document.getElementById("drawing-area").offsetWidth) ? data["payload"]["canvasHeight"] : document.getElementById("drawing-area").offsetHeight;
            setCanvasSize(smallestW, smallestH);
            document.getElementById("whiteboard").style.display = "block";
            sendCanvasSize(smallestW, smallestH, PROTOCOL.CANVAS_SETTINGS_FINAL, "handler");
            break;
        case PROTOCOL.CANVAS_SETTINGS_FINAL:
            console.log("Canvas final...");
            setCanvasSize(data["payload"]["canvasWidth"], data["payload"]["canvasHeight"]);
            document.getElementById("whiteboard").style.display = "block";
            break;
        default:
            console.log("Something new...");
            break;
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

// FIXME: Drawing disapeer after resize
function setCanvasSize(w, h) {
    document.getElementById("whiteboard").width = w;
    document.getElementById("whiteboard").height = h;
}

// Set the same canvas size, no scaling
function sendCanvasSize(w, h, protocol, note) {
    console.log(note, "sendCanvasSize", w, h, protocol);
    var canvasSettings = {
        canvasWidth: w,
        canvasHeight: h,
    };
    conn.send(preparePacketForSending(protocol, canvasSettings));   
}

// Front, settings
function copyMyId() {
    document.getElementById("my-id").select();
    document.execCommand("copy");
}

// Front, chat
function scrollChatDown(){
    document.getElementById("received-messages").scrollTop = document.getElementById("received-messages").scrollHeight;
}

window.addEventListener("load", function () {
    document.getElementById("connect-button").addEventListener("click", join);
    document.getElementById("send-button").addEventListener("click", sendTextMessage);
    init();

    document.getElementById("whiteboard").addEventListener("mousedown", onMouseDown, false);
    document.getElementById("whiteboard").addEventListener("mouseup", onMouseUp, false);
    document.getElementById("whiteboard").addEventListener("mouseout", onMouseUp, false);
    document.getElementById("whiteboard").addEventListener("mousemove", onMouseMove, false);

    document.getElementById("copy-id-button").addEventListener("click", copyMyId);
});
