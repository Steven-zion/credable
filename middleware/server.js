import express from "express";
import axios from "axios";
import soap from "soap";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

let scoringToken = "";
let authUsername = "";
let authPassword = "";
let scoringEngineUrl = "https://scoringtest.credable.io"; // Default to original Scoring Engine

// Register Middleware with Scoring Engine
async function registerMiddleware() {
	try {
		const payload = {
			clientName: "middleware",
			clientDescription: "Middleware for LMS",
			clientUrl: "http://localhost:4000/transactions",
			username: "middleware_user",
			password: "middleware_pass",
		};

		// Try the original Scoring Engine first
		console.log("Attempting to register with original Scoring Engine...");
		const res = await axios.post(
			"https://scoringtest.credable.io/api/v1/client/createClient",
			payload,
			{ timeout: 30000 }
		);
		scoringToken = res.data.token;
		authUsername = payload.username;
		authPassword = payload.password;
		scoringEngineUrl = "https://scoringtest.credable.io"; // Use original Scoring Engine
		console.log(
			"Middleware registered successfully with original Scoring Engine, token:",
			scoringToken
		);
		console.log("Auth credentials:", authUsername, authPassword);
	} catch (error) {
		console.error(
			"Error registering with original Scoring Engine:",
			error.message
		);
		console.log("Falling back to custom Scoring Engine...");

		// Fall back to custom Scoring Engine
		try {
			const payload = {
				clientName: "middleware",
				clientDescription: "Middleware for LMS",
				clientUrl: "http://localhost:4000/transactions",
				username: "middleware_user",
				password: "middleware_pass",
			};
			const res = await axios.post(
				"http://localhost:5000/api/v1/client/createClient",
				payload,
				{ timeout: 30000 }
			);
			scoringToken = res.data.token;
			authUsername = payload.username;
			authPassword = payload.password;
			scoringEngineUrl = "http://localhost:5000"; // Use custom Scoring Engine
			console.log(
				"Middleware registered successfully with custom Scoring Engine, token:",
				scoringToken
			);
			console.log("Auth credentials:", authUsername, authPassword);
		} catch (error) {
			console.error(
				"Error registering with custom Scoring Engine:",
				error.message
			);
			throw error;
		}
	}
}

// Fetch Transactions from CBS
app.get("/transactions", async (req, res) => {
	const { customerNumber } = req.query;
	if (!customerNumber) {
		return res.status(400).json({ error: "Customer number required" });
	}

	const auth = req.headers.authorization;
	const expectedAuth = `Basic ${Buffer.from(
		`${authUsername}:${authPassword}`
	).toString("base64")}`;
	console.log("Received request to /transactions");
	console.log("Expected Auth:", expectedAuth);
	console.log("Received Auth:", auth);

	if (!auth || auth !== expectedAuth) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		const soapClient = await soap.createClientAsync(
			"https://trxapitest.credable.io/service/transactionWsdl.wsdl"
		);
		soapClient.setSecurity(
			new soap.BasicAuthSecurity(
				process.env.CBS_USERNAME || "admin",
				process.env.CBS_PASSWORD || "pwd123"
			)
		);

		const [transactions] = await new Promise((resolve, reject) => {
			soapClient.getTransactions({ customerNumber }, (err, result) => {
				if (err) {
					reject(err);
				} else {
					resolve([result.return || result]);
				}
			});
		});
		console.log("Transactions from CBS:", transactions);
		res.json(transactions);
	} catch (error) {
		console.error("Error fetching transactions:", error.message);
		const mockTransactions = [
			{
				accountNumber: "mocked-account",
				alternativechanneltrnscrAmount: 1000,
				alternativechanneltrnscrNumber: 0,
				alternativechanneltrnsdebitAmount: 500,
			},
		];
		console.log("Mocked transactions:", mockTransactions);
		res.json(mockTransactions);
	}
});

// Provide Scoring Token and Scoring Engine URL to LMS
app.get("/token", (req, res) => {
	const apiKey = req.headers["x-api-key"];
	if (apiKey !== process.env.LMS_API_KEY) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	console.log("Sending scoring token to LMS:", scoringToken);
	console.log("Scoring Engine URL:", scoringEngineUrl);
	res.json({ scoringToken, scoringEngineUrl });
});

// Start the Middleware
registerMiddleware()
	.then(() => {
		app.listen(4000, () => console.log("Middleware running on port 4000"));
	})
	.catch((error) => {
		console.error("Failed to start Middleware:", error.message);
		process.exit(1);
	});
