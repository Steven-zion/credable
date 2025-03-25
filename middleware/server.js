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
const scoringEngineUrl = "http://localhost:5000"; // Custom Scoring Engine URL

// Register Middleware with Custom Scoring Engine
async function registerMiddleware() {
	try {
		const payload = {
			clientName: "middleware",
			clientDescription: "Middleware for LMS",
			clientUrl: "http://localhost:4000/transactions",
			username: process.env.MIDDLEWARE_USERNAME,
			password: process.env.MIDDLEWARE_PASSWORD,
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
		// Create SOAP client that will fetch transactions from CBS
		const soapClient = await soap.createClientAsync(
			"http://localhost:8093/service/transactions?wsdl"
		);
		soapClient.setSecurity(
			new soap.BasicAuthSecurity(
				process.env.CBS_USERNAME,
				process.env.CBS_PASSWORD
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

		// Fetch transactions from CBS
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

		res.status(200).json(transactions);
	} catch (error) {
		console.error("Error fetching transactions:", error.message);
	}
});

// send scoring token and scoring engine url to LMS
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
