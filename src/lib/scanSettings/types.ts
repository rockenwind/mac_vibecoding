export type RepositoryKey = string;

export type ScanBaselineSetting = {
  repositoryKey: RepositoryKey;
  scanId: string;
  updatedAt: string;
};

export type FindingSuppression = {
  repositoryKey: RepositoryKey;
  fingerprint: string;
  reason?: string;
  createdAt: string;
};

export type RuleSetting = {
  ruleId: string;
  enabled: boolean;
  updatedAt: string;
};

export type ScanSettings = {
  baselines: ScanBaselineSetting[];
  suppressions: FindingSuppression[];
  rules: RuleSetting[];
};

export type ScanSettingsStore = {
  read(): Promise<ScanSettings>;
  setBaseline(repositoryKey: RepositoryKey, scanId: string, now?: Date): Promise<ScanSettings>;
  clearBaseline(repositoryKey: RepositoryKey): Promise<ScanSettings>;
  suppressFinding(input: {
    repositoryKey: RepositoryKey;
    fingerprint: string;
    reason?: string;
    now?: Date;
  }): Promise<ScanSettings>;
  unsuppressFinding(repositoryKey: RepositoryKey, fingerprint: string): Promise<ScanSettings>;
  setRuleEnabled(ruleId: string, enabled: boolean, now?: Date): Promise<ScanSettings>;
};
