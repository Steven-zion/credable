import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

const registeredClients = {}; // Store registered clients with unique token
const scoringData = {}; // Store scoring data with unique token

// Register Client with Custom Scoring Engine
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

	const token = uuidv4(); // Generate unique token for client
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

// Scoring Engine API for initiating scoring
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

			// Calculation components for limitAmount
			const totalAlternativeCredit = transactionRes.data.reduce(
				(sum, transaction) =>
					sum + (transaction.alternativechanneltrnscrAmount || 0),
				0
			);
			const totalCreditTransactions = transactionRes.data.reduce(
				(sum, transaction) => sum + (transaction.credittransactionsAmount || 0),
				0
			);
			const averageMonthlyBalance =
				transactionRes.data.reduce(
					(sum, transaction) => sum + (transaction.monthlyBalance || 0),
					transactionRes.data.length
				) / (transactionRes.data.length || 1);
			const totalBouncedCheques = transactionRes.data.reduce(
				(sum, transaction) =>
					sum + (transaction.bouncedChequesDebitNumber || 0),
				0
			);

			// Base credit amount
			const baseCreditAmount = totalAlternativeCredit + totalCreditTransactions;
			console.log(
				`Base Credit Amount (alternative + credit transactions) for ${customerNumber}: ${baseCreditAmount}`
			);

			// based on monthly balance
			const balanceMultiplier = 1 + averageMonthlyBalance / 1000000; // e.g., +10% for every 1M in balance
			console.log(
				`Average Monthly Balance: ${averageMonthlyBalance}, Balance Multiplier: ${balanceMultiplier}`
			);

			// based on bounced cheques
			const riskPenalty =
				totalBouncedCheques > 0 ? 1 - totalBouncedCheques * 0.05 : 1; // e.g., -5% per bounced cheque
			console.log(
				`Total Bounced Cheques: ${totalBouncedCheques}, Risk Penalty: ${riskPenalty}`
			);

			// Calculate final limitAmount
			const limitAmount =
				baseCreditAmount * 2 * balanceMultiplier * riskPenalty;
			console.log(`Final limitAmount for ${customerNumber}: ${limitAmount}`);

			// Store scoring data for this customer
			const scoreToken = uuidv4();
			scoringData[scoreToken] = {
				customerNumber,
				totalCreditAmount: baseCreditAmount, // For score calculation in queryScore
				limitAmount,
			};

			res.json({ token: scoreToken });
		} catch (error) {
			console.error("Error calling /transactions endpoint:", error.message);
			res.status(500).json({ error: "Failed to retrieve transactions" });
		}
	}
);

// Scoring Engine API for querying score
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
	const score = Math.min(850, 300 + data.totalCreditAmount / 1000);
	res.json({
		score,
		limitAmount: data.limitAmount,
	});

	delete scoringData[token];
});

app.listen(5000, () =>
	console.log("Custom Scoring Engine running on port 5000")
);
