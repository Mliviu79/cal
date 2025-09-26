/**
 * OSS replacement for team billing functionality
 * This provides stub implementations for billing features in OSS mode
 */

export interface TeamBillingInput {
  id: number;
  name: string;
  slug: string | null;
  metadata: any;
}

export enum TeamBillingPublishResponseStatus {
  SUCCESS = "SUCCESS",
  REQUIRES_PAYMENT = "REQUIRES_PAYMENT", 
  REQUIRES_UPGRADE = "REQUIRES_UPGRADE"
}

export interface TeamBillingPublishResponse {
  status: TeamBillingPublishResponseStatus;
  redirectUrl: string | null;
}

export interface TeamBilling {
  team: TeamBillingInput;
  publish(): Promise<TeamBillingPublishResponse>;
  cancel(): Promise<void>;
  downgrade(): Promise<void>;
  updateQuantity(): Promise<void>;
}

export class OssTeamBilling implements TeamBilling {
  public team: TeamBillingInput;

  constructor(team: TeamBillingInput) {
    this.team = team;
  }

  async publish(): Promise<TeamBillingPublishResponse> {
    // In OSS mode, teams are always published without payment
    return {
      status: TeamBillingPublishResponseStatus.SUCCESS,
      redirectUrl: null,
    };
  }

  async cancel(): Promise<void> {
    // No-op in OSS mode
  }

  async downgrade(): Promise<void> {
    // No-op in OSS mode
  }

  async updateQuantity(): Promise<void> {
    // No-op in OSS mode
  }
}

export class OssTeamBillingRepository {
  async find(teamId: number) {
    // Minimal team data for OSS billing
    return {
      id: teamId,
      name: "Team",
      slug: null,
      metadata: {},
    };
  }

  async findMany(teamIds: number[]) {
    return teamIds.map(id => ({
      id,
      name: "Team",
      slug: null,
      metadata: {},
    }));
  }
}

export class TeamBilling {
  static repo = new OssTeamBillingRepository();

  static init(team: TeamBillingInput): OssTeamBilling {
    return new OssTeamBilling(team);
  }

  static initMany(teams: TeamBillingInput[]) {
    return teams.map((team) => TeamBilling.init(team));
  }

  static async findAndInit(teamId: number) {
    const team = await TeamBilling.repo.find(teamId);
    return TeamBilling.init(team);
  }

  static async findAndInitMany(teamIds: number[]) {
    const teams = await TeamBilling.repo.findMany(teamIds);
    return TeamBilling.initMany(teams);
  }
}
