/** ******************************************************************************
 *  (c) 2019-2020 Zondax GmbH
 *  (c) 2016-2017 Ledger
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
 ******************************************************************************* */
import { SignerEthBuilder, type SignerEth } from "@ledgerhq/device-signer-kit-ethereum";
import { HASH_LEN, INS, P2_VALUES, PKLEN } from "./consts";
import { EvmSignerOptions, ResponseAddress, ResponseSign } from "./types";
import {
  evmDerivationPath,
  hexToBytes,
  runDeviceAction,
  toEvmMessageSignature,
  toEvmTransactionSignature,
} from "./evm";

import BaseApp, { INSGeneric, processErrorResponse, processResponse } from "@zondax/ledger-js";
import { serializeHrp } from "./helper";
export * from "./types";
export { DeviceActionError } from "./evm";

export class FlareApp extends BaseApp {
  private readonly evm: EvmSignerOptions | undefined;
  private signer: SignerEth | undefined;

  static _INS = {
    GET_VERSION: 0x00,
    GET_ADDR: 0x01,
    SIGN: 0x02,
    SIGN_HASH: 0x03,
  };

  static _params = {
    cla: 0x58,
    ins: { ...FlareApp._INS } as INSGeneric,
    p1Values: {
      ONLY_RETRIEVE: 0x00,
      SHOW_ADDRESS_IN_DEVICE: 0x01,
    },
    acceptedPathLengths: [4, 5, 6],
    chunkSize: 250,
  };

  /**
   * @param transport - anything that can send an APDU (`DMKTransport`, or a legacy hw-transport)
   * @param evm - the DMK session behind that transport; needed only for the EVM methods
   */
  constructor(transport: any, evm?: EvmSignerOptions) {
    super(transport, FlareApp._params);
    if (transport == null) throw new Error("Transport has not been defined");
    this.evm = evm;
  }

  async _pubkey(path: string, show = true, hrp?: string): Promise<ResponseAddress> {
    const p1 = show ? this.P1_VALUES.SHOW_ADDRESS_IN_DEVICE : this.P1_VALUES.ONLY_RETRIEVE;
    const serializedPath = this.serializePath(path);
    const serializedHrp = serializeHrp(hrp);

    try {
      const responseBuffer = await this.transport.send(
        this.CLA,
        this.INS.GET_ADDR,
        p1,
        P2_VALUES.DEFAULT,
        Buffer.concat([serializedHrp, serializedPath]),
      );

      const response = processResponse(responseBuffer);

      const compressed_pk = response.readBytes(PKLEN);
      const bech32_address = response.readBytes(response.length()).toString("ascii");

      return {
        compressed_pk,
        bech32_address,
        returnCode: 0x9000,
        errorMessage: "No errors",
      };
    } catch (e) {
      throw processErrorResponse(e);
    }
  }

  async getAddressAndPubKey(path: string, hrp = "flare"): Promise<ResponseAddress> {
    return this._pubkey(path, false, hrp);
  }

  async showAddressAndPubKey(path: string, hrp = "flare"): Promise<ResponseAddress> {
    return this._pubkey(path, true, hrp);
  }

  async sign(path: string, message: Buffer): Promise<ResponseSign> {
    const chunks = this.prepareChunks(path, message);
    try {
      let result = await this.signSendChunk(INS.SIGN, 1, chunks.length, chunks[0]);
      for (let i = 1; i < chunks.length; i += 1) {
        result = await this.signSendChunk(INS.SIGN, 1 + i, chunks.length, chunks[i]);
      }

      return {
        r: result.readBytes(32),
        s: result.readBytes(32),
        v: result.readBytes(1),
        returnCode: 0x9000,
        errorMessage: "No errors",
      };
    } catch (e) {
      throw processErrorResponse(e);
    }
  }

  async signHash(path: string, hash: Buffer): Promise<ResponseSign> {
    if (hash.length !== HASH_LEN) {
      throw new Error("Invalid hash length");
    }

    const chunks = this.prepareChunks(path, hash);
    try {
      let result = await this.signSendChunk(INS.SIGN_HASH, 1, chunks.length, chunks[0]);
      for (let i = 1; i < chunks.length; i += 1) {
        result = await this.signSendChunk(INS.SIGN_HASH, 1 + i, chunks.length, chunks[i]);
      }

      return {
        r: result.readBytes(32),
        s: result.readBytes(32),
        v: result.readBytes(1),
        returnCode: 0x9000,
        errorMessage: "No errors",
      };
    } catch (e) {
      throw processErrorResponse(e);
    }
  }

  // ---------------------------------------------------------------------------
  // EVM
  //
  // Signing goes through the Device Management Kit's Ethereum signer, which replaces
  // `@ledgerhq/hw-app-eth` (deprecated, removed September 2026).
  // ---------------------------------------------------------------------------

  /** The Ethereum signer, built on first use so that non-EVM callers never need a DMK session. */
  private get ethSigner(): SignerEth {
    if (this.signer === undefined) {
      if (this.evm === undefined) {
        throw new Error(
          "EVM signing needs a Device Management Kit session: construct FlareApp with { dmk, sessionId }",
        );
      }
      const { dmk, sessionId, originToken, contextModule } = this.evm;
      const builder = new SignerEthBuilder({
        dmk,
        sessionId,
        ...(originToken !== undefined ? { originToken } : {}),
      });
      if (contextModule !== undefined) {
        builder.withContextModule(contextModule);
      }
      this.signer = builder.build();
    }
    return this.signer;
  }

  /**
   * Signs a serialized EVM transaction. Clear-signing context is resolved by the signer's
   * context module, so there is no `resolution` argument any more.
   *
   * @param path - BIP-32 path, e.g. `m/44'/60'/0'/0/0`
   * @param rawTxHex - the RLP-encoded transaction as hex (`0x` prefix optional)
   * @returns `r`, `s` and `v` as hex strings, as `hw-app-eth` returned them
   */
  async signEVMTransaction(path: string, rawTxHex: string): Promise<{ s: string; v: string; r: string }> {
    const signature = await runDeviceAction(
      this.ethSigner.signTransaction(evmDerivationPath(path), hexToBytes(rawTxHex), { skipOpenApp: true }),
    );
    return toEvmTransactionSignature(signature);
  }

  async getEVMAddress(
    path: string,
    boolDisplay = false,
    boolChaincode = false,
  ): Promise<{ publicKey: string; address: string; chainCode?: string }> {
    const { publicKey, address, chainCode } = await runDeviceAction(
      this.ethSigner.getAddress(evmDerivationPath(path), {
        checkOnDevice: boolDisplay,
        returnChainCode: boolChaincode,
        skipOpenApp: true,
      }),
    );
    return chainCode === undefined ? { publicKey, address } : { publicKey, address, chainCode };
  }

  /**
   * Signs an EIP-191 personal message.
   *
   * @param path - BIP-32 path
   * @param messageHex - the message bytes as hex, as `hw-app-eth` took them
   */
  async signPersonalMessage(path: string, messageHex: string): Promise<{ v: number; s: string; r: string }> {
    const signature = await runDeviceAction(
      this.ethSigner.signMessage(evmDerivationPath(path), hexToBytes(messageHex), { skipOpenApp: true }),
    );
    return toEvmMessageSignature(signature);
  }
}
