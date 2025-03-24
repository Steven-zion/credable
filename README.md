# Loan Management System

This project implements a Loan Management System (LMS) with a mock Core Banking System (CBS), a custom Scoring Engine, and a Middleware layer, as per the assessment requirements. The system is designed to run locally and can be tested using tools like Postman.

## Project Overview

The system consists of four backend servers that work together to simulate a loan management process:
- **Mock CBS API**: Simulates a Core Banking System, providing KYC and transaction data.
- **Custom Scoring Engine**: Calculates loan limits and credit scores based on transaction data.
- **Middleware**: Connects the LMS to the CBS and Scoring Engine, handling authentication and data retrieval.
- **Loan Management System (LMS)**: Manages customer subscriptions and loan requests, storing data in MongoDB Atlas.

## Project Structure

- `cbs/server.js`: Mock CBS API (port 8093).
- `scoring-engine/server.js`: Custom Scoring Engine (port 5000).
- `middleware/server.js`: Middleware layer (port 4000).
- `lms/server.js`: Loan Management System (port 3000).
- `.env`: file for environment variables.
- `package.json`: Node.js dependencies and scripts.

## Server Functions

### 1. Mock CBS API (`server.js`)
- **Function**: Simulates a Core Banking System by providing KYC (Know Your Customer) and transaction data for customers.
- **Endpoints**:
  - `/service/customer?wsdl` (SOAP): Returns KYC data for a given `customerNumber`.
    - Example Response: `{ customerNumber: "234774784", firstName: "FirstName234774784", monthlyIncome: 7500, ... }`
  - `/service/transactions?wsdl` (SOAP): Returns transaction data for a given `customerNumber`.
    - Example Response: `[ { alternativechanneltrnscrAmount: 25000, monthlyBalance: 1500000, ... }, ... ]`
- **Data Generation**:
  - KYC data: Random `monthlyIncome` (2000-10000), `gender`, `idType`, timestamps, etc.
  - Transaction data: 1-3 transactions per customer, with random values for fields like `alternativechanneltrnscrAmount` (1000-100000), `credittransactionsAmount` (0-1000), `monthlyBalance` (1000-700000000), and `bouncedChequesDebitNumber` (0-10).
- **Authentication**: Basic Auth (`admin:pwd123`, configurable via `.env`).
- **Port**: `8093`.

### 2. Custom Scoring Engine (`server.js`)
- **Function**: Calculates a loan limit (`limitAmount`) and credit score for customers based on their transaction data.
- **Endpoints**:
  - `/api/v1/client/createClient` (POST): Registers a client (e.g., Middleware) and returns a token.
    - Request: `{ clientName: "middleware", clientDescription: "Middleware for LMS", clientUrl: "http://localhost:4000/transactions", username: "middleware_user", password: "middleware_pass" }`
    - Response: `{ token: "some-uuid" }`
  - `/api/v1/scoring/initiateQueryScore/:customerNumber` (GET): Initiates scoring by fetching transactions from the Middleware and calculating the `limitAmount`.
    - Headers: `{ "client-token": "some-uuid" }`
    - Response: `{ token: "score-token" }`
  - `/api/v1/scoring/queryScore/:token` (GET): Returns the `score` and `limitAmount` for the given scoring token.
    - Headers: `{ "client-token": "some-uuid" }`
    - Response: `{ score: 326, limitAmount: 123500 }`
- **Scoring Logic**:
  - **Base Credit Amount**: Sum of `alternativechanneltrnscrAmount` and `credittransactionsAmount`.
  - **Balance Multiplier**: `1 + (averageMonthlyBalance / 1000000)` (e.g., +10% per 1M in balance).
  - **Risk Penalty**: `1 - (totalBouncedCheques * 0.05)` (e.g., -5% per bounced cheque).
  - **Final `limitAmount`**: `(baseCreditAmount * 2) * balanceMultiplier * riskPenalty`.
  - **Score**: `Math.min(850, 300 + (baseCreditAmount / 1000))` (ranges from 300 to 850).
- **Port**: `5000`.

