const https = require("https");
const data = JSON.stringify({
  jsonrpc: "2.0",
  method: "eth_chainId",
  params: [],
  id: 1,
});
const req = https.request(
  "https://celo-sepolia.drpc.org/",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => {
      body += chunk;
    });
    res.on("end", () => {
      console.log("status", res.statusCode);
      console.log("body", body);
    });
  },
);
req.on("error", (err) => {
  console.error("error", err.message);
});
req.write(data);
req.end();
