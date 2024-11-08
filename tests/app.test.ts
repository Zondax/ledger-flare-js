/******************************************************************************
 *  (c) 2018 - 2024 Zondax AG
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *****************************************************************************/
import { MockTransport } from "@ledgerhq/hw-transport-mocker";

import { FlareApp } from "../src";
import {
  EVM_TRANSACTION_TX,
  EXPECTED_ADDRESS,
  EXPECTED_EVM_ADDRESS,
  EXPECTED_EVM_PK,
  EXPECTED_EVM_TRANSACTION_R_VALUE,
  EXPECTED_EVM_TRANSACTION_S_VALUE,
  EXPECTED_EVM_TRANSACTION_V_VALUE,
  EXPECTED_HASH_R_VALUE,
  EXPECTED_HASH_S_VALUE,
  EXPECTED_HASH_V_VALUE,
  EXPECTED_PK,
  EXPECTED_R_VALUE,
  EXPECTED_S_VALUE,
  EXPECTED_V_VALUE,
  GET_ADDRESS_RESPONSE_APDU,
  GET_EVM_ADDRESS_RESPONSE_APDU,
  SIGN_EVM_TRANSACTION_RESPONSE_APDU,
  SIGN_HASH_RESPONSE_APDU,
  SIGN_TRANSACTION_RESPONSE_APDU,
  TRANSACTION_HASH,
  TRANSACTION_TX,
} from "./helper";

const ETH_PATH = "m/44'/60'/0'/0'/0";

describe("FlareApp", () => {
  it("Retreive valid public key and address", async () => {
    // Response Payload from getEVMAddress with "m/44'/60'/0'/0'/5"
    const responseBuffer = Buffer.from(GET_ADDRESS_RESPONSE_APDU, "hex");

    const transport = new MockTransport(responseBuffer);
    const app = new FlareApp(transport);
    const resp = await app.getAddressAndPubKey(ETH_PATH);

    expect(resp.compressed_pk.toString("hex")).toEqual(EXPECTED_PK);
    expect(resp.bech32_address).toEqual(EXPECTED_ADDRESS);
  });

  it("Retreive valid transaction signature", async () => {
    // Response Payload from signing
    const responseBuffer = Buffer.from(SIGN_TRANSACTION_RESPONSE_APDU, "hex");

    const transport = new MockTransport(responseBuffer);
    const app = new FlareApp(transport);
    const resp = await app.sign(ETH_PATH, Buffer.from(TRANSACTION_TX, "hex"));

    expect(resp.r?.toString("hex")).toEqual(EXPECTED_R_VALUE);
    expect(resp.s?.toString("hex")).toEqual(EXPECTED_S_VALUE);
    expect(resp.v?.toString("hex")).toEqual(EXPECTED_V_VALUE);
  });

  it("Retreive valid hash signature", async () => {
    // Response Payload from signing
    const responseBuffer = Buffer.from(SIGN_HASH_RESPONSE_APDU, "hex");

    const transport = new MockTransport(responseBuffer);
    const app = new FlareApp(transport);
    const resp = await app.signHash(ETH_PATH, Buffer.from(TRANSACTION_HASH, "hex"));

    expect(resp.r?.toString("hex")).toEqual(EXPECTED_HASH_R_VALUE);
    expect(resp.s?.toString("hex")).toEqual(EXPECTED_HASH_S_VALUE);
    expect(resp.v?.toString("hex")).toEqual(EXPECTED_HASH_V_VALUE);
  });

  it("Retreive valid EVM public key and address", async () => {
    // Response Payload from signing
    const responseBuffer = Buffer.from(GET_EVM_ADDRESS_RESPONSE_APDU, "hex");

    const transport = new MockTransport(responseBuffer);
    const app = new FlareApp(transport);
    const resp = await app.getEVMAddress("m/44'/60'/0'/0'/5", false);

    expect(resp.publicKey.toString()).toEqual(EXPECTED_EVM_PK);
    expect(resp.address.toString()).toEqual(EXPECTED_EVM_ADDRESS);
  });

  it("Retreive valid EVM transaction signature", async () => {
    const responseBuffer = Buffer.from(SIGN_EVM_TRANSACTION_RESPONSE_APDU, "hex");

    const transport = new MockTransport(responseBuffer);
    const app = new FlareApp(transport);
    const resp = await app.signEVMTransaction("m/44'/60'/0'/0'/5", EVM_TRANSACTION_TX, null);

    expect(resp.r).toEqual(EXPECTED_EVM_TRANSACTION_R_VALUE);
    expect(resp.s).toEqual(EXPECTED_EVM_TRANSACTION_S_VALUE);
    expect(resp.v).toEqual(EXPECTED_EVM_TRANSACTION_V_VALUE);
  });
});