### 3. Middleware (`server.js`)
- **Function**: Acts as an intermediary between the LMS, CBS, and Scoring Engine, handling authentication and data retrieval.
- **Startup**:
  - Registers with the Scoring Engine (`http://localhost:5000/api/v1/client/createClient`) to get a `scoringToken`.
- **Endpoints**:
  - `/transactions` (GET): Fetches transaction data from the CBS for a given `customerNumber`.
    - Query: `?customerNumber=234774784`
    - Headers: Basic Auth (username/password from Scoring Engine registration).
    - Response: `[ { alternativechanneltrnscrAmount: 25000, ... }, ... ]`
  - `/token` (GET): Provides the `scoringToken` and `scoringEngineUrl` to the LMS.
    - Headers: `{ "x-api-key": "lms-secret-key" }`
    - Response: `{ scoringToken: "some-uuid", scoringEngineUrl: "http://localhost:5000" }`
- **Fallback**: Returns mock transaction data if the CBS is unavailable.
- **Port**: `4000`.

### 4. Loan Management System (`server.js`)
- **Function**: Manages customer subscriptions and loan requests, storing data in MongoDB Atlas.
- **Database**:
  - `Customer` collection: Stores `customerNumber` and `kycData`.
  - `Loan` collection: Stores `customerNumber`, `amount`, `status` (`pending`, `approved`, `rejected`), `requestId`, and `scoringToken`.
- **Endpoints**:
  - `/subscribe` (POST): Subscribes a customer by fetching KYC data from the CBS and saving it to MongoDB.
    - Request: `{ "customerNumber": "234774784" }`
    - Response: `{ "status": "subscribed", "customerNumber": "234774784" }`
  - `/loan/request` (POST): Requests a loan by initiating scoring, querying the score, and approving/rejecting based on the `limitAmount`.
    - Request: `{ "customerNumber": "234774784", "amount": 50000 }`
    - Response: `{ "status": "approved", "request_id": "some-timestamp" }`
  - `/loan/status` (GET): Retrieves the status of a loan by `requestId`.
    - Query: `?requestId=some-timestamp`
    - Response: `{ "status": "approved", "amount": 50000, "request_id": "some-timestamp" }`
- **Port**: `3000`.

## How Servers Are Connected

The servers communicate via HTTP (REST) and SOAP protocols, with authentication to ensure secure interactions:

1. **Mock CBS API ↔ Middleware ↔ LMS**:
   - **Connection**:
     - LMS → CBS: Fetches KYC data during subscription (`/service/customer`).
     - Middleware → CBS: Fetches transaction data for scoring (`/service/transactions`).
   - **Link**: SOAP protocol with Basic Auth (`CBS_USERNAME`, `CBS_PASSWORD`).
   - **Flow**: LMS calls CBS for KYC; Middleware calls CBS for transactions when requested by the Scoring Engine.

2. **Scoring Engine ↔ Middleware ↔ LMS**:
   - **Connection**:
     - Middleware → Scoring Engine: Registers on startup (`/createClient`) to get a `scoringToken`.
     - LMS → Middleware: Gets the `scoringToken` and `scoringEngineUrl` (`/token`).
     - Scoring Engine → Middleware: Fetches transaction data (`/transactions`).
     - LMS → Scoring Engine: Initiates scoring and queries the score (`/initiateQueryScore`, `/queryScore`).
   - **Link**:
     - REST API with authentication:
       - Middleware → Scoring Engine: `client-token` header.
       - Scoring Engine → Middleware: Basic Auth (username/password from registration).
       - LMS → Middleware: `x-api-key` header (`LMS_API_KEY`).
   - **Flow**: LMS uses Middleware to get scoring details, then directly calls the Scoring Engine to calculate the loan limit.

3. **LMS ↔ MongoDB Atlas**:
   - **Connection**: LMS connects to MongoDB Atlas using Mongoose.
   - **Link**: Connection string (`MONGO_ATLAS_URI`) in `.env`.
   - **Flow**: LMS stores customer and loan data persistently.

## Installation and Setup

### Prerequisites
- **Node.js**: v18 or higher.
- **MongoDB Atlas**: A free account for the LMS database.
- **Postman**: For testing API endpoints.
