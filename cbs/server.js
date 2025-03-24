import express from "express";
import soap from "soap";

const app = express();

// WSDL for the unified CBS (combining KYC and Transactions)
const wsdl = `
<definitions name="CoreBankingService"
  targetNamespace="http://credable.io/cbs"
  xmlns:tns="http://credable.io/cbs"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <!-- Types for both KYC and Transactions -->
  <wsdl:types>
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified" targetNamespace="http://credable.io/cbs">
      <!-- KYC Types -->
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
      <!-- Transaction Types -->
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
        </xs:sequence>
      </xs:complexType>
    </xs:schema>
  </wsdl:types>
  <!-- Messages for KYC -->
  <wsdl:message name="CustomerRequest">
    <wsdl:part element="tns:CustomerRequest" name="CustomerRequest"/>
  </wsdl:message>
  <wsdl:message name="CustomerResponse">
    <wsdl:part element="tns:CustomerResponse" name="CustomerResponse"/>
  </wsdl:message>
  <!-- Messages for Transactions -->
  <wsdl:message name="getTransactionsRequest">
    <wsdl:part element="tns:getTransactionsRequest" name="getTransactionsRequest"/>
  </wsdl:message>
  <wsdl:message name="getTransactionsResponse">
    <wsdl:part element="tns:getTransactionsResponse" name="getTransactionsResponse"/>
  </wsdl:message>
  <!-- Port Types -->
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
  <!-- Bindings -->
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
  <!-- Service -->
  <wsdl:service name="CoreBankingService">
    <wsdl:port binding="tns:CustomerPortSoap11" name="CustomerPortSoap11">
      <soap:address location="http://localhost:8093/service/customer"/>
    </wsdl:port>
    <wsdl:port binding="tns:TransactionPortSoap11" name="TransactionPortSoap11">
      <soap:address location="http://localhost:8093/service/transactions"/>
    </wsdl:port>
  </wsdl:service>
</definitions>`;

// Service implementation for both KYC and Transactions
const service = {
	CoreBankingService: {
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
					monthlyIncome: 5000.0,
					gender: "MALE",
					idType: "NATIONAL_ID",
					idNumber: `ID${customerNumber}`,
					status: "ACTIVE",
					dob: "1990-01-01T00:00:00Z",
					createdAt: "2023-01-01T00:00:00Z",
					updatedAt: "2023-10-01T00:00:00Z",
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
				const transactions = [
					{
						accountNumber: `ACC${customerNumber}`,
						alternativechanneltrnscrAmount: 1000.0,
						alternativechanneltrnscrNumber: 5,
						alternativechanneltrnsdebitAmount: 500.0,
					},
					{
						accountNumber: `ACC${customerNumber}-2`,
						alternativechanneltrnscrAmount: 2000.0,
						alternativechanneltrnscrNumber: 3,
						alternativechanneltrnsdebitAmount: 1000.0,
					},
				];
				callback(null, { transactions });
			},
		},
	},
};

// Expose both endpoints on the same server
soap.listen(app, "/service/customer", service, wsdl);
soap.listen(app, "/service/transactions", service, wsdl);

app.listen(8093, () => console.log("Mock CBS API running on port 8093"));
