import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

const registeredClients = {};
const scoringData = {};

// Register a client (Middleware)
app.post("/api/v1/client/createClient", (req, res) => {
	const { clientName, clientDescription, clientUrl, username, password } =
		req.body;
	if (
		!clientName ||
		!clientDescription ||
		!clientUrl ||
		!username ||
		!password
	) {
		return res.status(400).json({ error: "All fields are required" });
	}

	const token = uuidv4();
	registeredClients[token] = {
		clientName,
		clientDescription,
		clientUrl,
		username,
		password,
	};
	console.log(`Client registered: ${clientName}, Token: ${token}`);
	res.json({ token });
});

// Initiate Scoring
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

			// Calculate total credit amount from transactions
			const totalCreditAmount = transactionRes.data.reduce(
				(sum, transaction) =>
					sum + (transaction.alternativechanneltrnscrAmount || 0),
				0
			);
			console.log(
				`Total Credit Amount for ${customerNumber}: ${totalCreditAmount}`
			);

			// Store scoring data for this customer
			const scoreToken = uuidv4();
			scoringData[scoreToken] = {
				customerNumber,
				totalCreditAmount,
				limitAmount: totalCreditAmount * 2, // Calculate limitAmount
			};

			res.json({ token: scoreToken });
		} catch (error) {
			console.error("Error calling /transactions endpoint:", error.message);
			res.status(500).json({ error: "Failed to retrieve transactions" });
		}
	}
);

// Query Score
app.get("/api/v1/scoring/queryScore/:token", (req, res) => {
	const { token } = req.params;
	const clientToken = req.headers["client-token"];
	if (!clientToken || !registeredClients[clientToken]) {
		return res.status(401).json({ error: "Invalid or missing client-token" });
	}

	const data = scoringData[token];
	if (!data) {
		return res.status(404).json({ error: "Scoring token not found" });
	}

	// Return the score and limitAmount
	const score = 750; // Placeholder score
	res.json({
		score,
		limitAmount: data.limitAmount,
	});

	// Clean up
	delete scoringData[token];
});

app.listen(5000, () =>
	console.log("Custom Scoring Engine running on port 5000")
);
