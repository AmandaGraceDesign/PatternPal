interface EyeDropperOpenResult {
  sRGBHex: string;
}

interface EyeDropper {
  open(): Promise<EyeDropperOpenResult>;
}

declare var EyeDropper: {
  prototype: EyeDropper;
  new (): EyeDropper;
};

interface Window {
  EyeDropper?: typeof EyeDropper;
}
