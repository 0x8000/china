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

const COLOURS = {
    WHITE: "#fff",
    BLACK: "#0a0a0a",
    BLUE: "#209cee",
    GREEN: "#23d160",
    YELLOW: "#ffdd57",
    RED: "#ff3860"
};
var SELECTED_COLOUR = COLOURS.BLACK;

var DRAWING = false;
var DRAWING_TEXT = false;
var DRAWING_DATA = {
    x: 0,
    y: 0,
    colour: COLOURS.BLACK,
};

const PROTOCOL = {
    TEXT_MESSAGE: 0,
    DRAWING: 1,
    CANVAS_SETTINGS_INIT: 2,
    CANVAS_SETTINGS_FINAL: 3,
    DRAWING_TEXT: 4,
};

// Happens to all
function init() {
    document.getElementById("message-to-send").setAttribute("disabled", "disabled");
    document.getElementById("send-button").setAttribute("disabled", "disabled");
    document.getElementById("settings-button").setAttribute("disabled", "disabled");
    document.getElementById("quit-button").setAttribute("disabled", "disabled");

    document.getElementById("whiteboard").style.display = "none";
    document.getElementById("colour-buttons").style.display = "none";

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

        // FIXME: Add disconnect
        document.getElementById("partners-id").setAttribute("disabled", "disabled");
        document.getElementById("connect-button").setAttribute("disabled", "disabled");
        document.getElementById("message-to-send").removeAttribute("disabled");
        document.getElementById("send-button").removeAttribute("disabled");
        document.getElementById("settings-button").removeAttribute("disabled");
        document.getElementById("quit-button").removeAttribute("disabled");

        document.getElementById("colour-buttons").style.display = "flex";

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
    // TODO: Add error handling
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
        document.getElementById("settings-button").removeAttribute("disabled");
        document.getElementById("quit-button").removeAttribute("disabled");

        document.getElementById("colour-buttons").style.display = "flex";

        fixCanvas();
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
            colour: colour,
        };
        console.log(dataToSend);
        conn.send(preparePacketForSending(PROTOCOL.DRAWING, dataToSend));
    }
}

function drawText(x, y, text, colour, emit) {
    var context = document.getElementById("whiteboard").getContext("2d");
    context.font = "25px Verdana";
    context.fillStyle = colour;
    context.fillText(text, x, y);

    if (emit) {
        var dataToSend = {
            x: x,
            y: y,
            text: text,
            colour: colour
        };
        conn.send(preparePacketForSending(PROTOCOL.DRAWING_TEXT, dataToSend));
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
            var canvasSettings = {
                canvasWidth: smallestW,
                canvasHeight: smallestH,
            };
            conn.send(preparePacketForSending(PROTOCOL.CANVAS_SETTINGS_FINAL, canvasSettings));
            break;
        case PROTOCOL.CANVAS_SETTINGS_FINAL:
            console.log("Canvas final...");
            setCanvasSize(data["payload"]["canvasWidth"], data["payload"]["canvasHeight"]);
            document.getElementById("whiteboard").style.display = "block";
            break;
        case PROTOCOL.DRAWING_TEXT:
            console.log("Drawing text...");
            drawText(data["payload"]["x"], data["payload"]["y"], data["payload"]["text"], data["payload"]["colour"], false);
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
    if (DRAWING_TEXT) {
        var text = window.prompt("Enter text");
        drawText(drawGetX(e), drawGetY(e), text, SELECTED_COLOUR, true);
        DRAWING_TEXT = false;
        document.getElementById("text-to-whiteboard").classList.remove("is-focused");
    }
    else {
        DRAWING = true;
        DRAWING_DATA.x = drawGetX(e);
        DRAWING_DATA.y = drawGetY(e);
    }
}

function onMouseUp(e) {
    if (!DRAWING) { return; }
    DRAWING = false;
    drawLine(DRAWING_DATA.x, DRAWING_DATA.y, drawGetX(e), drawGetY(e), SELECTED_COLOUR, true);
}

function onMouseMove(e) {
    if (!DRAWING) { return; }
    drawLine(DRAWING_DATA.x, DRAWING_DATA.y, drawGetX(e), drawGetY(e), SELECTED_COLOUR, true);
    DRAWING_DATA.x = drawGetX(e);
    DRAWING_DATA.y = drawGetY(e);
}

// FIXME: Drawing disapeer after resize
function setCanvasSize(w, h) {
    document.getElementById("whiteboard").width = w;
    document.getElementById("whiteboard").height = h;
}

function fixCanvas() {
    var canvasSettings = {
        canvasWidth: document.getElementById("drawing-area").offsetWidth,
        canvasHeight: document.getElementById("drawing-area").offsetHeight,
    };
    conn.send(preparePacketForSending(PROTOCOL.CANVAS_SETTINGS_INIT, canvasSettings));
}

// Text to whiteboard
function textToWhiteboard() {
    document.getElementById("text-to-whiteboard").classList.add("is-focused");
    DRAWING_TEXT = true;
}

// Front, settings
function copyMyId() {
    document.getElementById("my-id").select();
    document.execCommand("copy");
}

// Front, chat
function scrollChatDown() {
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

    // Whiteboard colours
    document.getElementById("colour-white").addEventListener("click", function(){
        SELECTED_COLOUR = COLOURS.WHITE;
    });
    document.getElementById("colour-black").addEventListener("click", function(){
        SELECTED_COLOUR = COLOURS.BLACK;
    });
    document.getElementById("colour-blue").addEventListener("click", function(){
        SELECTED_COLOUR = COLOURS.BLUE;
    });
    document.getElementById("colour-green").addEventListener("click", function(){
        SELECTED_COLOUR = COLOURS.GREEN;
    });
    document.getElementById("colour-yellow").addEventListener("click", function(){
        SELECTED_COLOUR = COLOURS.YELLOW;
    });
    document.getElementById("colour-red").addEventListener("click", function(){
        SELECTED_COLOUR = COLOURS.RED;
    });
    document.getElementById("text-to-whiteboard").addEventListener("click", textToWhiteboard);

    // Buttons
    document.getElementById("settings-button").addEventListener("click", function(){
        document.getElementById("modal-settings").style.display = "flex";
    });

    // Modal, settings
    document.getElementById("modal-settings-close").addEventListener("click", function(){
        document.getElementById("modal-settings").style.display = "none";
    });
    document.getElementById("modal-settings-cancel").addEventListener("click", function(){
        document.getElementById("modal-settings").style.display = "none";
    });
    
    //modal-settings-save
    

});
