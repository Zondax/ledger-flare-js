export function serializeHrp(hrp?: string): Buffer {
  if (hrp) {
    const bufHrp = Buffer.from(hrp, "ascii");
    return Buffer.concat([Buffer.alloc(1, bufHrp.length), bufHrp]);
  } else {
    return Buffer.alloc(1, 0);
  }
}
