import express from "express";
import axios from "axios";
import soap from "soap";
// dotenv
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

let scoringToken = "";

// Register Middleware with Scoring Engine
async function registerMiddleware() {
	const payload = {
		url: "http://localhost:4000/transactions",
		name: "TransactionMiddleware",
		username: process.env.MIDDLEWARE_USER,
		password: process.env.MIDDLEWARE_PASSWORD,
	};
	try {
		const res = await axios.post(
			"https://scoringtest.credable.io/api/v1/client/createClient",
			payload
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
				process.env.CBS_USERNAME,
				process.env.CBS_PASSWORD
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
