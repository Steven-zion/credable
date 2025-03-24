import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

const registeredClients = {};
const scoringData = {};

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

			const totalCreditAmount = transactionRes.data.reduce(
				(sum, transaction) =>
					sum + (transaction.alternativechanneltrnscrAmount || 0),
				0
			);
			console.log(
				`Total Credit Amount for ${customerNumber}: ${totalCreditAmount}`
			);

			const scoreToken = uuidv4();
			scoringData[scoreToken] = {
				customerNumber,
				totalCreditAmount,
				limitAmount: totalCreditAmount * 2,
			};

			res.json({ token: scoreToken });
		} catch (error) {
			console.error("Error calling /transactions endpoint:", error.message);
			res.status(500).json({ error: "Failed to retrieve transactions" });
		}
	}
);

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

	// Dynamic score based on totalCreditAmount
	const score = Math.min(850, 300 + data.totalCreditAmount / 1000); // score increases with credit amount

	res.json({
		score,
		limitAmount: data.limitAmount,
	});

	delete scoringData[token];
});

app.listen(5000, () =>
	console.log("Custom Scoring Engine running on port 5000")
);
