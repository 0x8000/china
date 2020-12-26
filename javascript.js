console.log("Let's paint together!");

// Global variables
var peer = null;
var conn = null;

var status = document.getElementById("status");
var myId = document.getElementById("my-id");
var partnesId = document.getElementById("partners-id");
var connectButton = document.getElementById("connect-button");
var receivedMessage = document.getElementById("received-message");
var messageToSend = document.getElementById("message-to-send");
var sendButton = document.getElementById("send-button");

// Happens to all
function init() {
    peer = new Peer(null, {});

    peer.on("open", function (id) {
        if (peer.id === null) {
            console.log("Can't get ID...");
        }
        else {
            console.log("My ID is", peer.id);
            document.getElementById("my-id").innerHTML = "My ID is " + peer.id;
            document.getElementById("status").innerHTML = "Status: Awaiting connection...";
        }
    });

    // Second move
    peer.on("connection", function (c) {
        conn = c;
        console.log(conn.peer, "connected to you");
        document.getElementById("status").innerHTML = "Status: " + conn.peer + " connected to you";
        ready();
    });

    let localStream = null;
    const startChat = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({video: true})
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
        document.getElementById("status").innerHTML = "Status: Connected to " + conn.peer;
    });

    conn.on("data", function (data) {
        console.log(conn.peer, "sent you", data);
        document.getElementById("received-message").innerHTML = conn.peer + " sent you " + data;
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
        document.getElementById("received-message").innerHTML = conn.peer + " sent you " + data;
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
    }
}

window.addEventListener("load", function () {
    document.getElementById("connect-button").addEventListener("click", join);
    document.getElementById("send-button").addEventListener("click", send);
    init();
});
