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
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import { MockTransport } from "@ledgerhq/hw-transport-mocker";
import { Observable } from "rxjs";

import { FlareApp } from "../src";
import type { EvmSignerOptions } from "../src/types";
import {
  EVM_TRANSACTION_TX,
  EXPECTED_ADDRESS,
  EXPECTED_EVM_ADDRESS,
  EXPECTED_EVM_PK,
  EXPECTED_EVM_TRANSACTION_R_VALUE,
  EXPECTED_EVM_TRANSACTION_S_VALUE,
  EXPECTED_EVM_TRANSACTION_V_VALUE,
  EXPECTED_PERSONAL_MESSAGE_R_VALUE,
  EXPECTED_PERSONAL_MESSAGE_S_VALUE,
  EXPECTED_PERSONAL_MESSAGE_V_VALUE,
  EXPECTED_HASH_R_VALUE,
  EXPECTED_HASH_S_VALUE,
  EXPECTED_HASH_V_VALUE,
  EXPECTED_PK,
  EXPECTED_R_VALUE,
  EXPECTED_S_VALUE,
  EXPECTED_V_VALUE,
  GET_ADDRESS_RESPONSE_APDU,
  PERSONAL_MESSAGE_HEX,
  SIGN_HASH_RESPONSE_APDU,
  SIGN_TRANSACTION_RESPONSE_APDU,
  TRANSACTION_HASH,
  TRANSACTION_TX,
} from "./helper";

const ETH_PATH = "m/44'/60'/0'/0'/0";

const mockSigner = { signTransaction: jest.fn(), getAddress: jest.fn(), signMessage: jest.fn() };
jest.mock("@ledgerhq/device-signer-kit-ethereum", () => ({
  SignerEthBuilder: jest
    .fn()
    .mockImplementation(() => ({ withContextModule: jest.fn(), build: () => mockSigner })),
}));

/** A finished DMK device action, the way the signer kit hands them out. */
function completed<Output>(output: Output) {
  return {
    observable: new Observable<{ status: DeviceActionStatus.Completed; output: Output }>((subscriber) => {
      subscriber.next({ status: DeviceActionStatus.Completed, output });
      subscriber.complete();
    }),
    cancel() {},
  };
}

const evm = { dmk: {}, sessionId: "session-1" } as unknown as EvmSignerOptions;
const R = `0x${EXPECTED_EVM_TRANSACTION_R_VALUE}` as const;
const S = `0x${EXPECTED_EVM_TRANSACTION_S_VALUE}` as const;

beforeEach(() => {
  jest.clearAllMocks();
});

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

  it("Refuses EVM calls without a DMK session, before touching the device", async () => {
    const app = new FlareApp(new MockTransport(Buffer.alloc(0)));
    await expect(app.getEVMAddress("m/44'/60'/0'/0'/5")).rejects.toThrow(
      "construct FlareApp with { dmk, sessionId }",
    );
    expect(SignerEthBuilder).not.toHaveBeenCalled();
  });

  it("Retreive valid EVM public key and address", async () => {
    mockSigner.getAddress.mockReturnValue(
      completed({ publicKey: EXPECTED_EVM_PK, address: EXPECTED_EVM_ADDRESS }),
    );

    const app = new FlareApp(new MockTransport(Buffer.alloc(0)), evm);
    const resp = await app.getEVMAddress("m/44'/60'/0'/0'/5", false);

    expect(resp.publicKey).toEqual(EXPECTED_EVM_PK);
    expect(resp.address).toEqual(EXPECTED_EVM_ADDRESS);
    expect(SignerEthBuilder).toHaveBeenCalledWith({ dmk: evm.dmk, sessionId: evm.sessionId });
    expect(mockSigner.getAddress).toHaveBeenCalledWith("44'/60'/0'/0'/5", {
      checkOnDevice: false,
      returnChainCode: false,
      skipOpenApp: true,
    });
  });

  it("Retreive valid EVM transaction signature", async () => {
    mockSigner.signTransaction.mockReturnValue(
      completed({ r: R, s: S, v: parseInt(EXPECTED_EVM_TRANSACTION_V_VALUE, 16) }),
    );

    const app = new FlareApp(new MockTransport(Buffer.alloc(0)), evm);
    const resp = await app.signEVMTransaction("m/44'/60'/0'/0'/5", EVM_TRANSACTION_TX);

    expect(resp.r).toEqual(EXPECTED_EVM_TRANSACTION_R_VALUE);
    expect(resp.s).toEqual(EXPECTED_EVM_TRANSACTION_S_VALUE);
    expect(resp.v).toEqual(EXPECTED_EVM_TRANSACTION_V_VALUE);
    expect(mockSigner.signTransaction).toHaveBeenCalledWith(
      "44'/60'/0'/0'/5",
      new Uint8Array(Buffer.from(EVM_TRANSACTION_TX, "hex")),
      { skipOpenApp: true },
    );
  });

  it("Retreive valid personal message signature", async () => {
    mockSigner.signMessage.mockReturnValue(
      completed({
        r: `0x${EXPECTED_PERSONAL_MESSAGE_R_VALUE}`,
        s: `0x${EXPECTED_PERSONAL_MESSAGE_S_VALUE}`,
        v: EXPECTED_PERSONAL_MESSAGE_V_VALUE,
      }),
    );

    const app = new FlareApp(new MockTransport(Buffer.alloc(0)), evm);
    const resp = await app.signPersonalMessage("m/44'/60'/0'/0'/5", PERSONAL_MESSAGE_HEX);

    expect(resp).toEqual({
      r: EXPECTED_PERSONAL_MESSAGE_R_VALUE,
      s: EXPECTED_PERSONAL_MESSAGE_S_VALUE,
      v: EXPECTED_PERSONAL_MESSAGE_V_VALUE,
    });
    // the message goes to the device as bytes, never re-encoded as text
    expect(mockSigner.signMessage).toHaveBeenCalledWith(
      "44'/60'/0'/0'/5",
      new Uint8Array(Buffer.from(PERSONAL_MESSAGE_HEX, "hex")),
      { skipOpenApp: true },
    );
  });

  it("Surfaces a device rejection as a DeviceActionError with statusCode 0x6985", async () => {
    mockSigner.signTransaction.mockReturnValue({
      observable: new Observable((subscriber) => {
        subscriber.next({
          status: DeviceActionStatus.Error,
          error: { _tag: "EthAppCommandError", errorCode: "6985" },
        });
      }),
      cancel() {},
    });

    const app = new FlareApp(new MockTransport(Buffer.alloc(0)), evm);
    await expect(app.signEVMTransaction("m/44'/60'/0'/0'/5", EVM_TRANSACTION_TX)).rejects.toMatchObject({
      name: "DeviceActionError",
      statusCode: 0x6985,
    });
  });
});
