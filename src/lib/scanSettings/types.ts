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

export type ScanScheduleSetting = {
  repositoryKey: RepositoryKey;
  repositoryUrl: string;
  installationId?: number;
  enabled: boolean;
  intervalDays: number;
  nextRunAt: string;
  lastRunAt?: string;
  lastScanId?: string;
  notifyOnNewFindings: boolean;
  notifyOnResolvedFindings: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScanSettings = {
  baselines: ScanBaselineSetting[];
  suppressions: FindingSuppression[];
  rules: RuleSetting[];
  schedules: ScanScheduleSetting[];
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
  upsertSchedule(
    input: Omit<ScanScheduleSetting, "createdAt" | "updatedAt" | "lastRunAt" | "lastScanId"> & {
      lastRunAt?: string;
      lastScanId?: string;
    },
    now?: Date
  ): Promise<ScanSettings>;
  deleteSchedule(repositoryKey: RepositoryKey): Promise<ScanSettings>;
  markScheduleRun(
    repositoryKey: RepositoryKey,
    input: { lastRunAt: string; lastScanId: string; nextRunAt: string },
    now?: Date
  ): Promise<ScanSettings>;
};
