import express from "express";
import soap from "soap";

// utility function to generate random numbers within a range
const getRandomNumber = (min, max) => Math.random() * (max - min) + min;

// generate a random integer within a range
const getRandomInt = (min, max) =>
	Math.floor(Math.random() * (max - min + 1)) + min;

// generate a timestamp within a range of years
const getRandomTimestamp = (startYear, endYear) => {
	const start = new Date(startYear, 0, 1).getTime();
	const end = new Date(endYear, 11, 31).getTime();
	return getRandomInt(start, end);
};

// WSDL definition
const wsdl = `
<definitions name="CoreBankingService"
  targetNamespace="http://credable.io/cbs"
  xmlns:tns="http://credable.io/cbs"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <wsdl:types>
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified" targetNamespace="http://credable.io/cbs">
      <xs:element name="CustomerRequest">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="customerNumber" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CustomerResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="customer" type="tns:customer"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:complexType name="customer">
        <xs:sequence>
          <xs:element minOccurs="0" name="createdAt" type="xs:dateTime"/>
          <xs:element minOccurs="0" name="createdDate" type="xs:dateTime"/>
          <xs:element minOccurs="0" name="customerNumber" type="xs:string"/>
          <xs:element minOccurs="0" name="dob" type="xs:dateTime"/>
          <xs:element minOccurs="0" name="email" type="xs:string"/>
          <xs:element minOccurs="0" name="firstName" type="xs:string"/>
          <xs:element minOccurs="0" name="gender" type="tns:gender"/>
          <xs:element minOccurs="0" name="id" type="xs:long"/>
          <xs:element minOccurs="0" name="idNumber" type="xs:string"/>
          <xs:element minOccurs="0" name="idType" type="tns:idType"/>
          <xs:element minOccurs="0" name="lastName" type="xs:string"/>
          <xs:element minOccurs="0" name="middleName" type="xs:string"/>
          <xs:element minOccurs="0" name="mobile" type="xs:string"/>
          <xs:element name="monthlyIncome" type="xs:double"/>
          <xs:element minOccurs="0" name="status" type="tns:status"/>
          <xs:element minOccurs="0" name="updatedAt" type="xs:dateTime"/>
        </xs:sequence>
      </xs:complexType>
      <xs:simpleType name="gender">
        <xs:restriction base="xs:string">
          <xs:enumeration value="MALE"/>
          <xs:enumeration value="FEMALE"/>
        </xs:restriction>
      </xs:simpleType>
      <xs:simpleType name="idType">
        <xs:restriction base="xs:string">
          <xs:enumeration value="PASSPORT"/>
          <xs:enumeration value="NATIONAL_ID"/>
          <xs:enumeration value="DRIVERS_LICENSE"/>
          <xs:enumeration value="VOTERS_ID"/>
        </xs:restriction>
      </xs:simpleType>
      <xs:simpleType name="status">
        <xs:restriction base="xs:string">
          <xs:enumeration value="ACTIVE"/>
          <xs:enumeration value="INACTIVE"/>
        </xs:restriction>
      </xs:simpleType>
      <xs:element name="getTransactionsRequest">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="customerNumber" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="getTransactionsResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="transactions" type="tns:transaction" maxOccurs="unbounded" minOccurs="0"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:complexType name="transaction">
        <xs:sequence>
          <xs:element name="accountNumber" type="xs:string"/>
          <xs:element name="alternativechanneltrnscrAmount" type="xs:double"/>
          <xs:element name="alternativechanneltrnscrNumber" type="xs:int"/>
          <xs:element name="alternativechanneltrnsdebitAmount" type="xs:double"/>
          <xs:element name="alternativechanneltrnsdebitNumber" type="xs:int"/>
          <xs:element name="atmTransactionsNumber" type="xs:int"/>
          <xs:element name="atmtransactionsAmount" type="xs:double"/>
          <xs:element name="bouncedChequesDebitNumber" type="xs:int"/>
          <xs:element name="bouncedchequescreditNumber" type="xs:int"/>
          <xs:element name="bouncedchequetransactionscrAmount" type="xs:double"/>
          <xs:element name="bouncedchequetransactionsdrAmount" type="xs:double"/>
          <xs:element name="chequeDebitTransactionsAmount" type="xs:double"/>
          <xs:element name="chequeDebitTransactionsNumber" type="xs:int"/>
          <xs:element name="createdAt" type="xs:long"/>
          <xs:element name="createdDate" type="xs:long"/>
          <xs:element name="credittransactionsAmount" type="xs:double"/>
          <xs:element name="debitcardpostransactionsAmount" type="xs:double"/>
          <xs:element name="debitcardpostransactionsNumber" type="xs:int"/>
          <xs:element name="fincominglocaltransactioncrAmount" type="xs:double"/>
          <xs:element name="id" type="xs:int"/>
          <xs:element name="incominginternationaltrncrAmount" type="xs:double"/>
          <xs:element name="incominginternationaltrncrNumber" type="xs:int"/>
          <xs:element name="incominglocaltransactioncrNumber" type="xs:int"/>
          <xs:element name="intrestAmount" type="xs:double"/>
          <xs:element name="lastTransactionDate" type="xs:long"/>
          <xs:element name="lastTransactionType" type="xs:string" nillable="true"/>
          <xs:element name="lastTransactionValue" type="xs:int"/>
          <xs:element name="maxAtmTransactions" type="xs:double"/>
          <xs:element name="maxMonthlyBebitTransactions" type="xs:double"/>
          <xs:element name="maxalternativechanneltrnscr" type="xs:double"/>
          <xs:element name="maxalternativechanneltrnsdebit" type="xs:double"/>
          <xs:element name="maxbouncedchequetransactionscr" type="xs:double"/>
          <xs:element name="maxchequedebittransactions" type="xs:double"/>
          <xs:element name="maxdebitcardpostransactions" type="xs:double"/>
          <xs:element name="maxincominginternationaltrncr" type="xs:double"/>
          <xs:element name="maxincominglocaltransactioncr" type="xs:double"/>
          <xs:element name="maxmobilemoneycredittrn" type="xs:double"/>
          <xs:element name="maxmobilemoneydebittransaction" type="xs:double"/>
          <xs:element name="maxmonthlycredittransactions" type="xs:double"/>
          <xs:element name="maxoutgoinginttrndebit" type="xs:double"/>
          <xs:element name="maxoutgoinglocaltrndebit" type="xs:double"/>
          <xs:element name="maxoverthecounterwithdrawals" type="xs:double"/>
          <xs:element name="minAtmTransactions" type="xs:double"/>
          <xs:element name="minMonthlyDebitTransactions" type="xs:double"/>
          <xs:element name="minalternativechanneltrnscr" type="xs:double"/>
          <xs:element name="minalternativechanneltrnsdebit" type="xs:double"/>
          <xs:element name="minbouncedchequetransactionscr" type="xs:double"/>
          <xs:element name="minchequedebittransactions" type="xs:double"/>
          <xs:element name="mindebitcardpostransactions" type="xs:double"/>
          <xs:element name="minincominginternationaltrncr" type="xs:double"/>
          <xs:element name="minincominglocaltransactioncr" type="xs:double"/>
          <xs:element name="minmobilemoneycredittrn" type="xs:double"/>
          <xs:element name="minmobilemoneydebittransaction" type="xs:double"/>
          <xs:element name="minmonthlycredittransactions" type="xs:double"/>
          <xs:element name="minoutgoinginttrndebit" type="xs:double"/>
          <xs:element name="minoutgoinglocaltrndebit" type="xs:double"/>
          <xs:element name="minoverthecounterwithdrawals" type="xs:double"/>
          <xs:element name="mobilemoneycredittransactionAmount" type="xs:double"/>
          <xs:element name="mobilemoneycredittransactionNumber" type="xs:int"/>
          <xs:element name="mobilemoneydebittransactionAmount" type="xs:double"/>
          <xs:element name="mobilemoneydebittransactionNumber" type="xs:int"/>
          <xs:element name="monthlyBalance" type="xs:double"/>
          <xs:element name="monthlydebittransactionsAmount" type="xs:double"/>
          <xs:element name="outgoinginttransactiondebitAmount" type="xs:double"/>
          <xs:element name="outgoinginttrndebitNumber" type="xs:int"/>
          <xs:element name="outgoinglocaltransactiondebitAmount" type="xs:double"/>
          <xs:element name="outgoinglocaltransactiondebitNumber" type="xs:int"/>
          <xs:element name="overdraftLimit" type="xs:double"/>
          <xs:element name="overthecounterwithdrawalsAmount" type="xs:double"/>
          <xs:element name="overthecounterwithdrawalsNumber" type="xs:int"/>
          <xs:element name="transactionValue" type="xs:double"/>
          <xs:element name="updatedAt" type="xs:long"/>
        </xs:sequence>
      </xs:complexType>
    </xs:schema>
  </wsdl:types>
  <wsdl:message name="CustomerRequest">
    <wsdl:part element="tns:CustomerRequest" name="CustomerRequest"/>
  </wsdl:message>
  <wsdl:message name="CustomerResponse">
    <wsdl:part element="tns:CustomerResponse" name="CustomerResponse"/>
  </wsdl:message>
  <wsdl:message name="getTransactionsRequest">
    <wsdl:part element="tns:getTransactionsRequest" name="getTransactionsRequest"/>
  </wsdl:message>
  <wsdl:message name="getTransactionsResponse">
    <wsdl:part element="tns:getTransactionsResponse" name="getTransactionsResponse"/>
  </wsdl:message>
  <wsdl:portType name="CustomerPort">
    <wsdl:operation name="Customer">
      <wsdl:input message="tns:CustomerRequest" name="CustomerRequest"/>
      <wsdl:output message="tns:CustomerResponse" name="CustomerResponse"/>
    </wsdl:operation>
  </wsdl:portType>
  <wsdl:portType name="TransactionPort">
    <wsdl:operation name="getTransactions">
      <wsdl:input message="tns:getTransactionsRequest" name="getTransactionsRequest"/>
      <wsdl:output message="tns:getTransactionsResponse" name="getTransactionsResponse"/>
    </wsdl:operation>
  </wsdl:portType>
  <wsdl:binding name="CustomerPortSoap11" type="tns:CustomerPort">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="Customer">
      <soap:operation soapAction=""/>
      <wsdl:input name="CustomerRequest">
        <soap:body use="literal"/>
      </wsdl:input>
      <wsdl:output name="CustomerResponse">
        <soap:body use="literal"/>
      </wsdl:output>
    </wsdl:operation>
  </wsdl:binding>
  <wsdl:binding name="TransactionPortSoap11" type="tns:TransactionPort">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="getTransactions">
      <soap:operation soapAction=""/>
      <wsdl:input name="getTransactionsRequest">
        <soap:body use="literal"/>
      </wsdl:input>
      <wsdl:output name="getTransactionsResponse">
        <soap:body use="literal"/>
      </wsdl:output>
    </wsdl:operation>
  </wsdl:binding>
  <wsdl:service name="CoreBankingService">
    <wsdl:port binding="tns:CustomerPortSoap11" name="CustomerPortSoap11">
      <soap:address location="http://localhost:8093/service/customer"/>
    </wsdl:port>
    <wsdl:port binding="tns:TransactionPortSoap11" name="TransactionPortSoap11">
      <soap:address location="http://localhost:8093/service/transactions"/>
    </wsdl:port>
  </wsdl:service>
</definitions>`;

