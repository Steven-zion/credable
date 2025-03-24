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
		process.exit(1);
	});

// Customer Schema
const CustomerSchema = new mongoose.Schema({
	customerNumber: { type: String, required: true, unique: true },
	kycData: { type: Object, required: true },
});
const Customer = mongoose.model("Customer", CustomerSchema);

// Loan Schema
const LoanSchema = new mongoose.Schema({
	customerNumber: { type: String, required: true },
	amount: { type: Number, required: true },
	status: {
		type: String,
		enum: ["pending", "approved", "rejected"],
		default: "pending",
	},
	requestId: { type: String, required: true, unique: true },
	scoringToken: { type: String },
});
const Loan = mongoose.model("Loan", LoanSchema);

// Configs
const LMS_API_KEY = process.env.LMS_API_KEY;
let scoringToken = "";
let scoringEngineUrl = "";

// Fetch Scoring Token and Scoring Engine URL from Middleware
async function fetchScoringToken() {
	try {
		const res = await axios.get("http://localhost:4000/token", {
			headers: { "x-api-key": LMS_API_KEY },
			timeout: 5000,
		});
		scoringToken = res.data.scoringToken;
		scoringEngineUrl = res.data.scoringEngineUrl;
		console.log("Fetched scoring token:", scoringToken);
		console.log("Scoring Engine URL:", scoringEngineUrl);
	} catch (error) {
		console.error("Error fetching scoring token:", error.message);
		throw new Error("Failed to fetch scoring token");
	}
}

// Query KYC from Mock CBS
async function queryKYC(customerNumber) {
	try {
		const soapClient = await soap.createClientAsync(
			"http://localhost:8093/service/customer?wsdl"
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

		const customerPortSoap11 = coreBankingService.CustomerPortSoap11;
		if (!customerPortSoap11) {
			throw new Error("CustomerPortSoap11 not found on CoreBankingService");
		}

		// Fetch KYC data from CBS
		const response = await new Promise((resolve, reject) => {
			customerPortSoap11.Customer({ customerNumber }, (err, result) => {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});

		const kycData = response.customer;
		if (!kycData) {
			throw new Error("No customer data in KYC response");
		}

		console.log("KYC Data:", kycData);
		return kycData;
	} catch (error) {
		console.error("Error querying KYC:", error.message);
		console.warn("Mocking KYC data due to API error");

		// fallback
		// return {
		// 	customerNumber,
		// 	firstName: `MockFirstName${customerNumber}`,
		// 	lastName: `MockLastName${customerNumber}`,
		// 	email: `mock${customerNumber}@example.com`,
		// 	monthlyIncome: getRandomNumber(2000, 10000),
		// };
	}
}

// Scoring Engine Calls
async function initiateScoring(customerNumber) {
	try {
		const res = await axios.get(
			`${scoringEngineUrl}/api/v1/scoring/initiateQueryScore/${customerNumber}`,
			{ headers: { "client-token": scoringToken }, timeout: 5000 }
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
			`${scoringEngineUrl}/api/v1/scoring/queryScore/${token}`,
			{ headers: { "client-token": scoringToken }, timeout: 5000 }
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

	const existingCustomer = await Customer.findOne({ customerNumber });
	if (existingCustomer) {
		return res.status(400).json({ error: "Customer already subscribed" });
	}

	const kycData = await queryKYC(customerNumber);
	if (!kycData)
		return res.status(404).json({ error: "Customer not found in CBS" });

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

	const customer = await Customer.findOne({ customerNumber });
	if (!customer)
		return res.status(404).json({ error: "Customer not subscribed" });

	const existingLoan = await Loan.findOne({
		customerNumber,
		status: { $in: ["pending", "approved"] },
	});
	if (existingLoan)
		return res.status(400).json({ error: "Active loan exists" });

	try {
		await fetchScoringToken();
	} catch (error) {
		return res.status(500).json({ error: "Failed to fetch scoring token" });
	}

	const scoringTokenResponse = await initiateScoring(customerNumber);
	if (!scoringTokenResponse) {
		return res.status(500).json({ error: "Failed to initiate scoring" });
	}

	const loan = new Loan({
		customerNumber,
		amount,
		status: "pending",
		requestId: Date.now().toString(),
		scoringToken: scoringTokenResponse,
	});
	await loan.save();

	const scoreData = await queryScore(scoringTokenResponse);
	if (scoreData) {
		loan.status = amount <= scoreData.limitAmount ? "approved" : "rejected";
	} else {
		loan.status = "rejected";
	}
	await loan.save();
	res
		.status(200)
		.json({ status: loan.status, request_id: loan.requestId });
});

// Loan Status API
app.get("/loan/status", async (req, res) => {
	try {
		const { requestId } = req.query;
		if (!requestId)
			return res.status(400).json({ error: "Request ID required" });

		const loan = await Loan.findOne({ requestId });
		if (!loan) return res.status(404).json({ error: "Loan not found" });

		res.status(200).json({
			status: loan.status,
			amount: loan.amount,
			request_id: loan.requestId,
		});
	} catch (error) {
		throw new Error("Failed to fetch loan status");
	}
});

app.listen(3000, () => console.log("LMS running on port 3000"));
