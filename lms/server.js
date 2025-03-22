import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import soap from "soap";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// MongoDB Atlas Connection
mongoose
	.connect(process.env.MONGO_ATLAS_URI)
	.then(() => {
		console.log("Connected to MongoDB Atlas");
	})
	.catch((error) => {
		console.error("Error connecting to MongoDB Atlas:", error.message);
		process.exit(1); // Exit the process if MongoDB connection fails
	});

// Customer Schema (to store KYC data)
const CustomerSchema = new mongoose.Schema({
	customerNumber: { type: String, required: true, unique: true },
	kycData: { type: Object, required: true },
});
const Customer = mongoose.model("Customer", CustomerSchema);

// Loan Schema (to store loan requests)
const LoanSchema = new mongoose.Schema({
	customerNumber: { type: String, required: true },
	amount: { type: Number, required: true },
	status: {
		type: String,
		enum: ["pending", "approved", "rejected"],
		default: "pending",
	},
	requestId: { type: String, required: true, unique: true },
	scoringToken: { type: String }, // Token from initiateQueryScore
});
const Loan = mongoose.model("Loan", LoanSchema);

// Configuration from environment variables
const LMS_API_KEY = process.env.LMS_API_KEY || "lms-secret-key";
let scoringToken = "";

// Fetch Scoring Token from Middleware
async function fetchScoringToken() {
	try {
		const res = await axios.get("http://localhost:4000/token", {
			headers: { "x-api-key": LMS_API_KEY },
			timeout: 5000,
		});
		scoringToken = res.data.scoringToken;
		console.log("Fetched scoring token:", scoringToken);
	} catch (error) {
		console.error("Error fetching scoring token:", error.message);
		throw new Error("Failed to fetch scoring token");
	}
}

// Query KYC from CBS
async function queryKYC(customerNumber) {
	try {
		const soapClient = await soap.createClientAsync(
			"https://kycapitest.credable.io/service/customerWsdl.wsdl"
		);
		soapClient.setSecurity(
			new soap.BasicAuthSecurity(
				process.env.CBS_USERNAME || "admin",
				process.env.CBS_PASSWORD || "pwd123"
			)
		);
		const [kycData] = await soapClient.getCustomerAsync({ customerNumber });
		return kycData;
	} catch (error) {
		console.error("Error querying KYC:", error.message);
		return null;
	}
}

// Scoring Engine Calls
async function initiateScoring(customerNumber) {
	try {
		const res = await axios.get(
			`https://scoringtest.credable.io/api/v1/scoring/initiateQueryScore/${customerNumber}`,
			{ headers: { "client-token": scoringToken } }
		);
		return res.data.token;
	} catch (error) {
		console.error("Error initiating scoring:", error.message);
		return null;
	}
}

async function queryScore(token) {
	try {
		const res = await axios.get(
			`https://scoringtest.credable.io/api/v1/scoring/queryScore/${token}`,
			{ headers: { "client-token": scoringToken } }
		);
		return res.data;
	} catch (error) {
		console.error("Error querying score:", error.message);
		return null;
	}
}

// Subscribe API
app.post("/subscribe", async (req, res) => {
	const { customerNumber } = req.body;
	if (!customerNumber)
		return res.status(400).json({ error: "Customer number required" });

	// Check if customer already exists
	const existingCustomer = await Customer.findOne({ customerNumber });
	if (existingCustomer) {
		return res.status(400).json({ error: "Customer already subscribed" });
	}

	// Fetch KYC data from CBS
	const kycData = await queryKYC(customerNumber);
	if (!kycData)
		return res.status(404).json({ error: "Customer not found in CBS" });

	// Store customer data
	try {
		const customer = new Customer({ customerNumber, kycData });
		await customer.save();
		res.json({ status: "subscribed", customerNumber });
	} catch (error) {
		console.error("Error saving customer:", error.message);
		res.status(500).json({ error: "Failed to subscribe customer" });
	}
});

// Loan Request API
app.post("/loan/request", async (req, res) => {
	const { customerNumber, amount } = req.body;
	if (!customerNumber || !amount) {
		return res
			.status(400)
			.json({ error: "Customer number and amount required" });
	}

	// Check if customer is subscribed
	const customer = await Customer.findOne({ customerNumber });
	if (!customer)
		return res.status(404).json({ error: "Customer not subscribed" });

	// Check for active loans
	const existingLoan = await Loan.findOne({
		customerNumber,
		status: { $in: ["pending", "approved"] },
	});
	if (existingLoan)
		return res.status(400).json({ error: "Active loan exists" });

	// Fetch scoring token from Middleware
	try {
		await fetchScoringToken();
	} catch (error) {
		return res.status(500).json({ error: "Failed to fetch scoring token" });
	}

	// Initiate scoring
	const scoringTokenResponse = await initiateScoring(customerNumber);
	if (!scoringTokenResponse) {
		return res.status(500).json({ error: "Failed to initiate scoring" });
	}

	// Create loan request
	const loan = new Loan({
		customerNumber,
		amount,
		status: "pending",
		requestId: Date.now().toString(),
		scoringToken: scoringTokenResponse,
	});
	await loan.save();

	// Retry querying score (max 5 attempts, 5-second delay)
	let retries = 5;
	while (retries > 0) {
		const scoreData = await queryScore(scoringTokenResponse);
		if (scoreData) {
			loan.status = amount <= scoreData.limitAmount ? "approved" : "rejected";
			await loan.save();
			return res.json({ status: loan.status, request_id: loan.requestId });
		}
		await new Promise((resolve) => setTimeout(resolve, 5000));
		retries--;
	}

	// If retries are exhausted, reject the loan and allow new requests
	loan.status = "rejected";
	await loan.save();
	res.json({ status: "rejected", request_id: loan.requestId });
});

// Loan Status API
app.get("/loan/status", async (req, res) => {
	const { requestId } = req.query;
	if (!requestId) return res.status(400).json({ error: "Request ID required" });

	const loan = await Loan.findOne({ requestId });
	if (!loan) return res.status(404).json({ error: "Loan not found" });

	res.json({
		status: loan.status,
		amount: loan.amount,
		request_id: loan.requestId,
	});
});

// Start the LMS server
app.listen(3000, () => console.log("LMS running on port 3000"));