// Service implementation
const service = {
	CoreBankingService: { // name of the service
		CustomerPortSoap11: {
			Customer: (args, callback) => {
				const { customerNumber } = args;
				console.log(
					`Received KYC request for customerNumber: ${customerNumber}`
				);
				const kycData = {
					customerNumber,
					firstName: `FirstName${customerNumber}`,
					lastName: `LastName${customerNumber}`,
					middleName: `MiddleName${customerNumber}`,
					email: `user${customerNumber}@example.com`,
					mobile: `+123456789${customerNumber.slice(-4)}`,
					monthlyIncome: getRandomNumber(2000, 10000), // Dynamic monthly income
					gender: getRandomInt(0, 1) === 0 ? "MALE" : "FEMALE",
					idType: ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "VOTERS_ID"][
						getRandomInt(0, 3)
					],
					idNumber: `ID${customerNumber}`,
					status: "ACTIVE",
					dob: new Date(getRandomTimestamp(1970, 2000)).toISOString(),
					createdAt: new Date(getRandomTimestamp(2010, 2023)).toISOString(),
					updatedAt: new Date(getRandomTimestamp(2023, 2025)).toISOString(),
					id: parseInt(customerNumber, 10),
				};
				callback(null, { customer: kycData });
			},
		},
		TransactionPortSoap11: {
			getTransactions: (args, callback) => {
				const { customerNumber } = args;
				console.log(
					`Received transaction request for customerNumber: ${customerNumber}`
				);
        
				// Generating dynamic transaction data
				const numTransactions = getRandomInt(1, 3); // Random number of transactions (1-3)
				const transactions = Array.from(
					{ length: numTransactions },
					(_, index) => ({
						accountNumber: `ACC${customerNumber}-${index + 1}`,
						alternativechanneltrnscrAmount: getRandomNumber(1000, 100000), // Random credit amount
						alternativechanneltrnscrNumber: getRandomInt(0, 10),
						alternativechanneltrnsdebitAmount: getRandomNumber(500, 50000), // Random debit amount
						alternativechanneltrnsdebitNumber: getRandomInt(0, 1000000),
						atmTransactionsNumber: getRandomInt(0, 5000000),
						atmtransactionsAmount: getRandomNumber(0, 1000),
						bouncedChequesDebitNumber: getRandomInt(0, 10),
						bouncedchequescreditNumber: getRandomInt(0, 5),
						bouncedchequetransactionscrAmount: getRandomNumber(0, 1000000),
						bouncedchequetransactionsdrAmount: getRandomNumber(0, 50000),
						chequeDebitTransactionsAmount: getRandomNumber(0, 500000000),
						chequeDebitTransactionsNumber: getRandomInt(0, 50),
						createdAt: getRandomTimestamp(2000, 2025),
						createdDate: getRandomTimestamp(2000, 2025),
						credittransactionsAmount: getRandomNumber(0, 1000),
						debitcardpostransactionsAmount: getRandomNumber(0, 150000),
						debitcardpostransactionsNumber: getRandomInt(0, 1000000000),
						fincominglocaltransactioncrAmount: getRandomNumber(0, 3000000),
						id: index + 1,
						incominginternationaltrncrAmount: getRandomNumber(0, 100),
						incominginternationaltrncrNumber: getRandomInt(0, 300000000),
						incominglocaltransactioncrNumber: getRandomInt(0, 1000),
						intrestAmount: getRandomNumber(0, 500000),
						lastTransactionDate: getRandomTimestamp(2000, 2025),
						lastTransactionType: null,
						lastTransactionValue: getRandomInt(1, 5),
						maxAtmTransactions: getRandomNumber(0, 10),
						maxMonthlyBebitTransactions: getRandomNumber(0, 600000000),
						maxalternativechanneltrnscr: getRandomNumber(0, 100000),
						maxalternativechanneltrnsdebit: getRandomNumber(0, 50000),
						maxbouncedchequetransactionscr: getRandomNumber(0, 1000000),
						maxchequedebittransactions: getRandomNumber(0, 500000000),
						maxdebitcardpostransactions: getRandomNumber(0, 5.5e15),
						maxincominginternationaltrncr: getRandomNumber(0, 100),
						maxincominglocaltransactioncr: getRandomNumber(0, 1000000),
						maxmobilemoneycredittrn: getRandomNumber(0, 1000000),
						maxmobilemoneydebittransaction: getRandomNumber(0, 1000000),
						maxmonthlycredittransactions: getRandomNumber(0, 1000000),
						maxoutgoinginttrndebit: getRandomNumber(0, 1000000),
						maxoutgoinglocaltrndebit: getRandomNumber(0, 1000000),
						maxoverthecounterwithdrawals: getRandomNumber(0, 1000000),
						minAtmTransactions: getRandomNumber(0, 5),
						minMonthlyDebitTransactions: getRandomNumber(0, 1000000),
						minalternativechanneltrnscr: getRandomNumber(0, 50000),
						minalternativechanneltrnsdebit: getRandomNumber(0, 25000),
						minbouncedchequetransactionscr: getRandomNumber(0, 500000),
						minchequedebittransactions: getRandomNumber(0, 250000000),
						mindebitcardpostransactions: getRandomNumber(0, 5e15),
						minincominginternationaltrncr: getRandomNumber(0, 50),
						minincominglocaltransactioncr: getRandomNumber(0, 500000),
						minmobilemoneycredittrn: getRandomNumber(0, 500000),
						minmobilemoneydebittransaction: getRandomNumber(0, 1000),
						minmonthlycredittransactions: getRandomNumber(0, 50000),
						minoutgoinginttrndebit: getRandomNumber(0, 500000),
						minoutgoinglocaltrndebit: getRandomNumber(0, 500000),
						minoverthecounterwithdrawals: getRandomNumber(0, 6000000),
						mobilemoneycredittransactionAmount: getRandomNumber(0, 500000),
						mobilemoneycredittransactionNumber: getRandomInt(0, 1000000),
						mobilemoneydebittransactionAmount: getRandomNumber(0, 20000000),
						mobilemoneydebittransactionNumber: getRandomInt(0, 6000000),
						monthlyBalance: getRandomNumber(1000, 700000000),
						monthlydebittransactionsAmount: getRandomNumber(0, 150000),
						outgoinginttransactiondebitAmount: getRandomNumber(0, 60000000),
						outgoinginttrndebitNumber: getRandomInt(0, 1000),
						outgoinglocaltransactiondebitAmount: getRandomNumber(0, 600000),
						outgoinglocaltransactiondebitNumber: getRandomInt(0, 3000),
						overdraftLimit: getRandomNumber(0, 10),
						overthecounterwithdrawalsAmount: getRandomNumber(0, 400000000),
						overthecounterwithdrawalsNumber: getRandomInt(0, 600000000),
						transactionValue: getRandomNumber(1, 100),
						updatedAt: getRandomTimestamp(2000, 2025),
					})
				);
				callback(null, { transactions });
			},
		},
	},
};

const app = express();
soap.listen(app, "/service/customer", service, wsdl); // expose the customer service
soap.listen(app, "/service/transactions", service, wsdl); // expose the transaction service

app.listen(8093, () => console.log("Mock CBS API running on port 8093"));
