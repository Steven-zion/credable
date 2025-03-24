import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

let registeredClients = {};

// Simulate createClient endpoint
app.post("/api/v1/client/createClient", (req, res) => {
	const { clientName, clientDescription, clientUrl, username, password } =
		req.body;
	if (!clientName || !clientUrl || !username || !password) {
		return res.status(400).json({ error: "Missing required fields" });
	}

	const clientId = Object.keys(registeredClients).length;
	const token = `uuid-token-${clientId}`;
	registeredClients[token] = {
		clientName,
		clientDescription,
		clientUrl,
		username,
		password,
	};

	console.log(
		`Client registered: ${clientName}, URL: ${clientUrl}, Token: ${token}`
	);
	res.json({
		id: clientId,
		url: clientUrl,
		name: clientName,
		username,
		password,
		token,
	});
});

// Simulate initiateQueryScore
app.get(
	"/api/v1/scoring/initiateQueryScore/:customerNumber",
	async (req, res) => {
		const { customerNumber } = req.params;
		const token = req.headers["client-token"];
		if (!token || !registeredClients[token]) {
			return res.status(401).json({ error: "Invalid or missing client-token" });
		}

		const client = registeredClients[token];
		try {
			// Call the Middleware's /transactions endpoint
			const auth = `Basic ${Buffer.from(
				`${client.username}:${client.password}`
			).toString("base64")}`;
			const transactionRes = await axios.get(
				`${client.clientUrl}?customerNumber=${customerNumber}`,
				{
					headers: { Authorization: auth },
				}
			);
			console.log(
				"Transactions retrieved from Middleware:",
				transactionRes.data
			);

			// Simulate generating a scoring token
			const scoreToken = `score-token-${customerNumber}`;
			res.json({ token: scoreToken });
		} catch (error) {
			console.error("Error calling /transactions endpoint:", error.message);
			res.status(500).json({ error: "Failed to retrieve transactions" });
		}
	}
);

// Simulate queryScore
app.get("/api/v1/scoring/queryScore/:token", (req, res) => {
	const { token } = req.params;
	const clientToken = req.headers["client-token"];
	if (!clientToken || !registeredClients[clientToken]) {
		return res.status(401).json({ error: "Invalid or missing client-token" });
	}

	// Simulate scoring logic (e.g., based on transaction data)
	res.json({ limitAmount: 50000 });
});

app.listen(5000, () =>
	console.log("Custom Scoring Engine running on port 5000")
);
