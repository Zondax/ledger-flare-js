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
import Eth from "@ledgerhq/hw-app-eth";
import { APP_KEY, HASH_LEN, INS, P2_VALUES, PKLEN } from "./consts";
import { ResponseAddress, ResponseSign } from "./types";
import { LedgerEthTransactionResolution, LoadConfig } from "@ledgerhq/hw-app-eth/lib/services/types";

import BaseApp, { INSGeneric, processErrorResponse, processResponse } from "@zondax/ledger-js";
import { serializeHrp } from "./helper";
import Transport from "@ledgerhq/hw-transport";
export * from "./types";

export class FlareApp extends BaseApp {
  private eth;

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

  constructor(
    transport: Transport,
    scrambleKey = APP_KEY,
    ethScrambleKey = "w0w",
    ethLoadConfig: LoadConfig = {},
  ) {
    super(transport, FlareApp._params);
    if (transport == null) throw new Error("Transport has not been defined");

    this.eth = new Eth(transport as any, ethScrambleKey, ethLoadConfig);
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

  async signEVMTransaction(path: any, rawTxHex: any, resolution?: LedgerEthTransactionResolution | null) {
    return this.eth.signTransaction(path, rawTxHex, resolution);
  }

  async getEVMAddress(path: any, boolDisplay: any, boolChaincode?: boolean) {
    return this.eth.getAddress(path, boolDisplay, boolChaincode);
  }

  async signPersonalMessage(path: string, messageHex: string): Promise<{ v: number; s: string; r: string }> {
    return this.eth.signPersonalMessage(path, messageHex);
  }
}
