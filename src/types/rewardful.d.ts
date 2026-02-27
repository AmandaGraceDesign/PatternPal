interface RewardfulGlobal {
  referral: string;
  affiliate: { id: string; name: string; token: string } | null;
  campaign: { id: string; name: string } | null;
}

interface Window {
  rewardful: (...args: unknown[]) => void;
  Rewardful: RewardfulGlobal;
}
