import express from "express";
import axios from "axios";
import soap from "soap";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Dynamic variables
let scoringToken = "";
let authUsername = "";
let authPassword = "";
const scoringEngineUrl = "http://localhost:5000"; // Only use the custom Scoring Engine

// Utility functions for dynamic data
const getRandomNumber = (min, max) => Math.random() * (max - min) + min;
const getRandomInt = (min, max) =>
	Math.floor(Math.random() * (max - min + 1)) + min;

// Register Middleware with Custom Scoring Engine
async function registerMiddleware() {
	try {
		const payload = {
			clientName: "middleware",
			clientDescription: "Middleware for LMS",
			clientUrl: "http://localhost:4000/transactions",
			username: process.env.MIDDLEWARE_USERNAME || "middleware_user",
			password: process.env.MIDDLEWARE_PASSWORD || "middleware_pass",
		};
		const res = await axios.post(
			"http://localhost:5000/api/v1/client/createClient",
			payload,
			{ timeout: 30000 }
		);
		scoringToken = res.data.token;
		authUsername = payload.username;
		authPassword = payload.password;
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
			"http://localhost:8093/service/transactions?wsdl"
		);
		soapClient.setSecurity(
			new soap.BasicAuthSecurity(
				process.env.CBS_USERNAME || "admin",
				process.env.CBS_PASSWORD || "pwd123"
			)
		);

		const coreBankingService = soapClient.CoreBankingService;
		if (!coreBankingService) {
			throw new Error("CoreBankingService not found on soapClient");
		}

		const transactionPortSoap11 = coreBankingService.TransactionPortSoap11;
		if (!transactionPortSoap11) {
			throw new Error("TransactionPortSoap11 not found on CoreBankingService");
		}

		const response = await new Promise((resolve, reject) => {
			transactionPortSoap11.getTransactions(
				{ customerNumber },
				(err, result) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				}
			);
		});

		const transactions = response.transactions || [];
		console.log("Transactions from CBS:", transactions);
		res.json(transactions);
	} catch (error) {
		console.error("Error fetching transactions:", error.message);
		const mockTransactions = [
			{
				accountNumber: `mocked-account-${customerNumber}`,
				alternativechanneltrnscrAmount: getRandomNumber(1000, 10000),
				alternativechanneltrnscrNumber: getRandomInt(0, 10),
				alternativechanneltrnsdebitAmount: getRandomNumber(500, 5000),
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
