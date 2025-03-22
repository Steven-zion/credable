import express from "express";
import axios from "axios";
import soap from "soap";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Define auth credentials and API key from environment variables
const authUsername = process.env.MIDDLEWARE_USER || "middleware_user";
const authPassword = process.env.MIDDLEWARE_PASSWORD || "middleware_pass";
const LMS_API_KEY = process.env.LMS_API_KEY || "lms-secret-key";
let scoringToken = "";

// Register Middleware with Scoring Engine
async function registerMiddleware() {
	const payload = {
		url: "http://localhost:4000/transactions",
		name: "TransactionMiddleware",
		username: authUsername,
		password: authPassword,
	};
	try {
		const res = await axios.post(
			"https://scoringtest.credable.io/api/v1/client/createClient",
			payload,
			{ timeout: 30000 }
		);
		scoringToken = res.data.token;
		console.log("Middleware registered successfully, token:", scoringToken);
		console.log("Auth credentials:", res.data.username, res.data.password);
	} catch (error) {
		console.error("Error registering Middleware:", error.message);
		if (error.code) console.error("Error code:", error.code);
		if (error.response) {
			console.error("Response status:", error.response.status);
			console.error("Response data:", error.response.data);
		}
	}
}
registerMiddleware();

// Token Endpoint for LMS
app.get("/token", (req, res) => {
	const apiKey = req.headers["x-api-key"];
	if (apiKey !== LMS_API_KEY) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	if (!scoringToken) {
		return res.status(503).json({ error: "Scoring token not available" });
	}
	console.log("Sending scoring token to LMS:", scoringToken);
	res.json({ scoringToken });
});

// Transactions Endpoint for Scoring Engine
app.get("/transactions", async (req, res) => {
	const customerNumber = req.query.customerNumber;
	if (!customerNumber)
		return res.status(400).json({ error: "Customer number required" });

	// Basic Auth check
	const auth = req.headers.authorization;
	const expectedAuth = `Basic ${Buffer.from(
		`${authUsername}:${authPassword}`
	).toString("base64")}`;
	console.log("Expected Auth:", expectedAuth);
	console.log("Received Auth:", auth);
	if (!auth || auth !== expectedAuth) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	// Call CBS Transactions SOAP API
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
		const [transactions] = await soapClient.getTransactionsAsync({
			customerNumber,
		});
		res.json(transactions);
	} catch (error) {
		console.error("Error fetching transactions:", error.message);
		res.status(500).json({ error: "Failed to fetch transactions" });
	}
});

app.listen(4000, () => console.log("Middleware running on port 4000"));
