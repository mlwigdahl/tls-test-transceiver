const tls = require('tls');
const fs = require('fs');
const net = require('net');

const PORT_IN = 8123; // arbitrary
const PORT_OUT = 8443;

//// TLS emitter section

const options = {
    key: fs.readFileSync('c:/webdev/tls-test-server/key.pem'),
    cert: fs.readFileSync('c:/webdev/tls-test-server/cert.pem')
};

// monkey patch to get around self-signed cert error (Node is secure!)
// this might not be required if the RA certificate has a known CA

const origCreateSecureContext = tls.createSecureContext;
tls.createSecureContext = options => {
    const context = origCreateSecureContext(options);

    const pem = fs.readFileSync('c:/webdev/tls-test-server/cert.pem', {encoding: "ascii"});
    context.context.addCACert(pem);
    return context;
}

function createTLSConnection(server) {
    const conn_tls = tls.connect(PORT_OUT, options, () => {
        if (conn_tls.authorized) {
            console.log(`Connection authorized by CA.`);
        }
        else {
            console.log(`Connection not authorized: ${conn.authorizationError}`);
        }
    });
    
    conn_tls.on("data", data => {
        console.log(`DATA IN: ${data.toString()}`);        
        if (server !== undefined) {
            server.write(data); // forward back to emitter
        }
        else {
            console.log(`ERROR: Received data but no active server connection.`);
        }
    });

    console.log(`Created TLS connection...`);

    return conn_tls;
}


//// TCP receiver section

const server = net.createServer(s => {
    console.log(`CONNECTED: ${s.remoteAddress}:${s.remotePort}`);

    const conn_tls = createTLSConnection(s);

    s.on('connection', data => {
        console.log(`CONNECTED: ${s.remoteAddress}`);
    })

    s.on('data', data => {
        console.log(`DATA OUT: ${s.remoteAddress}: ${data}`);
        if (conn_tls !== undefined) {
            conn_tls.write(data); // forward on via TLS
        }
        else {
            console.log(`ERROR: Received data but no active TLS connection.`);
        }
    });

    s.on('close', data => {
        console.log(`CLOSED: ${s.remoteAddress}:${s.remotePort}`);
        if (conn_tls !== undefined) {
            conn_tls.end();
        }
        else {
            console.log(`ERROR: Can't close -- no active TLS connection.`);
        }
        
    });

    s.on('error', data => {
        console.log(`ERROR: ${data}`);
    });
}).listen(PORT_IN, () => {
    console.log(`Server listening on ${PORT_IN}`);
});

